-- The Rift anchor and the Smokehouse, and the two materials that feed them.
--
-- Each building consumes one system's output and produces another system's
-- input, which is the test camp.md sets for every building.
--
-- Rift shards come out of the Abyss: every completed floor pays a few beside
-- its box, more the deeper the floor. The Rift anchor is built with them and
-- staffed by an exhausted Champion, who rests there faster than by the fire:
-- each hour at the anchor takes minutes off its own exhaustion, at a rate the
-- anchor's level and the Champion's sheet set. That makes exhaustion a
-- resource a player can spend materials and labour against rather than a
-- wall they wait out, and it never removes it: relief is minutes off a timer
-- that is already running.
--
-- Roe comes from gutting a fish, which destroys it. The Smokehouse spends roe
-- to cure a meal fish, raising its enchantment a tier, and the run meal reads
-- that enchantment through the contract it already has. A cured fish is the
-- same fish with a stronger meal effect, so nothing new reaches the
-- simulation.

insert into public.inventory_item_definitions (
  id, category, stackable, max_stack_size, tradeable, bind_on_equip,
  is_unlimited, salvage_essence, payload
) values
  ('rift-shard', 'material', true, 9999, false, false, false, 0, '{}'::jsonb),
  ('roe', 'material', true, 9999, false, false, false, 0, '{}'::jsonb)
on conflict (id) do update
set category = excluded.category,
    stackable = excluded.stackable,
    max_stack_size = excluded.max_stack_size,
    tradeable = excluded.tradeable,
    bind_on_equip = excluded.bind_on_equip,
    is_unlimited = excluded.is_unlimited,
    salvage_essence = excluded.salvage_essence,
    payload = excluded.payload,
    active = true;

alter table public.inventory_operations
  drop constraint inventory_operations_operation_type_check;

alter table public.inventory_operations
  add constraint inventory_operations_operation_type_check
  check (
    operation_type in (
      'grant', 'consume', 'reserve', 'release', 'salvage', 'craft', 'sell', 'buy',
      'camp-claim', 'camp-upgrade', 'camp-gut', 'camp-cure'
    )
  );

-- A job either makes an item or does something to the Champion working it.
alter table public.camp_job_definitions
  alter column output_definition_id drop not null,
  add column effect text not null default 'item'
    check (effect in ('item', 'exhaustion-relief')),
  add constraint camp_job_definitions_output_matches_effect
    check ((effect = 'item') = (output_definition_id is not null));

insert into public.camp_building_definitions (id, name, sort_order, starting_level) values
  ('rift-anchor', 'Rift anchor', 4, 0),
  ('smokehouse', 'Smokehouse', 5, 0)
on conflict (id) do update
set name = excluded.name,
    sort_order = excluded.sort_order,
    starting_level = excluded.starting_level,
    active = true;

insert into public.camp_building_levels (
  building_id, level, cost, accrual_cap_hours, rate_multiplier, job_slots
) values
  ('rift-anchor', 1, '{"timber": 20, "stone": 20, "rift-shard": 8}'::jsonb, null, 1, 1),
  ('rift-anchor', 2, '{"timber": 40, "stone": 40, "rift-shard": 20}'::jsonb, null, 1.5, 2),
  ('rift-anchor', 3, '{"timber": 80, "stone": 80, "rift-shard": 40}'::jsonb, null, 2, 2),
  ('smokehouse', 1, '{"timber": 30, "stone": 30}'::jsonb, null, 1, 0)
on conflict (building_id, level) do update
set cost = excluded.cost,
    accrual_cap_hours = excluded.accrual_cap_hours,
    rate_multiplier = excluded.rate_multiplier,
    job_slots = excluded.job_slots;

-- Thirty minutes of relief an hour at level one, for a Champion whose sheet
-- multiplies to one. Astral gear and chaos skills are at home here.
insert into public.camp_job_definitions (
  id, building_id, output_definition_id, base_rate_per_hour, fit_set_id, fit_tags, effect
) values
  ('anchor-rest', 'rift-anchor', null, 30, 'astral', '{chaos,duration}', 'exhaustion-relief')
on conflict (id) do update
set building_id = excluded.building_id,
    output_definition_id = excluded.output_definition_id,
    base_rate_per_hour = excluded.base_rate_per_hour,
    fit_set_id = excluded.fit_set_id,
    fit_tags = excluded.fit_tags,
    effect = excluded.effect,
    active = true;

/*
 * The Abyss pays rift shards beside its floor box: one a floor, and one
 * more for every five floors down, to six. Rewritten whole with the shard
 * grant added; the box is exactly as it was.
 */
