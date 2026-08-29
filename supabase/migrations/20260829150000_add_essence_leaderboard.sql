insert into public.meta_wallets (profile_id)
select id
from public.profiles
on conflict (profile_id) do nothing;

create or replace function public.get_essence_leaderboard()
returns table (
  profile_id uuid,
  display_name text,
  essence_balance bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profiles.id,
    coalesce(nullif(trim(profiles.display_name), ''), 'Anonymous player'),
    wallets.essence_balance
  from public.profiles as profiles
  join public.meta_wallets as wallets on wallets.profile_id = profiles.id
  where (select auth.uid()) is not null
  order by wallets.essence_balance desc, profiles.id asc
  limit 10;
$$;

revoke execute on function public.get_essence_leaderboard() from public;
grant execute on function public.get_essence_leaderboard() to authenticated;
