-- Champions staff the Camp.
--
-- Slice 1 of docs/features/camp_delivery_plan.md: the per-player tables, the
-- RPCs that assign, unassign and claim, and the two hooks that keep a working
-- Champion out of the Abyss and settle its production when it leaves the
-- roster. The reference tables and the two pure functions this leans on
-- shipped in the foundations migration before it.
--
-- Three rules from camp.md shape every function here. Assigning is free and
-- instant, so nothing here has a cooldown. Unassigning settles production, so
-- a player never has to remember to claim before moving a Champion. And a
-- claim is an inventory operation, so a refresh, a retry or two open tabs
-- cannot pay twice.

create table public.camp_buildings (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  building_id text not null references public.camp_building_definitions (id),
  level integer not null default 1 check (level >= 1),
  primary key (profile_id, building_id)
);

-- One row per working Champion: the job, the labour sheet snapshotted at
-- assignment, and the accrual clock. The sheet is read here on every claim
-- rather than re-derived, so a later balance change never rewrites production
-- that already happened. The three columns beside it are the figures the
-- claim reads; the jsonb keeps the full breakdown for the panel.
create table public.camp_assignments (
  champion_id text primary key references public.champions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  job_id text not null references public.camp_job_definitions (id),
  sheet jsonb not null check (jsonb_typeof(sheet) = 'object'),
  output numeric not null check (output > 0),
  stamina_hours numeric not null check (stamina_hours > 0),
  bonus_chance numeric not null check (bonus_chance >= 0 and bonus_chance <= 1),
  assigned_at timestamptz not null default now(),
  /* The accrual clock: the moment unclaimed production is measured from. */
  accrued_from timestamptz not null default now()
);

create index camp_assignments_profile_idx
  on public.camp_assignments (profile_id, job_id);

alter table public.camp_buildings enable row level security;
alter table public.camp_assignments enable row level security;

create policy "Camp buildings are readable by their owner"
on public.camp_buildings for select to authenticated
using ((select auth.uid()) = profile_id);
create policy "Camp assignments are readable by their owner"
on public.camp_assignments for select to authenticated
using ((select auth.uid()) = profile_id);

grant select on public.camp_buildings, public.camp_assignments to authenticated;

/* A building a player has never touched is at level one. */
create function public.camp_building_level(p_profile_id uuid, p_building_id text)
returns integer
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(
    (select buildings.level
     from public.camp_buildings as buildings
     where buildings.profile_id = p_profile_id
       and buildings.building_id = p_building_id),
    1
  );
$$;

/* The offline accrual cap the player's Storehouse sets. */
create function public.camp_storehouse_cap_hours(p_profile_id uuid)
returns numeric
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(
    (select levels.accrual_cap_hours
     from public.camp_building_levels as levels
     where levels.building_id = 'storehouse'
       and levels.level = public.camp_building_level(p_profile_id, 'storehouse')),
    8
  );
$$;

/* Units per hour one assignment pays: the job's base rate, the building's
   multiplier at the player's level, and the sheet's output. */
create function public.camp_assignment_rate_per_hour(p_assignment public.camp_assignments)
returns numeric
language sql
stable
security definer set search_path = ''
as $$
  select jobs.base_rate_per_hour
    * coalesce(levels.rate_multiplier, 1)
    * p_assignment.output
  from public.camp_job_definitions as jobs
  left join public.camp_building_levels as levels
    on levels.building_id = jobs.building_id
   and levels.level = public.camp_building_level(p_assignment.profile_id, jobs.building_id)
  where jobs.id = p_assignment.job_id;
$$;

revoke all on function public.camp_building_level(uuid, text)
  from public, anon, authenticated;
revoke all on function public.camp_storehouse_cap_hours(uuid)
  from public, anon, authenticated;
revoke all on function public.camp_assignment_rate_per_hour(public.camp_assignments)
  from public, anon, authenticated;

/*
 * Everything the panel shows, in one read.
 *
 * Every building at its level, every assignment with its sheet and what it
 * has pending right now, the floor each Champion was won on (so the picker
 * can preview a sheet with the same input the server will use), and the
 * server's clock so the client can count pending units up from it rather
 * than from its own.
 */
