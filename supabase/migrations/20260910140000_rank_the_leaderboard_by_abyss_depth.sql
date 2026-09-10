-- The global ranking becomes the deepest descent.
--
-- Essence is a wallet balance: it only ever goes up, it is spent on permanent
-- upgrades, and a board sorted by it ranks players by how long they have been
-- playing rather than by anything they did. The Abyss is the mode with no last
-- floor, so how far down a player got is the game's own measure of a run.
--
-- Depth is read from `dungeon_runs.current_floor`, which is raised with
-- `greatest(...)` on every floor checkpoint and again on completion, so a
-- descent counts as it happens rather than only when it ends. Runs of every
-- status are considered: a player's deepest floor is theirs whether the attempt
-- ended in defeat, a forfeit, or is still underway.
--
-- The shape of the board is the one it had: the top ten, plus the reader's own
-- row when they placed outside it. A player who has never entered the Abyss has
-- no row at all — there is nothing to rank them by yet.

create or replace function public.get_abyss_depth_leaderboard()
returns table (
  profile_id uuid,
  display_name text,
  deepest_floor integer,
  rank bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with depths as (
    select
      runs.profile_id,
      max(runs.current_floor) as deepest_floor
    from public.dungeon_runs as runs
    where runs.mode_id = 'infinite-abyss'
    group by runs.profile_id
  ),
  ranked_entries as (
    select
      profiles.id as profile_id,
      coalesce(
        nullif(trim(profiles.display_name), ''),
        nullif(trim(public.extract_display_name(users.raw_user_meta_data)), ''),
        nullif(trim(split_part(users.email, '@', 1)), ''),
        'Anonymous player'
      ) as display_name,
      depths.deepest_floor,
      dense_rank() over (order by depths.deepest_floor desc) as rank
    from public.profiles as profiles
    join depths on depths.profile_id = profiles.id
    join auth.users as users on users.id = profiles.id
    where (select auth.uid()) is not null
  ),
  top_entries as (
    select
      ranked_entries.profile_id,
      ranked_entries.display_name,
      ranked_entries.deepest_floor,
      ranked_entries.rank
    from ranked_entries
    order by ranked_entries.deepest_floor desc, ranked_entries.profile_id asc
    limit 10
  ),
  visible_entries as (
    select
      top_entries.profile_id,
      top_entries.display_name,
      top_entries.deepest_floor,
      top_entries.rank
    from top_entries
    union all
    select
      ranked_entries.profile_id,
      ranked_entries.display_name,
      ranked_entries.deepest_floor,
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
    visible_entries.deepest_floor,
    visible_entries.rank
  from visible_entries
  order by visible_entries.deepest_floor desc, visible_entries.profile_id asc;
$$;

revoke execute on function public.get_abyss_depth_leaderboard() from public;
grant execute on function public.get_abyss_depth_leaderboard() to authenticated;

-- Ranking reads every Abyss run's deepest floor per player, so give it an index
-- rather than a scan of the run table.
create index if not exists dungeon_runs_abyss_depth_idx
  on public.dungeon_runs (profile_id, current_floor desc)
  where mode_id = 'infinite-abyss';
