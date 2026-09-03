-- Keep fishing randomness server-authoritative and make duplicate requests safe
-- even when the same attempt is submitted concurrently.

drop function public.start_fishing_attempt(text, bigint, text, text, uuid);

create function public.start_fishing_attempt(
  p_attempt_id text,
  p_spot_id text,
  p_bait_definition_id text,
  p_rod_instance_id uuid
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
  v_existing public.fishing_attempts%rowtype;
  v_granted record;
  v_seed bigint;
  v_size numeric;
  v_result jsonb;
  v_inserted_count integer;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to fish.';
  end if;
  if coalesce(length(trim(p_attempt_id)), 0) = 0 then
    raise exception 'A non-empty fishing attempt ID is required.';
  end if;
  if p_spot_id <> 'river-bank' then
    raise exception 'Unknown fishing spot.';
  end if;
  if p_bait_definition_id <> 'basic-bait' then
    raise exception 'The selected bait is not available at this fishing spot.';
  end if;
  if p_rod_instance_id is not null and not exists (
    select 1
    from public.inventory_item_instances as rods
    join public.inventory_item_definitions as definitions
      on definitions.id = rods.definition_id
    where rods.id = p_rod_instance_id
      and rods.profile_id = v_profile_id
      and rods.quantity > 0
      and definitions.category = 'rod'
      and definitions.active
  ) then
    raise exception 'The selected fishing rod is not owned by this profile.';
  end if;

  select * into v_existing
  from public.fishing_attempts
  where id = p_attempt_id
  for update;
  if found then
    if v_existing.profile_id <> v_profile_id then
      raise exception 'Fishing attempt ID is already claimed by another profile.';
    end if;
    if v_existing.spot_id <> p_spot_id or
       v_existing.bait_definition_id <> p_bait_definition_id or
       v_existing.rod_instance_id is distinct from p_rod_instance_id then
      raise exception 'Fishing attempt ID was already used with different inputs.';
    end if;
    return query select
      p_attempt_id,
      (v_existing.result ->> 'itemInstanceId')::uuid,
      v_existing.result ->> 'definitionId',
      v_existing.result -> 'metadata',
      false;
    return;
  end if;

  -- hashtextextended derives a deterministic server-side seed from the
  -- idempotency key, so the browser cannot choose a better catch.
  v_seed := mod(hashtextextended(p_attempt_id, 0), 4294967296);
  if v_seed < 0 then
    v_seed := v_seed + 4294967296;
  end if;
  v_size := 0.1 + (mod(v_seed, 8000)::numeric / 10000);
  v_result := jsonb_build_object(
    'itemInstanceId', null,
    'definitionId', 'river-minnow',
    'metadata', jsonb_build_object(
      'speciesId', 'river-minnow',
      'rarity', 'common',
      'sizePercentile', v_size
    )
  );

  select * into v_granted
  from public.grant_inventory_items(
    'fishing:' || p_attempt_id,
    'fishing',
    p_attempt_id,
    jsonb_build_array(jsonb_build_object(
      'definitionId', 'river-minnow',
      'quantity', 1,
      'metadata', v_result -> 'metadata'
    ))
  )
  limit 1;
  v_result := jsonb_set(v_result, '{itemInstanceId}', to_jsonb(v_granted.item_instance_id));

  insert into public.fishing_attempts (
    id, profile_id, seed, spot_id, bait_definition_id, rod_instance_id, result
  ) values (
    p_attempt_id, v_profile_id, v_seed, p_spot_id, p_bait_definition_id, p_rod_instance_id, v_result
  )
  on conflict (id) do nothing;
  get diagnostics v_inserted_count = row_count;

  if v_inserted_count = 0 then
    select * into v_existing
    from public.fishing_attempts
    where id = p_attempt_id;
    if v_existing.profile_id <> v_profile_id then
      raise exception 'Fishing attempt ID is already claimed by another profile.';
    end if;
    return query select
      p_attempt_id,
      (v_existing.result ->> 'itemInstanceId')::uuid,
      v_existing.result ->> 'definitionId',
      v_existing.result -> 'metadata',
      false;
    return;
  end if;

  return query select
    p_attempt_id,
    v_granted.item_instance_id,
    'river-minnow'::text,
    v_result -> 'metadata',
    true;
end;
$$;

grant execute on function public.start_fishing_attempt(text, text, text, uuid)
  to authenticated;
