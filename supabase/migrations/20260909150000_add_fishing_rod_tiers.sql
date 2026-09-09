-- Give the rod ladder real identities instead of one generic stick whose
-- power came from whichever loot box it happened to fall out of. Four new
-- rod tiers join the starter rod, each with its own fixed rarity, and every
-- rod's modifiers now roll a random tier (1 strongest, 5 weakest) and a
-- random value inside that tier's range, the same shape weapon and armor
-- affixes already roll, instead of one value fixed by rarity alone.

insert into public.inventory_item_definitions (
  id, category, stackable, max_stack_size, tradeable, bind_on_equip,
  is_unlimited, salvage_essence, payload
) values
  ('silverline-fishing-rod', 'rod', false, 1, true, true, false, 5, '{}'::jsonb),
  ('tideback-fishing-rod', 'rod', false, 1, true, true, false, 15, '{}'::jsonb),
  ('moonwater-fishing-rod', 'rod', false, 1, true, true, false, 35, '{}'::jsonb),
  ('starlit-fishing-rod', 'rod', false, 1, true, true, false, 75, '{}'::jsonb)
on conflict (id) do nothing;

-- The value range a rod modifier rolls within, by tier. Kept as its own
-- lookup so the roll below reads as "pick a tier, then roll inside it"
-- rather than a wall of duplicated case arithmetic.
create or replace function public.fishing_rod_modifier_tier_range(
  p_modifier_id text,
  p_tier integer
) returns integer[]
language sql
immutable
security definer set search_path = ''
as $$
  select case p_modifier_id
    when 'rarity' then case p_tier
      when 1 then array[13, 15]
      when 2 then array[10, 12]
      when 3 then array[7, 9]
      when 4 then array[4, 6]
      else array[1, 3]
    end
    when 'bait-retention' then case p_tier
      when 1 then array[42, 50]
      when 2 then array[33, 41]
      when 3 then array[24, 32]
      when 4 then array[15, 23]
      else array[6, 14]
    end
    -- speed, loot-box and enchantment share the same single-point ladder.
    else case p_tier
      when 1 then array[5, 5]
      when 2 then array[4, 4]
      when 3 then array[3, 3]
      when 4 then array[2, 2]
      else array[1, 1]
    end
  end;
$$;

revoke all on function public.fishing_rod_modifier_tier_range(text, integer) from public;

drop function if exists public.roll_fishing_rod_metadata(uuid, jsonb);

create or replace function public.roll_fishing_rod_metadata(
  p_item_id uuid,
  p_definition_id text,
  p_metadata jsonb
)
returns jsonb
language plpgsql
immutable
security definer set search_path = ''
as $$
declare
  v_rarity text;
  v_modifier_count integer;
  v_seed integer;
  v_index integer;
  v_candidate text;
  v_modifier_ids text[] := '{}'::text[];
  v_modifier_tiers jsonb := '{}'::jsonb;
  v_tier integer;
  v_range integer[];
  v_span integer;
  v_value integer;
  v_speed_percent integer := 0;
  v_rarity_bonus_percent integer := 0;
  v_bait_retention_percent integer := 0;
  v_loot_box_chance_percent integer := 0;
  v_enchantment_chance_percent integer := 0;
