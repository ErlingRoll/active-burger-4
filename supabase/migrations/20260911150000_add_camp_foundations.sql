-- The Camp's foundations: two materials, the reference tables, and the two
-- pure functions everything else will be wired to.
--
-- The Camp is the idle layer described in docs/features/camp.md, and this is
-- slice 0 of docs/features/camp_delivery_plan.md: no player-facing surface
-- yet, only the things the surface will read. Timber and stone become items
-- so they have a named sink (the Storehouse) from the first commit, the
-- buildings and jobs are seeded so the client registry has rows to mirror,
-- and the labour sheet and accrual arithmetic land as SQL so the assign and
-- claim RPCs in the next slice can snapshot and pay from them.
--
-- Both functions have a TypeScript twin under src/content/camp/. The twins
-- must agree, so this migration ends by asserting a fixture set of builds
-- and clocks against the SQL side; tests/campRegistry.test.ts asserts the
-- same fixtures against the TypeScript side and checks that the two fixture
-- sets are the same file. Change one twin, change the fixtures, change both.

-- Materials. Not tradeable for the same reason scrap is not: a material with
-- a passive source and a market is a faucet that runs while nobody plays.
insert into public.inventory_item_definitions (
  id, category, stackable, max_stack_size, tradeable, bind_on_equip,
  is_unlimited, salvage_essence, payload
) values
  ('timber', 'material', true, 9999, false, false, false, 0, '{}'::jsonb),
  ('stone', 'material', true, 9999, false, false, false, 0, '{}'::jsonb)
on conflict (id) do update
set category = excluded.category,
    stackable = excluded.stackable,
    max_stack_size = excluded.max_stack_size,
    tradeable = excluded.tradeable,
    bind_on_equip = excluded.bind_on_equip,
    is_unlimited = excluded.is_unlimited,
    salvage_essence = excluded.salvage_essence,
    payload = excluded.payload,
    active = true;

-- A claim is an inventory operation like any other grant, so a refresh, a
-- retry or two open tabs cannot pay twice.
alter table public.inventory_operations
  drop constraint inventory_operations_operation_type_check;

alter table public.inventory_operations
  add constraint inventory_operations_operation_type_check
  check (
    operation_type in (
      'grant', 'consume', 'reserve', 'release', 'salvage', 'craft', 'sell', 'buy',
      'camp-claim'
    )
  );

-- Reference data, readable by every signed-in player, written only here.

create table public.camp_building_definitions (
  id text primary key,
  name text not null,
  sort_order integer not null,
  active boolean not null default true
);

create table public.camp_building_levels (
  building_id text not null references public.camp_building_definitions (id),
  level integer not null check (level >= 1),
  /* Inventory definition id to quantity. Empty for a level every player starts at. */
  cost jsonb not null default '{}'::jsonb check (jsonb_typeof(cost) = 'object'),
  /* The offline accrual cap this level sets. Only the Storehouse sets one. */
  accrual_cap_hours numeric,
  /* Multiplies every job's base rate at this level. */
  rate_multiplier numeric not null default 1 check (rate_multiplier > 0),
  /* How many Champions the building's jobs can hold between them. */
  job_slots integer not null default 0 check (job_slots >= 0),
  primary key (building_id, level)
);

create table public.camp_job_definitions (
  id text primary key,
  building_id text not null references public.camp_building_definitions (id),
  output_definition_id text not null references public.inventory_item_definitions (id),
  /* Units per hour for one Champion whose sheet multiplies to exactly one. */
  base_rate_per_hour numeric not null check (base_rate_per_hour > 0),
  /* The gear set a Champion is built for when it works here. */
  fit_set_id text not null,
  /* Skill tags that make a Champion at home in this job. */
  fit_tags text[] not null default '{}',
  active boolean not null default true
);

-- Which tags each skill carries, copied from the skill registry so the sheet
-- can be derived on the server. The registry test replays this seed and
-- fails when the two disagree.
create table public.camp_skill_tags (
  skill_id text not null,
  tag text not null,
  primary key (skill_id, tag)
);

alter table public.camp_building_definitions enable row level security;
alter table public.camp_building_levels enable row level security;
alter table public.camp_job_definitions enable row level security;
alter table public.camp_skill_tags enable row level security;

