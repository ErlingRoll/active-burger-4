-- The Divine Gamba: a machine on the refuge that takes Essence for balls and
-- drops them through a field of pegs into pockets that pay, sometimes, more
-- than the ball cost, and now and then a loot box.
--
-- Three things about it are decided here rather than in the browser.
--
-- The outcome is physics, and the physics runs twice: once in the browser,
-- for the player to watch, and once in an Edge Function, for the house to
-- pay. Both run the same deterministic simulation from the same seed and the
-- same machine, and only the Edge Function's run is paid. The seed is drawn
-- here from a server-random uuid, never from anything the client sends, so a
-- play cannot be chosen, and it is stored on the play so that a settlement
-- can be retried after any failure and reach the same result.
--
-- The charge and the settlement are separate transactions. `begin` charges
-- the wallet and writes a pending play; `settle`, callable only by the
-- service role the Edge Function holds, pays it. A crash between the two
-- leaves a pending play the client re-settles on its next visit, and a
-- settlement replayed with the same play returns what it paid the first time.
--
-- The machine is a sink. The pocket tables are tuned so the return to player
-- is below one for every loadout and a single play profits less than half
-- the time; tests/divineGambaOdds.test.ts measures both by running the
-- simulation, and tests/divineGambaRegistry.test.ts holds these rows to the
-- TypeScript registry the client reads. Boxes stop at epic.

alter table public.inventory_operations
  drop constraint inventory_operations_operation_type_check;

alter table public.inventory_operations
  add constraint inventory_operations_operation_type_check
  check (
    operation_type in (
      'grant', 'consume', 'reserve', 'release', 'salvage', 'salvage-sweep', 'craft',
      'sell', 'buy', 'camp-claim', 'camp-upgrade', 'camp-gut', 'camp-cure', 'camp-reforge',
      'camp-forge', 'contract-claim', 'divine-gamba-play', 'divine-gamba-buy'
    )
  );

/*
 * Granting to a named profile.
 *
 * `grant_inventory_items` reads the profile from the session, which every
 * caller so far has had. The Gamba's settlement runs under the service role
 * on behalf of a player who is not on the connection, so the body moves into
 * a function that takes the profile as an argument, and the original becomes
 * a wrapper that passes `auth.uid()`. Nothing that could call the old
 * function can call the new one: it is revoked from every role.
 */
