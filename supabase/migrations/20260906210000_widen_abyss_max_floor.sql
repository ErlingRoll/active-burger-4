-- Infinite abyss uses JavaScript's largest safe integer as its unbounded floor
-- sentinel, which exceeds PostgreSQL integer's 32-bit range.
alter table public.dungeon_runs
  alter column max_floor type bigint
  using max_floor::bigint;

do $$
declare
  v_old_function_signature text :=
    'public.start_dungeon_run(text,bigint,text,text[],integer,timestamptz,text,text,text,text,jsonb,jsonb)';
  v_old_function_oid oid := to_regprocedure(v_old_function_signature);
  v_function_definition text;
begin
  if v_old_function_oid is null then
    raise exception 'The integer max_floor start_dungeon_run function does not exist.';
  end if;

  select pg_get_functiondef(v_old_function_oid)
  into v_function_definition;

  if position('p_max_floor integer' in v_function_definition) = 0 then
    raise exception 'The start_dungeon_run max_floor parameter is not an integer.';
  end if;

  execute 'drop function ' || v_old_function_signature;
  execute replace(
    v_function_definition,
    'p_max_floor integer',
    'p_max_floor bigint'
  );
end;
$$;

grant execute on function public.start_dungeon_run(
  text, bigint, text, text[], bigint, timestamptz, text, text, text, text, jsonb, jsonb
) to authenticated;
