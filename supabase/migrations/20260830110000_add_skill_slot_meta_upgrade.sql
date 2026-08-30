insert into public.meta_unlock_definitions (
  id, category, cost, requires_unlock_id, is_starter, payload
) values (
  'skill-slot-1',
  'skill-slot',
  1000,
  null,
  false,
  '{"skillSlotCount":6}'::jsonb
);
