-- Complete the fishing MVP rod path. Rod modifiers are rolled once when a rod
-- inventory instance is created and are then read by fishing RPCs only.

create or replace function public.roll_fishing_rod_metadata(
  p_item_id uuid,
  p_metadata jsonb
)
returns jsonb
language plpgsql
immutable
security definer set search_path = ''
as $$
declare
  v_rarity text := coalesce(p_metadata ->> 'rarity', 'common');
  v_modifier_count integer;
  v_seed integer;
  v_index integer;
  v_candidate text;
  v_modifier_ids text[] := '{}'::text[];
  v_speed_percent integer := 0;
  v_rarity_bonus_percent integer := 0;
  v_bait_retention_percent integer := 0;
  v_loot_box_chance_percent integer := 0;
  v_enchantment_chance_percent integer := 0;
begin
  if v_rarity not in ('common', 'uncommon', 'rare', 'epic', 'legendary') then
    v_rarity := 'common';
  end if;

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
    end if;
    if coalesce(array_length(v_modifier_ids, 1), 0) >= v_modifier_count then
      exit;
    end if;
  end loop;

  if 'rarity' = any(v_modifier_ids) then
    v_rarity_bonus_percent := case v_rarity
      when 'common' then 3
      when 'uncommon' then 6
      when 'rare' then 9
      when 'epic' then 12
      else 15
    end;
  end if;
  if 'speed' = any(v_modifier_ids) then
    v_speed_percent := case v_rarity
      when 'common' then 1
      when 'uncommon' then 2
      when 'rare' then 3
      when 'epic' then 4
      else 5
    end;
  end if;
  if 'bait-retention' = any(v_modifier_ids) then
    v_bait_retention_percent := case v_rarity
      when 'common' then 10
      when 'uncommon' then 20
      when 'rare' then 30
      when 'epic' then 40
      else 50
    end;
  end if;
  if 'loot-box' = any(v_modifier_ids) then
    v_loot_box_chance_percent := case v_rarity
      when 'common' then 1
      when 'uncommon' then 2
      when 'rare' then 3
      when 'epic' then 4
      else 5
    end;
  end if;
  if 'enchantment' = any(v_modifier_ids) then
    v_enchantment_chance_percent := case v_rarity
      when 'common' then 1
      when 'uncommon' then 2
      when 'rare' then 3
      when 'epic' then 4
      else 5
    end;
  end if;

  return p_metadata
    || jsonb_build_object(
      'rarity', v_rarity,
      'modifierIds', to_jsonb(v_modifier_ids),
      'speedPercent', v_speed_percent,
      'rarityBonusPercent', v_rarity_bonus_percent,
      'baitRetentionPercent', v_bait_retention_percent,
      'lootBoxChancePercent', v_loot_box_chance_percent,
      'enchantmentChancePercent', v_enchantment_chance_percent
    );
end;
$$;

revoke all on function public.roll_fishing_rod_metadata(uuid, jsonb) from public;

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
    new.metadata := public.roll_fishing_rod_metadata(new.id, new.metadata);
  end if;
  return new;
end;
$$;

revoke all on function public.enrich_fishing_rod_metadata() from public;

drop trigger if exists inventory_fishing_rod_metadata_trigger
  on public.inventory_item_instances;
create trigger inventory_fishing_rod_metadata_trigger
before insert on public.inventory_item_instances
for each row
execute function public.enrich_fishing_rod_metadata();

update public.inventory_item_instances as rods
set metadata = public.roll_fishing_rod_metadata(rods.id, rods.metadata),
    updated_at = now()
from public.inventory_item_definitions as definitions
where definitions.id = rods.definition_id
  and definitions.category = 'rod'
  and definitions.active
  and not (rods.metadata ? 'modifierIds');

