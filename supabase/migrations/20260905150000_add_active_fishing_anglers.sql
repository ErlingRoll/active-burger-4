create function public.get_active_fishing_anglers()
returns table (
  attempt_id text,
  player_id uuid,
  player_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    attempts.id as attempt_id,
    attempts.profile_id as player_id,
    coalesce(nullif(trim(profiles.display_name), ''), 'Anonymous fisher') as player_name
  from public.fishing_attempts as attempts
  join public.profiles as profiles on profiles.id = attempts.profile_id
  where (select auth.uid()) is not null
    and attempts.status = 'pending'
    and attempts.pity_at > now()
  order by attempts.resolve_at asc, attempts.id asc;
$$;

revoke execute on function public.get_active_fishing_anglers() from public;
grant execute on function public.get_active_fishing_anglers() to authenticated;
