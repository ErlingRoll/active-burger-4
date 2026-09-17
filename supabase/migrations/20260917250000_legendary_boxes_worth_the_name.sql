-- Loot boxes worth their rarity.
--
-- A legendary box was four independent draws from a table that was half bait
-- in quantities of one, with the Wooden rod weighted twice as heavily as in an
-- epic box, and an artifact whose own rarity roll ignored the box entirely: a
-- legendary box's artifact was common two times in five and legendary one in
-- fifty. The box was rare and its contents were not.
--
-- Three things change here, all mirrored in `src/loot/LootBoxContents.ts`
-- and held together by `LootBoxContents.test.ts`, which parses this file:
--
--   1. The tables. Rods stay within a tier of the box, fish are the real meal
--      species stamped with their own rarity, consumables come in stacks that
--      grow with the box (the third number on each entry), and the legendary
--      table carries a bundle of rift shards toward the Forge's fee.
--   2. The rules. Each box opens under a rule row: an artifact rarity floor
--      (uncommon from a rare box, rare from an epic, epic from a legendary),
--      a Potential floor for the legendary box's artifacts, a fish size floor
--      and an enchantment chance. The legendary box hands over one artifact
--      before its draws begin.
--   3. The artifact roll honours a `rarityFloor` hint, keeping the weights
--      above the floor in proportion, and the insert trigger honours a
--      `potentialMin` hint. Both hints are consumed by the roll and never
--      reach the stored metadata.

