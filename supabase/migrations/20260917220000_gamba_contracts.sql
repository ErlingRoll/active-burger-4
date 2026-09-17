-- Contracts for the Divine Gamba.
--
-- The contract pool spans every system; the machine now has three of its
-- own, credited from the plays and balls the settlement already records and
-- never from anything the browser says. A free drop counts like a paid one.
-- They pay rift shards and a box, the two things the machine itself asks for.

alter table public.contract_definitions
  drop constraint contract_definitions_objective_check;

alter table public.contract_definitions
  add constraint contract_definitions_objective_check
  check (objective in (
    'descend-floors', 'win-dungeon', 'slay-monsters', 'reach-abyss-depth',
    'descend-abyss', 'catch-fish', 'catch-species', 'open-loot-boxes',
    'craft-items', 'salvage-items', 'gather-materials', 'gut-fish',
    'reach-dungeon-floor', 'sell-items', 'upgrade-buildings', 'cure-fish',
    'reforge-artifacts', 'drop-gamba-balls', 'land-gamba-jackpot', 'win-gamba-boxes'
  ));

insert into public.contract_definitions (
  id, name, cadence, objective, target, parameter, reward, requires_champion, requires_building_id, sort_order
) values
  ('daily-gamba-drop', 'Feed the machine', 'daily', 'drop-gamba-balls', 40, '{}'::jsonb,
    '[{"definitionId": "rift-shard", "quantity": 2}, {"definitionId": "stone", "quantity": 12}]'::jsonb, false, null, 110),
  ('daily-gamba-jackpot', 'The far pocket', 'daily', 'land-gamba-jackpot', 1, '{}'::jsonb,
    '[{"definitionId": "rift-shard", "quantity": 3}]'::jsonb, false, null, 111),
  ('weekly-gamba-boxes', 'What the machine gives', 'weekly', 'win-gamba-boxes', 3, '{}'::jsonb,
    '[{"definitionId": "loot-box-rare", "quantity": 1}, {"definitionId": "rift-shard", "quantity": 6}]'::jsonb, false, null, 112)
on conflict (id) do update
set name = excluded.name,
    cadence = excluded.cadence,
    objective = excluded.objective,
    target = excluded.target,
    parameter = excluded.parameter,
    reward = excluded.reward,
    requires_champion = excluded.requires_champion,
    requires_building_id = excluded.requires_building_id,
    sort_order = excluded.sort_order,
    active = true;

