-- A deeper pool, and a smaller pay for a contract dealt again and again.
--
-- Endless dailies made twelve definitions a thin deck: three slots a day and
-- a few claims a session showed the whole of it in two days. Every objective
-- is now a ladder of two or three rungs, five objectives the records already
-- support are added (a floor reached in one run, a sale to the quartermaster,
-- a building raised, a fish cured, an artifact reforged), and the weekly pool
-- doubles. Thirty-six dailies and ten weeklies. The rows that existed keep
-- their ids, because assignments point at them; only their sort order moves.
--
-- A contract dealt for the third time in a day pays half. The rotation
-- already deals the least-dealt contract first, so a heavy session sees the
-- whole pool before any repeat, and a repeat is never worth more than the
-- first time. The share is reported on the board so the pay shown is the
-- pay made.

alter table public.contract_definitions
  drop constraint contract_definitions_objective_check;

alter table public.contract_definitions
  add constraint contract_definitions_objective_check
  check (objective in (
    'descend-floors', 'win-dungeon', 'slay-monsters', 'reach-abyss-depth',
    'descend-abyss', 'catch-fish', 'catch-species', 'open-loot-boxes',
    'craft-items', 'salvage-items', 'gather-materials', 'gut-fish',
    'reach-dungeon-floor', 'sell-items', 'upgrade-buildings', 'cure-fish',
    'reforge-artifacts'
  ));

