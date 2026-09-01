alter table public.meta_wallets
  add column reroll_balance bigint not null default 0 check (reroll_balance >= 0),
  add column rerolls_purchased bigint not null default 0 check (rerolls_purchased >= 0);

create function public.purchase_meta_reroll()
returns table (
  reroll_balance bigint,
  essence_balance bigint
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_wallet public.meta_wallets%rowtype;
  v_cost bigint;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to purchase a reroll.';
  end if;

  insert into public.meta_wallets (profile_id)
  values (v_profile_id)
  on conflict (profile_id) do nothing;

  select * into v_wallet
  from public.meta_wallets
  where profile_id = v_profile_id
  for update;

  v_cost := ceil(500 * power(2::numeric, v_wallet.rerolls_purchased));
  if v_wallet.essence_balance < v_cost then
    raise exception 'Insufficient Essence for reroll.';
  end if;

  update public.meta_wallets as wallet
  set essence_balance = wallet.essence_balance - v_cost,
      essence_spent = wallet.essence_spent + v_cost,
      reroll_balance = wallet.reroll_balance + 1,
      rerolls_purchased = wallet.rerolls_purchased + 1,
      updated_at = now()
  where wallet.profile_id = v_profile_id;

  return query
  select wallet.reroll_balance, wallet.essence_balance
  from public.meta_wallets as wallet
  where wallet.profile_id = v_profile_id;
end;
$$;

create function public.consume_meta_reroll()
returns table (
  reroll_balance bigint
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_wallet public.meta_wallets%rowtype;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to use a reroll.';
  end if;

  insert into public.meta_wallets (profile_id)
  values (v_profile_id)
  on conflict (profile_id) do nothing;

  select * into v_wallet
  from public.meta_wallets
  where profile_id = v_profile_id
  for update;

  if v_wallet.reroll_balance < 1 then
    raise exception 'No rerolls are available.';
  end if;

  update public.meta_wallets as wallet
  set reroll_balance = wallet.reroll_balance - 1,
      updated_at = now()
  where wallet.profile_id = v_profile_id;

  return query
  select wallet.reroll_balance
  from public.meta_wallets as wallet
  where wallet.profile_id = v_profile_id;
end;
$$;

grant execute on function public.purchase_meta_reroll() to authenticated;
grant execute on function public.consume_meta_reroll() to authenticated;
