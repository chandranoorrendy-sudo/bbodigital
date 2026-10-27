-- Admin membuat akun username + kata sandi dan mengatur ulang kata sandi (AD-2, pengganti undangan email).
-- Fungsi security definer agar tidak perlu service_role key di frontend; hanya admin yang boleh memanggil.

create or replace function public.admin_create_account(
  p_username text,
  p_full_name text,
  p_role public.user_role,
  p_password text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_username text := lower(trim(p_username));
  v_email text;
  v_id uuid := gen_random_uuid();
begin
  if not app.is_admin() then
    raise exception 'Hanya admin yang boleh membuat akun';
  end if;
  if v_username !~ '^[a-z0-9][a-z0-9._]{2,29}$' then
    raise exception 'Username hanya boleh huruf kecil, angka, titik, garis bawah (3–30 karakter)';
  end if;
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'Kata sandi minimal 6 karakter';
  end if;
  v_email := v_username || '@bbo-kuttab.invalid';
  if exists (select 1 from auth.users where email = v_email)
     or exists (select 1 from public.profiles where lower(username) = v_username) then
    raise exception 'Username % sudah dipakai', v_username;
  end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
          extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}',
          jsonb_build_object('full_name', trim(p_full_name), 'username', v_username),
          now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
          jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
          'email', null, now(), now());

  -- Profil dibuat trigger handle_new_user; tetapkan peran.
  update public.profiles set role = p_role, full_name = trim(p_full_name), username = v_username where id = v_id;
  return v_id;
end;
$$;

create or replace function public.admin_reset_password(p_user uuid, p_password text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not app.is_admin() then
    raise exception 'Hanya admin yang boleh mengatur ulang kata sandi';
  end if;
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'Kata sandi minimal 6 karakter';
  end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now()
  where id = p_user and email like '%@bbo-kuttab.invalid';
  if not found then
    raise exception 'Akun tidak ditemukan';
  end if;
end;
$$;

revoke execute on function public.admin_create_account(text, text, public.user_role, text) from public, anon;
revoke execute on function public.admin_reset_password(uuid, text) from public, anon;
grant execute on function public.admin_create_account(text, text, public.user_role, text) to authenticated;
grant execute on function public.admin_reset_password(uuid, text) to authenticated;