-- ---------------------------------------------------------------------------
-- The artifact roll, from a floor upward.
-- ---------------------------------------------------------------------------

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
  v_rarities text[] := array['common', 'uncommon', 'rare', 'epic', 'legendary'];
  -- Per hundred: 40 common, 30 uncommon, 18 rare, 10 epic, 2 legendary.
  v_rarity_weights integer[] := array[40, 30, 18, 10, 2];
  v_rarity_floor_index integer := 1;
  v_rarity_total integer := 0;
  v_rarity_index integer;
  v_modifier_count integer;
  v_pool text[] := array[
    'max-hp', 'movement-speed', 'attack-speed', 'cooldown-reduction',
    'area-of-effect', 'crit-chance', 'crit-multiplier', 'increased-damage',
    'dot-multiplier', 'melee-leech', 'kill-area-surge', 'kill-cooldown-reset',
    'primed-strike', 'last-stand', 'floor-shield', 'elite-damage',
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

  -- A rarity already on the metadata is honoured, which is what lets the
  -- development grants ask for a legendary to test with; the grant RPCs are
  -- the only writers and they are admin-gated. Otherwise the roll runs from
  -- the floor the box asked for upward, with the weights above the floor
  -- kept in proportion: "epic or better" pays legendary one time in six.
  if v_metadata ->> 'rarity' in ('common', 'uncommon', 'rare', 'epic', 'legendary') then
    v_rarity := v_metadata ->> 'rarity';
  else
    if v_metadata ->> 'rarityFloor' in ('common', 'uncommon', 'rare', 'epic', 'legendary') then
      v_rarity_floor_index := array_position(v_rarities, v_metadata ->> 'rarityFloor');
    end if;
    for v_rarity_index in v_rarity_floor_index..5 loop
      v_rarity_total := v_rarity_total + v_rarity_weights[v_rarity_index];
    end loop;
    v_rarity_roll := public.artifact_hash_roll(p_item_id, 'rarity', v_rarity_total);
    v_rarity := 'legendary';
    for v_rarity_index in v_rarity_floor_index..5 loop
      if v_rarity_roll < v_rarity_weights[v_rarity_index] then
        v_rarity := v_rarities[v_rarity_index];
        exit;
      end if;
      v_rarity_roll := v_rarity_roll - v_rarity_weights[v_rarity_index];
    end loop;
  end if;
  v_metadata := v_metadata - 'rarityFloor';

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

-- ---------------------------------------------------------------------------
-- The insert trigger: Potential from a floor the box may raise.
-- ---------------------------------------------------------------------------

create or replace function public.enrich_artifact_metadata()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_category text;
  v_potential_min integer;
begin
  select definitions.category
    into v_category
  from public.inventory_item_definitions as definitions
  where definitions.id = new.definition_id
    and definitions.active;
  if v_category = 'artifact' then
    -- The floor is read before the roll strips the hints, and clamped to
    -- the range every artifact rolls in, so a hint can raise the floor but
    -- never lift it past the ceiling or below the default.
    v_potential_min := least(100, greatest(30, coalesce(
      (new.metadata ->> 'potentialMin')::integer, 30
    )));
    new.metadata := public.roll_artifact_metadata(new.id, new.definition_id, new.metadata);
    new.metadata := new.metadata - 'potentialMin';
    -- Potential is rolled once, from the same id every other roll comes
    -- from, and honoured when the metadata already carries one: that is how
    -- an artifact keeps its wear through a retried grant.
    if coalesce(jsonb_typeof(new.metadata -> 'potential'), '') <> 'number' then
      new.metadata := new.metadata || jsonb_build_object(
        'potential', v_potential_min + public.artifact_hash_roll(new.id, 'potential', 100 - v_potential_min + 1)
      );
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enrich_artifact_metadata() from public;

-- ---------------------------------------------------------------------------
-- A per-opening roll, labelled: the same shape as `artifact_hash_roll`, keyed
-- by the operation id so one opening stays reproducible from its id alone.
-- The label "1", "2", ... for a draw is the string the old function hashed,
-- so a replay of an opening made before this migration lands where it did.
-- ---------------------------------------------------------------------------

create or replace function public.loot_box_hash_roll(
  p_operation_id text,
  p_label text,
  p_range integer
) returns integer
language sql
immutable
security definer set search_path = ''
as $$
  select (
    (mod(hashtextextended(p_operation_id || ':' || p_label, 0), p_range) + p_range) % p_range
  )::integer;
$$;

revoke all on function public.loot_box_hash_roll(text, text, integer) from public;

-- ---------------------------------------------------------------------------
-- The opening.
-- ---------------------------------------------------------------------------

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
  v_rules jsonb;
  v_entry jsonb;
  v_artifact_bases text[] := array[
    'artifact-cartographers-compass', 'artifact-ember-reliquary',
    'artifact-echoing-tuning-fork', 'artifact-wayfarers-anklet',
    'artifact-gluttons-kettle'
  ];
  v_guaranteed_artifacts integer;
  v_draw_count integer;
  v_draw_index integer;
  v_roll integer;
  v_result_definition_id text;
  v_result_quantity integer;
  v_result_metadata jsonb;
  v_fish_rarity text;
  v_size_floor numeric;
  v_size numeric;
  v_enchantment_chance integer;
  v_enchantment_roll integer;
  v_first_item_instance_id uuid;
  v_first_definition_id text;
  v_first_quantity integer;
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

  -- The drop tables, as [definition id, cumulative cutoff out of 1000,
  -- quantity per draw]. Written as data rather than as a ladder of branches
  -- so that the client's copy in `src/loot/LootBoxContents.ts` can be
  -- checked against this file by a test instead of by whoever happens to
  -- read both.
  --
  -- A rod never appears in a box below its own rarity, nor more than a tier
  -- above it. Fish are the meal species from the rare box up, and stamped
  -- with their own rarity. Consumables come in stacks that grow with the
  -- box. Artifacts take their weight from the fish and bait entries, never
  -- from the rods.
  v_drop_table := case v_box_rarity
    when 'common' then '[["river-minnow",550,1],["revival-koi",750,1],["river-worm",900,1],["glow-grub",950,1],["starter-fishing-rod",1000,1]]'::jsonb
    when 'uncommon' then '[["river-minnow",400,1],["revival-koi",650,1],["river-worm",850,1],["glow-grub",950,1],["starter-fishing-rod",985,1],["silverline-fishing-rod",1000,1]]'::jsonb
    when 'rare' then '[["river-minnow",175,1],["revival-koi",375,1],["moon-carp",425,1],["river-worm",625,2],["glow-grub",805,2],["moonwater-lure",865,2],["silverline-fishing-rod",887,1],["tideback-fishing-rod",905,1],["artifact-cartographers-compass",924,1],["artifact-ember-reliquary",943,1],["artifact-echoing-tuning-fork",962,1],["artifact-wayfarers-anklet",981,1],["artifact-gluttons-kettle",1000,1]]'::jsonb
    when 'epic' then '[["river-minnow",100,1],["revival-koi",250,1],["moon-carp",310,1],["comet-eel",340,1],["river-worm",470,3],["glow-grub",650,3],["moonwater-lure",780,3],["tideback-fishing-rod",804,1],["moonwater-fishing-rod",820,1],["artifact-cartographers-compass",856,1],["artifact-ember-reliquary",892,1],["artifact-echoing-tuning-fork",928,1],["artifact-wayfarers-anklet",964,1],["artifact-gluttons-kettle",1000,1]]'::jsonb
    else '[["revival-koi",100,1],["moon-carp",160,1],["comet-eel",220,1],["star-koi",250,1],["glow-grub",350,5],["moonwater-lure",600,5],["rift-shard",700,8],["moonwater-fishing-rod",740,1],["starlit-fishing-rod",750,1],["artifact-cartographers-compass",800,1],["artifact-ember-reliquary",850,1],["artifact-echoing-tuning-fork",900,1],["artifact-wayfarers-anklet",950,1],["artifact-gluttons-kettle",1000,1]]'::jsonb
  end;

  -- The rules a box opens under: draws from the table, artifacts handed
  -- over before them, the floors under an artifact's rarity and Potential,
  -- and how a fish comes out. Mirrored as `LOOT_BOX_RULES` on the client.
  v_rules := case v_box_rarity
    when 'common' then '{"draws":1,"guaranteedArtifacts":0,"artifactRarityFloor":null,"artifactPotentialMin":null,"fishSizeFloor":0.25,"fishEnchantmentChancePercent":0}'::jsonb
    when 'uncommon' then '{"draws":1,"guaranteedArtifacts":0,"artifactRarityFloor":null,"artifactPotentialMin":null,"fishSizeFloor":0.3,"fishEnchantmentChancePercent":0}'::jsonb
    when 'rare' then '{"draws":2,"guaranteedArtifacts":0,"artifactRarityFloor":"uncommon","artifactPotentialMin":null,"fishSizeFloor":0.4,"fishEnchantmentChancePercent":0}'::jsonb
    when 'epic' then '{"draws":3,"guaranteedArtifacts":0,"artifactRarityFloor":"rare","artifactPotentialMin":null,"fishSizeFloor":0.5,"fishEnchantmentChancePercent":50}'::jsonb
    else '{"draws":3,"guaranteedArtifacts":1,"artifactRarityFloor":"epic","artifactPotentialMin":70,"fishSizeFloor":0.65,"fishEnchantmentChancePercent":100}'::jsonb
  end;
  v_guaranteed_artifacts := (v_rules ->> 'guaranteedArtifacts')::integer;
  v_draw_count := v_guaranteed_artifacts + (v_rules ->> 'draws')::integer;
  v_size_floor := (v_rules ->> 'fishSizeFloor')::numeric;
  v_enchantment_chance := (v_rules ->> 'fishEnchantmentChancePercent')::integer;

  update public.inventory_item_instances as instances
  set quantity = instances.quantity - 1,
      updated_at = now()
  where instances.id = p_box_instance_id;

  for v_draw_index in 1..v_draw_count loop
    -- A per-draw seed, so the draws of one box differ from each other while
    -- the whole opening stays reproducible from its operation ID.
    v_roll := public.loot_box_hash_roll(p_operation_id, v_draw_index::text, 1000);

    v_result_definition_id := null;
    v_result_quantity := 1;
    if v_draw_index <= v_guaranteed_artifacts then
      -- The certain thing, before the draws: a base picked at random and
      -- rolled under the same floors as any artifact from this box.
      v_result_definition_id := v_artifact_bases[
        public.loot_box_hash_roll(p_operation_id, 'guaranteed:' || v_draw_index::text, array_length(v_artifact_bases, 1)) + 1
      ];
    else
      for v_entry in select value from jsonb_array_elements(v_drop_table) loop
        if v_roll < (v_entry ->> 1)::integer then
          v_result_definition_id := v_entry ->> 0;
          v_result_quantity := coalesce((v_entry ->> 2)::integer, 1);
          exit;
        end if;
      end loop;
    end if;
    if v_result_definition_id is null then
      raise exception 'Loot-box drop table did not cover roll %.', v_roll;
    end if;

    if v_result_definition_id in ('river-minnow', 'revival-koi', 'moon-carp', 'comet-eel', 'star-koi') then
      -- A fish carries its species' own rarity, as one from the pond does,
      -- and a size from the box's floor up to 0.95, rolled apart from the
      -- draw so that landing in a species' band says nothing about size.
      v_fish_rarity := case v_result_definition_id
        when 'river-minnow' then 'common'
        when 'moon-carp' then 'rare'
        when 'revival-koi' then 'epic'
        when 'comet-eel' then 'epic'
        else 'legendary'
      end;
      v_size := v_size_floor + (
        public.loot_box_hash_roll(p_operation_id, 'size:' || v_draw_index::text, 1000)::numeric / 1000
      ) * (0.95 - v_size_floor);
      v_result_metadata := jsonb_build_object(
        'speciesId', v_result_definition_id,
        'rarity', v_fish_rarity,
        'sizePercentile', round(v_size, 4),
        'source', 'loot-box',
        'boxRarity', v_box_rarity
      );
      -- A Revival Koi is recovery, not a meal, and the pond never enchants
      -- one either.
      if v_enchantment_chance > 0 and v_result_definition_id <> 'revival-koi' then
        v_enchantment_roll := public.loot_box_hash_roll(p_operation_id, 'enchantment:' || v_draw_index::text, 100);
        if v_enchantment_roll < v_enchantment_chance then
          v_result_metadata := v_result_metadata || case public.loot_box_hash_roll(p_operation_id, 'enchantment-kind:' || v_draw_index::text, 3)
            when 0 then jsonb_build_object('enchantmentId', 'bright-scales', 'enchantmentValue', 15)
            when 1 then jsonb_build_object('enchantmentId', 'deep-current', 'enchantmentValue', 25)
            else jsonb_build_object('enchantmentId', 'astral-mark', 'enchantmentValue', 40)
          end;
        end if;
      end if;
    elsif v_result_definition_id in ('river-worm', 'glow-grub', 'moonwater-lure', 'rift-shard') then
      v_result_metadata := jsonb_build_object(
        'source', 'loot-box',
        'boxRarity', v_box_rarity
      );
    elsif v_result_definition_id like 'artifact-%' then
      -- `enrich_artifact_metadata` rolls the artifact itself on insert, from
      -- the floors the box sets here. The hints are consumed by the roll;
      -- the box rarity stays as provenance.
      v_result_metadata := jsonb_build_object(
        'source', 'loot-box',
        'boxRarity', v_box_rarity
      );
      if jsonb_typeof(v_rules -> 'artifactRarityFloor') = 'string' then
        v_result_metadata := v_result_metadata || jsonb_build_object(
          'rarityFloor', v_rules ->> 'artifactRarityFloor'
        );
      end if;
      if jsonb_typeof(v_rules -> 'artifactPotentialMin') = 'number' then
        v_result_metadata := v_result_metadata || jsonb_build_object(
          'potentialMin', (v_rules ->> 'artifactPotentialMin')::integer
        );
      end if;
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
        'quantity', v_result_quantity,
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
      v_first_quantity := v_result_quantity;
      v_first_metadata := v_result_metadata;

      insert into public.loot_box_openings (
        profile_id, operation_id, box_instance_id, box_rarity,
        result_item_instance_id, result_definition_id, result_quantity, result_metadata
      ) values (
        v_profile_id, p_operation_id, p_box_instance_id, v_box_rarity,
        v_first_item_instance_id, v_first_definition_id, v_first_quantity, v_first_metadata
      )
      returning id into v_opening_id;
    end if;

    insert into public.loot_box_opening_items (
      opening_id, draw_index, item_instance_id, definition_id, quantity, metadata
    ) values (
      v_opening_id, v_draw_index, v_granted.item_instance_id,
      v_result_definition_id, v_result_quantity, v_result_metadata
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

grant execute on function public.open_loot_box(text, uuid) to authenticated;
