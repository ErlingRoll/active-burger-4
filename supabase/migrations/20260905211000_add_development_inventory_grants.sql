-- Development builds may grant test inventory through the same idempotent
-- inventory pipeline used by server-side rewards.

create function public.grant_development_inventory_items(
  p_operation_id text,
  p_items jsonb
)
returns table (
  item_instance_id uuid,
  definition_id text,
  quantity integer,
  bound boolean,
  metadata jsonb,
  source_type text,
  source_id text,
  created_at timestamptz,
  updated_at timestamptz,
  was_processed boolean
)
language plpgsql
security definer set search_path = ''
as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Administrator access is required for development inventory grants.';
  end if;

  return query
  select *
  from public.grant_inventory_items(
    p_operation_id,
    'system',
    'development-menu',
    p_items
  );
end;
$$;

revoke all on function public.grant_development_inventory_items(text, jsonb)
  from public, anon;
grant execute on function public.grant_development_inventory_items(text, jsonb)
  to authenticated;