create policy "Camp buildings are readable by signed-in players"
on public.camp_building_definitions for select to authenticated
using (true);
create policy "Camp building levels are readable by signed-in players"
on public.camp_building_levels for select to authenticated
using (true);
create policy "Camp jobs are readable by signed-in players"
on public.camp_job_definitions for select to authenticated
using (true);
create policy "Camp skill tags are readable by signed-in players"
on public.camp_skill_tags for select to authenticated
using (true);

grant select on
  public.camp_building_definitions,
  public.camp_building_levels,
  public.camp_job_definitions,
  public.camp_skill_tags
to authenticated;

-- The Storehouse is the first sink; the Woodline and the quarry are the only
-- faucets. Level one of each is free so a new Camp has work to offer on the
-- day it opens. Numbers are the opening proposals from the delivery plan.
insert into public.camp_building_definitions (id, name, sort_order) values
  ('storehouse', 'Storehouse', 0),
  ('woodline', 'Woodline', 1),
  ('quarry', 'Quarry', 2)
on conflict (id) do update
set name = excluded.name,
    sort_order = excluded.sort_order,
    active = true;

insert into public.camp_building_levels (
  building_id, level, cost, accrual_cap_hours, rate_multiplier, job_slots
) values
  ('storehouse', 1, '{}'::jsonb, 8, 1, 0),
  ('storehouse', 2, '{"timber": 48, "stone": 48}'::jsonb, 10, 1, 0),
  ('storehouse', 3, '{"timber": 120, "stone": 120, "scrap": 40}'::jsonb, 12, 1, 0),
  ('woodline', 1, '{}'::jsonb, null, 1, 1),
  ('woodline', 2, '{"timber": 40, "stone": 40}'::jsonb, null, 1.5, 2),
  ('quarry', 1, '{}'::jsonb, null, 1, 1),
  ('quarry', 2, '{"timber": 40, "stone": 40}'::jsonb, null, 1.5, 2)
on conflict (building_id, level) do update
set cost = excluded.cost,
    accrual_cap_hours = excluded.accrual_cap_hours,
    rate_multiplier = excluded.rate_multiplier,
    job_slots = excluded.job_slots;

insert into public.camp_job_definitions (
  id, building_id, output_definition_id, base_rate_per_hour, fit_set_id, fit_tags
) values
  ('woodline-timber', 'woodline', 'timber', 4, 'splintering', '{melee,physical,summon}'),
  ('quarry-stone', 'quarry', 'stone', 4, 'giant', '{area,defensive,summon}')
on conflict (id) do update
set building_id = excluded.building_id,
    output_definition_id = excluded.output_definition_id,
    base_rate_per_hour = excluded.base_rate_per_hour,
    fit_set_id = excluded.fit_set_id,
    fit_tags = excluded.fit_tags,
    active = true;

insert into public.camp_skill_tags (skill_id, tag) values
  ('basic-attack', 'physical'),
  ('basic-attack', 'projectile'),
  ('whirlwind', 'physical'),
  ('whirlwind', 'melee'),
  ('whirlwind', 'area'),
  ('whirlwind', 'triggerable'),
  ('chain-lightning', 'lightning'),
  ('chain-lightning', 'projectile'),
  ('chain-lightning', 'triggerable'),
  ('vitality', 'defensive'),
  ('vitality', 'triggerable'),
  ('raise-skeleton', 'physical'),
  ('raise-skeleton', 'summon'),
  ('fiery-touch', 'fire'),
  ('fiery-touch', 'area'),
  ('fiery-touch', 'trigger'),
  ('glacial-orb', 'cold'),
  ('glacial-orb', 'projectile'),
  ('glacial-orb', 'area'),
  ('glacial-orb', 'triggerable'),
  ('lancers-charge', 'physical'),
  ('lancers-charge', 'melee'),
  ('lancers-charge', 'area'),
  ('lancers-charge', 'triggerable'),
  ('rallying-banner', 'defensive'),
  ('rallying-banner', 'duration'),
  ('rallying-banner', 'triggerable'),
  ('gravity-well', 'chaos'),
  ('gravity-well', 'area'),
  ('gravity-well', 'triggerable'),
  ('aegis-pulse', 'physical'),
  ('aegis-pulse', 'area'),
  ('aegis-pulse', 'defensive'),
  ('aegis-pulse', 'duration'),
  ('aegis-pulse', 'triggerable'),
  ('rift-javelin', 'physical'),
  ('rift-javelin', 'projectile'),
  ('rift-javelin', 'triggerable'),
  ('cinder-mine', 'fire'),
  ('cinder-mine', 'area'),
  ('cinder-mine', 'dot'),
  ('cinder-mine', 'triggerable'),
  ('storm-relay', 'lightning'),
  ('storm-relay', 'area'),
  ('storm-relay', 'duration'),
  ('storm-relay', 'triggerable'),
  ('soul-tether', 'chaos'),
  ('soul-tether', 'dot'),
  ('soul-tether', 'trigger'),
  ('soul-tether', 'duration'),
  ('soul-tether', 'triggerable'),
  ('phantom-arsenal', 'physical'),
  ('phantom-arsenal', 'projectile'),
  ('phantom-arsenal', 'summon'),
  ('phantom-arsenal', 'duration'),
  ('sigil-of-ruin', 'chaos'),
  ('sigil-of-ruin', 'trigger'),
  ('sigil-of-ruin', 'triggerable'),
  ('mirrorcast', 'trigger'),
  ('critical-spellstrike', 'trigger'),
  ('razorwire', 'physical'),
  ('razorwire', 'area'),
  ('razorwire', 'duration'),
  ('razorwire', 'triggerable'),
  ('blood-rite', 'chaos'),
  ('blood-rite', 'duration'),
  ('blood-rite', 'triggerable'),
  ('prism-halo', 'fire'),
  ('prism-halo', 'cold'),
  ('prism-halo', 'lightning'),
  ('prism-halo', 'duration'),
  ('prism-halo', 'triggerable')
