-- Remove reliance on PL/pgSQL's variable-conflict override by qualifying
-- relation columns and naming constraints whose columns overlap output names.

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
  v_inserted boolean;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to submit a run result.';
  end if;
  if coalesce(length(trim(p_run_id)), 0) = 0 then
    raise exception 'A non-empty run ID is required.';
  end if;

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

  select runs.* into v_run
  from public.dungeon_runs as runs
  where runs.id = p_run_id
    and runs.profile_id = v_profile_id
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
      wallets.essence_balance,
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

  return query
  select p_run_id, v_essence, wallets.essence_balance, v_inserted
  from public.meta_wallets as wallets
  where wallets.profile_id = v_profile_id;
end;
$$;

grant execute on function public.complete_dungeon_run(text, text, timestamptz, jsonb)
  to authenticated;

create or replace function public.forfeit_dungeon_run(
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

  select runs.* into v_run
  from public.dungeon_runs as runs
  where runs.id = p_run_id
    and runs.profile_id = v_profile_id
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
      wallets.essence_balance,
      false
    from public.meta_run_rewards as rewards
    join public.meta_wallets as wallets on wallets.profile_id = v_profile_id
    where rewards.profile_id = v_profile_id
      and rewards.run_id = p_run_id;
    return;
  end if;

  select snapshots.payload into v_latest_payload
  from public.dungeon_run_snapshots as snapshots
  where snapshots.run_id = p_run_id
  order by snapshots.id desc
  limit 1;

  v_latest_payload := coalesce(v_latest_payload, '{}'::jsonb);

  -- Keep server-side reward values in sync with submit_meta_run_result.
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
  v_essence := greatest(
    1,
    floor(v_base_essence * v_multiplier)::integer
  );

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
  on conflict on constraint meta_wallets_pkey do nothing;

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

  return query
  select p_run_id, v_essence, wallets.essence_balance, v_inserted
  from public.meta_wallets as wallets
  where wallets.profile_id = v_profile_id;
end;
$$;

grant execute on function public.forfeit_dungeon_run(text, timestamptz)
  to authenticated;
