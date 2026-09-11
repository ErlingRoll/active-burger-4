-- Favorites, and a sweep that salvages many items in one request.
--
-- The sweep used to clear common fish and rods only, one round trip per item.
-- Players now hold enough uncommon and rare catch that clearing it by hand is
-- the slow part of a session, so the sweep takes a list of instances and does
-- the whole lot in one transaction. Widening what a sweep can take needs a way
-- to say "not this one": a favorite is kept out of every sweep, and it is
-- enforced here rather than in the browser so a stale shelf or a modified
-- client cannot salvage what the player set aside.
--
-- Two shapes of favorite, because the bag has two shapes of item. A rod or a
-- fish is one row with its own roll, so the flag lives on the instance. A
-- stackable material is one slot standing for many interchangeable rows, and
-- more of them arrive as new rows, so favoriting the slot has to mean the
-- definition — including the ones granted after the star was set.

alter table public.inventory_item_instances
  add column favorite boolean not null default false;

create table public.inventory_favorite_definitions (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  definition_id text not null references public.inventory_item_definitions (id),
  created_at timestamptz not null default now(),
  primary key (profile_id, definition_id)
);

alter table public.inventory_favorite_definitions enable row level security;

create policy "Favorite definitions are readable by their owner"
on public.inventory_favorite_definitions for select to authenticated
using ((select auth.uid()) = profile_id);

grant select on public.inventory_favorite_definitions to authenticated;

alter table public.inventory_operations
  drop constraint inventory_operations_operation_type_check;

alter table public.inventory_operations
  add constraint inventory_operations_operation_type_check
  check (
    operation_type in (
      'grant', 'consume', 'reserve', 'release', 'salvage', 'salvage-sweep', 'craft',
      'sell', 'buy', 'camp-claim', 'camp-upgrade', 'camp-gut', 'camp-cure', 'camp-reforge'
    )
  );