create function public.grant_inventory_items_to(
  p_profile_id uuid,
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
  if p_profile_id is null then
    raise exception 'A profile is required to grant inventory items.';
  end if;
  if coalesce(length(trim(p_operation_id)), 0) = 0 then
    raise exception 'A non-empty inventory operation ID is required.';
  end if;
  if coalesce(length(trim(p_source_type)), 0) = 0 then
    raise exception 'A non-empty inventory source type is required.';
  end if;
  if p_source_type not in (
    'starter', 'fishing', 'dungeon-reward', 'abyss-reward',
    'loot-box', 'market', 'admin', 'system', 'divine-gamba'
  ) then
    raise exception 'Unknown inventory source type.';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Inventory grant items must be a non-empty array.';
  end if;

  v_operation := public.inventory_claim_operation(
    p_profile_id,
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
      p_profile_id, v_definition_id, v_quantity, v_bound, v_metadata, p_source_type, p_source_id
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
  where profile_id = p_profile_id and operation_id = p_operation_id;

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

revoke all on function public.grant_inventory_items_to(uuid, text, text, text, jsonb)
  from public, anon, authenticated;

create or replace function public.grant_inventory_items(
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
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to grant inventory items.';
  end if;
  return query
  select * from public.grant_inventory_items_to(
    auth.uid(), p_operation_id, p_source_type, p_source_id, p_items
  );
end;
$$;

/*
 * The machine's constants: what a ball costs before any stake or surcharge,
 * how a box's rarity is drawn, and which simulation these rows were tuned
 * against. One row, so it can be read like a setting and still be a table
 * the client mirrors.
 */
create table public.divine_gamba_settings (
  id text primary key default 'default' check (id = 'default'),
  base_ball_price integer not null check (base_ball_price >= 1),
  box_rarity_weights jsonb not null check (jsonb_typeof(box_rarity_weights) = 'object'),
  sim_version integer not null check (sim_version >= 1)
);

alter table public.divine_gamba_settings enable row level security;

create policy "Divine Gamba settings are readable by signed-in players"
on public.divine_gamba_settings for select to authenticated
using (true);

grant select on public.divine_gamba_settings to authenticated;

insert into public.divine_gamba_settings (id, base_ball_price, box_rarity_weights, sim_version)
values ('default', 20, '{"common":55,"uncommon":30,"rare":12,"epic":3}'::jsonb, 1)
on conflict (id) do update
set base_ball_price = excluded.base_ball_price,
    box_rarity_weights = excluded.box_rarity_weights,
    sim_version = excluded.sim_version;

/*
 * What each pocket pays, by board height.
 *
 * A board of `row_count` peg rows has `row_count + 1` pockets. The multiplier
 * is a percentage of the stake price; only the outer pockets pay above it,
 * and only the outermost two can hold a box.
 */
create table public.divine_gamba_pocket_tables (
  row_count integer not null check (row_count between 4 and 16),
  pocket_index integer not null check (pocket_index >= 0),
  multiplier_percent integer not null check (multiplier_percent >= 0),
  box_chance_basis_points integer not null check (box_chance_basis_points between 0 and 10000),
  primary key (row_count, pocket_index),
  check (pocket_index <= row_count)
);

alter table public.divine_gamba_pocket_tables enable row level security;

create policy "Divine Gamba pockets are readable by signed-in players"
on public.divine_gamba_pocket_tables for select to authenticated
using (true);

grant select on public.divine_gamba_pocket_tables to authenticated;

insert into public.divine_gamba_pocket_tables (
  row_count, pocket_index, multiplier_percent, box_chance_basis_points
) values
  (8, 0, 1000, 4000),
  (8, 1, 300, 0),
  (8, 2, 120, 0),
  (8, 3, 60, 0),
  (8, 4, 30, 0),
  (8, 5, 60, 0),
  (8, 6, 120, 0),
  (8, 7, 300, 0),
  (8, 8, 1000, 4000),
  (10, 0, 3000, 6000),
  (10, 1, 600, 0),
  (10, 2, 200, 0),
  (10, 3, 100, 0),
  (10, 4, 50, 0),
  (10, 5, 30, 0),
  (10, 6, 50, 0),
  (10, 7, 100, 0),
  (10, 8, 200, 0),
  (10, 9, 600, 0),
  (10, 10, 3000, 6000)
on conflict (row_count, pocket_index) do update
set multiplier_percent = excluded.multiplier_percent,
    box_chance_basis_points = excluded.box_chance_basis_points;

/*
 * The Shardwright's shelf.
 *
 * A part is installed for good and always on; a modifier is owned and
 * switched on per play, and may carry a surcharge on the ball price. The
 * effect is data both the SQL fold below and the TypeScript twin interpret;
 * physics effects pass straight through to the simulation.
 */
create table public.divine_gamba_part_definitions (
  id text primary key,
  kind text not null check (kind in ('part', 'modifier')),
  name text not null,
  description text not null,
  essence_cost integer not null check (essence_cost >= 0),
  shard_cost integer not null check (shard_cost >= 0),
  price_percent integer not null default 0 check (price_percent >= 0),
  requires_part_id text references public.divine_gamba_part_definitions (id),
  sort_order integer not null,
  effect jsonb not null check (jsonb_typeof(effect) = 'object'),
  active boolean not null default true
);

alter table public.divine_gamba_part_definitions enable row level security;

create policy "Divine Gamba parts are readable by signed-in players"
on public.divine_gamba_part_definitions for select to authenticated
using (true);

grant select on public.divine_gamba_part_definitions to authenticated;

insert into public.divine_gamba_part_definitions (
  id, kind, name, description, essence_cost, shard_cost, price_percent,
  requires_part_id, sort_order, effect
) values
  ('brass-rails', 'part', 'Brass rails', 'Polished rails along every pocket. Each pays five percent more.', 600, 10, 0, null, 0, '{"kind":"multiplier-scale","percent":105}'::jsonb),
  ('jackpot-pocket', 'part', 'Jackpot pockets', 'A rift lining in the outermost pockets. A ball that reaches one brings a box more often.', 800, 16, 0, null, 1, '{"kind":"box-chance","outerBasisPoints":6000}'::jsonb),
  ('high-stakes-2', 'part', 'Double stake', 'Unlocks balls at twice the price, paying twice as much.', 400, 8, 0, null, 2, '{"kind":"stake-tier","stake":2}'::jsonb),
  ('high-stakes-5', 'part', 'Quintuple stake', 'Unlocks balls at five times the price, paying five times as much.', 1500, 24, 0, 'high-stakes-2', 3, '{"kind":"stake-tier","stake":5}'::jsonb),
  ('tall-frame', 'part', 'Tall frame', 'Two more rows of pegs and eleven pockets. The outer ones pay thirty times the ball.', 2000, 40, 0, 'brass-rails', 4, '{"kind":"board-rows","rows":10}'::jsonb),
  ('steady-hand', 'modifier', 'Leaden shot', 'Heavier balls that fall straighter. Fewer big wins, fewer big losses.', 300, 6, 0, null, 10, '{"kind":"gravity","percent":160}'::jsonb),
  ('rift-magnet', 'modifier', 'Rift magnet', 'Pulls every ball outward on every bounce. The outer pockets come closer, and each ball costs a third more.', 900, 18, 35, null, 11, '{"kind":"scatter","strengthBasisPoints":600}'::jsonb),
  ('splitter', 'modifier', 'Splitter', 'One ball in four becomes two at the third row. Each ball costs three tenths more.', 1200, 20, 30, 'brass-rails', 12, '{"kind":"split","chanceBasisPoints":2500,"row":3}'::jsonb),
  ('lucky-lining', 'modifier', 'Lucky lining', 'Half again as many boxes from the jackpot pockets. Each ball costs a tenth more.', 700, 14, 10, 'jackpot-pocket', 13, '{"kind":"box-chance-scale","percent":150}'::jsonb)
on conflict (id) do update
set kind = excluded.kind,
    name = excluded.name,
    description = excluded.description,
    essence_cost = excluded.essence_cost,
    shard_cost = excluded.shard_cost,
    price_percent = excluded.price_percent,
    requires_part_id = excluded.requires_part_id,
    sort_order = excluded.sort_order,
    effect = excluded.effect,
    active = true;

/* What each player has bought. A part, once bought, is never lost. */
create table public.divine_gamba_parts (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  part_id text not null references public.divine_gamba_part_definitions (id),
  operation_id text not null,
  acquired_at timestamptz not null default now(),
  primary key (profile_id, part_id)
);

alter table public.divine_gamba_parts enable row level security;

create policy "Divine Gamba parts are readable by their owner"
on public.divine_gamba_parts for select to authenticated
using ((select auth.uid()) = profile_id);

grant select on public.divine_gamba_parts to authenticated;

/*
 * Every play, from the moment it is paid for.
 *
 * `machine` is the resolved board the play was begun with, so a part bought
 * while a play is in flight cannot change it, and so a settlement retried a
 * week later runs the same board. `result` is what the settlement answered,
 * kept for the replay.
 */
create table public.divine_gamba_plays (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  operation_id text not null,
  status text not null default 'pending' check (status in ('pending', 'settled')),
  seed bigint not null check (seed between 0 and 4294967295),
  sim_version integer not null check (sim_version >= 1),
  stake integer not null check (stake >= 1),
  ball_count integer not null check (ball_count between 1 and 20),
  stake_price integer not null check (stake_price >= 1),
  price_per_ball integer not null check (price_per_ball >= 1),
  modifier_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(modifier_ids) = 'array'),
  machine jsonb not null check (jsonb_typeof(machine) = 'object'),
  essence_spent bigint not null check (essence_spent >= 0),
  essence_won bigint not null default 0 check (essence_won >= 0),
  box_count integer not null default 0 check (box_count >= 0),
  result jsonb,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  unique (profile_id, operation_id)
);

create index divine_gamba_plays_profile_idx
  on public.divine_gamba_plays (profile_id, created_at desc);

alter table public.divine_gamba_plays enable row level security;

create policy "Divine Gamba plays are readable by their owner"
on public.divine_gamba_plays for select to authenticated
using ((select auth.uid()) = profile_id);

grant select on public.divine_gamba_plays to authenticated;

create table public.divine_gamba_play_balls (
  play_id bigint not null references public.divine_gamba_plays (id) on delete cascade,
  ball_index integer not null check (ball_index >= 0),
  /* The paid ball this one split from; null for a paid ball. */
  parent_index integer check (parent_index >= 0),
  pocket_index integer not null check (pocket_index >= 0),
  landed_tick integer not null check (landed_tick >= 0),
  essence_won integer not null check (essence_won >= 0),
  box_rarity text check (box_rarity in ('common', 'uncommon', 'rare', 'epic')),
  box_instance_id uuid references public.inventory_item_instances (id),
  primary key (play_id, ball_index)
);

alter table public.divine_gamba_play_balls enable row level security;

create policy "Divine Gamba balls are readable by their play's owner"
on public.divine_gamba_play_balls for select to authenticated
using (
  exists (
    select 1
    from public.divine_gamba_plays as plays
    where plays.id = divine_gamba_play_balls.play_id
      and plays.profile_id = (select auth.uid())
  )
);

grant select on public.divine_gamba_play_balls to authenticated;

/*
 * The fold: installed parts and enabled modifiers into one machine.
 *
 * The TypeScript twin is `resolveDivineGambaMachine` in
 * src/divine-gamba/DivineGambaRegistry.ts, and the fixture block after the
 * check function below holds the two to the same answers. Parts apply in
 * sort order, then modifiers in sort order; an id that is not a definition,
 * or a modifier that is not owned, is ignored here so both twins answer the
 * same question, and refused by `begin_divine_gamba_play` before it asks.
 */
create function public.divine_gamba_resolve_machine(
  p_owned_part_ids jsonb,
  p_enabled_modifier_ids jsonb
)
returns jsonb
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  v_settings public.divine_gamba_settings%rowtype;
  v_definition public.divine_gamba_part_definitions%rowtype;
  v_rows integer := 8;
  v_multiplier_scale integer := 100;
  v_box_scale integer := 100;
  v_outer_box integer := null;
  v_price integer := 100;
  v_stakes jsonb := '[1]'::jsonb;
  v_effects jsonb := '[]'::jsonb;
  v_pockets jsonb;
  v_sorted_stakes jsonb;
  v_kind text;
begin
  select * into v_settings from public.divine_gamba_settings where id = 'default';

  for v_definition in
    select definitions.*
    from public.divine_gamba_part_definitions as definitions
    where definitions.active
      and p_owned_part_ids @> to_jsonb(definitions.id)
      and (definitions.kind = 'part' or p_enabled_modifier_ids @> to_jsonb(definitions.id))
    order by definitions.sort_order, definitions.id
  loop
    v_price := v_price + v_definition.price_percent;
    v_kind := v_definition.effect ->> 'kind';
    if v_kind = 'multiplier-scale' then
      v_multiplier_scale := (v_multiplier_scale * (v_definition.effect ->> 'percent')::integer) / 100;
    elsif v_kind = 'box-chance' then
      v_outer_box := (v_definition.effect ->> 'outerBasisPoints')::integer;
    elsif v_kind = 'box-chance-scale' then
      v_box_scale := (v_box_scale * (v_definition.effect ->> 'percent')::integer) / 100;
    elsif v_kind = 'stake-tier' then
      if not v_stakes @> (v_definition.effect -> 'stake') then
        v_stakes := v_stakes || jsonb_build_array(v_definition.effect -> 'stake');
      end if;
    elsif v_kind = 'board-rows' then
      v_rows := (v_definition.effect ->> 'rows')::integer;
    else
      v_effects := v_effects || jsonb_build_array(v_definition.effect);
    end if;
  end loop;

  if not exists (
    select 1 from public.divine_gamba_pocket_tables as pockets where pockets.row_count = v_rows
  ) then
    v_rows := 8;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'multiplierPercent', pockets.multiplier_percent,
      'boxChanceBasisPoints',
        case
          when v_outer_box is not null and (pockets.pocket_index = 0 or pockets.pocket_index = v_rows)
          then v_outer_box
          else pockets.box_chance_basis_points
        end
    )
    order by pockets.pocket_index
  ), '[]'::jsonb)
  into v_pockets
  from public.divine_gamba_pocket_tables as pockets
  where pockets.row_count = v_rows;

  select jsonb_agg(stakes.value order by (stakes.value)::integer)
  into v_sorted_stakes
  from jsonb_array_elements(v_stakes) as stakes(value);

  return jsonb_build_object(
    'rows', v_rows,
    'pockets', v_pockets,
    'multiplierScalePercent', v_multiplier_scale,
    'boxChanceScalePercent', v_box_scale,
    'boxRarityWeights', v_settings.box_rarity_weights,
    'pricePercent', v_price,
    'effects', v_effects,
    'allowedStakes', v_sorted_stakes
  );
