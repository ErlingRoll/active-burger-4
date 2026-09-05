-- Store the complete fish meal contract in database content and resolve it
-- from owned inventory metadata during run creation.

update public.inventory_item_definitions as definitions
set payload = coalesce(definitions.payload, '{}'::jsonb) || case definitions.id
  when 'river-minnow' then
    '{"rarity":"common","effectFamily":"movement-speed","baseValue":2,"runMealEligible":true}'::jsonb
  when 'reed-darter' then
    '{"rarity":"common","effectFamily":"attack-speed","baseValue":3,"runMealEligible":true}'::jsonb
  when 'glassfin-trout' then
    '{"rarity":"common","effectFamily":"increased-healing","baseValue":5,"runMealEligible":true}'::jsonb
  when 'silver-perch' then
    '{"rarity":"uncommon","effectFamily":"max-hp","baseValue":4,"runMealEligible":true}'::jsonb
  when 'lantern-pike' then
    '{"rarity":"uncommon","effectFamily":"attack-damage","baseValue":3,"runMealEligible":true}'::jsonb
  when 'moon-carp' then
    '{"rarity":"rare","effectFamily":"cooldown-reduction","baseValue":5,"runMealEligible":true}'::jsonb
  when 'tideback-catfish' then
    '{"rarity":"rare","effectFamily":"physical-resistance","baseValue":4,"runMealEligible":true}'::jsonb
  when 'revival-koi' then
    '{"rarity":"epic","effectFamily":"abyss-exhaustion","baseValue":4,"runMealEligible":false}'::jsonb
  when 'comet-eel' then
    '{"rarity":"epic","effectFamily":"elite-damage","baseValue":8,"runMealEligible":true}'::jsonb
  when 'star-koi' then
    '{"rarity":"legendary","effectFamily":"emergency-revive","baseValue":20,"runMealEligible":true}'::jsonb
  else '{}'::jsonb
end
where definitions.category = 'fish'
  and definitions.id in (
    'river-minnow',
    'reed-darter',
    'glassfin-trout',
    'silver-perch',
    'lantern-pike',
    'moon-carp',
    'tideback-catfish',
    'revival-koi',
    'comet-eel',
    'star-koi'
  );

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
      (1 + v_enchantment_value / 100) /
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

  return query
  select p_run_id, 'active'::text, v_resolved_at, true;
end;
$$;

grant execute on function public.start_dungeon_run(
  text, bigint, text, text[], integer, timestamptz, text, text, text, text, jsonb, jsonb
) to authenticated;
