-- Editable character recipes, immutable revisions, and completed-run
-- Champion snapshots. Runtime state is intentionally not stored here.

create table public.characters (
  id text primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 32),
  current_revision_id text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.character_revisions (
  id text primary key,
  character_id text not null references public.characters (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  revision_number integer not null check (revision_number >= 1),
  parent_revision_id text references public.character_revisions (id),
  content_version text not null,
  build jsonb not null check (jsonb_typeof(build) = 'object'),
  created_at timestamptz not null default now(),
  unique (character_id, revision_number)
);

alter table public.characters
  add constraint characters_current_revision_fk
  foreign key (current_revision_id) references public.character_revisions (id);

create table public.champions (
  id text primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 32),
  source_run_id text not null,
  content_version text not null,
  build jsonb not null check (jsonb_typeof(build) = 'object'),
  exhaustion_until timestamptz,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index character_revisions_character_idx
  on public.character_revisions (character_id, revision_number desc);
create index champions_profile_idx
  on public.champions (profile_id, created_at desc);

alter table public.characters enable row level security;
alter table public.character_revisions enable row level security;
alter table public.champions enable row level security;

create policy "Characters are readable by their owner"
on public.characters for select to authenticated
using ((select auth.uid()) = profile_id);
create policy "Character revisions are readable by their owner"
on public.character_revisions for select to authenticated
using ((select auth.uid()) = profile_id);
create policy "Champions are readable by their owner"
on public.champions for select to authenticated
using ((select auth.uid()) = profile_id);

grant select on public.characters, public.character_revisions, public.champions
  to authenticated;

create function public.save_character_revision(
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

  select * into v_character
  from public.characters
  where id = p_character_id and profile_id = v_profile_id
  for update;
  if not found then
    insert into public.characters (id, profile_id, name)
    values (p_character_id, v_profile_id, p_name)
    returning * into v_character;
  else
    if v_character.archived then raise exception 'Archived characters cannot be edited.'; end if;
    update public.characters set name = p_name, updated_at = now()
    where id = p_character_id;
  end if;

  select * into v_previous
  from public.character_revisions
  where character_id = p_character_id
  order by revision_number desc
  limit 1
  for update;

  insert into public.character_revisions (
    id, character_id, profile_id, revision_number, parent_revision_id,
    content_version, build
  ) values (
    p_revision_id, p_character_id, v_profile_id,
    coalesce(v_previous.revision_number, 0) + 1,
    v_previous.id, p_content_version, p_build
  )
  returning * into v_revision;

  update public.characters
  set current_revision_id = v_revision.id, updated_at = now()
  where id = p_character_id;

  return query select
    v_revision.id, v_revision.character_id, v_revision.revision_number,
    v_revision.parent_revision_id, v_revision.content_version,
    v_revision.build, v_revision.created_at;
end;
$$;

create function public.create_champion_from_run(
  p_champion_id text,
  p_source_run_id text,
  p_name text,
  p_content_version text
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
  v_run public.dungeon_runs%rowtype;
  v_snapshot public.dungeon_run_snapshots%rowtype;
  v_build jsonb;
  v_champion public.champions%rowtype;
begin
  if v_profile_id is null then raise exception 'Authentication is required.'; end if;
  if coalesce(length(trim(p_champion_id)), 0) = 0 or
     coalesce(length(trim(p_source_run_id)), 0) = 0 or
     coalesce(length(trim(p_name)), 0) = 0 or
     coalesce(length(trim(p_content_version)), 0) = 0 then
    raise exception 'Champion fields are required.';
  end if;

  select * into v_run
  from public.dungeon_runs
  where id = p_source_run_id and profile_id = v_profile_id;
  if not found or v_run.status <> 'victory' then
    raise exception 'Champions can only be created from a victorious owned run.';
  end if;
  select * into v_snapshot
  from public.dungeon_run_snapshots
  where run_id = p_source_run_id
  order by id desc
  limit 1;
  if not found then raise exception 'The completed run has no checkpoint.'; end if;

  v_build := jsonb_build_object(
    'schemaVersion', 1,
    'classId', v_snapshot.payload -> 'gameState' -> 'player' ->> 'characterClassId',
    'skills', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'skillId', skill ->> 'skillId',
        'level', greatest(1, coalesce((skill ->> 'level')::integer, 1))
      )), '[]'::jsonb)
      from jsonb_array_elements(
        coalesce(v_snapshot.payload -> 'gameState' -> 'player' -> 'skills', '[]'::jsonb)
      ) as skills(skill)
    ),
    'selectedUpgradeIds', coalesce(
      v_snapshot.payload -> 'gameState' -> 'run' -> 'selectedUpgradeIds',
      '[]'::jsonb
    ),
    'equipment', coalesce(
      v_snapshot.payload -> 'gameState' -> 'player' -> 'equipment',
      '{}'::jsonb
    ),
    'behaviorProfileId', coalesce(
      v_snapshot.payload -> 'gameState' -> 'player' -> 'behaviorController' ->> 'profileId',
      'balanced'
    )
  );

  insert into public.champions (
    id, profile_id, name, source_run_id, content_version, build
  ) values (
    p_champion_id, v_profile_id, p_name, p_source_run_id, p_content_version, v_build
  )
  on conflict (id) do nothing;

  select * into v_champion
  from public.champions
  where id = p_champion_id and profile_id = v_profile_id;
  return query select
    v_champion.id, v_champion.name, v_champion.source_run_id,
    v_champion.content_version, v_champion.build,
    v_champion.exhaustion_until, v_champion.archived, v_champion.created_at;
end;
$$;

create function public.archive_character(p_character_id text)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.characters
  set archived = true, updated_at = now()
  where id = p_character_id and profile_id = auth.uid();
end;
$$;

create function public.archive_champion(p_champion_id text)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.champions
  set archived = true
  where id = p_champion_id and profile_id = auth.uid();
end;
$$;

grant execute on function public.save_character_revision(text, text, text, text, jsonb)
  to authenticated;
grant execute on function public.create_champion_from_run(text, text, text, text)
  to authenticated;
grant execute on function public.archive_character(text)
  to authenticated;
grant execute on function public.archive_champion(text)
  to authenticated;