/* Progress, with the three Gamba branches. Rewritten whole with the same signature. */
create or replace function public.contract_progress(
  p_profile_id uuid,
  p_definition public.contract_definitions,
  p_window_start timestamptz,
  p_window_end timestamptz
)
returns integer
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  v_count bigint := 0;
begin
  case p_definition.objective
    when 'descend-floors' then
      select count(*) into v_count
      from public.dungeon_run_snapshots as snapshots
      join public.dungeon_runs as runs on runs.id = snapshots.run_id
      where snapshots.profile_id = p_profile_id
        and runs.mode_id = 'dungeon'
        and snapshots.snapshot_kind = 'floor'
        and snapshots.saved_at >= p_window_start
        and snapshots.saved_at < p_window_end;
    when 'reach-dungeon-floor' then
      select coalesce(max(snapshots.floor_number), 0) into v_count
      from public.dungeon_run_snapshots as snapshots
      join public.dungeon_runs as runs on runs.id = snapshots.run_id
      where snapshots.profile_id = p_profile_id
        and runs.mode_id = 'dungeon'
        and snapshots.snapshot_kind in ('floor', 'victory')
        and snapshots.saved_at >= p_window_start
        and snapshots.saved_at < p_window_end;
    when 'win-dungeon' then
      select count(*) into v_count
      from public.dungeon_runs as runs
      where runs.profile_id = p_profile_id
        and runs.mode_id = 'dungeon'
        and runs.status = 'victory'
        and runs.completed_at >= p_window_start
        and runs.completed_at < p_window_end;
    when 'slay-monsters' then
      select coalesce(sum(snapshots.kill_count), 0) into v_count
      from public.dungeon_run_snapshots as snapshots
      where snapshots.profile_id = p_profile_id
        and snapshots.snapshot_kind in ('victory', 'death', 'forfeit')
        and snapshots.saved_at >= p_window_start
        and snapshots.saved_at < p_window_end;
    when 'reach-abyss-depth' then
      select coalesce(max(runs.current_floor), 0) into v_count
      from public.dungeon_runs as runs
      where runs.profile_id = p_profile_id
        and runs.mode_id = 'infinite-abyss'
        and runs.started_at >= p_window_start
        and runs.started_at < p_window_end;
    when 'descend-abyss' then
      select count(*) into v_count
      from public.abyss_floor_rewards as rewards
      where rewards.profile_id = p_profile_id
        and rewards.created_at >= p_window_start
        and rewards.created_at < p_window_end;
    when 'catch-fish' then
      select count(*) into v_count
      from public.fishing_attempts as attempts
      where attempts.profile_id = p_profile_id
        and attempts.status = 'completed'
        and attempts.result is not null
        and attempts.completed_at >= p_window_start
        and attempts.completed_at < p_window_end
        and (
          p_definition.parameter ->> 'minRarity' is null
          or public.contract_rarity_rank(attempts.result -> 'metadata' ->> 'rarity')
            >= public.contract_rarity_rank(p_definition.parameter ->> 'minRarity')
        );
    when 'catch-species' then
      select count(*) into v_count
      from public.fishing_attempts as attempts
      where attempts.profile_id = p_profile_id
        and attempts.status = 'completed'
        and attempts.result ->> 'definitionId' = p_definition.parameter ->> 'definitionId'
        and attempts.completed_at >= p_window_start
        and attempts.completed_at < p_window_end;
    when 'open-loot-boxes' then
      select count(*) into v_count
      from public.loot_box_openings as openings
      where openings.profile_id = p_profile_id
        and openings.created_at >= p_window_start
        and openings.created_at < p_window_end;
    when 'craft-items' then
      select coalesce(sum(greatest(1, coalesce((operations.request ->> 'quantity')::integer, 1))), 0) into v_count
      from public.inventory_operations as operations
      where operations.profile_id = p_profile_id
        and operations.operation_type = 'craft'
        and operations.status = 'completed'
        and operations.completed_at >= p_window_start
        and operations.completed_at < p_window_end;
    when 'salvage-items' then
      select coalesce(sum(case operations.operation_type
        when 'salvage' then greatest(1, coalesce((operations.request ->> 'quantity')::integer, 1))
        else coalesce(jsonb_array_length(operations.request -> 'itemInstanceIds'), 0)
      end), 0) into v_count
      from public.inventory_operations as operations
      where operations.profile_id = p_profile_id
        and operations.operation_type in ('salvage', 'salvage-sweep')
        and operations.status = 'completed'
        and operations.completed_at >= p_window_start
        and operations.completed_at < p_window_end;
    when 'sell-items' then
      select coalesce(sum(greatest(1, coalesce((operations.request ->> 'quantity')::integer, 1))), 0) into v_count
      from public.inventory_operations as operations
      where operations.profile_id = p_profile_id
        and operations.operation_type = 'sell'
        and operations.status = 'completed'
        and operations.completed_at >= p_window_start
        and operations.completed_at < p_window_end;
    when 'gather-materials' then
      select coalesce(sum(
        coalesce((paid ->> 'units')::integer, 0) + coalesce((paid ->> 'bonus_units')::integer, 0)
      ), 0) into v_count
      from public.inventory_operations as operations
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(operations.result) = 'array' then operations.result else '[]'::jsonb end
      ) as payments(paid)
      where operations.profile_id = p_profile_id
        and operations.operation_type = 'camp-claim'
        and operations.status = 'completed'
        and operations.completed_at >= p_window_start
        and operations.completed_at < p_window_end
        and paid ->> 'definition_id' in ('timber', 'stone');
    when 'gut-fish', 'cure-fish', 'reforge-artifacts', 'upgrade-buildings' then
      select count(*) into v_count
      from public.inventory_operations as operations
      where operations.profile_id = p_profile_id
        and operations.operation_type = any(case p_definition.objective
          when 'gut-fish' then array['camp-gut']
          when 'cure-fish' then array['camp-cure']
          -- The Forge's strikes, and the rerolls it made before it was reworked.
          when 'reforge-artifacts' then array['camp-forge', 'camp-reforge']
          else array['camp-upgrade']
        end)
        and operations.status = 'completed'
        and operations.completed_at >= p_window_start
        and operations.completed_at < p_window_end;
    when 'drop-gamba-balls' then
      select coalesce(sum(plays.ball_count), 0) into v_count
      from public.divine_gamba_plays as plays
      where plays.profile_id = p_profile_id
        and plays.status = 'settled'
        and plays.created_at >= p_window_start
        and plays.created_at < p_window_end;
    when 'land-gamba-jackpot', 'win-gamba-boxes' then
      select count(*) into v_count
      from public.divine_gamba_play_balls as balls
      join public.divine_gamba_plays as plays on plays.id = balls.play_id
      where plays.profile_id = p_profile_id
        and plays.status = 'settled'
        and plays.created_at >= p_window_start
        and plays.created_at < p_window_end
        and case p_definition.objective
          when 'land-gamba-jackpot' then
            balls.pocket_index = 0 or balls.pocket_index = (plays.machine ->> 'rows')::integer
          else balls.box_rarity is not null
        end;
    else
      raise exception 'Unknown contract objective: %.', p_definition.objective;
  end case;
  return least(v_count, 2147483647)::integer;
end;
$$;