insert into public.contract_definitions (
  id, name, cadence, objective, target, parameter, reward, requires_champion, requires_building_id, sort_order
) values
  ('daily-descend', 'Down the stairs', 'daily', 'descend-floors', 8, '{}'::jsonb,
    '[{"definitionId": "timber", "quantity": 12}, {"definitionId": "stone", "quantity": 12}]'::jsonb, false, null, 0),
  ('daily-descend-2', 'Deeper stairs', 'daily', 'descend-floors', 15, '{}'::jsonb,
    '[{"definitionId": "timber", "quantity": 24}, {"definitionId": "stone", "quantity": 24}]'::jsonb, false, null, 1),
  ('daily-descend-3', 'The long stair', 'daily', 'descend-floors', 25, '{}'::jsonb,
    '[{"definitionId": "timber", "quantity": 40}, {"definitionId": "stone", "quantity": 40}, {"definitionId": "loot-box-uncommon", "quantity": 1}]'::jsonb, false, null, 2),
  ('daily-floor-10', 'Tenth floor', 'daily', 'reach-dungeon-floor', 10, '{}'::jsonb,
    '[{"definitionId": "timber", "quantity": 10}]'::jsonb, false, null, 3),
  ('daily-floor-20', 'Twentieth floor', 'daily', 'reach-dungeon-floor', 20, '{}'::jsonb,
    '[{"definitionId": "stone", "quantity": 24}]'::jsonb, false, null, 4),
  ('daily-floor-30', 'The last stair', 'daily', 'reach-dungeon-floor', 30, '{}'::jsonb,
    '[{"definitionId": "loot-box-rare", "quantity": 1}]'::jsonb, false, null, 5),
  ('daily-cull', 'A cull', 'daily', 'slay-monsters', 300, '{}'::jsonb,
    '[{"definitionId": "scrap", "quantity": 6}]'::jsonb, false, null, 6),
  ('daily-cull-2', 'A reaping', 'daily', 'slay-monsters', 800, '{}'::jsonb,
    '[{"definitionId": "scrap", "quantity": 14}]'::jsonb, false, null, 7),
  ('daily-cull-3', 'A slaughter', 'daily', 'slay-monsters', 2000, '{}'::jsonb,
    '[{"definitionId": "scrap", "quantity": 30}, {"definitionId": "loot-box-uncommon", "quantity": 1}]'::jsonb, false, null, 8),
  ('daily-catch', 'A day''s catch', 'daily', 'catch-fish', 5, '{}'::jsonb,
    '[{"definitionId": "roe", "quantity": 4}]'::jsonb, false, null, 9),
  ('daily-catch-2', 'A full creel', 'daily', 'catch-fish', 12, '{}'::jsonb,
    '[{"definitionId": "roe", "quantity": 10}]'::jsonb, false, null, 10),
  ('daily-catch-3', 'The pond emptied', 'daily', 'catch-fish', 25, '{}'::jsonb,
    '[{"definitionId": "roe", "quantity": 20}, {"definitionId": "loot-box-uncommon", "quantity": 1}]'::jsonb, false, null, 11),
  ('daily-rare-catch', 'Something rare', 'daily', 'catch-fish', 1, '{"minRarity": "rare"}'::jsonb,
    '[{"definitionId": "loot-box-uncommon", "quantity": 1}]'::jsonb, false, null, 12),
  ('daily-epic-catch', 'Something stranger', 'daily', 'catch-fish', 1, '{"minRarity": "epic"}'::jsonb,
    '[{"definitionId": "loot-box-rare", "quantity": 1}]'::jsonb, false, null, 13),
  ('daily-pike', 'The pike', 'daily', 'catch-species', 1, '{"definitionId": "lantern-pike"}'::jsonb,
    '[{"definitionId": "stone", "quantity": 10}]'::jsonb, false, null, 14),
  ('daily-trout', 'The trout', 'daily', 'catch-species', 1, '{"definitionId": "glassfin-trout"}'::jsonb,
    '[{"definitionId": "timber", "quantity": 10}]'::jsonb, false, null, 15),
  ('daily-perch', 'The perch', 'daily', 'catch-species', 1, '{"definitionId": "silver-perch"}'::jsonb,
    '[{"definitionId": "roe", "quantity": 8}]'::jsonb, false, null, 16),
  ('daily-carp', 'The carp', 'daily', 'catch-species', 1, '{"definitionId": "moon-carp"}'::jsonb,
    '[{"definitionId": "timber", "quantity": 12}, {"definitionId": "stone", "quantity": 12}]'::jsonb, false, null, 17),
  ('daily-catfish', 'The catfish', 'daily', 'catch-species', 1, '{"definitionId": "tideback-catfish"}'::jsonb,
    '[{"definitionId": "loot-box-uncommon", "quantity": 1}]'::jsonb, false, null, 18),
  ('daily-unboxing', 'Unboxing', 'daily', 'open-loot-boxes', 2, '{}'::jsonb,
    '[{"definitionId": "scrap", "quantity": 5}]'::jsonb, false, null, 19),
  ('daily-unboxing-2', 'A crate of boxes', 'daily', 'open-loot-boxes', 6, '{}'::jsonb,
    '[{"definitionId": "scrap", "quantity": 14}]'::jsonb, false, null, 20),
  ('daily-bench', 'At the bench', 'daily', 'craft-items', 2, '{}'::jsonb,
    '[{"definitionId": "timber", "quantity": 8}]'::jsonb, false, null, 21),
  ('daily-bench-2', 'A long shift', 'daily', 'craft-items', 6, '{}'::jsonb,
    '[{"definitionId": "timber", "quantity": 20}]'::jsonb, false, null, 22),
  ('daily-clear-out', 'Clear out', 'daily', 'salvage-items', 5, '{}'::jsonb,
    '[{"definitionId": "timber", "quantity": 6}, {"definitionId": "stone", "quantity": 6}]'::jsonb, false, null, 23),
  ('daily-clear-out-2', 'Spring cleaning', 'daily', 'salvage-items', 15, '{}'::jsonb,
    '[{"definitionId": "timber", "quantity": 16}, {"definitionId": "stone", "quantity": 16}]'::jsonb, false, null, 24),
  ('daily-sell', 'To market', 'daily', 'sell-items', 5, '{}'::jsonb,
    '[{"definitionId": "timber", "quantity": 6}]'::jsonb, false, null, 25),
  ('daily-sell-2', 'A cart to market', 'daily', 'sell-items', 20, '{}'::jsonb,
    '[{"definitionId": "stone", "quantity": 20}]'::jsonb, false, null, 26),
  ('daily-gather', 'Timber and stone', 'daily', 'gather-materials', 30, '{}'::jsonb,
    '[{"definitionId": "scrap", "quantity": 8}]'::jsonb, true, null, 27),
  ('daily-gather-2', 'A full store', 'daily', 'gather-materials', 90, '{}'::jsonb,
    '[{"definitionId": "scrap", "quantity": 20}]'::jsonb, true, null, 28),
  ('daily-rift', 'Into the rift', 'daily', 'descend-abyss', 5, '{}'::jsonb,
    '[{"definitionId": "rift-shard", "quantity": 2}]'::jsonb, true, null, 29),
  ('daily-rift-2', 'Deeper into the rift', 'daily', 'descend-abyss', 12, '{}'::jsonb,
    '[{"definitionId": "rift-shard", "quantity": 5}]'::jsonb, true, null, 30),
  ('daily-build', 'Raise a wall', 'daily', 'upgrade-buildings', 1, '{}'::jsonb,
    '[{"definitionId": "scrap", "quantity": 10}]'::jsonb, false, null, 31),
  ('daily-smokehouse', 'The Smokehouse', 'daily', 'gut-fish', 2, '{}'::jsonb,
    '[{"definitionId": "stone", "quantity": 10}]'::jsonb, false, 'smokehouse', 32),
  ('daily-smokehouse-2', 'A day of gutting', 'daily', 'gut-fish', 6, '{}'::jsonb,
    '[{"definitionId": "stone", "quantity": 20}]'::jsonb, false, 'smokehouse', 33),
  ('daily-cure', 'Cured and hung', 'daily', 'cure-fish', 1, '{}'::jsonb,
    '[{"definitionId": "timber", "quantity": 12}]'::jsonb, false, 'smokehouse', 34),
  ('daily-forge', 'At the anvil', 'daily', 'reforge-artifacts', 1, '{}'::jsonb,
    '[{"definitionId": "rift-shard", "quantity": 4}]'::jsonb, false, 'forge', 35),
  ('weekly-victory', 'The long way down', 'weekly', 'win-dungeon', 1, '{}'::jsonb,
    '[{"definitionId": "loot-box-rare", "quantity": 1}, {"definitionId": "scrap", "quantity": 20}]'::jsonb, false, null, 100),
  ('weekly-descend', 'Sixty floors', 'weekly', 'descend-floors', 60, '{}'::jsonb,
    '[{"definitionId": "loot-box-rare", "quantity": 1}, {"definitionId": "timber", "quantity": 40}, {"definitionId": "stone", "quantity": 40}]'::jsonb, false, null, 101),
  ('weekly-depth', 'Deep descent', 'weekly', 'reach-abyss-depth', 10, '{}'::jsonb,
    '[{"definitionId": "loot-box-rare", "quantity": 1}, {"definitionId": "rift-shard", "quantity": 6}]'::jsonb, true, null, 102),
  ('weekly-depth-2', 'Deeper descent', 'weekly', 'reach-abyss-depth', 20, '{}'::jsonb,
    '[{"definitionId": "loot-box-rare", "quantity": 1}, {"definitionId": "rift-shard", "quantity": 12}]'::jsonb, true, null, 103),
  ('weekly-angler', 'The angler', 'weekly', 'catch-fish', 25, '{}'::jsonb,
    '[{"definitionId": "loot-box-rare", "quantity": 1}, {"definitionId": "roe", "quantity": 10}]'::jsonb, false, null, 104),
  ('weekly-rare-angler', 'The collector', 'weekly', 'catch-fish', 3, '{"minRarity": "rare"}'::jsonb,
    '[{"definitionId": "loot-box-rare", "quantity": 1}, {"definitionId": "roe", "quantity": 15}]'::jsonb, false, null, 105),
  ('weekly-cull', 'The great cull', 'weekly', 'slay-monsters', 1500, '{}'::jsonb,
    '[{"definitionId": "loot-box-rare", "quantity": 1}, {"definitionId": "timber", "quantity": 30}, {"definitionId": "stone", "quantity": 30}]'::jsonb, false, null, 106),
  ('weekly-stores', 'Camp stores', 'weekly', 'gather-materials', 150, '{}'::jsonb,
    '[{"definitionId": "loot-box-rare", "quantity": 1}, {"definitionId": "scrap", "quantity": 20}]'::jsonb, true, null, 107),
  ('weekly-boxes', 'A dozen boxes', 'weekly', 'open-loot-boxes', 12, '{}'::jsonb,
    '[{"definitionId": "loot-box-rare", "quantity": 1}, {"definitionId": "scrap", "quantity": 20}]'::jsonb, false, null, 108),
  ('weekly-forge', 'A week at the anvil', 'weekly', 'reforge-artifacts', 3, '{}'::jsonb,
    '[{"definitionId": "loot-box-rare", "quantity": 1}, {"definitionId": "rift-shard", "quantity": 10}]'::jsonb, false, 'forge', 109)
