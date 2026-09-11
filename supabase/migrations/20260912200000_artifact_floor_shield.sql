-- Second wind becomes Bulwark.
--
-- "Recover #% of maximum HP on descending a floor" was dead weight: entering
-- a floor already heals the player to full, so the line could never do
-- anything. Its slot in the pool is now "Begin each floor with a shield worth
-- #% of maximum HP", on the same tier ladder. Artifacts already rolled with
-- the old line carry the new one at the same tier and value, wherever they
-- are: in the bag, held by a run, or inside a Champion.

create or replace function public.artifact_effect_tier_range(
  p_effect_id text,
  p_tier integer
) returns integer[]
language sql
immutable
security definer set search_path = ''
as $$
  select case
    -- Implicits, one per base.
    when p_effect_id in ('charted-choices') then case p_tier
      when 1 then array[9, 10]
      when 2 then array[8, 8]
      when 3 then array[7, 7]
      when 4 then array[6, 6]
      else array[5, 5]
    end
    when p_effect_id in ('corpse-detonation') then case p_tier
      when 1 then array[44, 50]
      when 2 then array[38, 43]
      when 3 then array[32, 37]
      when 4 then array[26, 31]
      else array[20, 25]
    end
    when p_effect_id in ('skill-echo') then case p_tier
      when 1 then array[49, 55]
      when 2 then array[43, 48]
      when 3 then array[37, 42]
      when 4 then array[31, 36]
      else array[25, 30]
    end
    when p_effect_id in ('momentum') then case p_tier
      when 1 then array[18, 20]
      when 2 then array[15, 17]
      when 3 then array[13, 14]
      when 4 then array[10, 12]
      else array[8, 9]
    end
    when p_effect_id in ('hearty-meal') then case p_tier
      when 1 then array[26, 30]
      when 2 then array[22, 25]
      when 3 then array[18, 21]
      when 4 then array[14, 17]
      else array[10, 13]
    end
    -- The pool.
    when p_effect_id in ('max-hp') then case p_tier
      when 1 then array[14, 18]
      when 2 then array[11, 13]
      when 3 then array[8, 10]
      when 4 then array[6, 7]
      else array[4, 5]
    end
    when p_effect_id in ('movement-speed') then case p_tier
      when 1 then array[10, 12]
      when 2 then array[8, 9]
      when 3 then array[6, 7]
      when 4 then array[4, 5]
      else array[3, 3]
    end
    when p_effect_id in ('attack-speed') then case p_tier
      when 1 then array[12, 15]
      when 2 then array[10, 11]
      when 3 then array[8, 9]
      when 4 then array[6, 7]
      else array[3, 5]
    end
    when p_effect_id in ('cooldown-reduction') then case p_tier
      when 1 then array[12, 15]
      when 2 then array[10, 11]
      when 3 then array[8, 9]
      when 4 then array[6, 7]
      else array[3, 5]
    end
    when p_effect_id in ('crit-chance') then case p_tier
      when 1 then array[6, 8]
      when 2 then array[5, 5]
      when 3 then array[4, 4]
      when 4 then array[3, 3]
      else array[1, 2]
    end
    when p_effect_id in ('melee-leech') then case p_tier
      when 1 then array[3, 3]
      when 2 then array[3, 3]
      when 3 then array[2, 2]
      when 4 then array[2, 2]
      else array[1, 1]
    end
    when p_effect_id in ('kill-cooldown-reset') then case p_tier
      when 1 then array[10, 14]
      when 2 then array[7, 9]
      when 3 then array[5, 6]
      when 4 then array[4, 4]
      else array[2, 3]
    end
    when p_effect_id in ('primed-strike') then case p_tier
      when 1 then array[60, 80]
      when 2 then array[45, 59]
      when 3 then array[35, 44]
      when 4 then array[25, 34]
      else array[15, 24]
    end
    when p_effect_id in ('elite-damage') then case p_tier
      when 1 then array[18, 22]
      when 2 then array[14, 17]
      when 3 then array[11, 13]
      when 4 then array[8, 10]
      else array[5, 7]
    end
    -- The modest ladder: lines that touch every hit.
    when p_effect_id in ('increased-damage', 'experience-gain') then case p_tier
      when 1 then array[15, 20]
      when 2 then array[12, 14]
      when 3 then array[9, 11]
      when 4 then array[7, 8]
      else array[4, 6]
    end
    -- The burst ladder: effects that only fire now and then.
    when p_effect_id in ('crit-multiplier', 'kill-area-surge', 'floor-shield') then case p_tier
      when 1 then array[40, 50]
      when 2 then array[30, 39]
      when 3 then array[22, 29]
      when 4 then array[16, 21]
      else array[10, 15]
    end
    -- The standard ladder: area-of-effect, dot-multiplier, last-stand,
    -- healing-received.
    else case p_tier
      when 1 then array[20, 25]
      when 2 then array[16, 19]
      when 3 then array[12, 15]
      when 4 then array[9, 11]
      else array[5, 8]
    end
  end;
$$;

revoke all on function public.artifact_effect_tier_range(text, integer) from public;

create or replace function public.roll_artifact_metadata(
  p_item_id uuid,
  p_definition_id text,
  p_metadata jsonb
)
returns jsonb
language plpgsql
immutable
security definer set search_path = ''
as $$
declare
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_base_id text;
  v_implicit_id text;
  v_rarity text;
  v_rarity_roll integer;
  v_modifier_count integer;
  v_pool text[] := array[
    'max-hp', 'movement-speed', 'attack-speed', 'cooldown-reduction',
    'area-of-effect', 'crit-chance', 'crit-multiplier', 'increased-damage',
    'dot-multiplier', 'melee-leech', 'kill-area-surge', 'kill-cooldown-reset',
    'primed-strike', 'last-stand', 'floor-shield', 'elite-damage',
    'experience-gain', 'healing-received'
  ];
  v_chosen text[] := '{}'::text[];
  v_modifiers jsonb := '[]'::jsonb;
  v_candidate text;
  v_attempt integer;
  v_tier integer;
  v_tier_roll integer;
  v_range integer[];
  v_value integer;
  v_implicit jsonb;
