-- Artifacts go into runs, and into the Champions those runs produce.
--
-- A dungeon run is prepared with up to three artifacts from the bag; the
-- slots past the first are Essence store unlocks. Starting the run puts a
-- hold on the artifacts (a reservation that stays active, so the items leave
-- the bag without being consumed) and copies their rolled metadata into the
-- run's canonical preparation, which the simulation reads. A run that does
-- not win releases the hold. A victory keeps it until the Champion is made,
-- at which point the artifacts move into the Champion's build and the hold
-- is consumed: the instance rows stay at quantity zero for as long as the
-- Champion stands. Archiving the Champion, or replacing it on a full roster,
-- puts them back at quantity one, same ids, same rolls.
--
-- In the Infinite Abyss the Champion's own artifacts are the loadout, read
-- from the Champion the initial checkpoint names; nothing is taken from the
-- bag. There is no bind-on-equip anywhere in this: the Champion is the lock.
--
-- The Glutton's Kettle is the one implicit the server resolves, because the
-- meal is: it adds a sixth fish slot and scales every fish's contribution.

insert into public.meta_unlock_definitions (
  id, category, cost, requires_unlock_id, is_starter, payload
) values
  ('artifact-slot-1', 'artifact-slot', 1500, null, false, '{"artifactSlotCount":2}'::jsonb),
  ('artifact-slot-2', 'artifact-slot', 4000, 'artifact-slot-1', false, '{"artifactSlotCount":3}'::jsonb)
on conflict (id) do nothing;

-- How many artifacts this account may take into a dungeon run: one, plus
-- whatever the store has sold it. Kept in step with getArtifactSlotCount in
-- src/meta/MetaProgressionService.ts.
create or replace function public.artifact_slot_count(p_profile_id uuid)
returns integer
language sql
stable
security definer set search_path = ''
as $$
  select greatest(1, coalesce(max((definitions.payload ->> 'artifactSlotCount')::integer), 1))
  from public.meta_unlocks as unlocks
  join public.meta_unlock_definitions as definitions on definitions.id = unlocks.unlock_id
  where unlocks.profile_id = p_profile_id
    and definitions.category = 'artifact-slot';
$$;

revoke all on function public.artifact_slot_count(uuid) from public;

-- The Kettle's meal bonus across a loadout, and the meal slots it opens.
-- Two Kettles would be two bonuses; the slot is only ever one more.
create or replace function public.artifact_meal_bonus_percent(p_artifacts jsonb)
returns numeric
language sql
immutable
security definer set search_path = ''
as $$
  select coalesce(sum((entry -> 'artifact' -> 'implicit' ->> 'value')::numeric), 0)
  from jsonb_array_elements(coalesce(p_artifacts, '[]'::jsonb)) as entries(entry)
  where entry -> 'artifact' -> 'implicit' ->> 'id' = 'hearty-meal';
$$;

revoke all on function public.artifact_meal_bonus_percent(jsonb) from public;

create or replace function public.artifact_meal_slot_count(p_artifacts jsonb)
returns integer
language sql
immutable
security definer set search_path = ''
as $$
  select case
    when exists (
      select 1
      from jsonb_array_elements(coalesce(p_artifacts, '[]'::jsonb)) as entries(entry)
      where entry -> 'artifact' -> 'implicit' ->> 'id' = 'hearty-meal'
    ) then 6
    else 5
  end;
$$;

revoke all on function public.artifact_meal_slot_count(jsonb) from public;

-- Gives a run's held artifacts back: every line of the hold returns to its
-- instance and the reservation is marked released. Returns how many lines
-- came back, zero when there was no standing hold.
create or replace function public.release_artifact_hold(
  p_profile_id uuid,
  p_run_id text
)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  v_reservation public.inventory_reservations%rowtype;
  v_line record;
  v_released integer := 0;