on conflict (id) do update
set name = excluded.name,
    cadence = excluded.cadence,
    objective = excluded.objective,
    target = excluded.target,
    parameter = excluded.parameter,
    reward = excluded.reward,
    requires_champion = excluded.requires_champion,
    requires_building_id = excluded.requires_building_id,
    sort_order = excluded.sort_order,
    active = true;

/* Progress, with the five new branches. Rewritten whole with the same signature. */
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
        and operations.operation_type = case p_definition.objective
          when 'gut-fish' then 'camp-gut'
          when 'cure-fish' then 'camp-cure'
          when 'reforge-artifacts' then 'camp-reforge'
          else 'camp-upgrade'
        end
        and operations.status = 'completed'
        and operations.completed_at >= p_window_start
        and operations.completed_at < p_window_end;
    else
      raise exception 'Unknown contract objective: %.', p_definition.objective;
  end case;
  return least(v_count, 2147483647)::integer;
end;
$$;

/* How many times a definition has already been claimed in a period. */
create function public.contract_repeat_claims(
  p_profile_id uuid,
  p_period_key text,
  p_definition_id text
)
returns integer
language sql
stable
security definer set search_path = ''
as $$
  select count(*)::integer
  from public.contract_assignments as assignments
  where assignments.profile_id = p_profile_id
    and assignments.period_key = p_period_key
    and assignments.definition_id = p_definition_id
    and assignments.claimed_at is not null;
