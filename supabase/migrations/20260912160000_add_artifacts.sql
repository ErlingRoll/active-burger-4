-- Artifacts: relics dredged up from the Rift.
--
-- An artifact is a permanent, tradeable item a player picks before a dungeon
-- run. It has no downside anywhere on it. Five bases exist, each with one
-- implicit modifier that is the point of the artifact, and on top of that it
-- rolls between one and five modifiers from a shared pool. Its rarity is
-- rolled when it is made, whatever box it came from, and the rarity sets the
-- modifier count. Every modifier rolls a tier (1 strongest, 5 weakest) and a
-- value inside that tier's range, the same shape rods and gear affixes roll.
--
-- The roll happens here, in a before-insert trigger, exactly the way rods
-- roll: a client that decides its own artifact decides its own economy. The
-- tables below are mirrored in `src/content/artifacts/Artifacts.ts`, and
-- `Artifacts.test.ts` parses this file to make sure the two agree.

insert into public.inventory_item_definitions (
  id, category, stackable, max_stack_size, tradeable, bind_on_equip,
  is_unlimited, salvage_essence, payload
) values
  ('artifact-cartographers-compass', 'artifact', false, 1, true, false, false, 0, '{}'::jsonb),
  ('artifact-ember-reliquary', 'artifact', false, 1, true, false, false, 0, '{}'::jsonb),
  ('artifact-echoing-tuning-fork', 'artifact', false, 1, true, false, false, 0, '{}'::jsonb),
  ('artifact-wayfarers-anklet', 'artifact', false, 1, true, false, false, 0, '{}'::jsonb),
  ('artifact-gluttons-kettle', 'artifact', false, 1, true, false, false, 0, '{}'::jsonb)
on conflict (id) do nothing;

-- The value range an artifact effect rolls within, by tier. Implicits and
-- pool modifiers share the lookup because they roll the same way.
create or replace function public.artifact_effect_tier_range(
  p_effect_id text,
  p_tier integer
) returns integer[]
language sql
immutable
security definer set search_path = ''
as $$
  select case
    -- Implicits, one per base.
    when p_effect_id in ('charted-choices') then case p_tier
      when 1 then array[9, 10]
      when 2 then array[8, 8]
      when 3 then array[7, 7]
      when 4 then array[6, 6]
      else array[5, 5]
    end
    when p_effect_id in ('corpse-detonation') then case p_tier
      when 1 then array[44, 50]
      when 2 then array[38, 43]
      when 3 then array[32, 37]
      when 4 then array[26, 31]
      else array[20, 25]
    end
    when p_effect_id in ('skill-echo') then case p_tier
      when 1 then array[49, 55]
      when 2 then array[43, 48]
      when 3 then array[37, 42]
      when 4 then array[31, 36]
      else array[25, 30]
    end
    when p_effect_id in ('momentum') then case p_tier
      when 1 then array[18, 20]
      when 2 then array[15, 17]
      when 3 then array[13, 14]
      when 4 then array[10, 12]
      else array[8, 9]
    end
    when p_effect_id in ('hearty-meal') then case p_tier
      when 1 then array[26, 30]
      when 2 then array[22, 25]
      when 3 then array[18, 21]
      when 4 then array[14, 17]
      else array[10, 13]
    end
    -- The pool.
    when p_effect_id in ('max-hp') then case p_tier
      when 1 then array[14, 18]
      when 2 then array[11, 13]
      when 3 then array[8, 10]
      when 4 then array[6, 7]
      else array[4, 5]
    end
    when p_effect_id in ('movement-speed') then case p_tier
      when 1 then array[10, 12]
      when 2 then array[8, 9]
      when 3 then array[6, 7]
      when 4 then array[4, 5]
      else array[3, 3]
    end
    when p_effect_id in ('attack-speed') then case p_tier
      when 1 then array[12, 15]
      when 2 then array[10, 11]
      when 3 then array[8, 9]
      when 4 then array[6, 7]
      else array[3, 5]
    end
    when p_effect_id in ('cooldown-reduction') then case p_tier
      when 1 then array[12, 15]
      when 2 then array[10, 11]
      when 3 then array[8, 9]
      when 4 then array[6, 7]
      else array[3, 5]
    end
    when p_effect_id in ('crit-chance') then case p_tier
      when 1 then array[6, 8]
      when 2 then array[5, 5]
      when 3 then array[4, 4]
      when 4 then array[3, 3]
      else array[1, 2]
    end
    when p_effect_id in ('melee-leech') then case p_tier
      when 1 then array[3, 3]
      when 2 then array[3, 3]
      when 3 then array[2, 2]
      when 4 then array[2, 2]
      else array[1, 1]
    end
    when p_effect_id in ('kill-cooldown-reset') then case p_tier
      when 1 then array[10, 14]
      when 2 then array[7, 9]
      when 3 then array[5, 6]
      when 4 then array[4, 4]
      else array[2, 3]
    end
    when p_effect_id in ('primed-strike') then case p_tier
      when 1 then array[60, 80]
      when 2 then array[45, 59]
      when 3 then array[35, 44]
      when 4 then array[25, 34]
      else array[15, 24]
    end
    when p_effect_id in ('elite-damage') then case p_tier
      when 1 then array[18, 22]
      when 2 then array[14, 17]
      when 3 then array[11, 13]
      when 4 then array[8, 10]
      else array[5, 7]
    end
    -- The modest ladder: lines that touch every hit.
    when p_effect_id in ('increased-damage', 'experience-gain') then case p_tier
      when 1 then array[15, 20]
      when 2 then array[12, 14]
      when 3 then array[9, 11]
      when 4 then array[7, 8]
      else array[4, 6]
    end
    -- The burst ladder: effects that only fire now and then.
    when p_effect_id in ('crit-multiplier', 'kill-area-surge', 'floor-heal') then case p_tier
      when 1 then array[40, 50]
      when 2 then array[30, 39]
      when 3 then array[22, 29]
      when 4 then array[16, 21]
      else array[10, 15]
    end
    -- The standard ladder: area-of-effect, dot-multiplier, last-stand,
    -- healing-received.
    else case p_tier
      when 1 then array[20, 25]
      when 2 then array[16, 19]
      when 3 then array[12, 15]
      when 4 then array[9, 11]
      else array[5, 8]
    end
  end;
