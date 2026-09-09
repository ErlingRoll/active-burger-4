-- Two more things to spend scrap on, and a shop that will buy it.
--
-- Scrap shipped with exactly one sink, the cheapest bait, which made it a
-- fishing currency rather than a material: a player who does not fish had no
-- use for it at all. The two extra recipes deepen the angler's end, and the
-- shop gives everyone else a floor price.
--
-- The shop is stage one of the market described in docs/features/marketplace.md:
-- players sell to the game and buy from a daily rotating stock. There is no
-- player-to-player transfer, so nothing here can duplicate an item or move
-- value between accounts, and the volume it records is what the Camp's
-- production rates will later be tuned against.

insert into public.inventory_crafting_recipes (
  id, input_definition_id, input_quantity, output_definition_id, output_quantity
) values
  ('glow-grub-from-scrap', 'scrap', 24, 'glow-grub', 1),
  ('moonwater-lure-from-scrap', 'scrap', 60, 'moonwater-lure', 1)
on conflict (id) do update
set input_definition_id = excluded.input_definition_id,
    input_quantity = excluded.input_quantity,
    output_definition_id = excluded.output_definition_id,
    output_quantity = excluded.output_quantity,
    active = true;

alter table public.inventory_operations
  drop constraint inventory_operations_operation_type_check;

alter table public.inventory_operations
  add constraint inventory_operations_operation_type_check
  check (
    operation_type in (
      'grant', 'consume', 'reserve', 'release', 'salvage', 'craft', 'sell', 'buy'
    )
  );

/*
 * What the shop pays and what it charges.
 *
 * A band rather than a number, so stage two can move prices inside it without
 * a schema change, and so the spread between `sell_price` and `buy_price` is
 * visible as the deliberate thing it is: the difference is destroyed on every
 * round trip, which is the shop's only economic job besides transfer.
 *
 * `stock_weight` of zero means the shop buys the item but never sells it.
 * Scrap is the case that needs it: a shop that sold scrap back would let a
 * player launder Essence into materials and undo the reason to run a dungeon.
 */
create table public.shop_price_bands (
  definition_id text primary key
    references public.inventory_item_definitions (id),
  sell_price integer not null check (sell_price >= 0),
  buy_price integer not null check (buy_price >= 1),
  /* Relative chance of appearing in a day's stock. Zero is never stocked. */
  stock_weight integer not null default 0 check (stock_weight >= 0),
  /* How many the shop offers on a day it stocks this, per player. */
  stock_quantity integer not null default 1 check (stock_quantity >= 1),
  active boolean not null default true,
  check (buy_price > sell_price)
);

alter table public.shop_price_bands enable row level security;

create policy "Shop prices are readable by signed-in players"
on public.shop_price_bands for select to authenticated
using (true);

grant select on public.shop_price_bands to authenticated;

-- The shop deals in supplies. Fish keep their existing salvage route rather
-- than gaining a second, differently-priced way to become Essence.
insert into public.shop_price_bands (
  definition_id, sell_price, buy_price, stock_weight, stock_quantity
) values
  ('scrap',           1,   3, 0, 1),
  ('river-worm',      6,  18, 40, 10),
  ('glow-grub',      18,  54, 25, 5),
  ('moonwater-lure', 45, 135, 10, 2)
on conflict (definition_id) do update
set sell_price = excluded.sell_price,
    buy_price = excluded.buy_price,
    stock_weight = excluded.stock_weight,
    stock_quantity = excluded.stock_quantity,
    active = true;

/*
 * What the shop is offering today.
 *
 * Rolled per player rather than held as one global counter. A shared counter
 * would make the day's stock a race, which is a poor experience and a source
 * of contention for a feature whose whole point is to be a calm floor price;
 * a per-player allowance keeps the scarcity that makes visiting worthwhile
 * without anyone losing a purchase to someone else's timing.
 *
 * The row is written on first read of a given day and never rolled again, so
 * what a player is offered cannot be rerolled by refreshing.
 */
create table public.shop_daily_stock (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  stock_date date not null,
  definition_id text not null
    references public.inventory_item_definitions (id),
  quantity_offered integer not null check (quantity_offered >= 1),
  quantity_bought integer not null default 0 check (quantity_bought >= 0),
  unit_price integer not null check (unit_price >= 1),
  primary key (profile_id, stock_date, definition_id),
  check (quantity_bought <= quantity_offered)
);

alter table public.shop_daily_stock enable row level security;

create policy "Shop stock is readable by its owner"
on public.shop_daily_stock for select to authenticated
using ((select auth.uid()) = profile_id);

grant select on public.shop_daily_stock to authenticated;