$$;

revoke all on function public.contract_repeat_claims(uuid, text, text)
  from public, anon, authenticated;

/* The pay a claim makes: whole until the third claim of the same contract
   in a period, then half, never less than one. Mirrored in
   src/content/contracts/Contracts.ts. */
create function public.contract_scaled_quantity(p_quantity integer, p_repeat_claims integer)
returns integer
language sql
immutable
security definer set search_path = ''
as $$
  select case
    when p_repeat_claims >= 2 then greatest(1, ceil(p_quantity / 2.0)::integer)
    else p_quantity
  end;
$$;

revoke all on function public.contract_scaled_quantity(integer, integer)
  from public, anon, authenticated;

/* The board, each row now carrying how many times its contract has been
   claimed this period. Rewritten whole with the same signature. */
create or replace function public.contract_state_for(p_profile_id uuid)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_day date := (v_now at time zone 'utc')::date;
  v_day_start timestamptz := (v_day::timestamp) at time zone 'utc';
  v_day_end timestamptz := v_day_start + interval '1 day';
  v_week_start timestamptz := (date_trunc('week', v_now at time zone 'utc')) at time zone 'utc';
  v_day_key text := to_char(v_day, 'YYYY-MM-DD');
  v_week_key text := to_char(date_trunc('week', v_now at time zone 'utc'), 'IYYY-"W"IW');
  v_slot integer;
begin
  perform public.contract_roll_period(
    p_profile_id, 'daily', v_day_key, v_day_start, v_day_end, 3
  );
  perform public.contract_roll_period(
    p_profile_id, 'weekly', v_week_key, v_week_start, v_week_start + interval '7 days', 1
  );

  for v_slot in 1..3 loop
    if not exists (
      select 1
      from public.contract_assignments as assignments
      where assignments.profile_id = p_profile_id
        and assignments.cadence = 'daily'
        and assignments.period_key = v_day_key
        and assignments.slot = v_slot
        and assignments.claimed_at is null
    ) then
      perform public.contract_deal_daily_replacement(
        p_profile_id, v_day_key, v_slot, v_now, v_day_end
      );
    end if;
  end loop;

  return jsonb_build_object(
    'server_time', v_now,
    'daily_claimed', (
      select count(*)
      from public.contract_assignments as assignments
      where assignments.profile_id = p_profile_id
        and assignments.cadence = 'daily'
        and assignments.period_key = v_day_key
        and assignments.claimed_at is not null
    ),
    'contracts', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'assignment_id', assignments.id,
        'definition_id', assignments.definition_id,
        'cadence', assignments.cadence,
        'period_key', assignments.period_key,
        'window_start', assignments.window_start,
        'window_end', assignments.window_end,
        'slot', assignments.slot,
        'target', definitions.target,
        'progress', public.contract_progress(
          p_profile_id, definitions, assignments.window_start, assignments.window_end
        ),
        'repeat_claims', public.contract_repeat_claims(
          p_profile_id, assignments.period_key, assignments.definition_id
        ),
        'claimed_at', assignments.claimed_at
      ) order by assignments.cadence, assignments.slot), '[]'::jsonb)
      from public.contract_assignments as assignments
      join public.contract_definitions as definitions on definitions.id = assignments.definition_id
      where assignments.profile_id = p_profile_id
        and (
          (assignments.cadence = 'daily' and assignments.period_key = v_day_key and assignments.claimed_at is null)
          or (assignments.cadence = 'weekly' and assignments.period_key = v_week_key)
        )
    )
  );
