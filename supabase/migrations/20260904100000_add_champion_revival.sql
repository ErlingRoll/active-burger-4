-- Server-authoritative Champion exhaustion recovery using eligible fish.

create table public.champion_revival_operations (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  operation_id text not null,
  champion_id text not null,
  fish_instance_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  exhaustion_reduction_seconds integer not null default 0
    check (exhaustion_reduction_seconds >= 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (profile_id, operation_id)
);

alter table public.champion_revival_operations enable row level security;

create policy "Champion revival operations are readable by their owner"
on public.champion_revival_operations for select to authenticated
using ((select auth.uid()) = profile_id);

grant select on public.champion_revival_operations to authenticated;

create function public.revive_champion_with_fish(
  p_operation_id text,
  p_champion_id text,
  p_fish_instance_id uuid
)
returns table (
  id text,
  name text,
  source_run_id text,
  content_version text,
  build jsonb,
  exhaustion_until timestamptz,
  archived boolean,
  created_at timestamptz,
  fish_instance_id uuid,
  exhaustion_reduction_seconds integer,
  was_processed boolean
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_operation public.champion_revival_operations%rowtype;
  v_champion public.champions%rowtype;
  v_fish public.inventory_item_instances%rowtype;
  v_rarity_factor numeric;
  v_size_factor numeric;
  v_remaining_seconds integer;
  v_reduction integer;
  v_new_exhaustion timestamptz;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to revive a Champion.';
  end if;
  if coalesce(length(trim(p_operation_id)), 0) = 0 then
    raise exception 'A non-empty revival operation ID is required.';
  end if;

  insert into public.champion_revival_operations (
    profile_id, operation_id, champion_id, fish_instance_id
  ) values (
    v_profile_id, p_operation_id, p_champion_id, p_fish_instance_id
  )
  on conflict (profile_id, operation_id) do nothing;

  select * into v_operation
  from public.champion_revival_operations
  where profile_id = v_profile_id and operation_id = p_operation_id
  for update;
  if v_operation.champion_id <> p_champion_id or
     v_operation.fish_instance_id <> p_fish_instance_id then
    raise exception 'Revival operation ID was already used with different inputs.';
  end if;
  if v_operation.status = 'completed' then
    select * into v_champion
    from public.champions
    where id = p_champion_id and profile_id = v_profile_id;
    return query select
      v_champion.id, v_champion.name, v_champion.source_run_id,
      v_champion.content_version, v_champion.build, v_champion.exhaustion_until,
      v_champion.archived, v_champion.created_at, p_fish_instance_id,
      v_operation.exhaustion_reduction_seconds, false;
    return;
  end if;

  select * into v_champion
  from public.champions
  where id = p_champion_id and profile_id = v_profile_id
  for update;
  if not found or v_champion.archived then
    raise exception 'Champion was not found or is archived.';
  end if;
  if v_champion.exhaustion_until is null or v_champion.exhaustion_until <= now() then
    raise exception 'Champion is not currently exhausted.';
  end if;

  select * into v_fish
  from public.inventory_item_instances as instances
  where instances.id = p_fish_instance_id
    and instances.profile_id = v_profile_id
    and instances.quantity > 0
    and instances.definition_id = 'revival-koi'
  for update;
  if not found then
    raise exception 'An available Revival Koi is required.';
  end if;

  v_rarity_factor := case v_fish.metadata ->> 'rarity'
    when 'uncommon' then 1.5
    when 'rare' then 2
    when 'epic' then 2.5
    when 'legendary' then 3
    else 1
  end;
  v_size_factor := case
    when coalesce(v_fish.metadata ->> 'sizePercentile', '') ~ '^[0-9]+(\.[0-9]+)?$'
      then 0.25 + greatest(0, least(1, (v_fish.metadata ->> 'sizePercentile')::numeric)) * 1.75
    else 1.125
  end;
  v_remaining_seconds := greatest(0, ceil(extract(epoch from v_champion.exhaustion_until - now()))::integer);
  v_reduction := least(
    v_remaining_seconds,
    floor(14400 * v_rarity_factor * v_size_factor)::integer
  );
  v_new_exhaustion := v_champion.exhaustion_until -
    make_interval(secs => v_reduction);
  if v_new_exhaustion <= now() then
    v_new_exhaustion := null;
  end if;

  update public.inventory_item_instances
  set quantity = quantity - 1, updated_at = now()
  where id = p_fish_instance_id;
  update public.champions
  set exhaustion_until = v_new_exhaustion
  where id = p_champion_id and profile_id = v_profile_id;
  update public.champion_revival_operations
  set status = 'completed',
      exhaustion_reduction_seconds = v_reduction,
      completed_at = now()
  where profile_id = v_profile_id and operation_id = p_operation_id;

  return query select
    p_champion_id, v_champion.name, v_champion.source_run_id,
    v_champion.content_version, v_champion.build, v_new_exhaustion,
    false, v_champion.created_at, p_fish_instance_id, v_reduction, true;
end;
$$;

grant execute on function public.revive_champion_with_fish(text, text, uuid)
  to authenticated;
