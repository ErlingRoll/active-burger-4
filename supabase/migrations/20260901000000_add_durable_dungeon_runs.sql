-- ════════════════════════════════════════════════════════════════════════════
-- dungeon_runs
--   Owner-scoped metadata table for each durable dungeon run.
--   Exactly one row per client-generated run ID.
-- ════════════════════════════════════════════════════════════════════════════
create table public.dungeon_runs (
  id text primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'paused', 'victory', 'defeat', 'forfeited')),
  contract_id text not null,
  world_modifier_ids text[] not null default '{}',
  seed bigint not null,
  dungeon_id text not null,
  playstyle_id text not null,
  game_version text not null,
  max_floor integer not null check (max_floor >= 1),
  current_floor integer not null default 1 check (current_floor >= 1),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  -- Terminal statuses must have completed_at; incomplete statuses must not.
  check (
    (status in ('victory', 'defeat', 'forfeited') and completed_at is not null)
    or (status in ('active', 'paused') and completed_at is null)
  )
);

-- Analytics indexes.
create index dungeon_runs_profile_id_idx
  on public.dungeon_runs (profile_id);

create index dungeon_runs_profile_status_idx
  on public.dungeon_runs (profile_id, status);

create index dungeon_runs_status_completed_at_idx
  on public.dungeon_runs (status, completed_at)
  where completed_at is not null;

-- Uniqueness invariant: at most one active or paused run per profile.
create unique index dungeon_runs_one_incomplete_per_profile
  on public.dungeon_runs (profile_id)
  where status in ('active', 'paused');

-- ════════════════════════════════════════════════════════════════════════════
-- dungeon_run_snapshots
--   Append-only table of floor checkpoints.
--   Multiple snapshots per (run_id, floor_number) are possible; the latest
--   row (highest id) is authoritative for any given floor.
-- ════════════════════════════════════════════════════════════════════════════
create table public.dungeon_run_snapshots (
  id bigint generated always as identity primary key,
  run_id text not null references public.dungeon_runs (id),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  snapshot_kind text not null
    check (snapshot_kind in ('start', 'floor', 'victory', 'death', 'forfeit')),
  floor_number integer not null check (floor_number >= 1),
  level integer not null default 1 check (level >= 1),
  kill_count integer not null default 0 check (kill_count >= 0),
  payload jsonb not null,
  saved_at timestamptz not null default now()
);

-- For ordered retrieval of all snapshots belonging to a run.
create index dungeon_run_snapshots_run_id_idx
  on public.dungeon_run_snapshots (run_id, id);

-- For floor-specific snapshot lookups.
create index dungeon_run_snapshots_run_floor_idx
  on public.dungeon_run_snapshots (run_id, floor_number, id);

create index dungeon_run_snapshots_kind_idx
  on public.dungeon_run_snapshots (run_id, snapshot_kind, id);

-- ════════════════════════════════════════════════════════════════════════════
-- Row-level security
-- ════════════════════════════════════════════════════════════════════════════
alter table public.dungeon_runs enable row level security;
alter table public.dungeon_run_snapshots enable row level security;

create policy "Dungeon runs are readable by their owner"
on public.dungeon_runs for select to authenticated
using ((select auth.uid()) = profile_id);

create policy "Dungeon run snapshots are readable by their owner"
on public.dungeon_run_snapshots for select to authenticated
using ((select auth.uid()) = profile_id);

