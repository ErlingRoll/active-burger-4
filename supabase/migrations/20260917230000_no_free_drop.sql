-- No free drop.
--
-- The daily ball on the house is withdrawn. The machine is paid for or it is
-- not played: every play charges the wallet, and the play function no longer
-- takes a flag that could ask otherwise. The date that remembered the day's
-- free play goes with it; plays already recorded keep their zero price, so
-- the price check stays at zero or more.

drop function public.divine_gamba_free_drop_state();

drop index public.divine_gamba_plays_free_drop_idx;

alter table public.divine_gamba_plays
  drop column free_drop_date;

drop function public.begin_divine_gamba_play(text, integer, integer, jsonb, boolean);

create function public.begin_divine_gamba_play(
  p_operation_id text,
  p_ball_count integer,
  p_stake integer,
  p_modifier_ids jsonb
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_operation public.inventory_operations%rowtype;
  v_settings public.divine_gamba_settings%rowtype;
  v_owned jsonb;
  v_modifier jsonb;
  v_machine jsonb;
  v_stake_price integer;
  v_price integer;
  v_cost bigint;
  v_balance bigint;
  v_seed bigint;
  v_play public.divine_gamba_plays%rowtype;
  v_result jsonb;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to play.';
  end if;
  if coalesce(length(trim(p_operation_id)), 0) = 0 then
    raise exception 'A non-empty operation ID is required.';
  end if;
  if p_ball_count is null or p_ball_count < 1 or p_ball_count > 20 then
    raise exception 'A play holds 1 to 20 balls.';
  end if;
  if p_stake is null or p_stake < 1 then
    raise exception 'Invalid stake.';
  end if;
  if p_modifier_ids is null or jsonb_typeof(p_modifier_ids) <> 'array' then
    raise exception 'Modifiers must be a list.';
  end if;

  v_operation := public.inventory_claim_operation(
    v_profile_id, p_operation_id, 'divine-gamba-play',
    jsonb_build_object('ballCount', p_ball_count, 'stake', p_stake, 'modifierIds', p_modifier_ids)
  );
  if v_operation.status = 'completed' then
    return v_operation.result || jsonb_build_object('was_processed', false);
  end if;

  select coalesce(jsonb_agg(parts.part_id), '[]'::jsonb) into v_owned
  from public.divine_gamba_parts as parts
  where parts.profile_id = v_profile_id;

  for v_modifier in select value from jsonb_array_elements(p_modifier_ids)
  loop
    if jsonb_typeof(v_modifier) <> 'string' then
      raise exception 'Modifiers must be named by ID.';
    end if;
    if not exists (
      select 1 from public.divine_gamba_part_definitions as definitions
      where definitions.id = (v_modifier #>> '{}')
        and definitions.kind = 'modifier'
        and definitions.active
    ) then
      raise exception 'Unknown modifier: %.', v_modifier #>> '{}';
    end if;
    if not v_owned @> v_modifier then
      raise exception 'You do not own that modifier.';
    end if;
  end loop;

  v_machine := public.divine_gamba_resolve_machine(v_owned, p_modifier_ids);
  if not (v_machine -> 'allowedStakes') @> to_jsonb(p_stake) then
    raise exception 'That stake is not unlocked.';
  end if;

  select * into v_settings from public.divine_gamba_settings where id = 'default';
  v_stake_price := v_settings.base_ball_price * p_stake;
  v_price := (v_stake_price * (v_machine ->> 'pricePercent')::integer) / 100;
  v_cost := v_price::bigint * p_ball_count;

  insert into public.meta_wallets (profile_id)
  values (v_profile_id)
  on conflict on constraint meta_wallets_pkey do nothing;

  select wallets.essence_balance into v_balance
  from public.meta_wallets as wallets
  where wallets.profile_id = v_profile_id
  for update;
  if v_balance < v_cost then
    raise exception 'Not enough Essence.';
  end if;

  update public.meta_wallets as wallets
  set essence_balance = wallets.essence_balance - v_cost,
      essence_spent = wallets.essence_spent + v_cost,
      updated_at = now()
  where wallets.profile_id = v_profile_id
  returning wallets.essence_balance into v_balance;

  -- Server-random, never derived from anything the client sent.
  v_seed := mod(
    ('x' || substr(md5(gen_random_uuid()::text), 1, 8))::bit(32)::bigint + 4294967296,
    4294967296
  );

  insert into public.divine_gamba_plays (
    profile_id, operation_id, seed, sim_version, stake, ball_count,
    stake_price, price_per_ball, modifier_ids, machine, essence_spent
  ) values (
    v_profile_id, p_operation_id, v_seed, v_settings.sim_version, p_stake, p_ball_count,
    v_stake_price, v_price, p_modifier_ids, v_machine, v_cost
  )
  returning * into v_play;

  v_result := jsonb_build_object(
    'play_id', v_play.id,
    'seed', v_play.seed,
    'sim_version', v_play.sim_version,
    'stake', v_play.stake,
    'ball_count', v_play.ball_count,
    'stake_price', v_play.stake_price,
    'price_per_ball', v_play.price_per_ball,
    'modifier_ids', v_play.modifier_ids,
    'machine', v_play.machine,
    'essence_spent', v_play.essence_spent,
    'essence_balance', v_balance
  );

  update public.inventory_operations as operations
  set status = 'completed', result = v_result, completed_at = now()
  where operations.profile_id = v_profile_id
    and operations.operation_id = p_operation_id;

  return v_result || jsonb_build_object('was_processed', true);
end;
$$;

revoke all on function public.begin_divine_gamba_play(text, integer, integer, jsonb)
  from public, anon;
grant execute on function public.begin_divine_gamba_play(text, integer, integer, jsonb)
  to authenticated;
