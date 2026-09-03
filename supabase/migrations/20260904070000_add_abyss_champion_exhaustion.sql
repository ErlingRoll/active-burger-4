-- Exhaust the selected Champion when an Infinite Abyss run is committed.
-- The trigger runs in the same transaction as the start RPC, so failures roll
-- back the run and the exhaustion update together.

create function public.apply_abyss_champion_exhaustion()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_run public.dungeon_runs%rowtype;
  v_champion_id text;
begin
  select * into v_run
  from public.dungeon_runs
  where id = new.run_id;
  if not found or v_run.mode_id <> 'infinite-abyss' then
    return new;
  end if;

  v_champion_id := new.payload -> 'runConfig' ->> 'championId';
  if coalesce(length(trim(v_champion_id)), 0) = 0 then
    raise exception 'Infinite Abyss runs require a Champion identity.';
  end if;

  update public.champions
  set exhaustion_until = now() + interval '24 hours'
  where id = v_champion_id
    and profile_id = v_run.profile_id
    and not archived
    and (exhaustion_until is null or exhaustion_until <= now());
  if not found then
    raise exception 'Champion is unavailable or already exhausted.';
  end if;
  return new;
end;
$$;

revoke all on function public.apply_abyss_champion_exhaustion()
  from public, anon, authenticated;

create trigger dungeon_run_start_apply_abyss_exhaustion
  after insert on public.dungeon_run_snapshots
  for each row
  when (new.snapshot_kind = 'start')
  execute function public.apply_abyss_champion_exhaustion();
