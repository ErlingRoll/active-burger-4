-- Contracts and collections: Phase 10 of docs/features/implementation_plan.md.
--
-- A contract is a rotating objective completed through normal play, and its
-- progress is a query over what the server already recorded: floors reached,
-- runs won, kills counted, catches landed, boxes opened, ledger rows written.
-- Nothing here is reported by the browser, so nothing here can be forged by
-- one. The board is rolled once per period from the account and the date, as
-- the shop's shelf is, and a claim is an inventory operation, so a refresh
-- cannot reroll the day and a retry cannot pay twice.
--
-- A collection is the same idea read the other way: what a player has caught,
-- found and cleared with, derived from the same tables and never stored. The
-- Trophy hall at the Camp shows what the pages have earned.
--
-- The definitions are mirrored in src/content/contracts/Contracts.ts, and
-- tests/contractRegistry.test.ts parses this file to keep the two agreeing.

-- ════════════════════════════════════════════════════════════════════════════
-- The pool
-- ════════════════════════════════════════════════════════════════════════════

create table public.contract_definitions (
  id text primary key,
  name text not null,
  cadence text not null check (cadence in ('daily', 'weekly')),
  objective text not null check (objective in (
    'descend-floors', 'win-dungeon', 'slay-monsters', 'reach-abyss-depth',
    'descend-abyss', 'catch-fish', 'catch-species', 'open-loot-boxes',
    'craft-items', 'salvage-items', 'gather-materials', 'gut-fish'
  )),
  target integer not null check (target >= 1),
  parameter jsonb not null default '{}'::jsonb check (jsonb_typeof(parameter) = 'object'),
  reward jsonb not null check (jsonb_typeof(reward) = 'array' and jsonb_array_length(reward) >= 1),
  requires_champion boolean not null default false,
  requires_building_id text references public.camp_building_definitions (id),
  sort_order integer not null,
  active boolean not null default true
);

alter table public.contract_definitions enable row level security;

create policy "Contract definitions are readable by players"
on public.contract_definitions for select to authenticated
using (true);

grant select on public.contract_definitions to authenticated;

insert into public.contract_definitions (
  id, name, cadence, objective, target, parameter, reward, requires_champion, requires_building_id, sort_order
) values
  ('daily-descend', 'Down the stairs', 'daily', 'descend-floors', 8, '{}'::jsonb,
    '[{"definitionId": "timber", "quantity": 12}, {"definitionId": "stone", "quantity": 12}]'::jsonb, false, null, 0),
  ('daily-cull', 'A cull', 'daily', 'slay-monsters', 300, '{}'::jsonb,
    '[{"definitionId": "scrap", "quantity": 6}]'::jsonb, false, null, 1),
  ('daily-catch', 'A day''s catch', 'daily', 'catch-fish', 5, '{}'::jsonb,
    '[{"definitionId": "roe", "quantity": 4}]'::jsonb, false, null, 2),
  ('daily-rare-catch', 'Something rare', 'daily', 'catch-fish', 1, '{"minRarity": "rare"}'::jsonb,
    '[{"definitionId": "loot-box-uncommon", "quantity": 1}]'::jsonb, false, null, 3),
  ('daily-pike', 'The pike', 'daily', 'catch-species', 1, '{"definitionId": "lantern-pike"}'::jsonb,
    '[{"definitionId": "stone", "quantity": 10}]'::jsonb, false, null, 4),
  ('daily-trout', 'The trout', 'daily', 'catch-species', 1, '{"definitionId": "glassfin-trout"}'::jsonb,
    '[{"definitionId": "timber", "quantity": 10}]'::jsonb, false, null, 5),
  ('daily-unboxing', 'Unboxing', 'daily', 'open-loot-boxes', 2, '{}'::jsonb,
    '[{"definitionId": "scrap", "quantity": 5}]'::jsonb, false, null, 6),
  ('daily-bench', 'At the bench', 'daily', 'craft-items', 2, '{}'::jsonb,
    '[{"definitionId": "timber", "quantity": 8}]'::jsonb, false, null, 7),
  ('daily-clear-out', 'Clear out', 'daily', 'salvage-items', 5, '{}'::jsonb,
    '[{"definitionId": "timber", "quantity": 6}, {"definitionId": "stone", "quantity": 6}]'::jsonb, false, null, 8),
  ('daily-gather', 'Timber and stone', 'daily', 'gather-materials', 30, '{}'::jsonb,
    '[{"definitionId": "scrap", "quantity": 8}]'::jsonb, true, null, 9),
  ('daily-rift', 'Into the rift', 'daily', 'descend-abyss', 5, '{}'::jsonb,
    '[{"definitionId": "rift-shard", "quantity": 2}]'::jsonb, true, null, 10),
  ('daily-smokehouse', 'The Smokehouse', 'daily', 'gut-fish', 2, '{}'::jsonb,
    '[{"definitionId": "stone", "quantity": 10}]'::jsonb, false, 'smokehouse', 11),
  ('weekly-victory', 'The long way down', 'weekly', 'win-dungeon', 1, '{}'::jsonb,
    '[{"definitionId": "loot-box-rare", "quantity": 1}, {"definitionId": "scrap", "quantity": 20}]'::jsonb, false, null, 20),
  ('weekly-depth', 'Deep descent', 'weekly', 'reach-abyss-depth', 10, '{}'::jsonb,
    '[{"definitionId": "loot-box-rare", "quantity": 1}, {"definitionId": "rift-shard", "quantity": 6}]'::jsonb, true, null, 21),
  ('weekly-angler', 'The angler', 'weekly', 'catch-fish', 25, '{}'::jsonb,
    '[{"definitionId": "loot-box-rare", "quantity": 1}, {"definitionId": "roe", "quantity": 10}]'::jsonb, false, null, 22),
  ('weekly-cull', 'The great cull', 'weekly', 'slay-monsters', 1500, '{}'::jsonb,
    '[{"definitionId": "loot-box-rare", "quantity": 1}, {"definitionId": "timber", "quantity": 30}, {"definitionId": "stone", "quantity": 30}]'::jsonb, false, null, 23),
  ('weekly-stores', 'Camp stores', 'weekly', 'gather-materials', 150, '{}'::jsonb,
    '[{"definitionId": "loot-box-rare", "quantity": 1}, {"definitionId": "scrap", "quantity": 20}]'::jsonb, true, null, 24)