on conflict (skill_id, tag) do nothing;

/*
 * The labour sheet: what a Champion is worth at the Camp, read off the same
 * build it fights with.
 *
 * Mirrors deriveCampLabourSheet in src/content/camp/CampLabour.ts figure for
 * figure, and rounds every figure to four decimals so a Postgres numeric and
 * a JavaScript double agree. The source floor is the floor count of the run
 * that won the Champion; a Champion made by the development tools has none,
 * and its level stands in, so it works the Camp exactly like an earned one.
 *
 * Only the sums the sheet reads are taken from the build: attack speed, Max
 * HP, the increased-damage family, critical chance and movement speed from
 * the rolled gear modifiers, the rarity of each piece wearing the job's set,
 * and the levels of the skills carrying one of the job's tags. The full stat
 * resolver in the simulation is not ported.
 */
create function public.camp_labour_sheet(
  p_build jsonb,
  p_source_floor integer,
  p_job_id text
)
returns jsonb
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  v_job public.camp_job_definitions%rowtype;
  v_level integer;
  v_floor integer;
  v_profile text;
  v_profile_tempo numeric;
  v_profile_stamina numeric;
  v_attack_speed numeric := 0;
  v_max_hp numeric := 0;
  v_damage numeric := 0;
  v_crit numeric := 0;
  v_move numeric := 0;
  v_set_weight integer := 0;
  v_tag_weight integer := 0;
  v_strength numeric;
  v_tempo numeric;
  v_stamina numeric;
  v_load numeric;
  v_bonus numeric;
  v_fit numeric;
  v_haste numeric;
  v_output numeric;
