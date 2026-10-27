-- Formulir dari BBO format KA2A (PDF): foto tulisan murafaqat, Lembar Mutaba'ah Al-Qur'an,
-- Riaayah Adab, serta kisi-kisi ujian semester. Aman dijalankan ulang.

-- ---------------------------------------------------------------------------
-- Murafaqat: orang tua bisa memotret hasil kerja (mis. tulisan huruf di buku tulis)
-- ---------------------------------------------------------------------------
alter table public.murafaqat_items add column if not exists needs_photo boolean not null default false;
alter table public.murafaqat_items add column if not exists photo_prompt text;

-- ---------------------------------------------------------------------------
-- Lembar Mutaba'ah Al-Qur'an: per surat, orang tua mencentang jenis kesalahan
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.mutabaah_error as enum
    ('makharijul_huruf', 'shifatul_huruf', 'itmamul_harokat', 'mad', 'ghunnah', 'kelancaran');
exception when duplicate_object then null; end $$;

create table if not exists public.quran_mutabaah_items (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references public.bbo_sheets (id) on delete cascade,
  surah_no int not null check (surah_no between 1 and 114),
  ayah_from int check (ayah_from >= 1),
  ayah_to int check (ayah_to >= 1),
  position int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quran_mutabaah_items_sheet_idx on public.quran_mutabaah_items (sheet_id, position);

create table if not exists public.quran_mutabaah_checks (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  item_id uuid not null references public.quran_mutabaah_items (id) on delete cascade,
  errors public.mutabaah_error[] not null default '{}',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, item_id)
);
create index if not exists quran_mutabaah_checks_item_idx on public.quran_mutabaah_checks (item_id);

-- ---------------------------------------------------------------------------
-- Riaayah Adab: seberapa sering Ayah/Bunda membimbing adab di rumah
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.adab_frequency as enum ('selalu', 'sering', 'jarang', 'tidak_pernah');
exception when duplicate_object then null; end $$;

create table if not exists public.adab_items (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references public.bbo_sheets (id) on delete cascade,
  text text not null,
  position int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists adab_items_sheet_idx on public.adab_items (sheet_id, position);

create table if not exists public.adab_ratings (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  adab_item_id uuid not null references public.adab_items (id) on delete cascade,
  rating public.adab_frequency not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, adab_item_id)
);
create index if not exists adab_ratings_item_idx on public.adab_ratings (adab_item_id);

