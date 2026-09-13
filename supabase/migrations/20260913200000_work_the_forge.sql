-- Working the Forge: a stake, a strike, and an artifact that wears out.
--
-- The Forge used to reroll an artifact whole for scrap and shards, as often
-- as the player could pay. That made it a lottery with no end, and it gave
-- the quarry nothing to do. It is now one action, `work_artifact_at_forge`:
-- the player names the line they want raised (or asks for a promotion), pays
-- a fee in stone, scrap and rift shards set by the artifact's rarity, and
-- stakes as much Essence as they like up to a cap. More Essence raises the
-- chance the strike lands, and the chance it lands where it was aimed, with
-- diminishing returns; it never makes either certain.
--
-- Every artifact now carries Potential, rolled between thirty and a hundred
-- when it is made. A strike that lands spends ten to twenty of it; one that
-- misses spends one to ten, and one miss in five also slips a line down a
-- tier. At zero the artifact is finished: the Forge refuses it, whatever it
-- turned into. Artifacts made before this migration are given fifty.
--
-- What a strike can do, in the terms the roll already uses:
--   raise a line a tier, the implicit or a modifier, and reroll its value
--     inside the new tier's range;
--   promote the artifact a rarity, which adds one modifier from the pool,
--     because a rarity always carries its rank plus one;
--   slip a line a tier, on the one miss in five that goes wrong.
-- The odds, the fee table and the Potential costs are mirrored in
-- src/camp/Forge.ts, and src/camp/Forge.test.ts reads this file to hold the
-- two together. The block at the end asserts the odds against fixed stakes.

-- 1. Potential.

create or replace function public.enrich_artifact_metadata()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_category text;
begin
  select definitions.category
    into v_category
  from public.inventory_item_definitions as definitions
  where definitions.id = new.definition_id
    and definitions.active;
  if v_category = 'artifact' then
    new.metadata := public.roll_artifact_metadata(new.id, new.definition_id, new.metadata);
    -- Potential is rolled once, from the same id every other roll comes
    -- from, and honoured when the metadata already carries one: that is how
    -- an artifact keeps its wear through a retried grant.
    if coalesce(jsonb_typeof(new.metadata -> 'potential'), '') <> 'number' then
      new.metadata := new.metadata || jsonb_build_object(
        'potential', 30 + public.artifact_hash_roll(new.id, 'potential', 71)
      );
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enrich_artifact_metadata() from public;

-- Every artifact that exists already, wherever it is (in the bag, held by a
-- run at quantity zero, or inside a Champion), starts with fifty.
update public.inventory_item_instances as instances
set metadata = instances.metadata || '{"potential": 50}'::jsonb
from public.inventory_item_definitions as definitions
where definitions.id = instances.definition_id
  and definitions.category = 'artifact'
  and coalesce(jsonb_typeof(instances.metadata -> 'potential'), '') <> 'number';

-- 2. The ledger type. `camp-reforge` stays in the list so the rows the old
-- action wrote keep passing the constraint.

alter table public.inventory_operations
  drop constraint inventory_operations_operation_type_check;

alter table public.inventory_operations
  add constraint inventory_operations_operation_type_check
  check (
    operation_type in (
      'grant', 'consume', 'reserve', 'release', 'salvage', 'salvage-sweep', 'craft',
      'sell', 'buy', 'camp-claim', 'camp-upgrade', 'camp-gut', 'camp-cure', 'camp-reforge',
      'camp-forge', 'contract-claim'
    )
  );

-- 3. The odds, in basis points, for a stake of Essence.
--
-- Both bonuses follow the same curve, stake / (stake + 25000): half the bonus
-- at twenty-five thousand, four fifths at a hundred thousand, and never all
-- of it. Integer arithmetic throughout so the client's copy agrees to the
-- point. The setback chance is fixed: no stake buys safety from a slip.
create function public.forge_odds(p_essence bigint)
returns table (success_bp integer, focus_bp integer, setback_bp integer)
language sql
immutable
security definer set search_path = ''
as $$
  select
    (3000 + (4500 * stake.essence) / (stake.essence + 25000))::integer,
    (6000 + (2500 * stake.essence) / (stake.essence + 25000))::integer,
    2000
  from (select least(greatest(coalesce(p_essence, 0), 0), 100000) as essence) as stake;
