-- BBO Digital Kuttab — Row Level Security (PRD bagian 8)
-- Orang tua: hanya baris santri yang terhubung lewat guardians.
-- Guru: membaca laporan santri di kelasnya (class_teachers); menulis hanya
--       teacher_feedback, signatures guru, status reviewed, dan konten BBO kelasnya.
-- Laporan berstatus reviewed tidak bisa diubah orang tua.
-- Admin: profiles.role = 'admin'.

-- Fungsi bantu di schema yang tidak diekspos lewat API.
create schema if not exists app;
grant usage on schema app to authenticated;

create or replace function app.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;

create or replace function app.is_teacher()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('teacher', 'admin'));
$$;

create or replace function app.is_guardian_of(p_student uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.guardians
    where student_id = p_student and profile_id = (select auth.uid())
  );
$$;

create or replace function app.is_teacher_of_class(p_class uuid, p_subject public.subject_kind default null)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.class_teachers
    where class_id = p_class
      and teacher_id = (select auth.uid())
      and (p_subject is null or subject = p_subject)
  );
$$;

create or replace function app.is_teacher_of_student(p_student uuid, p_subject public.subject_kind default null)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.students s
    join public.class_teachers ct on ct.class_id = s.class_id
    where s.id = p_student
      and ct.teacher_id = (select auth.uid())
      and (p_subject is null or ct.subject = p_subject)
  );
$$;

create or replace function app.sheet_class(p_sheet uuid)
returns uuid language sql stable security definer set search_path = ''
as $$
  select class_id from public.bbo_sheets where id = p_sheet;
$$;

create or replace function app.section_sheet(p_section uuid)
returns uuid language sql stable security definer set search_path = ''
as $$
  select sheet_id from public.bbo_sections where id = p_section;
$$;

create or replace function app.submission_student(p_submission uuid)
returns uuid language sql stable security definer set search_path = ''
as $$
  select student_id from public.submissions where id = p_submission;
$$;

-- Konten BBO: guru & admin boleh membaca semua lembar (untuk menyalin, GU-2);
-- orang tua hanya lembar terbit/ditutup milik kelas anaknya, mulai start_date.
create or replace function app.can_read_sheet(p_sheet uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select app.is_teacher()
    or exists (
      select 1
      from public.bbo_sheets sh
      join public.students s on s.class_id = sh.class_id
      join public.guardians g on g.student_id = s.id
      where sh.id = p_sheet
        and g.profile_id = (select auth.uid())
        and sh.status in ('published', 'closed')
        and sh.start_date <= (now() at time zone 'Asia/Jakarta')::date
    );
$$;

-- Konten BBO hanya diubah guru Iman kelas itu (guru Qur'an tidak mengubah bagian Iman) atau admin.
create or replace function app.can_edit_sheet(p_sheet uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select app.is_admin() or app.is_teacher_of_class(app.sheet_class(p_sheet), 'iman');
$$;

create or replace function app.can_read_submission(p_submission uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.submissions sub
    where sub.id = p_submission
      and (app.is_guardian_of(sub.student_id)
           or app.is_teacher_of_student(sub.student_id)
           or app.is_admin())
  );
$$;

-- Orang tua hanya bisa mengubah isian selama belum dikirim (dan tentu belum ditanggapi).
create or replace function app.parent_can_edit_submission(p_submission uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.submissions sub
    where sub.id = p_submission
      and sub.status in ('not_started', 'in_progress')
      and app.is_guardian_of(sub.student_id)
  );
$$;

create or replace function app.try_uuid(p text)
returns uuid language plpgsql immutable set search_path = ''
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

grant execute on all functions in schema app to authenticated;

-- ---------------------------------------------------------------------------
-- Hak dasar: anon tidak punya akses ke tabel mana pun.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- Aktifkan RLS di semua tabel
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "profil sendiri, guru, atau admin" on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or app.is_admin()
    -- guru melihat profil orang tua santri yang diajarnya
    or exists (
      select 1 from public.guardians g
      where g.profile_id = profiles.id and app.is_teacher_of_student(g.student_id)
    )
    -- sesama guru saling melihat
    or (app.is_teacher() and role in ('teacher', 'admin'))
  );

create policy "ubah profil sendiri" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or app.is_admin())
  with check (id = (select auth.uid()) or app.is_admin());

revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name, phone, role) on public.profiles to authenticated;

-- Hanya admin yang boleh mengganti role.
create or replace function app.protect_profile_role()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and current_user in ('authenticated', 'anon')
     and not app.is_admin() then
    raise exception 'Hanya admin yang boleh mengubah peran pengguna';
  end if;
  return new;
end;
$$;
create trigger protect_profile_role before update on public.profiles
  for each row execute function app.protect_profile_role();

-- ---------------------------------------------------------------------------
-- Master akademik: dibaca semua yang login, ditulis admin
-- ---------------------------------------------------------------------------
create policy "baca tahun ajaran" on public.academic_years for select to authenticated using (true);
create policy "admin kelola tahun ajaran" on public.academic_years for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