-- ---------------------------------------------------------------------------
-- Kisi-kisi ujian semester per kelas & mapel, dan centang "sudah dilatih" per santri
-- ---------------------------------------------------------------------------
create table if not exists public.kisi_kisi (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  title text not null default 'Kisi-kisi ujian semester',
  subject text not null,
  text text not null,
  position int not null,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists kisi_kisi_class_idx on public.kisi_kisi (class_id, title, subject, position);
create index if not exists kisi_kisi_created_by_idx on public.kisi_kisi (created_by);

create table if not exists public.kisi_checks (
  id uuid primary key default gen_random_uuid(),
  kisi_id uuid not null references public.kisi_kisi (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  checked_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kisi_id, student_id)
);
create index if not exists kisi_checks_student_idx on public.kisi_checks (student_id);
create index if not exists kisi_checks_checked_by_idx on public.kisi_checks (checked_by);

do $$
declare t text;
begin
  foreach t in array array['quran_mutabaah_items','quran_mutabaah_checks','adab_items','adab_ratings','kisi_kisi','kisi_checks'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- Bagian Qur'an & adab lembar boleh diisi guru Iman (mis. saat impor BBO utuh), guru Qur'an, atau admin.
create or replace function app.can_edit_sheet_quran(p_sheet uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select app.can_edit_sheet(p_sheet) or app.is_teacher_of_class(app.sheet_class(p_sheet), 'quran'); $$;
grant execute on function app.can_edit_sheet_quran(uuid) to authenticated;

drop policy if exists "guru quran kelola target" on public.quran_targets;
create policy "guru kelola target quran" on public.quran_targets for all to authenticated
  using (app.can_edit_sheet_quran(sheet_id)) with check (app.can_edit_sheet_quran(sheet_id));

drop policy if exists "baca mutabaah" on public.quran_mutabaah_items;
drop policy if exists "guru kelola mutabaah" on public.quran_mutabaah_items;
create policy "baca mutabaah" on public.quran_mutabaah_items for select to authenticated using (app.can_read_sheet(sheet_id));
create policy "guru kelola mutabaah" on public.quran_mutabaah_items for all to authenticated
  using (app.can_edit_sheet_quran(sheet_id)) with check (app.can_edit_sheet_quran(sheet_id));

drop policy if exists "baca adab lembar" on public.adab_items;
drop policy if exists "guru kelola adab lembar" on public.adab_items;
create policy "baca adab lembar" on public.adab_items for select to authenticated using (app.can_read_sheet(sheet_id));
create policy "guru kelola adab lembar" on public.adab_items for all to authenticated
  using (app.can_edit_sheet_quran(sheet_id)) with check (app.can_edit_sheet_quran(sheet_id));

-- Isian orang tua per laporan: pola yang sama dengan card_responses dkk.
do $$
declare t text;
begin
  foreach t in array array['quran_mutabaah_checks','adab_ratings'] loop
    execute format('drop policy if exists "baca %1$s" on public.%1$I', t);
    execute format('drop policy if exists "orang tua tambah %1$s" on public.%1$I', t);
    execute format('drop policy if exists "orang tua ubah %1$s" on public.%1$I', t);
    execute format('drop policy if exists "orang tua hapus %1$s" on public.%1$I', t);
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

drop policy if exists "baca kisi" on public.kisi_kisi;
drop policy if exists "guru kelola kisi" on public.kisi_kisi;
create policy "baca kisi" on public.kisi_kisi for select to authenticated
  using (
    app.is_teacher()
    or exists (
      select 1 from public.students s join public.guardians g on g.student_id = s.id
      where s.class_id = kisi_kisi.class_id and g.profile_id = (select auth.uid())
    )
  );
create policy "guru kelola kisi" on public.kisi_kisi for all to authenticated
  using (app.is_admin() or app.is_teacher_of_class(class_id))
  with check (app.is_admin() or app.is_teacher_of_class(class_id));

drop policy if exists "baca centang kisi" on public.kisi_checks;
drop policy if exists "orang tua centang kisi" on public.kisi_checks;
drop policy if exists "orang tua hapus centang kisi" on public.kisi_checks;
create policy "baca centang kisi" on public.kisi_checks for select to authenticated
  using (app.is_guardian_of(student_id) or app.is_teacher_of_student(student_id) or app.is_admin());
create policy "orang tua centang kisi" on public.kisi_checks for insert to authenticated
  with check (app.is_guardian_of(student_id));
create policy "orang tua hapus centang kisi" on public.kisi_checks for delete to authenticated
  using (app.is_guardian_of(student_id));

-- ---------------------------------------------------------------------------
-- Salin BBO ikut menyalin formulir baru
-- ---------------------------------------------------------------------------
create or replace function public.copy_bbo_sheet(p_sheet uuid, p_target_class uuid, p_sheet_no int default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_src public.bbo_sheets;
  v_new uuid;
  v_sec record;
  v_new_sec uuid;
begin
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

  insert into public.murafaqat_items (sheet_id, subject, learned, home_practice, position, needs_photo, photo_prompt)
  select v_new, subject, learned, home_practice, position, needs_photo, photo_prompt
  from public.murafaqat_items where sheet_id = p_sheet;

  insert into public.amanah_items (sheet_id, text, needs_photo, attachment_path, position)
  select v_new, text, needs_photo, attachment_path, position from public.amanah_items where sheet_id = p_sheet;

  insert into public.quran_targets (sheet_id, student_id, kind, description)
  select v_new, null, kind, description from public.quran_targets where sheet_id = p_sheet and student_id is null;

  insert into public.quran_mutabaah_items (sheet_id, surah_no, ayah_from, ayah_to, position)
  select v_new, surah_no, ayah_from, ayah_to, position from public.quran_mutabaah_items where sheet_id = p_sheet;

  insert into public.adab_items (sheet_id, text, position)
  select v_new, text, position from public.adab_items where sheet_id = p_sheet;

  return v_new;
end;
$$;
revoke execute on function public.copy_bbo_sheet(uuid, uuid, int) from public, anon;
grant execute on function public.copy_bbo_sheet(uuid, uuid, int) to authenticated;