$$;

revoke all on function public.forge_odds(bigint) from public;

-- The fixed fee, by the artifact's rarity: the stone the quarry has had no
-- sink for, the scrap runs leave behind, and the shards the Abyss pays.
create function public.forge_fee(p_rarity text)
returns jsonb
language sql
immutable
security definer set search_path = ''
as $$
  select case p_rarity
    when 'uncommon' then '{"stone": 20, "scrap": 20, "rift-shard": 2}'::jsonb
    when 'rare' then '{"stone": 40, "scrap": 30, "rift-shard": 3}'::jsonb
    when 'epic' then '{"stone": 80, "scrap": 45, "rift-shard": 5}'::jsonb
    when 'legendary' then '{"stone": 160, "scrap": 70, "rift-shard": 8}'::jsonb
    else '{"stone": 10, "scrap": 10, "rift-shard": 1}'::jsonb
  end;
$$;

revoke all on function public.forge_fee(text) from public;

-- Moves one line of an artifact a tier in either direction and rerolls its
-- value inside the new tier's range. `p_key` is 'implicit' or
-- 'modifier:<id>'. The tier is clamped; a line at its end stays where it is.
create function public.forge_shift_line(
  p_metadata jsonb,
  p_key text,
  p_delta integer,
  p_seed uuid
)
returns jsonb
language plpgsql
immutable
security definer set search_path = ''
as $$
declare
  v_id text;
  v_tier integer;
  v_range integer[];
  v_value integer;
  v_modifiers jsonb;
begin
  if p_key = 'implicit' then
    v_id := p_metadata -> 'implicit' ->> 'id';
    v_tier := least(5, greatest(1, (p_metadata -> 'implicit' ->> 'tier')::integer + p_delta));
  else
    v_id := substring(p_key from 'modifier:(.*)');
    select (entry ->> 'tier')::integer into v_tier
    from jsonb_array_elements(p_metadata -> 'modifiers') as entries(entry)
    where entry ->> 'id' = v_id;
    if v_tier is null then
      raise exception 'The artifact has no line %.', v_id;
    end if;
    v_tier := least(5, greatest(1, v_tier + p_delta));
  end if;

  v_range := public.artifact_effect_tier_range(v_id, v_tier);
  v_value := v_range[1] + public.artifact_hash_roll(
    p_seed, 'value:' || v_id || ':' || v_tier::text, v_range[2] - v_range[1] + 1
  );

  if p_key = 'implicit' then
    return p_metadata || jsonb_build_object(
      'implicit', (p_metadata -> 'implicit') || jsonb_build_object('tier', v_tier, 'value', v_value)
    );
  end if;

  select jsonb_agg(
    case when entry ->> 'id' = v_id
      then entry || jsonb_build_object('tier', v_tier, 'value', v_value)
      else entry
    end
    order by ordinality
  ) into v_modifiers
  from jsonb_array_elements(p_metadata -> 'modifiers') with ordinality as entries(entry, ordinality);
  return p_metadata || jsonb_build_object('modifiers', v_modifiers);
end;
$$;

revoke all on function public.forge_shift_line(jsonb, text, integer, uuid) from public;

-- 4. The action.

drop function if exists public.reforge_artifact(text, uuid);

/*
 * One strike at the Forge. `p_target` is 'implicit', 'modifier:<id>' or
 * 'promote'; `p_essence` is the stake, nought to a hundred thousand. The fee
 * and the stake are spent whatever the outcome; that is the risk. Every roll
 * comes from a seed the artifact has not used before (its id and a strike
 * count kept on its metadata), so a retry cannot roll twice and a strike
 * cannot be undone by asking for the old seed. An artifact held by a run has
 * no quantity in the bag and is refused, as is one whose Potential is spent.
 *
 * Outcomes: 'target' (the line asked for moved), 'stray' (a strike that
 * landed on another line, or promoted instead), 'miss' (nothing changed but
 * the Potential), 'setback' (a miss that also slipped a line a tier).
 */
