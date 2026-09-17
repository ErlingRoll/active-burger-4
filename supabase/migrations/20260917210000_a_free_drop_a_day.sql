-- A free drop a day.
--
-- One ball a day on the house, at the base stake, with no modifiers. It
-- teaches the machine to a player who would never spend on it, and it is a
-- reason to visit that loses nothing when a day is missed: there is no
-- streak, only today's ball or not.
--
-- A free play is an ordinary play with nothing charged, so it is simulated,
-- settled and paid exactly like a paid one. The day is the UTC calendar day,
-- remembered on the play; a unique index makes the second ask of a day fail
-- whatever the timing.

alter table public.divine_gamba_plays
  add column free_drop_date date;

create unique index divine_gamba_plays_free_drop_idx
  on public.divine_gamba_plays (profile_id, free_drop_date)
  where free_drop_date is not null;

alter table public.divine_gamba_plays
  drop constraint divine_gamba_plays_price_per_ball_check;

alter table public.divine_gamba_plays
  add constraint divine_gamba_plays_price_per_ball_check
  check (price_per_ball >= 0);

drop function public.begin_divine_gamba_play(text, integer, integer, jsonb);

create function public.begin_divine_gamba_play(
  p_operation_id text,
  p_ball_count integer,
  p_stake integer,
  p_modifier_ids jsonb,
  p_free boolean default false
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
  v_free boolean := coalesce(p_free, false);
  v_today date := (now() at time zone 'utc')::date;
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
  if v_free and (p_ball_count <> 1 or p_stake <> 1 or jsonb_array_length(p_modifier_ids) <> 0) then
    raise exception 'The free drop is one ball at the base stake with no modifiers.';
  end if;

  v_operation := public.inventory_claim_operation(
    v_profile_id, p_operation_id, 'divine-gamba-play',
    jsonb_build_object('ballCount', p_ball_count, 'stake', p_stake, 'modifierIds', p_modifier_ids, 'free', v_free)
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
  v_cost := case when v_free then 0 else v_price::bigint * p_ball_count end;

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

  if v_free then
    -- One a day, by the UTC calendar. The unique index below is the last
    -- word if two tabs ask at once.
    if exists (
      select 1 from public.divine_gamba_plays as plays
      where plays.profile_id = v_profile_id and plays.free_drop_date = v_today
    ) then
      raise exception 'Today''s free drop is spent. Another comes at midnight UTC.';
    end if;
  else
    update public.meta_wallets as wallets
    set essence_balance = wallets.essence_balance - v_cost,
        essence_spent = wallets.essence_spent + v_cost,
        updated_at = now()
    where wallets.profile_id = v_profile_id
    returning wallets.essence_balance into v_balance;
  end if;

  -- Server-random, never derived from anything the client sent.
  v_seed := mod(
    ('x' || substr(md5(gen_random_uuid()::text), 1, 8))::bit(32)::bigint + 4294967296,
    4294967296
  );

  insert into public.divine_gamba_plays (
    profile_id, operation_id, seed, sim_version, stake, ball_count,
    stake_price, price_per_ball, modifier_ids, machine, essence_spent, free_drop_date
  ) values (
    v_profile_id, p_operation_id, v_seed, v_settings.sim_version, p_stake, p_ball_count,
    v_stake_price, case when v_free then 0 else v_price end, p_modifier_ids, v_machine, v_cost,
    case when v_free then v_today else null end
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
    'essence_balance', v_balance,
    'free', v_free
  );

  update public.inventory_operations as operations
  set status = 'completed', result = v_result, completed_at = now()
  where operations.profile_id = v_profile_id
    and operations.operation_id = p_operation_id;

  return v_result || jsonb_build_object('was_processed', true);
end;
$$;


revoke all on function public.begin_divine_gamba_play(text, integer, integer, jsonb, boolean)
  from public, anon;
grant execute on function public.begin_divine_gamba_play(text, integer, integer, jsonb, boolean)
  to authenticated;

/* Whether today's free drop is still to be had, and when the next one comes. */
create function public.divine_gamba_free_drop_state()
returns jsonb
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required.';
  end if;
  return jsonb_build_object(
    'available', not exists (
      select 1 from public.divine_gamba_plays as plays
      where plays.profile_id = v_profile_id and plays.free_drop_date = v_today
    ),
    'resets_at', ((v_today + 1)::timestamp at time zone 'utc'),
    'server_time', now()
  );
end;
$$;

revoke all on function public.divine_gamba_free_drop_state() from public, anon;
grant execute on function public.divine_gamba_free_drop_state() to authenticated;