create function public.camp_state_for(p_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_cap numeric := public.camp_storehouse_cap_hours(p_profile_id);
begin
  return jsonb_build_object(
    'server_time', v_now,
    'storehouse_cap_hours', v_cap,
    'buildings', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'building_id', definitions.id,
        'level', public.camp_building_level(p_profile_id, definitions.id)
      ) order by definitions.sort_order), '[]'::jsonb)
      from public.camp_building_definitions as definitions
      where definitions.active
    ),
    'assignments', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'champion_id', assignments.champion_id,
        'job_id', assignments.job_id,
        'sheet', assignments.sheet,
        'assigned_at', assignments.assigned_at,
        'accrued_from', assignments.accrued_from,
        'rate_per_hour', rates.rate,
        'cap_hours', least(assignments.stamina_hours, v_cap),
        'pending_units', accrual.units
      ) order by assignments.assigned_at, assignments.champion_id), '[]'::jsonb)
      from public.camp_assignments as assignments
      cross join lateral (
        select public.camp_assignment_rate_per_hour(assignments) as rate
      ) as rates
      cross join lateral public.camp_accrue(
        rates.rate,
        least(assignments.stamina_hours, v_cap),
        assignments.accrued_from,
        v_now
      ) as accrual
      where assignments.profile_id = p_profile_id
    ),
    'champions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'champion_id', champions.id,
        -- `least` skips nulls, and a development Champion has no run.
        'source_floor', case
          when runs.max_floor is null then null
          else least(runs.max_floor, 1000000)::integer
        end
      )), '[]'::jsonb)
      from public.champions as champions
      left join public.dungeon_runs as runs on runs.id = champions.source_run_id
      where champions.profile_id = p_profile_id
        and not champions.archived
    )
  );
end;
$$;

create function public.get_camp_state()
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
  return public.camp_state_for(v_profile_id);
end;
$$;

revoke all on function public.camp_state_for(uuid) from public, anon, authenticated;
revoke all on function public.get_camp_state() from public, anon;
grant execute on function public.get_camp_state() to authenticated;

/*
 * Pay out what one Champion, or every Champion, has produced.
 *
 * One ledger row per operation id, so a retry returns what the first call
 * paid and pays nothing more. Each assignment's grant goes through
 * `grant_inventory_items` under its own derived id, and its clock advances
 * only by the time the paid units cost, so the unpaid fraction of a unit
 * carries forward to the next claim.
 *
 * The bonus stack is rolled once per claim from the operation id and the
 * Champion, so a retry cannot reroll it: a critical hit at the Camp pays a
 * quarter again on top of the claim.
 */
