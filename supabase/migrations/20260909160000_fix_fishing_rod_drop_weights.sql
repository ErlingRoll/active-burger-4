-- The rod weights the previous migration wrote favoured the highest rod tier
-- a box could give, so a legendary box's best odds among rods were for the
-- Starlit rod rather than its worst. That reads backwards: the point of a
-- legendary rod is that pulling one is rare, even out of the one box that can
-- give it. Rod weight within a box now splits the way rarity itself already
-- does across the game (`RARITY_WEIGHTS`), so the higher a rod's tier the
-- smaller its slice.

create or replace function public.open_loot_box(
  p_operation_id text,
  p_box_instance_id uuid
)
returns table (
  box_instance_id uuid,
  box_rarity text,
  item_instance_id uuid,
  definition_id text,
  quantity integer,
  metadata jsonb,
  was_processed boolean
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_existing public.loot_box_openings%rowtype;
  v_box public.inventory_item_instances%rowtype;
  v_definition public.inventory_item_definitions%rowtype;
  v_granted record;
  v_box_rarity text;
  v_opening_id bigint;
  v_drop_table jsonb;
  v_entry jsonb;
  v_draw_count integer;
  v_draw_index integer;
  v_roll integer;
  v_result_definition_id text;
  v_result_metadata jsonb;
  v_first_item_instance_id uuid;
  v_first_definition_id text;
  v_first_metadata jsonb;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to open a loot box.';
  end if;
  if coalesce(length(trim(p_operation_id)), 0) = 0 then
    raise exception 'A non-empty loot-box operation ID is required.';
  end if;

  select openings.* into v_existing
  from public.loot_box_openings as openings
  where openings.profile_id = v_profile_id
    and openings.operation_id = p_operation_id
  for update;
  if found then
    if v_existing.box_instance_id <> p_box_instance_id then
      raise exception 'Loot-box operation ID was already used for another box.';
    end if;
    return query select
      v_existing.box_instance_id,
      v_existing.box_rarity,
      items.item_instance_id,
      items.definition_id,
      items.quantity,
      items.metadata,
      false
    from public.loot_box_opening_items as items
    where items.opening_id = v_existing.id
    order by items.draw_index;
    return;
  end if;

  select instances.* into v_box
  from public.inventory_item_instances as instances
  where instances.id = p_box_instance_id
    and instances.profile_id = v_profile_id
    and instances.quantity > 0
  for update;
  if not found then
    raise exception 'Loot box is not owned or is already empty.';
  end if;

  select definitions.* into v_definition
  from public.inventory_item_definitions as definitions
  where definitions.id = v_box.definition_id
    and definitions.category = 'loot-box'
    and definitions.active;
  if not found then
    raise exception 'The selected item is not an active loot box.';
  end if;
  v_box_rarity := replace(v_box.definition_id, 'loot-box-', '');
  if v_box_rarity not in ('common', 'uncommon', 'rare', 'epic', 'legendary') then
    raise exception 'Loot box has an invalid rarity.';
  end if;

  -- The drop tables, as [definition id, cumulative cutoff out of 1000]. Written
  -- as data rather than as a ladder of branches so that the client's copy in
  -- `src/loot/LootBoxContents.ts` can be checked against this file by a test
  -- instead of by whoever happens to read both.
  --
  -- A rod never appears in a box below its own rarity. Within a box, the
  -- weight set aside for rods splits the way `RARITY_WEIGHTS` already splits
  -- rarity itself, so the highest rod tier a box can give is still the rarest
  -- one to pull out of it.
  v_drop_table := case v_box_rarity
    when 'common' then '[["river-minnow",550],["revival-koi",750],["river-worm",900],["glow-grub",950],["starter-fishing-rod",1000]]'::jsonb
    when 'uncommon' then '[["river-minnow",400],["revival-koi",650],["river-worm",850],["glow-grub",950],["starter-fishing-rod",985],["silverline-fishing-rod",1000]]'::jsonb
    when 'rare' then '[["river-minnow",250],["revival-koi",500],["river-worm",750],["glow-grub",900],["moonwater-lure",950],["starter-fishing-rod",982],["silverline-fishing-rod",995],["tideback-fishing-rod",1000]]'::jsonb
    when 'epic' then '[["river-minnow",200],["revival-koi",400],["river-worm",650],["glow-grub",850],["moonwater-lure",950],["starter-fishing-rod",980],["silverline-fishing-rod",993],["tideback-fishing-rod",998],["moonwater-fishing-rod",1000]]'::jsonb
    else '[["river-minnow",100],["revival-koi",250],["river-worm",450],["glow-grub",700],["moonwater-lure",900],["starter-fishing-rod",960],["silverline-fishing-rod",985],["tideback-fishing-rod",995],["moonwater-fishing-rod",999],["starlit-fishing-rod",1000]]'::jsonb
  end;

  -- How many draws a box of each rarity is worth.
  v_draw_count := case v_box_rarity
    when 'common' then 1
    when 'uncommon' then 1
    when 'rare' then 2
    when 'epic' then 3
    else 4
  end;

  update public.inventory_item_instances as instances
  set quantity = instances.quantity - 1,
      updated_at = now()
  where instances.id = p_box_instance_id;

  for v_draw_index in 1..v_draw_count loop
    -- A per-draw seed, so the draws of one box differ from each other while
    -- the whole opening stays reproducible from its operation ID.
    v_roll := mod(
      hashtextextended(p_operation_id || ':' || v_draw_index::text, 0),
      1000
    )::integer;
    if v_roll < 0 then
      v_roll := v_roll + 1000;
    end if;

    v_result_definition_id := null;
    for v_entry in select value from jsonb_array_elements(v_drop_table) loop
      if v_roll < (v_entry ->> 1)::integer then
        v_result_definition_id := v_entry ->> 0;
        exit;
      end if;
    end loop;
    if v_result_definition_id is null then
      raise exception 'Loot-box drop table did not cover roll %.', v_roll;
    end if;

    if v_result_definition_id in ('river-minnow', 'revival-koi') then
      v_result_metadata := jsonb_build_object(
        'speciesId', v_result_definition_id,
        'rarity', v_box_rarity,
        'sizePercentile', 0.25 + (v_roll::numeric / 1000) * 0.7
      );
    elsif v_result_definition_id in ('river-worm', 'glow-grub', 'moonwater-lure') then
      v_result_metadata := jsonb_build_object(
        'source', 'loot-box',
        'boxRarity', v_box_rarity
      );
    else
      -- A rod. `enrich_fishing_rod_metadata` overwrites this on insert with
      -- the rod's own fixed rarity and freshly rolled modifiers, so the box
      -- rarity recorded here is provenance only.
      v_result_metadata := jsonb_build_object(
        'source', 'loot-box',
        'boxRarity', v_box_rarity,
        'modifierIds', '[]'::jsonb
      );
    end if;

    -- One grant call per draw, each with its own operation ID. Granting the
    -- whole array at once would return the rows without saying which input
    -- produced which, and two draws of the same item are indistinguishable.
    select granted.* into v_granted
    from public.grant_inventory_items(
      'loot-box:' || p_operation_id || ':' || v_draw_index::text,
      'loot-box',
      p_operation_id,
      jsonb_build_array(jsonb_build_object(
        'definitionId', v_result_definition_id,
        'quantity', 1,
        'metadata', v_result_metadata
      ))
    ) as granted
    limit 1;

    if v_draw_index = 1 then
      v_first_item_instance_id := v_granted.item_instance_id;
      v_first_definition_id := v_result_definition_id;
      v_first_metadata := v_result_metadata;

      insert into public.loot_box_openings (
        profile_id, operation_id, box_instance_id, box_rarity,
        result_item_instance_id, result_definition_id, result_quantity, result_metadata
      ) values (
        v_profile_id, p_operation_id, p_box_instance_id, v_box_rarity,
        v_first_item_instance_id, v_first_definition_id, 1, v_first_metadata
      )
      returning id into v_opening_id;
    end if;

    insert into public.loot_box_opening_items (
      opening_id, draw_index, item_instance_id, definition_id, quantity, metadata
    ) values (
      v_opening_id, v_draw_index, v_granted.item_instance_id,
      v_result_definition_id, 1, v_result_metadata
    );
  end loop;

  return query select
    p_box_instance_id,
    v_box_rarity,
    items.item_instance_id,
    items.definition_id,
    items.quantity,
    items.metadata,
    true
  from public.loot_box_opening_items as items
  where items.opening_id = v_opening_id
  order by items.draw_index;
end;
$$;

grant execute on function public.open_loot_box(text, uuid)
  to authenticated;
