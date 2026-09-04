drop function public.begin_fishing_attempt(text, text, text, uuid, uuid);

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
  server_time timestamptz,
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
      clock_timestamp(),
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
      clock_timestamp(),
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
    clock_timestamp(),
    true;
end;
$$;

grant execute on function public.begin_fishing_attempt(text, text, text, uuid, uuid)
  to authenticated;