create or replace function public.resolve_fishing_attempt(
  p_attempt_id text,
  p_manual_success boolean
)
returns table (
  attempt_id text,
  item_instance_id uuid,
  fish_definition_id text,
  fish_metadata jsonb,
  was_processed boolean
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_attempt public.fishing_attempts%rowtype;
  v_granted record;
  v_consumed record;
  v_rod_metadata jsonb := '{}'::jsonb;
  v_roll integer;
  v_bait_roll integer;
  v_box_roll integer;
  v_rarity text;
  v_fish_definition_id text;
  v_size numeric;
  v_box_rarity text;
  v_result jsonb;
  v_rarity_bonus integer := 0;
  v_bait_retention integer := 0;
  v_loot_box_bonus integer := 0;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to fish.';
  end if;
  if coalesce(length(trim(p_attempt_id)), 0) = 0 then
    raise exception 'A non-empty fishing attempt ID is required.';
  end if;

  select * into v_attempt
  from public.fishing_attempts
  where id = p_attempt_id
    and profile_id = v_profile_id
  for update;
  if not found then
    raise exception 'Fishing attempt was not found.';
  end if;
  if v_attempt.status = 'completed' then
    return query select
      v_attempt.id,
      (v_attempt.result ->> 'itemInstanceId')::uuid,
      v_attempt.result ->> 'definitionId',
      v_attempt.result -> 'metadata',
      false;
    return;
  end if;
  if now() < v_attempt.resolve_at and now() < v_attempt.pity_at then
    raise exception 'Fishing attempt is not ready to resolve.';
  end if;

  if v_attempt.rod_instance_id is not null then
    select coalesce(metadata, '{}'::jsonb)
      into v_rod_metadata
    from public.inventory_item_instances
    where id = v_attempt.rod_instance_id
      and profile_id = v_profile_id;
  end if;
  v_rarity_bonus := least(1500, greatest(0, coalesce(
    (v_rod_metadata ->> 'rarityBonusPercent')::integer, 0
  ) * 100));
  v_bait_retention := least(100, greatest(0, coalesce(
    (v_rod_metadata ->> 'baitRetentionPercent')::integer, 0
  )));
  v_loot_box_bonus := least(100, greatest(0, coalesce(
    (v_rod_metadata ->> 'lootBoxChancePercent')::integer, 0
  )));

  if v_attempt.bait_instance_id is not null then
    v_bait_roll := mod(v_attempt.seed / 10000, 100)::integer;
    if v_bait_roll >= v_bait_retention then
      select * into v_consumed
      from public.consume_inventory_items(
        'fishing-bait:' || v_attempt.id,
        jsonb_build_array(jsonb_build_object(
          'itemInstanceId', v_attempt.bait_instance_id,
          'quantity', 1
        ))
      )
      limit 1;
    end if;
  end if;

  v_roll := mod(v_attempt.seed, 10000)::integer;
  if v_attempt.bait_definition_id = 'river-worm' then
    v_roll := greatest(0, v_roll - 1000);
  end if;
  if v_attempt.mode_id = 'manual' and p_manual_success then
    v_roll := greatest(0, v_roll - 1500);
  end if;
  v_roll := greatest(0, v_roll - v_rarity_bonus);
  v_fish_definition_id := case
    when v_roll < 2900 then 'river-minnow'
    when v_roll < 4400 then 'reed-darter'
    when v_roll < 5600 then 'glassfin-trout'
    when v_roll < 6600 then 'silver-perch'
    when v_roll < 7500 then 'lantern-pike'
    when v_roll < 8300 then 'moon-carp'
    when v_roll < 8900 then 'tideback-catfish'
    when v_roll < 9400 then 'revival-koi'
    when v_roll < 9800 then 'comet-eel'
    else 'star-koi'
  end;
  v_rarity := case v_fish_definition_id
    when 'river-minnow' then 'common'
    when 'reed-darter' then 'common'
    when 'glassfin-trout' then 'common'
    when 'silver-perch' then 'uncommon'
    when 'lantern-pike' then 'uncommon'
    when 'moon-carp' then 'rare'
    when 'tideback-catfish' then 'rare'
    when 'revival-koi' then 'epic'
    when 'comet-eel' then 'epic'
    else 'legendary'
  end;
  v_size := least(
    0.99,
    0.1 + (mod(v_attempt.seed, 8000)::numeric / 10000) +
      case when v_attempt.mode_id = 'manual' and p_manual_success then 0.05 else 0 end
  );
  v_result := jsonb_build_object(
    'itemInstanceId', null,
    'definitionId', v_fish_definition_id,
    'metadata', jsonb_build_object(
      'speciesId', v_fish_definition_id,
      'rarity', v_rarity,
      'sizePercentile', v_size,
      'mode', v_attempt.mode_id
    )
  );

  select * into v_granted
  from public.grant_inventory_items(
    'fishing:' || v_attempt.id,
    'fishing',
    v_attempt.id,
    jsonb_build_array(jsonb_build_object(
      'definitionId', v_fish_definition_id,
      'quantity', 1,
      'metadata', v_result -> 'metadata'
    ))
  )
  limit 1;
  v_result := jsonb_set(v_result, '{itemInstanceId}', to_jsonb(v_granted.item_instance_id));

  v_box_roll := mod(v_attempt.seed / 100, 1000)::integer;
  if v_box_roll < least(
    1000,
    (case
      when v_attempt.mode_id = 'manual' and p_manual_success then 50
      else 20
    end) + v_loot_box_bonus * 10
  ) then
    v_box_rarity := case
      when v_rarity in ('epic', 'legendary') then 'rare'
      when v_rarity = 'rare' then 'uncommon'
      else 'common'
    end;
    perform public.grant_inventory_items(
      'fishing-box:' || v_attempt.id,
      'fishing',
      v_attempt.id,
      jsonb_build_array(jsonb_build_object(
        'definitionId', 'loot-box-' || v_box_rarity,
        'quantity', 1,
        'metadata', jsonb_build_object(
          'source', 'fishing',
          'boxRarity', v_box_rarity
        )
      ))
    );
  end if;

  update public.fishing_attempts
  set status = 'completed',
      result = v_result,
      manual_success = p_manual_success,
      completed_at = now()
  where id = v_attempt.id;

  return query select
    v_attempt.id,
    v_granted.item_instance_id,
    v_fish_definition_id,
    v_result -> 'metadata',
    true;
end;
$$;

grant execute on function public.resolve_fishing_attempt(text, boolean)
  to authenticated;