$$;

revoke all on function public.artifact_effect_tier_range(text, integer) from public;

-- A hash of the instance id and a label, folded into [0, p_range). Every roll
-- an artifact makes comes through here so the whole artifact is reproducible
-- from its id, and so the same id can never roll twice.
create or replace function public.artifact_hash_roll(
  p_item_id uuid,
  p_label text,
  p_range integer
) returns integer
language sql
immutable
security definer set search_path = ''
as $$
  select (
    (mod(hashtextextended(p_item_id::text || ':' || p_label, 0), p_range) + p_range) % p_range
  )::integer;
$$;

revoke all on function public.artifact_hash_roll(uuid, text, integer) from public;

create or replace function public.roll_artifact_metadata(
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
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_base_id text;
  v_implicit_id text;
  v_rarity text;
  v_rarity_roll integer;
  v_modifier_count integer;
  v_pool text[] := array[
    'max-hp', 'movement-speed', 'attack-speed', 'cooldown-reduction',
    'area-of-effect', 'crit-chance', 'crit-multiplier', 'increased-damage',
    'dot-multiplier', 'melee-leech', 'kill-area-surge', 'kill-cooldown-reset',
    'primed-strike', 'last-stand', 'floor-heal', 'elite-damage',
    'experience-gain', 'healing-received'
  ];
  v_chosen text[] := '{}'::text[];
  v_modifiers jsonb := '[]'::jsonb;
  v_candidate text;
  v_attempt integer;
  v_tier integer;
  v_tier_roll integer;
  v_range integer[];
  v_value integer;
  v_implicit jsonb;
begin
  -- An artifact that already carries a complete roll keeps it. That is how
  -- one returns from an archived Champion with the same modifiers it left
  -- with, and how a retried grant cannot hand out a different artifact.
  if jsonb_typeof(v_metadata -> 'implicit') = 'object'
    and jsonb_typeof(v_metadata -> 'modifiers') = 'array' then
    return v_metadata;
  end if;

  v_base_id := replace(p_definition_id, 'artifact-', '');
  v_implicit_id := case v_base_id
    when 'cartographers-compass' then 'charted-choices'
    when 'ember-reliquary' then 'corpse-detonation'
    when 'echoing-tuning-fork' then 'skill-echo'
    when 'wayfarers-anklet' then 'momentum'
    when 'gluttons-kettle' then 'hearty-meal'
    else null
  end;
  if v_implicit_id is null then
    raise exception 'Unknown artifact definition %.', p_definition_id;
  end if;

  -- Rarity is rolled per hundred: 40 common, 30 uncommon, 18 rare, 10 epic,
  -- 2 legendary. A rarity already on the metadata is honoured, which is what
  -- lets the development grants ask for a legendary to test with; the grant
  -- RPCs are the only writers and they are admin-gated.
  if v_metadata ->> 'rarity' in ('common', 'uncommon', 'rare', 'epic', 'legendary') then
    v_rarity := v_metadata ->> 'rarity';
  else
    v_rarity_roll := public.artifact_hash_roll(p_item_id, 'rarity', 100);
    v_rarity := case
      when v_rarity_roll < 40 then 'common'
      when v_rarity_roll < 70 then 'uncommon'
      when v_rarity_roll < 88 then 'rare'
      when v_rarity_roll < 98 then 'epic'
      else 'legendary'
    end;
  end if;

  v_modifier_count := case v_rarity
    when 'common' then 1
    when 'uncommon' then 2
    when 'rare' then 3
    when 'epic' then 4
    else 5
  end;

  -- Tiers roll per hundred, best tier rarest: 5, 12, 20, 28, 35.
  v_tier_roll := public.artifact_hash_roll(p_item_id, 'tier:' || v_implicit_id, 100);
  v_tier := case
    when v_tier_roll < 5 then 1
    when v_tier_roll < 17 then 2
    when v_tier_roll < 37 then 3
    when v_tier_roll < 65 then 4
    else 5
  end;
  v_range := public.artifact_effect_tier_range(v_implicit_id, v_tier);
  v_value := v_range[1] + public.artifact_hash_roll(
    p_item_id, 'value:' || v_implicit_id, v_range[2] - v_range[1] + 1
  );
  v_implicit := jsonb_build_object('id', v_implicit_id, 'tier', v_tier, 'value', v_value);

  -- Modifiers are drawn without replacement: each attempt hashes to a pool
  -- entry and a repeat is skipped. Sixty attempts at eighteen entries cannot
  -- realistically fail to find five distinct ones, and the guard below says
  -- so plainly if they ever do.
  for v_attempt in 0..59 loop
    exit when coalesce(array_length(v_chosen, 1), 0) >= v_modifier_count;
    v_candidate := v_pool[
      public.artifact_hash_roll(p_item_id, 'mod:' || v_attempt::text, array_length(v_pool, 1)) + 1
    ];
    continue when v_candidate = any(v_chosen);
    v_chosen := array_append(v_chosen, v_candidate);

    v_tier_roll := public.artifact_hash_roll(p_item_id, 'tier:' || v_candidate, 100);
    v_tier := case
      when v_tier_roll < 5 then 1
      when v_tier_roll < 17 then 2
      when v_tier_roll < 37 then 3
      when v_tier_roll < 65 then 4
      else 5
    end;
    v_range := public.artifact_effect_tier_range(v_candidate, v_tier);
    v_value := v_range[1] + public.artifact_hash_roll(
      p_item_id, 'value:' || v_candidate, v_range[2] - v_range[1] + 1
    );
    v_modifiers := v_modifiers || jsonb_build_object(
      'id', v_candidate, 'tier', v_tier, 'value', v_value
    );
  end loop;
  if coalesce(array_length(v_chosen, 1), 0) < v_modifier_count then
    raise exception 'Artifact roll could not fill % modifiers.', v_modifier_count;
  end if;

  return v_metadata || jsonb_build_object(
    'baseId', v_base_id,
    'rarity', v_rarity,
    'implicit', v_implicit,
    'modifiers', v_modifiers
  );
end;
$$;

revoke all on function public.roll_artifact_metadata(uuid, text, jsonb) from public;

create or replace function public.enrich_artifact_metadata()
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
  if v_category = 'artifact' then
    new.metadata := public.roll_artifact_metadata(new.id, new.definition_id, new.metadata);
  end if;
  return new;
end;
$$;

revoke all on function public.enrich_artifact_metadata() from public;

drop trigger if exists inventory_artifact_metadata_trigger
  on public.inventory_item_instances;
create trigger inventory_artifact_metadata_trigger
before insert on public.inventory_item_instances
for each row
execute function public.enrich_artifact_metadata();

-- Boxes from rare upward can now give an artifact: one draw in twenty from a
-- rare box, about one in eight from an epic, one in four from a legendary.
-- The five bases split that weight evenly. Common and uncommon boxes stay as
-- they were, and fishing never drops one.
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
  -- one to pull out of it. Artifacts take their weight from the fish and bait
  -- entries, never from the rods.
  v_drop_table := case v_box_rarity
    when 'common' then '[["river-minnow",550],["revival-koi",750],["river-worm",900],["glow-grub",950],["starter-fishing-rod",1000]]'::jsonb
    when 'uncommon' then '[["river-minnow",400],["revival-koi",650],["river-worm",850],["glow-grub",950],["starter-fishing-rod",985],["silverline-fishing-rod",1000]]'::jsonb
    when 'rare' then '[["river-minnow",225],["revival-koi",450],["river-worm",700],["glow-grub",850],["moonwater-lure",900],["starter-fishing-rod",932],["silverline-fishing-rod",945],["tideback-fishing-rod",950],["artifact-cartographers-compass",960],["artifact-ember-reliquary",970],["artifact-echoing-tuning-fork",980],["artifact-wayfarers-anklet",990],["artifact-gluttons-kettle",1000]]'::jsonb
    when 'epic' then '[["river-minnow",160],["revival-koi",320],["river-worm",530],["glow-grub",730],["moonwater-lure",830],["starter-fishing-rod",860],["silverline-fishing-rod",873],["tideback-fishing-rod",878],["moonwater-fishing-rod",880],["artifact-cartographers-compass",904],["artifact-ember-reliquary",928],["artifact-echoing-tuning-fork",952],["artifact-wayfarers-anklet",976],["artifact-gluttons-kettle",1000]]'::jsonb
    else '[["river-minnow",50],["revival-koi",150],["river-worm",300],["glow-grub",500],["moonwater-lure",650],["starter-fishing-rod",710],["silverline-fishing-rod",735],["tideback-fishing-rod",745],["moonwater-fishing-rod",749],["starlit-fishing-rod",750],["artifact-cartographers-compass",800],["artifact-ember-reliquary",850],["artifact-echoing-tuning-fork",900],["artifact-wayfarers-anklet",950],["artifact-gluttons-kettle",1000]]'::jsonb
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
    elsif v_result_definition_id like 'artifact-%' then
      -- `enrich_artifact_metadata` rolls the artifact itself on insert. The
      -- box rarity is provenance only: an artifact's own rarity is its own.
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

    -- The reveal reads the metadata the trigger wrote, not the provenance
    -- the box asked for, so an artifact shows its real roll straight away.
    v_result_metadata := v_granted.metadata;

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

-- Salvaging an artifact pays scrap, never Essence, so that boxes cannot
-- become an Essence faucet through the artifacts they drop. The result gains
-- a scrap column; every other item still reports zero scrap and its Essence.
drop function if exists public.salvage_inventory_item(text, uuid, integer);

create function public.salvage_inventory_item(
  p_operation_id text,
  p_item_instance_id uuid,
  p_quantity integer
)
returns table (
  item_instance_id uuid,
  essence_awarded bigint,
  scrap_awarded integer,
  was_processed boolean
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_operation public.inventory_operations%rowtype;
  v_instance public.inventory_item_instances%rowtype;
  v_definition public.inventory_item_definitions%rowtype;
  v_quantity integer;
  v_essence bigint;
  v_scrap integer := 0;
  v_result jsonb;
  v_size numeric;
  v_base_value bigint;
  v_enchantment_bonus integer := 0;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to salvage inventory items.';
  end if;
  if coalesce(length(trim(p_operation_id)), 0) = 0 then
    raise exception 'A non-empty inventory operation ID is required.';
  end if;

  v_operation := public.inventory_claim_operation(
    v_profile_id, p_operation_id, 'salvage',
    jsonb_build_object('itemInstanceId', p_item_instance_id, 'quantity', p_quantity)
  );
  if v_operation.status = 'completed' then
    return query
    select
      (v_operation.result -> 0 ->> 'item_instance_id')::uuid,
      (v_operation.result -> 0 ->> 'essence_awarded')::bigint,
      coalesce((v_operation.result -> 0 ->> 'scrap_awarded')::integer, 0),
      false;
    return;
  end if;

  select * into v_instance
  from public.inventory_item_instances
  where id = p_item_instance_id and profile_id = v_profile_id
  for update;
  if not found or v_instance.quantity < 1 then
    raise exception 'Unknown or unavailable inventory item.';
  end if;
  v_quantity := coalesce(p_quantity, v_instance.quantity);
  if v_quantity < 1 or v_quantity > v_instance.quantity then
    raise exception 'Invalid inventory salvage quantity.';
  end if;

  select * into v_definition
  from public.inventory_item_definitions
  where id = v_instance.definition_id and active;
  if not found then
    raise exception 'Unknown inventory item definition.';
  end if;

  if v_definition.category = 'fish' then
    if jsonb_typeof(v_instance.metadata -> 'sizePercentile') <> 'number' then
      raise exception 'Fish metadata is missing a normalized size.';
    end if;
    v_size := (v_instance.metadata ->> 'sizePercentile')::numeric;
    if v_size < 0 or v_size > 1 then
      raise exception 'Fish metadata contains an invalid normalized size.';
    end if;
    v_enchantment_bonus := case v_instance.metadata ->> 'enchantmentId'
      when 'bright-scales' then 15
      when 'deep-current' then 25
      when 'astral-mark' then 40
      else 0
    end;
    v_base_value := case v_definition.payload ->> 'rarity'
      when 'common' then 2
      when 'uncommon' then 5
      when 'rare' then 10
      when 'epic' then 20
      when 'legendary' then 40
      else null
    end;
    if v_base_value is null then
      raise exception 'Fish definition has an unknown rarity.';
    end if;
    v_essence := floor(
      v_base_value *
      (0.5 + v_size) *
      (1 + v_enchantment_bonus::numeric / 100)
    )::bigint * v_quantity;
  elsif v_definition.category = 'artifact' then
    v_essence := 0;
    v_scrap := case v_instance.metadata ->> 'rarity'
      when 'common' then 2
      when 'uncommon' then 4
      when 'rare' then 8
      when 'epic' then 14
      when 'legendary' then 24
      else null
    end;
    if v_scrap is null then
      raise exception 'Artifact metadata has an unknown rarity.';
    end if;
    v_scrap := v_scrap * v_quantity;
  else
    v_essence := v_definition.salvage_essence * v_quantity;
  end if;

  -- Every branch above should already have produced a number or raised a
  -- specific exception. If a future category or definition slips through
  -- without pricing itself, this is the last chance to say so plainly rather
  -- than letting a null delta reach the wallet.
  if v_essence is null then
    raise exception 'Could not determine a salvage value for %.', v_definition.id;
  end if;

  update public.inventory_item_instances
  set quantity = quantity - v_quantity, updated_at = now()
  where id = p_item_instance_id;

  if v_essence > 0 then
    insert into public.meta_wallets (profile_id)
    values (v_profile_id)
    on conflict (profile_id) do nothing;
    update public.meta_wallets
    set essence_balance = coalesce(essence_balance, 0) + v_essence,
        essence_earned = coalesce(essence_earned, 0) + v_essence,
        updated_at = now()
    where profile_id = v_profile_id;
  end if;

  if v_scrap > 0 then
    perform public.grant_inventory_items(
      'salvage-scrap:' || p_operation_id,
      'system',
      p_operation_id,
      jsonb_build_array(jsonb_build_object(
        'definitionId', 'scrap',
        'quantity', v_scrap,
        'metadata', jsonb_build_object('source', 'artifact-salvage')
      ))
    );
  end if;

  v_result := jsonb_build_array(jsonb_build_object(
    'item_instance_id', p_item_instance_id,
    'essence_awarded', v_essence,
    'scrap_awarded', v_scrap
  ));
  update public.inventory_operations
  set status = 'completed', result = v_result, completed_at = now()
  where profile_id = v_profile_id and operation_id = p_operation_id;

  return query
  select p_item_instance_id, v_essence, v_scrap, true;
end;
$$;

grant execute on function public.salvage_inventory_item(text, uuid, integer)
  to authenticated;
