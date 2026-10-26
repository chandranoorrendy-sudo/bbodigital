-- BBO Digital Kuttab — storage (bucket privat) dan fungsi RPC

-- ---------------------------------------------------------------------------
-- Storage
--   bbo-content : gambar kartu & lampiran lembar amanah. Path: {sheet_id}/...
--                 Dibaca semua yang login; ditulis guru Iman kelas itu / admin.
--   submissions : foto, audio, tanda tangan. Path: {student_id}/{submission_id}/...
--                 Dibaca orang tua santri itu & guru kelasnya (signed URL 1 jam
--                 dibuat di aplikasi).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('bbo-content', 'bbo-content', false, 20971520,
   array['image/jpeg','image/png','image/webp','application/pdf','audio/mpeg','audio/mp4','audio/webm','audio/ogg']),
  ('submissions', 'submissions', false, 10485760,
   array['image/jpeg','image/png','image/webp','audio/webm','audio/mp4','audio/ogg','audio/mpeg','audio/aac'])
on conflict (id) do nothing;

create policy "bbo-content: baca" on storage.objects for select to authenticated
  using (bucket_id = 'bbo-content');
create policy "bbo-content: guru iman tulis" on storage.objects for insert to authenticated
  with check (bucket_id = 'bbo-content'
              and app.can_edit_sheet(app.try_uuid((storage.foldername(name))[1])));
create policy "bbo-content: guru iman ubah" on storage.objects for update to authenticated
  using (bucket_id = 'bbo-content'
         and app.can_edit_sheet(app.try_uuid((storage.foldername(name))[1])));
create policy "bbo-content: guru iman hapus" on storage.objects for delete to authenticated
  using (bucket_id = 'bbo-content'
         and app.can_edit_sheet(app.try_uuid((storage.foldername(name))[1])));

create policy "submissions: baca" on storage.objects for select to authenticated
  using (
    bucket_id = 'submissions'
    and (app.is_guardian_of(app.try_uuid((storage.foldername(name))[1]))
         or app.is_teacher_of_student(app.try_uuid((storage.foldername(name))[1]))
         or app.is_admin())
  );

-- Orang tua mengunggah selama laporan belum dikirim; folder santri harus cocok
-- dengan santri pemilik laporan.
create policy "submissions: orang tua unggah" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'submissions'
    and app.parent_can_edit_submission(app.try_uuid((storage.foldername(name))[2]))
    and app.submission_student(app.try_uuid((storage.foldername(name))[2]))
        = app.try_uuid((storage.foldername(name))[1])
  );
create policy "submissions: orang tua ubah" on storage.objects for update to authenticated
  using (
    bucket_id = 'submissions'
    and app.parent_can_edit_submission(app.try_uuid((storage.foldername(name))[2]))
    and app.submission_student(app.try_uuid((storage.foldername(name))[2]))
        = app.try_uuid((storage.foldername(name))[1])
  );
create policy "submissions: orang tua hapus" on storage.objects for delete to authenticated
  using (
    bucket_id = 'submissions'
    and app.parent_can_edit_submission(app.try_uuid((storage.foldername(name))[2]))
    and app.submission_student(app.try_uuid((storage.foldername(name))[2]))
        = app.try_uuid((storage.foldername(name))[1])
  );

-- Paraf guru: {student_id}/{submission_id}/guru/...
create policy "submissions: paraf guru" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'submissions'
    and (storage.foldername(name))[3] = 'guru'
    and app.is_teacher_of_student(app.try_uuid((storage.foldername(name))[1]))
    and app.submission_student(app.try_uuid((storage.foldername(name))[2]))
        = app.try_uuid((storage.foldername(name))[1])
  );