begin
  select jobs.* into v_job
  from public.camp_job_definitions as jobs
  where jobs.id = p_job_id;
  if not found then
    raise exception 'Unknown Camp job.';
  end if;
  if p_build is null or jsonb_typeof(p_build) <> 'object' then
    raise exception 'A Champion build is required.';
  end if;

  -- A level is a positive integer; anything else counts as the first.
  v_level := case
    when (p_build ->> 'level') ~ '^[0-9]+(\.[0-9]+)?$'
    then greatest(1, floor((p_build ->> 'level')::numeric))::integer
    else 1
  end;
  v_floor := case
    when p_source_floor is null then v_level
    else greatest(1, p_source_floor)
  end;

  -- The profile trades one knob against the other: aggressive burns fast,
  -- cautious lasts, balanced does neither.
  v_profile := coalesce(p_build ->> 'behaviorProfileId', 'balanced');
  v_profile_tempo := case v_profile
    when 'aggressive' then 1.2
    when 'cautious' then 0.8
    else 1
  end;
  v_profile_stamina := case v_profile
    when 'aggressive' then 0.75
    when 'cautious' then 1.25
    else 1
  end;

  select
    coalesce(sum(case when modifiers.modifier ->> 'id' = 'attack-speed'
      then (modifiers.modifier ->> 'value')::numeric end), 0),
    coalesce(sum(case when modifiers.modifier ->> 'id' = 'max-hp'
      then (modifiers.modifier ->> 'value')::numeric end), 0),
    coalesce(sum(case when modifiers.modifier ->> 'id' in (
        'increased-global-damage', 'increased-physical-damage',
        'increased-elemental-damage', 'increased-chaos-damage'
      ) then (modifiers.modifier ->> 'value')::numeric end), 0),
    coalesce(sum(case when modifiers.modifier ->> 'id' = 'crit-chance'
      then (modifiers.modifier ->> 'value')::numeric end), 0),
    coalesce(sum(case when modifiers.modifier ->> 'id' = 'movement-speed'
      then (modifiers.modifier ->> 'value')::numeric end), 0)
  into v_attack_speed, v_max_hp, v_damage, v_crit, v_move
  from jsonb_each(coalesce(p_build -> 'equipment', '{}'::jsonb)) as pieces(slot, piece)
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(pieces.piece -> 'modifiers') = 'array'
      then pieces.piece -> 'modifiers'
      else '[]'::jsonb
    end
  ) as modifiers(modifier)
  where jsonb_typeof(pieces.piece) = 'object'
    and jsonb_typeof(modifiers.modifier) = 'object'
    and (modifiers.modifier ->> 'value') ~ '^-?[0-9]+(\.[0-9]+)?$';

  -- Common counts one and legendary five, so a legendary set piece counts
  -- for more. The legacy "giants" id is the Giant's set.
  select coalesce(sum(case coalesce(pieces.piece ->> 'rarity', 'common')
      when 'uncommon' then 2
      when 'rare' then 3
      when 'epic' then 4
      when 'legendary' then 5
      else 1
    end), 0)
  into v_set_weight
  from jsonb_each(coalesce(p_build -> 'equipment', '{}'::jsonb)) as pieces(slot, piece)
  where jsonb_typeof(pieces.piece) = 'object'
    and (case pieces.piece ->> 'setId'
      when 'giants' then 'giant'
      else pieces.piece ->> 'setId'
    end) = v_job.fit_set_id;

  select coalesce(sum(case
      when (skills.skill ->> 'level') ~ '^[0-9]+(\.[0-9]+)?$'
      then greatest(1, floor((skills.skill ->> 'level')::numeric))::integer
      else 1
    end), 0)
  into v_tag_weight
  from jsonb_array_elements(
    case when jsonb_typeof(p_build -> 'skills') = 'array'
      then p_build -> 'skills'
      else '[]'::jsonb
    end
  ) as skills(skill)
  where jsonb_typeof(skills.skill) = 'object'
    and exists (
      select 1
      from public.camp_skill_tags as tags
      where tags.skill_id = skills.skill ->> 'skillId'
        and tags.tag = any (v_job.fit_tags)
    );

  v_strength := round(least(
    1.3,
    1 + 0.01 * greatest(0, v_level - 10) + 0.02 * greatest(0, v_floor - 10)
  ), 4);
  v_tempo := round(least(2, greatest(
    1, v_strength * (1 + v_attack_speed / 200) * v_profile_tempo
  )), 4);
  v_stamina := round(least(12, greatest(
    6, 8 * (1 + v_max_hp / 400) * v_profile_stamina
  )), 4);
  v_load := round(least(2, greatest(1, v_strength * (1 + v_damage / 300))), 4);
  v_bonus := round(least(v_crit, 25) / 100, 4);
  v_fit := round(least(
    1.25,
    1 + least(0.15, v_set_weight * 0.005) + least(0.1, v_tag_weight * 0.01)
  ), 4);
  v_haste := round(1 + v_move / 100, 4);
  v_output := round(least(2, v_tempo * v_load * v_fit), 4);

  return jsonb_build_object(
    'strength', v_strength,
    'tempo', v_tempo,
    'staminaHours', v_stamina,
    'load', v_load,
    'bonusChance', v_bonus,
    'fit', v_fit,
    'haste', v_haste,
    'output', v_output,
    'inputs', jsonb_build_object(
      'level', v_level,
      'floor', v_floor,
      'attackSpeedPercent', v_attack_speed,
      'maxHpFlat', v_max_hp,
      'increasedDamagePercent', v_damage,
      'critChancePercent', v_crit,
      'movementSpeedPercent', v_move,
      'setRarityWeight', v_set_weight,
      'tagLevelWeight', v_tag_weight
    )
  );
