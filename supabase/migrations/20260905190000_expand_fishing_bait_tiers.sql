-- Add tiered bait and make each bait effect part of server-authoritative
-- fishing resolution. Bait is also added to explicit loot-box reward pools.

insert into public.inventory_item_definitions (
  id, category, stackable, max_stack_size, tradeable, bind_on_equip,
  is_unlimited, salvage_essence, payload
) values
  ('glow-grub', 'bait', true, 99, true, false, false, 0,
    '{"rarityBonusPercent":18,"sizeBonusPercent":5,"lootBoxChancePercent":1}'::jsonb),
  ('moonwater-lure', 'bait', true, 99, true, false, false, 0,
    '{"rarityBonusPercent":26,"sizeBonusPercent":10,"lootBoxChancePercent":2}'::jsonb)
on conflict (id) do update
set category = excluded.category,
    stackable = excluded.stackable,
    max_stack_size = excluded.max_stack_size,
    tradeable = excluded.tradeable,
    bind_on_equip = excluded.bind_on_equip,
    is_unlimited = excluded.is_unlimited,
    payload = excluded.payload,
    active = true;

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
  v_bait_rarity_bonus integer := 0;
  v_bait_size_bonus integer := 0;
  v_bait_retention integer := 0;
  v_loot_box_bonus integer := 0;
  v_bait_loot_box_bonus integer := 0;
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
  v_result := jsonb_build_object(
    'itemInstanceId', null,
    'definitionId', v_fish_definition_id,
    'metadata', jsonb_build_object(
      'speciesId', v_fish_definition_id,
      'rarity', v_rarity,
      'sizePercentile', v_size,
      'mode', v_attempt.mode_id,
      'baitDefinitionId', v_attempt.bait_definition_id
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
  v_result_definition_id text;
  v_result_quantity integer := 1;
  v_result_metadata jsonb;
  v_roll integer;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to open a loot box.';
  end if;
  if coalesce(length(trim(p_operation_id)), 0) = 0 then
    raise exception 'A non-empty loot-box operation ID is required.';
  end if;

  select * into v_existing
  from public.loot_box_openings
  where profile_id = v_profile_id and operation_id = p_operation_id
  for update;
  if found then
    if v_existing.box_instance_id <> p_box_instance_id then
      raise exception 'Loot-box operation ID was already used for another box.';
    end if;
    return query select
      v_existing.box_instance_id,
      v_existing.box_rarity,
      v_existing.result_item_instance_id,
      v_existing.result_definition_id,
      v_existing.result_quantity,
      v_existing.result_metadata,
      false;
    return;
  end if;

  select * into v_box
  from public.inventory_item_instances
  where id = p_box_instance_id
    and profile_id = v_profile_id
    and quantity > 0
  for update;
  if not found then
    raise exception 'Loot box is not owned or is already empty.';
  end if;

  select * into v_definition
  from public.inventory_item_definitions
  where id = v_box.definition_id
    and category = 'loot-box'
    and active;
  if not found then
    raise exception 'The selected item is not an active loot box.';
  end if;
  v_box_rarity := replace(v_box.definition_id, 'loot-box-', '');
  if v_box_rarity not in ('common', 'uncommon', 'rare', 'epic', 'legendary') then
    raise exception 'Loot box has an invalid rarity.';
  end if;

  v_roll := mod(hashtextextended(p_operation_id, 0), 1000)::integer;
  if v_roll < 0 then
    v_roll := v_roll + 1000;
  end if;

  if v_box_rarity = 'common' then
    if v_roll < 550 then
      v_result_definition_id := 'river-minnow';
    elsif v_roll < 750 then
      v_result_definition_id := 'revival-koi';
    elsif v_roll < 900 then
      v_result_definition_id := 'river-worm';
    elsif v_roll < 950 then
      v_result_definition_id := 'glow-grub';
    else
      v_result_definition_id := 'starter-fishing-rod';
    end if;
  elsif v_box_rarity = 'uncommon' then
    if v_roll < 400 then
      v_result_definition_id := 'river-minnow';
    elsif v_roll < 650 then
      v_result_definition_id := 'revival-koi';
    elsif v_roll < 850 then
      v_result_definition_id := 'river-worm';
    elsif v_roll < 950 then
      v_result_definition_id := 'glow-grub';
    else
      v_result_definition_id := 'starter-fishing-rod';
    end if;
  elsif v_box_rarity = 'rare' then
    if v_roll < 250 then
      v_result_definition_id := 'river-minnow';
    elsif v_roll < 500 then
      v_result_definition_id := 'revival-koi';
    elsif v_roll < 750 then
      v_result_definition_id := 'river-worm';
    elsif v_roll < 900 then
      v_result_definition_id := 'glow-grub';
    elsif v_roll < 950 then
      v_result_definition_id := 'moonwater-lure';
    else
      v_result_definition_id := 'starter-fishing-rod';
    end if;
  elsif v_box_rarity = 'epic' then
    if v_roll < 200 then
      v_result_definition_id := 'river-minnow';
    elsif v_roll < 400 then
      v_result_definition_id := 'revival-koi';
    elsif v_roll < 650 then
      v_result_definition_id := 'river-worm';
    elsif v_roll < 850 then
      v_result_definition_id := 'glow-grub';
    elsif v_roll < 950 then
      v_result_definition_id := 'moonwater-lure';
    else
      v_result_definition_id := 'starter-fishing-rod';
    end if;
  else
    if v_roll < 100 then
      v_result_definition_id := 'river-minnow';
    elsif v_roll < 250 then
      v_result_definition_id := 'revival-koi';
    elsif v_roll < 450 then
      v_result_definition_id := 'river-worm';
    elsif v_roll < 700 then
      v_result_definition_id := 'glow-grub';
    elsif v_roll < 900 then
      v_result_definition_id := 'moonwater-lure';
    else
      v_result_definition_id := 'starter-fishing-rod';
    end if;
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
    v_result_metadata := jsonb_build_object(
      'rarity', v_box_rarity,
      'modifierIds', '[]'::jsonb
    );
  end if;

  update public.inventory_item_instances
  set quantity = quantity - 1, updated_at = now()
  where id = p_box_instance_id;

  select * into v_granted
  from public.grant_inventory_items(
    'loot-box:' || p_operation_id,
    'loot-box',
    p_operation_id,
    jsonb_build_array(jsonb_build_object(
      'definitionId', v_result_definition_id,
      'quantity', v_result_quantity,
      'metadata', v_result_metadata
    ))
  )
  limit 1;

  insert into public.loot_box_openings (
    profile_id, operation_id, box_instance_id, box_rarity,
    result_item_instance_id, result_definition_id, result_quantity, result_metadata
  ) values (
    v_profile_id, p_operation_id, p_box_instance_id, v_box_rarity,
    v_granted.item_instance_id, v_result_definition_id, v_result_quantity, v_result_metadata
  );

  return query select
    p_box_instance_id,
    v_box_rarity,
    v_granted.item_instance_id,
    v_result_definition_id,
    v_result_quantity,
    v_result_metadata,
    true;
end;
$$;

grant execute on function public.open_loot_box(text, uuid)
  to authenticated;
