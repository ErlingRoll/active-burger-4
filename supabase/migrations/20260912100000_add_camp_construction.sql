-- Construction, and the tackle bench.
--
-- Slice 2 of docs/features/camp_delivery_plan.md. Timber and stone now have
-- somewhere to go: a building's next level is bought with them, immediately,
-- and the Storehouse levels raise the accrual cap while the Woodline and the
-- quarry levels raise the rate and open a second slot. The tackle bench is
-- the second sink and the first building a player starts without: built for
-- timber and stone, it crafts bait from timber and scrap together, cheaper in
-- scrap than the workbench for the same bait.
--
-- Timed construction shortened by labour is real design intent in camp.md,
-- but it is a second accrual model on top of the first; it can be added in
-- its own slice once this one has been played.

alter table public.inventory_operations
  drop constraint inventory_operations_operation_type_check;

alter table public.inventory_operations
  add constraint inventory_operations_operation_type_check
  check (
    operation_type in (
      'grant', 'consume', 'reserve', 'release', 'salvage', 'craft', 'sell', 'buy',
      'camp-claim', 'camp-upgrade'
    )
  );

-- A building a player starts without is at level zero until it is built. The
-- Storehouse, the Woodline and the quarry start at one; the bench at zero.
alter table public.camp_building_definitions
  add column starting_level integer not null default 1 check (starting_level >= 0);

insert into public.camp_building_definitions (id, name, sort_order, starting_level) values
  ('tackle-bench', 'Tackle bench', 3, 0)
on conflict (id) do update
set name = excluded.name,
    sort_order = excluded.sort_order,
    starting_level = excluded.starting_level,
    active = true;

insert into public.camp_building_levels (
  building_id, level, cost, accrual_cap_hours, rate_multiplier, job_slots
) values
  ('tackle-bench', 1, '{"timber": 40, "stone": 20}'::jsonb, null, 1, 0)
on conflict (building_id, level) do update
set cost = excluded.cost,
    accrual_cap_hours = excluded.accrual_cap_hours,
    rate_multiplier = excluded.rate_multiplier,
    job_slots = excluded.job_slots;

create or replace function public.camp_building_level(p_profile_id uuid, p_building_id text)
returns integer
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(
    (select buildings.level
     from public.camp_buildings as buildings
     where buildings.profile_id = p_profile_id
       and buildings.building_id = p_building_id),
    (select definitions.starting_level
     from public.camp_building_definitions as definitions
     where definitions.id = p_building_id),
    1
  );
$$;

/*
 * Spend a material, oldest stack first.
 *
 * The consume is written by definition and quantity rather than by picking
 * instance ids in the browser: the client asks for a recipe or a level, and
 * the server decides which stacks pay for it. Shared by the craft and the
 * upgrade, which used to carry their own copies of this loop.
 */
create function public.camp_consume_material(
  p_profile_id uuid,
  p_definition_id text,
  p_quantity integer
)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_held integer;
  v_remaining integer := p_quantity;
  v_stack public.inventory_item_instances%rowtype;
  v_taken integer;
begin
  if p_quantity <= 0 then
    return;
  end if;
  select coalesce(sum(instances.quantity), 0) into v_held
  from public.inventory_item_instances as instances
  where instances.profile_id = p_profile_id
    and instances.definition_id = p_definition_id;
  if v_held < p_quantity then
    raise exception 'Not enough % for this.', p_definition_id;
  end if;

  for v_stack in
    select * from public.inventory_item_instances as instances
    where instances.profile_id = p_profile_id
      and instances.definition_id = p_definition_id
      and instances.quantity > 0
    order by instances.created_at, instances.id
    for update
  loop
    exit when v_remaining <= 0;
    v_taken := least(v_stack.quantity, v_remaining);
    update public.inventory_item_instances as instances
    set quantity = instances.quantity - v_taken, updated_at = now()
    where instances.id = v_stack.id;
    v_remaining := v_remaining - v_taken;
  end loop;

  if v_remaining > 0 then
    raise exception 'Not enough % for this.', p_definition_id;
  end if;
end;
$$;

revoke all on function public.camp_consume_material(uuid, text, integer)
  from public, anon, authenticated;

/*
 * Buy a building's next level.
 *
 * The level's cost is read from the reference table and consumed here; the
 * client names the building and nothing else. Production pending at the
 * building is settled first, so the new rate applies from the moment of the
 * upgrade and never to hours that were worked at the old one.
 */