begin
  -- An artifact that already carries a complete roll keeps it. That is how
  -- one returns from an archived Champion with the same modifiers it left
  -- with, and how a retried grant cannot hand out a different artifact.
  if jsonb_typeof(v_metadata -> 'implicit') = 'object'
    and jsonb_typeof(v_metadata -> 'modifiers') = 'array' then
    return v_metadata;
  end if;

  v_base_id := replace(p_definition_id, 'artifact-', '');
  v_implicit_id := case v_base_id
    when 'cartographers-compass' then 'charted-choices'
    when 'ember-reliquary' then 'corpse-detonation'
    when 'echoing-tuning-fork' then 'skill-echo'
    when 'wayfarers-anklet' then 'momentum'
    when 'gluttons-kettle' then 'hearty-meal'
    else null
  end;
  if v_implicit_id is null then
    raise exception 'Unknown artifact definition %.', p_definition_id;
  end if;

  -- Rarity is rolled per hundred: 40 common, 30 uncommon, 18 rare, 10 epic,
  -- 2 legendary. A rarity already on the metadata is honoured, which is what
  -- lets the development grants ask for a legendary to test with; the grant
  -- RPCs are the only writers and they are admin-gated.
  if v_metadata ->> 'rarity' in ('common', 'uncommon', 'rare', 'epic', 'legendary') then
    v_rarity := v_metadata ->> 'rarity';
  else
    v_rarity_roll := public.artifact_hash_roll(p_item_id, 'rarity', 100);
    v_rarity := case
      when v_rarity_roll < 40 then 'common'
      when v_rarity_roll < 70 then 'uncommon'
      when v_rarity_roll < 88 then 'rare'
      when v_rarity_roll < 98 then 'epic'
      else 'legendary'
    end;
  end if;

  v_modifier_count := case v_rarity
    when 'common' then 1
    when 'uncommon' then 2
    when 'rare' then 3
    when 'epic' then 4
    else 5
  end;

  -- Tiers roll per hundred, best tier rarest: 5, 12, 20, 28, 35.
  v_tier_roll := public.artifact_hash_roll(p_item_id, 'tier:' || v_implicit_id, 100);
  v_tier := case
    when v_tier_roll < 5 then 1
    when v_tier_roll < 17 then 2
    when v_tier_roll < 37 then 3
    when v_tier_roll < 65 then 4
    else 5
  end;
  v_range := public.artifact_effect_tier_range(v_implicit_id, v_tier);
  v_value := v_range[1] + public.artifact_hash_roll(
    p_item_id, 'value:' || v_implicit_id, v_range[2] - v_range[1] + 1
  );
  v_implicit := jsonb_build_object('id', v_implicit_id, 'tier', v_tier, 'value', v_value);

  -- Modifiers are drawn without replacement: each attempt hashes to a pool
  -- entry and a repeat is skipped. Sixty attempts at eighteen entries cannot
  -- realistically fail to find five distinct ones, and the guard below says
  -- so plainly if they ever do.
  for v_attempt in 0..59 loop
    exit when coalesce(array_length(v_chosen, 1), 0) >= v_modifier_count;
    v_candidate := v_pool[
      public.artifact_hash_roll(p_item_id, 'mod:' || v_attempt::text, array_length(v_pool, 1)) + 1
    ];
    continue when v_candidate = any(v_chosen);
    v_chosen := array_append(v_chosen, v_candidate);

    v_tier_roll := public.artifact_hash_roll(p_item_id, 'tier:' || v_candidate, 100);
    v_tier := case
      when v_tier_roll < 5 then 1
      when v_tier_roll < 17 then 2
      when v_tier_roll < 37 then 3
      when v_tier_roll < 65 then 4
      else 5
    end;
    v_range := public.artifact_effect_tier_range(v_candidate, v_tier);
    v_value := v_range[1] + public.artifact_hash_roll(
      p_item_id, 'value:' || v_candidate, v_range[2] - v_range[1] + 1
    );
    v_modifiers := v_modifiers || jsonb_build_object(
      'id', v_candidate, 'tier', v_tier, 'value', v_value
    );
  end loop;
  if coalesce(array_length(v_chosen, 1), 0) < v_modifier_count then
    raise exception 'Artifact roll could not fill % modifiers.', v_modifier_count;
  end if;

  return v_metadata || jsonb_build_object(
    'baseId', v_base_id,
    'rarity', v_rarity,
    'implicit', v_implicit,
    'modifiers', v_modifiers
  );
end;
$$;

revoke all on function public.roll_artifact_metadata(uuid, text, jsonb) from public;

update public.inventory_item_instances as instances
set metadata = replace(instances.metadata::text, '"floor-heal"', '"floor-shield"')::jsonb
where instances.definition_id like 'artifact-%'
  and instances.metadata::text like '%"floor-heal"%';

update public.dungeon_runs as runs
set preparation = replace(runs.preparation::text, '"floor-heal"', '"floor-shield"')::jsonb
where runs.preparation::text like '%"floor-heal"%';

update public.champions as champions
set build = replace(champions.build::text, '"floor-heal"', '"floor-shield"')::jsonb
where champions.build::text like '%"floor-heal"%';
