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
