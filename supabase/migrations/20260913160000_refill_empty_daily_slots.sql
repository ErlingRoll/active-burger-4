-- A daily slot with nothing live in it is dealt again on the next read.
--
-- The board dealt before dailies became endless left a claimed contract in
-- its slot with nothing to follow it, and a slot can also come up empty when
-- the pool had nothing to deal at the moment of a claim. Rather than a
-- one-off backfill, the state read now walks the three daily slots and deals
-- into any that has no live row, with a window opening at that read and
-- closing with the day. A board once read is always full. Rewritten whole
-- with the same signature.

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
