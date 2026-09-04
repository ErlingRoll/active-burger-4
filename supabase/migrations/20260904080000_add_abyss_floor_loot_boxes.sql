-- One server-resolved loot box per completed Infinite Abyss floor.

insert into public.inventory_item_definitions (
  id, category, stackable, max_stack_size, tradeable, bind_on_equip,
  is_unlimited, salvage_essence, payload
) values
  ('loot-box-common', 'loot-box', true, 9999, true, false, false, 0, '{"rarity":"common"}'::jsonb),
  ('loot-box-uncommon', 'loot-box', true, 9999, true, false, false, 0, '{"rarity":"uncommon"}'::jsonb),
  ('loot-box-rare', 'loot-box', true, 9999, true, false, false, 0, '{"rarity":"rare"}'::jsonb),
  ('loot-box-epic', 'loot-box', true, 9999, true, false, false, 0, '{"rarity":"epic"}'::jsonb),
  ('loot-box-legendary', 'loot-box', true, 9999, true, false, false, 0, '{"rarity":"legendary"}'::jsonb)
on conflict (id) do nothing;

create table public.abyss_floor_rewards (
  id bigint generated always as identity primary key,
  run_id text not null references public.dungeon_runs (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  completed_floor integer not null check (completed_floor >= 1),
  box_instance_id uuid not null references public.inventory_item_instances (id),
  box_rarity text not null check (
    box_rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary')
  ),
  created_at timestamptz not null default now(),
  unique (run_id, completed_floor)
);

create index abyss_floor_rewards_profile_idx
  on public.abyss_floor_rewards (profile_id, created_at desc);

alter table public.abyss_floor_rewards enable row level security;

create policy "Abyss floor rewards are readable by their owner"
on public.abyss_floor_rewards for select to authenticated
using ((select auth.uid()) = profile_id);

grant select on public.abyss_floor_rewards to authenticated;

create function public.grant_abyss_floor_loot_box()
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
  v_rarity := case
    when v_roll < v_common_cutoff then 'common'
    when v_roll < v_uncommon_cutoff then 'uncommon'
    when v_roll < v_rare_cutoff then 'rare'
    when v_roll < v_epic_cutoff then 'epic'
    else 'legendary'
  end;

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

revoke all on function public.grant_abyss_floor_loot_box()
  from public, anon, authenticated;

create trigger abyss_floor_snapshot_grant_loot_box
  after insert on public.dungeon_run_snapshots
  for each row
  when (new.snapshot_kind = 'floor')
  execute function public.grant_abyss_floor_loot_box();