end;
$$;

revoke all on function public.divine_gamba_resolve_machine(jsonb, jsonb)
  from public, anon, authenticated;

create function public.divine_gamba_check_machine(
  p_name text,
  p_owned_part_ids jsonb,
  p_enabled_modifier_ids jsonb,
  p_expected jsonb
)
returns void
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  v_machine jsonb;
begin
  v_machine := public.divine_gamba_resolve_machine(p_owned_part_ids, p_enabled_modifier_ids);
  if v_machine <> p_expected then
    raise exception 'Divine Gamba machine fixture "%" disagrees with its TypeScript twin: SQL produced %, expected %',
      p_name, v_machine, p_expected;
  end if;
end;
$$;

revoke all on function public.divine_gamba_check_machine(text, jsonb, jsonb, jsonb)
  from public, anon, authenticated;

-- Generated from tests/fixtures/divineGambaMachines.json;
-- tests/divineGambaRegistry.test.ts holds this block to that file.
do $$
begin
  perform public.divine_gamba_check_machine(
    'bare',
    '[]'::jsonb,
    '[]'::jsonb,
    '{"rows":8,"pockets":[{"multiplierPercent":1000,"boxChanceBasisPoints":4000},{"multiplierPercent":300,"boxChanceBasisPoints":0},{"multiplierPercent":120,"boxChanceBasisPoints":0},{"multiplierPercent":60,"boxChanceBasisPoints":0},{"multiplierPercent":30,"boxChanceBasisPoints":0},{"multiplierPercent":60,"boxChanceBasisPoints":0},{"multiplierPercent":120,"boxChanceBasisPoints":0},{"multiplierPercent":300,"boxChanceBasisPoints":0},{"multiplierPercent":1000,"boxChanceBasisPoints":4000}],"multiplierScalePercent":100,"boxChanceScalePercent":100,"boxRarityWeights":{"common":55,"uncommon":30,"rare":12,"epic":3},"pricePercent":100,"effects":[],"allowedStakes":[1]}'::jsonb
  );
  perform public.divine_gamba_check_machine(
    'a-modifier-owned-but-off',
    '["rift-magnet"]'::jsonb,
    '[]'::jsonb,
    '{"rows":8,"pockets":[{"multiplierPercent":1000,"boxChanceBasisPoints":4000},{"multiplierPercent":300,"boxChanceBasisPoints":0},{"multiplierPercent":120,"boxChanceBasisPoints":0},{"multiplierPercent":60,"boxChanceBasisPoints":0},{"multiplierPercent":30,"boxChanceBasisPoints":0},{"multiplierPercent":60,"boxChanceBasisPoints":0},{"multiplierPercent":120,"boxChanceBasisPoints":0},{"multiplierPercent":300,"boxChanceBasisPoints":0},{"multiplierPercent":1000,"boxChanceBasisPoints":4000}],"multiplierScalePercent":100,"boxChanceScalePercent":100,"boxRarityWeights":{"common":55,"uncommon":30,"rare":12,"epic":3},"pricePercent":100,"effects":[],"allowedStakes":[1]}'::jsonb
  );
  perform public.divine_gamba_check_machine(
    'a-modifier-on',
    '["rift-magnet"]'::jsonb,
    '["rift-magnet"]'::jsonb,
    '{"rows":8,"pockets":[{"multiplierPercent":1000,"boxChanceBasisPoints":4000},{"multiplierPercent":300,"boxChanceBasisPoints":0},{"multiplierPercent":120,"boxChanceBasisPoints":0},{"multiplierPercent":60,"boxChanceBasisPoints":0},{"multiplierPercent":30,"boxChanceBasisPoints":0},{"multiplierPercent":60,"boxChanceBasisPoints":0},{"multiplierPercent":120,"boxChanceBasisPoints":0},{"multiplierPercent":300,"boxChanceBasisPoints":0},{"multiplierPercent":1000,"boxChanceBasisPoints":4000}],"multiplierScalePercent":100,"boxChanceScalePercent":100,"boxRarityWeights":{"common":55,"uncommon":30,"rare":12,"epic":3},"pricePercent":135,"effects":[{"kind":"scatter","strengthBasisPoints":600}],"allowedStakes":[1]}'::jsonb
  );
  perform public.divine_gamba_check_machine(
    'stakes-and-rails',
    '["high-stakes-5","high-stakes-2","brass-rails"]'::jsonb,
    '[]'::jsonb,
    '{"rows":8,"pockets":[{"multiplierPercent":1000,"boxChanceBasisPoints":4000},{"multiplierPercent":300,"boxChanceBasisPoints":0},{"multiplierPercent":120,"boxChanceBasisPoints":0},{"multiplierPercent":60,"boxChanceBasisPoints":0},{"multiplierPercent":30,"boxChanceBasisPoints":0},{"multiplierPercent":60,"boxChanceBasisPoints":0},{"multiplierPercent":120,"boxChanceBasisPoints":0},{"multiplierPercent":300,"boxChanceBasisPoints":0},{"multiplierPercent":1000,"boxChanceBasisPoints":4000}],"multiplierScalePercent":105,"boxChanceScalePercent":100,"boxRarityWeights":{"common":55,"uncommon":30,"rare":12,"epic":3},"pricePercent":100,"effects":[],"allowedStakes":[1,2,5]}'::jsonb
  );
  perform public.divine_gamba_check_machine(
    'jackpot-and-lining',
    '["jackpot-pocket","lucky-lining"]'::jsonb,
    '["lucky-lining"]'::jsonb,
    '{"rows":8,"pockets":[{"multiplierPercent":1000,"boxChanceBasisPoints":6000},{"multiplierPercent":300,"boxChanceBasisPoints":0},{"multiplierPercent":120,"boxChanceBasisPoints":0},{"multiplierPercent":60,"boxChanceBasisPoints":0},{"multiplierPercent":30,"boxChanceBasisPoints":0},{"multiplierPercent":60,"boxChanceBasisPoints":0},{"multiplierPercent":120,"boxChanceBasisPoints":0},{"multiplierPercent":300,"boxChanceBasisPoints":0},{"multiplierPercent":1000,"boxChanceBasisPoints":6000}],"multiplierScalePercent":100,"boxChanceScalePercent":150,"boxRarityWeights":{"common":55,"uncommon":30,"rare":12,"epic":3},"pricePercent":110,"effects":[],"allowedStakes":[1]}'::jsonb
  );
  perform public.divine_gamba_check_machine(
    'tall-frame',
    '["brass-rails","tall-frame","jackpot-pocket"]'::jsonb,
    '[]'::jsonb,
    '{"rows":10,"pockets":[{"multiplierPercent":3000,"boxChanceBasisPoints":6000},{"multiplierPercent":600,"boxChanceBasisPoints":0},{"multiplierPercent":200,"boxChanceBasisPoints":0},{"multiplierPercent":100,"boxChanceBasisPoints":0},{"multiplierPercent":50,"boxChanceBasisPoints":0},{"multiplierPercent":30,"boxChanceBasisPoints":0},{"multiplierPercent":50,"boxChanceBasisPoints":0},{"multiplierPercent":100,"boxChanceBasisPoints":0},{"multiplierPercent":200,"boxChanceBasisPoints":0},{"multiplierPercent":600,"boxChanceBasisPoints":0},{"multiplierPercent":3000,"boxChanceBasisPoints":6000}],"multiplierScalePercent":105,"boxChanceScalePercent":100,"boxRarityWeights":{"common":55,"uncommon":30,"rare":12,"epic":3},"pricePercent":100,"effects":[],"allowedStakes":[1]}'::jsonb
  );
  perform public.divine_gamba_check_machine(
    'everything',
    '["brass-rails","jackpot-pocket","high-stakes-2","high-stakes-5","tall-frame","steady-hand","rift-magnet","splitter","lucky-lining"]'::jsonb,
    '["steady-hand","rift-magnet","splitter","lucky-lining"]'::jsonb,
    '{"rows":10,"pockets":[{"multiplierPercent":3000,"boxChanceBasisPoints":6000},{"multiplierPercent":600,"boxChanceBasisPoints":0},{"multiplierPercent":200,"boxChanceBasisPoints":0},{"multiplierPercent":100,"boxChanceBasisPoints":0},{"multiplierPercent":50,"boxChanceBasisPoints":0},{"multiplierPercent":30,"boxChanceBasisPoints":0},{"multiplierPercent":50,"boxChanceBasisPoints":0},{"multiplierPercent":100,"boxChanceBasisPoints":0},{"multiplierPercent":200,"boxChanceBasisPoints":0},{"multiplierPercent":600,"boxChanceBasisPoints":0},{"multiplierPercent":3000,"boxChanceBasisPoints":6000}],"multiplierScalePercent":105,"boxChanceScalePercent":150,"boxRarityWeights":{"common":55,"uncommon":30,"rare":12,"epic":3},"pricePercent":175,"effects":[{"kind":"gravity","percent":160},{"kind":"scatter","strengthBasisPoints":600},{"kind":"split","chanceBasisPoints":2500,"row":3}],"allowedStakes":[1,2,5]}'::jsonb
  );
  perform public.divine_gamba_check_machine(
    'unknown-and-unowned-ignored',
    '["brass-rails","not-a-part"]'::jsonb,
    '["splitter","not-a-part"]'::jsonb,
    '{"rows":8,"pockets":[{"multiplierPercent":1000,"boxChanceBasisPoints":4000},{"multiplierPercent":300,"boxChanceBasisPoints":0},{"multiplierPercent":120,"boxChanceBasisPoints":0},{"multiplierPercent":60,"boxChanceBasisPoints":0},{"multiplierPercent":30,"boxChanceBasisPoints":0},{"multiplierPercent":60,"boxChanceBasisPoints":0},{"multiplierPercent":120,"boxChanceBasisPoints":0},{"multiplierPercent":300,"boxChanceBasisPoints":0},{"multiplierPercent":1000,"boxChanceBasisPoints":4000}],"multiplierScalePercent":105,"boxChanceScalePercent":100,"boxRarityWeights":{"common":55,"uncommon":30,"rare":12,"epic":3},"pricePercent":100,"effects":[],"allowedStakes":[1]}'::jsonb
  );
