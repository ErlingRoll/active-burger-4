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
#variable_conflict use_column
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

  v_base_essence := v_level + floor(v_kill_count / 10.0)::integer;
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
  on conflict (profile_id) do nothing;

  insert into public.meta_run_rewards (
    profile_id, run_id, pending_result_id, completed_at, essence_earned, payload
  )
  values (
    v_profile_id, p_run_id, p_pending_result_id, p_completed_at, v_essence, p_payload
  )
  on conflict (profile_id, run_id) do nothing;
  v_inserted := found;

  if v_inserted then
    update public.meta_wallets
    set essence_balance = essence_balance + v_essence,
        essence_earned = essence_earned + v_essence,
        updated_at = now()
    where profile_id = v_profile_id;
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