on conflict (id) do nothing;

-- ════════════════════════════════════════════════════════════════════════════
-- The board
-- ════════════════════════════════════════════════════════════════════════════

-- One row per contract on a player's board for a period. The window is
-- stored so a claim made after the period reads the bounds the board did.
create table public.contract_assignments (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  definition_id text not null references public.contract_definitions (id),
  cadence text not null check (cadence in ('daily', 'weekly')),
  period_key text not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  slot integer not null check (slot >= 1),
  claimed_at timestamptz,
  claim_operation_id text,
  created_at timestamptz not null default now(),
  check (window_end > window_start),
  unique (profile_id, cadence, period_key, slot),
  unique (profile_id, period_key, definition_id)
);

create index contract_assignments_profile_period_idx
  on public.contract_assignments (profile_id, period_key);

alter table public.contract_assignments enable row level security;

create policy "Contract assignments are readable by their owner"
on public.contract_assignments for select to authenticated
using ((select auth.uid()) = profile_id);

grant select on public.contract_assignments to authenticated;

alter table public.inventory_operations
  drop constraint inventory_operations_operation_type_check;

alter table public.inventory_operations
  add constraint inventory_operations_operation_type_check
  check (
    operation_type in (
      'grant', 'consume', 'reserve', 'release', 'salvage', 'salvage-sweep', 'craft',
      'sell', 'buy', 'camp-claim', 'camp-upgrade', 'camp-gut', 'camp-cure', 'camp-reforge',
      'contract-claim'
    )
  );

/* Rarities in order, so "rare or better" is a comparison. */
create function public.contract_rarity_rank(p_rarity text)
returns integer
language sql
immutable
security definer set search_path = ''
as $$
  select case p_rarity
    when 'common' then 0
    when 'uncommon' then 1
    when 'rare' then 2
    when 'epic' then 3
    when 'legendary' then 4
    else -1
  end;
$$;

revoke all on function public.contract_rarity_rank(text) from public, anon, authenticated;

/*
 * How far one contract has come: the count of what it asks for, recorded
 * between the window's bounds. Every branch reads a table another system
 * wrote, and none of them reads anything the browser sent for the purpose.
 */