/*
 * Today's offer, rolled once and then remembered.
 *
 * Seeded from the player and the date so the same day always produces the same
 * shelf for the same person, which makes it reproducible in a test and
 * un-rerollable in a browser.
 */
create function public.get_shop_stock()
returns table (
  definition_id text,
  quantity_offered integer,
  quantity_bought integer,
  unit_price integer
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_seed bigint;
  v_band public.shop_price_bands%rowtype;
  v_roll integer;
  v_index integer := 0;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to read the shop.';
  end if;

  if not exists (
    select 1 from public.shop_daily_stock as stock
    where stock.profile_id = v_profile_id and stock.stock_date = v_today
  ) then
    v_seed := mod(
      abs(hashtextextended(v_profile_id::text || ':' || v_today::text, 0)),
      1000000
    );
    for v_band in
      select bands.* from public.shop_price_bands as bands
      where bands.active and bands.stock_weight > 0
      order by bands.definition_id
    loop
      v_index := v_index + 1;
      v_roll := mod(v_seed / (7 ^ v_index)::bigint + v_index * 131, 100)::integer;
      if v_roll < v_band.stock_weight then
        insert into public.shop_daily_stock (
          profile_id, stock_date, definition_id, quantity_offered, unit_price
        ) values (
          v_profile_id, v_today, v_band.definition_id,
          v_band.stock_quantity, v_band.buy_price
        )
        on conflict do nothing;
      end if;
    end loop;
  end if;

  return query
  select stock.definition_id, stock.quantity_offered, stock.quantity_bought,
    stock.unit_price
  from public.shop_daily_stock as stock
  where stock.profile_id = v_profile_id and stock.stock_date = v_today
  order by stock.definition_id;
end;
$$;

grant execute on function public.get_shop_stock() to authenticated;

/*
 * Sell an item to the shop.
 *
 * The item is destroyed rather than listed: nothing a player sells here can
 * reach another player, so this cannot duplicate an item or move value between
 * accounts however it is retried. The price comes from the band, never from
 * the request.
 */
create function public.sell_to_shop(
  p_operation_id text,
  p_item_instance_id uuid,
  p_quantity integer
)
returns table (
  item_instance_id uuid,
  definition_id text,
  quantity_sold integer,
  essence_awarded bigint,
  essence_balance bigint,
  was_processed boolean
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_operation public.inventory_operations%rowtype;
  v_instance public.inventory_item_instances%rowtype;
  v_band public.shop_price_bands%rowtype;
  v_quantity integer;
  v_essence bigint;
  v_result jsonb;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to sell.';
  end if;
  if coalesce(length(trim(p_operation_id)), 0) = 0 then
    raise exception 'A non-empty inventory operation ID is required.';
  end if;

  v_operation := public.inventory_claim_operation(
    v_profile_id, p_operation_id, 'sell',
    jsonb_build_object('itemInstanceId', p_item_instance_id, 'quantity', p_quantity)
  );
  if v_operation.status = 'completed' then
    return query
    select
      (v_operation.result -> 0 ->> 'item_instance_id')::uuid,
      v_operation.result -> 0 ->> 'definition_id',
      (v_operation.result -> 0 ->> 'quantity_sold')::integer,
      (v_operation.result -> 0 ->> 'essence_awarded')::bigint,
      wallets.essence_balance,
      false
    from public.meta_wallets as wallets
    where wallets.profile_id = v_profile_id;
    return;
  end if;

  select instances.* into v_instance
  from public.inventory_item_instances as instances
  where instances.id = p_item_instance_id
    and instances.profile_id = v_profile_id
  for update;
  if not found or v_instance.quantity < 1 then
    raise exception 'Unknown or unavailable inventory item.';
  end if;
  if v_instance.bound then
    raise exception 'A bound item cannot be sold.';
  end if;

  v_quantity := coalesce(p_quantity, v_instance.quantity);
  if v_quantity < 1 or v_quantity > v_instance.quantity then
    raise exception 'Invalid sell quantity.';
  end if;

  select bands.* into v_band
  from public.shop_price_bands as bands
  where bands.definition_id = v_instance.definition_id and bands.active;
  if not found then
    raise exception 'The shop does not deal in that.';
  end if;

  v_essence := v_band.sell_price::bigint * v_quantity;

  update public.inventory_item_instances as instances
  set quantity = instances.quantity - v_quantity, updated_at = now()
  where instances.id = p_item_instance_id;

  insert into public.meta_wallets (profile_id)
  values (v_profile_id)
  on conflict on constraint meta_wallets_pkey do nothing;
  update public.meta_wallets as wallets
  set essence_balance = wallets.essence_balance + v_essence,
      essence_earned = wallets.essence_earned + v_essence,
      updated_at = now()
  where wallets.profile_id = v_profile_id;

  v_result := jsonb_build_array(jsonb_build_object(
    'item_instance_id', p_item_instance_id,
    'definition_id', v_instance.definition_id,
    'quantity_sold', v_quantity,
    'essence_awarded', v_essence
  ));
  update public.inventory_operations as operations
  set status = 'completed', result = v_result, completed_at = now()
  where operations.profile_id = v_profile_id
    and operations.operation_id = p_operation_id;

  return query
  select
    p_item_instance_id, v_instance.definition_id, v_quantity, v_essence,
    wallets.essence_balance, true
  from public.meta_wallets as wallets
  where wallets.profile_id = v_profile_id;
end;
$$;

grant execute on function public.sell_to_shop(text, uuid, integer) to authenticated;

/*
 * Buy from today's shelf.
 *
 * The shop creates the item, which is the one place in the economy where that
 * is allowed and the reason the day's quantity is capped. Essence is destroyed
 * in exchange, and the spread against `sell_price` means a round trip always
 * loses: the shop is a sink first and a convenience second.
 */
create function public.buy_from_shop(
  p_operation_id text,
  p_definition_id text,
  p_quantity integer
)
returns table (
  definition_id text,
  quantity_bought integer,
  essence_spent bigint,
  essence_balance bigint,
  was_processed boolean
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_operation public.inventory_operations%rowtype;
  v_stock public.shop_daily_stock%rowtype;
  v_quantity integer;
  v_cost bigint;
  v_balance bigint;
  v_result jsonb;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to buy.';
  end if;
  if coalesce(length(trim(p_operation_id)), 0) = 0 then
    raise exception 'A non-empty inventory operation ID is required.';
  end if;

  v_quantity := coalesce(p_quantity, 1);
  if v_quantity < 1 or v_quantity > 99 then
    raise exception 'Buy quantity must be between 1 and 99.';
  end if;

  v_operation := public.inventory_claim_operation(
    v_profile_id, p_operation_id, 'buy',
    jsonb_build_object('definitionId', p_definition_id, 'quantity', v_quantity)
  );
  if v_operation.status = 'completed' then
    return query
    select
      v_operation.result -> 0 ->> 'definition_id',
      (v_operation.result -> 0 ->> 'quantity_bought')::integer,
      (v_operation.result -> 0 ->> 'essence_spent')::bigint,
      wallets.essence_balance,
      false
    from public.meta_wallets as wallets
    where wallets.profile_id = v_profile_id;
    return;
  end if;

  select stock.* into v_stock
  from public.shop_daily_stock as stock
  where stock.profile_id = v_profile_id
    and stock.stock_date = v_today
    and stock.definition_id = p_definition_id
  for update;
  if not found then
    raise exception 'The shop is not offering that today.';
  end if;
  if v_stock.quantity_bought + v_quantity > v_stock.quantity_offered then
    raise exception 'The shop has only % left today.',
      v_stock.quantity_offered - v_stock.quantity_bought;
  end if;

  v_cost := v_stock.unit_price::bigint * v_quantity;

  insert into public.meta_wallets (profile_id)
  values (v_profile_id)
  on conflict on constraint meta_wallets_pkey do nothing;

  select wallets.essence_balance into v_balance
  from public.meta_wallets as wallets
  where wallets.profile_id = v_profile_id
  for update;
  if v_balance < v_cost then
    raise exception 'Not enough Essence.';
  end if;

  update public.meta_wallets as wallets
  set essence_balance = wallets.essence_balance - v_cost,
      essence_spent = wallets.essence_spent + v_cost,
      updated_at = now()
  where wallets.profile_id = v_profile_id;

  update public.shop_daily_stock as stock
  set quantity_bought = stock.quantity_bought + v_quantity
  where stock.profile_id = v_profile_id
    and stock.stock_date = v_today
    and stock.definition_id = p_definition_id;

  perform 1 from public.grant_inventory_items(
    p_operation_id || ':output',
    'system',
    'shop:' || v_today::text,
    jsonb_build_array(jsonb_build_object(
      'definitionId', p_definition_id,
      'quantity', v_quantity,
      'metadata', jsonb_build_object('boughtOn', v_today::text)
    ))
  );

  v_result := jsonb_build_array(jsonb_build_object(
    'definition_id', p_definition_id,
    'quantity_bought', v_quantity,
    'essence_spent', v_cost
  ));
  update public.inventory_operations as operations
  set status = 'completed', result = v_result, completed_at = now()
  where operations.profile_id = v_profile_id
    and operations.operation_id = p_operation_id;

  return query
  select
    p_definition_id, v_quantity, v_cost, wallets.essence_balance, true
  from public.meta_wallets as wallets
  where wallets.profile_id = v_profile_id;
end;
$$;

grant execute on function public.buy_from_shop(text, text, integer) to authenticated;
