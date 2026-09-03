-- General server-authoritative inventory primitives for fish, bait, rods, and
-- future loot boxes and artifacts.

create table public.inventory_item_definitions (
  id text primary key,
  category text not null check (
    category in ('fish', 'bait', 'rod', 'loot-box', 'artifact', 'material', 'utility')
  ),
  stackable boolean not null,
  max_stack_size integer not null check (max_stack_size >= 1),
  tradeable boolean not null default false,
  bind_on_equip boolean not null default false,
  is_unlimited boolean not null default false,
  salvage_essence bigint not null default 0 check (salvage_essence >= 0),
  active boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  check (stackable or max_stack_size = 1)
);

create table public.inventory_item_instances (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  definition_id text not null references public.inventory_item_definitions (id),
  quantity integer not null check (quantity >= 0),
  bound boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  source_type text not null,
  source_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object')
);

create index inventory_item_instances_profile_idx
  on public.inventory_item_instances (profile_id, created_at, id);

create index inventory_item_instances_definition_idx
  on public.inventory_item_instances (profile_id, definition_id);

create table public.inventory_operations (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  operation_id text not null,
  operation_type text not null check (
    operation_type in ('grant', 'consume', 'reserve', 'release', 'salvage')
  ),
  status text not null default 'pending' check (status in ('pending', 'completed')),
  request jsonb not null default '{}'::jsonb,
  result jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (profile_id, operation_id)
);

create table public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  operation_id text not null,
  purpose text not null,
  status text not null default 'active'
    check (status in ('active', 'released', 'consumed')),
  created_at timestamptz not null default now(),
  released_at timestamptz,
  unique (profile_id, operation_id)
);

create table public.inventory_reservation_lines (
  reservation_id uuid not null references public.inventory_reservations (id) on delete cascade,
  item_instance_id uuid not null references public.inventory_item_instances (id),
  quantity integer not null check (quantity >= 1),
  primary key (reservation_id, item_instance_id)
);

alter table public.inventory_item_definitions enable row level security;
alter table public.inventory_item_instances enable row level security;
alter table public.inventory_operations enable row level security;
alter table public.inventory_reservations enable row level security;
alter table public.inventory_reservation_lines enable row level security;

create policy "Inventory definitions are readable by authenticated players"
on public.inventory_item_definitions for select to authenticated
using (active);

create policy "Inventory items are readable by their owner"
on public.inventory_item_instances for select to authenticated
using ((select auth.uid()) = profile_id and quantity > 0);

create policy "Inventory reservations are readable by their owner"
on public.inventory_reservations for select to authenticated
using ((select auth.uid()) = profile_id);

create policy "Inventory reservation lines are readable by their owner"
on public.inventory_reservation_lines for select to authenticated
using (exists (
  select 1
  from public.inventory_reservations as reservations
  where reservations.id = reservation_id
    and reservations.profile_id = (select auth.uid())
));

grant select on public.inventory_item_definitions,
  public.inventory_item_instances,
  public.inventory_reservations,
  public.inventory_reservation_lines to authenticated;

insert into public.inventory_item_definitions (
  id, category, stackable, max_stack_size, tradeable, bind_on_equip,
  is_unlimited, salvage_essence, payload
) values
  ('basic-bait', 'bait', false, 1, false, false, true, 0, '{}'::jsonb),
  ('river-minnow', 'fish', false, 1, true, false, false, 0, '{}'::jsonb),
  ('revival-koi', 'fish', false, 1, true, false, false, 0, '{}'::jsonb),
  ('starter-fishing-rod', 'rod', false, 1, true, true, false, 1, '{}'::jsonb);

create or replace function public.inventory_claim_operation(
  p_profile_id uuid,
  p_operation_id text,
  p_operation_type text,
  p_request jsonb
)
returns public.inventory_operations
language plpgsql
security definer set search_path = ''
as $$
declare
  v_operation public.inventory_operations%rowtype;
begin
  insert into public.inventory_operations (
    profile_id, operation_id, operation_type, request
  ) values (
    p_profile_id, p_operation_id, p_operation_type, p_request
  )
  on conflict (profile_id, operation_id) do nothing;

  select * into v_operation
  from public.inventory_operations
  where profile_id = p_profile_id and operation_id = p_operation_id
  for update;

  if v_operation.operation_type <> p_operation_type then
    raise exception 'Inventory operation ID was already used for another operation.';
  end if;
  return v_operation;
end;
$$;

revoke all on function public.inventory_claim_operation(uuid, text, text, jsonb)
  from public;