create function public.contract_progress(
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
    when 'gut-fish' then
      select count(*) into v_count
      from public.inventory_operations as operations
      where operations.profile_id = p_profile_id
        and operations.operation_type = 'camp-gut'
        and operations.status = 'completed'
        and operations.completed_at >= p_window_start
        and operations.completed_at < p_window_end;
    else
      raise exception 'Unknown contract objective: %.', p_definition.objective;
  end case;
  return least(v_count, 2147483647)::integer;
end;
$$;

revoke all on function public.contract_progress(uuid, public.contract_definitions, timestamptz, timestamptz)
  from public, anon, authenticated;

/*
 * Roll a period's board if it has not been rolled.
 *
 * The eligible pool is every active contract of the cadence the player can
 * reach: one that needs a Champion is left out of a roster with none, and
 * one that needs a building is left out until it stands. Each is given a
 * hash of the account, the period and its id, and the lowest hashes fill the
 * slots, so the same day always deals the same board to the same player and
 * nobody can deal again by refreshing.
 */
create function public.contract_roll_period(
  p_profile_id uuid,
  p_cadence text,
  p_period_key text,
  p_window_start timestamptz,
  p_window_end timestamptz,
  p_count integer
)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.contract_assignments as assignments
    where assignments.profile_id = p_profile_id
      and assignments.cadence = p_cadence
      and assignments.period_key = p_period_key
  ) then
    return;
  end if;

  insert into public.contract_assignments (
    profile_id, definition_id, cadence, period_key, window_start, window_end, slot
  )
  select p_profile_id, dealt.id, p_cadence, p_period_key, p_window_start, p_window_end, dealt.slot
  from (
    select eligible.id, row_number() over (order by eligible.roll, eligible.id) as slot
    from (
      select
        definitions.id,
        hashtextextended(p_profile_id::text || ':' || p_period_key || ':' || definitions.id, 0) as roll
      from public.contract_definitions as definitions
      where definitions.active
        and definitions.cadence = p_cadence
        and (
          not definitions.requires_champion
          or exists (
            select 1 from public.champions as champions
            where champions.profile_id = p_profile_id and not champions.archived
          )
        )
        and (
          definitions.requires_building_id is null
          or public.camp_building_level(p_profile_id, definitions.requires_building_id) >= 1
        )
    ) as eligible
  ) as dealt
  where dealt.slot <= p_count
  on conflict do nothing;
end;
$$;

revoke all on function public.contract_roll_period(uuid, text, text, timestamptz, timestamptz, integer)
  from public, anon, authenticated;

/* The board as one document: every current assignment with its live progress. */
create function public.contract_state_for(p_profile_id uuid)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_day date := (v_now at time zone 'utc')::date;
  v_day_start timestamptz := (v_day::timestamp) at time zone 'utc';
  v_week_start timestamptz := (date_trunc('week', v_now at time zone 'utc')) at time zone 'utc';
  v_day_key text := to_char(v_day, 'YYYY-MM-DD');
  v_week_key text := to_char(date_trunc('week', v_now at time zone 'utc'), 'IYYY-"W"IW');
begin
  perform public.contract_roll_period(
    p_profile_id, 'daily', v_day_key, v_day_start, v_day_start + interval '1 day', 3
  );
  perform public.contract_roll_period(
    p_profile_id, 'weekly', v_week_key, v_week_start, v_week_start + interval '7 days', 1
  );

  return jsonb_build_object(
    'server_time', v_now,
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
        'claimed_at', assignments.claimed_at
      ) order by assignments.cadence, assignments.slot), '[]'::jsonb)
      from public.contract_assignments as assignments
      join public.contract_definitions as definitions on definitions.id = assignments.definition_id
      where assignments.profile_id = p_profile_id
        and assignments.period_key in (v_day_key, v_week_key)
    )
  );
end;
$$;

revoke all on function public.contract_state_for(uuid) from public, anon, authenticated;

create function public.get_contract_state()
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
begin
  if v_profile_id is null then
    raise exception 'Authentication is required.';
  end if;
  return public.contract_state_for(v_profile_id);
end;
$$;

revoke all on function public.get_contract_state() from public, anon;
grant execute on function public.get_contract_state() to authenticated;

/*
 * Claim a finished contract's reward.
 *
 * One ledger row per operation id, so a retry returns what the first call
 * paid. The assignment is locked and re-checked: it must be the caller's,
 * unclaimed, and at or past its target as of now, measured over the window
 * the board was rolled with. The reward is granted under a derived id and
 * the assignment is stamped in the same transaction.
 */