end;
$$;

/*
 * Offline accrual, as a pure function of the clock.
 *
 * Mirrors accrueCampProduction in src/content/camp/CampAccrual.ts. The
 * elapsed interval is capped, whole units are paid, and the clock advances
 * only by the time those units cost, so the unpaid fraction of a unit
 * carries forward: claiming twice pays nothing the second time, claiming at
 * two points pays what one claim at the second would, and past the cap
 * nothing more is paid and nothing is lost. Server timestamps only.
 */
create function public.camp_accrue(
  p_rate_per_hour numeric,
  p_cap_hours numeric,
  p_accrued_from timestamptz,
  p_now timestamptz
)
returns table (
  units integer,
  counted_seconds numeric,
  accrued_from timestamptz
)
language plpgsql
stable
as $$
declare
  v_rate numeric := greatest(0, coalesce(p_rate_per_hour, 0));
  v_elapsed numeric;
  v_counted numeric;
  v_units integer;
  v_paid numeric;
  v_unpaid numeric;
begin
  v_elapsed := greatest(0, extract(epoch from (p_now - p_accrued_from)));
  v_counted := least(v_elapsed, greatest(0, coalesce(p_cap_hours, 0)) * 3600);

  if v_rate = 0 then
    return query select 0, v_counted, p_now;
    return;
  end if;

  v_units := floor(v_rate * v_counted / 3600)::integer;
  v_paid := v_units * 3600 / v_rate;
  v_unpaid := greatest(0, v_counted - v_paid);

  return query select v_units, v_counted, p_now - make_interval(secs => v_unpaid);
end;
$$;

revoke all on function public.camp_labour_sheet(jsonb, integer, text)
  from public, anon, authenticated;
revoke all on function public.camp_accrue(numeric, numeric, timestamptz, timestamptz)
  from public, anon, authenticated;

/*
 * The fixture checks. Each raises when the SQL twin disagrees with what the
 * TypeScript twin produced for the same input, so applying this migration is
 * the test. They are kept, revoked from every role, so a later migration
 * that retunes a formula can re-run its own fixtures the same way.
 */
create function public.camp_check_labour_sheet(
  p_name text,
  p_build jsonb,
  p_source_floor integer,
  p_job_id text,
  p_expected jsonb
)
returns void
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  v_sheet jsonb;
begin
  v_sheet := public.camp_labour_sheet(p_build, p_source_floor, p_job_id);
  if v_sheet <> p_expected then
    raise exception 'Camp labour sheet fixture "%" disagrees with its TypeScript twin: SQL produced %, expected %',
      p_name, v_sheet, p_expected;
  end if;
end;
$$;

create function public.camp_check_accrual(
  p_name text,
  p_rate_per_hour numeric,
  p_cap_hours numeric,
  p_accrued_from timestamptz,
  p_now timestamptz,
  p_units integer,
  p_counted_seconds numeric,
  p_expected_accrued_from timestamptz
)
returns void
language plpgsql
stable
as $$
declare
  v_result record;
begin
  select * into v_result
  from public.camp_accrue(p_rate_per_hour, p_cap_hours, p_accrued_from, p_now);
  if v_result.units <> p_units
     or v_result.counted_seconds <> p_counted_seconds
     or abs(extract(epoch from (v_result.accrued_from - p_expected_accrued_from))) >= 0.001 then
    raise exception 'Camp accrual fixture "%" disagrees with its TypeScript twin: SQL produced (%, %, %), expected (%, %, %)',
      p_name, v_result.units, v_result.counted_seconds, v_result.accrued_from,
      p_units, p_counted_seconds, p_expected_accrued_from;
  end if;
end;
$$;

