create table public.meta_wallets (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  schema_version smallint not null default 1,
  essence_balance bigint not null default 0 check (essence_balance >= 0),
  essence_earned bigint not null default 0 check (essence_earned >= 0),
  essence_spent bigint not null default 0 check (essence_spent >= 0),
  updated_at timestamptz not null default now()
);

create table public.meta_unlock_definitions (
  id text primary key,
  category text not null,
  cost integer not null check (cost >= 0),
  requires_unlock_id text references public.meta_unlock_definitions (id),
  is_starter boolean not null default false,
  payload jsonb not null default '{}'::jsonb
);

create table public.meta_unlocks (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  unlock_id text not null references public.meta_unlock_definitions (id),
  granted_at timestamptz not null default now(),
  source_run_id text,
  primary key (profile_id, unlock_id)
);

create table public.meta_run_rewards (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  run_id text not null,
  pending_result_id text,
  completed_at timestamptz not null,
  essence_earned integer not null check (essence_earned >= 0),
  payload jsonb not null,
  primary key (profile_id, run_id)
);

alter table public.meta_wallets enable row level security;
alter table public.meta_unlock_definitions enable row level security;
alter table public.meta_unlocks enable row level security;
alter table public.meta_run_rewards enable row level security;

create policy "Meta wallets are readable by their owner"
on public.meta_wallets for select to authenticated
using ((select auth.uid()) = profile_id);

create policy "Meta unlock definitions are publicly readable"
on public.meta_unlock_definitions for select
using (true);

create policy "Meta unlocks are readable by their owner"
on public.meta_unlocks for select to authenticated
using ((select auth.uid()) = profile_id);

create policy "Meta rewards are readable by their owner"
on public.meta_run_rewards for select to authenticated
using ((select auth.uid()) = profile_id);

grant select on public.meta_wallets, public.meta_unlock_definitions,
  public.meta_unlocks, public.meta_run_rewards to anon, authenticated;

insert into public.meta_unlock_definitions (
  id, category, cost, requires_unlock_id, is_starter, payload
) values
  (
    'default-dungeon-15-minute',
    'dungeon-length',
    100,
    null,
    false,
    '{"contractId":"default-dungeon-15-minute"}'::jsonb
  ),
  (
    'default-dungeon-20-minute',
    'dungeon-length',
    300,
    'default-dungeon-15-minute',
    false,
    '{"contractId":"default-dungeon-20-minute"}'::jsonb
  );

create function public.create_meta_wallet_for_profile()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.meta_wallets (profile_id)
  values (new.id)
  on conflict (profile_id) do nothing;
  return new;
end;
$$;

create trigger on_profile_created_create_meta_wallet
  after insert on public.profiles
  for each row execute procedure public.create_meta_wallet_for_profile();

create function public.submit_meta_run_result(
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
  v_victory_bonus integer;
  v_essence integer;
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
  v_victory_bonus := case when p_payload ->> 'outcome' = 'victory' then 20 else 0 end;
  v_essence := greatest(1, v_level + floor(v_kill_count / 10.0)::integer + v_victory_bonus);

  insert into public.meta_wallets (profile_id)
  values (v_profile_id)
  on conflict (profile_id) do nothing;

  insert into public.meta_run_rewards (
    profile_id, run_id, pending_result_id, completed_at, essence_earned, payload
  ) values (
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
    select essence_earned into v_essence
    from public.meta_run_rewards
    where profile_id = v_profile_id and run_id = p_run_id;
  end if;

  return query
  select p_run_id, v_essence, wallet.essence_balance, v_inserted
  from public.meta_wallets as wallet
  where wallet.profile_id = v_profile_id;
end;
$$;

create function public.purchase_meta_unlock(p_unlock_id text)
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
    select 1 from public.meta_unlocks
    where profile_id = v_profile_id and unlock_id = v_definition.requires_unlock_id
  ) then
    raise exception 'Unlock % requires %.', p_unlock_id, v_definition.requires_unlock_id;
  end if;

  insert into public.meta_wallets (profile_id)
  values (v_profile_id)
  on conflict (profile_id) do nothing;

  select * into v_wallet
  from public.meta_wallets
  where profile_id = v_profile_id
  for update;

  if exists (
    select 1 from public.meta_unlocks
    where profile_id = v_profile_id and unlock_id = p_unlock_id
  ) then
    return query select p_unlock_id, v_wallet.essence_balance;
    return;
  end if;
  if v_wallet.essence_balance < v_definition.cost then
    raise exception 'Insufficient Essence for unlock %.', p_unlock_id;
  end if;

  update public.meta_wallets
  set essence_balance = essence_balance - v_definition.cost,
      essence_spent = essence_spent + v_definition.cost,
      updated_at = now()
  where profile_id = v_profile_id;
  insert into public.meta_unlocks (profile_id, unlock_id)
  values (v_profile_id, p_unlock_id);

  return query
  select p_unlock_id, wallet.essence_balance
  from public.meta_wallets as wallet
  where wallet.profile_id = v_profile_id;
end;
$$;

grant execute on function public.submit_meta_run_result(text, text, timestamptz, jsonb)
  to authenticated;
grant execute on function public.purchase_meta_unlock(text)
  to authenticated;