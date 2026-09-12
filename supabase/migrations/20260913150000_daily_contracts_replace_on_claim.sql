-- Daily contracts are dealt without end: a claimed one is replaced on the spot.
--
-- The board keeps three daily slots, and a slot never stays spent. When a
-- daily contract is claimed, the same call deals a fresh one into its slot,
-- drawn from the dailies the player can reach and not already on the board,
-- preferring the ones dealt fewest times today so the whole pool is seen
-- before any repeats. The replacement's window opens at the moment it is
-- dealt and still closes at midnight UTC, so what was done earlier in the day
-- does not count toward it, and the day's board still turns over with the
-- day. The weekly contract is unchanged: one a week, claimed once.
--
-- The claimed rows stay, as the record of the day; only the live ones hold a
-- slot, which is what the partial index below says.

alter table public.contract_assignments
  drop constraint contract_assignments_profile_id_cadence_period_key_slot_key;

alter table public.contract_assignments
  drop constraint contract_assignments_profile_id_period_key_definition_id_key;

create unique index contract_assignments_live_slot_idx
  on public.contract_assignments (profile_id, cadence, period_key, slot)
  where claimed_at is null;

/*
 * Deal one daily contract into a slot that has just been freed.
 *
 * Eligible: active dailies the player can reach that are not on the live
 * board. Ordered by how many times each has been dealt this period, then by
 * a hash of the account, the period, the definition and the number of deals
 * so far, so the sequence is fixed per account and day and a retry deals the
 * same contract.
 */
create function public.contract_deal_daily_replacement(
  p_profile_id uuid,
  p_period_key text,
  p_slot integer,
  p_window_start timestamptz,
  p_window_end timestamptz
)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_generation integer;
begin
  select count(*) into v_generation
  from public.contract_assignments as assignments
  where assignments.profile_id = p_profile_id
    and assignments.cadence = 'daily'
    and assignments.period_key = p_period_key;

  insert into public.contract_assignments (
    profile_id, definition_id, cadence, period_key, window_start, window_end, slot
  )
  select p_profile_id, dealt.id, 'daily', p_period_key, p_window_start, p_window_end, p_slot
  from (
    select
      definitions.id,
      (
        select count(*)
        from public.contract_assignments as dealt_before
        where dealt_before.profile_id = p_profile_id
          and dealt_before.period_key = p_period_key
          and dealt_before.definition_id = definitions.id
      ) as dealt_today,
      hashtextextended(
        p_profile_id::text || ':' || p_period_key || ':' || definitions.id || ':' || v_generation::text, 0
      ) as roll
    from public.contract_definitions as definitions
    where definitions.active
      and definitions.cadence = 'daily'
      and not exists (
        select 1
        from public.contract_assignments as live
        where live.profile_id = p_profile_id
          and live.cadence = 'daily'
          and live.period_key = p_period_key
          and live.claimed_at is null
          and live.definition_id = definitions.id
      )
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
    order by dealt_today, roll, definitions.id
    limit 1
  ) as dealt
  on conflict do nothing;
end;
$$;

revoke all on function public.contract_deal_daily_replacement(uuid, text, integer, timestamptz, timestamptz)
  from public, anon, authenticated;

/*
 * The board: the live contracts of the current day and week, the claimed
 * weekly one so its card can say so, and how many dailies have been claimed
 * today. Rewritten whole with the same signature.
 */
create or replace function public.contract_state_for(p_profile_id uuid)
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

/*
 * The claim, with the replacement: a daily contract's slot is dealt again in
 * the same transaction, so the board the caller gets back already has the
 * next contract in it. Rewritten whole with the same signature.
 */
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

  -- A daily slot never stays spent: deal the next one into it now, with a
  -- window that opens here and closes when the day does.
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
