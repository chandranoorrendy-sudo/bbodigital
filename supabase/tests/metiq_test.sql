-- Uji integrasi Metiq -> BBO (laporan PR matematika).
-- Jalankan di SQL Editor Supabase (atau lewat MCP execute_sql). Semua perubahan di-rollback,
-- termasuk rahasia uji. Setiap baris hasil harus berstatus LULUS.

begin;

create temp table hasil (uji text, status text) on commit drop;
grant all on hasil to authenticated, anon;

create or replace function pg_temp.sebagai(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', p_user, 'role', 'authenticated')::text, true),
         set_config('role', 'authenticated', true);
$$;

create or replace function pg_temp.laporan(p_id text, p_nisn text, p_note text) returns jsonb language sql as $$
  select jsonb_build_object(
    'id', p_id, 'source', 'metiq', 'nisn', p_nisn, 'student_name', 'Zaid', 'class_name', 'Kelas 2B',
    'teacher_name', 'Bu Diana',
    'assignment', jsonb_build_object('note', p_note, 'due', '2026-11-05', 'created_at', '2026-10-28T01:00:00Z', 'targeted', false),
    'completed_at', '2026-10-28T03:00:00Z', 'done_by', 'siswa',
    'skills', jsonb_build_array(jsonb_build_object('id', 'K1', 'code', 'K.1', 'name', 'Membaca jam (tepat)',
                                                   'grade', 1, 'score', 85, 'attempts', 14, 'correct', 12)),
    'link', 'https://metiq-math.vercel.app/');
$$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- Rahasia uji (menimpa yang asli hanya di dalam transaksi ini).
insert into public.integration_secrets (name, secret_hash)
values ('metiq', encode(sha256(convert_to('rahasia-uji', 'UTF8')), 'hex'))
on conflict (name) do update set secret_hash = excluded.secret_hash;

-- Zaid (KA2B, rekaan) diberi NISN uji; satu NISN lain sengaja belum terdaftar.
update public.students set nisn = '9990000003' where id = '30000000-0000-4000-8000-000000000003';
-- Ustadz Hamzah dilepas dari KA2B supaya ada guru yang bukan guru Zaid.
delete from public.class_teachers
where teacher_id = 'a0000000-0000-4000-8000-000000000003'
  and class_id = (select class_id from public.students where id = '30000000-0000-4000-8000-000000000003');

-- ===== Panggilan dari Metiq (anon, seperti REST dengan publishable key) =====
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
begin
  perform public.metiq_ingest('rahasia-salah', pg_temp.laporan('uji-1:zaid', '9990000003', 'Latihan jam'));
  insert into hasil values ('Rahasia salah ditolak', 'GAGAL');
exception when sqlstate '28000' then
  insert into hasil values ('Rahasia salah ditolak', 'LULUS');
end $$;

do $$
begin
  perform public.metiq_ingest(null, pg_temp.laporan('uji-1:zaid', '9990000003', 'Latihan jam'));
  insert into hasil values ('Rahasia kosong ditolak', 'GAGAL');
exception when sqlstate '28000' then
  insert into hasil values ('Rahasia kosong ditolak', 'LULUS');
end $$;

insert into hasil select 'Rahasia benar diterima & cocok dengan Zaid',
  case when public.metiq_ingest('rahasia-uji', pg_temp.laporan('uji-1:zaid', '9990000003', 'Latihan jam'))
            = '{"ok": true, "matched": true}'::jsonb then 'LULUS' else 'GAGAL' end;

insert into hasil select 'Kiriman ulang tetap diterima (idempoten)',
  case when public.metiq_ingest('rahasia-uji', pg_temp.laporan('uji-1:zaid', '9990000003', 'Latihan jam (revisi)'))
            = '{"ok": true, "matched": true}'::jsonb then 'LULUS' else 'GAGAL' end;

insert into hasil select 'NISN belum terdaftar tetap disimpan (matched=false)',
  case when public.metiq_ingest('rahasia-uji', pg_temp.laporan('uji-2:x', '9990000099', 'Latihan penjumlahan'))
            = '{"ok": true, "matched": false}'::jsonb then 'LULUS' else 'GAGAL' end;

do $$
begin
  perform public.metiq_ingest('rahasia-uji', pg_temp.laporan('uji-3:x', '12345', 'NISN pendek'));
  insert into hasil values ('NISN bukan 10 digit ditolak', 'GAGAL');
exception when sqlstate '22023' then
  insert into hasil values ('NISN bukan 10 digit ditolak', 'LULUS');
end $$;

do $$
begin
  perform 1 from public.metiq_reports limit 1;
  insert into hasil values ('anon tidak bisa membaca metiq_reports', 'GAGAL');
exception when insufficient_privilege then
  insert into hasil values ('anon tidak bisa membaca metiq_reports', 'LULUS');
end $$;

do $$
begin
  perform 1 from public.integration_secrets limit 1;
  insert into hasil values ('anon tidak bisa membaca integration_secrets', 'GAGAL');
exception when insufficient_privilege then
  insert into hasil values ('anon tidak bisa membaca integration_secrets', 'LULUS');
end $$;

reset role;
insert into hasil select 'Idempoten: satu baris per id, isi terbaru',
  case when (select count(*) from public.metiq_reports where metiq_id = 'uji-1:zaid') = 1
        and (select report #>> '{assignment,note}' from public.metiq_reports where metiq_id = 'uji-1:zaid') = 'Latihan jam (revisi)'
       then 'LULUS' else 'GAGAL' end;

-- ===== Orang tua Zaid =====
select pg_temp.sebagai('a0000000-0000-4000-8000-00000000000b');
insert into hasil select 'Orang tua Zaid melihat laporan Zaid saja',
  case when (select count(*) from public.metiq_reports where metiq_id like 'uji-%') = 1
        and exists (select 1 from public.metiq_reports where metiq_id = 'uji-1:zaid') then 'LULUS' else 'GAGAL' end;
do $$
begin
  insert into public.metiq_reports (metiq_id, nisn, report) values ('palsu', '9990000003', '{}');
  insert into hasil values ('Orang tua tidak bisa menulis langsung', 'GAGAL');
exception when insufficient_privilege then
  insert into hasil values ('Orang tua tidak bisa menulis langsung', 'LULUS');
end $$;
do $$
begin
  perform 1 from public.integration_secrets limit 1;
  insert into hasil values ('Pengguna login tidak bisa membaca integration_secrets', 'GAGAL');
exception when insufficient_privilege then
  insert into hasil values ('Pengguna login tidak bisa membaca integration_secrets', 'LULUS');
end $$;

-- ===== Orang tua lain (Hafsah & Umar) =====
reset role;
select pg_temp.sebagai('dd814f45-4dcc-466d-8170-3551a9318dd0');
insert into hasil select 'Orang tua lain tidak melihat laporan Zaid',
  case when not exists (select 1 from public.metiq_reports where metiq_id like 'uji-%') then 'LULUS' else 'GAGAL' end;

-- ===== Guru Zaid (Ustadzah Rahma) =====
reset role;
select pg_temp.sebagai('a0000000-0000-4000-8000-000000000002');
insert into hasil select 'Guru kelas Zaid melihat laporannya, bukan yang belum cocok',
  case when (select count(*) from public.metiq_reports where metiq_id like 'uji-%') = 1
        and exists (select 1 from public.metiq_reports where metiq_id = 'uji-1:zaid') then 'LULUS' else 'GAGAL' end;
do $$
begin
  update public.metiq_reports set nisn = '0000000000';
  insert into hasil values ('Guru tidak bisa mengubah laporan', 'GAGAL');
exception when insufficient_privilege then
  insert into hasil values ('Guru tidak bisa mengubah laporan', 'LULUS');
end $$;

-- ===== Guru bukan kelas Zaid (Ustadz Hamzah, dilepas dari KA2B) =====
reset role;
select pg_temp.sebagai('a0000000-0000-4000-8000-000000000003');
insert into hasil select 'Guru kelas lain tidak melihat laporan Zaid',
  case when not exists (select 1 from public.metiq_reports where metiq_id like 'uji-%') then 'LULUS' else 'GAGAL' end;

-- ===== Admin: melihat yang belum cocok, lalu mengisi NISN -> tertaut otomatis =====
reset role;
select pg_temp.sebagai('a0000000-0000-4000-8000-000000000001');
insert into hasil select 'Admin melihat laporan yang belum cocok',
  case when exists (select 1 from public.metiq_reports where metiq_id = 'uji-2:x' and student_id is null) then 'LULUS' else 'GAGAL' end;
update public.students set nisn = '9990000099' where id = '30000000-0000-4000-8000-000000000004';
insert into hasil select 'Mengisi NISN menautkan laporan lama (Maryam)',
  case when (select student_id from public.metiq_reports where metiq_id = 'uji-2:x') = '30000000-0000-4000-8000-000000000004'
       then 'LULUS' else 'GAGAL' end;
update public.students set nisn = null where id = '30000000-0000-4000-8000-000000000004';
insert into hasil select 'Menghapus NISN melepas tautan',
  case when (select student_id from public.metiq_reports where metiq_id = 'uji-2:x') is null then 'LULUS' else 'GAGAL' end;
do $$
begin
  update public.students set nisn = '123' where id = '30000000-0000-4000-8000-000000000004';
  insert into hasil values ('NISN santri harus 10 digit', 'GAGAL');
exception when check_violation then
  insert into hasil values ('NISN santri harus 10 digit', 'LULUS');
end $$;
do $$
begin
  update public.students set nisn = '9990000003' where id = '30000000-0000-4000-8000-000000000004';
  insert into hasil values ('NISN tidak boleh dipakai dua santri', 'GAGAL');
exception when unique_violation then
  insert into hasil values ('NISN tidak boleh dipakai dua santri', 'LULUS');
end $$;

reset role;
select * from hasil;

rollback;