create policy "baca kelas" on public.classes for select to authenticated using (true);
create policy "admin kelola kelas" on public.classes for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

create policy "baca penugasan guru" on public.class_teachers for select to authenticated
  using (app.is_teacher() or exists (
    select 1 from public.students s join public.guardians g on g.student_id = s.id
    where s.class_id = class_teachers.class_id and g.profile_id = (select auth.uid())
  ));
create policy "admin kelola penugasan guru" on public.class_teachers for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

-- ---------------------------------------------------------------------------
-- students, guardians, invites
-- ---------------------------------------------------------------------------
create policy "baca santri" on public.students for select to authenticated
  using (app.is_guardian_of(id) or app.is_teacher_of_student(id) or app.is_admin());
create policy "admin kelola santri" on public.students for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

create policy "baca wali" on public.guardians for select to authenticated
  using (profile_id = (select auth.uid()) or app.is_teacher_of_student(student_id) or app.is_admin());
create policy "admin kelola wali" on public.guardians for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

create policy "admin kelola undangan" on public.invites for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

-- ---------------------------------------------------------------------------
-- Konten BBO
-- ---------------------------------------------------------------------------
create policy "baca lembar" on public.bbo_sheets for select to authenticated
  using (app.can_read_sheet(id));
create policy "buat lembar" on public.bbo_sheets for insert to authenticated
  with check (app.is_admin() or app.is_teacher_of_class(class_id, 'iman'));
create policy "ubah lembar" on public.bbo_sheets for update to authenticated
  using (app.can_edit_sheet(id))
  with check (app.is_admin() or app.is_teacher_of_class(class_id, 'iman'));
create policy "hapus draf lembar" on public.bbo_sheets for delete to authenticated
  using (app.can_edit_sheet(id) and status = 'draft');

create policy "baca bagian" on public.bbo_sections for select to authenticated
  using (app.can_read_sheet(sheet_id));
create policy "kelola bagian" on public.bbo_sections for all to authenticated
  using (app.can_edit_sheet(sheet_id)) with check (app.can_edit_sheet(sheet_id));

create policy "baca kartu" on public.bbo_cards for select to authenticated
  using (app.can_read_sheet(app.section_sheet(section_id)));
create policy "kelola kartu" on public.bbo_cards for all to authenticated
  using (app.can_edit_sheet(app.section_sheet(section_id)))
  with check (app.can_edit_sheet(app.section_sheet(section_id)));

create policy "baca murafaqat" on public.murafaqat_items for select to authenticated
  using (app.can_read_sheet(sheet_id));
create policy "kelola murafaqat" on public.murafaqat_items for all to authenticated
  using (app.can_edit_sheet(sheet_id)) with check (app.can_edit_sheet(sheet_id));

create policy "baca amanah" on public.amanah_items for select to authenticated
  using (app.can_read_sheet(sheet_id));
create policy "kelola amanah" on public.amanah_items for all to authenticated
  using (app.can_edit_sheet(sheet_id)) with check (app.can_edit_sheet(sheet_id));

create policy "baca target quran" on public.quran_targets for select to authenticated
  using (
    app.can_read_sheet(sheet_id)
    and (student_id is null or app.is_guardian_of(student_id) or app.is_teacher())
  );
create policy "guru quran kelola target" on public.quran_targets for all to authenticated
  using (app.is_admin() or app.is_teacher_of_class(app.sheet_class(sheet_id), 'quran'))
  with check (app.is_admin() or app.is_teacher_of_class(app.sheet_class(sheet_id), 'quran'));

-- ---------------------------------------------------------------------------
-- submissions
-- ---------------------------------------------------------------------------
create policy "baca laporan" on public.submissions for select to authenticated
  using (app.is_guardian_of(student_id) or app.is_teacher_of_student(student_id) or app.is_admin());

create policy "orang tua mulai laporan" on public.submissions for insert to authenticated
  with check (
    app.is_guardian_of(student_id)
    and app.can_read_sheet(sheet_id)
    and status in ('not_started', 'in_progress')
  );

-- Orang tua boleh mengubah (termasuk "Buka kembali" submitted -> in_progress)
-- selama laporan belum ditanggapi.
create policy "orang tua ubah laporan" on public.submissions for update to authenticated
  using (app.is_guardian_of(student_id) and status <> 'reviewed')
  with check (app.is_guardian_of(student_id) and status <> 'reviewed');

create policy "guru tandai ditanggapi" on public.submissions for update to authenticated
  using (app.is_teacher_of_student(student_id) or app.is_admin())
  with check (app.is_teacher_of_student(student_id) or app.is_admin());

create policy "admin hapus laporan" on public.submissions for delete to authenticated
  using (app.is_admin());

revoke update on public.submissions from authenticated;
grant update (status, last_card_id, started_at, submitted_at, reviewed_at) on public.submissions to authenticated;

-- reviewed_at hanya boleh diisi guru/admin.
create or replace function app.protect_submission()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
     and not (app.is_teacher_of_student(old.student_id) or app.is_admin()) then
    new.reviewed_at := old.reviewed_at;
  end if;
  return new;