end;
$$;

/*
 * Paying for a play.
 *
 * Charges the wallet, resolves and freezes the machine, draws the seed and
 * writes a pending play. The response carries everything the browser needs
 * to run the simulation itself and start the animation before the house has
 * settled a thing.
 */
create function public.begin_divine_gamba_play(
  p_operation_id text,
  p_ball_count integer,
  p_stake integer,
  p_modifier_ids jsonb
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_operation public.inventory_operations%rowtype;
  v_settings public.divine_gamba_settings%rowtype;
  v_owned jsonb;
  v_modifier jsonb;
  v_machine jsonb;
  v_stake_price integer;
  v_price integer;
  v_cost bigint;
  v_balance bigint;
  v_seed bigint;
  v_play public.divine_gamba_plays%rowtype;
  v_result jsonb;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to play.';
  end if;
  if coalesce(length(trim(p_operation_id)), 0) = 0 then
    raise exception 'A non-empty operation ID is required.';
  end if;
  if p_ball_count is null or p_ball_count < 1 or p_ball_count > 20 then
    raise exception 'A play holds 1 to 20 balls.';
  end if;
  if p_stake is null or p_stake < 1 then
    raise exception 'Invalid stake.';
  end if;
  if p_modifier_ids is null or jsonb_typeof(p_modifier_ids) <> 'array' then
    raise exception 'Modifiers must be a list.';
  end if;

  v_operation := public.inventory_claim_operation(
    v_profile_id, p_operation_id, 'divine-gamba-play',
    jsonb_build_object('ballCount', p_ball_count, 'stake', p_stake, 'modifierIds', p_modifier_ids)
  );
  if v_operation.status = 'completed' then
    return v_operation.result || jsonb_build_object('was_processed', false);
  end if;

  select coalesce(jsonb_agg(parts.part_id), '[]'::jsonb) into v_owned
  from public.divine_gamba_parts as parts
  where parts.profile_id = v_profile_id;

  for v_modifier in select value from jsonb_array_elements(p_modifier_ids)
  loop
    if jsonb_typeof(v_modifier) <> 'string' then
      raise exception 'Modifiers must be named by ID.';
    end if;
    if not exists (
      select 1 from public.divine_gamba_part_definitions as definitions
      where definitions.id = (v_modifier #>> '{}')
        and definitions.kind = 'modifier'
        and definitions.active
    ) then
      raise exception 'Unknown modifier: %.', v_modifier #>> '{}';
    end if;
    if not v_owned @> v_modifier then
      raise exception 'You do not own that modifier.';
    end if;
  end loop;

  v_machine := public.divine_gamba_resolve_machine(v_owned, p_modifier_ids);
  if not (v_machine -> 'allowedStakes') @> to_jsonb(p_stake) then
    raise exception 'That stake is not unlocked.';
  end if;

  select * into v_settings from public.divine_gamba_settings where id = 'default';
  v_stake_price := v_settings.base_ball_price * p_stake;
  v_price := (v_stake_price * (v_machine ->> 'pricePercent')::integer) / 100;
  v_cost := v_price::bigint * p_ball_count;

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
  where wallets.profile_id = v_profile_id
  returning wallets.essence_balance into v_balance;

  -- Server-random, never derived from anything the client sent.
  v_seed := mod(
    ('x' || substr(md5(gen_random_uuid()::text), 1, 8))::bit(32)::bigint + 4294967296,
    4294967296
  );

  insert into public.divine_gamba_plays (
    profile_id, operation_id, seed, sim_version, stake, ball_count,
    stake_price, price_per_ball, modifier_ids, machine, essence_spent
  ) values (
    v_profile_id, p_operation_id, v_seed, v_settings.sim_version, p_stake, p_ball_count,
    v_stake_price, v_price, p_modifier_ids, v_machine, v_cost
  )
  returning * into v_play;

  v_result := jsonb_build_object(
    'play_id', v_play.id,
    'seed', v_play.seed,
    'sim_version', v_play.sim_version,
    'stake', v_play.stake,
    'ball_count', v_play.ball_count,
    'stake_price', v_play.stake_price,
    'price_per_ball', v_play.price_per_ball,
    'modifier_ids', v_play.modifier_ids,
    'machine', v_play.machine,
    'essence_spent', v_play.essence_spent,
    'essence_balance', v_balance
  );

  update public.inventory_operations as operations
  set status = 'completed', result = v_result, completed_at = now()
  where operations.profile_id = v_profile_id
    and operations.operation_id = p_operation_id;

  return v_result || jsonb_build_object('was_processed', true);
end;
$$;

revoke all on function public.begin_divine_gamba_play(text, integer, integer, jsonb)
  from public, anon;
grant execute on function public.begin_divine_gamba_play(text, integer, integer, jsonb)
  to authenticated;

/*
 * Paying out a play.
 *
 * Callable only by the service role, which only the Edge Function holds: the
 * outcome it carries is the simulation's, run on the server, and nothing a
 * browser can send reaches here. Even so, every number is checked against
 * the play: the version, the count, the pockets, and each ball's Essence is
 * recomputed from the frozen machine rather than trusted. Boxes stop at
 * epic by the column's own constraint.
 */
create function public.settle_divine_gamba_play(
  p_play_id bigint,
  p_outcome jsonb
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_play public.divine_gamba_plays%rowtype;
  v_ball jsonb;
  v_rows integer;
  v_multiplier_scale integer;
  v_ball_index integer;
  v_parent_index integer;
  v_pocket_index integer;
  v_landed_tick integer;
  v_essence integer;
  v_expected integer;
  v_rarity text;
  v_count integer;
  v_won bigint := 0;
  v_boxes integer := 0;
  v_items jsonb := '[]'::jsonb;
  v_granted record;
  v_balance bigint;
  v_balls jsonb;
  v_result jsonb;
begin
  select * into v_play
  from public.divine_gamba_plays as plays
  where plays.id = p_play_id
  for update;
  if not found then
    raise exception 'Unknown Divine Gamba play.';
  end if;
  if v_play.status = 'settled' then
    return v_play.result || jsonb_build_object('was_processed', false);
  end if;

  if p_outcome is null or jsonb_typeof(p_outcome) <> 'object' then
    raise exception 'An outcome is required.';
  end if;
  if (p_outcome ->> 'simVersion')::integer is distinct from v_play.sim_version then
    raise exception 'The outcome was simulated under version %, the play under %.',
      p_outcome ->> 'simVersion', v_play.sim_version;
  end if;
  if jsonb_typeof(p_outcome -> 'balls') <> 'array' then
    raise exception 'The outcome has no balls.';
  end if;
  v_count := jsonb_array_length(p_outcome -> 'balls');
  if v_count < v_play.ball_count or v_count > v_play.ball_count * 2 then
    raise exception 'The outcome has % balls for a play of %.', v_count, v_play.ball_count;
  end if;

  v_rows := (v_play.machine ->> 'rows')::integer;
  v_multiplier_scale := (v_play.machine ->> 'multiplierScalePercent')::integer;

  for v_ball in select value from jsonb_array_elements(p_outcome -> 'balls')
  loop
    v_ball_index := (v_ball ->> 'ballIndex')::integer;
    v_parent_index := (v_ball ->> 'parentIndex')::integer;
    v_pocket_index := (v_ball ->> 'pocketIndex')::integer;
    v_landed_tick := (v_ball ->> 'landedTick')::integer;
    v_essence := (v_ball ->> 'essenceWon')::integer;
    v_rarity := v_ball ->> 'boxRarity';
    if v_ball_index is null or v_ball_index < 0 or v_ball_index >= v_count then
      raise exception 'A ball is out of order.';
    end if;
    if v_ball_index < v_play.ball_count and v_parent_index is not null then
      raise exception 'A paid ball cannot have a parent.';
    end if;
    if v_ball_index >= v_play.ball_count and (v_parent_index is null or v_parent_index >= v_play.ball_count) then
      raise exception 'A split ball must name a paid parent.';
    end if;
    if v_pocket_index is null or v_pocket_index < 0 or v_pocket_index > v_rows then
      raise exception 'A ball landed outside the board.';
    end if;
    v_expected := (
      v_play.stake_price
      * (v_play.machine -> 'pockets' -> v_pocket_index ->> 'multiplierPercent')::integer
      * v_multiplier_scale
    ) / 10000;
    if v_essence is distinct from v_expected then
      raise exception 'Ball % claims % Essence; the pocket pays %.', v_ball_index, v_essence, v_expected;
    end if;
    if v_rarity is not null and v_rarity not in ('common', 'uncommon', 'rare', 'epic') then
      raise exception 'The Gamba does not give % boxes.', v_rarity;
    end if;

    insert into public.divine_gamba_play_balls (
      play_id, ball_index, parent_index, pocket_index, landed_tick, essence_won, box_rarity
    ) values (
      v_play.id, v_ball_index, v_parent_index, v_pocket_index, coalesce(v_landed_tick, 0), v_essence, v_rarity
    );

    v_won := v_won + v_essence;
    if v_rarity is not null then
      v_boxes := v_boxes + 1;
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'definitionId', 'loot-box-' || v_rarity,
        'quantity', 1,
        'metadata', jsonb_build_object(
          'source', 'divine-gamba',
          'playId', v_play.id,
          'ballIndex', v_ball_index,
          'pocketIndex', v_pocket_index,
          'boxRarity', v_rarity
        )
      ));
    end if;
  end loop;

  update public.meta_wallets as wallets
  set essence_balance = wallets.essence_balance + v_won,
      essence_earned = wallets.essence_earned + v_won,
      updated_at = now()
  where wallets.profile_id = v_play.profile_id
  returning wallets.essence_balance into v_balance;
  if v_balance is null then
    raise exception 'The player has no wallet.';
  end if;

  if v_boxes > 0 then
    for v_granted in
      select * from public.grant_inventory_items_to(
        v_play.profile_id,
        'divine-gamba:' || v_play.id || ':boxes',
        'divine-gamba',
        v_play.id::text,
        v_items
      )
    loop
      update public.divine_gamba_play_balls as balls
      set box_instance_id = v_granted.item_instance_id
      where balls.play_id = v_play.id
        and balls.ball_index = (v_granted.metadata ->> 'ballIndex')::integer;
    end loop;
  end if;

  select jsonb_agg(jsonb_build_object(
    'ball_index', balls.ball_index,
    'parent_index', balls.parent_index,
    'pocket_index', balls.pocket_index,
    'landed_tick', balls.landed_tick,
    'essence_won', balls.essence_won,
    'box_rarity', balls.box_rarity,
    'box_definition_id', case when balls.box_rarity is null then null else 'loot-box-' || balls.box_rarity end,
    'box_instance_id', balls.box_instance_id
  ) order by balls.ball_index)
  into v_balls
  from public.divine_gamba_play_balls as balls
  where balls.play_id = v_play.id;

  v_result := jsonb_build_object(
    'play_id', v_play.id,
    'essence_spent', v_play.essence_spent,
    'essence_won', v_won,
    'box_count', v_boxes,
    'essence_balance', v_balance,
    'balls', coalesce(v_balls, '[]'::jsonb)
  );

  update public.divine_gamba_plays as plays
  set status = 'settled',
      essence_won = v_won,
      box_count = v_boxes,
      result = v_result,
      settled_at = now()
  where plays.id = v_play.id;

  return v_result || jsonb_build_object('was_processed', true);
end;
$$;

revoke all on function public.settle_divine_gamba_play(bigint, jsonb)
  from public, anon, authenticated;
grant execute on function public.settle_divine_gamba_play(bigint, jsonb) to service_role;

/*
 * The plays a player has paid for that nobody has settled yet.
 *
 * Read on every visit to the machine, so a settlement that failed, or a tab
 * closed mid-drop, is picked up and finished before the next play.
 */
create function public.list_divine_gamba_pending_plays()
returns jsonb
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_plays jsonb;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required.';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'play_id', plays.id,
    'seed', plays.seed,
    'sim_version', plays.sim_version,
    'stake', plays.stake,
    'ball_count', plays.ball_count,
    'stake_price', plays.stake_price,
    'price_per_ball', plays.price_per_ball,
    'modifier_ids', plays.modifier_ids,
    'machine', plays.machine,
    'essence_spent', plays.essence_spent,
    'created_at', plays.created_at
  ) order by plays.created_at), '[]'::jsonb)
  into v_plays
  from public.divine_gamba_plays as plays
  where plays.profile_id = v_profile_id and plays.status = 'pending';
  return v_plays;
