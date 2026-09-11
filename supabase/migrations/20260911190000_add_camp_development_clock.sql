-- Development builds may move the Camp's clock forward.
--
-- Production is measured from the moment stored on each assignment, so
-- testing a claim otherwise means waiting for real hours to pass. Backdating
-- that moment by a few hours produces a few hours of work at once, through
-- the same accrual and the same claim as the real thing; nothing else is
-- touched, and the Storehouse cap still applies on claim.
--
-- Guarded the same way as development inventory grants and development
-- Champions: the caller's JWT must carry the admin role.

create function public.advance_camp_clock(p_hours numeric)
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
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Administrator access is required to advance the Camp clock.';
  end if;
  if p_hours is null or p_hours <= 0 or p_hours > 48 then
    raise exception 'The Camp clock can be advanced by up to 48 hours at a time.';
  end if;

  update public.camp_assignments as assignments
  set accrued_from = assignments.accrued_from - make_interval(secs => p_hours * 3600)
  where assignments.profile_id = v_profile_id;

  return public.camp_state_for(v_profile_id);
end;
$$;

revoke all on function public.advance_camp_clock(numeric) from public, anon;
grant execute on function public.advance_camp_clock(numeric) to authenticated;
