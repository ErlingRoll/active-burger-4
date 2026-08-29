insert into public.meta_unlock_definitions (
  id, category, cost, requires_unlock_id, is_starter, payload
) values
  (
    'starting-level-1',
    'starting-level',
    1000,
    null,
    false,
    '{"rank":1,"startingLevel":2}'::jsonb
  ),
  (
    'starting-level-2',
    'starting-level',
    2000,
    'starting-level-1',
    false,
    '{"rank":2,"startingLevel":3}'::jsonb
  ),
  (
    'starting-level-3',
    'starting-level',
    5000,
    'starting-level-2',
    false,
    '{"rank":3,"startingLevel":4}'::jsonb
  );
