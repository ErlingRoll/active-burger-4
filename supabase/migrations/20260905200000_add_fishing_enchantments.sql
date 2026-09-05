-- Roll deterministic enchantments for meal-eligible fish and include their
-- value in server-side meal and salvage resolution.

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
  v_enchantment_roll integer;
  v_rarity text;
  v_fish_definition_id text;
  v_size numeric;
  v_box_rarity text;
  v_result jsonb;
  v_enchantment_id text;
  v_enchantment_value integer := 0;
  v_rarity_bonus integer := 0;
  v_bait_rarity_bonus integer := 0;
  v_bait_size_bonus integer := 0;
  v_bait_retention integer := 0;
  v_loot_box_bonus integer := 0;
  v_bait_loot_box_bonus integer := 0;
  v_enchantment_chance integer := 0;
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
  v_enchantment_chance := least(100, greatest(0, coalesce(
    (v_rod_metadata ->> 'enchantmentChancePercent')::integer, 0
  )));

  case v_attempt.bait_definition_id
    when 'river-worm' then
      v_bait_rarity_bonus := 1000;
    when 'glow-grub' then
      v_bait_rarity_bonus := 1800;
      v_bait_size_bonus := 5;
      v_bait_loot_box_bonus := 1;
    when 'moonwater-lure' then
      v_bait_rarity_bonus := 2600;
      v_bait_size_bonus := 10;
      v_bait_loot_box_bonus := 2;
    else
      null;
  end case;

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
  v_roll := least(9999, v_roll + v_bait_rarity_bonus);
  if v_attempt.mode_id = 'manual' and p_manual_success then
    v_roll := least(9999, v_roll + 1500);
  end if;
  v_roll := least(9999, v_roll + v_rarity_bonus);
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
      (v_bait_size_bonus::numeric / 100) +
      case when v_attempt.mode_id = 'manual' and p_manual_success then 0.05 else 0 end
  );

  if v_enchantment_chance > 0 and v_fish_definition_id <> 'revival-koi' then
    v_enchantment_roll := mod(
      hashtextextended(v_attempt.id || ':enchantment', 0),
      100
    )::integer;
    if v_enchantment_roll < 0 then
      v_enchantment_roll := v_enchantment_roll + 100;
    end if;
    if v_enchantment_roll < v_enchantment_chance then
      v_enchantment_roll := mod(
        hashtextextended(v_attempt.id || ':enchantment-type', 0),
        3
      )::integer;
      if v_enchantment_roll < 0 then
        v_enchantment_roll := v_enchantment_roll + 3;
      end if;
      case v_enchantment_roll
        when 0 then
          v_enchantment_id := 'bright-scales';
          v_enchantment_value := 15;
        when 1 then
          v_enchantment_id := 'deep-current';
          v_enchantment_value := 25;
        else
          v_enchantment_id := 'astral-mark';
          v_enchantment_value := 40;
      end case;
    end if;
  end if;

  v_result := jsonb_build_object(
    'itemInstanceId', null,
    'definitionId', v_fish_definition_id,
    'metadata', jsonb_build_object(
      'speciesId', v_fish_definition_id,
      'rarity', v_rarity,
      'sizePercentile', v_size,
      'mode', v_attempt.mode_id,
      'baitDefinitionId', v_attempt.bait_definition_id
    ) || case
      when v_enchantment_id is not null then jsonb_build_object(
        'enchantmentId', v_enchantment_id,
        'enchantmentValue', v_enchantment_value
      )
      else '{}'::jsonb
    end
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
    end) + (v_loot_box_bonus + v_bait_loot_box_bonus) * 10
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

create or replace function public.salvage_inventory_item(
  p_operation_id text,
  p_item_instance_id uuid,
  p_quantity integer
)
returns table (
  item_instance_id uuid,
  essence_awarded bigint,
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
  else
    v_essence := v_definition.salvage_essence * v_quantity;
  end if;

  update public.inventory_item_instances
  set quantity = quantity - v_quantity, updated_at = now()
  where id = p_item_instance_id;

  insert into public.meta_wallets (profile_id)
  values (v_profile_id)
  on conflict (profile_id) do nothing;
  update public.meta_wallets
  set essence_balance = essence_balance + v_essence,
      essence_earned = essence_earned + v_essence,
      updated_at = now()
  where profile_id = v_profile_id;

  v_result := jsonb_build_array(jsonb_build_object(
    'item_instance_id', p_item_instance_id,
    'essence_awarded', v_essence
  ));
  update public.inventory_operations
  set status = 'completed', result = v_result, completed_at = now()
  where profile_id = v_profile_id and operation_id = p_operation_id;

  return query
  select p_item_instance_id, v_essence, true;
end;
$$;

grant execute on function public.salvage_inventory_item(text, uuid, integer)
  to authenticated;
