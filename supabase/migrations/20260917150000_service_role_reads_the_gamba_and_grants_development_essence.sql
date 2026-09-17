-- Two things the Divine Gamba's first deploy taught.
--
-- New tables in this project are not exposed to the Data API roles without an
-- explicit grant, and the settlement function reads a play with the service
-- role before it settles it. Row-level security never applied to that role,
-- but table privileges do, and the read failed with "permission denied for
-- table divine_gamba_plays", leaving the play pending and the Essence spent.
-- The service role may now read every Gamba table; it still writes only
-- through `settle_divine_gamba_play`.
--
-- And a machine that takes Essence is hard to test on an account that has
-- none, so the development menu can now grant it, behind the same admin
-- role that gates development inventory grants.

grant select on
  public.divine_gamba_settings,
  public.divine_gamba_pocket_tables,
  public.divine_gamba_part_definitions,
  public.divine_gamba_parts,
  public.divine_gamba_plays,
  public.divine_gamba_play_balls
to service_role;

create function public.grant_development_essence(p_amount integer)
returns bigint
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_balance bigint;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required.';
  end if;
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Administrator access is required for development Essence grants.';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 1000000 then
    raise exception 'Grant between 1 and 1,000,000 Essence at a time.';
  end if;

  insert into public.meta_wallets (profile_id)
  values (v_profile_id)
  on conflict on constraint meta_wallets_pkey do nothing;

  update public.meta_wallets as wallets
  set essence_balance = wallets.essence_balance + p_amount,
      updated_at = now()
  where wallets.profile_id = v_profile_id
  returning wallets.essence_balance into v_balance;

  return v_balance;
end;
$$;

revoke all on function public.grant_development_essence(integer) from public, anon;
grant execute on function public.grant_development_essence(integer) to authenticated;