create function public.grant_inventory_items(
  p_operation_id text,
  p_source_type text,
  p_source_id text,
  p_items jsonb
)
returns table (
  item_instance_id uuid,
  definition_id text,
  quantity integer,
  bound boolean,
  metadata jsonb,
  source_type text,
  source_id text,
  created_at timestamptz,
  updated_at timestamptz,
  was_processed boolean
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_operation public.inventory_operations%rowtype;
  v_item jsonb;
  v_definition public.inventory_item_definitions%rowtype;
  v_instance public.inventory_item_instances%rowtype;
  v_result jsonb := '[]'::jsonb;
  v_definition_id text;
  v_quantity integer;
  v_bound boolean;
  v_metadata jsonb;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to grant inventory items.';
  end if;
  if coalesce(length(trim(p_operation_id)), 0) = 0 then
    raise exception 'A non-empty inventory operation ID is required.';
  end if;
  if coalesce(length(trim(p_source_type)), 0) = 0 then
    raise exception 'A non-empty inventory source type is required.';
  end if;
  if p_source_type not in (
    'starter', 'fishing', 'dungeon-reward', 'abyss-reward',
    'loot-box', 'market', 'admin', 'system'
  ) then
    raise exception 'Unknown inventory source type.';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Inventory grant items must be a non-empty array.';
  end if;

  v_operation := public.inventory_claim_operation(
    v_profile_id,
    p_operation_id,
    'grant',
    jsonb_build_object('sourceType', p_source_type, 'sourceId', p_source_id, 'items', p_items)
  );
  if v_operation.status = 'completed' then
    return query
    select
      (entry ->> 'item_instance_id')::uuid,
      entry ->> 'definition_id',
      (entry ->> 'quantity')::integer,
      (entry ->> 'bound')::boolean,
      entry -> 'metadata',
      entry ->> 'source_type',
      entry ->> 'source_id',
      (entry ->> 'created_at')::timestamptz,
      (entry ->> 'updated_at')::timestamptz,
      false
    from jsonb_array_elements(v_operation.result) as entries(entry);
    return;
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Each inventory grant must be an object.';
    end if;
    v_definition_id := v_item ->> 'definitionId';
    if coalesce(length(trim(v_definition_id)), 0) = 0 then
      raise exception 'Inventory grant definition ID is required.';
    end if;
    if jsonb_typeof(v_item -> 'quantity') <> 'number' or
       (v_item ->> 'quantity') !~ '^[1-9][0-9]*$' then
      raise exception 'Inventory grant quantity must be a positive integer.';
    end if;
    v_quantity := (v_item ->> 'quantity')::integer;
    v_bound := coalesce((v_item ->> 'bound')::boolean, false);
    v_metadata := coalesce(v_item -> 'metadata', '{}'::jsonb);
    if v_quantity < 1 or jsonb_typeof(v_metadata) <> 'object' then
      raise exception 'Inventory grant quantity or metadata is invalid.';
    end if;

    select * into v_definition
    from public.inventory_item_definitions
    where id = v_definition_id and active;
    if not found then
      raise exception 'Unknown or inactive inventory item definition: %.', v_definition_id;
    end if;
    if v_definition.is_unlimited then
      raise exception 'Unlimited inventory items cannot be granted.';
    end if;
    if not v_definition.stackable and v_quantity <> 1 then
      raise exception 'Unique inventory items must be granted one at a time.';
    end if;
    if v_quantity > v_definition.max_stack_size then
      raise exception 'Inventory grant exceeds the maximum stack size.';
    end if;

    insert into public.inventory_item_instances (
      profile_id, definition_id, quantity, bound, metadata, source_type, source_id
    ) values (
      v_profile_id, v_definition_id, v_quantity, v_bound, v_metadata, p_source_type, p_source_id
    )
    returning * into v_instance;

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'item_instance_id', v_instance.id,
      'definition_id', v_instance.definition_id,
      'quantity', v_instance.quantity,
      'bound', v_instance.bound,
      'metadata', v_instance.metadata,
      'source_type', v_instance.source_type,
      'source_id', v_instance.source_id,
      'created_at', v_instance.created_at,
      'updated_at', v_instance.updated_at
    ));
  end loop;

  update public.inventory_operations
  set status = 'completed', result = v_result, completed_at = now()
  where profile_id = v_profile_id and operation_id = p_operation_id;

  return query
  select
    (entry ->> 'item_instance_id')::uuid,
    entry ->> 'definition_id',
    (entry ->> 'quantity')::integer,
    (entry ->> 'bound')::boolean,
    entry -> 'metadata',
    entry ->> 'source_type',
    entry ->> 'source_id',
    (entry ->> 'created_at')::timestamptz,
    (entry ->> 'updated_at')::timestamptz,
    true
  from jsonb_array_elements(v_result) as entries(entry);
