-- Di fungsi security definer, current_user = pemilik fungsi. Pakai auth.uid():
-- ada isinya = permintaan dari pengguna aplikasi; kosong = SQL editor/seed.
create or replace function app.protect_profile_role()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not app.is_admin() then
    raise exception 'Hanya admin yang boleh mengubah peran pengguna';
  end if;
  return new;
end;
$$;

create or replace function app.protect_submission()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null
     and not (app.is_teacher_of_student(old.student_id) or app.is_admin()) then
    new.reviewed_at := old.reviewed_at;
  end if;
  return new;
end;
$$;