-- ---------------------------------------------------------------------------
-- Pengguna baru: buat profil, lalu tautkan undangan yang cocok dengan emailnya
-- (OT-1: undangan admin menautkan akun ke santri).
-- ---------------------------------------------------------------------------
create or replace function app.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.guardians (profile_id, student_id, relation)
  select new.id, i.student_id, i.relation
  from public.invites i
  where lower(i.email) = lower(new.email)
    and i.used_at is null
    and i.expires_at > now()
  on conflict (profile_id, student_id) do nothing;

  update public.invites
  set used_at = now()
  where lower(email) = lower(new.email) and used_at is null and expires_at > now();

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- Link undangan sekali pakai untuk akun yang sudah ada.
create or replace function public.claim_invite(p_token text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_invite public.invites;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then
    raise exception 'Silakan masuk terlebih dahulu';
  end if;

  select * into v_invite from public.invites
  where token = p_token and used_at is null and expires_at > now()
  for update;

  if not found then
    raise exception 'Undangan tidak ditemukan atau sudah tidak berlaku';
  end if;
  if lower(v_invite.email) <> v_email then
    raise exception 'Undangan ini untuk email lain';
  end if;

  insert into public.guardians (profile_id, student_id, relation)
  values (auth.uid(), v_invite.student_id, v_invite.relation)
  on conflict (profile_id, student_id) do nothing;

  update public.invites set used_at = now() where id = v_invite.id;
  return v_invite.student_id;
end;
$$;

-- Nama guru kelas untuk header BBO (tanpa nomor HP).
create or replace function public.get_class_teachers(p_class uuid)
returns table (full_name text, subject public.subject_kind, is_homeroom boolean)
language sql stable security definer set search_path = ''
as $$
  select p.full_name, ct.subject, ct.is_homeroom
  from public.class_teachers ct
  join public.profiles p on p.id = ct.teacher_id
  where ct.class_id = p_class
    and (
      app.is_teacher()
      or exists (
        select 1 from public.students s join public.guardians g on g.student_id = s.id
        where s.class_id = p_class and g.profile_id = auth.uid()
      )
    )
  order by ct.subject, p.full_name;
$$;

-- GU-2: salin BBO ke kelas lain sebagai draf.
create or replace function public.copy_bbo_sheet(p_sheet uuid, p_target_class uuid, p_sheet_no int default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_src public.bbo_sheets;
  v_new uuid;
  v_sec record;
  v_new_sec uuid;
begin
  -- Pemanggilan dari aplikasi wajib guru Iman kelas tujuan atau admin.
  -- (Tanpa auth.uid() = dijalankan dari SQL editor / seed.)
  if auth.uid() is not null
     and not (app.is_admin() or app.is_teacher_of_class(p_target_class, 'iman')) then
    raise exception 'Anda bukan guru Iman di kelas tujuan';
  end if;

  select * into v_src from public.bbo_sheets where id = p_sheet;
  if not found then
    raise exception 'Lembar BBO sumber tidak ditemukan';
  end if;

  insert into public.bbo_sheets (class_id, sheet_no, title, start_date, end_date, hijri_range, kbm_weeks,
                                 theme, subtheme, core_topic, opening_note, status, created_by)
  values (p_target_class, coalesce(p_sheet_no, v_src.sheet_no), v_src.title, v_src.start_date, v_src.end_date,
          v_src.hijri_range, v_src.kbm_weeks, v_src.theme, v_src.subtheme, v_src.core_topic,
          v_src.opening_note, 'draft', coalesce(auth.uid(), v_src.created_by))
  returning id into v_new;

  for v_sec in select * from public.bbo_sections where sheet_id = p_sheet order by position loop
    insert into public.bbo_sections (sheet_id, kind, title, position)
    values (v_new, v_sec.kind, v_sec.title, v_sec.position)
    returning id into v_new_sec;

    insert into public.bbo_cards (section_id, position, tier, dimension, prompt, expected_answer, parent_note,
                                  ayah_arabic, ayah_translation, ayah_ref, image_path)
    select v_new_sec, position, tier, dimension, prompt, expected_answer, parent_note,
           ayah_arabic, ayah_translation, ayah_ref, image_path
    from public.bbo_cards where section_id = v_sec.id;
  end loop;

  insert into public.murafaqat_items (sheet_id, subject, learned, home_practice, position)
  select v_new, subject, learned, home_practice, position from public.murafaqat_items where sheet_id = p_sheet;

  insert into public.amanah_items (sheet_id, text, needs_photo, attachment_path, position)
  select v_new, text, needs_photo, attachment_path, position from public.amanah_items where sheet_id = p_sheet;

  insert into public.quran_targets (sheet_id, student_id, kind, description)
  select v_new, null, kind, description from public.quran_targets where sheet_id = p_sheet and student_id is null;

  return v_new;
end;
$$;

revoke execute on function public.claim_invite(text) from public, anon;
revoke execute on function public.get_class_teachers(uuid) from public, anon;
revoke execute on function public.copy_bbo_sheet(uuid, uuid, int) from public, anon;
grant execute on function public.claim_invite(text) to authenticated;
grant execute on function public.get_class_teachers(uuid) to authenticated;
grant execute on function public.copy_bbo_sheet(uuid, uuid, int) to authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
