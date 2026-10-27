-- Login dengan username + kata sandi yang diberikan guru (seperti IXL), tanpa email.
-- Supabase Auth tetap butuh alamat email, jadi setiap username dipetakan ke
-- <username>@bbo-kuttab.invalid (domain .invalid tidak pernah menerima surat, RFC 2606).

alter table public.profiles add column if not exists username text;
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9][a-z0-9._]{2,29}$');
create unique index if not exists profiles_username_key on public.profiles (lower(username));

-- Profil baru mengambil username dari metadata, atau dari bagian depan email internal.
create or replace function app.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case
      when new.raw_user_meta_data ? 'username' then lower(new.raw_user_meta_data ->> 'username')
      when new.email like '%@bbo-kuttab.invalid' then split_part(new.email, '@', 1)
    end
  )
  on conflict (id) do nothing;

  insert into public.guardians (profile_id, student_id, relation)
  select new.id, i.student_id, i.relation
  from public.invites i
  where lower(i.email) = lower(new.email) and i.used_at is null and i.expires_at > now()
  on conflict (profile_id, student_id) do nothing;

  update public.invites set used_at = now()
  where lower(email) = lower(new.email) and used_at is null and expires_at > now();

  return new;
end;
$$;
