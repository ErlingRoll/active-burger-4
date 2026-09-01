update public.meta_wallets
set rerolls_purchased = least(rerolls_purchased, 10),
    reroll_balance = least(rerolls_purchased, 10)
where rerolls_purchased > 10
   or reroll_balance <> rerolls_purchased;

create or replace function public.purchase_meta_reroll()
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

  if v_wallet.rerolls_purchased >= 10 then
    raise exception 'Maximum reroll level reached.';
  end if;

  v_cost := 500 * power(2::numeric, v_wallet.rerolls_purchased);
  if v_wallet.essence_balance < v_cost then
    raise exception 'Insufficient Essence for reroll.';
  end if;

  update public.meta_wallets as wallet
  set essence_balance = wallet.essence_balance - v_cost,
      essence_spent = wallet.essence_spent + v_cost,
      reroll_balance = wallet.rerolls_purchased + 1,
      rerolls_purchased = wallet.rerolls_purchased + 1,
      updated_at = now()
  where wallet.profile_id = v_profile_id;

  return query
  select wallet.reroll_balance, wallet.essence_balance
  from public.meta_wallets as wallet
  where wallet.profile_id = v_profile_id;
end;
$$;

drop function public.consume_meta_reroll();