end;
$$;

/* The claim, paying the scaled share. Rewritten whole with the same signature. */
create or replace function public.claim_contract_reward(
  p_operation_id text,
  p_assignment_id bigint
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_operation public.inventory_operations%rowtype;
  v_assignment public.contract_assignments%rowtype;
  v_definition public.contract_definitions%rowtype;
  v_progress integer;
  v_repeat integer;
  v_quantity integer;
  v_now timestamptz := now();
  v_line jsonb;
  v_paid jsonb := '[]'::jsonb;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required.';
  end if;
  if coalesce(length(trim(p_operation_id)), 0) = 0 then
    raise exception 'A non-empty inventory operation ID is required.';
  end if;

  v_operation := public.inventory_claim_operation(
    v_profile_id, p_operation_id, 'contract-claim',
    jsonb_build_object('assignmentId', p_assignment_id)
  );
  if v_operation.status = 'completed' then
    return jsonb_build_object(
      'paid', v_operation.result,
      'was_processed', false,
      'state', public.contract_state_for(v_profile_id)
    );
  end if;

  select assignments.* into v_assignment
  from public.contract_assignments as assignments
  where assignments.id = p_assignment_id
    and assignments.profile_id = v_profile_id
  for update;
  if not found then
    raise exception 'Contract not found.';
  end if;

  select definitions.* into v_definition
  from public.contract_definitions as definitions
  where definitions.id = v_assignment.definition_id;

  if v_assignment.claimed_at is not null then
    update public.inventory_operations as operations
    set status = 'completed', result = '[]'::jsonb, completed_at = v_now
    where operations.profile_id = v_profile_id
      and operations.operation_id = p_operation_id;
    return jsonb_build_object(
      'paid', '[]'::jsonb,
      'was_processed', false,
      'state', public.contract_state_for(v_profile_id)
    );
  end if;

  v_progress := public.contract_progress(
    v_profile_id, v_definition, v_assignment.window_start, v_assignment.window_end
  );
  if v_progress < v_definition.target then
    raise exception 'This contract is not finished yet.';
  end if;

  v_repeat := public.contract_repeat_claims(
    v_profile_id, v_assignment.period_key, v_assignment.definition_id
  );

  for v_line in select value from jsonb_array_elements(v_definition.reward)
  loop
    v_quantity := public.contract_scaled_quantity((v_line ->> 'quantity')::integer, v_repeat);
    perform 1 from public.grant_inventory_items(
      p_operation_id || ':' || (v_line ->> 'definitionId'),
      'system',
      v_definition.id,
      jsonb_build_array(jsonb_build_object(
        'definitionId', v_line ->> 'definitionId',
        'quantity', v_quantity,
        'metadata', jsonb_build_object('contractId', v_definition.id)
      ))
    );
    v_paid := v_paid || jsonb_build_object(
      'definition_id', v_line ->> 'definitionId',
      'quantity', v_quantity
    );
  end loop;

  update public.contract_assignments as assignments
  set claimed_at = v_now, claim_operation_id = p_operation_id
  where assignments.id = p_assignment_id;

  if v_assignment.cadence = 'daily' and v_assignment.window_end > v_now then
    perform public.contract_deal_daily_replacement(
      v_profile_id, v_assignment.period_key, v_assignment.slot, v_now, v_assignment.window_end
    );
  end if;

  update public.inventory_operations as operations
  set status = 'completed', result = v_paid, completed_at = v_now
  where operations.profile_id = v_profile_id
    and operations.operation_id = p_operation_id;

  return jsonb_build_object(
    'paid', v_paid,
    'was_processed', true,
    'state', public.contract_state_for(v_profile_id)
  );
end;
$$;
