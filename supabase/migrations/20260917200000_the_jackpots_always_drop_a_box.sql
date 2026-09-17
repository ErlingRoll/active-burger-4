-- The jackpots always drop a box, and a box can be legendary.
--
-- The outermost pockets carried a box four times in ten; they now carry one
-- every time, so reaching one is a payout and a box together. Boxes are as
-- rare as jackpots, which the odds tests hold under a ball in twenty however
-- the machine is fitted. The rarity weights move to tenths of a percent so a
-- legendary box can be one in a thousand.
--
-- Two parts lose their meaning when the jackpots are certain, and are
-- reworked rather than retired: the jackpot lining now lines the pockets
-- beside the jackpots, where one ball in four brings a box, and the lucky
-- lining shifts every box's rarity upward. The fold and the settlement learn
-- both; the check block at the end holds the fold to its TypeScript twin as
-- before, with the fixtures regenerated.

insert into public.divine_gamba_settings (id, base_ball_price, box_rarity_weights, sim_version)
values ('default', 20, '{"common":550,"uncommon":300,"rare":120,"epic":29,"legendary":1}'::jsonb, 1)
on conflict (id) do update
set base_ball_price = excluded.base_ball_price,
    box_rarity_weights = excluded.box_rarity_weights,
    sim_version = excluded.sim_version;

insert into public.divine_gamba_pocket_tables (
  row_count, pocket_index, multiplier_percent, box_chance_basis_points
) values
  (8, 0, 1000, 10000),
  (8, 8, 1000, 10000),
  (10, 0, 3000, 10000),
  (10, 10, 3000, 10000)
on conflict (row_count, pocket_index) do update
set multiplier_percent = excluded.multiplier_percent,
    box_chance_basis_points = excluded.box_chance_basis_points;

insert into public.divine_gamba_part_definitions (
  id, kind, name, description, essence_cost, shard_cost, price_percent,
  requires_part_id, sort_order, effect
) values
  ('jackpot-pocket', 'part', 'Lined pockets', 'A rift lining in the pockets beside the jackpots. One ball in four that lands there brings a box.', 800, 16, 0, null, 1, '{"kind":"box-chance-inner","basisPoints":2500}'::jsonb),
  ('lucky-lining', 'modifier', 'Lucky lining', 'Every box that falls is half again as likely to be uncommon or better. Each ball costs a tenth more.', 700, 14, 10, 'jackpot-pocket', 13, '{"kind":"rarity-shift","percent":150}'::jsonb)
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

alter table public.divine_gamba_play_balls
  drop constraint divine_gamba_play_balls_box_rarity_check;