begin
  select reservation.* into v_reservation
  from public.inventory_reservations as reservation
  where reservation.profile_id = p_profile_id
    and reservation.operation_id = 'artifact-hold:' || p_run_id
    and reservation.status = 'active'
  for update;
  if not found then
    return 0;
  end if;

  for v_line in
    select lines.item_instance_id, lines.quantity
    from public.inventory_reservation_lines as lines
    where lines.reservation_id = v_reservation.id
  loop
    update public.inventory_item_instances as instances
    set quantity = instances.quantity + v_line.quantity,
        updated_at = now()
    where instances.id = v_line.item_instance_id
      and instances.profile_id = p_profile_id;
    v_released := v_released + 1;
  end loop;

  update public.inventory_reservations as reservation
  set status = 'released', released_at = now()
  where reservation.id = v_reservation.id;

  return v_released;
end;
$$;

revoke all on function public.release_artifact_hold(uuid, text) from public;

-- Holds whose run is over and whose Champion was never made. Run before a new
-- run reaches for the bag, so a player who left the results screen without
-- saving a Champion finds their artifacts where they left them.
create or replace function public.release_stale_artifact_holds(p_profile_id uuid)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  v_run record;
  v_released integer := 0;
begin
  for v_run in
    select runs.id
    from public.inventory_reservations as reservation
    join public.dungeon_runs as runs
      on runs.id = substring(reservation.operation_id from length('artifact-hold:') + 1)
      and runs.profile_id = p_profile_id
    where reservation.profile_id = p_profile_id
      and reservation.operation_id like 'artifact-hold:%'
      and reservation.status = 'active'
      and runs.status not in ('active', 'paused')
  loop
    v_released := v_released + public.release_artifact_hold(p_profile_id, v_run.id);
  end loop;
  return v_released;
end;
$$;

revoke all on function public.release_stale_artifact_holds(uuid) from public;

-- The client-facing release, for a results screen left without a Champion.
create or replace function public.release_run_artifacts(p_run_id text)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_run public.dungeon_runs%rowtype;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to release run artifacts.';
  end if;
  select runs.* into v_run
  from public.dungeon_runs as runs
  where runs.id = p_run_id and runs.profile_id = v_profile_id;
  if not found then
    raise exception 'Dungeon run not found.';
  end if;
  if v_run.status in ('active', 'paused') then
    raise exception 'A run still in progress keeps its artifacts.';
  end if;
  return public.release_artifact_hold(v_profile_id, p_run_id);
end;
$$;

grant execute on function public.release_run_artifacts(text) to authenticated;

-- A Champion's artifacts back to the bag. Idempotent under one ledger entry
-- per Champion, so a retried archive cannot mint a second copy of anything.
create or replace function public.return_champion_artifacts(
  p_profile_id uuid,
  p_champion_id text
)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  v_champion public.champions%rowtype;
  v_entry jsonb;
  v_returned integer := 0;
  v_result jsonb := '[]'::jsonb;
begin
  select champions.* into v_champion
  from public.champions as champions
  where champions.id = p_champion_id and champions.profile_id = p_profile_id;
  if not found or jsonb_typeof(v_champion.build -> 'artifacts') <> 'array'
    or jsonb_array_length(v_champion.build -> 'artifacts') = 0 then
    return 0;
  end if;

  insert into public.inventory_operations (
    profile_id, operation_id, operation_type, status, request
  ) values (
    p_profile_id, 'champion-artifacts:' || p_champion_id, 'release', 'pending',
    jsonb_build_object('championId', p_champion_id)
  )
  on conflict (profile_id, operation_id) do nothing;
  if not found then
    return 0;
  end if;

  for v_entry in select value from jsonb_array_elements(v_champion.build -> 'artifacts') loop
    update public.inventory_item_instances as instances
    set quantity = instances.quantity + 1,
        updated_at = now()
    where instances.id = (v_entry ->> 'itemInstanceId')::uuid
      and instances.profile_id = p_profile_id
      and instances.quantity = 0;
    if found then
      v_returned := v_returned + 1;
      v_result := v_result || jsonb_build_array(jsonb_build_object(
        'item_instance_id', v_entry ->> 'itemInstanceId',
        'quantity_released', 1
      ));
    end if;
  end loop;

  update public.inventory_operations as ops
  set status = 'completed', result = v_result, completed_at = now()
  where ops.profile_id = p_profile_id
    and ops.operation_id = 'champion-artifacts:' || p_champion_id;

  return v_returned;
