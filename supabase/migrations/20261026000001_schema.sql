-- BBO Digital Kuttab — skema (PRD bagian 7)
-- Semua tabel memakai id uuid, created_at, updated_at.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('parent', 'teacher', 'admin');
create type public.subject_kind as enum ('iman', 'quran');
create type public.guardian_relation as enum ('ayah', 'ibu', 'wali');
create type public.sheet_status as enum ('draft', 'published', 'closed');
create type public.section_kind as enum ('adab', 'iman', 'murafaqat', 'quran', 'amanah', 'catatan');
create type public.card_tier as enum ('inti', 'pengayaan', 'ortu');
create type public.card_dimension as enum ('iman', 'ilmu', 'amal');
create type public.murafaqat_subject as enum ('ipa', 'ips', 'berhitung', 'bahasa', 'literasi', 'siroh', 'fiqih');
create type public.quran_kind as enum ('tilawah', 'tahfidz', 'murajaah');
create type public.submission_status as enum ('not_started', 'in_progress', 'submitted', 'reviewed');
create type public.card_result as enum ('bisa', 'belum_dijelaskan', 'perlu_bantuan');
create type public.quran_fluency as enum ('lancar', 'terbata', 'ulang');
create type public.media_kind as enum ('photo', 'audio');
create type public.signer_role as enum ('ayah', 'ibu', 'guru_iman', 'guru_quran');

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Master
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role public.user_role not null default 'parent',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date > start_date)
);
create unique index academic_years_one_active on public.academic_years (is_active) where is_active;

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years (id) on delete restrict,
  level text not null,          -- KA1, KA2, ...
  section text not null,        -- A, B
  name text not null,           -- "Kuttab Awal 2B"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_year_id, level, section)
);

create table public.class_teachers (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  subject public.subject_kind not null,
  is_homeroom boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, teacher_id, subject)
);
create index class_teachers_teacher_idx on public.class_teachers (teacher_id);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  nickname text,
  class_id uuid references public.classes (id) on delete set null,
  birth_year int check (birth_year between 2000 and 2100),
  research_consent boolean not null default false,
  consent_signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index students_class_idx on public.students (class_id);

create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  relation public.guardian_relation not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, student_id)
);
create index guardians_student_idx on public.guardians (student_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  student_id uuid not null references public.students (id) on delete cascade,
  relation public.guardian_relation not null,
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  expires_at timestamptz not null default now() + interval '14 days',
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index invites_email_idx on public.invites (lower(email));
create index invites_student_idx on public.invites (student_id);

-- ---------------------------------------------------------------------------
-- Konten BBO (disusun guru, sama untuk satu kelas)
-- ---------------------------------------------------------------------------
create table public.bbo_sheets (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  sheet_no int not null,
  title text not null,
  start_date date not null,
  end_date date not null,
  hijri_range text,
  kbm_weeks text,
  theme text,
  subtheme text,
  core_topic text,
  opening_note text,
  status public.sheet_status not null default 'draft',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, sheet_no),
  check (end_date >= start_date)
);
create index bbo_sheets_created_by_idx on public.bbo_sheets (created_by);

