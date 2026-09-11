-- Keep the artifact loadout in start_dungeon_run, whichever way the history
-- arrived here.
--
-- Two migrations restate the whole function: 20260912150000 dedupes the
-- overloads and carries the meal-only body, and 20260912180000 carries the
-- body with the artifact hold. A database that applies them in version order
-- ends with artifacts. A database that had already applied the later one
-- when the earlier one was written (the dev branch) applies the earlier one
-- afterwards and loses them. Rather than carry the function a third time,
-- this reads the live definition and, if the artifact block is missing,
-- patches the same insertions the loadouts migration made into it. Every
-- anchor is checked, so a body this does not recognise stops the push
-- instead of half-patching it.

do $$
declare
  v_signature text :=
    'public.start_dungeon_run(text,bigint,text,text[],bigint,timestamptz,text,text,text,text,jsonb,jsonb)';
  v_oid oid := to_regprocedure(v_signature);
  v_def text;
  v_anchor text;
  v_replacement text;
  v_patches text[][];
  v_index integer;
begin
  if v_oid is null then
    raise exception 'The bigint start_dungeon_run function does not exist.';
  end if;

  select pg_get_functiondef(v_oid) into v_def;
  -- The body keeps the line endings of whichever checkout pushed it.
  v_def := replace(v_def, E'\r\n', E'\n');

  if position('resolve_run_artifacts' in v_def) > 0 then
    return;
  end if;

  v_patches := array[
    [
$a$  if jsonb_array_length(v_preparation -> 'items') > 5 then
    raise exception 'A fish meal cannot contain more than five items.';
  end if;$a$,
$b$  if jsonb_array_length(v_preparation -> 'items') > 6 then
    raise exception 'A fish meal cannot contain more than six items.';
  end if;
  if v_preparation ? 'artifacts' and jsonb_typeof(v_preparation -> 'artifacts') <> 'array' then
    raise exception 'Preparation artifacts must be an array.';
  end if;$b$
    ],
    [
$a$    raise exception 'Cannot start a new run while another run is still active or paused.';
  end if;
$a$,
$b$    raise exception 'Cannot start a new run while another run is still active or paused.';
  end if;

  -- A hold left behind by a finished run whose Champion was never made goes
  -- back to the bag before this run reaches for anything.
  perform public.release_stale_artifact_holds(v_profile_id);

  -- Artifacts resolve first: the Kettle's implicit widens the meal, and the
  -- meal loop below reads the count it sets.
  v_artifacts := public.resolve_run_artifacts(
    v_profile_id, p_run_id, p_mode_id,
    coalesce(v_preparation -> 'artifacts', '[]'::jsonb),
    p_initial_payload
  );
  v_meal_bonus := public.artifact_meal_bonus_percent(v_artifacts);
  if jsonb_array_length(v_preparation -> 'items') > public.artifact_meal_slot_count(v_artifacts) then
    raise exception 'The meal has more fish than the run has slots for.';
  end if;
$b$
    ],
    [
$a$  v_preparation := jsonb_build_object(
    'version', 1,
    'items', v_canonical_items
  );$a$,
$b$  v_preparation := jsonb_build_object(
    'version', 1,
    'items', v_canonical_items,
    'artifacts', v_artifacts
  );$b$
    ],
    [
$a$    v_contribution := v_base_value * v_rarity_factor *
      (0.75 + v_size * 0.5) *
      (1 + v_enchantment_value / 100) /
      (v_previous_count + 1);$a$,
$b$    v_contribution := v_base_value * v_rarity_factor *
      (0.75 + v_size * 0.5) *
      (1 + v_enchantment_value / 100) *
      (1 + v_meal_bonus / 100) /
      (v_previous_count + 1);$b$
    ],
    [
$a$  v_family_totals jsonb := '{}'::jsonb;
begin$a$,
$b$  v_family_totals jsonb := '{}'::jsonb;
  v_artifacts jsonb := '[]'::jsonb;
  v_meal_bonus numeric := 0;
begin$b$
    ]
  ];

  for v_index in 1..array_length(v_patches, 1) loop
    v_anchor := v_patches[v_index][1];
    v_replacement := v_patches[v_index][2];
    if position(v_anchor in v_def) = 0 then
      raise exception 'start_dungeon_run anchor % was not found; the live body is not the one this patch knows.', v_index;
    end if;
    v_def := replace(v_def, v_anchor, v_replacement);
  end loop;

  execute v_def;
end;
$$;

grant execute on function public.start_dungeon_run(
  text, bigint, text, text[], bigint, timestamptz, text, text, text, text, jsonb, jsonb
) to authenticated;