create function public.claim_contract_reward(
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
    -- Claimed under another operation: this one pays nothing and says so.
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

  for v_line in select value from jsonb_array_elements(v_definition.reward)
  loop
    perform 1 from public.grant_inventory_items(
      p_operation_id || ':' || (v_line ->> 'definitionId'),
      'system',
      v_definition.id,
      jsonb_build_array(jsonb_build_object(
        'definitionId', v_line ->> 'definitionId',
        'quantity', (v_line ->> 'quantity')::integer,
        'metadata', jsonb_build_object('contractId', v_definition.id)
      ))
    );
    v_paid := v_paid || jsonb_build_object(
      'definition_id', v_line ->> 'definitionId',
      'quantity', (v_line ->> 'quantity')::integer
    );
  end loop;

  update public.contract_assignments as assignments
  set claimed_at = v_now, claim_operation_id = p_operation_id
  where assignments.id = p_assignment_id;

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

revoke all on function public.claim_contract_reward(text, bigint) from public, anon;
grant execute on function public.claim_contract_reward(text, bigint) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- Collections
-- ════════════════════════════════════════════════════════════════════════════

/*
 * The three pages, derived and never stored.
 *
 * Fish from the attempts that landed them; artifacts from the boxes that
 * made them and the relics the bag holds, counted by instance so a box and
 * its relic are one find; classes from the runs, dungeons won and the
 * deepest Abyss floor each class reached.
 */
create function public.get_collection_state()
returns jsonb
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
begin
  if v_profile_id is null then
    raise exception 'Authentication is required.';
  end if;

  return jsonb_build_object(
    'fish', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'definition_id', catches.definition_id,
        'catches', catches.catches,
        'best_rarity', catches.best_rarity,
        'record_size_percentile', catches.record_size
      ) order by catches.definition_id), '[]'::jsonb)
      from (
        select
          attempts.result ->> 'definitionId' as definition_id,
          count(*) as catches,
          (array_agg(attempts.result -> 'metadata' ->> 'rarity'
            order by public.contract_rarity_rank(attempts.result -> 'metadata' ->> 'rarity') desc))[1] as best_rarity,
          max((attempts.result -> 'metadata' ->> 'sizePercentile')::numeric) as record_size
        from public.fishing_attempts as attempts
        where attempts.profile_id = v_profile_id
          and attempts.status = 'completed'
          and attempts.result ->> 'definitionId' is not null
        group by attempts.result ->> 'definitionId'
      ) as catches
    ),
    'artifacts', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'definition_id', finds.definition_id,
        'found', finds.found,
        'best_rarity', finds.best_rarity
      ) order by finds.definition_id), '[]'::jsonb)
      from (
        select
          relics.definition_id,
          count(distinct relics.instance_id) as found,
          (array_agg(relics.rarity order by public.contract_rarity_rank(relics.rarity) desc))[1] as best_rarity
        from (
          select
            openings.result_definition_id as definition_id,
            openings.result_item_instance_id as instance_id,
            openings.result_metadata ->> 'rarity' as rarity
          from public.loot_box_openings as openings
          where openings.profile_id = v_profile_id
            and openings.result_definition_id like 'artifact-%'
          union all
          select
            instances.definition_id,
            instances.id,
            instances.metadata ->> 'rarity'
          from public.inventory_item_instances as instances
          where instances.profile_id = v_profile_id
            and instances.definition_id like 'artifact-%'
        ) as relics
        group by relics.definition_id
      ) as finds
    ),
    'classes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'class_id', classes.class_id,
        'victories', classes.victories,
        'deepest_abyss_floor', classes.deepest
      ) order by classes.class_id), '[]'::jsonb)
      from (
        select
          runs.class_id,
          count(*) filter (where runs.mode_id = 'dungeon' and runs.status = 'victory') as victories,
          coalesce(max(runs.current_floor) filter (where runs.mode_id = 'infinite-abyss'), 0) as deepest
        from public.dungeon_runs as runs
        where runs.profile_id = v_profile_id
        group by runs.class_id
      ) as classes
      where classes.victories > 0 or classes.deepest > 0
    )
  );
end;
$$;

revoke all on function public.get_collection_state() from public, anon;
grant execute on function public.get_collection_state() to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- The Trophy hall
-- ════════════════════════════════════════════════════════════════════════════

-- A building with no job and no recipe: it shows what the collections have
-- earned. Bought with timber and stone; mirrored in CampBuildings.ts.
insert into public.camp_building_definitions (id, name, sort_order, starting_level) values
  ('trophy-hall', 'Trophy hall', 7, 0)
on conflict (id) do update
set name = excluded.name,
    sort_order = excluded.sort_order,
    starting_level = excluded.starting_level,
    active = true;

insert into public.camp_building_levels (
  building_id, level, cost, accrual_cap_hours, rate_multiplier, job_slots
) values
  ('trophy-hall', 1, '{"timber": 50, "stone": 50}'::jsonb, null, 1, 0)
on conflict (building_id, level) do update
set cost = excluded.cost,
    accrual_cap_hours = excluded.accrual_cap_hours,
    rate_multiplier = excluded.rate_multiplier,
    job_slots = excluded.job_slots;
