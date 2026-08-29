alter table public.profiles
  add column display_name text;

create function public.extract_display_name(metadata jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(trim(coalesce(
    metadata ->> 'full_name',
    metadata ->> 'name',
    metadata -> 'custom_claims' ->> 'global_name',
    metadata ->> 'preferred_username',
    metadata ->> 'user_name'
  )), '')
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, public.extract_display_name(new.raw_user_meta_data))
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.handle_user_updated()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.profiles
  set display_name = public.extract_display_name(new.raw_user_meta_data)
  where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_updated
  after update of raw_user_meta_data on auth.users
  for each row execute procedure public.handle_user_updated();

update public.profiles p
set display_name = public.extract_display_name(u.raw_user_meta_data)
from auth.users u
where u.id = p.id;
