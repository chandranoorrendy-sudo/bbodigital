-- Uji RLS Tahap 1: orang tua A tidak boleh melihat data santri orang tua B (dan sebaliknya).
-- Jalankan di SQL Editor Supabase (atau lewat MCP execute_sql). Semua perubahan di-rollback.
-- Setiap baris hasil harus berstatus LULUS.

begin;

create temp table hasil (uji text, status text) on commit drop;
grant all on hasil to authenticated, anon;

-- Helper: berpura-pura menjadi pengguna tertentu (seperti request PostgREST).
create or replace function pg_temp.sebagai(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', p_user, 'role', 'authenticated')::text, true),
         set_config('role', 'authenticated', true);
$$;

-- ===== Orang tua A (Bunda Hafsah & Umar) =====
select pg_temp.sebagai('a0000000-0000-4000-8000-00000000000a');

insert into hasil select 'A melihat tepat 2 santri (Hafsah, Umar)',
  case when (select count(*) from public.students) = 2
        and not exists (select 1 from public.students where nickname in ('Zaid','Maryam')) then 'LULUS' else 'GAGAL' end;
insert into hasil select 'A tidak melihat laporan Zaid',
  case when not exists (select 1 from public.submissions where student_id = '30000000-0000-4000-8000-000000000003') then 'LULUS' else 'GAGAL' end;
insert into hasil select 'A hanya melihat jawaban kartu milik Umar',
  case when (select count(*) from public.card_responses) = 2
        and not exists (select 1 from public.card_responses where submission_id = '50000000-0000-4000-8000-000000000002') then 'LULUS' else 'GAGAL' end;
insert into hasil select 'A tidak melihat catatan orang tua Zaid',
  case when (select count(*) from public.parent_notes) = 0 then 'LULUS' else 'GAGAL' end;
insert into hasil select 'A tidak melihat adab_logs Zaid',
  case when not exists (select 1 from public.adab_logs where submission_id = '50000000-0000-4000-8000-000000000002') then 'LULUS' else 'GAGAL' end;
insert into hasil select 'A tidak melihat log baca Zaid',
  case when not exists (select 1 from public.reading_logs where student_id = '30000000-0000-4000-8000-000000000003') then 'LULUS' else 'GAGAL' end;
insert into hasil select 'A tidak melihat wali/profil keluarga lain',
  case when (select count(*) from public.guardians) = 2 and (select count(*) from public.profiles) = 1 then 'LULUS' else 'GAGAL' end;
insert into hasil select 'A tidak bisa membaca undangan',
  case when (select count(*) from public.invites) = 0 then 'LULUS' else 'GAGAL' end;
insert into hasil select 'A melihat BBO terbit untuk kelas anaknya (KA2A + KA2B)',
  case when (select count(*) from public.bbo_sheets) = 4 then 'LULUS' else 'GAGAL' end;

-- A mencoba mengubah laporan Zaid -> 0 baris
with u as (update public.submissions set status = 'in_progress'
           where id = '50000000-0000-4000-8000-000000000002' returning 1)
insert into hasil select 'A tidak bisa mengubah laporan Zaid',
  case when (select count(*) from u) = 0 then 'LULUS' else 'GAGAL' end;

-- A mencoba menyisipkan jawaban ke laporan Zaid -> ditolak RLS
do $$
begin
  insert into public.card_responses (submission_id, card_id, result)
  select '50000000-0000-4000-8000-000000000002', id, 'bisa' from public.bbo_cards limit 1;
  insert into hasil values ('A tidak bisa menulis jawaban ke laporan Zaid', 'GAGAL');
exception when insufficient_privilege then
  insert into hasil values ('A tidak bisa menulis jawaban ke laporan Zaid', 'LULUS');
end $$;

-- A mencoba membuat laporan atas nama Zaid -> ditolak
do $$
begin
  insert into public.submissions (sheet_id, student_id) values
    ('40000000-0000-4000-8000-000000001201', '30000000-0000-4000-8000-000000000003');
  insert into hasil values ('A tidak bisa membuat laporan untuk Zaid', 'GAGAL');
exception when insufficient_privilege then
  insert into hasil values ('A tidak bisa membuat laporan untuk Zaid', 'LULUS');
end $$;

-- A mencoba menaikkan peran sendiri -> ditolak
do $$
begin
  update public.profiles set role = 'admin' where id = 'a0000000-0000-4000-8000-00000000000a';
  insert into hasil values ('A tidak bisa menjadikan dirinya admin', 'GAGAL');
exception when others then
  insert into hasil values ('A tidak bisa menjadikan dirinya admin', 'LULUS');
end $$;

-- A tetap bisa menulis ke laporan anaknya sendiri
do $$
begin
  insert into public.card_responses (submission_id, card_id, result)
  select '50000000-0000-4000-8000-000000000001', c.id, 'bisa'
  from public.bbo_cards c join public.bbo_sections s on s.id = c.section_id
  where s.sheet_id = '40000000-0000-4000-8000-000000001101' and s.position = 3 and c.position = 1;
  insert into hasil values ('A bisa menulis jawaban untuk Umar', 'LULUS');
exception when others then
  insert into hasil values ('A bisa menulis jawaban untuk Umar', 'GAGAL: ' || sqlerrm);
end $$;

-- ===== Orang tua B (Ayah Zaid) =====
reset role;
select pg_temp.sebagai('a0000000-0000-4000-8000-00000000000b');

insert into hasil select 'B melihat tepat 1 santri (Zaid)',
  case when (select count(*) from public.students) = 1
        and exists (select 1 from public.students where nickname = 'Zaid') then 'LULUS' else 'GAGAL' end;
insert into hasil select 'B tidak melihat laporan & jawaban Umar',
  case when not exists (select 1 from public.submissions where student_id = '30000000-0000-4000-8000-000000000002')
        and not exists (select 1 from public.card_responses where submission_id = '50000000-0000-4000-8000-000000000001')
       then 'LULUS' else 'GAGAL' end;
insert into hasil select 'B hanya melihat BBO kelas KA2B',
  case when (select count(*) from public.bbo_sheets) = 2
        and not exists (select 1 from public.bbo_sheets where class_id = '20000000-0000-4000-8000-00000000002a') then 'LULUS' else 'GAGAL' end;

-- Laporan Zaid sudah dikirim -> jawaban terkunci untuk B
do $$
begin
  update public.card_responses set result = 'bisa'
  where submission_id = '50000000-0000-4000-8000-000000000002';
  if found then
    insert into hasil values ('Jawaban terkunci setelah dikirim', 'GAGAL');
  else
    insert into hasil values ('Jawaban terkunci setelah dikirim', 'LULUS');
  end if;
end $$;

-- ===== Guru Iman: membaca laporan kelasnya, tidak bisa mengubah jawaban =====
reset role;
select pg_temp.sebagai('a0000000-0000-4000-8000-000000000002');

insert into hasil select 'Guru membaca laporan santri kelasnya',
  case when (select count(*) from public.submissions) = 2 then 'LULUS' else 'GAGAL' end;
with u as (update public.card_responses set result = 'bisa' returning 1)
insert into hasil select 'Guru tidak bisa mengubah jawaban orang tua',
  case when (select count(*) from u) = 0 then 'LULUS' else 'GAGAL' end;

-- Guru menanggapi Zaid -> status reviewed -> orang tua tidak bisa membuka kembali
insert into public.teacher_feedback (submission_id, subject, body)
values ('50000000-0000-4000-8000-000000000002', 'iman', 'Masya Allah, semangat Ayah.');
update public.submissions set status = 'reviewed', reviewed_at = now()
where id = '50000000-0000-4000-8000-000000000002';

reset role;
select pg_temp.sebagai('a0000000-0000-4000-8000-00000000000b');
with u as (update public.submissions set status = 'in_progress'
           where id = '50000000-0000-4000-8000-000000000002' returning 1)
insert into hasil select 'Laporan reviewed tidak bisa dibuka kembali orang tua',
  case when (select count(*) from u) = 0 then 'LULUS' else 'GAGAL' end;
insert into hasil select 'B melihat tanggapan guru',
  case when (select count(*) from public.teacher_feedback) = 1 then 'LULUS' else 'GAGAL' end;

-- ===== Tanpa login (anon) =====
reset role;
set local role anon;
do $$
begin
  perform 1 from public.students limit 1;
  insert into hasil values ('Pengunjung tanpa login tidak bisa membaca santri', 'GAGAL');
exception when insufficient_privilege then
  insert into hasil values ('Pengunjung tanpa login tidak bisa membaca santri', 'LULUS');
end $$;

reset role;
select * from hasil;

rollback;