end;
$$;

create function public.consume_inventory_items(
  p_operation_id text,
  p_items jsonb
)
returns table (
  item_instance_id uuid,
  quantity_consumed integer,
  was_processed boolean
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_operation public.inventory_operations%rowtype;
  v_item jsonb;
  v_instance public.inventory_item_instances%rowtype;
  v_result jsonb := '[]'::jsonb;
  v_item_instance_id uuid;
  v_quantity integer;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to consume inventory items.';
  end if;
  if coalesce(length(trim(p_operation_id)), 0) = 0 then
    raise exception 'A non-empty inventory operation ID is required.';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Inventory consumption items must be a non-empty array.';
  end if;

  v_operation := public.inventory_claim_operation(
    v_profile_id, p_operation_id, 'consume', jsonb_build_object('items', p_items)
  );
  if v_operation.status = 'completed' then
    return query
    select
      (entry ->> 'item_instance_id')::uuid,
      (entry ->> 'quantity_consumed')::integer,
      false
    from jsonb_array_elements(v_operation.result) as entries(entry);
    return;
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object' or
       jsonb_typeof(v_item -> 'quantity') <> 'number' or
       (v_item ->> 'quantity') !~ '^[1-9][0-9]*$' then
      raise exception 'Each inventory consumption must include a positive integer quantity.';
    end if;
    v_item_instance_id := (v_item ->> 'itemInstanceId')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity < 1 then
      raise exception 'Inventory consumption quantity must be positive.';
    end if;

    select * into v_instance
    from public.inventory_item_instances
    where id = v_item_instance_id and profile_id = v_profile_id
    for update;
    if not found then
      raise exception 'Unknown inventory item instance.';
    end if;
    if v_instance.quantity < v_quantity then
      raise exception 'Insufficient inventory quantity.';
    end if;

    update public.inventory_item_instances
    set quantity = quantity - v_quantity, updated_at = now()
    where id = v_item_instance_id;

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'item_instance_id', v_item_instance_id,
      'quantity_consumed', v_quantity
    ));
  end loop;

  update public.inventory_operations
  set status = 'completed', result = v_result, completed_at = now()
  where profile_id = v_profile_id and operation_id = p_operation_id;

  return query
  select
    (entry ->> 'item_instance_id')::uuid,
    (entry ->> 'quantity_consumed')::integer,
    true
  from jsonb_array_elements(v_result) as entries(entry);
end;
$$;

create function public.reserve_inventory_items(
  p_operation_id text,
  p_purpose text,
  p_items jsonb
)
returns table (
  reservation_id uuid,
  item_instance_id uuid,
  quantity_reserved integer,
  was_processed boolean
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_operation public.inventory_operations%rowtype;
  v_reservation public.inventory_reservations%rowtype;
  v_item jsonb;
  v_instance public.inventory_item_instances%rowtype;
  v_result jsonb := '[]'::jsonb;
  v_item_instance_id uuid;
  v_quantity integer;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to reserve inventory items.';
  end if;
  if coalesce(length(trim(p_operation_id)), 0) = 0 or
     coalesce(length(trim(p_purpose)), 0) = 0 then
    raise exception 'Reservation operation ID and purpose are required.';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Inventory reservation items must be a non-empty array.';
  end if;

  v_operation := public.inventory_claim_operation(
    v_profile_id, p_operation_id, 'reserve',
    jsonb_build_object('purpose', p_purpose, 'items', p_items)
  );
  if v_operation.status = 'completed' then
    return query
    select
      (entry ->> 'reservation_id')::uuid,
      (entry ->> 'item_instance_id')::uuid,
      (entry ->> 'quantity_reserved')::integer,
      false
    from jsonb_array_elements(v_operation.result) as entries(entry);
    return;
  end if;

  insert into public.inventory_reservations (profile_id, operation_id, purpose)
  values (v_profile_id, p_operation_id, p_purpose)
  returning * into v_reservation;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object' or
       jsonb_typeof(v_item -> 'quantity') <> 'number' or
       (v_item ->> 'quantity') !~ '^[1-9][0-9]*$' then
      raise exception 'Each inventory reservation must include a positive integer quantity.';
    end if;
    v_item_instance_id := (v_item ->> 'itemInstanceId')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity < 1 then
      raise exception 'Inventory reservation quantity must be positive.';
    end if;

    select * into v_instance
    from public.inventory_item_instances
    where id = v_item_instance_id and profile_id = v_profile_id
    for update;
    if not found then
      raise exception 'Unknown inventory item instance.';
    end if;
    if v_instance.quantity < v_quantity then
      raise exception 'Insufficient inventory quantity for reservation.';
    end if;

    update public.inventory_item_instances
    set quantity = quantity - v_quantity, updated_at = now()
    where id = v_item_instance_id;
    insert into public.inventory_reservation_lines (
      reservation_id, item_instance_id, quantity
    ) values (
      v_reservation.id, v_item_instance_id, v_quantity
    );

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'reservation_id', v_reservation.id,
      'item_instance_id', v_item_instance_id,
      'quantity_reserved', v_quantity
    ));
  end loop;

  update public.inventory_operations
  set status = 'completed', result = v_result, completed_at = now()
  where profile_id = v_profile_id and operation_id = p_operation_id;

  return query
  select
    (entry ->> 'reservation_id')::uuid,
    (entry ->> 'item_instance_id')::uuid,
    (entry ->> 'quantity_reserved')::integer,
    true
  from jsonb_array_elements(v_result) as entries(entry);
