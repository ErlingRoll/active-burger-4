insert into public.meta_unlock_definitions (
  id, category, cost, requires_unlock_id, is_starter, payload
) values
  (
    'default-dungeon-20-floor',
    'dungeon-max-floor',
    100,
    null,
    false,
    '{"maxFloorContractId":"default-dungeon-20-floor"}'::jsonb
  ),
  (
    'default-dungeon-50-floor',
    'dungeon-max-floor',
    300,
    'default-dungeon-20-floor',
    false,
    '{"maxFloorContractId":"default-dungeon-50-floor"}'::jsonb
  ),
  (
    'default-dungeon-100-floor',
    'dungeon-max-floor',
    1000,
    'default-dungeon-50-floor',
    false,
    '{"maxFloorContractId":"default-dungeon-100-floor"}'::jsonb
  );

insert into public.meta_unlocks (profile_id, unlock_id, granted_at, source_run_id)
select profile_id, 'default-dungeon-20-floor', granted_at, source_run_id
from public.meta_unlocks
where unlock_id = 'default-dungeon-15-minute'
on conflict (profile_id, unlock_id) do nothing;

insert into public.meta_unlocks (profile_id, unlock_id, granted_at, source_run_id)
select profile_id, 'default-dungeon-50-floor', granted_at, source_run_id
from public.meta_unlocks
where unlock_id = 'default-dungeon-20-minute'
on conflict (profile_id, unlock_id) do nothing;

delete from public.meta_unlocks
where unlock_id in ('default-dungeon-15-minute', 'default-dungeon-20-minute');

delete from public.meta_unlock_definitions
where id in ('default-dungeon-15-minute', 'default-dungeon-20-minute');
