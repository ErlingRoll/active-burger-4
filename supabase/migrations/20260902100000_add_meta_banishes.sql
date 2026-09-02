insert into public.meta_unlock_definitions (
  id, category, cost, requires_unlock_id, is_starter, payload
) values
  (
    'banish-1',
    'banish',
    500,
    null,
    false,
    '{"rank":1,"banishCount":2}'::jsonb
  ),
  (
    'banish-2',
    'banish',
    1000,
    'banish-1',
    false,
    '{"rank":2,"banishCount":3}'::jsonb
  ),
  (
    'banish-3',
    'banish',
    2000,
    'banish-2',
    false,
    '{"rank":3,"banishCount":4}'::jsonb
  ),
  (
    'banish-4',
    'banish',
    4000,
    'banish-3',
    false,
    '{"rank":4,"banishCount":5}'::jsonb
  )
on conflict (id) do nothing;
