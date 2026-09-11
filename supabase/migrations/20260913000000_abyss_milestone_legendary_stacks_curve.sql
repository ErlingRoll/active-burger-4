-- A milestone floor's legendary chance stacks on the curve instead of
-- replacing it: every 10th completed Infinite Abyss floor still guarantees at
-- least an epic box, and the chance of that box being legendary is the
-- floor's own curve chance plus five points, so the tenth floor beats the
-- ninth in every rarity. Rewritten whole from the version in
-- 20260912230000_abyss_milestone_epic_loot_box.sql, with only the milestone
-- legendary cutoff changed; the rift shard grant is untouched.

create or replace function public.grant_abyss_floor_loot_box()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_run public.dungeon_runs%rowtype;
  v_existing public.abyss_floor_rewards%rowtype;
  v_granted record;
  v_completed_floor integer;
  v_danger_score integer;
  v_seed bigint;
  v_roll integer;
  v_progress numeric;
  v_common_cutoff integer;
  v_uncommon_cutoff integer;
  v_rare_cutoff integer;
  v_epic_cutoff integer;
  v_rarity text;
  v_shards integer;
begin
  if new.floor_number <= 1 then
    return new;
  end if;

  select * into v_run
  from public.dungeon_runs
  where id = new.run_id;
  if not found or v_run.mode_id <> 'infinite-abyss' then
    return new;
  end if;

  v_completed_floor := new.floor_number - 1;
  select * into v_existing
  from public.abyss_floor_rewards
  where run_id = new.run_id
    and completed_floor = v_completed_floor;
  if found then
    return new;
  end if;

  v_danger_score := greatest(
    0,
    coalesce((new.payload -> 'gameState' -> 'run' ->> 'abyssDangerScore')::integer, 0)
  );
  v_seed := mod(v_run.seed, 4294967296);
  if v_seed < 0 then
    v_seed := v_seed + 4294967296;
  end if;
  v_seed := mod(
    v_seed +
    least(v_completed_floor, 100) * 2654435761 +
    v_danger_score * 97,
    4294967296
  );
  v_roll := mod(v_seed, 10000)::integer;
  v_progress := least(1, v_completed_floor / 100.0);
  v_common_cutoff := floor(8000 - v_progress * 5000)::integer;
  v_uncommon_cutoff := v_common_cutoff + floor(1700 + v_progress * 1000)::integer;
  v_rare_cutoff := v_uncommon_cutoff + floor(300 + v_progress * 1200)::integer;
  v_epic_cutoff := v_rare_cutoff + floor(v_progress * 1500)::integer;

  if mod(v_completed_floor, 10) = 0 then
    -- v_seed is a non-negative uint32-range value here, matching the
    -- client's mixedSeed, so this XOR mirrors resolveAbyssLootBoxRarity()'s
    -- milestone bonus roll bit-for-bit. The legendary band is the floor's
    -- own (10000 - epic cutoff) plus the 500-roll milestone bonus.
    v_rarity := case
      when mod(v_seed # 1539272357, 10000) < 10000 - v_epic_cutoff + 500
        then 'legendary'
      else 'epic'
    end;
  else
    v_rarity := case
      when v_roll < v_common_cutoff then 'common'
      when v_roll < v_uncommon_cutoff then 'uncommon'
      when v_roll < v_rare_cutoff then 'rare'
      when v_roll < v_epic_cutoff then 'epic'
      else 'legendary'
    end;
  end if;

  select * into v_granted
  from public.grant_inventory_items(
    'abyss-floor:' || new.run_id || ':' || v_completed_floor,
    'abyss-reward',
    new.run_id || ':' || v_completed_floor,
    jsonb_build_array(jsonb_build_object(
      'definitionId', 'loot-box-' || v_rarity,
      'quantity', 1,
      'metadata', jsonb_build_object(
        'source', 'infinite-abyss',
        'runId', new.run_id,
        'completedFloor', v_completed_floor,
        'boxRarity', v_rarity
      )
    ))
  )
  limit 1;

  v_shards := least(6, 1 + v_completed_floor / 5);
  perform 1 from public.grant_inventory_items(
    'abyss-shards:' || new.run_id || ':' || v_completed_floor,
    'abyss-reward',
    new.run_id || ':' || v_completed_floor,
    jsonb_build_array(jsonb_build_object(
      'definitionId', 'rift-shard',
      'quantity', v_shards,
      'metadata', jsonb_build_object(
        'runId', new.run_id,
        'completedFloor', v_completed_floor
      )
    ))
  );

  insert into public.abyss_floor_rewards (
    run_id, profile_id, completed_floor, box_instance_id, box_rarity
  ) values (
    new.run_id, v_run.profile_id, v_completed_floor,
    v_granted.item_instance_id, v_rarity
  )
  on conflict (run_id, completed_floor) do nothing;
  return new;
end;
$$;