revoke all on function public.camp_check_labour_sheet(text, jsonb, integer, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.camp_check_accrual(text, numeric, numeric, timestamptz, timestamptz, integer, numeric, timestamptz)
  from public, anon, authenticated;

-- Generated from tests/fixtures/campLabourSheets.json and campAccrual.json;
-- tests/campRegistry.test.ts holds this block to those files.
do $$
begin
  perform public.camp_check_labour_sheet(
    'bare-recruit',
    '{"schemaVersion":1,"classId":"knight","skills":[],"selectedUpgradeIds":[],"equipment":{},"behaviorProfileId":"balanced"}'::jsonb,
    null,
    'woodline-timber',
    '{"strength":1,"tempo":1,"staminaHours":8,"load":1,"bonusChance":0,"fit":1,"haste":1,"output":1,"inputs":{"level":1,"floor":1,"attackSpeedPercent":0,"maxHpFlat":0,"increasedDamagePercent":0,"critChancePercent":0,"movementSpeedPercent":0,"setRarityWeight":0,"tagLevelWeight":0}}'::jsonb
  );
  perform public.camp_check_labour_sheet(
    'deep-clear-aggressive-at-the-quarry',
    '{"schemaVersion":1,"level":30,"classId":"knight","skills":[{"skillId":"whirlwind","level":3},{"skillId":"vitality","level":2},{"skillId":"raise-skeleton","level":4},{"skillId":"chain-lightning","level":5}],"selectedUpgradeIds":[],"equipment":{"weapon":{"itemId":"iron-sword","rarity":"legendary","setId":"giant","modifiers":[{"id":"attack-speed","tier":1,"value":20,"sourceId":"fixture"},{"id":"increased-global-damage","tier":1,"value":21,"sourceId":"fixture"},{"id":"crit-chance","tier":1,"value":14,"sourceId":"fixture"}]},"armor":{"itemId":"leather-armor","rarity":"epic","setId":"giant","modifiers":[{"id":"max-hp","tier":1,"value":56,"sourceId":"fixture"},{"id":"attack-speed","tier":3,"value":12,"sourceId":"fixture"}]},"boots":{"itemId":"leather-boots","rarity":"rare","setId":"giants","modifiers":[{"id":"movement-speed","tier":1,"value":16,"sourceId":"fixture"},{"id":"attack-speed","tier":4,"value":8,"sourceId":"fixture"}]},"ring":{"itemId":"iron-ring","rarity":"common","modifiers":[{"id":"crit-chance","tier":4,"value":5,"sourceId":"fixture"},{"id":"increased-physical-damage","tier":1,"value":31,"sourceId":"fixture"}]},"helmet":{"itemId":"leather-cap","rarity":"uncommon","setId":"giant","modifiers":[{"id":"max-hp","tier":2,"value":41,"sourceId":"fixture"}]},"amulet":{"itemId":"bone-amulet","rarity":"legendary","setId":"scholar","modifiers":[{"id":"attack-speed","tier":1,"value":24,"sourceId":"fixture"},{"id":"increased-chaos-damage","tier":2,"value":20,"sourceId":"fixture"}]}},"behaviorProfileId":"aggressive","targetPriorityId":"elites"}'::jsonb,
    25,
    'quarry-stone',
    '{"strength":1.3,"tempo":2,"staminaHours":7.455,"load":1.612,"bonusChance":0.19,"fit":1.16,"haste":1.16,"output":2,"inputs":{"level":30,"floor":25,"attackSpeedPercent":64,"maxHpFlat":97,"increasedDamagePercent":72,"critChancePercent":19,"movementSpeedPercent":16,"setRarityWeight":14,"tagLevelWeight":9}}'::jsonb
  );
  perform public.camp_check_labour_sheet(
    'cautious-lumberjack-in-splintering',
    '{"schemaVersion":1,"level":12,"classId":"ranger","skills":[{"skillId":"lancers-charge","level":1},{"skillId":"glacial-orb","level":2},{"skillId":"phantom-arsenal","level":2}],"selectedUpgradeIds":[],"equipment":{"weapon":{"itemId":"short-bow","rarity":"legendary","setId":"splintering","modifiers":[{"id":"attack-speed","tier":5,"value":4,"sourceId":"fixture"}]},"helmet":{"itemId":"leather-cap","rarity":"common","setId":"splintering","modifiers":[{"id":"max-hp","tier":5,"value":12,"sourceId":"fixture"}]},"armor":{"itemId":"leather-armor","rarity":"common","setId":"splintering","modifiers":[]},"boots":{"itemId":"leather-boots","rarity":"common","setId":"splintering","modifiers":[{"id":"movement-speed","tier":5,"value":4,"sourceId":"fixture"}]},"ring":{"itemId":"iron-ring","rarity":"common","setId":"splintering","modifiers":[]},"amulet":{"itemId":"bone-amulet","rarity":"common","setId":"splintering","modifiers":[{"id":"crit-chance","tier":5,"value":2,"sourceId":"fixture"}]}},"behaviorProfileId":"cautious","targetPriorityId":"nearest"}'::jsonb,
    10,
    'woodline-timber',
    '{"strength":1.02,"tempo":1,"staminaHours":10.3,"load":1.02,"bonusChance":0.02,"fit":1.08,"haste":1.04,"output":1.1016,"inputs":{"level":12,"floor":10,"attackSpeedPercent":4,"maxHpFlat":12,"increasedDamagePercent":0,"critChancePercent":2,"movementSpeedPercent":4,"setRarityWeight":10,"tagLevelWeight":3}}'::jsonb
  );
  perform public.camp_check_labour_sheet(
    'development-champion-without-a-run',
    '{"schemaVersion":1,"level":40,"classId":"mage","skills":[{"skillId":"aegis-pulse","level":5},{"skillId":"sigil-of-ruin","level":3}],"selectedUpgradeIds":[],"equipment":{"weapon":{"itemId":"oak-staff","rarity":"rare","modifiers":[{"id":"increased-elemental-damage","tier":3,"value":15,"sourceId":"fixture"},{"id":"crit-chance","tier":1,"value":16,"sourceId":"fixture"},{"id":"cooldown-reduction","tier":1,"value":9,"sourceId":"fixture"}]},"armor":{"itemId":"leather-armor","setId":"giant","modifiers":[{"id":"max-hp","tier":1,"value":70,"sourceId":"fixture"}]},"ring":{"itemId":"iron-ring","rarity":"epic","modifiers":[{"id":"crit-chance","tier":2,"value":13,"sourceId":"fixture"},{"id":"max-hp","tier":3,"value":30,"sourceId":"fixture"}]}},"behaviorProfileId":"balanced"}'::jsonb,
    null,
    'quarry-stone',
    '{"strength":1.3,"tempo":1.3,"staminaHours":10,"load":1.365,"bonusChance":0.25,"fit":1.055,"haste":1,"output":1.8721,"inputs":{"level":40,"floor":40,"attackSpeedPercent":0,"maxHpFlat":100,"increasedDamagePercent":15,"critChancePercent":29,"movementSpeedPercent":0,"setRarityWeight":1,"tagLevelWeight":5}}'::jsonb
  );
  perform public.camp_check_accrual(
    'eleven-whole-units', 4, 8,
    '2026-09-11T00:00:00Z'::timestamptz, '2026-09-11T02:45:00Z'::timestamptz,
    11, 9900, '2026-09-11T02:45:00.000Z'::timestamptz
  );
  perform public.camp_check_accrual(
    'a-fraction-carries-forward', 4, 8,
    '2026-09-11T00:00:00Z'::timestamptz, '2026-09-11T02:40:00Z'::timestamptz,
    10, 9600, '2026-09-11T02:30:00.000Z'::timestamptz
  );
  perform public.camp_check_accrual(
    'past-the-cap', 4, 8,
    '2026-09-11T00:00:00Z'::timestamptz, '2026-09-11T20:00:00Z'::timestamptz,
    32, 28800, '2026-09-11T20:00:00.000Z'::timestamptz
  );
  perform public.camp_check_accrual(
    'stamina-below-the-storehouse', 6, 6,
    '2026-09-10T12:00:00Z'::timestamptz, '2026-09-11T12:00:00Z'::timestamptz,
    36, 21600, '2026-09-11T12:00:00.000Z'::timestamptz
  );
  perform public.camp_check_accrual(
    'an-awkward-rate', 6.6, 10,
    '2026-09-11T00:00:00Z'::timestamptz, '2026-09-11T01:00:00Z'::timestamptz,
    6, 3600, '2026-09-11T00:54:32.727Z'::timestamptz
  );
  perform public.camp_check_accrual(
    'nothing-yet', 4, 8,
    '2026-09-11T00:00:00Z'::timestamptz, '2026-09-11T00:10:00Z'::timestamptz,
    0, 600, '2026-09-11T00:00:00.000Z'::timestamptz
  );
  perform public.camp_check_accrual(
    'clock-in-the-future', 4, 8,
    '2026-09-11T01:00:00Z'::timestamptz, '2026-09-11T00:00:00Z'::timestamptz,
    0, 0, '2026-09-11T00:00:00.000Z'::timestamptz
  );
end;
$$;