end;
$$;

revoke all on function public.list_divine_gamba_pending_plays() from public, anon;
grant execute on function public.list_divine_gamba_pending_plays() to authenticated;

/*
 * Buying from the Shardwright.
 *
 * Essence from the wallet and rift shards from the bag, in one transaction,
 * through the same operation ledger as everything else the player buys. The
 * price comes from the definition, never from the request.
 */
create function public.buy_divine_gamba_part(
  p_operation_id text,
  p_part_id text
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_operation public.inventory_operations%rowtype;
  v_definition public.divine_gamba_part_definitions%rowtype;
  v_required public.divine_gamba_part_definitions%rowtype;
  v_balance bigint;
  v_result jsonb;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to buy.';
  end if;
  if coalesce(length(trim(p_operation_id)), 0) = 0 then
    raise exception 'A non-empty operation ID is required.';
  end if;

  select definitions.* into v_definition
  from public.divine_gamba_part_definitions as definitions
  where definitions.id = p_part_id and definitions.active;
  if not found then
    raise exception 'The Shardwright does not sell that.';
  end if;

  v_operation := public.inventory_claim_operation(
    v_profile_id, p_operation_id, 'divine-gamba-buy',
    jsonb_build_object('partId', p_part_id)
  );
  if v_operation.status = 'completed' then
    return v_operation.result || jsonb_build_object('was_processed', false);
  end if;

  if exists (
    select 1 from public.divine_gamba_parts as parts
    where parts.profile_id = v_profile_id and parts.part_id = p_part_id
  ) then
    raise exception 'The % is already installed.', v_definition.name;
  end if;
  if v_definition.requires_part_id is not null and not exists (
    select 1 from public.divine_gamba_parts as parts
    where parts.profile_id = v_profile_id and parts.part_id = v_definition.requires_part_id
  ) then
    select definitions.* into v_required
    from public.divine_gamba_part_definitions as definitions
    where definitions.id = v_definition.requires_part_id;
    raise exception 'Install the % first.', coalesce(v_required.name, v_definition.requires_part_id);
  end if;

  insert into public.meta_wallets (profile_id)
  values (v_profile_id)
  on conflict on constraint meta_wallets_pkey do nothing;

  select wallets.essence_balance into v_balance
  from public.meta_wallets as wallets
  where wallets.profile_id = v_profile_id
  for update;
  if v_balance < v_definition.essence_cost then
    raise exception 'Not enough Essence.';
  end if;

  if v_definition.shard_cost > 0 then
    perform public.camp_consume_material(v_profile_id, 'rift-shard', v_definition.shard_cost);
  end if;

  update public.meta_wallets as wallets
  set essence_balance = wallets.essence_balance - v_definition.essence_cost,
      essence_spent = wallets.essence_spent + v_definition.essence_cost,
      updated_at = now()
  where wallets.profile_id = v_profile_id
  returning wallets.essence_balance into v_balance;

  insert into public.divine_gamba_parts (profile_id, part_id, operation_id)
  values (v_profile_id, p_part_id, p_operation_id);

  v_result := jsonb_build_object(
    'part_id', p_part_id,
    'essence_spent', v_definition.essence_cost,
    'shards_spent', v_definition.shard_cost,
    'essence_balance', v_balance
  );

  update public.inventory_operations as operations
  set status = 'completed', result = v_result, completed_at = now()
  where operations.profile_id = v_profile_id
    and operations.operation_id = p_operation_id;

  return v_result || jsonb_build_object('was_processed', true);
end;
$$;

revoke all on function public.buy_divine_gamba_part(text, text) from public, anon;
grant execute on function public.buy_divine_gamba_part(text, text) to authenticated;
