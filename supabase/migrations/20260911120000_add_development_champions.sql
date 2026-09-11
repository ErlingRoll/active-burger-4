-- Development builds may create a Champion without winning a run for it.
--
-- A Champion is otherwise only ever made by create_champion_from_run, which
-- copies the build out of a victorious run's checkpoint. Testing anything
-- that reads a roster — the Abyss picker, revival, and the Camp's labour
-- sheet — needs varied Champions faster than runs can be won, so the header's
-- development tools roll a build in the browser and hand it here.
--
-- Guarded the same way as development inventory grants: the caller's JWT
-- must carry the admin role. The build is checked for shape only; the client
-- validates it against the content registries before sending, and the game
-- validates it again when the Champion is loaded, as it does for every
-- Champion. The source run id is a "development:" prefix on the Champion id,
-- so anything that follows the id can tell the Champion apart from one that
-- was earned, and no run row exists for it.

create function public.create_development_champion(
  p_champion_id text,
  p_name text,
  p_content_version text,
  p_build jsonb,
  p_exhaustion_hours integer default 0
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
  v_profile_id uuid := auth.uid();
  v_champion public.champions%rowtype;
  v_held integer;
begin
  if v_profile_id is null then
    raise exception 'Authentication is required.';
  end if;
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'Administrator access is required to create development Champions.';
  end if;
  if coalesce(length(trim(p_champion_id)), 0) = 0 or
     coalesce(length(trim(p_name)), 0) = 0 or
     coalesce(length(trim(p_content_version)), 0) = 0 then
    raise exception 'Champion fields are required.';
  end if;
  if length(trim(p_name)) > 32 then
    raise exception 'Champion names are at most 32 characters.';
  end if;
  if p_build is null or
     jsonb_typeof(p_build) <> 'object' or
     jsonb_typeof(p_build -> 'skills') <> 'array' or
     jsonb_typeof(p_build -> 'equipment') <> 'object' or
     coalesce(length(p_build ->> 'classId'), 0) = 0 or
     coalesce(length(p_build ->> 'behaviorProfileId'), 0) = 0 then
    raise exception 'Champion build is invalid.';
  end if;
  if p_exhaustion_hours is null or p_exhaustion_hours < 0 or p_exhaustion_hours > 168 then
    raise exception 'Exhaustion must be between 0 and 168 hours.';
  end if;

  -- A retry of a call that already landed returns what it made.
  select champions.* into v_champion
  from public.champions as champions
  where champions.id = p_champion_id and champions.profile_id = v_profile_id;
  if found then
    return query select
      v_champion.id, v_champion.name, v_champion.source_run_id,
      v_champion.content_version, v_champion.build,
      v_champion.exhaustion_until, v_champion.archived, v_champion.created_at;
    return;
  end if;

  -- The roster limit holds for development Champions too; the point of them
  -- is to exercise the screens as a player would meet them. Kept in step with
  -- create_champion_from_run and CHAMPION_SLOT_LIMIT.
  select count(*) into v_held
  from public.champions as champions
  where champions.profile_id = v_profile_id
    and champions.archived = false;
  if v_held >= 10 then
    raise exception 'Champion roster is full.';
  end if;

  insert into public.champions (
    id, profile_id, name, source_run_id, content_version, build, exhaustion_until
  ) values (
    p_champion_id,
    v_profile_id,
    trim(p_name),
    'development:' || p_champion_id,
    p_content_version,
    p_build,
    case
      when p_exhaustion_hours > 0 then now() + make_interval(hours => p_exhaustion_hours)
      else null
    end
  )
  on conflict on constraint champions_pkey do nothing;

  select champions.* into v_champion
  from public.champions as champions
  where champions.id = p_champion_id and champions.profile_id = v_profile_id;
  return query select
    v_champion.id, v_champion.name, v_champion.source_run_id,
    v_champion.content_version, v_champion.build,
    v_champion.exhaustion_until, v_champion.archived, v_champion.created_at;
end;
$$;

revoke all on function public.create_development_champion(text, text, text, jsonb, integer)
  from public, anon;
grant execute on function public.create_development_champion(text, text, text, jsonb, integer)
  to authenticated;
