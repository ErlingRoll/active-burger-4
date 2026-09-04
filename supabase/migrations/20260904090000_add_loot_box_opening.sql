-- Server-authoritative, idempotent loot-box opening.

create table public.loot_box_openings (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  operation_id text not null,
  box_instance_id uuid not null references public.inventory_item_instances (id),
  box_rarity text not null check (
    box_rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary')
  ),
  result_item_instance_id uuid not null references public.inventory_item_instances (id),
  result_definition_id text not null references public.inventory_item_definitions (id),
  result_quantity integer not null check (result_quantity >= 1),
  result_metadata jsonb not null check (jsonb_typeof(result_metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (profile_id, operation_id)
);

create index loot_box_openings_profile_created_idx
  on public.loot_box_openings (profile_id, created_at desc);

alter table public.loot_box_openings enable row level security;

create policy "Loot-box openings are readable by their owner"
on public.loot_box_openings for select to authenticated
using ((select auth.uid()) = profile_id);

grant select on public.loot_box_openings to authenticated;

create function public.open_loot_box(
  p_operation_id text,
  p_box_instance_id uuid
)
returns table (
  box_instance_id uuid,
  box_rarity text,
  item_instance_id uuid,
  definition_id text,
  quantity integer,
  metadata jsonb,
  was_processed boolean
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_existing public.loot_box_openings%rowtype;
  v_box public.inventory_item_instances%rowtype;
  v_definition public.inventory_item_definitions%rowtype;
  v_granted record;
  v_box_rarity text;
  v_result_definition_id text;
  v_result_quantity integer := 1;
  v_result_metadata jsonb;
  v_roll integer;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to open a loot box.';
  end if;
  if coalesce(length(trim(p_operation_id)), 0) = 0 then
    raise exception 'A non-empty loot-box operation ID is required.';
  end if;

  select * into v_existing
  from public.loot_box_openings
  where profile_id = v_profile_id and operation_id = p_operation_id
  for update;
  if found then
    if v_existing.box_instance_id <> p_box_instance_id then
      raise exception 'Loot-box operation ID was already used for another box.';
    end if;
    return query select
      v_existing.box_instance_id,
      v_existing.box_rarity,
      v_existing.result_item_instance_id,
      v_existing.result_definition_id,
      v_existing.result_quantity,
      v_existing.result_metadata,
      false;
    return;
  end if;

  select * into v_box
  from public.inventory_item_instances
  where id = p_box_instance_id
    and profile_id = v_profile_id
    and quantity > 0
  for update;
  if not found then
    raise exception 'Loot box is not owned or is already empty.';
  end if;

  select * into v_definition
  from public.inventory_item_definitions
  where id = v_box.definition_id
    and category = 'loot-box'
    and active;
  if not found then
    raise exception 'The selected item is not an active loot box.';
  end if;
  v_box_rarity := replace(v_box.definition_id, 'loot-box-', '');
  if v_box_rarity not in ('common', 'uncommon', 'rare', 'epic', 'legendary') then
    raise exception 'Loot box has an invalid rarity.';
  end if;

  v_roll := mod(hashtextextended(p_operation_id, 0), 1000)::integer;
  if v_roll < 0 then
    v_roll := v_roll + 1000;
  end if;

  -- Each rarity has its own explicit pool. The first release returns fish or
  -- a rod; artifacts remain intentionally excluded until equipment is ready.
  if v_box_rarity = 'common' then
    if v_roll < 600 then
      v_result_definition_id := 'river-minnow';
    elsif v_roll < 850 then
      v_result_definition_id := 'revival-koi';
    else
      v_result_definition_id := 'starter-fishing-rod';
    end if;
  elsif v_box_rarity = 'uncommon' then
    if v_roll < 500 then
      v_result_definition_id := 'river-minnow';
    elsif v_roll < 800 then
      v_result_definition_id := 'revival-koi';
    else
      v_result_definition_id := 'starter-fishing-rod';
    end if;
  elsif v_box_rarity = 'rare' then
    if v_roll < 350 then
      v_result_definition_id := 'river-minnow';
    elsif v_roll < 700 then
      v_result_definition_id := 'revival-koi';
    else
      v_result_definition_id := 'starter-fishing-rod';
    end if;
  elsif v_box_rarity = 'epic' then
    if v_roll < 300 then
      v_result_definition_id := 'river-minnow';
    elsif v_roll < 650 then
      v_result_definition_id := 'revival-koi';
    else
      v_result_definition_id := 'starter-fishing-rod';
    end if;
  else
    if v_roll < 200 then
      v_result_definition_id := 'river-minnow';
    elsif v_roll < 550 then
      v_result_definition_id := 'revival-koi';
    else
      v_result_definition_id := 'starter-fishing-rod';
    end if;
  end if;

  if v_result_definition_id in ('river-minnow', 'revival-koi') then
    v_result_metadata := jsonb_build_object(
      'speciesId', v_result_definition_id,
      'rarity', v_box_rarity,
      'sizePercentile', 0.25 + (v_roll::numeric / 1000) * 0.7
    );
  else
    v_result_metadata := jsonb_build_object(
      'rarity', v_box_rarity,
      'modifierIds', '[]'::jsonb
    );
  end if;

  update public.inventory_item_instances
  set quantity = quantity - 1, updated_at = now()
  where id = p_box_instance_id;

  select * into v_granted
  from public.grant_inventory_items(
    'loot-box:' || p_operation_id,
    'loot-box',
    p_operation_id,
    jsonb_build_array(jsonb_build_object(
      'definitionId', v_result_definition_id,
      'quantity', v_result_quantity,
      'metadata', v_result_metadata
    ))
  )
  limit 1;

  insert into public.loot_box_openings (
    profile_id, operation_id, box_instance_id, box_rarity,
    result_item_instance_id, result_definition_id, result_quantity, result_metadata
  ) values (
    v_profile_id, p_operation_id, p_box_instance_id, v_box_rarity,
    v_granted.item_instance_id, v_result_definition_id, v_result_quantity, v_result_metadata
  );

  return query select
    p_box_instance_id,
    v_box_rarity,
    v_granted.item_instance_id,
    v_result_definition_id,
    v_result_quantity,
    v_result_metadata,
    true;
end;
$$;

grant execute on function public.open_loot_box(text, uuid)
  to authenticated;