create function public.upgrade_camp_building(
  p_operation_id text,
  p_building_id text
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_operation public.inventory_operations%rowtype;
  v_building public.camp_building_definitions%rowtype;
  v_current integer;
  v_next public.camp_building_levels%rowtype;
  v_cost record;
  v_assignment public.camp_assignments%rowtype;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required.';
  end if;
  if coalesce(length(trim(p_operation_id)), 0) = 0 then
    raise exception 'A non-empty inventory operation ID is required.';
  end if;

  select definitions.* into v_building
  from public.camp_building_definitions as definitions
  where definitions.id = p_building_id and definitions.active;
  if not found then
    raise exception 'Unknown Camp building.';
  end if;

  v_operation := public.inventory_claim_operation(
    v_profile_id, p_operation_id, 'camp-upgrade',
    jsonb_build_object('buildingId', p_building_id)
  );
  if v_operation.status = 'completed' then
    return jsonb_build_object(
      'was_processed', false,
      'state', public.camp_state_for(v_profile_id)
    );
  end if;

  v_current := public.camp_building_level(v_profile_id, p_building_id);
  select levels.* into v_next
  from public.camp_building_levels as levels
  where levels.building_id = p_building_id
    and levels.level = v_current + 1;
  if not found then
    raise exception 'The % is already at its highest level.', v_building.name;
  end if;

  for v_assignment in
    select assignments.*
    from public.camp_assignments as assignments
    join public.camp_job_definitions as jobs on jobs.id = assignments.job_id
    where assignments.profile_id = v_profile_id
      and jobs.building_id = p_building_id
  loop
    perform public.camp_claim(
      v_profile_id,
      p_operation_id || ':settle:' || v_assignment.champion_id,
      v_assignment.champion_id
    );
  end loop;

  for v_cost in
    select entries.key as definition_id, entries.value as quantity
    from jsonb_each_text(v_next.cost) as entries
  loop
    if v_cost.quantity !~ '^[1-9][0-9]*$' then
      raise exception 'The cost of the % is misconfigured.', v_building.name;
    end if;
    perform public.camp_consume_material(
      v_profile_id, v_cost.definition_id, v_cost.quantity::integer
    );
  end loop;

  insert into public.camp_buildings (profile_id, building_id, level)
  values (v_profile_id, p_building_id, v_next.level)
  on conflict (profile_id, building_id) do update
  set level = excluded.level;

  update public.inventory_operations as operations
  set status = 'completed',
      result = jsonb_build_array(jsonb_build_object(
        'building_id', p_building_id, 'level', v_next.level
      )),
      completed_at = now()
  where operations.profile_id = v_profile_id
    and operations.operation_id = p_operation_id;

  return jsonb_build_object(
    'was_processed', true,
    'state', public.camp_state_for(v_profile_id)
  );
end;
$$;

revoke all on function public.upgrade_camp_building(text, text) from public, anon;
grant execute on function public.upgrade_camp_building(text, text) to authenticated;

/*
 * Recipes with more than one input, and recipes that need a building.
 *
 * `inputs` is the list the craft consumes; the single-input columns stay as
 * the first entry of it, so nothing that reads them breaks. A recipe with a
 * `camp_building_id` can only be crafted once that building is built.
 */
alter table public.inventory_crafting_recipes
  add column inputs jsonb not null default '[]'::jsonb
    check (jsonb_typeof(inputs) = 'array'),
  add column camp_building_id text
    references public.camp_building_definitions (id);

update public.inventory_crafting_recipes as recipes
set inputs = jsonb_build_array(jsonb_build_object(
  'definitionId', recipes.input_definition_id,
  'quantity', recipes.input_quantity
))
where recipes.inputs = '[]'::jsonb;

-- Cheaper in scrap than the workbench for the same bait, because the timber
-- is the Camp's own and the bench had to be built.
insert into public.inventory_crafting_recipes (
  id, input_definition_id, input_quantity, output_definition_id, output_quantity,
  inputs, camp_building_id
) values
  ('river-worm-at-the-bench', 'timber', 5, 'river-worm', 1,
   '[{"definitionId": "timber", "quantity": 5}, {"definitionId": "scrap", "quantity": 4}]'::jsonb,
   'tackle-bench'),
  ('glow-grub-at-the-bench', 'timber', 15, 'glow-grub', 1,
   '[{"definitionId": "timber", "quantity": 15}, {"definitionId": "scrap", "quantity": 12}]'::jsonb,
   'tackle-bench')
on conflict (id) do update
set input_definition_id = excluded.input_definition_id,
    input_quantity = excluded.input_quantity,
    output_definition_id = excluded.output_definition_id,
    output_quantity = excluded.output_quantity,
    inputs = excluded.inputs,
    camp_building_id = excluded.camp_building_id,
    active = true;

/*
 * The craft, consuming every input in turn. Rewritten whole with the same
 * signature and the same returned columns: the first input's id and spend
 * fill the single-input columns, which is what they were.
 */
create or replace function public.craft_inventory_item(
  p_operation_id text,
  p_recipe_id text,
  p_quantity integer
)
returns table (
  recipe_id text,
  input_definition_id text,
  input_spent integer,
  output_definition_id text,
  output_quantity integer,
  was_processed boolean
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_operation public.inventory_operations%rowtype;
  v_recipe public.inventory_crafting_recipes%rowtype;
  v_batches integer;
  v_produced integer;
  v_input record;
  v_first_definition text;
  v_first_spent integer;
  v_result jsonb;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to craft.';
  end if;
  if coalesce(length(trim(p_operation_id)), 0) = 0 then
    raise exception 'A non-empty inventory operation ID is required.';
  end if;

  v_batches := coalesce(p_quantity, 1);
  if v_batches < 1 or v_batches > 99 then
    raise exception 'Craft quantity must be between 1 and 99.';
  end if;

  v_operation := public.inventory_claim_operation(
    v_profile_id, p_operation_id, 'craft',
    jsonb_build_object('recipeId', p_recipe_id, 'quantity', v_batches)
  );
  if v_operation.status = 'completed' then
    return query
    select
      v_operation.result -> 0 ->> 'recipe_id',
      v_operation.result -> 0 ->> 'input_definition_id',
      (v_operation.result -> 0 ->> 'input_spent')::integer,
      v_operation.result -> 0 ->> 'output_definition_id',
      (v_operation.result -> 0 ->> 'output_quantity')::integer,
      false;
    return;
  end if;

  select recipes.* into v_recipe
  from public.inventory_crafting_recipes as recipes
  where recipes.id = p_recipe_id and recipes.active;
  if not found then
    raise exception 'Unknown crafting recipe.';
  end if;
  if v_recipe.camp_building_id is not null
     and public.camp_building_level(v_profile_id, v_recipe.camp_building_id) < 1 then
    raise exception 'Build the % at the Camp first.', (
      select definitions.name from public.camp_building_definitions as definitions
      where definitions.id = v_recipe.camp_building_id
    );
  end if;

  v_produced := v_recipe.output_quantity * v_batches;

  for v_input in
    select
      entries.entry ->> 'definitionId' as definition_id,
      (entries.entry ->> 'quantity')::integer * v_batches as required
    from jsonb_array_elements(v_recipe.inputs) with ordinality as entries(entry, position)
    order by entries.position
  loop
    if v_first_definition is null then
      v_first_definition := v_input.definition_id;
      v_first_spent := v_input.required;
    end if;
    perform public.camp_consume_material(v_profile_id, v_input.definition_id, v_input.required);
  end loop;
  if v_first_definition is null then
    raise exception 'The recipe has no inputs.';
  end if;

  perform 1 from public.grant_inventory_items(
    p_operation_id || ':output',
    'system',
    p_recipe_id,
    jsonb_build_array(jsonb_build_object(
      'definitionId', v_recipe.output_definition_id,
      'quantity', v_produced,
      'metadata', jsonb_build_object('craftedFrom', p_recipe_id)
    ))
  );

  v_result := jsonb_build_array(jsonb_build_object(
    'recipe_id', v_recipe.id,
    'input_definition_id', v_first_definition,
    'input_spent', v_first_spent,
    'output_definition_id', v_recipe.output_definition_id,
    'output_quantity', v_produced
  ));
  update public.inventory_operations as operations
  set status = 'completed', result = v_result, completed_at = now()
  where operations.profile_id = v_profile_id
    and operations.operation_id = p_operation_id;

  return query
  select
    v_recipe.id,
    v_first_definition,
    v_first_spent,
    v_recipe.output_definition_id,
    v_produced,
    true;
end;
$$;