create function public.work_artifact_at_forge(
  p_operation_id text,
  p_artifact_instance_id uuid,
  p_target text,
  p_essence bigint
)
returns table (
  definition_id text,
  metadata jsonb,
  outcome text,
  changed_line text,
  potential_spent integer,
  essence_spent bigint,
  stone_spent integer,
  scrap_spent integer,
  shards_spent integer,
  was_processed boolean
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_operation public.inventory_operations%rowtype;
  v_artifact public.inventory_item_instances%rowtype;
  v_metadata jsonb;
  v_rarity text;
  v_next_rarity text;
  v_potential integer;
  v_potential_spent integer;
  v_essence bigint := least(greatest(coalesce(p_essence, 0), 0), 100000);
  v_target text := coalesce(p_target, '');
  v_fee jsonb;
  v_stone integer;
  v_scrap integer;
  v_shards integer;
  v_balance bigint;
  v_count integer;
  v_seed uuid;
  v_success_bp integer;
  v_focus_bp integer;
  v_setback_bp integer;
  v_line jsonb;
  v_key text;
  v_raisable text[] := '{}'::text[];
  v_droppable text[] := '{}'::text[];
  v_present text[] := '{}'::text[];
  v_alternatives text[] := '{}'::text[];
  v_outcome text;
  v_changed text := null;
  v_pool text[] := array[
    'max-hp', 'movement-speed', 'attack-speed', 'cooldown-reduction',
    'area-of-effect', 'crit-chance', 'crit-multiplier', 'increased-damage',
    'dot-multiplier', 'melee-leech', 'kill-area-surge', 'kill-cooldown-reset',
    'primed-strike', 'last-stand', 'floor-shield', 'elite-damage',
    'experience-gain', 'healing-received'
  ];
  v_candidate text;
  v_attempt integer;
  v_new_id text := null;
  v_new_tier integer;
  v_tier_roll integer;
  v_range integer[];
  v_value integer;
  v_result jsonb;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required.';
  end if;
  if coalesce(length(trim(p_operation_id)), 0) = 0 then
    raise exception 'A non-empty inventory operation ID is required.';
  end if;
  if public.camp_building_level(v_profile_id, 'forge') < 1 then
    raise exception 'Build the Forge at the Camp first.';
  end if;
  if coalesce(p_essence, 0) < 0 or coalesce(p_essence, 0) > 100000 then
    raise exception 'Stake between 0 and 100,000 Essence.';
  end if;
  if v_target <> 'implicit' and v_target <> 'promote' and v_target not like 'modifier:%' then
    raise exception 'Choose what the Forge should work toward.';
  end if;

  v_operation := public.inventory_claim_operation(
    v_profile_id, p_operation_id, 'camp-forge',
    jsonb_build_object(
      'artifactInstanceId', p_artifact_instance_id,
      'target', v_target,
      'essence', v_essence
    )
  );
  if v_operation.status = 'completed' then
    return query
    select
      v_operation.result -> 0 ->> 'definition_id',
      v_operation.result -> 0 -> 'metadata',
      v_operation.result -> 0 ->> 'outcome',
      v_operation.result -> 0 ->> 'changed_line',
      (v_operation.result -> 0 ->> 'potential_spent')::integer,
      (v_operation.result -> 0 ->> 'essence_spent')::bigint,
      (v_operation.result -> 0 ->> 'stone_spent')::integer,
      (v_operation.result -> 0 ->> 'scrap_spent')::integer,
      (v_operation.result -> 0 ->> 'shards_spent')::integer,
      false;
    return;
  end if;

  select instances.* into v_artifact
  from public.inventory_item_instances as instances
  where instances.id = p_artifact_instance_id
    and instances.profile_id = v_profile_id
    and instances.quantity >= 1
  for update;
  if not found then
    raise exception 'Artifact not found, or it is away on a run.';
  end if;
  if not exists (
    select 1 from public.inventory_item_definitions as definitions
    where definitions.id = v_artifact.definition_id and definitions.category = 'artifact'
  ) then
    raise exception 'Only an artifact can be worked at the Forge.';
  end if;

  v_metadata := v_artifact.metadata;
  if coalesce(jsonb_typeof(v_metadata -> 'implicit'), '') <> 'object'
    or coalesce(jsonb_typeof(v_metadata -> 'modifiers'), '') <> 'array' then
    raise exception 'This artifact has no roll to work.';
  end if;
  v_rarity := coalesce(v_metadata ->> 'rarity', 'common');
  v_potential := coalesce((v_metadata ->> 'potential')::integer, 50);
  if v_potential < 1 then
    raise exception 'This artifact is finished. The Forge can do no more with it.';
  end if;
  v_next_rarity := case v_rarity
    when 'common' then 'uncommon'
    when 'uncommon' then 'rare'
    when 'rare' then 'epic'
    when 'epic' then 'legendary'
    else null
  end;

  -- The lines: which can still climb, which can still slip, and which
  -- modifiers are already on the artifact.
  if (v_metadata -> 'implicit' ->> 'tier')::integer > 1 then
    v_raisable := array_append(v_raisable, 'implicit');
  end if;
  if (v_metadata -> 'implicit' ->> 'tier')::integer < 5 then
    v_droppable := array_append(v_droppable, 'implicit');
  end if;
  for v_line in select entries.entry from jsonb_array_elements(v_metadata -> 'modifiers') as entries(entry) loop
    v_key := 'modifier:' || (v_line ->> 'id');
    v_present := array_append(v_present, v_line ->> 'id');
    if (v_line ->> 'tier')::integer > 1 then
      v_raisable := array_append(v_raisable, v_key);
    end if;
    if (v_line ->> 'tier')::integer < 5 then
      v_droppable := array_append(v_droppable, v_key);
    end if;
  end loop;

  if v_target = 'promote' then
    if v_next_rarity is null then
      raise exception 'A legendary artifact cannot be promoted.';
    end if;
  elsif not (v_target = any(v_raisable)) then
    raise exception 'That line is not on this artifact, or is already at its best tier.';
  end if;

  -- The fee, then the stake. Both go before the roll, so a player who cannot
  -- pay is refused before anything is decided.
  v_fee := public.forge_fee(v_rarity);
  v_stone := (v_fee ->> 'stone')::integer;
  v_scrap := (v_fee ->> 'scrap')::integer;
  v_shards := (v_fee ->> 'rift-shard')::integer;
  perform public.camp_consume_material(v_profile_id, 'stone', v_stone);
  perform public.camp_consume_material(v_profile_id, 'scrap', v_scrap);
  perform public.camp_consume_material(v_profile_id, 'rift-shard', v_shards);

  if v_essence > 0 then
    insert into public.meta_wallets (profile_id)
    values (v_profile_id)
    on conflict (profile_id) do nothing;
    select wallets.essence_balance into v_balance
    from public.meta_wallets as wallets
    where wallets.profile_id = v_profile_id
    for update;
    if coalesce(v_balance, 0) < v_essence then
      raise exception 'Not enough Essence.';
    end if;
    update public.meta_wallets as wallets
    set essence_balance = wallets.essence_balance - v_essence,
        essence_spent = wallets.essence_spent + v_essence,
        updated_at = now()
    where wallets.profile_id = v_profile_id;
  end if;

  v_count := coalesce((v_metadata ->> 'forgeCount')::integer, 0) + 1;
  v_seed := md5(v_artifact.id::text || ':forge:' || v_count::text)::uuid;
  select odds.success_bp, odds.focus_bp, odds.setback_bp
    into v_success_bp, v_focus_bp, v_setback_bp
  from public.forge_odds(v_essence) as odds;

  if public.artifact_hash_roll(v_seed, 'success', 10000) < v_success_bp then
    v_key := v_target;
    v_outcome := 'target';
    if public.artifact_hash_roll(v_seed, 'focus', 10000) >= v_focus_bp then
      -- The strike lands, but not where it was aimed: on another line that
      -- can still climb, or as a promotion. With nowhere else to land it
      -- lands on the target after all.
      v_alternatives := array_remove(v_raisable, v_target);
      if v_next_rarity is not null and v_target <> 'promote' then
        v_alternatives := array_append(v_alternatives, 'promote');
      end if;
      if coalesce(array_length(v_alternatives, 1), 0) > 0 then
        v_key := v_alternatives[
          public.artifact_hash_roll(v_seed, 'stray', array_length(v_alternatives, 1)) + 1
        ];
        v_outcome := 'stray';
      end if;
    end if;
    v_potential_spent := 10 + public.artifact_hash_roll(v_seed, 'potential', 11);

    if v_key = 'promote' then
      -- One rarity up, and the modifier that rank carries, drawn from the
      -- pool without repeating a line the artifact already has.
      for v_attempt in 0..59 loop
        v_candidate := v_pool[
          public.artifact_hash_roll(v_seed, 'mod:' || v_attempt::text, array_length(v_pool, 1)) + 1
        ];
        continue when v_candidate = any(v_present);
        v_new_id := v_candidate;
        exit;
      end loop;
      if v_new_id is null then
        raise exception 'The Forge could not find a new line for this artifact.';
      end if;
      v_tier_roll := public.artifact_hash_roll(v_seed, 'tier:' || v_new_id, 100);
      v_new_tier := case
        when v_tier_roll < 5 then 1
        when v_tier_roll < 17 then 2
        when v_tier_roll < 37 then 3
        when v_tier_roll < 65 then 4
        else 5
      end;
      v_range := public.artifact_effect_tier_range(v_new_id, v_new_tier);
      v_value := v_range[1] + public.artifact_hash_roll(
        v_seed, 'value:' || v_new_id, v_range[2] - v_range[1] + 1
      );
      v_metadata := v_metadata || jsonb_build_object(
        'rarity', v_next_rarity,
        'modifiers', (v_metadata -> 'modifiers') || jsonb_build_object(
          'id', v_new_id, 'tier', v_new_tier, 'value', v_value
        )
      );
      v_changed := 'promote';
    else
      v_metadata := public.forge_shift_line(v_metadata, v_key, -1, v_seed);
      v_changed := v_key;
    end if;
  else
    v_outcome := 'miss';
    v_potential_spent := 1 + public.artifact_hash_roll(v_seed, 'potential', 10);
    if coalesce(array_length(v_droppable, 1), 0) > 0
      and public.artifact_hash_roll(v_seed, 'setback', 10000) < v_setback_bp then
      v_key := v_droppable[
        public.artifact_hash_roll(v_seed, 'slip', array_length(v_droppable, 1)) + 1
      ];
      v_metadata := public.forge_shift_line(v_metadata, v_key, 1, v_seed);
      v_outcome := 'setback';
      v_changed := v_key;
    end if;
  end if;

  -- Potential never goes below nought, and what is reported as spent is
  -- what was actually there to spend.
  v_potential_spent := least(v_potential_spent, v_potential);
  v_potential := v_potential - v_potential_spent;
  v_metadata := v_metadata || jsonb_build_object('potential', v_potential, 'forgeCount', v_count);

  update public.inventory_item_instances as instances
  set metadata = v_metadata, updated_at = now()
  where instances.id = v_artifact.id;

  v_result := jsonb_build_array(jsonb_build_object(
    'definition_id', v_artifact.definition_id,
    'metadata', v_metadata,
    'outcome', v_outcome,
    'changed_line', v_changed,
    'potential_spent', v_potential_spent,
    'essence_spent', v_essence,
    'stone_spent', v_stone,
    'scrap_spent', v_scrap,
    'shards_spent', v_shards
  ));
  update public.inventory_operations as operations
  set status = 'completed', result = v_result, completed_at = now()
  where operations.profile_id = v_profile_id
    and operations.operation_id = p_operation_id;

  return query select
    v_artifact.definition_id, v_metadata, v_outcome, v_changed, v_potential_spent,
    v_essence, v_stone, v_scrap, v_shards, true;
end;
$$;

revoke all on function public.work_artifact_at_forge(text, uuid, text, bigint) from public, anon;
grant execute on function public.work_artifact_at_forge(text, uuid, text, bigint) to authenticated;

-- 4b. The contracts board's "At the anvil" counts strikes now. Restated
-- whole with the same signature; the only change is the Forge branch, which
-- counts `camp-forge` rows and the `camp-reforge` rows written before the
-- rework, so a contract already on the board keeps whatever it had earned.

create or replace function public.contract_progress(
  p_profile_id uuid,
  p_definition public.contract_definitions,
  p_window_start timestamptz,
  p_window_end timestamptz
)
returns integer
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  v_count bigint := 0;
begin
  case p_definition.objective
    when 'descend-floors' then
      select count(*) into v_count
      from public.dungeon_run_snapshots as snapshots
      join public.dungeon_runs as runs on runs.id = snapshots.run_id
      where snapshots.profile_id = p_profile_id
        and runs.mode_id = 'dungeon'
        and snapshots.snapshot_kind = 'floor'
        and snapshots.saved_at >= p_window_start
        and snapshots.saved_at < p_window_end;
    when 'reach-dungeon-floor' then
      select coalesce(max(snapshots.floor_number), 0) into v_count
      from public.dungeon_run_snapshots as snapshots
      join public.dungeon_runs as runs on runs.id = snapshots.run_id
      where snapshots.profile_id = p_profile_id
        and runs.mode_id = 'dungeon'
        and snapshots.snapshot_kind in ('floor', 'victory')
        and snapshots.saved_at >= p_window_start
        and snapshots.saved_at < p_window_end;
    when 'win-dungeon' then
      select count(*) into v_count
      from public.dungeon_runs as runs
      where runs.profile_id = p_profile_id
        and runs.mode_id = 'dungeon'
        and runs.status = 'victory'
        and runs.completed_at >= p_window_start
        and runs.completed_at < p_window_end;
    when 'slay-monsters' then
      select coalesce(sum(snapshots.kill_count), 0) into v_count
      from public.dungeon_run_snapshots as snapshots
      where snapshots.profile_id = p_profile_id
        and snapshots.snapshot_kind in ('victory', 'death', 'forfeit')
        and snapshots.saved_at >= p_window_start
        and snapshots.saved_at < p_window_end;
    when 'reach-abyss-depth' then
      select coalesce(max(runs.current_floor), 0) into v_count
      from public.dungeon_runs as runs
      where runs.profile_id = p_profile_id
        and runs.mode_id = 'infinite-abyss'
        and runs.started_at >= p_window_start
        and runs.started_at < p_window_end;
    when 'descend-abyss' then
      select count(*) into v_count
      from public.abyss_floor_rewards as rewards
      where rewards.profile_id = p_profile_id
        and rewards.created_at >= p_window_start
        and rewards.created_at < p_window_end;
    when 'catch-fish' then
      select count(*) into v_count
      from public.fishing_attempts as attempts
      where attempts.profile_id = p_profile_id
        and attempts.status = 'completed'
        and attempts.result is not null
        and attempts.completed_at >= p_window_start
        and attempts.completed_at < p_window_end
        and (
          p_definition.parameter ->> 'minRarity' is null
          or public.contract_rarity_rank(attempts.result -> 'metadata' ->> 'rarity')
            >= public.contract_rarity_rank(p_definition.parameter ->> 'minRarity')
        );
    when 'catch-species' then
      select count(*) into v_count
      from public.fishing_attempts as attempts
      where attempts.profile_id = p_profile_id
        and attempts.status = 'completed'
        and attempts.result ->> 'definitionId' = p_definition.parameter ->> 'definitionId'
        and attempts.completed_at >= p_window_start
        and attempts.completed_at < p_window_end;
    when 'open-loot-boxes' then
      select count(*) into v_count
      from public.loot_box_openings as openings
      where openings.profile_id = p_profile_id
        and openings.created_at >= p_window_start
        and openings.created_at < p_window_end;
    when 'craft-items' then
      select coalesce(sum(greatest(1, coalesce((operations.request ->> 'quantity')::integer, 1))), 0) into v_count
      from public.inventory_operations as operations
      where operations.profile_id = p_profile_id
        and operations.operation_type = 'craft'
        and operations.status = 'completed'
        and operations.completed_at >= p_window_start
        and operations.completed_at < p_window_end;
    when 'salvage-items' then
      select coalesce(sum(case operations.operation_type
        when 'salvage' then greatest(1, coalesce((operations.request ->> 'quantity')::integer, 1))
        else coalesce(jsonb_array_length(operations.request -> 'itemInstanceIds'), 0)
      end), 0) into v_count
      from public.inventory_operations as operations
      where operations.profile_id = p_profile_id
        and operations.operation_type in ('salvage', 'salvage-sweep')
        and operations.status = 'completed'
        and operations.completed_at >= p_window_start
        and operations.completed_at < p_window_end;
    when 'sell-items' then
      select coalesce(sum(greatest(1, coalesce((operations.request ->> 'quantity')::integer, 1))), 0) into v_count
      from public.inventory_operations as operations
      where operations.profile_id = p_profile_id
        and operations.operation_type = 'sell'
        and operations.status = 'completed'
        and operations.completed_at >= p_window_start
        and operations.completed_at < p_window_end;
    when 'gather-materials' then
      select coalesce(sum(
        coalesce((paid ->> 'units')::integer, 0) + coalesce((paid ->> 'bonus_units')::integer, 0)
      ), 0) into v_count
      from public.inventory_operations as operations
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(operations.result) = 'array' then operations.result else '[]'::jsonb end
      ) as payments(paid)
      where operations.profile_id = p_profile_id
        and operations.operation_type = 'camp-claim'
        and operations.status = 'completed'
        and operations.completed_at >= p_window_start
        and operations.completed_at < p_window_end
        and paid ->> 'definition_id' in ('timber', 'stone');
    when 'gut-fish', 'cure-fish', 'reforge-artifacts', 'upgrade-buildings' then
      select count(*) into v_count
      from public.inventory_operations as operations
      where operations.profile_id = p_profile_id
        and operations.operation_type = any(case p_definition.objective
          when 'gut-fish' then array['camp-gut']
          when 'cure-fish' then array['camp-cure']
          -- The Forge's strikes, and the rerolls it made before it was reworked.
          when 'reforge-artifacts' then array['camp-forge', 'camp-reforge']
          else array['camp-upgrade']
        end)
        and operations.status = 'completed'
        and operations.completed_at >= p_window_start
        and operations.completed_at < p_window_end;
    else
      raise exception 'Unknown contract objective: %.', p_definition.objective;
  end case;
  return least(v_count, 2147483647)::integer;
