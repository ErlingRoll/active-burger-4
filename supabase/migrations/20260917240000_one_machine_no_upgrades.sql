-- One machine, and no upgrades.
--
-- The Shardwright's shelf is withdrawn: there are no parts to fit and no
-- modifiers to switch on, so every player plays the same machine and the
-- odds on the screen are the odds for everyone. The fold from parts to a
-- machine, the check that held it to its TypeScript twin, the part tables
-- and the purchase function all go. A play still freezes the machine it was
-- paid for, built here from the settings and the pocket table, and the
-- settlement still re-checks every ball against it.
--
-- The pocket table is retuned at the same time. A drop should profit a
-- little under half the time, and with a ×10 jackpot that pushed the return
-- to player above one, because the jackpot's Essence went to drops that
-- would have profited anyway. The jackpot is ×6 and the pocket just inside
-- the winners pays nearly the ball back; the return sits just under one
-- and a drop of three balls or more profits between forty and fifty
-- percent, measured by tests/divineGambaOdds.test.ts.
--
-- Balls no longer split, so a settled ball has no parent; the column goes.

drop function public.buy_divine_gamba_part(text, text);
drop function public.divine_gamba_check_machine(text, jsonb, jsonb, jsonb);
drop function public.divine_gamba_resolve_machine(jsonb, jsonb);

drop table public.divine_gamba_parts;
drop table public.divine_gamba_part_definitions;

alter table public.divine_gamba_plays
  drop column modifier_ids;

alter table public.divine_gamba_play_balls
  drop column parent_index;

alter table public.divine_gamba_settings
  add column board_rows integer not null default 8 check (board_rows between 4 and 16);

insert into public.divine_gamba_settings (id, base_ball_price, board_rows, box_rarity_weights, sim_version)
values ('default', 20, 8, '{"common":550,"uncommon":300,"rare":120,"epic":29,"legendary":1}'::jsonb, 1)
on conflict (id) do update
set base_ball_price = excluded.base_ball_price,
    board_rows = excluded.board_rows,
    box_rarity_weights = excluded.box_rarity_weights,
    sim_version = excluded.sim_version;

delete from public.divine_gamba_pocket_tables where row_count <> 8;

insert into public.divine_gamba_pocket_tables (
  row_count, pocket_index, multiplier_percent, box_chance_basis_points
) values
  (8, 0, 600, 10000),
  (8, 1, 200, 0),
  (8, 2, 160, 0),
  (8, 3, 90, 0),
  (8, 4, 25, 0),
  (8, 5, 90, 0),
  (8, 6, 160, 0),
  (8, 7, 200, 0),
  (8, 8, 600, 10000)
on conflict (row_count, pocket_index) do update
set multiplier_percent = excluded.multiplier_percent,
    box_chance_basis_points = excluded.box_chance_basis_points;

/* The machine as the simulation reads it, built from the settings and the pocket table. */
create function public.divine_gamba_machine()
returns jsonb
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  v_settings public.divine_gamba_settings%rowtype;
  v_pockets jsonb;
begin
  select * into v_settings from public.divine_gamba_settings where id = 'default';
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'multiplierPercent', pockets.multiplier_percent,
      'boxChanceBasisPoints', pockets.box_chance_basis_points
    ) order by pockets.pocket_index
  ), '[]'::jsonb)
  into v_pockets
  from public.divine_gamba_pocket_tables as pockets
  where pockets.row_count = v_settings.board_rows;
  if jsonb_array_length(v_pockets) <> v_settings.board_rows + 1 then
    raise exception 'The pocket table for % rows is incomplete.', v_settings.board_rows;
  end if;
  return jsonb_build_object(
    'rows', v_settings.board_rows,
    'pockets', v_pockets,
    'boxRarityWeights', v_settings.box_rarity_weights
  );
end;
$$;

revoke all on function public.divine_gamba_machine() from public, anon;

drop function public.begin_divine_gamba_play(text, integer, integer, jsonb);

create function public.begin_divine_gamba_play(
  p_operation_id text,
  p_ball_count integer,
  p_stake integer
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_operation public.inventory_operations%rowtype;
  v_settings public.divine_gamba_settings%rowtype;
  v_machine jsonb;
  v_stake_price integer;
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
  if p_stake is null or p_stake not in (1, 2, 5) then
    raise exception 'Invalid stake.';
  end if;

  v_operation := public.inventory_claim_operation(
    v_profile_id, p_operation_id, 'divine-gamba-play',
    jsonb_build_object('ballCount', p_ball_count, 'stake', p_stake)
  );
  if v_operation.status = 'completed' then
    return v_operation.result || jsonb_build_object('was_processed', false);
  end if;

  select * into v_settings from public.divine_gamba_settings where id = 'default';
  v_machine := public.divine_gamba_machine();
  v_stake_price := v_settings.base_ball_price * p_stake;
  v_cost := v_stake_price::bigint * p_ball_count;

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
    stake_price, price_per_ball, machine, essence_spent
  ) values (
    v_profile_id, p_operation_id, v_seed, v_settings.sim_version, p_stake, p_ball_count,
    v_stake_price, v_stake_price, v_machine, v_cost
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

revoke all on function public.begin_divine_gamba_play(text, integer, integer)
  from public, anon;
grant execute on function public.begin_divine_gamba_play(text, integer, integer)
  to authenticated;

create or replace function public.list_divine_gamba_pending_plays()
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

create or replace function public.settle_divine_gamba_play(
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
  v_ball_index integer;
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
  if v_count <> v_play.ball_count then
    raise exception 'The outcome has % balls for a play of %.', v_count, v_play.ball_count;
  end if;

  v_rows := (v_play.machine ->> 'rows')::integer;

  for v_ball in select value from jsonb_array_elements(p_outcome -> 'balls')
  loop
    v_ball_index := (v_ball ->> 'ballIndex')::integer;
    v_pocket_index := (v_ball ->> 'pocketIndex')::integer;
    v_landed_tick := (v_ball ->> 'landedTick')::integer;
    v_essence := (v_ball ->> 'essenceWon')::integer;
    v_rarity := v_ball ->> 'boxRarity';
    if v_ball_index is null or v_ball_index < 0 or v_ball_index >= v_count then
      raise exception 'A ball is out of order.';
    end if;
    if v_pocket_index is null or v_pocket_index < 0 or v_pocket_index > v_rows then
      raise exception 'A ball landed outside the board.';
    end if;
    v_expected := (
      v_play.stake_price
      * (v_play.machine -> 'pockets' -> v_pocket_index ->> 'multiplierPercent')::integer
    ) / 100;
    if v_essence is distinct from v_expected then
      raise exception 'Ball % claims % Essence; the pocket pays %.', v_ball_index, v_essence, v_expected;
    end if;
    if v_rarity is not null and v_rarity not in ('common', 'uncommon', 'rare', 'epic', 'legendary') then
      raise exception 'The Gamba does not give % boxes.', v_rarity;
    end if;

    insert into public.divine_gamba_play_balls (
      play_id, ball_index, pocket_index, landed_tick, essence_won, box_rarity
    ) values (
      v_play.id, v_ball_index, v_pocket_index, coalesce(v_landed_tick, 0), v_essence, v_rarity
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
