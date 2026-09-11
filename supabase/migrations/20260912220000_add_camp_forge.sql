-- The Forge: scrap and rift shards in, rerolled artifacts and better salvage out.
--
-- The last of the Camp's buildings with a system to feed it. It consumes the
-- dungeon's scrap and the Abyss's shards and produces two things neither of
-- those systems could: an artifact rerolled without a new box, and more scrap
-- from the loadouts a run leaves behind. Neither touches a combat statistic
-- by itself; a rerolled artifact is the same base with a fresh roll, which
-- is exactly what a box would have handed out.

insert into public.camp_building_definitions (id, name, sort_order, starting_level) values
  ('forge', 'Forge', 6, 0)
on conflict (id) do update
set name = excluded.name,
    sort_order = excluded.sort_order,
    starting_level = excluded.starting_level,
    active = true;

insert into public.camp_building_levels (
  building_id, level, cost, accrual_cap_hours, rate_multiplier, job_slots
) values
  ('forge', 1, '{"timber": 60, "stone": 60, "scrap": 40}'::jsonb, null, 1, 0),
  ('forge', 2, '{"timber": 100, "stone": 100, "rift-shard": 15}'::jsonb, null, 1, 0),
  ('forge', 3, '{"timber": 160, "stone": 160, "rift-shard": 40}'::jsonb, null, 1, 0)
on conflict (building_id, level) do update
set cost = excluded.cost,
    accrual_cap_hours = excluded.accrual_cap_hours,
    rate_multiplier = excluded.rate_multiplier,
    job_slots = excluded.job_slots;

alter table public.inventory_operations
  drop constraint inventory_operations_operation_type_check;

alter table public.inventory_operations
  add constraint inventory_operations_operation_type_check
  check (
    operation_type in (
      'grant', 'consume', 'reserve', 'release', 'salvage', 'craft', 'sell', 'buy',
      'camp-claim', 'camp-upgrade', 'camp-gut', 'camp-cure', 'camp-reforge'
    )
  );

/* How much more scrap a finished loadout leaves behind: a quarter more at
   Forge 2, half again at Forge 3. Mirrored in src/camp/Forge.ts. */
create function public.camp_forge_salvage_multiplier(p_profile_id uuid)
returns numeric
language sql
stable
security definer set search_path = ''
as $$
  select case public.camp_building_level(p_profile_id, 'forge')
    when 2 then 1.25
    when 3 then 1.5
    else 1
  end;
$$;

revoke all on function public.camp_forge_salvage_multiplier(uuid)
  from public, anon, authenticated;

/*
 * Reroll an artifact. The base and the rarity stay; the implicit and the
 * modifiers are rolled again through the same function a box uses, from a
 * seed the artifact has not used before, so a retry cannot roll twice and a
 * reforge cannot be undone by asking for the old seed. An artifact held by a
 * run has no quantity in the bag and cannot be reforged until it returns.
 * Costs scale with rarity; mirrored in src/camp/Forge.ts.
 */
