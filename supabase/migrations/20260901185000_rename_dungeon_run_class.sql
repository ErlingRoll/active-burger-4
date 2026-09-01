-- Rename the durable run contract without rewriting run IDs or checkpoints.
-- Existing active and paused rows retain their class values through the column rename.

alter table public.dungeon_runs
  rename column playstyle_id to class_id;

-- PostgreSQL does not allow CREATE OR REPLACE to rename an input parameter.
-- Recreate this one RPC with the same signature and a class-oriented contract.
drop function public.start_dungeon_run(
  text, bigint, text, text[], integer, timestamptz, text, text, text, jsonb
);

create function public.start_dungeon_run(
  p_run_id text,
  p_seed bigint,
  p_contract_id text,
  p_world_modifier_ids text[],
  p_max_floor integer,
  p_started_at timestamptz,
  p_dungeon_id text,
  p_class_id text,
  p_game_version text,
  p_initial_payload jsonb
)
returns table (
  run_id text,
  status text,
  started_at timestamptz,
  was_created boolean
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_existing public.dungeon_runs%rowtype;
  v_resolved_at timestamptz;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to start a dungeon run.';
  end if;
  if coalesce(length(trim(p_run_id)), 0) = 0 then
    raise exception 'A non-empty run ID is required.';
  end if;
  if coalesce(length(trim(p_contract_id)), 0) = 0 then
    raise exception 'A non-empty contract ID is required.';
  end if;
  if coalesce(length(trim(p_dungeon_id)), 0) = 0 then
    raise exception 'A non-empty dungeon ID is required.';
  end if;
  if coalesce(length(trim(p_class_id)), 0) = 0 then
    raise exception 'A non-empty class ID is required.';
  end if;
  if coalesce(length(trim(p_game_version)), 0) = 0 then
    raise exception 'A non-empty game version is required.';
  end if;
  if p_max_floor < 1 then
    raise exception 'max_floor must be at least 1.';
  end if;

  v_resolved_at := coalesce(p_started_at, now());

  select * into v_existing
  from public.dungeon_runs
  where id = p_run_id;

  if found then
    if v_existing.profile_id <> v_profile_id then
      raise exception 'Run ID is already claimed by another profile.';
    end if;
    return query
    select p_run_id, v_existing.status, v_existing.started_at, false;
    return;
  end if;

  if exists (
    select 1
    from public.dungeon_runs as runs
    where runs.profile_id = v_profile_id
      and runs.status in ('active', 'paused')
  ) then
    raise exception 'Cannot start a new run while another run is still active or paused.';
  end if;

  insert into public.dungeon_runs (
    id, profile_id, status, contract_id, world_modifier_ids,
    seed, dungeon_id, class_id, game_version, max_floor, current_floor,
    started_at, updated_at
  ) values (
    p_run_id,
    v_profile_id,
    'active',
    p_contract_id,
    coalesce(p_world_modifier_ids, '{}'),
    p_seed, p_dungeon_id, p_class_id, p_game_version,
    p_max_floor,
    1,
    v_resolved_at,
    v_resolved_at
  );

  insert into public.dungeon_run_snapshots (
    run_id, profile_id, snapshot_kind, floor_number, level, kill_count,
    payload, saved_at
  ) values (
    p_run_id,
    v_profile_id,
    'start',
    1,
    greatest(1, coalesce(
      (p_initial_payload -> 'gameState' -> 'player' ->> 'level')::integer,
      1
    )),
    greatest(0, coalesce(
      (p_initial_payload -> 'gameState' -> 'run' ->> 'killCount')::integer,
      0
    )),
    coalesce(p_initial_payload, '{}'::jsonb),
    v_resolved_at
  );

  return query select p_run_id, 'active'::text, v_resolved_at, true;
end;
$$;

grant execute on function public.start_dungeon_run(
  text, bigint, text, text[], integer, timestamptz, text, text, text, jsonb
) to authenticated;