create or replace function public.grant_abyss_floor_loot_box()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_run public.dungeon_runs%rowtype;
  v_existing public.abyss_floor_rewards%rowtype;
  v_granted record;
  v_completed_floor integer;
  v_danger_score integer;
  v_seed bigint;
  v_roll integer;
  v_progress numeric;
  v_common_cutoff integer;
  v_uncommon_cutoff integer;
  v_rare_cutoff integer;
  v_epic_cutoff integer;
  v_rarity text;
  v_shards integer;
begin
  if new.floor_number <= 1 then
    return new;
  end if;

  select * into v_run
  from public.dungeon_runs
  where id = new.run_id;
  if not found or v_run.mode_id <> 'infinite-abyss' then
    return new;
  end if;

  v_completed_floor := new.floor_number - 1;
  select * into v_existing
  from public.abyss_floor_rewards
  where run_id = new.run_id
    and completed_floor = v_completed_floor;
  if found then
    return new;
  end if;

  v_danger_score := greatest(
    0,
    coalesce((new.payload -> 'gameState' -> 'run' ->> 'abyssDangerScore')::integer, 0)
  );
  v_seed := mod(v_run.seed, 4294967296);
  if v_seed < 0 then
    v_seed := v_seed + 4294967296;
  end if;
  v_seed := mod(
    v_seed +
    least(v_completed_floor, 100) * 2654435761 +
    v_danger_score * 97,
    4294967296
  );
  v_roll := mod(v_seed, 10000)::integer;
  v_progress := least(1, v_completed_floor / 100.0);
  v_common_cutoff := floor(8000 - v_progress * 5000)::integer;
  v_uncommon_cutoff := v_common_cutoff + floor(1700 + v_progress * 1000)::integer;
  v_rare_cutoff := v_uncommon_cutoff + floor(300 + v_progress * 1200)::integer;
  v_epic_cutoff := v_rare_cutoff + floor(v_progress * 1500)::integer;
  v_rarity := case
    when v_roll < v_common_cutoff then 'common'
    when v_roll < v_uncommon_cutoff then 'uncommon'
    when v_roll < v_rare_cutoff then 'rare'
    when v_roll < v_epic_cutoff then 'epic'
    else 'legendary'
  end;

  select * into v_granted
  from public.grant_inventory_items(
    'abyss-floor:' || new.run_id || ':' || v_completed_floor,
    'abyss-reward',
    new.run_id || ':' || v_completed_floor,
    jsonb_build_array(jsonb_build_object(
      'definitionId', 'loot-box-' || v_rarity,
      'quantity', 1,
      'metadata', jsonb_build_object(
        'source', 'infinite-abyss',
        'runId', new.run_id,
        'completedFloor', v_completed_floor,
        'boxRarity', v_rarity
      )
    ))
  )
  limit 1;

  v_shards := least(6, 1 + v_completed_floor / 5);
  perform 1 from public.grant_inventory_items(
    'abyss-shards:' || new.run_id || ':' || v_completed_floor,
    'abyss-reward',
    new.run_id || ':' || v_completed_floor,
    jsonb_build_array(jsonb_build_object(
      'definitionId', 'rift-shard',
      'quantity', v_shards,
      'metadata', jsonb_build_object(
        'runId', new.run_id,
        'completedFloor', v_completed_floor
      )
    ))
  );

  insert into public.abyss_floor_rewards (
    run_id, profile_id, completed_floor, box_instance_id, box_rarity
  ) values (
    new.run_id, v_run.profile_id, v_completed_floor,
    v_granted.item_instance_id, v_rarity
  )
  on conflict (run_id, completed_floor) do nothing;
  return new;
end;
$$;

/*
 * The claim, with the anchor's job added. An item job grants its output; a
 * relief job takes its units, as minutes, off the working Champion's own
 * exhaustion, never past now. Rewritten whole with the same signature.
 */