create function public.reforge_artifact(
  p_operation_id text,
  p_artifact_instance_id uuid
)
returns table (
  definition_id text,
  metadata jsonb,
  scrap_spent integer,
  shards_spent integer,
  was_processed boolean
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_operation public.inventory_operations%rowtype;
  v_artifact public.inventory_item_instances%rowtype;
  v_rarity text;
  v_scrap integer;
  v_shards integer;
  v_count integer;
  v_seed uuid;
  v_metadata jsonb;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required.';
  end if;
  if coalesce(length(trim(p_operation_id)), 0) = 0 then
    raise exception 'A non-empty inventory operation ID is required.';
  end if;
  if public.camp_building_level(v_profile_id, 'forge') < 1 then
    raise exception 'Build the Forge at the Camp first.';
  end if;

  v_operation := public.inventory_claim_operation(
    v_profile_id, p_operation_id, 'camp-reforge',
    jsonb_build_object('artifactInstanceId', p_artifact_instance_id)
  );
  if v_operation.status = 'completed' then
    return query
    select
      v_operation.result -> 0 ->> 'definition_id',
      v_operation.result -> 0 -> 'metadata',
      (v_operation.result -> 0 ->> 'scrap_spent')::integer,
      (v_operation.result -> 0 ->> 'shards_spent')::integer,
      false;
    return;
  end if;

  select instances.* into v_artifact
  from public.inventory_item_instances as instances
  where instances.id = p_artifact_instance_id
    and instances.profile_id = v_profile_id
    and instances.quantity >= 1
  for update;
  if not found then
    raise exception 'Artifact not found, or it is away on a run.';
  end if;
  if not exists (
    select 1 from public.inventory_item_definitions as definitions
    where definitions.id = v_artifact.definition_id and definitions.category = 'artifact'
  ) then
    raise exception 'Only an artifact can be reforged.';
  end if;

  v_rarity := coalesce(v_artifact.metadata ->> 'rarity', 'common');
  v_scrap := case v_rarity
    when 'uncommon' then 30
    when 'rare' then 45
    when 'epic' then 70
    when 'legendary' then 100
    else 20
  end;
  v_shards := case v_rarity
    when 'uncommon' then 2
    when 'rare' then 3
    when 'epic' then 5
    when 'legendary' then 8
    else 1
  end;

  perform public.camp_consume_material(v_profile_id, 'scrap', v_scrap);
  perform public.camp_consume_material(v_profile_id, 'rift-shard', v_shards);

  v_count := coalesce((v_artifact.metadata ->> 'reforgeCount')::integer, 0) + 1;
  v_seed := md5(v_artifact.id::text || ':reforge:' || v_count)::uuid;
  v_metadata := public.roll_artifact_metadata(
    v_seed,
    v_artifact.definition_id,
    (v_artifact.metadata - 'implicit' - 'modifiers' - 'baseId')
      || jsonb_build_object('rarity', v_rarity, 'reforgeCount', v_count)
  );

  update public.inventory_item_instances as instances
  set metadata = v_metadata, updated_at = now()
  where instances.id = v_artifact.id;

  update public.inventory_operations as operations
  set status = 'completed',
      result = jsonb_build_array(jsonb_build_object(
        'definition_id', v_artifact.definition_id,
        'metadata', v_metadata,
        'scrap_spent', v_scrap,
        'shards_spent', v_shards
      )),
      completed_at = now()
  where operations.profile_id = v_profile_id
    and operations.operation_id = p_operation_id;

  return query select v_artifact.definition_id, v_metadata, v_scrap, v_shards, true;
end;
$$;

revoke all on function public.reforge_artifact(text, uuid) from public, anon;
grant execute on function public.reforge_artifact(text, uuid) to authenticated;

/*
 * The run completion, with the Forge's salvage bonus applied to the scrap a
 * loadout leaves behind. Rewritten whole with the same signature; the only
 * change is the multiplier on the scrap sum.
 */
create or replace function public.complete_dungeon_run(
  p_run_id text,
  p_outcome text,
  p_completed_at timestamptz,
  p_result_payload jsonb
)
returns table (
  run_id text,
  essence_awarded integer,
  essence_balance bigint,
  scrap_awarded integer,
  was_processed boolean
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_run public.dungeon_runs%rowtype;
  v_level integer;
  v_kill_count integer;
  v_base_essence integer;
  v_essence integer;
  v_multiplier numeric := 1;
  v_modifier_id text;
  v_inserted boolean;
  v_final_at timestamptz;
  v_floor_number integer;
  v_checkpoint jsonb;
  v_status text;
  v_equipment jsonb;
  v_scrap integer := 0;
  v_scrap_operation text;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to complete a dungeon run.';
  end if;
  if coalesce(length(trim(p_run_id)), 0) = 0 then
    raise exception 'A non-empty run ID is required.';
  end if;
  if p_outcome not in ('victory', 'defeat') then
    raise exception 'Outcome must be ''victory'' or ''defeat''.';
  end if;

  v_final_at := coalesce(p_completed_at, now());
  v_scrap_operation := 'dungeon-scrap:' || p_run_id;

  select runs.* into v_run
  from public.dungeon_runs as runs
  where runs.id = p_run_id
    and runs.profile_id = v_profile_id
  for update;

  if not found then
    raise exception 'Dungeon run not found.';
  end if;

  -- Idempotency: if already terminal, return what was awarded the first time.
  if v_run.status not in ('active', 'paused') then
    select coalesce((
      select sum((entry ->> 'quantity')::integer)
      from public.inventory_operations as ops,
        lateral jsonb_array_elements(ops.result) as entries(entry)
      where ops.profile_id = v_profile_id
        and ops.operation_id = v_scrap_operation
        and ops.status = 'completed'
    ), 0) into v_scrap;

    return query
    select
      p_run_id,
      rewards.essence_earned,
      wallets.essence_balance,
      v_scrap,
      false
    from public.meta_run_rewards as rewards
    join public.meta_wallets as wallets on wallets.profile_id = v_profile_id
    where rewards.profile_id = v_profile_id
      and rewards.run_id = p_run_id;
    return;
  end if;

  -- Keep server-side reward values in sync with submit_meta_run_result.
  v_level := greatest(1, coalesce((p_result_payload ->> 'level')::integer, 1));
  v_kill_count := greatest(0, coalesce((p_result_payload ->> 'killCount')::integer, 0));

  for v_modifier_id in
    select modifiers.value
    from (
      select distinct value
      from jsonb_array_elements_text(
        coalesce(p_result_payload -> 'worldModifierIds', '[]'::jsonb)
      ) as entries(value)
      where value in (
        'swarming',
        'juggernauts',
        'glass-world',
        'shorter-minute',
        'elite-invasion',
        'fast-start'
      )
    ) as modifiers
  loop
    v_multiplier := v_multiplier + case v_modifier_id
      when 'swarming'       then 0.10
      when 'juggernauts'    then 0.20
      when 'glass-world'    then 0.15
      when 'shorter-minute' then 0.15
      when 'elite-invasion' then 0.20
      when 'fast-start'     then 0.08
      else 0
    end;
  end loop;

  v_base_essence := v_level + floor(v_kill_count / 10.0)::integer;
  v_essence := greatest(
    1,
    floor(
      v_base_essence
      * v_multiplier
      * case when p_outcome = 'victory' then 1.10 else 1 end
    )::integer
  );

  -- The Abyss is not paid in Essence. Scrap already knew this — the loadout
  -- salvage below is gated on the mode — but the run reward did not, so an
  -- Abyss descent banked a dungeon's wages on top of its own score.
  if v_run.mode_id is distinct from 'dungeon' then
    v_essence := 0;
  end if;

  v_checkpoint := coalesce(p_result_payload -> 'checkpoint', '{}'::jsonb);
  v_status := case
    when p_outcome = 'victory' then 'victory'
    when (v_checkpoint -> 'gameState' -> 'run' ->> 'forfeited')::boolean then 'forfeited'
    else 'defeat'
  end;
  v_floor_number := greatest(
    1,
    coalesce(
      (v_checkpoint -> 'gameState' -> 'run' ->> 'floor')::integer,
      v_run.current_floor
    )
  );
  insert into public.dungeon_run_snapshots (
    run_id, profile_id, snapshot_kind, floor_number, level, kill_count,
    payload, saved_at
  ) values (
    p_run_id,
    v_profile_id,
    case when v_status = 'victory' then 'victory' else 'death' end,
    v_floor_number,
    v_level,
    v_kill_count,
    v_checkpoint,
    v_final_at
  );

  update public.dungeon_runs as runs
  set status = v_status,
      current_floor = greatest(runs.current_floor, v_floor_number),
      completed_at = v_final_at,
      updated_at = v_final_at
  where runs.id = p_run_id;

  -- A run that did not win has no Champion to lock its artifacts into, so
  -- they go straight back to the bag. A victory keeps its hold until the
  -- Champion is made or the results are left behind.
  if v_status <> 'victory' then
    perform public.release_artifact_hold(v_profile_id, p_run_id);
  end if;

  insert into public.meta_wallets (profile_id)
  values (v_profile_id)
  on conflict on constraint meta_wallets_pkey do nothing;

  insert into public.meta_run_rewards (
    profile_id, run_id, pending_result_id, completed_at, essence_earned, payload
  ) values (
    v_profile_id, p_run_id, null, v_final_at, v_essence, p_result_payload
  )
  on conflict on constraint meta_run_rewards_pkey do nothing;
  v_inserted := found;

  if v_inserted then
    update public.meta_wallets as wallets
    set essence_balance = wallets.essence_balance + v_essence,
        essence_earned = wallets.essence_earned + v_essence,
        updated_at = v_final_at
    where wallets.profile_id = v_profile_id;
  else
    select rewards.essence_earned into v_essence
    from public.meta_run_rewards as rewards
    where rewards.profile_id = v_profile_id
      and rewards.run_id = p_run_id;
  end if;

  -- Scrap from the loadout the run ended with, raised by the Forge. The
  -- grant is idempotent under its own operation ID, so a retried completion
  -- cannot pay it twice.
  v_equipment := v_checkpoint -> 'gameState' -> 'player' -> 'equipment';
  if v_run.mode_id = 'dungeon' and jsonb_typeof(v_equipment) = 'object' then
    select coalesce(sum(
      case coalesce(pieces.value ->> 'rarity', 'common')
        when 'common'    then 1
        when 'uncommon'  then 2
        when 'rare'      then 4
        when 'epic'      then 7
        when 'legendary' then 12
        else 1
      end
    ), 0)::integer into v_scrap
    from jsonb_each(v_equipment) as pieces
    where jsonb_typeof(pieces.value) = 'object';
    v_scrap := ceil(v_scrap * public.camp_forge_salvage_multiplier(v_profile_id))::integer;

    if v_scrap > 0 then
      perform 1 from public.grant_inventory_items(
        v_scrap_operation,
        'dungeon-reward',
        p_run_id,
        jsonb_build_array(jsonb_build_object(
          'definitionId', 'scrap',
          'quantity', v_scrap,
          'metadata', jsonb_build_object('runId', p_run_id)
        ))
      );
    end if;
  end if;

  return query
  select p_run_id, v_essence, wallets.essence_balance, v_scrap, v_inserted
  from public.meta_wallets as wallets
  where wallets.profile_id = v_profile_id;
end;
$$;
