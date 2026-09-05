-- Keep server-returned fishing names aligned with the client player-name helper:
-- approved nickname, identity-provider name, then the anonymous fallback.
create or replace function public.get_active_fishing_anglers()
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
    coalesce(
      nullif(trim(profiles.display_name), ''),
      nullif(trim(public.extract_display_name(users.raw_user_meta_data)), ''),
      'Anonymous player'
    ) as player_name
  from public.fishing_attempts as attempts
  join public.profiles as profiles on profiles.id = attempts.profile_id
  join auth.users as users on users.id = attempts.profile_id
  where (select auth.uid()) is not null
    and attempts.status = 'pending'
    and attempts.pity_at > now()
  order by attempts.resolve_at asc, attempts.id asc;
$$;

revoke execute on function public.get_active_fishing_anglers() from public;
grant execute on function public.get_active_fishing_anglers() to authenticated;

create or replace function public.get_player_display_names(p_player_ids text[])
returns table (
  player_id uuid,
  player_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profiles.id as player_id,
    coalesce(
      nullif(trim(profiles.display_name), ''),
      nullif(trim(public.extract_display_name(users.raw_user_meta_data)), ''),
      'Anonymous player'
    ) as player_name
  from public.profiles as profiles
  join auth.users as users on users.id = profiles.id
  where (select auth.uid()) is not null
    and profiles.id::text = any(coalesce(p_player_ids, array[]::text[]));
$$;

revoke execute on function public.get_player_display_names(text[]) from public;
grant execute on function public.get_player_display_names(text[]) to authenticated;
