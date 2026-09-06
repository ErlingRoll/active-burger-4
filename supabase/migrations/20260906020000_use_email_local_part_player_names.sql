-- Keep email-authenticated players identifiable without publishing their
-- domains or full email addresses.
create or replace function public.get_essence_leaderboard()
returns table (
  profile_id uuid,
  display_name text,
  essence_balance bigint,
  rank bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with ranked_entries as (
    select
      profiles.id as profile_id,
      coalesce(
        nullif(trim(profiles.display_name), ''),
        nullif(trim(public.extract_display_name(users.raw_user_meta_data)), ''),
        nullif(trim(split_part(users.email, '@', 1)), ''),
        'Anonymous player'
      ) as display_name,
      wallets.essence_balance,
      dense_rank() over (order by wallets.essence_balance desc) as rank
    from public.profiles as profiles
    join public.meta_wallets as wallets on wallets.profile_id = profiles.id
    join auth.users as users on users.id = profiles.id
    where (select auth.uid()) is not null
  ),
  top_entries as (
    select
      ranked_entries.profile_id,
      ranked_entries.display_name,
      ranked_entries.essence_balance,
      ranked_entries.rank
    from ranked_entries
    order by ranked_entries.essence_balance desc, ranked_entries.profile_id asc
    limit 10
  ),
  visible_entries as (
    select
      top_entries.profile_id,
      top_entries.display_name,
      top_entries.essence_balance,
      top_entries.rank
    from top_entries
    union all
    select
      ranked_entries.profile_id,
      ranked_entries.display_name,
      ranked_entries.essence_balance,
      ranked_entries.rank
    from ranked_entries
    where ranked_entries.profile_id = (select auth.uid())
      and not exists (
        select 1
        from top_entries
        where top_entries.profile_id = ranked_entries.profile_id
      )
  )
  select
    visible_entries.profile_id,
    visible_entries.display_name,
    visible_entries.essence_balance,
    visible_entries.rank
  from visible_entries
  order by visible_entries.essence_balance desc, visible_entries.profile_id asc;
$$;

revoke execute on function public.get_essence_leaderboard() from public;
grant execute on function public.get_essence_leaderboard() to authenticated;

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
      nullif(trim(split_part(users.email, '@', 1)), ''),
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
      nullif(trim(split_part(users.email, '@', 1)), ''),
      'Anonymous player'
    ) as player_name
  from public.profiles as profiles
  join auth.users as users on users.id = profiles.id
  where (select auth.uid()) is not null
    and profiles.id::text = any(coalesce(p_player_ids, array[]::text[]));
$$;

revoke execute on function public.get_player_display_names(text[]) from public;
grant execute on function public.get_player_display_names(text[]) to authenticated;

-- Older reports could contain the full email address. Reduce those legacy
-- values to the same local-part-only representation used by new reports.
update public.bug_reports as reports
set username = nullif(trim(split_part(users.email, '@', 1)), '')
from auth.users as users
where users.id = reports.user_id
  and reports.username = users.email
  and nullif(trim(split_part(users.email, '@', 1)), '') is not null;
