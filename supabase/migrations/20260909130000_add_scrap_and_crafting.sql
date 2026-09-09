-- Scrap, and the first thing that spends it.
--
-- Run gear was destroyed with the run that produced it: completing a dungeon
-- wrote Essence and nothing else, so the only permanent trace of a loadout was
-- the number in the wallet. Scrap is what a finished loadout leaves behind, and
-- the first recipe turns it into fishing bait — an output of the dungeon
-- becoming an input to the pond, which is the whole point of having materials
-- at all.
--
-- Only dungeon runs pay out. An Abyss attempt wears a Champion's saved gear,
-- which does not change between attempts, so paying scrap for it would be a
-- faucet the player could run forever with one loadout.

alter table public.inventory_operations
  drop constraint inventory_operations_operation_type_check;

alter table public.inventory_operations
  add constraint inventory_operations_operation_type_check
  check (
    operation_type in ('grant', 'consume', 'reserve', 'release', 'salvage', 'craft')
  );

insert into public.inventory_item_definitions (
  id, category, stackable, max_stack_size, tradeable, bind_on_equip,
  is_unlimited, salvage_essence, payload
) values
  ('scrap', 'material', true, 9999, false, false, false, 0, '{}'::jsonb)
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

-- One input and one output per recipe. A general ingredient table would be
-- guessing at recipes that do not exist yet; widen it when a second shape does.
create table public.inventory_crafting_recipes (
  id text primary key,
  input_definition_id text not null
    references public.inventory_item_definitions (id),
  input_quantity integer not null check (input_quantity >= 1),
  output_definition_id text not null
    references public.inventory_item_definitions (id),
  output_quantity integer not null check (output_quantity >= 1),
  active boolean not null default true
);

alter table public.inventory_crafting_recipes enable row level security;

create policy "Crafting recipes are readable by signed-in players"
on public.inventory_crafting_recipes for select to authenticated
using (true);

grant select on public.inventory_crafting_recipes to authenticated;

insert into public.inventory_crafting_recipes (
  id, input_definition_id, input_quantity, output_definition_id, output_quantity
) values
  ('river-worm-from-scrap', 'scrap', 8, 'river-worm', 1)
on conflict (id) do update
set input_definition_id = excluded.input_definition_id,
    input_quantity = excluded.input_quantity,
    output_definition_id = excluded.output_definition_id,
    output_quantity = excluded.output_quantity,
    active = true;

/*
 * Spend a material, receive the thing it makes.
 *
 * The consume is written here rather than through `consume_inventory_items`
 * because a material is spent by definition and quantity, not by picking
 * instance IDs in the browser: the client asks for a recipe, and the server
 * decides which stacks pay for it. The output goes through
 * `grant_inventory_items` under a derived operation ID, so a retry that arrives
 * after the consume committed still returns the same item rather than making a
 * second one.
 */
create function public.craft_inventory_item(
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
  v_required integer;
  v_produced integer;
  v_remaining integer;
  v_held integer;
  v_stack public.inventory_item_instances%rowtype;
  v_taken integer;
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

  v_required := v_recipe.input_quantity * v_batches;
  v_produced := v_recipe.output_quantity * v_batches;

  select coalesce(sum(instances.quantity), 0) into v_held
  from public.inventory_item_instances as instances
  where instances.profile_id = v_profile_id
    and instances.definition_id = v_recipe.input_definition_id;
  if v_held < v_required then
    raise exception 'Not enough % to craft this.', v_recipe.input_definition_id;
  end if;

  v_remaining := v_required;
  for v_stack in
    select * from public.inventory_item_instances as instances
    where instances.profile_id = v_profile_id
      and instances.definition_id = v_recipe.input_definition_id
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
    raise exception 'Not enough % to craft this.', v_recipe.input_definition_id;
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
    'input_definition_id', v_recipe.input_definition_id,
    'input_spent', v_required,
    'output_definition_id', v_recipe.output_definition_id,
    'output_quantity', v_produced
  ));
  update public.inventory_operations
  set status = 'completed', result = v_result, completed_at = now()
  where profile_id = v_profile_id and operation_id = p_operation_id;

  return query
  select
    v_recipe.id,
    v_recipe.input_definition_id,
    v_required,
    v_recipe.output_definition_id,
    v_produced,
    true;
end;
$$;

grant execute on function public.craft_inventory_item(text, text, integer)
  to authenticated;

/*
 * Completing a dungeon now leaves scrap behind as well as Essence.
 *
 * The amount is read from the equipment on the terminal checkpoint and scales
 * with what each piece was worth, so a run that ended in a full legendary
 * loadout pays for several baits and a run that ended in rags pays for almost
 * none. It is deliberately blind to floor and kill count: those already decide
 * the Essence, and paying twice for the same thing is how a second currency
 * stops meaning anything.
 *
 * Dropped and recreated rather than replaced: the returned table gains a
 * column, which `create or replace function` cannot do.
 */
drop function if exists public.complete_dungeon_run(text, text, timestamptz, jsonb);

create function public.complete_dungeon_run(
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