create or replace function public.camp_claim(
  p_profile_id uuid,
  p_operation_id text,
  p_champion_id text
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_operation public.inventory_operations%rowtype;
  v_now timestamptz := now();
  v_cap numeric := public.camp_storehouse_cap_hours(p_profile_id);
  v_assignment public.camp_assignments%rowtype;
  v_rate numeric;
  v_accrual record;
  v_bonus integer;
  v_roll numeric;
  v_job public.camp_job_definitions%rowtype;
  v_paid jsonb := '[]'::jsonb;
begin
  if coalesce(length(trim(p_operation_id)), 0) = 0 then
    raise exception 'A non-empty inventory operation ID is required.';
  end if;

  v_operation := public.inventory_claim_operation(
    p_profile_id, p_operation_id, 'camp-claim',
    jsonb_build_object('championId', p_champion_id)
  );
  if v_operation.status = 'completed' then
    return jsonb_build_object('paid', v_operation.result, 'was_processed', false);
  end if;

  for v_assignment in
    select assignments.*
    from public.camp_assignments as assignments
    where assignments.profile_id = p_profile_id
      and (p_champion_id is null or assignments.champion_id = p_champion_id)
    order by assignments.assigned_at, assignments.champion_id
    for update
  loop
    v_rate := public.camp_assignment_rate_per_hour(v_assignment);
    select * into v_accrual
    from public.camp_accrue(
      v_rate, least(v_assignment.stamina_hours, v_cap), v_assignment.accrued_from, v_now
    );

    v_bonus := 0;
    if v_accrual.units > 0 then
      select jobs.* into v_job
      from public.camp_job_definitions as jobs
      where jobs.id = v_assignment.job_id;

      -- A fraction in [0, 1) from the first eight hex digits of the digest.
      v_roll := ((('x' || substr(md5(p_operation_id || ':' || v_assignment.champion_id), 1, 8))::bit(32)::int)::bigint
        & 4294967295) / 4294967296.0;
      if v_roll < v_assignment.bonus_chance then
        v_bonus := ceil(v_accrual.units * 0.25)::integer;
      end if;

      if v_job.effect = 'exhaustion-relief' then
        update public.champions as champions
        set exhaustion_until = greatest(
          v_now,
          champions.exhaustion_until - make_interval(mins => v_accrual.units + v_bonus)
        )
        where champions.id = v_assignment.champion_id
          and champions.exhaustion_until is not null;
      else
        perform 1 from public.grant_inventory_items(
          p_operation_id || ':' || v_assignment.champion_id,
          'system',
          v_assignment.job_id,
          jsonb_build_array(jsonb_build_object(
            'definitionId', v_job.output_definition_id,
            'quantity', v_accrual.units + v_bonus,
            'metadata', jsonb_build_object(
              'campJobId', v_assignment.job_id,
              'championId', v_assignment.champion_id
            )
          ))
        );
      end if;

      v_paid := v_paid || jsonb_build_object(
        'champion_id', v_assignment.champion_id,
        'job_id', v_assignment.job_id,
        'definition_id', v_job.output_definition_id,
        'effect', v_job.effect,
        'units', v_accrual.units,
        'bonus_units', v_bonus
      );
    end if;

    update public.camp_assignments as assignments
    set accrued_from = v_accrual.accrued_from
    where assignments.champion_id = v_assignment.champion_id;
  end loop;

  update public.inventory_operations as operations
  set status = 'completed', result = v_paid, completed_at = v_now
  where operations.profile_id = p_profile_id
    and operations.operation_id = p_operation_id;

  return jsonb_build_object('paid', v_paid, 'was_processed', true);
end;
$$;

/*
 * The assignment, with one more refusal: a rested Champion has nothing to
 * gain at the anchor, so it is not sent there. Rewritten whole with the
 * same signature.
 */
create or replace function public.assign_champion_to_camp_job(
  p_operation_id text,
  p_champion_id text,
  p_job_id text
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_champion public.champions%rowtype;
  v_job public.camp_job_definitions%rowtype;
  v_building public.camp_building_definitions%rowtype;
  v_existing public.camp_assignments%rowtype;
  v_moving boolean;
  v_source_floor integer;
  v_sheet jsonb;
  v_slots integer;
  v_taken integer;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required.';
  end if;
  if coalesce(length(trim(p_operation_id)), 0) = 0 then
    raise exception 'A non-empty inventory operation ID is required.';
  end if;

  select champions.* into v_champion
  from public.champions as champions
  where champions.id = p_champion_id
    and champions.profile_id = v_profile_id
    and not champions.archived
  for update;
  if not found then
    raise exception 'Champion not found.';
  end if;

  select jobs.* into v_job
  from public.camp_job_definitions as jobs
  where jobs.id = p_job_id and jobs.active;
  if not found then
    raise exception 'Unknown Camp job.';
  end if;
  select definitions.* into v_building
  from public.camp_building_definitions as definitions
  where definitions.id = v_job.building_id;

  select assignments.* into v_existing
  from public.camp_assignments as assignments
  where assignments.champion_id = p_champion_id
  for update;
  v_moving := found;
  if v_moving and v_existing.job_id = p_job_id then
    return public.camp_state_for(v_profile_id);
  end if;

  -- A Champion mid-descent is in the dungeon, not at the fire.
  if exists (
    select 1
    from public.dungeon_runs as runs
    join public.dungeon_run_snapshots as snapshots on snapshots.run_id = runs.id
    where runs.profile_id = v_profile_id
      and runs.status in ('active', 'paused')
      and snapshots.snapshot_kind = 'start'
      and snapshots.payload -> 'runConfig' ->> 'championId' = p_champion_id
  ) then
    raise exception 'This Champion is on an expedition. Finish or forfeit it first.';
  end if;

  if v_job.effect = 'exhaustion-relief'
     and (v_champion.exhaustion_until is null or v_champion.exhaustion_until <= now()) then
    raise exception 'This Champion is rested. The anchor has nothing to give it.';
  end if;

  select coalesce(levels.job_slots, 0) into v_slots
  from public.camp_building_levels as levels
  where levels.building_id = v_job.building_id
    and levels.level = public.camp_building_level(v_profile_id, v_job.building_id);
  select count(*) into v_taken
  from public.camp_assignments as assignments
  join public.camp_job_definitions as jobs on jobs.id = assignments.job_id
  where assignments.profile_id = v_profile_id
    and jobs.building_id = v_job.building_id
    and assignments.champion_id <> p_champion_id;
  if v_taken >= coalesce(v_slots, 0) then
    raise exception 'No room at the %.', coalesce(v_building.name, v_job.building_id);
  end if;

  -- Moving between jobs settles what the old job produced first.
  if v_moving then
    perform public.camp_claim(v_profile_id, p_operation_id || ':settle', p_champion_id);
    delete from public.camp_assignments as assignments
    where assignments.champion_id = p_champion_id;
  end if;

  select least(runs.max_floor, 1000000)::integer into v_source_floor
  from public.dungeon_runs as runs
  where runs.id = v_champion.source_run_id;
  if not found then
    v_source_floor := null;
  end if;
  v_sheet := public.camp_labour_sheet(v_champion.build, v_source_floor, p_job_id);

  insert into public.camp_assignments (
    champion_id, profile_id, job_id, sheet, output, stamina_hours, bonus_chance
  ) values (
    p_champion_id,
    v_profile_id,
    p_job_id,
    v_sheet,
    (v_sheet ->> 'output')::numeric,
    (v_sheet ->> 'staminaHours')::numeric,
    (v_sheet ->> 'bonusChance')::numeric
  );

  return public.camp_state_for(v_profile_id);
end;
$$;

/*
 * Gut a fish for its roe. The fish is destroyed; the roe scales with its
 * rarity and size the way its meal effect would have. Needs the Smokehouse.
 */
create function public.gut_fish_at_smokehouse(
  p_operation_id text,
  p_fish_instance_id uuid
)
returns table (
  definition_id text,
  roe_granted integer,
  was_processed boolean
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_operation public.inventory_operations%rowtype;
  v_fish public.inventory_item_instances%rowtype;
  v_definition public.inventory_item_definitions%rowtype;
  v_size numeric;
  v_roe integer;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required.';
  end if;
  if coalesce(length(trim(p_operation_id)), 0) = 0 then
    raise exception 'A non-empty inventory operation ID is required.';
  end if;
  if public.camp_building_level(v_profile_id, 'smokehouse') < 1 then
    raise exception 'Build the Smokehouse at the Camp first.';
  end if;

  v_operation := public.inventory_claim_operation(
    v_profile_id, p_operation_id, 'camp-gut',
    jsonb_build_object('fishInstanceId', p_fish_instance_id)
  );
  if v_operation.status = 'completed' then
    return query
    select
      v_operation.result -> 0 ->> 'definition_id',
      (v_operation.result -> 0 ->> 'roe_granted')::integer,
      false;
    return;
  end if;

  select instances.* into v_fish
  from public.inventory_item_instances as instances
  where instances.id = p_fish_instance_id
    and instances.profile_id = v_profile_id
    and instances.quantity >= 1
  for update;
  if not found then
    raise exception 'Fish not found.';
  end if;
  select definitions.* into v_definition
  from public.inventory_item_definitions as definitions
  where definitions.id = v_fish.definition_id and definitions.category = 'fish';
  if not found then
    raise exception 'Only a fish can be gutted.';
  end if;

  v_size := least(1, greatest(0, coalesce((v_fish.metadata ->> 'sizePercentile')::numeric, 0.5)));
  v_roe := ceil(
    case coalesce(v_fish.metadata ->> 'rarity', v_definition.payload ->> 'rarity', 'common')
      when 'uncommon' then 2
      when 'rare' then 3
      when 'epic' then 5
      when 'legendary' then 8
      else 1
    end * (0.75 + v_size * 0.5)
  )::integer;

  update public.inventory_item_instances as instances
  set quantity = instances.quantity - 1, updated_at = now()
  where instances.id = v_fish.id;

  perform 1 from public.grant_inventory_items(
    p_operation_id || ':roe',
    'system',
    'smokehouse',
    jsonb_build_array(jsonb_build_object(
      'definitionId', 'roe',
      'quantity', v_roe,
      'metadata', jsonb_build_object('gutted', v_fish.definition_id)
    ))
  );

  update public.inventory_operations as operations
  set status = 'completed',
      result = jsonb_build_array(jsonb_build_object(
        'definition_id', v_fish.definition_id, 'roe_granted', v_roe
      )),
      completed_at = now()
  where operations.profile_id = v_profile_id
    and operations.operation_id = p_operation_id;

  return query select v_fish.definition_id, v_roe, true;
end;
$$;

/*
 * Cure a meal fish with roe, raising its enchantment a tier. The fish keeps
 * its identity; only the enchantment on its metadata changes, which is the
 * field the run meal already reads. Needs the Smokehouse.
 */
create function public.cure_fish_at_smokehouse(
  p_operation_id text,
  p_fish_instance_id uuid
)
returns table (
  definition_id text,
  enchantment_id text,
  roe_spent integer,
  was_processed boolean
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_operation public.inventory_operations%rowtype;
  v_fish public.inventory_item_instances%rowtype;
  v_definition public.inventory_item_definitions%rowtype;
  v_current text;
  v_next text;
  v_value integer;
  v_cost integer;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required.';
  end if;
  if coalesce(length(trim(p_operation_id)), 0) = 0 then
    raise exception 'A non-empty inventory operation ID is required.';
  end if;
  if public.camp_building_level(v_profile_id, 'smokehouse') < 1 then
    raise exception 'Build the Smokehouse at the Camp first.';
  end if;

  v_operation := public.inventory_claim_operation(
    v_profile_id, p_operation_id, 'camp-cure',
    jsonb_build_object('fishInstanceId', p_fish_instance_id)
  );
  if v_operation.status = 'completed' then
    return query
    select
      v_operation.result -> 0 ->> 'definition_id',
      v_operation.result -> 0 ->> 'enchantment_id',
      (v_operation.result -> 0 ->> 'roe_spent')::integer,
      false;
    return;
  end if;

  select instances.* into v_fish
  from public.inventory_item_instances as instances
  where instances.id = p_fish_instance_id
    and instances.profile_id = v_profile_id
    and instances.quantity >= 1
  for update;
  if not found then
    raise exception 'Fish not found.';
  end if;
  select definitions.* into v_definition
  from public.inventory_item_definitions as definitions
  where definitions.id = v_fish.definition_id and definitions.category = 'fish';
  if not found or not coalesce((v_definition.payload ->> 'runMealEligible')::boolean, false) then
    raise exception 'Only a meal fish can be cured.';
  end if;

  -- Bright Scales, then Deep Current, then Astral Mark, at a rising price.
  -- (An if rather than a case: a "when null" compares with equals and never matches.)
  v_current := nullif(v_fish.metadata ->> 'enchantmentId', '');
  if v_current is null then
    v_next := 'bright-scales'; v_value := 15; v_cost := 3;
  elsif v_current = 'bright-scales' then
    v_next := 'deep-current'; v_value := 25; v_cost := 8;
  elsif v_current = 'deep-current' then
    v_next := 'astral-mark'; v_value := 40; v_cost := 16;
  else
    raise exception 'This fish is already cured as far as it goes.';
  end if;

  perform public.camp_consume_material(v_profile_id, 'roe', v_cost);

  update public.inventory_item_instances as instances
  set metadata = instances.metadata || jsonb_build_object(
        'enchantmentId', v_next,
        'enchantmentValue', v_value,
        'curedAt', 'smokehouse'
      ),
      updated_at = now()
  where instances.id = v_fish.id;

  update public.inventory_operations as operations
  set status = 'completed',
      result = jsonb_build_array(jsonb_build_object(
        'definition_id', v_fish.definition_id,
        'enchantment_id', v_next,
        'roe_spent', v_cost
      )),
      completed_at = now()
  where operations.profile_id = v_profile_id
    and operations.operation_id = p_operation_id;

  return query select v_fish.definition_id, v_next, v_cost, true;
end;
$$;

revoke all on function public.gut_fish_at_smokehouse(text, uuid) from public, anon;
revoke all on function public.cure_fish_at_smokehouse(text, uuid) from public, anon;
grant execute on function public.gut_fish_at_smokehouse(text, uuid) to authenticated;
grant execute on function public.cure_fish_at_smokehouse(text, uuid) to authenticated;