grant select on public.dungeon_runs, public.dungeon_run_snapshots to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- start_dungeon_run
--   Atomically creates a new dungeon run and records its initial floor
--   checkpoint.  Idempotent: if the caller-supplied run ID already exists
--   and belongs to this profile the existing row is returned unchanged.
--   Rejects the call when the profile already has an active or paused run.
-- ════════════════════════════════════════════════════════════════════════════
create function public.start_dungeon_run(
  p_run_id text,
  p_seed bigint,
  p_contract_id text,
  p_world_modifier_ids text[],
  p_max_floor integer,
  p_started_at timestamptz,
  p_dungeon_id text,
  p_playstyle_id text,
  p_game_version text,
  p_initial_payload jsonb
)
returns table (
  run_id text,
  status text,
  started_at timestamptz,
  was_created boolean
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_existing public.dungeon_runs%rowtype;
  v_resolved_at timestamptz;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to start a dungeon run.';
  end if;
  if coalesce(length(trim(p_run_id)), 0) = 0 then
    raise exception 'A non-empty run ID is required.';
  end if;
  if coalesce(length(trim(p_contract_id)), 0) = 0 then
    raise exception 'A non-empty contract ID is required.';
  end if;
  if coalesce(length(trim(p_dungeon_id)), 0) = 0 then
    raise exception 'A non-empty dungeon ID is required.';
  end if;
  if coalesce(length(trim(p_playstyle_id)), 0) = 0 then
    raise exception 'A non-empty playstyle ID is required.';
  end if;
  if coalesce(length(trim(p_game_version)), 0) = 0 then
    raise exception 'A non-empty game version is required.';
  end if;
  if p_max_floor < 1 then
    raise exception 'max_floor must be at least 1.';
  end if;

  v_resolved_at := coalesce(p_started_at, now());

  -- Idempotency: return the existing run if this ID was already submitted.
  select * into v_existing
  from public.dungeon_runs
  where id = p_run_id;

  if found then
    if v_existing.profile_id <> v_profile_id then
      raise exception 'Run ID is already claimed by another profile.';
    end if;
    return query
    select p_run_id, v_existing.status, v_existing.started_at, false;
    return;
  end if;

  -- Reject a second concurrent incomplete run.
  if exists (
    select 1
    from public.dungeon_runs as runs
    where runs.profile_id = v_profile_id
      and runs.status in ('active', 'paused')
  ) then
    raise exception 'Cannot start a new run while another run is still active or paused.';
  end if;

  insert into public.dungeon_runs (
    id, profile_id, status, contract_id, world_modifier_ids,
    seed, dungeon_id, playstyle_id, game_version, max_floor, current_floor,
    started_at, updated_at
  ) values (
    p_run_id,
    v_profile_id,
    'active',
    p_contract_id,
    coalesce(p_world_modifier_ids, '{}'),
    p_seed, p_dungeon_id, p_playstyle_id, p_game_version,
    p_max_floor,
    1,
    v_resolved_at,
    v_resolved_at
  );

  insert into public.dungeon_run_snapshots (
    run_id, profile_id, snapshot_kind, floor_number, level, kill_count,
    payload, saved_at
  ) values (
    p_run_id,
    v_profile_id,
    'start',
    1,
    greatest(1, coalesce(
      (p_initial_payload -> 'gameState' -> 'player' ->> 'level')::integer,
      1
    )),
    greatest(0, coalesce(
      (p_initial_payload -> 'gameState' -> 'run' ->> 'killCount')::integer,
      0
    )),
    coalesce(p_initial_payload, '{}'::jsonb),
    v_resolved_at
  );

  return query select p_run_id, 'active'::text, v_resolved_at, true;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- checkpoint_dungeon_run
--   Appends a floor checkpoint for an active or paused run and advances the
--   tracked current_floor when the player has progressed.  Rejected for runs
--   that have already reached a terminal status.
-- ════════════════════════════════════════════════════════════════════════════
create function public.checkpoint_dungeon_run(
  p_run_id text,
  p_floor_number integer,
  p_payload jsonb
)
returns table (
  run_id text,
  floor_number integer,
  snapshot_id bigint,
  saved_at timestamptz
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_run public.dungeon_runs%rowtype;
  v_existing_snapshot public.dungeon_run_snapshots%rowtype;
  v_snapshot_id bigint;
  v_saved_at timestamptz := now();
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to save a checkpoint.';
  end if;
  if coalesce(length(trim(p_run_id)), 0) = 0 then
    raise exception 'A non-empty run ID is required.';
  end if;
  if p_floor_number < 1 then
    raise exception 'floor_number must be at least 1.';
  end if;

  select * into v_run
  from public.dungeon_runs as runs
  where runs.id = p_run_id and runs.profile_id = v_profile_id
  for update;

  if not found then
    raise exception 'Dungeon run not found.';
  end if;
  if v_run.status not in ('active', 'paused') then
    raise exception 'Cannot save a checkpoint for a % run.', v_run.status;
  end if;
  if p_floor_number > v_run.max_floor then
    raise exception 'Checkpoint floor % exceeds the run maximum floor %.',
      p_floor_number, v_run.max_floor;
  end if;
  if p_floor_number <= v_run.current_floor then
    select * into v_existing_snapshot
    from public.dungeon_run_snapshots as snapshots
    where snapshots.run_id = p_run_id
      and snapshots.snapshot_kind = 'floor'
      and snapshots.floor_number = p_floor_number
    order by snapshots.id desc
    limit 1;
    if found and v_existing_snapshot.payload = coalesce(p_payload, '{}'::jsonb) then
      return query
      select
        p_run_id,
        v_existing_snapshot.floor_number,
        v_existing_snapshot.id,
        v_existing_snapshot.saved_at;
      return;
    end if;
    raise exception 'Checkpoint floor % is not newer than the current floor %.',
      p_floor_number, v_run.current_floor;
  end if;

  insert into public.dungeon_run_snapshots (
    run_id, profile_id, snapshot_kind, floor_number, level, kill_count,
    payload, saved_at
  ) values (
    p_run_id,
    v_profile_id,
    'floor',
    p_floor_number,
    greatest(1, coalesce(
      (p_payload -> 'gameState' -> 'player' ->> 'level')::integer,
      1
    )),
    greatest(0, coalesce(
      (p_payload -> 'gameState' -> 'run' ->> 'killCount')::integer,
      0
    )),
    coalesce(p_payload, '{}'::jsonb),
    v_saved_at
  )
  returning id into v_snapshot_id;

  update public.dungeon_runs as runs
  set status = v_run.status,
      current_floor = greatest(runs.current_floor, p_floor_number),
      updated_at = v_saved_at
  where runs.id = p_run_id;

  return query select p_run_id, p_floor_number, v_snapshot_id, v_saved_at;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- pause_dungeon_run
--   Marks the run paused without writing a checkpoint. The latest completed
--   floor checkpoint remains authoritative so Save & quit cannot reset a
--   mid-floor state.
-- ════════════════════════════════════════════════════════════════════════════
create function public.pause_dungeon_run(
  p_run_id text
)
returns table (
  run_id text,
  status text,
  updated_at timestamptz
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_run public.dungeon_runs%rowtype;
  v_saved_at timestamptz := now();
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to pause a dungeon run.';
  end if;
  if coalesce(length(trim(p_run_id)), 0) = 0 then
    raise exception 'A non-empty run ID is required.';
  end if;
  select * into v_run
  from public.dungeon_runs as runs
  where runs.id = p_run_id and runs.profile_id = v_profile_id
  for update;

  if not found then
    raise exception 'Dungeon run not found.';
  end if;
  if v_run.status not in ('active', 'paused') then
    raise exception 'Cannot pause a % run.', v_run.status;
  end if;

  update public.dungeon_runs as runs
  set status = 'paused',
      updated_at = v_saved_at
  where runs.id = p_run_id;

  return query select p_run_id, 'paused'::text, v_saved_at;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- complete_dungeon_run
--   Atomically marks the run terminal (victory or defeat) and awards Essence.
--   Mirrors the reward formula from submit_meta_run_result so both code paths
--   stay consistent.  Idempotent: a duplicate call returns the previously
--   computed Essence without modifying any row.
-- ════════════════════════════════════════════════════════════════════════════
create function public.complete_dungeon_run(
  p_run_id text,
  p_outcome text,
  p_completed_at timestamptz,
  p_result_payload jsonb
)
returns table (
  run_id text,
  essence_awarded integer,
  essence_balance bigint,
  was_processed boolean
)
language plpgsql
security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_profile_id uuid := auth.uid();
  v_run public.dungeon_runs%rowtype;
  v_level integer;
  v_kill_count integer;
  v_base_essence integer;
  v_essence integer;
  v_multiplier numeric := 1;
  v_modifier_id text;
  v_inserted boolean;
  v_final_at timestamptz;
  v_terminal_payload jsonb;
  v_floor_number integer;
  v_checkpoint jsonb;
  v_status text;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to complete a dungeon run.';
  end if;
  if coalesce(length(trim(p_run_id)), 0) = 0 then
    raise exception 'A non-empty run ID is required.';
  end if;
  if p_outcome not in ('victory', 'defeat') then
    raise exception 'Outcome must be ''victory'' or ''defeat''.';
  end if;

  v_final_at := coalesce(p_completed_at, now());

  select * into v_run
  from public.dungeon_runs as runs
  where runs.id = p_run_id and runs.profile_id = v_profile_id
  for update;

  if not found then
    raise exception 'Dungeon run not found.';
  end if;

  -- Idempotency: if already terminal, return the previously awarded Essence.
  if v_run.status not in ('active', 'paused') then
    return query
    select
      p_run_id,
      rewards.essence_earned,
      wallet.essence_balance,
      false
    from public.meta_run_rewards as rewards
    join public.meta_wallets as wallet on wallet.profile_id = v_profile_id
    where rewards.profile_id = v_profile_id
      and rewards.run_id = p_run_id;
    return;
  end if;

  -- ── Essence computation (kept in sync with submit_meta_run_result) ──────
  v_level := greatest(1, coalesce((p_result_payload ->> 'level')::integer, 1));
  v_kill_count := greatest(0, coalesce((p_result_payload ->> 'killCount')::integer, 0));

  -- Keep server-side reward values in sync with the content catalog.
  for v_modifier_id in
    select modifiers.value
    from (
      select distinct value
      from jsonb_array_elements_text(
        coalesce(p_result_payload -> 'worldModifierIds', '[]'::jsonb)
      ) as entries(value)
      where value in (
        'swarming',
        'juggernauts',
        'glass-world',
        'shorter-minute',
        'elite-invasion',
        'fast-start'
      )
    ) as modifiers
  loop
    v_multiplier := v_multiplier + case v_modifier_id
      when 'swarming'       then 0.10
      when 'juggernauts'    then 0.20
      when 'glass-world'    then 0.15
      when 'shorter-minute' then 0.15
      when 'elite-invasion' then 0.20
      when 'fast-start'     then 0.08
      else 0
    end;
  end loop;

  v_base_essence := v_level + floor(v_kill_count / 10.0)::integer;
  v_essence := greatest(
    1,
    floor(
      v_base_essence
      * v_multiplier
      * case when p_outcome = 'victory' then 1.10 else 1 end
    )::integer
  );
  -- ────────────────────────────────────────────────────────────────────────

  v_checkpoint := coalesce(p_result_payload -> 'checkpoint', '{}'::jsonb);
  v_status := case
    when p_outcome = 'victory' then 'victory'
    when (v_checkpoint -> 'gameState' -> 'run' ->> 'forfeited')::boolean then 'forfeited'
    else 'defeat'
  end;
  v_floor_number := greatest(
    1,
    coalesce(
      (v_checkpoint -> 'gameState' -> 'run' ->> 'floor')::integer,
      v_run.current_floor
    )
  );
  insert into public.dungeon_run_snapshots (
    run_id, profile_id, snapshot_kind, floor_number, level, kill_count,
    payload, saved_at
  ) values (
    p_run_id,
    v_profile_id,
    case when v_status = 'victory' then 'victory' else 'death' end,
    v_floor_number,
    v_level,
    v_kill_count,
    v_checkpoint,
    v_final_at
  );

  update public.dungeon_runs as runs
  set status = v_status,
      current_floor = greatest(runs.current_floor, v_floor_number),
      completed_at = v_final_at,
      updated_at = v_final_at
  where runs.id = p_run_id;

  insert into public.meta_wallets (profile_id)
  values (v_profile_id)
  on conflict (profile_id) do nothing;

  insert into public.meta_run_rewards (
    profile_id, run_id, pending_result_id, completed_at, essence_earned, payload
  ) values (
    v_profile_id, p_run_id, null, v_final_at, v_essence, p_result_payload
  )
  on conflict (profile_id, run_id) do nothing;
  v_inserted := found;

  if v_inserted then
    update public.meta_wallets as wallet
    set essence_balance = wallet.essence_balance + v_essence,
        essence_earned = wallet.essence_earned + v_essence,
        updated_at = v_final_at
    where wallet.profile_id = v_profile_id;
  else
    select rewards.essence_earned into v_essence
    from public.meta_run_rewards as rewards
    where rewards.profile_id = v_profile_id and rewards.run_id = p_run_id;
  end if;

  return query
  select p_run_id, v_essence, wallet.essence_balance, v_inserted
  from public.meta_wallets as wallet
  where wallet.profile_id = v_profile_id;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- forfeit_dungeon_run
--   Dashboard-initiated forfeit.  Reads the latest saved floor checkpoint,
--   derives a defeat-level Essence reward from it (no victory bonus), marks
--   the run forfeited, and awards the Essence atomically.
--   Idempotent: if the run is already terminal the existing Essence is
--   returned without modification.
-- ════════════════════════════════════════════════════════════════════════════
create function public.forfeit_dungeon_run(
  p_run_id text,
  p_forfeited_at timestamptz
)
returns table (
  run_id text,
  essence_awarded integer,
  essence_balance bigint,
  was_processed boolean
)
language plpgsql
security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_profile_id uuid := auth.uid();
  v_run public.dungeon_runs%rowtype;
  v_latest_payload jsonb;
  v_level integer;
  v_kill_count integer;
  v_base_essence integer;
  v_essence integer;
  v_multiplier numeric := 1;
  v_modifier_id text;
  v_inserted boolean;
  v_final_at timestamptz;
  v_terminal_payload jsonb;
  v_floor_number integer;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to forfeit a dungeon run.';
  end if;
  if coalesce(length(trim(p_run_id)), 0) = 0 then
    raise exception 'A non-empty run ID is required.';
  end if;

  v_final_at := coalesce(p_forfeited_at, now());

  select * into v_run
  from public.dungeon_runs as runs
  where runs.id = p_run_id and runs.profile_id = v_profile_id
  for update;

  if not found then
    raise exception 'Dungeon run not found.';
  end if;

  -- Idempotency: if already terminal, return the previously awarded Essence.
  if v_run.status not in ('active', 'paused') then
    return query
    select
      p_run_id,
      rewards.essence_earned,
      wallet.essence_balance,
      false
    from public.meta_run_rewards as rewards
    join public.meta_wallets as wallet on wallet.profile_id = v_profile_id
    where rewards.profile_id = v_profile_id
      and rewards.run_id = p_run_id;
    return;
  end if;

  -- Retrieve the latest checkpoint payload; fall back to an empty object when
  -- no checkpoint has been saved yet (e.g. forfeit immediately after creation).
  select snap.payload into v_latest_payload
  from public.dungeon_run_snapshots as snap
  where snap.run_id = p_run_id
  order by snap.id desc
  limit 1;

  v_latest_payload := coalesce(v_latest_payload, '{}'::jsonb);

  -- ── Essence computation (kept in sync with submit_meta_run_result) ──────
  v_level := greatest(
    1,
    coalesce(
      (v_latest_payload -> 'gameState' -> 'player' ->> 'level')::integer,
      (v_latest_payload ->> 'level')::integer,
      1
    )
  );
  v_kill_count := greatest(
    0,
    coalesce(
      (v_latest_payload -> 'gameState' -> 'run' ->> 'killCount')::integer,
      (v_latest_payload ->> 'killCount')::integer,
      0
    )
  );

  -- Keep server-side reward values in sync with the content catalog.
  for v_modifier_id in
    select modifiers.value
    from (
      select distinct value
      from jsonb_array_elements_text(
        coalesce(
          v_latest_payload -> 'gameState' -> 'run' -> 'worldModifierIds',
          v_latest_payload -> 'worldModifierIds',
          '[]'::jsonb
        )
      ) as entries(value)
      where value in (
        'swarming',
        'juggernauts',
        'glass-world',
        'shorter-minute',
        'elite-invasion',
        'fast-start'
      )
    ) as modifiers
  loop
    v_multiplier := v_multiplier + case v_modifier_id
      when 'swarming'       then 0.10
      when 'juggernauts'    then 0.20
      when 'glass-world'    then 0.15
      when 'shorter-minute' then 0.15
      when 'elite-invasion' then 0.20
      when 'fast-start'     then 0.08
      else 0
    end;
  end loop;

  v_base_essence := v_level + floor(v_kill_count / 10.0)::integer;
  -- Forfeits never receive the victory bonus.
  v_essence := greatest(
    1,
    floor(v_base_essence * v_multiplier)::integer
  );
  -- ────────────────────────────────────────────────────────────────────────

  v_terminal_payload := jsonb_set(
    v_latest_payload,
    '{gameState,run,phase}',
    '"defeat"'::jsonb,
    true
  );
  v_terminal_payload := jsonb_set(
    v_terminal_payload,
    '{gameState,run,forfeited}',
    'true'::jsonb,
    true
  );
  v_terminal_payload := jsonb_set(
    v_terminal_payload,
    '{gameState,run,playerCombatLog}',
    '[]'::jsonb,
    true
  );
  v_terminal_payload := jsonb_set(
    v_terminal_payload,
    '{gameState,player,hp}',
    '0'::jsonb,
    true
  );
  v_floor_number := greatest(
    1,
    coalesce(
      (v_terminal_payload -> 'gameState' -> 'run' ->> 'floor')::integer,
      v_run.current_floor
    )
  );

  update public.dungeon_runs as runs
  set status = 'forfeited',
      current_floor = greatest(runs.current_floor, v_floor_number),
      completed_at = v_final_at,
      updated_at = v_final_at
  where runs.id = p_run_id;

  insert into public.dungeon_run_snapshots (
    run_id, profile_id, snapshot_kind, floor_number, level, kill_count,
    payload, saved_at
  ) values (
    p_run_id, v_profile_id, 'forfeit', v_floor_number,
    v_level,
    v_kill_count,
    v_terminal_payload, v_final_at
  );

  insert into public.meta_wallets (profile_id)
  values (v_profile_id)
  on conflict (profile_id) do nothing;

  insert into public.meta_run_rewards (
    profile_id, run_id, pending_result_id, completed_at, essence_earned, payload
  ) values (
    v_profile_id,
    p_run_id,
    null,
    v_final_at,
    v_essence,
    jsonb_build_object(
      'checkpoint', v_terminal_payload,
      'level', v_level,
      'killCount', v_kill_count,
      'outcome', 'defeat',
      'worldModifierIds', coalesce(
        v_terminal_payload -> 'gameState' -> 'run' -> 'worldModifierIds',
        '[]'::jsonb
      )
    )
  )
  on conflict (profile_id, run_id) do nothing;
  v_inserted := found;

  if v_inserted then
    update public.meta_wallets as wallet
    set essence_balance = wallet.essence_balance + v_essence,
        essence_earned = wallet.essence_earned + v_essence,
        updated_at = v_final_at
    where wallet.profile_id = v_profile_id;
  else
    select rewards.essence_earned into v_essence
    from public.meta_run_rewards as rewards
    where rewards.profile_id = v_profile_id and rewards.run_id = p_run_id;
  end if;

  return query
  select p_run_id, v_essence, wallet.essence_balance, v_inserted
  from public.meta_wallets as wallet
  where wallet.profile_id = v_profile_id;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- purchase_meta_unlock (updated)
--   Adds a guard that rejects purchases while the profile has an active or
--   paused dungeon run, preventing currency manipulation mid-run.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.purchase_meta_unlock(p_unlock_id text)
returns table (
  unlock_id text,
  essence_balance bigint
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_definition public.meta_unlock_definitions%rowtype;
  v_wallet public.meta_wallets%rowtype;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to purchase an unlock.';
  end if;

  select * into v_definition
  from public.meta_unlock_definitions
  where id = p_unlock_id;
  if not found then
    raise exception 'Unknown meta unlock: %', p_unlock_id;
  end if;
  if v_definition.is_starter then
    raise exception 'Starter unlocks cannot be purchased.';
  end if;
  if v_definition.requires_unlock_id is not null and not exists (
    select 1
    from public.meta_unlocks as unlocks
    where unlocks.profile_id = v_profile_id
      and unlocks.unlock_id = v_definition.requires_unlock_id
  ) then
    raise exception 'Unlock % requires %.', p_unlock_id, v_definition.requires_unlock_id;
  end if;

  -- Reject purchases while a run is in progress.
  if exists (
    select 1
    from public.dungeon_runs as runs
    where runs.profile_id = v_profile_id
      and runs.status in ('active', 'paused')
  ) then
    raise exception 'Cannot purchase an unlock while a dungeon run is in progress.';
  end if;

  insert into public.meta_wallets (profile_id)
  values (v_profile_id)
  on conflict (profile_id) do nothing;

  select * into v_wallet
  from public.meta_wallets
  where profile_id = v_profile_id
  for update;

  if exists (
    select 1
    from public.meta_unlocks as unlocks
    where unlocks.profile_id = v_profile_id
      and unlocks.unlock_id = p_unlock_id
  ) then
    return query select p_unlock_id, v_wallet.essence_balance;
    return;
  end if;
  if v_wallet.essence_balance < v_definition.cost then
    raise exception 'Insufficient Essence for unlock %.', p_unlock_id;
  end if;

  update public.meta_wallets as wallet
  set essence_balance = wallet.essence_balance - v_definition.cost,
      essence_spent = wallet.essence_spent + v_definition.cost,
      updated_at = now()
  where wallet.profile_id = v_profile_id;
  insert into public.meta_unlocks (profile_id, unlock_id)
  values (v_profile_id, p_unlock_id);

  return query
  select p_unlock_id, wallet.essence_balance
  from public.meta_wallets as wallet
  where wallet.profile_id = v_profile_id;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- Function grants
-- ════════════════════════════════════════════════════════════════════════════
grant execute on function public.start_dungeon_run(
  text, bigint, text, text[], integer, timestamptz, text, text, text, jsonb
)
  to authenticated;
grant execute on function public.checkpoint_dungeon_run(text, integer, jsonb)
  to authenticated;
grant execute on function public.pause_dungeon_run(text)
  to authenticated;
grant execute on function public.complete_dungeon_run(text, text, timestamptz, jsonb)
  to authenticated;
grant execute on function public.forfeit_dungeon_run(text, timestamptz)
  to authenticated;