create table public.bbo_sections (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references public.bbo_sheets (id) on delete cascade,
  kind public.section_kind not null,
  title text not null,
  position int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bbo_sections_sheet_idx on public.bbo_sections (sheet_id, position);

create table public.bbo_cards (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.bbo_sections (id) on delete cascade,
  position int not null,
  tier public.card_tier not null default 'inti',
  dimension public.card_dimension not null default 'ilmu',
  prompt text not null,
  expected_answer text,          -- bahasa anak
  parent_note text,              -- "Untuk Ayah Bunda", markdown
  ayah_arabic text,
  ayah_translation text,
  ayah_ref text,
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bbo_cards_section_idx on public.bbo_cards (section_id, position);

create table public.murafaqat_items (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references public.bbo_sheets (id) on delete cascade,
  subject public.murafaqat_subject not null,
  learned text not null,
  home_practice text,
  position int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index murafaqat_items_sheet_idx on public.murafaqat_items (sheet_id, position);

create table public.amanah_items (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references public.bbo_sheets (id) on delete cascade,
  text text not null,
  needs_photo boolean not null default false,
  attachment_path text,
  position int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index amanah_items_sheet_idx on public.amanah_items (sheet_id, position);

create table public.quran_targets (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references public.bbo_sheets (id) on delete cascade,
  student_id uuid references public.students (id) on delete cascade,  -- null = seluruh kelas
  kind public.quran_kind not null,
  description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quran_targets_sheet_idx on public.quran_targets (sheet_id);
create index quran_targets_student_idx on public.quran_targets (student_id);

-- ---------------------------------------------------------------------------
-- Laporan per santri
-- ---------------------------------------------------------------------------
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references public.bbo_sheets (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  status public.submission_status not null default 'not_started',
  last_card_id uuid references public.bbo_cards (id) on delete set null,
  started_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sheet_id, student_id)
);
create index submissions_student_idx on public.submissions (student_id);
create index submissions_last_card_idx on public.submissions (last_card_id);

create table public.card_responses (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  card_id uuid not null references public.bbo_cards (id) on delete cascade,
  result public.card_result not null,
  note text,
  answered_by uuid default auth.uid() references public.profiles (id) on delete set null,
  answered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, card_id)
);
create index card_responses_card_idx on public.card_responses (card_id);
create index card_responses_answered_by_idx on public.card_responses (answered_by);

create table public.adab_logs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  session_date date not null default (now() at time zone 'Asia/Jakarta')::date,
  niat boolean not null default false,
  wudhu boolean not null default false,
  pakaian boolean not null default false,
  duduk boolean not null default false,
  doa_awal boolean not null default false,
  doa_akhir boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, session_date)
);

create table public.quran_reports (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  kind public.quran_kind not null,
  surah_no int check (surah_no between 1 and 114),
  ayah_from int check (ayah_from >= 1),
  ayah_to int check (ayah_to >= 1),
  tilawah_book text,
  tilawah_page int,
  fluency public.quran_fluency,
  note text,
  audio_path text,
  duration_sec int check (duration_sec between 0 and 180),
  recorded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ayah_to is null or ayah_from is null or ayah_to >= ayah_from)
);
create index quran_reports_submission_idx on public.quran_reports (submission_id);

create table public.amanah_checks (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  amanah_item_id uuid not null references public.amanah_items (id) on delete cascade,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, amanah_item_id)
);
create index amanah_checks_item_idx on public.amanah_checks (amanah_item_id);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  kind public.media_kind not null,
  path text not null,
  bytes int,
  ref_table text,
  ref_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index media_submission_idx on public.media (submission_id);

create table public.reading_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  book text not null check (book in ('bacalah_1', 'bacalah_2', 'bacalah_3', 'lainnya')),
  book_title text,
  page int,
  read_on date not null default (now() at time zone 'Asia/Jakarta')::date,
  logged_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reading_logs_student_idx on public.reading_logs (student_id, read_on);
create index reading_logs_logged_by_idx on public.reading_logs (logged_by);

create table public.parent_notes (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.submissions (id) on delete cascade,
  obstacle text,   -- kendala
  action text,     -- tindakan / solusi / antisipasi
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.signatures (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  signer_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  role public.signer_role not null,
  image_path text not null,
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, role)
);
create index signatures_signer_idx on public.signatures (signer_id);

create table public.teacher_feedback (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  teacher_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  subject public.subject_kind not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index teacher_feedback_submission_idx on public.teacher_feedback (submission_id);
create index teacher_feedback_teacher_idx on public.teacher_feedback (teacher_id);

create table public.event_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid default auth.uid() references public.profiles (id) on delete set null,
  submission_id uuid references public.submissions (id) on delete cascade,
  event text not null,           -- open_card, answer, record, submit, ...
  meta jsonb not null default '{}'::jsonb,
  at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index event_log_actor_idx on public.event_log (actor_id, at);
create index event_log_submission_idx on public.event_log (submission_id, at);

-- updated_at triggers untuk semua tabel
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','academic_years','classes','class_teachers','students','guardians','invites',
    'bbo_sheets','bbo_sections','bbo_cards','murafaqat_items','amanah_items','quran_targets',
    'submissions','card_responses','adab_logs','quran_reports','amanah_checks','media',
    'reading_logs','parent_notes','signatures','teacher_feedback','event_log'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;
