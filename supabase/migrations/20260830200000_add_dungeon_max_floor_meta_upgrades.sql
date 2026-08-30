insert into public.meta_unlock_definitions (
  id, category, cost, requires_unlock_id, is_starter, payload
) values
  (
    'dungeon-max-floor-1',
    'dungeon-max-floor',
    1000,
    null,
    false,
    '{"rank":1,"maxFloorBonus":5}'::jsonb
  ),
  (
    'dungeon-max-floor-2',
    'dungeon-max-floor',
    2000,
    'dungeon-max-floor-1',
    false,
    '{"rank":2,"maxFloorBonus":5}'::jsonb
  ),
  (
    'dungeon-max-floor-3',
    'dungeon-max-floor',
    4000,
    'dungeon-max-floor-2',
    false,
    '{"rank":3,"maxFloorBonus":5}'::jsonb
  ),
  (
    'dungeon-max-floor-4',
    'dungeon-max-floor',
    10000,
    'dungeon-max-floor-3',
    false,
    '{"rank":4,"maxFloorBonus":5}'::jsonb
  );
