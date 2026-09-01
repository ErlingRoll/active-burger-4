create table public.nickname_change_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  requested_nickname text not null check (
    requested_nickname ~ '^[A-Za-z0-9][A-Za-z0-9 _-]{1,22}[A-Za-z0-9]$'
  ),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null) or
    (status in ('approved', 'rejected') and reviewed_at is not null and reviewed_by is not null)
  )
);

create unique index nickname_change_requests_one_pending_per_user_idx
  on public.nickname_change_requests (user_id)
  where status = 'pending';

alter table public.nickname_change_requests enable row level security;

create policy "Nickname requests are readable by their owner"
on public.nickname_change_requests
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Nickname requests are readable by administrators"
on public.nickname_change_requests
for select
to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy "Profiles are updateable by their owner" on public.profiles;
revoke update on table public.profiles from authenticated;

-- Do not publish unmoderated identity-provider metadata.
update public.profiles
set display_name = null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
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
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.request_nickname_change(requested_nickname text)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in before requesting a nickname change.';
  end if;

  if requested_nickname !~ '^[A-Za-z0-9][A-Za-z0-9 _-]{1,22}[A-Za-z0-9]$' then
    raise exception 'Nickname must use 3-24 letters, numbers, spaces, hyphens, or underscores.';
  end if;

  delete from public.nickname_change_requests
  where user_id = auth.uid()
    and status = 'pending';

  insert into public.nickname_change_requests (user_id, requested_nickname)
  values (auth.uid(), requested_nickname);
end;
$$;

create or replace function public.review_nickname_change(
  nickname_request_id bigint,
  approve boolean
)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  request_row public.nickname_change_requests%rowtype;
begin
  if (select auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'admin' then
    raise exception 'Administrator access is required.';
  end if;

  select *
  into request_row
  from public.nickname_change_requests
  where id = nickname_request_id
    and status = 'pending'
  for update;

  if not found then
    raise exception 'Nickname request is no longer pending.';
  end if;

  update public.nickname_change_requests
  set status = case when approve then 'approved' else 'rejected' end,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = request_row.id;

  if approve then
    update public.profiles
    set display_name = request_row.requested_nickname
    where id = request_row.user_id;
  end if;
end;
$$;

revoke all on table public.nickname_change_requests from authenticated;
grant select on table public.nickname_change_requests to authenticated;
grant execute on function public.request_nickname_change(text) to authenticated;
grant execute on function public.review_nickname_change(bigint, boolean) to authenticated;
