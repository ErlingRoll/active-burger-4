-- Source-specific fishing attempts. The browser can request a catch, but the
-- generic inventory grant function remains database-internal.

create table public.fishing_attempts (
  id text primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  seed bigint not null,
  spot_id text not null,
  bait_definition_id text not null,
  rod_instance_id uuid references public.inventory_item_instances (id),
  status text not null default 'completed' check (status = 'completed'),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  completed_at timestamptz not null default now()
);

create index fishing_attempts_profile_created_idx
  on public.fishing_attempts (profile_id, created_at desc);

alter table public.fishing_attempts enable row level security;

create policy "Fishing attempts are readable by their owner"
on public.fishing_attempts for select to authenticated
using ((select auth.uid()) = profile_id);

grant select on public.fishing_attempts to authenticated;

create function public.start_fishing_attempt(
  p_attempt_id text,
  p_seed bigint,
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
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to fish.';
  end if;
  if coalesce(length(trim(p_attempt_id)), 0) = 0 then
    raise exception 'A non-empty fishing attempt ID is required.';
  end if;
  if p_seed is null then
    raise exception 'A fishing seed is required.';
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
    return query select
      p_attempt_id,
      (v_existing.result ->> 'itemInstanceId')::uuid,
      v_existing.result ->> 'definitionId',
      v_existing.result -> 'metadata',
      false;
    return;
  end if;

  -- Basic bait is unlimited. The first spot always catches a common minnow;
  -- the seed determines its normalized size without using database randomness.
  v_seed := mod(p_seed, 4294967296);
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
    p_attempt_id, v_profile_id, p_seed, p_spot_id, p_bait_definition_id, p_rod_instance_id, v_result
  );

  return query select
    p_attempt_id,
    v_granted.item_instance_id,
    'river-minnow'::text,
    v_result -> 'metadata',
    true;
end;
$$;

grant execute on function public.start_fishing_attempt(text, bigint, text, text, uuid)
  to authenticated;