end;
$$;

-- 5. The odds and the fee, asserted against the numbers src/camp/Forge.ts
-- carries. src/camp/Forge.test.ts reads the same figures out of this block.
do $$
declare
  v_odds record;
  v_shifted jsonb;
  v_fixture jsonb := '{"implicit":{"id":"momentum","tier":3,"value":13},"modifiers":[{"id":"max-hp","tier":4,"value":6},{"id":"crit-chance","tier":1,"value":7}]}'::jsonb;
  v_seed uuid := '00000000-0000-0000-0000-000000000001'::uuid;
begin
  select * into v_odds from public.forge_odds(0);
  assert v_odds.success_bp = 3000 and v_odds.focus_bp = 6000 and v_odds.setback_bp = 2000,
    'forge odds at no stake';
  select * into v_odds from public.forge_odds(25000);
  assert v_odds.success_bp = 5250 and v_odds.focus_bp = 7250, 'forge odds at the half point';
  select * into v_odds from public.forge_odds(100000);
  assert v_odds.success_bp = 6600 and v_odds.focus_bp = 8000, 'forge odds at the cap';
  select * into v_odds from public.forge_odds(250000);
  assert v_odds.success_bp = 6600, 'forge odds are clamped at the cap';
  select * into v_odds from public.forge_odds(-5);
  assert v_odds.success_bp = 3000, 'forge odds are clamped at nought';

  assert public.forge_fee('common') = '{"stone": 10, "scrap": 10, "rift-shard": 1}'::jsonb, 'common fee';
  assert public.forge_fee('legendary') = '{"stone": 160, "scrap": 70, "rift-shard": 8}'::jsonb, 'legendary fee';

  v_shifted := public.forge_shift_line(v_fixture, 'modifier:max-hp', -1, v_seed);
  assert (v_shifted -> 'modifiers' -> 0 ->> 'tier')::integer = 3, 'a raised line climbs one tier';
  assert (v_shifted -> 'modifiers' -> 0 ->> 'value')::integer between 8 and 10, 'a raised line rerolls inside its new tier';
  assert v_shifted -> 'modifiers' -> 1 = v_fixture -> 'modifiers' -> 1, 'the other lines are untouched';
  v_shifted := public.forge_shift_line(v_fixture, 'modifier:crit-chance', -1, v_seed);
  assert (v_shifted -> 'modifiers' -> 1 ->> 'tier')::integer = 1, 'tier one cannot climb further';
  v_shifted := public.forge_shift_line(v_fixture, 'implicit', 1, v_seed);
  assert (v_shifted -> 'implicit' ->> 'tier')::integer = 4, 'a slipped implicit drops one tier';
  assert (v_shifted -> 'implicit' ->> 'value')::integer between 10 and 12, 'a slipped implicit rerolls inside its new tier';
end;
$$;
