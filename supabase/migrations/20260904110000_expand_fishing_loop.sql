-- Expand the fixed Moonwater Pond into timed auto/manual fishing attempts.
-- The pond is intentionally not selectable; spot_id remains for historical
-- records and is always written as river-bank.

insert into public.inventory_item_definitions (
  id, category, stackable, max_stack_size, tradeable, bind_on_equip,
  is_unlimited, salvage_essence, payload
) values
  ('river-worm', 'bait', true, 99, true, false, false, 0,
    '{"fishingRarityBonus":10}'::jsonb),
  ('silver-perch', 'fish', false, 1, true, false, false, 0,
    '{"rarity":"uncommon"}'::jsonb),
  ('moon-carp', 'fish', false, 1, true, false, false, 0,
    '{"rarity":"rare"}'::jsonb),
  ('star-koi', 'fish', false, 1, true, false, false, 0,
    '{"rarity":"legendary"}'::jsonb)
on conflict (id) do nothing;

alter table public.fishing_attempts
  drop constraint if exists fishing_attempts_status_check;

alter table public.fishing_attempts
  alter column result drop not null,
  alter column completed_at drop not null,
  alter column completed_at drop default,
  alter column status set default 'pending';

alter table public.fishing_attempts
  add column if not exists mode_id text not null default 'auto'
    check (mode_id in ('auto', 'manual')),
  add column if not exists bait_instance_id uuid
    references public.inventory_item_instances (id),
  add column if not exists resolve_at timestamptz not null default now(),
  add column if not exists pity_at timestamptz not null default now(),
  add column if not exists manual_success boolean;

alter table public.fishing_attempts
  add constraint fishing_attempts_status_check
  check (status in ('pending', 'completed'));

drop function if exists public.start_fishing_attempt(text, text, text, uuid);
drop function if exists public.start_fishing_attempt(text, bigint, text, text, uuid);

