-- The Abyss pays in depth, not in Essence.
--
-- Both reward paths computed a dungeon's Essence for every completed run and
-- neither asked which mode the run was in, so an Abyss descent banked Essence
-- as though it had been a dungeon. `complete_dungeon_run` already made this
-- distinction for scrap; it now makes it for Essence too, and
-- `submit_meta_run_result` — the path a forfeited run takes on its own — looks
-- the mode up rather than assuming.
--
-- Both are rewritten whole rather than patched, because a Postgres function has
-- no smaller unit to replace.

create or replace function public.complete_dungeon_run(
  p_run_id text,
  p_outcome text,
  p_completed_at timestamptz,
  p_result_payload jsonb
)
returns table (
  run_id text,
  essence_awarded integer,
  essence_balance bigint,
  scrap_awarded integer,
  was_processed boolean
)
language plpgsql
security definer set search_path = ''
as $$
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
  v_floor_number integer;
  v_checkpoint jsonb;
  v_status text;
  v_equipment jsonb;
  v_scrap integer := 0;
  v_scrap_operation text;
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
  v_scrap_operation := 'dungeon-scrap:' || p_run_id;

  select runs.* into v_run
  from public.dungeon_runs as runs
  where runs.id = p_run_id
    and runs.profile_id = v_profile_id
  for update;

  if not found then
    raise exception 'Dungeon run not found.';
  end if;

  -- Idempotency: if already terminal, return what was awarded the first time.
  if v_run.status not in ('active', 'paused') then
    select coalesce((
      select sum((entry ->> 'quantity')::integer)
      from public.inventory_operations as ops,
        lateral jsonb_array_elements(ops.result) as entries(entry)
      where ops.profile_id = v_profile_id
        and ops.operation_id = v_scrap_operation
        and ops.status = 'completed'
    ), 0) into v_scrap;

    return query
    select
      p_run_id,
      rewards.essence_earned,
      wallets.essence_balance,
      v_scrap,
      false
    from public.meta_run_rewards as rewards
    join public.meta_wallets as wallets on wallets.profile_id = v_profile_id
    where rewards.profile_id = v_profile_id
      and rewards.run_id = p_run_id;
    return;
  end if;

  -- Keep server-side reward values in sync with submit_meta_run_result.
  v_level := greatest(1, coalesce((p_result_payload ->> 'level')::integer, 1));
  v_kill_count := greatest(0, coalesce((p_result_payload ->> 'killCount')::integer, 0));

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

  -- The Abyss is not paid in Essence. Scrap already knew this — the loadout
  -- salvage below is gated on the mode — but the run reward did not, so an
  -- Abyss descent banked a dungeon's wages on top of its own score.
  if v_run.mode_id is distinct from 'dungeon' then
    v_essence := 0;
  end if;

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
  on conflict on constraint meta_wallets_pkey do nothing;

  insert into public.meta_run_rewards (
    profile_id, run_id, pending_result_id, completed_at, essence_earned, payload
  ) values (
    v_profile_id, p_run_id, null, v_final_at, v_essence, p_result_payload
  )
  on conflict on constraint meta_run_rewards_pkey do nothing;
  v_inserted := found;

  if v_inserted then
    update public.meta_wallets as wallets
    set essence_balance = wallets.essence_balance + v_essence,
        essence_earned = wallets.essence_earned + v_essence,
        updated_at = v_final_at
    where wallets.profile_id = v_profile_id;
  else
    select rewards.essence_earned into v_essence
    from public.meta_run_rewards as rewards
    where rewards.profile_id = v_profile_id
      and rewards.run_id = p_run_id;
  end if;

  -- Scrap from the loadout the run ended with. The grant is idempotent under
  -- its own operation ID, so a retried completion cannot pay it twice.
  v_equipment := v_checkpoint -> 'gameState' -> 'player' -> 'equipment';
  if v_run.mode_id = 'dungeon' and jsonb_typeof(v_equipment) = 'object' then
    select coalesce(sum(
      case coalesce(pieces.value ->> 'rarity', 'common')
        when 'common'    then 1
        when 'uncommon'  then 2
        when 'rare'      then 4
        when 'epic'      then 7
        when 'legendary' then 12
        else 1
      end
    ), 0)::integer into v_scrap
    from jsonb_each(v_equipment) as pieces
    where jsonb_typeof(pieces.value) = 'object';

    if v_scrap > 0 then
      perform 1 from public.grant_inventory_items(
        v_scrap_operation,
        'dungeon-reward',
        p_run_id,
        jsonb_build_array(jsonb_build_object(
          'definitionId', 'scrap',
          'quantity', v_scrap,
          'metadata', jsonb_build_object('runId', p_run_id)
        ))
      );
    end if;
  end if;

  return query
  select p_run_id, v_essence, wallets.essence_balance, v_scrap, v_inserted
  from public.meta_wallets as wallets
  where wallets.profile_id = v_profile_id;
