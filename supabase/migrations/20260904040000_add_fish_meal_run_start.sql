-- Canonicalize and consume fish meals inside the durable run transaction.

create or replace function public.start_dungeon_run(
  p_run_id text,
  p_seed bigint,
  p_contract_id text,
  p_world_modifier_ids text[],
  p_max_floor integer,
  p_started_at timestamptz,
  p_dungeon_id text,
  p_mode_id text,
  p_class_id text,
  p_game_version text,
  p_preparation jsonb,
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
  v_preparation jsonb := coalesce(p_preparation, '{"version": 1, "items": []}'::jsonb);
  v_canonical_items jsonb := '[]'::jsonb;
  v_reservation_items jsonb := '[]'::jsonb;
  v_initial_payload jsonb;
  v_reservation_id uuid;
  v_item jsonb;
  v_instance public.inventory_item_instances%rowtype;
  v_item_instance_id uuid;
  v_quantity integer;
  v_size numeric;
  v_rarity_factor numeric;
  v_contribution numeric;
  v_applied_contribution numeric;
  v_total_movement_speed numeric := 0;
  v_item_index integer := 0;
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
  if p_mode_id not in ('dungeon', 'infinite-abyss') then
    raise exception 'Unknown dungeon run mode.';
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
  if jsonb_typeof(v_preparation) <> 'object' or
     v_preparation ->> 'version' <> '1' or
     jsonb_typeof(v_preparation -> 'items') <> 'array' then
    raise exception 'Preparation must contain version 1 and an items array.';
  end if;
  if jsonb_array_length(v_preparation -> 'items') > 5 then
    raise exception 'A fish meal cannot contain more than five items.';
  end if;

  v_resolved_at := coalesce(p_started_at, now());

  -- Idempotent retries return the committed run without trying to reserve fish
  -- a second time. The original request remains authoritative.
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

  -- The current meal category is fish. Resolve each effect from the owned
  -- instance metadata and discard any browser-supplied effect values.
  for v_item in select value from jsonb_array_elements(v_preparation -> 'items')
  loop
    if jsonb_typeof(v_item) <> 'object' or
       jsonb_typeof(v_item -> 'quantity') <> 'number' or
       (v_item ->> 'quantity') !~ '^[1-9][0-9]*$' or
       (v_item ->> 'quantity')::integer <> 1 then
      raise exception 'Fish meal items must contain quantity 1.';
    end if;
    v_item_instance_id := (v_item ->> 'itemInstanceId')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    select instances.* into v_instance
    from public.inventory_item_instances as instances
    join public.inventory_item_definitions as definitions
      on definitions.id = instances.definition_id
    where instances.id = v_item_instance_id
      and instances.profile_id = v_profile_id
      and instances.quantity >= v_quantity
      and definitions.category = 'fish'
      and definitions.active;
    if not found then
      raise exception 'Selected fish is not owned or is unavailable.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(v_reservation_items) as selected(item)
      where selected.item ->> 'itemInstanceId' = v_item_instance_id::text
    ) then
      raise exception 'A fish cannot be selected more than once.';
    end if;

    v_item_index := v_item_index + 1;
    v_size := case
      when coalesce(v_instance.metadata ->> 'sizePercentile', '') ~ '^[0-9]+(\.[0-9]+)?$'
        then greatest(0, least(1, (v_instance.metadata ->> 'sizePercentile')::numeric))
      else 0.5
    end;
    v_rarity_factor := case v_instance.metadata ->> 'rarity'
      when 'uncommon' then 1.25
      when 'rare' then 1.5
      when 'epic' then 1.75
      when 'legendary' then 2
      else 1
    end;
    v_contribution := 2 * v_rarity_factor * (0.75 + v_size * 0.5) / v_item_index;
    v_applied_contribution := greatest(
      0,
      least(v_contribution, 6 - v_total_movement_speed)
    );
    v_total_movement_speed := v_total_movement_speed + v_applied_contribution;

    v_canonical_items := v_canonical_items || jsonb_build_array(jsonb_build_object(
      'itemInstanceId', v_item_instance_id,
      'definitionId', v_instance.definition_id,
      'quantity', 1,
      'resolvedEffect', jsonb_build_object(
        'type', 'fish-meal',
        'family', 'movement-speed',
        'movementSpeedPercent', v_applied_contribution
      )
    ));
    v_reservation_items := v_reservation_items || jsonb_build_array(jsonb_build_object(
      'itemInstanceId', v_item_instance_id,
      'quantity', 1
    ));
  end loop;
  v_preparation := jsonb_build_object(
    'version', 1,
    'items', v_canonical_items
  );
  v_initial_payload := jsonb_set(
    coalesce(p_initial_payload, '{}'::jsonb),
    '{runConfig,preparation}',
    v_preparation,
    true
  );

  if jsonb_array_length(v_reservation_items) > 0 then
    select reserved.reservation_id into v_reservation_id
    from public.reserve_inventory_items(
      'run:' || p_run_id,
      'dungeon-run',
      v_reservation_items
    ) as reserved
    limit 1;
    if v_reservation_id is null then
      raise exception 'The selected fish could not be reserved.';
    end if;
  end if;

  insert into public.dungeon_runs (
    id, profile_id, status, contract_id, world_modifier_ids,
    seed, dungeon_id, mode_id, class_id, game_version, preparation,
    max_floor, current_floor, started_at, updated_at
  ) values (
    p_run_id,
    v_profile_id,
    'active',
    p_contract_id,
    coalesce(p_world_modifier_ids, '{}'),
    p_seed,
    p_dungeon_id,
    p_mode_id,
    p_class_id,
    p_game_version,
    v_preparation,
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
      (v_initial_payload -> 'gameState' -> 'player' ->> 'level')::integer,
      1
    )),
    greatest(0, coalesce(
      (v_initial_payload -> 'gameState' -> 'run' ->> 'killCount')::integer,
      0
    )),
    v_initial_payload,
    v_resolved_at
  );

  if v_reservation_id is not null then
    update public.inventory_reservations
    set status = 'consumed'
    where id = v_reservation_id
      and profile_id = v_profile_id
      and status = 'active';
    if not found then
      raise exception 'The fish reservation could not be finalized.';
    end if;
  end if;

  return query select p_run_id, 'active'::text, v_resolved_at, true;
end;
$$;

grant execute on function public.start_dungeon_run(
  text, bigint, text, text[], integer, timestamptz, text, text, text, text, jsonb, jsonb
) to authenticated;