end;
$$;
create trigger protect_submission before update on public.submissions
  for each row execute function app.protect_submission();

-- ---------------------------------------------------------------------------
-- Isian orang tua per laporan: baca = orang tua/guru/admin; tulis = orang tua
-- selama belum dikirim. Guru tidak bisa mengubah jawaban orang tua.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['card_responses','adab_logs','quran_reports','amanah_checks','media','parent_notes'] loop
    execute format($f$
      create policy "baca %1$s" on public.%1$I for select to authenticated
        using (app.can_read_submission(submission_id));
      create policy "orang tua tambah %1$s" on public.%1$I for insert to authenticated
        with check (app.parent_can_edit_submission(submission_id));
      create policy "orang tua ubah %1$s" on public.%1$I for update to authenticated
        using (app.parent_can_edit_submission(submission_id))
        with check (app.parent_can_edit_submission(submission_id));
      create policy "orang tua hapus %1$s" on public.%1$I for delete to authenticated
        using (app.parent_can_edit_submission(submission_id));
    $f$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- signatures: Ayah/Ibu oleh orang tua; guru_iman/guru_quran oleh guru mapel itu.
-- ---------------------------------------------------------------------------
create policy "baca tanda tangan" on public.signatures for select to authenticated
  using (app.can_read_submission(submission_id));

create policy "tanda tangan orang tua" on public.signatures for insert to authenticated
  with check (
    signer_id = (select auth.uid())
    and role in ('ayah', 'ibu')
    and app.parent_can_edit_submission(submission_id)
  );
create policy "ganti tanda tangan orang tua" on public.signatures for update to authenticated
  using (signer_id = (select auth.uid()) and role in ('ayah', 'ibu') and app.parent_can_edit_submission(submission_id))
  with check (signer_id = (select auth.uid()) and role in ('ayah', 'ibu') and app.parent_can_edit_submission(submission_id));
create policy "hapus tanda tangan orang tua" on public.signatures for delete to authenticated
  using (signer_id = (select auth.uid()) and role in ('ayah', 'ibu') and app.parent_can_edit_submission(submission_id));

create policy "paraf guru" on public.signatures for insert to authenticated
  with check (
    signer_id = (select auth.uid())
    and (
      (role = 'guru_iman' and app.is_teacher_of_student(app.submission_student(submission_id), 'iman'))
      or (role = 'guru_quran' and app.is_teacher_of_student(app.submission_student(submission_id), 'quran'))
    )
  );
create policy "ganti paraf guru" on public.signatures for update to authenticated
  using (signer_id = (select auth.uid()) and role in ('guru_iman', 'guru_quran'))
  with check (
    signer_id = (select auth.uid())
    and (
      (role = 'guru_iman' and app.is_teacher_of_student(app.submission_student(submission_id), 'iman'))
      or (role = 'guru_quran' and app.is_teacher_of_student(app.submission_student(submission_id), 'quran'))
    )
  );

-- ---------------------------------------------------------------------------
-- teacher_feedback: hanya guru mapel itu di kelas santri tsb.
-- ---------------------------------------------------------------------------
create policy "baca tanggapan" on public.teacher_feedback for select to authenticated
  using (app.can_read_submission(submission_id));
create policy "guru tulis tanggapan" on public.teacher_feedback for insert to authenticated
  with check (
    teacher_id = (select auth.uid())
    and app.is_teacher_of_student(app.submission_student(submission_id), subject)
  );
create policy "guru ubah tanggapan" on public.teacher_feedback for update to authenticated
  using (teacher_id = (select auth.uid()))
  with check (
    teacher_id = (select auth.uid())
    and app.is_teacher_of_student(app.submission_student(submission_id), subject)
  );
create policy "guru hapus tanggapan" on public.teacher_feedback for delete to authenticated
  using (teacher_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- reading_logs (lintas pekan, per santri)
-- ---------------------------------------------------------------------------
create policy "baca log baca" on public.reading_logs for select to authenticated
  using (app.is_guardian_of(student_id) or app.is_teacher_of_student(student_id) or app.is_admin());
create policy "orang tua tambah log baca" on public.reading_logs for insert to authenticated
  with check (app.is_guardian_of(student_id) and logged_by = (select auth.uid()));
create policy "orang tua ubah log baca" on public.reading_logs for update to authenticated
  using (app.is_guardian_of(student_id)) with check (app.is_guardian_of(student_id));
create policy "orang tua hapus log baca" on public.reading_logs for delete to authenticated
  using (app.is_guardian_of(student_id));

-- ---------------------------------------------------------------------------
-- event_log (metrik tesis): tiap pengguna mencatat kejadiannya sendiri.
-- ---------------------------------------------------------------------------
create policy "catat kejadian sendiri" on public.event_log for insert to authenticated
  with check (
    actor_id = (select auth.uid())
    and (submission_id is null or app.can_read_submission(submission_id))
  );
create policy "baca kejadian" on public.event_log for select to authenticated
  using (actor_id = (select auth.uid()) or app.is_admin());
revoke update, delete on public.event_log from authenticated;