end;
$$;

create function public.release_inventory_reservation(
  p_operation_id text,
  p_reservation_id uuid
)
returns table (
  reservation_id uuid,
  quantity_released integer,
  was_processed boolean
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_operation public.inventory_operations%rowtype;
  v_reservation public.inventory_reservations%rowtype;
  v_line record;
  v_result jsonb;
  v_quantity integer := 0;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to release an inventory reservation.';
  end if;
  if coalesce(length(trim(p_operation_id)), 0) = 0 then
    raise exception 'A non-empty inventory operation ID is required.';
  end if;

  v_operation := public.inventory_claim_operation(
    v_profile_id, p_operation_id, 'release',
    jsonb_build_object('reservationId', p_reservation_id)
  );
  if v_operation.status = 'completed' then
    return query
    select
      (v_operation.result -> 0 ->> 'reservation_id')::uuid,
      (v_operation.result -> 0 ->> 'quantity_released')::integer,
      false;
    return;
  end if;

  select * into v_reservation
  from public.inventory_reservations
  where id = p_reservation_id and profile_id = v_profile_id
  for update;
  if not found then
    raise exception 'Unknown inventory reservation.';
  end if;
  if v_reservation.status = 'consumed' then
    raise exception 'Consumed inventory reservations cannot be released.';
  end if;
  if v_reservation.status = 'released' then
    v_result := jsonb_build_array(jsonb_build_object(
      'reservation_id', p_reservation_id,
      'quantity_released', 0
    ));
  else
    for v_line in
      select item_instance_id, quantity
      from public.inventory_reservation_lines
      where reservation_id = p_reservation_id
      order by item_instance_id
    loop
      update public.inventory_item_instances
      set quantity = quantity + v_line.quantity, updated_at = now()
      where id = v_line.item_instance_id and profile_id = v_profile_id;
      if not found then
        raise exception 'Reserved inventory item no longer exists.';
      end if;
      v_quantity := v_quantity + v_line.quantity;
    end loop;
    update public.inventory_reservations
    set status = 'released', released_at = now()
    where id = p_reservation_id;
    v_result := jsonb_build_array(jsonb_build_object(
      'reservation_id', p_reservation_id,
      'quantity_released', v_quantity
    ));
  end if;

  update public.inventory_operations
  set status = 'completed', result = v_result, completed_at = now()
  where profile_id = v_profile_id and operation_id = p_operation_id;

  return query
  select
    (v_result -> 0 ->> 'reservation_id')::uuid,
    (v_result -> 0 ->> 'quantity_released')::integer,
    true;
end;
$$;

create function public.salvage_inventory_item(
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
  v_essence := v_definition.salvage_essence * v_quantity;

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

grant execute on function public.grant_inventory_items(text, text, text, jsonb)
  to authenticated;
grant execute on function public.consume_inventory_items(text, jsonb)
  to authenticated;
grant execute on function public.reserve_inventory_items(text, text, jsonb)
  to authenticated;
grant execute on function public.release_inventory_reservation(text, uuid)
  to authenticated;
grant execute on function public.salvage_inventory_item(text, uuid, integer)
  to authenticated;