end;
$$;

revoke all on function public.return_champion_artifacts(uuid, text) from public;

-- The artifacts a run is played with, as canonical preparation entries.
--
-- A dungeon run takes what the bag offers, checked against ownership, the
-- account's slot count and the artifact's own rolled metadata, and holds it.
-- An Abyss attempt takes the Champion's, and nothing from the bag: the
-- Champion is the build, artifacts included.
create or replace function public.resolve_run_artifacts(
  p_profile_id uuid,
  p_run_id text,
  p_mode_id text,
  p_requested jsonb,
  p_initial_payload jsonb
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_champion_id text;
  v_champion public.champions%rowtype;
  v_entry jsonb;
  v_item_instance_id uuid;
  v_instance public.inventory_item_instances%rowtype;
  v_definition public.inventory_item_definitions%rowtype;
  v_canonical jsonb := '[]'::jsonb;
  v_hold_items jsonb := '[]'::jsonb;
  v_reservation_id uuid;
begin
  if p_mode_id = 'infinite-abyss' then
    v_champion_id := coalesce(p_initial_payload -> 'runConfig' ->> 'championId', '');
    if length(trim(v_champion_id)) = 0 then
      return '[]'::jsonb;
    end if;
    select champions.* into v_champion
    from public.champions as champions
    where champions.id = v_champion_id and champions.profile_id = p_profile_id;
    if not found then
      raise exception 'The selected Champion is not owned.';
    end if;
    return coalesce(
      case when jsonb_typeof(v_champion.build -> 'artifacts') = 'array'
        then v_champion.build -> 'artifacts' end,
      '[]'::jsonb
    );
  end if;

  if jsonb_typeof(p_requested) <> 'array' then
    raise exception 'Preparation artifacts must be an array.';
  end if;
  if jsonb_array_length(p_requested) = 0 then
    return '[]'::jsonb;
  end if;
  if jsonb_array_length(p_requested) > public.artifact_slot_count(p_profile_id) then
    raise exception 'More artifacts were selected than the account has slots for.';
  end if;

  for v_entry in select value from jsonb_array_elements(p_requested) loop
    if jsonb_typeof(v_entry) <> 'object' or coalesce(v_entry ->> 'itemInstanceId', '') = '' then
      raise exception 'Each selected artifact must name an item instance.';
    end if;
    v_item_instance_id := (v_entry ->> 'itemInstanceId')::uuid;
    if exists (
      select 1
      from jsonb_array_elements(v_hold_items) as selected(item)
      where selected.item ->> 'itemInstanceId' = v_item_instance_id::text
    ) then
      raise exception 'An artifact cannot be selected more than once.';
    end if;

    select instances.* into v_instance
    from public.inventory_item_instances as instances
    where instances.id = v_item_instance_id
      and instances.profile_id = p_profile_id
      and instances.quantity >= 1;
    if not found then
      raise exception 'Selected artifact is not owned or is unavailable.';
    end if;
    select definitions.* into v_definition
    from public.inventory_item_definitions as definitions
    where definitions.id = v_instance.definition_id
      and definitions.category = 'artifact'
      and definitions.active;
    if not found then
      raise exception 'Selected item is not an artifact.';
    end if;
    if jsonb_typeof(v_instance.metadata -> 'implicit') <> 'object'
      or jsonb_typeof(v_instance.metadata -> 'modifiers') <> 'array'
      or coalesce(v_instance.metadata ->> 'baseId', '') = '' then
      raise exception 'Selected artifact has no roll on it.';
    end if;

    -- Only the roll travels: nothing the client sent about the artifact is
    -- read past its instance id.
    v_canonical := v_canonical || jsonb_build_array(jsonb_build_object(
      'itemInstanceId', v_item_instance_id,
      'definitionId', v_instance.definition_id,
      'quantity', 1,
      'artifact', jsonb_build_object(
        'baseId', v_instance.metadata -> 'baseId',
        'rarity', v_instance.metadata -> 'rarity',
        'implicit', v_instance.metadata -> 'implicit',
        'modifiers', v_instance.metadata -> 'modifiers'
      )
    ));
    v_hold_items := v_hold_items || jsonb_build_array(jsonb_build_object(
      'itemInstanceId', v_item_instance_id,
      'quantity', 1
    ));
  end loop;

  -- The hold: a reservation that stays active for the life of the run.
  select reserved.reservation_id into v_reservation_id
  from public.reserve_inventory_items(
    'artifact-hold:' || p_run_id,
    'artifact-hold',
    v_hold_items
  ) as reserved
  limit 1;
  if v_reservation_id is null then
    raise exception 'The selected artifacts could not be held.';
  end if;

  return v_canonical;
end;
$$;

revoke all on function public.resolve_run_artifacts(uuid, text, text, jsonb, jsonb) from public;

-- The live function takes max_floor as bigint since the Abyss widened it.
-- An integer overload beside it would leave every call ambiguous, so any
-- such leftover goes first; on a database that never had one this is a
-- no-op.
drop function if exists public.start_dungeon_run(
  text, bigint, text, text[], integer, timestamptz, text, text, text, text, jsonb, jsonb
);

create or replace function public.start_dungeon_run(
  p_run_id text,
  p_seed bigint,
  p_contract_id text,
  p_world_modifier_ids text[],
  p_max_floor bigint,
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
  v_instance public.inventory_item_instances%rowtype;
  v_definition public.inventory_item_definitions%rowtype;
  v_resolved_at timestamptz;
  v_preparation jsonb := coalesce(p_preparation, '{"version": 1, "items": []}'::jsonb);
  v_canonical_items jsonb := '[]'::jsonb;
  v_reservation_items jsonb := '[]'::jsonb;
  v_initial_payload jsonb;
  v_reservation_id uuid;
  v_item jsonb;
  v_effect jsonb;
  v_item_instance_id uuid;
  v_quantity integer;
  v_size numeric;
  v_rarity text;
  v_rarity_factor numeric;
  v_family text;
  v_effect_key text;
  v_base_value numeric;
  v_run_meal_eligible boolean;
  v_enchantment_id text;
  v_enchantment_value numeric;
  v_contribution numeric;
  v_applied_contribution numeric;
  v_family_cap numeric;
  v_previous_count integer;
  v_previous_total numeric;
  v_family_counts jsonb := '{}'::jsonb;
  v_family_totals jsonb := '{}'::jsonb;
  v_artifacts jsonb := '[]'::jsonb;
  v_meal_bonus numeric := 0;
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
  if jsonb_array_length(v_preparation -> 'items') > 6 then
    raise exception 'A fish meal cannot contain more than six items.';
  end if;
  if v_preparation ? 'artifacts' and jsonb_typeof(v_preparation -> 'artifacts') <> 'array' then
    raise exception 'Preparation artifacts must be an array.';
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

  -- A hold left behind by a finished run whose Champion was never made goes
  -- back to the bag before this run reaches for anything.
  perform public.release_stale_artifact_holds(v_profile_id);

  -- Artifacts resolve first: the Kettle's implicit widens the meal, and the
  -- meal loop below reads the count it sets.
  v_artifacts := public.resolve_run_artifacts(
    v_profile_id, p_run_id, p_mode_id,
    coalesce(v_preparation -> 'artifacts', '[]'::jsonb),
    p_initial_payload
  );
  v_meal_bonus := public.artifact_meal_bonus_percent(v_artifacts);
  if jsonb_array_length(v_preparation -> 'items') > public.artifact_meal_slot_count(v_artifacts) then
    raise exception 'The meal has more fish than the run has slots for.';
  end if;

  -- Resolve every fish effect from the authoritative definition payload and
  -- owned instance metadata. Browser-provided effects are never trusted.
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

    select * into v_definition
    from public.inventory_item_definitions
    where id = v_instance.definition_id
      and category = 'fish'
      and active;
    if not found then
      raise exception 'Selected fish definition is unavailable.';
    end if;

    v_family := v_definition.payload ->> 'effectFamily';
    v_base_value := (v_definition.payload ->> 'baseValue')::numeric;
    v_run_meal_eligible := coalesce(
      (v_definition.payload ->> 'runMealEligible')::boolean,
      false
    );
    if v_family is null or v_family not in (
      'movement-speed',
      'attack-speed',
      'increased-healing',
      'max-hp',
      'attack-damage',
      'cooldown-reduction',
      'physical-resistance',
      'elite-damage',
      'emergency-revive',
      'abyss-exhaustion'
    ) or v_base_value is null or v_base_value <= 0 then
      raise exception 'Selected fish has invalid meal metadata.';
    end if;
    if not v_run_meal_eligible then
      raise exception 'Selected fish is reserved for Champion recovery.';
    end if;

    v_rarity := v_definition.payload ->> 'rarity';
    v_rarity_factor := case v_rarity
      when 'common' then 1
      when 'uncommon' then 1.25
      when 'rare' then 1.5
      when 'epic' then 1.75
      when 'legendary' then 2
      else null
    end;
    if v_rarity_factor is null then
      raise exception 'Selected fish has invalid rarity metadata.';
    end if;

    if coalesce(jsonb_typeof(v_instance.metadata -> 'sizePercentile'), '') <> 'number' then
      raise exception 'Selected fish has invalid size metadata.';
    end if;
    v_size := (v_instance.metadata ->> 'sizePercentile')::numeric;
    if v_size < 0 or v_size > 1 then
      raise exception 'Selected fish has invalid size metadata.';
    end if;

    v_enchantment_id := nullif(v_instance.metadata ->> 'enchantmentId', '');
    if v_enchantment_id is null then
      v_enchantment_value := 0;
    elsif v_enchantment_id = 'bright-scales' then
      v_enchantment_value := 15;
    elsif v_enchantment_id = 'deep-current' then
      v_enchantment_value := 25;
    elsif v_enchantment_id = 'astral-mark' then
      v_enchantment_value := 40;
    else
      raise exception 'Selected fish has an unknown enchantment.';
    end if;

    v_family_cap := case v_family
      when 'movement-speed' then 6
      when 'attack-speed' then 9
      when 'increased-healing' then 12
      when 'max-hp' then 12
      when 'attack-damage' then 9
      when 'cooldown-reduction' then 12
      when 'physical-resistance' then 10
      when 'elite-damage' then 16
      when 'emergency-revive' then 1
      else null
    end;
    v_effect_key := case v_family
      when 'movement-speed' then 'movementSpeedPercent'
      when 'attack-speed' then 'attackSpeedPercent'
      when 'increased-healing' then 'increasedHealingPercent'
      when 'max-hp' then 'maxHpPercent'
      when 'attack-damage' then 'attackDamagePercent'
      when 'cooldown-reduction' then 'cooldownReductionPercent'
      when 'physical-resistance' then 'physicalResistancePercent'
      when 'elite-damage' then 'eliteDamagePercent'
      when 'emergency-revive' then 'emergencyRevivePercent'
      else null
    end;
    if v_family_cap is null or v_effect_key is null then
      raise exception 'Selected fish has unsupported run-meal metadata.';
    end if;
    v_previous_count := coalesce((v_family_counts ->> v_family)::integer, 0);
    v_previous_total := coalesce((v_family_totals ->> v_family)::numeric, 0);
    v_contribution := v_base_value * v_rarity_factor *
      (0.75 + v_size * 0.5) *
      (1 + v_enchantment_value / 100) *
      (1 + v_meal_bonus / 100) /
      (v_previous_count + 1);
    v_applied_contribution := greatest(
      0,
      least(v_contribution, v_family_cap - v_previous_total)
    );
    v_family_counts := jsonb_set(
      v_family_counts,
      array[v_family],
      to_jsonb(v_previous_count + 1),
      true
    );
    v_family_totals := jsonb_set(
      v_family_totals,
      array[v_family],
      to_jsonb(v_previous_total + v_applied_contribution),
      true
    );

    v_effect := jsonb_build_object(
      'type', 'fish-meal',
      'family', v_family,
      v_effect_key, v_applied_contribution
    );
    if v_enchantment_id is not null then
      v_effect := v_effect || jsonb_build_object(
        'enchantmentId', v_enchantment_id,
        'enchantmentValue', v_enchantment_value
      );
    end if;

    v_canonical_items := v_canonical_items || jsonb_build_array(jsonb_build_object(
      'itemInstanceId', v_item_instance_id,
      'definitionId', v_instance.definition_id,
      'quantity', 1,
      'resolvedEffect', v_effect
    ));
    v_reservation_items := v_reservation_items || jsonb_build_array(jsonb_build_object(
      'itemInstanceId', v_item_instance_id,
      'quantity', 1
    ));
  end loop;

  v_preparation := jsonb_build_object(
    'version', 1,
    'items', v_canonical_items,
    'artifacts', v_artifacts
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
    update public.inventory_reservations as reservation
    set status = 'consumed'
    where reservation.id = v_reservation_id
      and reservation.profile_id = v_profile_id
      and reservation.status = 'active';
    if not found then
      raise exception 'The fish reservation could not be finalized.';
    end if;
  end if;

  return query
  select p_run_id, 'active'::text, v_resolved_at, true;
end;
$$;

grant execute on function public.start_dungeon_run(
  text, bigint, text, text[], bigint, timestamptz, text, text, text, text, jsonb, jsonb
) to authenticated;

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

  -- Scrap from the loadout the run ended with. The grant is idempotent under
  -- its own operation ID, so a retried completion cannot pay it twice.
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

grant execute on function public.complete_dungeon_run(text, text, timestamptz, jsonb)
  to authenticated;

create or replace function public.create_champion_from_run(
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
  v_artifacts jsonb := '[]'::jsonb;
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
    -- The Champion giving way hands its artifacts back to the bag.
    perform public.return_champion_artifacts(v_profile_id, p_replaced_champion_id);
  end if;

  -- The artifacts the run was played with move into the Champion, provided
  -- the run's hold on them is still standing. A hold already released means
  -- they are back in the bag, and a Champion cannot take what it does not
  -- hold.
  if exists (
    select 1
    from public.inventory_reservations as reservation
    where reservation.profile_id = v_profile_id
      and reservation.operation_id = 'artifact-hold:' || p_source_run_id
      and reservation.status = 'active'
  ) then
    v_artifacts := coalesce(v_run.preparation -> 'artifacts', '[]'::jsonb);
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
    ),
    'targetPriorityId', coalesce(
      v_snapshot.payload -> 'gameState' -> 'player' -> 'behaviorController'
        ->> 'targetPriorityId',
      'nearest'
    ),
    'artifacts', v_artifacts
  );

  insert into public.champions (
    id, profile_id, name, source_run_id, content_version, build
  ) values (
    p_champion_id, v_profile_id, p_name, p_source_run_id, p_content_version, v_build
  )
  on conflict on constraint champions_pkey do nothing;

  -- The hold becomes the Champion's: the instances stay at quantity zero,
  -- which is what keeps them out of the bag until the Champion is archived.
  update public.inventory_reservations as reservation
  set status = 'consumed', released_at = now()
  where reservation.profile_id = v_profile_id
    and reservation.operation_id = 'artifact-hold:' || p_source_run_id
    and reservation.status = 'active';

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


-- Archiving a Champion is the one way its artifacts come back.
create or replace function public.archive_champion(p_champion_id text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to archive a Champion.';
  end if;
  update public.champions as champions
  set archived = true
  where champions.id = p_champion_id
    and champions.profile_id = v_profile_id
    and champions.archived = false;
  if found then
    perform public.return_champion_artifacts(v_profile_id, p_champion_id);
  end if;
end;
$$;

grant execute on function public.archive_champion(text) to authenticated;
