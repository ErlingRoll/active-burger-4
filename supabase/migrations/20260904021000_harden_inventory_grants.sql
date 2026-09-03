-- Generic grants are database-internal. Player clients must use a
-- source-specific reward RPC so they cannot grant arbitrary items.

revoke all on function public.grant_inventory_items(text, text, text, jsonb)
  from public, anon, authenticated;