create function public.begin_fishing_attempt(
  p_attempt_id text,
  p_mode_id text,
  p_bait_definition_id text,
  p_bait_instance_id uuid,
  p_rod_instance_id uuid
)
returns table (
  attempt_id text,
  mode_id text,
  status text,
  resolve_at timestamptz,
  pity_at timestamptz,
  was_processed boolean
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_existing public.fishing_attempts%rowtype;
  v_seed bigint;
  v_wait_seconds integer;
  v_rod_speed integer := 0;
  v_resolve_at timestamptz;
  v_pity_at timestamptz;
  v_inserted_count integer;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to fish.';
  end if;
  if coalesce(length(trim(p_attempt_id)), 0) = 0 then
    raise exception 'A non-empty fishing attempt ID is required.';
  end if;
  if p_mode_id not in ('auto', 'manual') then
    raise exception 'Unknown fishing mode.';
  end if;

  select * into v_existing
  from public.fishing_attempts
  where id = p_attempt_id
  for update;
  if found then
    if v_existing.profile_id <> v_profile_id then
      raise exception 'Fishing attempt ID is already claimed by another profile.';
    end if;
    if v_existing.mode_id <> p_mode_id or
       v_existing.bait_definition_id <> p_bait_definition_id or
       v_existing.bait_instance_id is distinct from p_bait_instance_id or
       v_existing.rod_instance_id is distinct from p_rod_instance_id then
      raise exception 'Fishing attempt ID was already used with different inputs.';
    end if;
    return query select
      v_existing.id,
      v_existing.mode_id,
      v_existing.status,
      v_existing.resolve_at,
      v_existing.pity_at,
      false;
    return;
  end if;

  if p_bait_definition_id = 'basic-bait' then
    if p_bait_instance_id is not null then
      raise exception 'Basic bait does not use an inventory instance.';
    end if;
  elsif not exists (
    select 1
    from public.inventory_item_instances as bait
    join public.inventory_item_definitions as definitions
      on definitions.id = bait.definition_id
    where bait.id = p_bait_instance_id
      and bait.profile_id = v_profile_id
      and bait.definition_id = p_bait_definition_id
      and bait.quantity > 0
      and definitions.category = 'bait'
      and definitions.active
  ) then
    raise exception 'The selected bait is not owned by this profile.';
  end if;
  if p_rod_instance_id is not null then
    select coalesce((rods.metadata ->> 'speedPercent')::integer, 0)
      into v_rod_speed
    from public.inventory_item_instances as rods
    join public.inventory_item_definitions as definitions
      on definitions.id = rods.definition_id
    where rods.id = p_rod_instance_id
      and rods.profile_id = v_profile_id
      and rods.quantity > 0
      and definitions.category = 'rod'
      and definitions.active;
    if not found then
      raise exception 'The selected fishing rod is not owned by this profile.';
    end if;
  end if;

  v_seed := mod(hashtextextended(p_attempt_id, 0), 4294967296);
  if v_seed < 0 then
    v_seed := v_seed + 4294967296;
  end if;
  v_wait_seconds := case
    when p_mode_id = 'manual' then 5 + mod(v_seed, 11)::integer
    else 10 + mod(v_seed, 21)::integer
  end;
  v_wait_seconds := greatest(3, v_wait_seconds - least(v_rod_speed, v_wait_seconds - 3));
  v_resolve_at := now() + make_interval(secs => v_wait_seconds);
  v_pity_at := v_resolve_at + interval '45 seconds';

  insert into public.fishing_attempts (
    id, profile_id, seed, spot_id, bait_definition_id, bait_instance_id,
    rod_instance_id, mode_id, status, result, resolve_at, pity_at
  ) values (
    p_attempt_id, v_profile_id, v_seed, 'river-bank', p_bait_definition_id,
    p_bait_instance_id, p_rod_instance_id, p_mode_id, 'pending', null,
    v_resolve_at,
    v_pity_at
  )
  on conflict (id) do nothing;
  get diagnostics v_inserted_count = row_count;

  if v_inserted_count = 0 then
    select * into v_existing
    from public.fishing_attempts
    where id = p_attempt_id
    for update;
    if v_existing.profile_id <> v_profile_id then
      raise exception 'Fishing attempt ID is already claimed by another profile.';
    end if;
    if v_existing.mode_id <> p_mode_id or
       v_existing.bait_definition_id <> p_bait_definition_id or
       v_existing.bait_instance_id is distinct from p_bait_instance_id or
       v_existing.rod_instance_id is distinct from p_rod_instance_id then
      raise exception 'Fishing attempt ID was already used with different inputs.';
    end if;
    return query select
      v_existing.id,
      v_existing.mode_id,
      v_existing.status,
      v_existing.resolve_at,
      v_existing.pity_at,
      false;
    return;
  end if;

  return query
  select
    p_attempt_id,
    p_mode_id,
    'pending'::text,
    v_resolve_at,
    v_pity_at,
    true;
end;
$$;

create function public.resolve_fishing_attempt(
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

  v_roll := mod(v_attempt.seed, 100)::integer;
  if v_attempt.bait_definition_id = 'river-worm' then
    v_roll := greatest(0, v_roll - 10);
  end if;
  if v_attempt.mode_id = 'manual' and p_manual_success then
    v_roll := greatest(0, v_roll - 15);
  end if;
  v_rarity := case
    when v_roll < 60 then 'common'
    when v_roll < 85 then 'uncommon'
    when v_roll < 96 then 'rare'
    when v_roll < 99 then 'epic'
    else 'legendary'
  end;
  v_fish_definition_id := case v_rarity
    when 'common' then 'river-minnow'
    when 'uncommon' then 'silver-perch'
    when 'rare' then 'moon-carp'
    when 'epic' then 'revival-koi'
    else 'star-koi'
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

grant execute on function public.begin_fishing_attempt(text, text, text, uuid, uuid)
  to authenticated;
grant execute on function public.resolve_fishing_attempt(text, boolean)
  to authenticated;
