-- Qualify the champions columns because RETURNS TABLE creates PL/pgSQL
-- variables with the same names, including "id".

create or replace function public.rename_champion(
  p_champion_id text,
  p_name text
)
returns table (
  id text,
  name text,
  source_run_id text,
  content_version text,
  build jsonb,
  exhaustion_until timestamptz,
  archived boolean,
  created_at timestamptz
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_champion public.champions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;
  if coalesce(length(trim(p_champion_id)), 0) = 0 or
     coalesce(length(trim(p_name)), 0) not between 1 and 32 then
    raise exception 'Champion name fields are invalid.';
  end if;

  update public.champions as champions
  set name = trim(p_name)
  where champions.id = p_champion_id
    and champions.profile_id = auth.uid()
    and not champions.archived
  returning champions.* into v_champion;
  if not found then
    raise exception 'Champion was not found or is archived.';
  end if;

  return query select
    v_champion.id, v_champion.name, v_champion.source_run_id,
    v_champion.content_version, v_champion.build,
    v_champion.exhaustion_until, v_champion.archived, v_champion.created_at;
end;
$$;

grant execute on function public.rename_champion(text, text)
  to authenticated;
