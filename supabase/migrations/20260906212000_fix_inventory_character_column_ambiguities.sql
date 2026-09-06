-- Qualify relation columns that overlap RETURNS TABLE output variables.

create or replace function public.save_character_revision(
  p_character_id text,
  p_revision_id text,
  p_name text,
  p_content_version text,
  p_build jsonb
)
returns table (
  id text,
  character_id text,
  revision_number integer,
  parent_revision_id text,
  content_version text,
  build jsonb,
  created_at timestamptz
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_character public.characters%rowtype;
  v_previous public.character_revisions%rowtype;
  v_revision public.character_revisions%rowtype;
begin
  if v_profile_id is null then raise exception 'Authentication is required.'; end if;
  if coalesce(length(trim(p_character_id)), 0) = 0 or
     coalesce(length(trim(p_revision_id)), 0) = 0 or
     coalesce(length(trim(p_name)), 0) = 0 or
     coalesce(length(trim(p_content_version)), 0) = 0 then
    raise exception 'Character revision fields are required.';
  end if;
  if jsonb_typeof(p_build) <> 'object' or
     p_build ->> 'schemaVersion' <> '1' or
     jsonb_typeof(p_build -> 'skills') <> 'array' or
     jsonb_typeof(p_build -> 'selectedUpgradeIds') <> 'array' or
     jsonb_typeof(p_build -> 'equipment') <> 'object' then
    raise exception 'Character build has an invalid shape.';
  end if;

  select characters.* into v_character
  from public.characters as characters
  where characters.id = p_character_id
    and characters.profile_id = v_profile_id
  for update;
  if not found then
    insert into public.characters as characters (id, profile_id, name)
    values (p_character_id, v_profile_id, p_name)
    returning characters.* into v_character;
  else
    if v_character.archived then raise exception 'Archived characters cannot be edited.'; end if;
    update public.characters as characters
    set name = p_name,
        updated_at = now()
    where characters.id = p_character_id;
  end if;

  select revisions.* into v_previous
  from public.character_revisions as revisions
  where revisions.character_id = p_character_id
  order by revisions.revision_number desc
  limit 1
  for update;

  insert into public.character_revisions as revisions (
    id, character_id, profile_id, revision_number, parent_revision_id,
    content_version, build
  ) values (
    p_revision_id, p_character_id, v_profile_id,
    coalesce(v_previous.revision_number, 0) + 1,
    v_previous.id, p_content_version, p_build
  )
  returning revisions.* into v_revision;

  update public.characters as characters
  set current_revision_id = v_revision.id,
      updated_at = now()
  where characters.id = p_character_id;

  return query select
    v_revision.id, v_revision.character_id, v_revision.revision_number,
    v_revision.parent_revision_id, v_revision.content_version,
    v_revision.build, v_revision.created_at;
end;
$$;

grant execute on function public.save_character_revision(text, text, text, text, jsonb)
  to authenticated;

create or replace function public.release_inventory_reservation(
  p_operation_id text,
  p_reservation_id uuid
)
returns table (
  reservation_id uuid,
  quantity_released integer,
  was_processed boolean
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_operation public.inventory_operations%rowtype;
  v_reservation public.inventory_reservations%rowtype;
  v_line record;
  v_result jsonb;
  v_quantity integer := 0;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required to release an inventory reservation.';
  end if;
  if coalesce(length(trim(p_operation_id)), 0) = 0 then
    raise exception 'A non-empty inventory operation ID is required.';
  end if;

  v_operation := public.inventory_claim_operation(
    v_profile_id, p_operation_id, 'release',
    jsonb_build_object('reservationId', p_reservation_id)
  );
  if v_operation.status = 'completed' then
    return query
    select
      (v_operation.result -> 0 ->> 'reservation_id')::uuid,
      (v_operation.result -> 0 ->> 'quantity_released')::integer,
      false;
    return;
  end if;

  select reservations.* into v_reservation
  from public.inventory_reservations as reservations
  where reservations.id = p_reservation_id
    and reservations.profile_id = v_profile_id
  for update;
  if not found then
    raise exception 'Unknown inventory reservation.';
  end if;
  if v_reservation.status = 'consumed' then
    raise exception 'Consumed inventory reservations cannot be released.';
  end if;
  if v_reservation.status = 'released' then
    v_result := jsonb_build_array(jsonb_build_object(
      'reservation_id', p_reservation_id,
      'quantity_released', 0
    ));
  else
    for v_line in
      select reservation_lines.item_instance_id, reservation_lines.quantity
      from public.inventory_reservation_lines as reservation_lines
      where reservation_lines.reservation_id = p_reservation_id
      order by reservation_lines.item_instance_id
    loop
      update public.inventory_item_instances as instances
      set quantity = instances.quantity + v_line.quantity,
          updated_at = now()
      where instances.id = v_line.item_instance_id
        and instances.profile_id = v_profile_id;
      if not found then
        raise exception 'Reserved inventory item no longer exists.';
      end if;
      v_quantity := v_quantity + v_line.quantity;
    end loop;
    update public.inventory_reservations as reservations
    set status = 'released',
        released_at = now()
    where reservations.id = p_reservation_id;
    v_result := jsonb_build_array(jsonb_build_object(
      'reservation_id', p_reservation_id,
      'quantity_released', v_quantity
    ));
  end if;

  update public.inventory_operations as operations
  set status = 'completed',
      result = v_result,
      completed_at = now()
  where operations.profile_id = v_profile_id
    and operations.operation_id = p_operation_id;

  return query
  select
    (v_result -> 0 ->> 'reservation_id')::uuid,
    (v_result -> 0 ->> 'quantity_released')::integer,
    true;
end;
$$;

grant execute on function public.release_inventory_reservation(text, uuid)
  to authenticated;

create or replace function public.open_loot_box(
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

  select openings.* into v_existing
  from public.loot_box_openings as openings
  where openings.profile_id = v_profile_id
    and openings.operation_id = p_operation_id
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

  select instances.* into v_box
  from public.inventory_item_instances as instances
  where instances.id = p_box_instance_id
    and instances.profile_id = v_profile_id
    and instances.quantity > 0
  for update;
  if not found then
    raise exception 'Loot box is not owned or is already empty.';
  end if;

  select definitions.* into v_definition
  from public.inventory_item_definitions as definitions
  where definitions.id = v_box.definition_id
    and definitions.category = 'loot-box'
    and definitions.active;
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

  if v_box_rarity = 'common' then
    if v_roll < 550 then
      v_result_definition_id := 'river-minnow';
    elsif v_roll < 750 then
      v_result_definition_id := 'revival-koi';
    elsif v_roll < 900 then
      v_result_definition_id := 'river-worm';
    elsif v_roll < 950 then
      v_result_definition_id := 'glow-grub';
    else
      v_result_definition_id := 'starter-fishing-rod';
    end if;
  elsif v_box_rarity = 'uncommon' then
    if v_roll < 400 then
      v_result_definition_id := 'river-minnow';
    elsif v_roll < 650 then
      v_result_definition_id := 'revival-koi';
    elsif v_roll < 850 then
      v_result_definition_id := 'river-worm';
    elsif v_roll < 950 then
      v_result_definition_id := 'glow-grub';
    else
      v_result_definition_id := 'starter-fishing-rod';
    end if;
  elsif v_box_rarity = 'rare' then
    if v_roll < 250 then
      v_result_definition_id := 'river-minnow';
    elsif v_roll < 500 then
      v_result_definition_id := 'revival-koi';
    elsif v_roll < 750 then
      v_result_definition_id := 'river-worm';
    elsif v_roll < 900 then
      v_result_definition_id := 'glow-grub';
    elsif v_roll < 950 then
      v_result_definition_id := 'moonwater-lure';
    else
      v_result_definition_id := 'starter-fishing-rod';
    end if;
  elsif v_box_rarity = 'epic' then
    if v_roll < 200 then
      v_result_definition_id := 'river-minnow';
    elsif v_roll < 400 then
      v_result_definition_id := 'revival-koi';
    elsif v_roll < 650 then
      v_result_definition_id := 'river-worm';
    elsif v_roll < 850 then
      v_result_definition_id := 'glow-grub';
    elsif v_roll < 950 then
      v_result_definition_id := 'moonwater-lure';
    else
      v_result_definition_id := 'starter-fishing-rod';
    end if;
  else
    if v_roll < 100 then
      v_result_definition_id := 'river-minnow';
    elsif v_roll < 250 then
      v_result_definition_id := 'revival-koi';
    elsif v_roll < 450 then
      v_result_definition_id := 'river-worm';
    elsif v_roll < 700 then
      v_result_definition_id := 'glow-grub';
    elsif v_roll < 900 then
      v_result_definition_id := 'moonwater-lure';
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
  elsif v_result_definition_id in ('river-worm', 'glow-grub', 'moonwater-lure') then
    v_result_metadata := jsonb_build_object(
      'source', 'loot-box',
      'boxRarity', v_box_rarity
    );
  else
    v_result_metadata := jsonb_build_object(
      'rarity', v_box_rarity,
      'modifierIds', '[]'::jsonb
    );
  end if;

  update public.inventory_item_instances as instances
  set quantity = instances.quantity - 1,
      updated_at = now()
  where instances.id = p_box_instance_id;

  select granted.* into v_granted
  from public.grant_inventory_items(
    'loot-box:' || p_operation_id,
    'loot-box',
    p_operation_id,
    jsonb_build_array(jsonb_build_object(
      'definitionId', v_result_definition_id,
      'quantity', v_result_quantity,
      'metadata', v_result_metadata
    ))
  ) as granted
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

create or replace function public.request_nickname_change(requested_nickname text)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in before requesting a nickname change.';
  end if;

  if request_nickname_change.requested_nickname
       !~ '^[A-Za-z0-9][A-Za-z0-9 _-]{1,22}[A-Za-z0-9]$' then
    raise exception 'Nickname must use 3-24 letters, numbers, spaces, hyphens, or underscores.';
  end if;

  delete from public.nickname_change_requests as requests
  where requests.user_id = auth.uid()
    and requests.status = 'pending';

  insert into public.nickname_change_requests (user_id, requested_nickname)
  values (auth.uid(), request_nickname_change.requested_nickname);
end;
$$;

grant execute on function public.request_nickname_change(text)
  to authenticated;
