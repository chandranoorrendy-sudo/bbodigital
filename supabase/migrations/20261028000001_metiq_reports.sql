-- Laporan PR matematika dari Metiq (https://metiq-math.vercel.app).
-- Metiq memanggil public.metiq_ingest lewat REST (apikey = publishable key BBO)
-- setiap kali santri menuntaskan tugas. Santri dicocokkan lewat NISN.
-- Laporan yang NISN-nya belum terdaftar tetap disimpan dan otomatis tertaut
-- begitu admin mengisi NISN santri tersebut.

-- ---------------------------------------------------------------------------
-- NISN santri (Nomor Induk Siswa Nasional, 10 digit)
-- ---------------------------------------------------------------------------
alter table public.students
  add column if not exists nisn text,
  add constraint students_nisn_format check (nisn ~ '^[0-9]{10}$'),
  add constraint students_nisn_key unique (nisn);

-- ---------------------------------------------------------------------------
-- Rahasia integrasi (hash sha256, hex). Tidak bisa dibaca lewat API.
-- ---------------------------------------------------------------------------
create table public.integration_secrets (
  name text primary key,
  secret_hash text not null check (secret_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_updated_at before update on public.integration_secrets
  for each row execute function public.set_updated_at();
alter table public.integration_secrets enable row level security;
revoke all on public.integration_secrets from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Laporan Metiq
-- ---------------------------------------------------------------------------
create table public.metiq_reports (
  id uuid primary key default gen_random_uuid(),
  metiq_id text not null unique,       -- "<assignmentId>:<studentId>" dari Metiq
  nisn text not null,
  student_id uuid references public.students (id) on delete set null,
  report jsonb not null,
  completed_at timestamptz,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index metiq_reports_student_idx on public.metiq_reports (student_id, completed_at desc);
create index metiq_reports_nisn_idx on public.metiq_reports (nisn);
create trigger set_updated_at before update on public.metiq_reports
  for each row execute function public.set_updated_at();

alter table public.metiq_reports enable row level security;
revoke all on public.metiq_reports from anon, authenticated;
grant select on public.metiq_reports to authenticated;

-- Guru kelas santri dan orang tuanya membaca; admin membaca semua (termasuk yang belum cocok).
create policy "baca laporan metiq" on public.metiq_reports for select to authenticated
  using (
    app.is_admin()
    or (student_id is not null and (app.is_guardian_of(student_id) or app.is_teacher_of_student(student_id)))
  );

-- Tautkan / lepas laporan saat NISN santri diisi atau diubah.
create or replace function app.link_metiq_reports()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.nisn is not null and old.nisn is distinct from new.nisn then
    update public.metiq_reports set student_id = null where student_id = new.id;
  end if;
  if new.nisn is not null then
    update public.metiq_reports set student_id = new.id where nisn = new.nisn and student_id is distinct from new.id;
  end if;
  return new;
end;
$$;
create trigger link_metiq_reports after insert or update of nisn on public.students
  for each row execute function app.link_metiq_reports();

-- ---------------------------------------------------------------------------
-- Endpoint masuk: POST /rest/v1/rpc/metiq_ingest {p_secret, p_report}
-- ---------------------------------------------------------------------------
create or replace function public.metiq_ingest(p_secret text, p_report jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_hash text;
  v_id text := p_report ->> 'id';
  v_nisn text := trim(p_report ->> 'nisn');
  v_student uuid;
  v_completed timestamptz;
begin
  select secret_hash into v_hash from public.integration_secrets where name = 'metiq';
  if v_hash is null or p_secret is null
     or v_hash <> encode(sha256(convert_to(p_secret, 'UTF8')), 'hex') then
    raise exception 'Rahasia Metiq tidak cocok' using errcode = '28000';
  end if;

  if jsonb_typeof(p_report) is distinct from 'object' or coalesce(v_id, '') = '' then
    raise exception 'Laporan Metiq tanpa id' using errcode = '22023';
  end if;
  if v_nisn is null or v_nisn !~ '^[0-9]{10}$' then
    raise exception 'NISN harus 10 digit' using errcode = '22023';
  end if;
  if pg_column_size(p_report) > 65536 then
    raise exception 'Laporan Metiq terlalu besar' using errcode = '22023';
  end if;

  begin
    v_completed := (p_report ->> 'completed_at')::timestamptz;
  exception when others then
    v_completed := null;
  end;

  select id into v_student from public.students where nisn = v_nisn;

  insert into public.metiq_reports (metiq_id, nisn, student_id, report, completed_at, received_at)
  values (v_id, v_nisn, v_student, p_report, v_completed, now())
  on conflict (metiq_id) do update
    set nisn = excluded.nisn,
        student_id = excluded.student_id,
        report = excluded.report,
        completed_at = excluded.completed_at,
        received_at = now();

  return jsonb_build_object('ok', true, 'matched', v_student is not null);
end;
$$;

revoke execute on function public.metiq_ingest(text, jsonb) from public;
grant execute on function public.metiq_ingest(text, jsonb) to anon, authenticated;