begin
  -- A rod's rarity is a property of which rod it is, not of where it dropped
  -- from: a Moonwater rod is always epic, whether it fell out of an epic box
  -- or a legendary one.
  v_rarity := case p_definition_id
    when 'silverline-fishing-rod' then 'uncommon'
    when 'tideback-fishing-rod' then 'rare'
    when 'moonwater-fishing-rod' then 'epic'
    when 'starlit-fishing-rod' then 'legendary'
    else 'common'
  end;

  v_modifier_count := case v_rarity
    when 'common' then 1
    when 'uncommon' then 2
    when 'rare' then 3
    when 'epic' then 4
    else 5
  end;
  v_seed := mod(hashtextextended(p_item_id::text, 0), 1000000)::integer;
  if v_seed < 0 then
    v_seed := v_seed + 1000000;
  end if;

  for v_index in 0..4 loop
    v_candidate := case mod(v_seed + v_index * 7919, 5)
      when 0 then 'rarity'
      when 1 then 'speed'
      when 2 then 'bait-retention'
      when 3 then 'loot-box'
      else 'enchantment'
    end;
    if not (v_candidate = any(v_modifier_ids)) then
      v_modifier_ids := array_append(v_modifier_ids, v_candidate);

      v_tier := mod(hashtextextended(p_item_id::text || ':tier:' || v_candidate, 0), 5);
      if v_tier < 0 then
        v_tier := v_tier + 5;
      end if;
      v_tier := v_tier + 1;
      v_modifier_tiers := v_modifier_tiers || jsonb_build_object(v_candidate, v_tier);

      v_range := public.fishing_rod_modifier_tier_range(v_candidate, v_tier);
      v_span := v_range[2] - v_range[1] + 1;
      v_value := mod(hashtextextended(p_item_id::text || ':value:' || v_candidate, 0), v_span);
      if v_value < 0 then
        v_value := v_value + v_span;
      end if;
      v_value := v_value + v_range[1];

      case v_candidate
        when 'rarity' then v_rarity_bonus_percent := v_value;
        when 'speed' then v_speed_percent := v_value;
        when 'bait-retention' then v_bait_retention_percent := v_value;
        when 'loot-box' then v_loot_box_chance_percent := v_value;
        else v_enchantment_chance_percent := v_value;
      end case;
    end if;
    if coalesce(array_length(v_modifier_ids, 1), 0) >= v_modifier_count then
      exit;
    end if;
  end loop;

  return p_metadata
    || jsonb_build_object(
      'rarity', v_rarity,
      'modifierIds', to_jsonb(v_modifier_ids),
      'modifierTiers', v_modifier_tiers,
      'speedPercent', v_speed_percent,
      'rarityBonusPercent', v_rarity_bonus_percent,
      'baitRetentionPercent', v_bait_retention_percent,
      'lootBoxChancePercent', v_loot_box_chance_percent,
      'enchantmentChancePercent', v_enchantment_chance_percent
    );
end;
$$;

revoke all on function public.roll_fishing_rod_metadata(uuid, text, jsonb) from public;

create or replace function public.enrich_fishing_rod_metadata()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_category text;
begin
  select category
    into v_category
  from public.inventory_item_definitions
  where id = new.definition_id
    and active;
  if v_category = 'rod' then
    new.metadata := public.roll_fishing_rod_metadata(new.id, new.definition_id, new.metadata);
  end if;
  return new;
end;
$$;

revoke all on function public.enrich_fishing_rod_metadata() from public;

-- The trigger itself is unchanged; recreating the function it points at is
-- enough, but re-declaring it here keeps this migration self-contained.
drop trigger if exists inventory_fishing_rod_metadata_trigger
  on public.inventory_item_instances;
create trigger inventory_fishing_rod_metadata_trigger
before insert on public.inventory_item_instances
for each row
execute function public.enrich_fishing_rod_metadata();

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
  -- A rod never appears in a box below its own rarity, and the weight set
  -- aside for rods is split across every rod tier a box can give, favouring
  -- whichever tier is closest to that box's own.
  v_drop_table := case v_box_rarity
    when 'common' then '[["river-minnow",550],["revival-koi",750],["river-worm",900],["glow-grub",950],["starter-fishing-rod",1000]]'::jsonb
    when 'uncommon' then '[["river-minnow",400],["revival-koi",650],["river-worm",850],["glow-grub",950],["starter-fishing-rod",967],["silverline-fishing-rod",1000]]'::jsonb
    when 'rare' then '[["river-minnow",250],["revival-koi",500],["river-worm",750],["glow-grub",900],["moonwater-lure",950],["starter-fishing-rod",958],["silverline-fishing-rod",975],["tideback-fishing-rod",1000]]'::jsonb
    when 'epic' then '[["river-minnow",200],["revival-koi",400],["river-worm",650],["glow-grub",850],["moonwater-lure",950],["starter-fishing-rod",955],["silverline-fishing-rod",965],["tideback-fishing-rod",980],["moonwater-fishing-rod",1000]]'::jsonb
    else '[["river-minnow",100],["revival-koi",250],["river-worm",450],["glow-grub",700],["moonwater-lure",900],["starter-fishing-rod",907],["silverline-fishing-rod",920],["tideback-fishing-rod",940],["moonwater-fishing-rod",967],["starlit-fishing-rod",1000]]'::jsonb
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
