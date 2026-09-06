-- Qualify the reservation status check so it cannot resolve to the
-- start_dungeon_run RETURNS TABLE variable named "status".

do $$
declare
  v_function_oid oid := to_regprocedure(
    'public.start_dungeon_run(text,bigint,text,text[],integer,timestamptz,text,text,text,text,jsonb,jsonb)'
  );
  v_function_definition text;
begin
  if v_function_oid is null then
    raise exception 'The start_dungeon_run function does not exist.';
  end if;

  select pg_get_functiondef(v_function_oid)
  into v_function_definition;

  if position('and status = ''active'';' in v_function_definition) > 0 then
    v_function_definition := replace(
      v_function_definition,
      'update public.inventory_reservations',
      'update public.inventory_reservations as reservation'
    );
    v_function_definition := replace(
      v_function_definition,
      'and status = ''active'';',
      'and reservation.status = ''active'';'
    );
    execute v_function_definition;
  elsif position('and reservation.status = ''active'';' in v_function_definition) = 0 then
    raise exception 'The start_dungeon_run reservation status check was not found.';
  end if;
end;
$$;
