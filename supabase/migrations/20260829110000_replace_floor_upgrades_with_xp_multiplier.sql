delete from public.meta_unlocks as unlocks
using public.meta_unlock_definitions as definitions
where unlocks.unlock_id = definitions.id
  and definitions.category = 'dungeon-max-floor';

delete from public.meta_unlock_definitions
where category = 'dungeon-max-floor';

insert into public.meta_unlock_definitions (
  id, category, cost, requires_unlock_id, is_starter, payload
) values
  (
    'xp-multiplier-1',
    'xp-multiplier',
    100,
    null,
    false,
    '{"level":1,"xpMultiplier":1.05}'::jsonb
  ),
  (
    'xp-multiplier-2',
    'xp-multiplier',
    200,
    'xp-multiplier-1',
    false,
    '{"level":2,"xpMultiplier":1.10}'::jsonb
  ),
  (
    'xp-multiplier-3',
    'xp-multiplier',
    400,
    'xp-multiplier-2',
    false,
    '{"level":3,"xpMultiplier":1.15}'::jsonb
  ),
  (
    'xp-multiplier-4',
    'xp-multiplier',
    800,
    'xp-multiplier-3',
    false,
    '{"level":4,"xpMultiplier":1.20}'::jsonb
  ),
  (
    'xp-multiplier-5',
    'xp-multiplier',
    1600,
    'xp-multiplier-4',
    false,
    '{"level":5,"xpMultiplier":1.25}'::jsonb
  ),
  (
    'xp-multiplier-6',
    'xp-multiplier',
    3200,
    'xp-multiplier-5',
    false,
    '{"level":6,"xpMultiplier":1.30}'::jsonb
  ),
  (
    'xp-multiplier-7',
    'xp-multiplier',
    6400,
    'xp-multiplier-6',
    false,
    '{"level":7,"xpMultiplier":1.35}'::jsonb
  ),
  (
    'xp-multiplier-8',
    'xp-multiplier',
    12800,
    'xp-multiplier-7',
    false,
    '{"level":8,"xpMultiplier":1.40}'::jsonb
  ),
  (
    'xp-multiplier-9',
    'xp-multiplier',
    25600,
    'xp-multiplier-8',
    false,
    '{"level":9,"xpMultiplier":1.45}'::jsonb
  ),
  (
    'xp-multiplier-10',
    'xp-multiplier',
    51200,
    'xp-multiplier-9',
    false,
    '{"level":10,"xpMultiplier":1.50}'::jsonb
  );
