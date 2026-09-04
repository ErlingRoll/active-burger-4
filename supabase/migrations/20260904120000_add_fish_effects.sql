insert into public.inventory_item_definitions (
  id, category, stackable, max_stack_size, tradeable, bind_on_equip,
  is_unlimited, salvage_essence, payload
) values
  ('reed-darter', 'fish', false, 1, true, false, false, 0,
    '{"rarity":"common","effectFamily":"attack-speed"}'::jsonb),
  ('glassfin-trout', 'fish', false, 1, true, false, false, 0,
    '{"rarity":"common","effectFamily":"increased-healing"}'::jsonb),
  ('lantern-pike', 'fish', false, 1, true, false, false, 0,
    '{"rarity":"uncommon","effectFamily":"attack-damage"}'::jsonb),
  ('tideback-catfish', 'fish', false, 1, true, false, false, 0,
    '{"rarity":"rare","effectFamily":"physical-resistance"}'::jsonb),
  ('comet-eel', 'fish', false, 1, true, false, false, 0,
    '{"rarity":"epic","effectFamily":"elite-damage"}'::jsonb)
on conflict (id) do nothing;

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
  v_roll integer;
  v_box_roll integer;
  v_rarity text;
  v_fish_definition_id text;
  v_size numeric;
  v_box_rarity text;
  v_result jsonb;
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

  if v_attempt.bait_instance_id is not null then
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

  v_roll := mod(v_attempt.seed, 10000)::integer;
  if v_attempt.bait_definition_id = 'river-worm' then
    v_roll := greatest(0, v_roll - 1000);
  end if;
  if v_attempt.mode_id = 'manual' and p_manual_success then
    v_roll := greatest(0, v_roll - 1500);
  end if;
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
  if v_box_roll < (case
    when v_attempt.mode_id = 'manual' and p_manual_success then 50
    else 20
  end) then
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
