-- Ten champions, and a way to choose which one goes.
--
-- The roster was unbounded, so a run's victory always had somewhere to put its
-- build. With a limit, a win can arrive at a full roster — and since the save is
-- automatic, refusing it silently would throw away the run that earned it. The
-- creation call therefore takes the champion being replaced: archiving it and
-- creating the new one are one operation, so a roster can never end up short a
-- champion because the second half of a swap failed.
--
-- Called without one, a full roster raises instead, which is what the results
-- screen turns into the choice it offers.
--
-- Exhausted champions hold their slots. Resting one off is the cost of an Abyss
-- attempt; letting it stop counting would make the limit meaningless for anyone
-- willing to wait a day.
--
-- The function is rewritten whole, and its four-argument form dropped rather
-- than left beside this one: an overload reachable with four arguments would be
-- ambiguous against a fifth with a default.

drop function if exists public.create_champion_from_run(text, text, text, text);

create function public.create_champion_from_run(
  p_champion_id text,
  p_source_run_id text,
  p_name text,
  p_content_version text,
  p_replaced_champion_id text default null
)
returns table (
  id text,
  name text,
  source_run_id text,
  content_version text,
  build jsonb,
  exhaustion_until timestamptz,
  archived boolean,
  created_at timestamptz
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_run public.dungeon_runs%rowtype;
  v_snapshot public.dungeon_run_snapshots%rowtype;
  v_build jsonb;
  v_champion public.champions%rowtype;
  v_held integer;
begin
  if v_profile_id is null then raise exception 'Authentication is required.'; end if;
  if coalesce(length(trim(p_champion_id)), 0) = 0 or
     coalesce(length(trim(p_source_run_id)), 0) = 0 or
     coalesce(length(trim(p_name)), 0) = 0 or
     coalesce(length(trim(p_content_version)), 0) = 0 then
    raise exception 'Champion fields are required.';
  end if;

  -- A retry of a call that already landed returns what it made, rather than
  -- archiving a second champion to make room for one that is already there.
  select champions.* into v_champion
  from public.champions as champions
  where champions.id = p_champion_id and champions.profile_id = v_profile_id;
  if found then
    return query select
      v_champion.id, v_champion.name, v_champion.source_run_id,
      v_champion.content_version, v_champion.build,
      v_champion.exhaustion_until, v_champion.archived, v_champion.created_at;
    return;
  end if;

  select runs.* into v_run
  from public.dungeon_runs as runs
  where runs.id = p_source_run_id and runs.profile_id = v_profile_id;
  if not found or v_run.status <> 'victory' then
    raise exception 'Champions can only be created from a victorious owned run.';
  end if;

  select snapshots.* into v_snapshot
  from public.dungeon_run_snapshots as snapshots
  where snapshots.run_id = p_source_run_id
  order by snapshots.id desc
  limit 1;
  if not found then raise exception 'The completed run has no checkpoint.'; end if;

  -- The roster is ten, and the replaced champion leaves it before the new one
  -- is counted against it. Archived champions are already gone; exhausted ones
  -- are not — a champion resting off an Abyss attempt still holds its place.
  -- Kept in step with CHAMPION_SLOT_LIMIT in
  -- src/content/progression/ChampionSlots.ts.
  if p_replaced_champion_id is not null then
    update public.champions as champions
    set archived = true
    where champions.id = p_replaced_champion_id
      and champions.profile_id = v_profile_id
      and champions.archived = false;
    if not found then
      raise exception 'The champion to replace was not found.';
    end if;
  end if;

  select count(*) into v_held
  from public.champions as champions
  where champions.profile_id = v_profile_id
    and champions.archived = false;
  if v_held >= 10 then
    raise exception 'Champion roster is full.';
  end if;

  v_build := jsonb_build_object(
    'schemaVersion', 1,
    'level', case
      when (v_snapshot.payload -> 'gameState' -> 'player' ->> 'level')
        ~ '^[0-9]+$'
      then greatest(
        1,
        (v_snapshot.payload -> 'gameState' -> 'player' ->> 'level')::integer
      )
      else 1
    end,
    'classId', v_snapshot.payload -> 'gameState' -> 'player' ->> 'characterClassId',
    'skills', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'skillId', skill ->> 'skillId',
        'level', greatest(1, coalesce((skill ->> 'level')::integer, 1))
      )), '[]'::jsonb)
      from jsonb_array_elements(
        coalesce(v_snapshot.payload -> 'gameState' -> 'player' -> 'skills', '[]'::jsonb)
      ) as skills(skill)
    ),
    'selectedUpgradeIds', coalesce(
      v_snapshot.payload -> 'gameState' -> 'run' -> 'selectedUpgradeIds',
      '[]'::jsonb
    ),
    'equipment', coalesce(
      v_snapshot.payload -> 'gameState' -> 'player' -> 'equipment',
      '{}'::jsonb
    ),
    'behaviorProfileId', coalesce(
      v_snapshot.payload -> 'gameState' -> 'player' -> 'behaviorController' ->> 'profileId',
      'balanced'
    )
  );

  insert into public.champions (
    id, profile_id, name, source_run_id, content_version, build
  ) values (
    p_champion_id, v_profile_id, p_name, p_source_run_id, p_content_version, v_build
  )
  on conflict on constraint champions_pkey do nothing;

  select champions.* into v_champion
  from public.champions as champions
  where champions.id = p_champion_id and champions.profile_id = v_profile_id;
  return query select
    v_champion.id, v_champion.name, v_champion.source_run_id,
    v_champion.content_version, v_champion.build,
    v_champion.exhaustion_until, v_champion.archived, v_champion.created_at;
end;
$$;

grant execute on function public.create_champion_from_run(text, text, text, text, text)
  to authenticated;
