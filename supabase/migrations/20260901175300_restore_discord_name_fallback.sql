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
