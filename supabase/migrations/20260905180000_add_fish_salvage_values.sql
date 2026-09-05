-- Make fish salvage rewards server-authoritative while preserving the
-- idempotent inventory salvage operation used by other item categories.

update public.inventory_item_definitions as definitions
set payload = definitions.payload || jsonb_build_object('rarity', rarity.rarity),
    salvage_essence = case rarity.rarity
      when 'common' then 2
      when 'uncommon' then 5
      when 'rare' then 10
      when 'epic' then 20
      when 'legendary' then 40
    end
from (values
  ('river-minnow', 'common'),
  ('reed-darter', 'common'),
  ('glassfin-trout', 'common'),
  ('silver-perch', 'uncommon'),
  ('lantern-pike', 'uncommon'),
  ('moon-carp', 'rare'),
  ('tideback-catfish', 'rare'),
  ('revival-koi', 'epic'),
  ('comet-eel', 'epic'),
  ('star-koi', 'legendary')
) as rarity(definition_id, rarity)
where definitions.id = rarity.definition_id
  and definitions.category = 'fish';

create or replace function public.salvage_inventory_item(
  p_operation_id text,
  p_item_instance_id uuid,
  p_quantity integer
)
returns table (
  item_instance_id uuid,
  essence_awarded bigint,
  was_processed boolean
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_operation public.inventory_operations%rowtype;
  v_instance public.inventory_item_instances%rowtype;
  v_definition public.inventory_item_definitions%rowtype;
  v_quantity integer;
  v_essence bigint;
  v_result jsonb;
  v_size numeric;
  v_base_value bigint;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to salvage inventory items.';
  end if;
  if coalesce(length(trim(p_operation_id)), 0) = 0 then
    raise exception 'A non-empty inventory operation ID is required.';
  end if;

  v_operation := public.inventory_claim_operation(
    v_profile_id, p_operation_id, 'salvage',
    jsonb_build_object('itemInstanceId', p_item_instance_id, 'quantity', p_quantity)
  );
  if v_operation.status = 'completed' then
    return query
    select
      (v_operation.result -> 0 ->> 'item_instance_id')::uuid,
      (v_operation.result -> 0 ->> 'essence_awarded')::bigint,
      false;
    return;
  end if;

  select * into v_instance
  from public.inventory_item_instances
  where id = p_item_instance_id and profile_id = v_profile_id
  for update;
  if not found or v_instance.quantity < 1 then
    raise exception 'Unknown or unavailable inventory item.';
  end if;
  v_quantity := coalesce(p_quantity, v_instance.quantity);
  if v_quantity < 1 or v_quantity > v_instance.quantity then
    raise exception 'Invalid inventory salvage quantity.';
  end if;

  select * into v_definition
  from public.inventory_item_definitions
  where id = v_instance.definition_id and active;
  if not found then
    raise exception 'Unknown inventory item definition.';
  end if;

  if v_definition.category = 'fish' then
    if jsonb_typeof(v_instance.metadata -> 'sizePercentile') <> 'number' then
      raise exception 'Fish metadata is missing a normalized size.';
    end if;
    v_size := (v_instance.metadata ->> 'sizePercentile')::numeric;
    if v_size < 0 or v_size > 1 then
      raise exception 'Fish metadata contains an invalid normalized size.';
    end if;
    v_base_value := case v_definition.payload ->> 'rarity'
      when 'common' then 2
      when 'uncommon' then 5
      when 'rare' then 10
      when 'epic' then 20
      when 'legendary' then 40
      else null
    end;
    if v_base_value is null then
      raise exception 'Fish definition has an unknown rarity.';
    end if;
    v_essence := floor(v_base_value * (0.5 + v_size))::bigint * v_quantity;
  else
    v_essence := v_definition.salvage_essence * v_quantity;
  end if;

  update public.inventory_item_instances
  set quantity = quantity - v_quantity, updated_at = now()
  where id = p_item_instance_id;

  insert into public.meta_wallets (profile_id)
  values (v_profile_id)
  on conflict (profile_id) do nothing;
  update public.meta_wallets
  set essence_balance = essence_balance + v_essence,
      essence_earned = essence_earned + v_essence,
      updated_at = now()
  where profile_id = v_profile_id;

  v_result := jsonb_build_array(jsonb_build_object(
    'item_instance_id', p_item_instance_id,
    'essence_awarded', v_essence
  ));
  update public.inventory_operations
  set status = 'completed', result = v_result, completed_at = now()
  where profile_id = v_profile_id and operation_id = p_operation_id;

  return query
  select p_item_instance_id, v_essence, true;
end;
$$;

grant execute on function public.salvage_inventory_item(text, uuid, integer)
  to authenticated;
