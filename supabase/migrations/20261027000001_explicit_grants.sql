-- Hak akses tabel secara eksplisit. Project Supabase baru tidak lagi otomatis
-- memberi SELECT/INSERT/UPDATE/DELETE ke authenticated & service_role, jadi
-- jangan bergantung pada default. Keamanan baris tetap diatur RLS (migrasi rls).
-- Aman dijalankan ulang.

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;

-- anon tidak boleh menyentuh tabel apa pun.
revoke all on all tables in schema public from anon;

-- Batasan kolom yang sama seperti di migrasi rls.
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name, phone, role) on public.profiles to authenticated;

revoke update on public.submissions from authenticated;
grant update (status, last_card_id, started_at, submitted_at, reviewed_at) on public.submissions to authenticated;

revoke update, delete on public.event_log from authenticated;

-- Fungsi
grant usage on schema app to authenticated;
grant execute on all functions in schema app to authenticated;
grant execute on function public.claim_invite(text) to authenticated;
grant execute on function public.get_class_teachers(uuid) to authenticated;
grant execute on function public.copy_bbo_sheet(uuid, uuid, int) to authenticated;
