-- Qualify columns that share names with the function's RETURNS TABLE
-- variables, especially the output column named "id".

create or replace function public.create_champion_from_run(
  p_champion_id text,
  p_source_run_id text,
  p_name text,
  p_content_version text
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
begin
  if v_profile_id is null then raise exception 'Authentication is required.'; end if;
  if coalesce(length(trim(p_champion_id)), 0) = 0 or
     coalesce(length(trim(p_source_run_id)), 0) = 0 or
     coalesce(length(trim(p_name)), 0) = 0 or
     coalesce(length(trim(p_content_version)), 0) = 0 then
    raise exception 'Champion fields are required.';
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

  v_build := jsonb_build_object(
    'schemaVersion', 1,
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
  on conflict (id) do nothing;

  select champions.* into v_champion
  from public.champions as champions
  where champions.id = p_champion_id and champions.profile_id = v_profile_id;
  return query select
    v_champion.id, v_champion.name, v_champion.source_run_id,
    v_champion.content_version, v_champion.build,
    v_champion.exhaustion_until, v_champion.archived, v_champion.created_at;
end;
$$;