alter table public.divine_gamba_play_balls
  add constraint divine_gamba_play_balls_box_rarity_check
  check (box_rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary'));

create or replace function public.divine_gamba_resolve_machine(
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
  v_inner_box integer := null;
  v_rarity_shift integer := 100;
  v_price integer := 100;
  v_weights jsonb;
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
    elsif v_kind = 'box-chance-inner' then
      v_inner_box := (v_definition.effect ->> 'basisPoints')::integer;
    elsif v_kind = 'rarity-shift' then
      v_rarity_shift := (v_rarity_shift * (v_definition.effect ->> 'percent')::integer) / 100;
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
          when v_inner_box is not null and (pockets.pocket_index = 1 or pockets.pocket_index = v_rows - 1)
          then v_inner_box
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

  -- A rarity shift scales every weight above common, floored, as the client does.
  select coalesce(jsonb_object_agg(
    weights.key,
    case when weights.key = 'common' then (weights.value)::integer
         else ((weights.value)::integer * v_rarity_shift) / 100 end
  ), '{}'::jsonb)
  into v_weights
  from jsonb_each_text(v_settings.box_rarity_weights) as weights(key, value);

  return jsonb_build_object(
    'rows', v_rows,
    'pockets', v_pockets,
    'multiplierScalePercent', v_multiplier_scale,
    'boxChanceScalePercent', v_box_scale,
    'boxRarityWeights', v_weights,
    'pricePercent', v_price,
    'effects', v_effects,
    'allowedStakes', v_sorted_stakes
  );
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
    if v_rarity is not null and v_rarity not in ('common', 'uncommon', 'rare', 'epic', 'legendary') then
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


-- Generated from tests/fixtures/divineGambaMachines.json;
-- tests/divineGambaRegistry.test.ts holds this block to that file.
do $$
begin
  perform public.divine_gamba_check_machine(
    'bare',
    '[]'::jsonb,
    '[]'::jsonb,
    '{"rows":8,"pockets":[{"multiplierPercent":1000,"boxChanceBasisPoints":10000},{"multiplierPercent":300,"boxChanceBasisPoints":0},{"multiplierPercent":120,"boxChanceBasisPoints":0},{"multiplierPercent":60,"boxChanceBasisPoints":0},{"multiplierPercent":30,"boxChanceBasisPoints":0},{"multiplierPercent":60,"boxChanceBasisPoints":0},{"multiplierPercent":120,"boxChanceBasisPoints":0},{"multiplierPercent":300,"boxChanceBasisPoints":0},{"multiplierPercent":1000,"boxChanceBasisPoints":10000}],"multiplierScalePercent":100,"boxChanceScalePercent":100,"boxRarityWeights":{"common":550,"uncommon":300,"rare":120,"epic":29,"legendary":1},"pricePercent":100,"effects":[],"allowedStakes":[1]}'::jsonb
  );
  perform public.divine_gamba_check_machine(
    'a-modifier-owned-but-off',
    '["rift-magnet"]'::jsonb,
    '[]'::jsonb,
    '{"rows":8,"pockets":[{"multiplierPercent":1000,"boxChanceBasisPoints":10000},{"multiplierPercent":300,"boxChanceBasisPoints":0},{"multiplierPercent":120,"boxChanceBasisPoints":0},{"multiplierPercent":60,"boxChanceBasisPoints":0},{"multiplierPercent":30,"boxChanceBasisPoints":0},{"multiplierPercent":60,"boxChanceBasisPoints":0},{"multiplierPercent":120,"boxChanceBasisPoints":0},{"multiplierPercent":300,"boxChanceBasisPoints":0},{"multiplierPercent":1000,"boxChanceBasisPoints":10000}],"multiplierScalePercent":100,"boxChanceScalePercent":100,"boxRarityWeights":{"common":550,"uncommon":300,"rare":120,"epic":29,"legendary":1},"pricePercent":100,"effects":[],"allowedStakes":[1]}'::jsonb
  );
  perform public.divine_gamba_check_machine(
    'a-modifier-on',
    '["rift-magnet"]'::jsonb,
    '["rift-magnet"]'::jsonb,
    '{"rows":8,"pockets":[{"multiplierPercent":1000,"boxChanceBasisPoints":10000},{"multiplierPercent":300,"boxChanceBasisPoints":0},{"multiplierPercent":120,"boxChanceBasisPoints":0},{"multiplierPercent":60,"boxChanceBasisPoints":0},{"multiplierPercent":30,"boxChanceBasisPoints":0},{"multiplierPercent":60,"boxChanceBasisPoints":0},{"multiplierPercent":120,"boxChanceBasisPoints":0},{"multiplierPercent":300,"boxChanceBasisPoints":0},{"multiplierPercent":1000,"boxChanceBasisPoints":10000}],"multiplierScalePercent":100,"boxChanceScalePercent":100,"boxRarityWeights":{"common":550,"uncommon":300,"rare":120,"epic":29,"legendary":1},"pricePercent":135,"effects":[{"kind":"scatter","strengthBasisPoints":600}],"allowedStakes":[1]}'::jsonb
  );
  perform public.divine_gamba_check_machine(
    'stakes-and-rails',
    '["high-stakes-5","high-stakes-2","brass-rails"]'::jsonb,
    '[]'::jsonb,
    '{"rows":8,"pockets":[{"multiplierPercent":1000,"boxChanceBasisPoints":10000},{"multiplierPercent":300,"boxChanceBasisPoints":0},{"multiplierPercent":120,"boxChanceBasisPoints":0},{"multiplierPercent":60,"boxChanceBasisPoints":0},{"multiplierPercent":30,"boxChanceBasisPoints":0},{"multiplierPercent":60,"boxChanceBasisPoints":0},{"multiplierPercent":120,"boxChanceBasisPoints":0},{"multiplierPercent":300,"boxChanceBasisPoints":0},{"multiplierPercent":1000,"boxChanceBasisPoints":10000}],"multiplierScalePercent":105,"boxChanceScalePercent":100,"boxRarityWeights":{"common":550,"uncommon":300,"rare":120,"epic":29,"legendary":1},"pricePercent":100,"effects":[],"allowedStakes":[1,2,5]}'::jsonb
  );
  perform public.divine_gamba_check_machine(
    'jackpot-and-lining',
    '["jackpot-pocket","lucky-lining"]'::jsonb,
    '["lucky-lining"]'::jsonb,
    '{"rows":8,"pockets":[{"multiplierPercent":1000,"boxChanceBasisPoints":10000},{"multiplierPercent":300,"boxChanceBasisPoints":2500},{"multiplierPercent":120,"boxChanceBasisPoints":0},{"multiplierPercent":60,"boxChanceBasisPoints":0},{"multiplierPercent":30,"boxChanceBasisPoints":0},{"multiplierPercent":60,"boxChanceBasisPoints":0},{"multiplierPercent":120,"boxChanceBasisPoints":0},{"multiplierPercent":300,"boxChanceBasisPoints":2500},{"multiplierPercent":1000,"boxChanceBasisPoints":10000}],"multiplierScalePercent":100,"boxChanceScalePercent":100,"boxRarityWeights":{"common":550,"uncommon":450,"rare":180,"epic":43,"legendary":1},"pricePercent":110,"effects":[],"allowedStakes":[1]}'::jsonb
  );
  perform public.divine_gamba_check_machine(
    'tall-frame',
    '["brass-rails","tall-frame","jackpot-pocket"]'::jsonb,
    '[]'::jsonb,
    '{"rows":10,"pockets":[{"multiplierPercent":3000,"boxChanceBasisPoints":10000},{"multiplierPercent":600,"boxChanceBasisPoints":2500},{"multiplierPercent":200,"boxChanceBasisPoints":0},{"multiplierPercent":100,"boxChanceBasisPoints":0},{"multiplierPercent":50,"boxChanceBasisPoints":0},{"multiplierPercent":30,"boxChanceBasisPoints":0},{"multiplierPercent":50,"boxChanceBasisPoints":0},{"multiplierPercent":100,"boxChanceBasisPoints":0},{"multiplierPercent":200,"boxChanceBasisPoints":0},{"multiplierPercent":600,"boxChanceBasisPoints":2500},{"multiplierPercent":3000,"boxChanceBasisPoints":10000}],"multiplierScalePercent":105,"boxChanceScalePercent":100,"boxRarityWeights":{"common":550,"uncommon":300,"rare":120,"epic":29,"legendary":1},"pricePercent":100,"effects":[],"allowedStakes":[1]}'::jsonb
  );
  perform public.divine_gamba_check_machine(
    'everything',
    '["brass-rails","jackpot-pocket","high-stakes-2","high-stakes-5","tall-frame","steady-hand","rift-magnet","splitter","lucky-lining"]'::jsonb,
    '["steady-hand","rift-magnet","splitter","lucky-lining"]'::jsonb,
    '{"rows":10,"pockets":[{"multiplierPercent":3000,"boxChanceBasisPoints":10000},{"multiplierPercent":600,"boxChanceBasisPoints":2500},{"multiplierPercent":200,"boxChanceBasisPoints":0},{"multiplierPercent":100,"boxChanceBasisPoints":0},{"multiplierPercent":50,"boxChanceBasisPoints":0},{"multiplierPercent":30,"boxChanceBasisPoints":0},{"multiplierPercent":50,"boxChanceBasisPoints":0},{"multiplierPercent":100,"boxChanceBasisPoints":0},{"multiplierPercent":200,"boxChanceBasisPoints":0},{"multiplierPercent":600,"boxChanceBasisPoints":2500},{"multiplierPercent":3000,"boxChanceBasisPoints":10000}],"multiplierScalePercent":105,"boxChanceScalePercent":100,"boxRarityWeights":{"common":550,"uncommon":450,"rare":180,"epic":43,"legendary":1},"pricePercent":175,"effects":[{"kind":"gravity","percent":160},{"kind":"scatter","strengthBasisPoints":600},{"kind":"split","chanceBasisPoints":2500,"row":3}],"allowedStakes":[1,2,5]}'::jsonb
  );
  perform public.divine_gamba_check_machine(
    'unknown-and-unowned-ignored',
    '["brass-rails","not-a-part"]'::jsonb,
    '["splitter","not-a-part"]'::jsonb,
    '{"rows":8,"pockets":[{"multiplierPercent":1000,"boxChanceBasisPoints":10000},{"multiplierPercent":300,"boxChanceBasisPoints":0},{"multiplierPercent":120,"boxChanceBasisPoints":0},{"multiplierPercent":60,"boxChanceBasisPoints":0},{"multiplierPercent":30,"boxChanceBasisPoints":0},{"multiplierPercent":60,"boxChanceBasisPoints":0},{"multiplierPercent":120,"boxChanceBasisPoints":0},{"multiplierPercent":300,"boxChanceBasisPoints":0},{"multiplierPercent":1000,"boxChanceBasisPoints":10000}],"multiplierScalePercent":105,"boxChanceScalePercent":100,"boxRarityWeights":{"common":550,"uncommon":300,"rare":120,"epic":29,"legendary":1},"pricePercent":100,"effects":[],"allowedStakes":[1]}'::jsonb
  );
end;
$$;