-- Setting a favorite is naturally idempotent: the same call twice leaves the
-- same flag, so it does not go through the operation ledger.
create function public.set_inventory_item_favorite(
  p_item_instance_id uuid,
  p_favorite boolean
)
returns table (
  item_instance_id uuid,
  favorite boolean
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_instance public.inventory_item_instances%rowtype;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to favorite inventory items.';
  end if;
  if p_favorite is null then
    raise exception 'A favorite flag is required.';
  end if;

  update public.inventory_item_instances as instances
  set favorite = p_favorite, updated_at = now()
  where instances.id = p_item_instance_id
    and instances.profile_id = v_profile_id
    and instances.quantity > 0
  returning instances.* into v_instance;
  if not found then
    raise exception 'Unknown or unavailable inventory item.';
  end if;

  return query select v_instance.id, v_instance.favorite;
end;
$$;

grant execute on function public.set_inventory_item_favorite(uuid, boolean)
  to authenticated;

create function public.set_inventory_definition_favorite(
  p_definition_id text,
  p_favorite boolean
)
returns table (
  definition_id text,
  favorite boolean
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to favorite inventory items.';
  end if;
  if p_favorite is null then
    raise exception 'A favorite flag is required.';
  end if;
  if not exists (
    select 1 from public.inventory_item_definitions as definitions
    where definitions.id = p_definition_id and definitions.active
  ) then
    raise exception 'Unknown or inactive inventory item definition: %.', p_definition_id;
  end if;

  if p_favorite then
    -- Named rather than listed: the output column `definition_id` shadows the
    -- table's inside this function, and a conflict target is an expression.
    insert into public.inventory_favorite_definitions (profile_id, definition_id)
    values (v_profile_id, p_definition_id)
    on conflict on constraint inventory_favorite_definitions_pkey do nothing;
  else
    delete from public.inventory_favorite_definitions as favorites
    where favorites.profile_id = v_profile_id
      and favorites.definition_id = p_definition_id;
  end if;

  return query select p_definition_id, p_favorite;
end;
$$;

grant execute on function public.set_inventory_definition_favorite(text, boolean)
  to authenticated;

/*
 * What a quantity of one instance is worth: Essence, or scrap for an artifact.
 *
 * Lifted out of `salvage_inventory_item` so the sweep prices an item exactly
 * the way a single salvage does; two copies of the fish formula would drift.
 * Raises rather than returning null for anything it cannot price, because a
 * null delta reaching the wallet is the failure this pricing was guarded
 * against in the first place.
 */
create function public.inventory_salvage_value(
  p_instance public.inventory_item_instances,
  p_definition public.inventory_item_definitions,
  p_quantity integer,
  out essence bigint,
  out scrap integer
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_size numeric;
  v_base_value bigint;
  v_enchantment_bonus integer := 0;
  v_essence bigint;
  v_scrap integer := 0;
begin
  if p_definition.category = 'fish' then
    if jsonb_typeof(p_instance.metadata -> 'sizePercentile') <> 'number' then
      raise exception 'Fish metadata is missing a normalized size.';
    end if;
    v_size := (p_instance.metadata ->> 'sizePercentile')::numeric;
    if v_size < 0 or v_size > 1 then
      raise exception 'Fish metadata contains an invalid normalized size.';
    end if;
    v_enchantment_bonus := case p_instance.metadata ->> 'enchantmentId'
      when 'bright-scales' then 15
      when 'deep-current' then 25
      when 'astral-mark' then 40
      else 0
    end;
    v_base_value := case p_definition.payload ->> 'rarity'
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
    )::bigint * p_quantity;
  elsif p_definition.category = 'artifact' then
    -- Scrap, never Essence, so boxes cannot become an Essence faucet through
    -- the artifacts they drop.
    v_essence := 0;
    v_scrap := case p_instance.metadata ->> 'rarity'
      when 'common' then 2
      when 'uncommon' then 4
      when 'rare' then 8
      when 'epic' then 14
      when 'legendary' then 24
      else null
    end;
    if v_scrap is null then
      raise exception 'Artifact metadata has an unknown rarity.';
    end if;
    v_scrap := v_scrap * p_quantity;
  else
    v_essence := p_definition.salvage_essence * p_quantity;
  end if;

  if v_essence is null then
    raise exception 'Could not determine a salvage value for %.', p_definition.id;
  end if;
  essence := v_essence;
  scrap := v_scrap;
end;
$$;

revoke all on function public.inventory_salvage_value(
  public.inventory_item_instances, public.inventory_item_definitions, integer
) from public;

-- The single salvage keeps the shape the artifacts gave it; only its pricing
-- moves into the shared helper.

create or replace function public.salvage_inventory_item(
  p_operation_id text,
  p_item_instance_id uuid,
  p_quantity integer
)
returns table (
  item_instance_id uuid,
  essence_awarded bigint,
  scrap_awarded integer,
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
  v_scrap integer := 0;
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
      coalesce((v_operation.result -> 0 ->> 'scrap_awarded')::integer, 0),
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

  -- A favorite is kept out of the sweep, not out of the player's hands: one
  -- item picked and confirmed on its own is a decision about that item.
  select value.essence, value.scrap into v_essence, v_scrap
  from public.inventory_salvage_value(v_instance, v_definition, v_quantity) as value;

  update public.inventory_item_instances
  set quantity = quantity - v_quantity, updated_at = now()
  where id = p_item_instance_id;

  if v_essence > 0 then
    insert into public.meta_wallets (profile_id)
    values (v_profile_id)
    on conflict (profile_id) do nothing;
    update public.meta_wallets
    set essence_balance = coalesce(essence_balance, 0) + v_essence,
        essence_earned = coalesce(essence_earned, 0) + v_essence,
        updated_at = now()
    where profile_id = v_profile_id;
  end if;

  if v_scrap > 0 then
    perform public.grant_inventory_items(
      'salvage-scrap:' || p_operation_id,
      'system',
      p_operation_id,
      jsonb_build_array(jsonb_build_object(
        'definitionId', 'scrap',
        'quantity', v_scrap,
        'metadata', jsonb_build_object('source', 'artifact-salvage')
      ))
    );
  end if;

  v_result := jsonb_build_array(jsonb_build_object(
    'item_instance_id', p_item_instance_id,
    'essence_awarded', v_essence,
    'scrap_awarded', v_scrap
  ));
  update public.inventory_operations
  set status = 'completed', result = v_result, completed_at = now()
  where profile_id = v_profile_id and operation_id = p_operation_id;

  return query
  select p_item_instance_id, v_essence, v_scrap, true;
end;
$$;

grant execute on function public.salvage_inventory_item(text, uuid, integer)
  to authenticated;

/*
 * Salvage every instance in the list, whole, in one transaction.
 *
 * The browser chooses the list — it knows which rarity ceiling the player set
 * and which shelf is showing — and the server decides what in it may go.
 * A favorite, whether the flag is on the row or on its definition, is skipped
 * and counted rather than raised on: the point of the sweep is that the player
 * does not have to think about each item, and a sweep that fails because one
 * of them was starred would make them. An instance that is no longer there is
 * skipped the same way, since a shelf can be a few seconds stale.
 *
 * Everything else is one transaction: either the whole list is salvaged and
 * paid for, or none of it is, which is what lets a retry under the same
 * operation ID be safe.
 */
create function public.salvage_inventory_items(
  p_operation_id text,
  p_item_instance_ids uuid[]
)
returns table (
  items_salvaged integer,
  items_skipped integer,
  essence_awarded bigint,
  scrap_awarded integer,
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
  v_item_instance_id uuid;
  v_salvaged integer := 0;
  v_skipped integer := 0;
  v_essence bigint := 0;
  v_scrap integer := 0;
  v_item_essence bigint;
  v_item_scrap integer;
  v_result jsonb;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to salvage inventory items.';
  end if;
  if coalesce(length(trim(p_operation_id)), 0) = 0 then
    raise exception 'A non-empty inventory operation ID is required.';
  end if;
  if p_item_instance_ids is null or cardinality(p_item_instance_ids) = 0 then
    raise exception 'A salvage sweep requires at least one inventory item.';
  end if;

  v_operation := public.inventory_claim_operation(
    v_profile_id, p_operation_id, 'salvage-sweep',
    jsonb_build_object('itemInstanceIds', to_jsonb(p_item_instance_ids))
  );
  if v_operation.status = 'completed' then
    return query
    select
      (v_operation.result -> 0 ->> 'items_salvaged')::integer,
      (v_operation.result -> 0 ->> 'items_skipped')::integer,
      (v_operation.result -> 0 ->> 'essence_awarded')::bigint,
      (v_operation.result -> 0 ->> 'scrap_awarded')::integer,
      false;
    return;
  end if;

  -- Locked in a fixed order, so two sweeps of overlapping lists cannot
  -- deadlock each other; a repeated ID is one item, not two.
  for v_item_instance_id in
    select distinct unnest(p_item_instance_ids) order by 1
  loop
    select * into v_instance
    from public.inventory_item_instances
    where id = v_item_instance_id and profile_id = v_profile_id
    for update;
    if not found or v_instance.quantity < 1 then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    if v_instance.favorite or exists (
      select 1 from public.inventory_favorite_definitions
      where profile_id = v_profile_id and definition_id = v_instance.definition_id
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    select * into v_definition
    from public.inventory_item_definitions
    where id = v_instance.definition_id and active;
    if not found then
      raise exception 'Unknown inventory item definition.';
    end if;

    select value.essence, value.scrap into v_item_essence, v_item_scrap
    from public.inventory_salvage_value(v_instance, v_definition, v_instance.quantity) as value;
    v_essence := v_essence + v_item_essence;
    v_scrap := v_scrap + v_item_scrap;

    update public.inventory_item_instances
    set quantity = 0, updated_at = now()
    where id = v_instance.id;
    v_salvaged := v_salvaged + 1;
  end loop;

  if v_essence > 0 then
    insert into public.meta_wallets (profile_id)
    values (v_profile_id)
    on conflict (profile_id) do nothing;
    update public.meta_wallets
    set essence_balance = coalesce(essence_balance, 0) + v_essence,
        essence_earned = coalesce(essence_earned, 0) + v_essence,
        updated_at = now()
    where profile_id = v_profile_id;
  end if;

  if v_scrap > 0 then
    perform public.grant_inventory_items(
      'salvage-scrap:' || p_operation_id,
      'system',
      p_operation_id,
      jsonb_build_array(jsonb_build_object(
        'definitionId', 'scrap',
        'quantity', v_scrap,
        'metadata', jsonb_build_object('source', 'artifact-salvage')
      ))
    );
  end if;

  v_result := jsonb_build_array(jsonb_build_object(
    'items_salvaged', v_salvaged,
    'items_skipped', v_skipped,
    'essence_awarded', v_essence,
    'scrap_awarded', v_scrap
  ));
  update public.inventory_operations
  set status = 'completed', result = v_result, completed_at = now()
  where profile_id = v_profile_id and operation_id = p_operation_id;

  return query
  select v_salvaged, v_skipped, v_essence, v_scrap, true;
end;
$$;

grant execute on function public.salvage_inventory_items(text, uuid[])
  to authenticated;