create function public.camp_claim(
  p_profile_id uuid,
  p_operation_id text,
  p_champion_id text
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_operation public.inventory_operations%rowtype;
  v_now timestamptz := now();
  v_cap numeric := public.camp_storehouse_cap_hours(p_profile_id);
  v_assignment public.camp_assignments%rowtype;
  v_rate numeric;
  v_accrual record;
  v_bonus integer;
  v_roll numeric;
  v_job public.camp_job_definitions%rowtype;
  v_paid jsonb := '[]'::jsonb;
begin
  if coalesce(length(trim(p_operation_id)), 0) = 0 then
    raise exception 'A non-empty inventory operation ID is required.';
  end if;

  v_operation := public.inventory_claim_operation(
    p_profile_id, p_operation_id, 'camp-claim',
    jsonb_build_object('championId', p_champion_id)
  );
  if v_operation.status = 'completed' then
    return jsonb_build_object('paid', v_operation.result, 'was_processed', false);
  end if;

  for v_assignment in
    select assignments.*
    from public.camp_assignments as assignments
    where assignments.profile_id = p_profile_id
      and (p_champion_id is null or assignments.champion_id = p_champion_id)
    order by assignments.assigned_at, assignments.champion_id
    for update
  loop
    v_rate := public.camp_assignment_rate_per_hour(v_assignment);
    select * into v_accrual
    from public.camp_accrue(
      v_rate, least(v_assignment.stamina_hours, v_cap), v_assignment.accrued_from, v_now
    );

    v_bonus := 0;
    if v_accrual.units > 0 then
      select jobs.* into v_job
      from public.camp_job_definitions as jobs
      where jobs.id = v_assignment.job_id;

      -- A fraction in [0, 1) from the first eight hex digits of the digest.
      v_roll := ((('x' || substr(md5(p_operation_id || ':' || v_assignment.champion_id), 1, 8))::bit(32)::int)::bigint
        & 4294967295) / 4294967296.0;
      if v_roll < v_assignment.bonus_chance then
        v_bonus := ceil(v_accrual.units * 0.25)::integer;
      end if;

      perform 1 from public.grant_inventory_items(
        p_operation_id || ':' || v_assignment.champion_id,
        'system',
        v_assignment.job_id,
        jsonb_build_array(jsonb_build_object(
          'definitionId', v_job.output_definition_id,
          'quantity', v_accrual.units + v_bonus,
          'metadata', jsonb_build_object(
            'campJobId', v_assignment.job_id,
            'championId', v_assignment.champion_id
          )
        ))
      );

      v_paid := v_paid || jsonb_build_object(
        'champion_id', v_assignment.champion_id,
        'job_id', v_assignment.job_id,
        'definition_id', v_job.output_definition_id,
        'units', v_accrual.units,
        'bonus_units', v_bonus
      );
    end if;

    update public.camp_assignments as assignments
    set accrued_from = v_accrual.accrued_from
    where assignments.champion_id = v_assignment.champion_id;
  end loop;

  update public.inventory_operations as operations
  set status = 'completed', result = v_paid, completed_at = v_now
  where operations.profile_id = p_profile_id
    and operations.operation_id = p_operation_id;

  return jsonb_build_object('paid', v_paid, 'was_processed', true);
end;
$$;

revoke all on function public.camp_claim(uuid, text, text) from public, anon, authenticated;

create function public.claim_camp_production(p_operation_id text)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_claim jsonb;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to claim Camp production.';
  end if;
  v_claim := public.camp_claim(v_profile_id, p_operation_id, null);
  return v_claim || jsonb_build_object('state', public.camp_state_for(v_profile_id));
end;
$$;

/*
 * Send a Champion to a job.
 *
 * The Champion must be the caller's, on the roster, and not in the middle of
 * a run. An exhausted Champion may work: exhaustion blocks the Abyss, not
 * labour. A Champion already working elsewhere is settled and moved in the
 * same call, so the player never has to unassign first. The labour sheet is
 * derived here from the build and the floor of the run that won it, and
 * stored on the row.
 */
create function public.assign_champion_to_camp_job(
  p_operation_id text,
  p_champion_id text,
  p_job_id text
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_champion public.champions%rowtype;
  v_job public.camp_job_definitions%rowtype;
  v_building public.camp_building_definitions%rowtype;
  v_existing public.camp_assignments%rowtype;
  v_moving boolean;
  v_source_floor integer;
  v_sheet jsonb;
  v_slots integer;
  v_taken integer;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required.';
  end if;
  if coalesce(length(trim(p_operation_id)), 0) = 0 then
    raise exception 'A non-empty inventory operation ID is required.';
  end if;

  select champions.* into v_champion
  from public.champions as champions
  where champions.id = p_champion_id
    and champions.profile_id = v_profile_id
    and not champions.archived
  for update;
  if not found then
    raise exception 'Champion not found.';
  end if;

  select jobs.* into v_job
  from public.camp_job_definitions as jobs
  where jobs.id = p_job_id and jobs.active;
  if not found then
    raise exception 'Unknown Camp job.';
  end if;
  select definitions.* into v_building
  from public.camp_building_definitions as definitions
  where definitions.id = v_job.building_id;

  select assignments.* into v_existing
  from public.camp_assignments as assignments
  where assignments.champion_id = p_champion_id
  for update;
  v_moving := found;
  if v_moving and v_existing.job_id = p_job_id then
    return public.camp_state_for(v_profile_id);
  end if;

  -- A Champion mid-descent is in the dungeon, not at the fire.
  if exists (
    select 1
    from public.dungeon_runs as runs
    join public.dungeon_run_snapshots as snapshots on snapshots.run_id = runs.id
    where runs.profile_id = v_profile_id
      and runs.status in ('active', 'paused')
      and snapshots.snapshot_kind = 'start'
      and snapshots.payload -> 'runConfig' ->> 'championId' = p_champion_id
  ) then
    raise exception 'This Champion is on an expedition. Finish or forfeit it first.';
  end if;

  select coalesce(levels.job_slots, 0) into v_slots
  from public.camp_building_levels as levels
  where levels.building_id = v_job.building_id
    and levels.level = public.camp_building_level(v_profile_id, v_job.building_id);
  select count(*) into v_taken
  from public.camp_assignments as assignments
  join public.camp_job_definitions as jobs on jobs.id = assignments.job_id
  where assignments.profile_id = v_profile_id
    and jobs.building_id = v_job.building_id
    and assignments.champion_id <> p_champion_id;
  if v_taken >= coalesce(v_slots, 0) then
    raise exception 'No room at the %.', coalesce(v_building.name, v_job.building_id);
  end if;

  -- Moving between jobs settles what the old job produced first.
  if v_moving then
    perform public.camp_claim(v_profile_id, p_operation_id || ':settle', p_champion_id);
    delete from public.camp_assignments as assignments
    where assignments.champion_id = p_champion_id;
  end if;

  select least(runs.max_floor, 1000000)::integer into v_source_floor
  from public.dungeon_runs as runs
  where runs.id = v_champion.source_run_id;
  if not found then
    v_source_floor := null;
  end if;
  v_sheet := public.camp_labour_sheet(v_champion.build, v_source_floor, p_job_id);

  insert into public.camp_assignments (
    champion_id, profile_id, job_id, sheet, output, stamina_hours, bonus_chance
  ) values (
    p_champion_id,
    v_profile_id,
    p_job_id,
    v_sheet,
    (v_sheet ->> 'output')::numeric,
    (v_sheet ->> 'staminaHours')::numeric,
    (v_sheet ->> 'bonusChance')::numeric
  );

  return public.camp_state_for(v_profile_id);
end;
$$;

/*
 * Bring a Champion back from its job. What it produced is paid into the
 * inventory as part of the same operation; nothing is forfeited.
 */
create function public.unassign_champion_from_camp(
  p_operation_id text,
  p_champion_id text
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_claim jsonb;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required.';
  end if;
  if not exists (
    select 1 from public.camp_assignments as assignments
    where assignments.champion_id = p_champion_id
      and assignments.profile_id = v_profile_id
  ) then
    -- Already home, or a retry of a call that landed: nothing to settle.
    return jsonb_build_object(
      'paid', '[]'::jsonb,
      'was_processed', false,
      'state', public.camp_state_for(v_profile_id)
    );
  end if;

  v_claim := public.camp_claim(v_profile_id, p_operation_id, p_champion_id);
  delete from public.camp_assignments as assignments
  where assignments.champion_id = p_champion_id
    and assignments.profile_id = v_profile_id;

  return v_claim || jsonb_build_object('state', public.camp_state_for(v_profile_id));
end;
$$;

revoke all on function public.claim_camp_production(text) from public, anon;
revoke all on function public.assign_champion_to_camp_job(text, text, text) from public, anon;
revoke all on function public.unassign_champion_from_camp(text, text) from public, anon;
grant execute on function public.claim_camp_production(text) to authenticated;
grant execute on function public.assign_champion_to_camp_job(text, text, text) to authenticated;
grant execute on function public.unassign_champion_from_camp(text, text) to authenticated;

/*
 * A Champion that leaves the roster leaves its job, paid.
 *
 * Archiving is the one way off the roster, whether from the champions page
 * or from a victory that replaces a Champion at a full roster, so a trigger
 * on that flag covers both paths without either RPC knowing the Camp exists.
 * The operation id is derived from the Champion, which is archived once.
 */
create function public.camp_settle_archived_champion()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.camp_assignments as assignments
    where assignments.champion_id = new.id
  ) then
    perform public.camp_claim(new.profile_id, 'camp-archive:' || new.id, new.id);
    delete from public.camp_assignments as assignments
    where assignments.champion_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.camp_settle_archived_champion()
  from public, anon, authenticated;

create trigger champions_archive_settles_camp
  before update of archived on public.champions
  for each row
  when (new.archived and not old.archived)
  execute function public.camp_settle_archived_champion();

/*
 * The Abyss refuses a working Champion.
 *
 * The run setup screen hides the choice, but the lockout has to hold even if
 * a client skips the check, so it lives where exhaustion is applied: the
 * trigger that fires on an Abyss run's start snapshot, in the same
 * transaction as the run. Rewritten whole; the signature is unchanged.
 */
create or replace function public.apply_abyss_champion_exhaustion()
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

  if exists (
    select 1 from public.camp_assignments as assignments
    where assignments.champion_id = v_champion_id
  ) then
    raise exception 'Champion is working at the Camp. Bring it back before the descent.';
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