end;
$$;

grant execute on function public.complete_dungeon_run(text, text, timestamptz, jsonb)
  to authenticated;

create or replace function public.submit_meta_run_result(
  p_run_id text,
  p_pending_result_id text,
  p_completed_at timestamptz,
  p_payload jsonb
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
declare
  v_profile_id uuid := auth.uid();
  v_level integer;
  v_kill_count integer;
  v_base_essence integer;
  v_essence integer;
  v_multiplier numeric := 1;
  v_modifier_id text;
  v_mode_id text;
  v_inserted boolean;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to submit a run result.';
  end if;
  if coalesce(length(trim(p_run_id)), 0) = 0 then
    raise exception 'A non-empty run ID is required.';
  end if;

  -- Which run this was. A forfeit never reaches `complete_dungeon_run`, so this
  -- is the only place an abandoned Abyss descent is priced.
  select runs.mode_id into v_mode_id
  from public.dungeon_runs as runs
  where runs.id = p_run_id
    and runs.profile_id = v_profile_id;

  v_level := greatest(1, coalesce((p_payload ->> 'level')::integer, 1));
  v_kill_count := greatest(0, coalesce((p_payload ->> 'killCount')::integer, 0));

  -- Keep server-side reward values in sync with the content catalog.
  for v_modifier_id in
    select modifiers.value
    from (
      select distinct value
      from jsonb_array_elements_text(
        coalesce(p_payload -> 'worldModifierIds', '[]'::jsonb)
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
      when 'swarming' then 0.10
      when 'juggernauts' then 0.20
      when 'glass-world' then 0.15
      when 'shorter-minute' then 0.15
      when 'elite-invasion' then 0.20
      when 'fast-start' then 0.08
      else 0
    end;
  end loop;

  v_base_essence :=
    1 + greatest(0, v_level - 1) * 10
    + floor(v_kill_count / 10.0)::integer;
  v_essence := greatest(
    1,
    floor(
      v_base_essence
      * v_multiplier
      * case when p_payload ->> 'outcome' = 'victory' then 1.10 else 1 end
    )::integer
  );

  -- A run whose row has gone, or that predates modes, is a dungeon run.
  if coalesce(v_mode_id, 'dungeon') is distinct from 'dungeon' then
    v_essence := 0;
  end if;

  insert into public.meta_wallets (profile_id)
  values (v_profile_id)
  on conflict on constraint meta_wallets_pkey do nothing;

  insert into public.meta_run_rewards (
    profile_id, run_id, pending_result_id, completed_at, essence_earned, payload
  )
  values (
    v_profile_id, p_run_id, p_pending_result_id, p_completed_at, v_essence, p_payload
  )
  on conflict on constraint meta_run_rewards_pkey do nothing;
  v_inserted := found;

  if v_inserted then
    update public.meta_wallets as wallets
    set essence_balance = wallets.essence_balance + v_essence,
        essence_earned = wallets.essence_earned + v_essence,
        updated_at = now()
    where wallets.profile_id = v_profile_id;
  else
    select rewards.essence_earned into v_essence
    from public.meta_run_rewards as rewards
    where rewards.profile_id = v_profile_id
      and rewards.run_id = p_run_id;
  end if;

  return query
  select p_run_id, v_essence, wallets.essence_balance, v_inserted
  from public.meta_wallets as wallets
  where wallets.profile_id = v_profile_id;
end;
$$;

grant execute on function public.submit_meta_run_result(text, text, timestamptz, jsonb)
  to authenticated;
