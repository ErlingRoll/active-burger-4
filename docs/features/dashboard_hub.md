
# Adventure Hub Dashboard Redesign

## Problem and proposed approach

Replace the present card-driven dashboard with a full-bleed, interactive-feeling
adventure hub. The recommended direction is a CSS-authored night-time dungeon
camp: a warm animated bonfire at the center, a dungeon entrance beyond it, and
all currently dashboard-active players arranged visibly around the fire. The
existing navigation, current-run controls, Essence balance/store, Champions,
Inventory, Fishing, Abyss entry, leaderboard, error states, tooltips, and
forfeit confirmation will remain available, but become responsive HUD panels
and location-based action controls rather than the current grid of cards.

Use DOM/CSS instead of a canvas or image-dependent scene. The selected art
direction is CSS-built stylized adventurer figures and an animated bonfire.
This follows the existing fishing pond's scene/HUD model, keeps the dashboard
accessible and responsive, allows a polished bonfire animation without an
asset pipeline, and can later accept player avatar images if that feature is
introduced.

## Recommended visual and interaction layout

- **Scene:** full dashboard viewport with a dark stone courtyard, central
  firepit, dungeon gate, subtle torches/embers, and warm firelight fading into
  cool peripheral darkness.
- **Player gathering:** render the current player and every simultaneous hub
  visitor as stylized, named adventurer figures seated or standing around the
  fire. Place players in deterministic concentric seating rings so no active
  player is omitted; use abbreviated labels at dense counts and an accessible
  live roster that always includes every full name.
- **Primary run control:** make the fire/gate foreground the run action:
  “Begin expedition” when no run exists, or a prominent “Resume expedition”
  station when one is paused. Infinite Abyss becomes its own visually distinct
  rift/gate control alongside it.
- **Utility stations:** retain Inventory, Fishing, Champions, and Essence
  store as compact, clearly labeled stations/dock actions. Preserve all
  existing disabled states and explanatory tooltips.
- **Information HUD:** keep Essence and current-run details in a readable
  persistent panel; retain the Essence leaderboard as a collapsible/right-side
  notice board that remains visible on larger screens and moves below the
  scene on small screens.
- **Motion and accessibility:** animate only atmospheric elements (flame,
  ember drift, fire glow, idle avatar movement) and supply complete
  `prefers-reduced-motion` static alternatives. All stations remain semantic
  buttons, keyboard reachable, focus-visible, and screen-reader labeled.

## Presence design

- Add a dashboard-specific realtime service and channel (rather than coupling
  hub state to fishing) that is active only while the authenticated user is on
  the dashboard.
- Track a minimal, validated presence record: player ID and presence kind. Do
  not trust public names transmitted through realtime presence; resolve all
  remote IDs via the existing `get_player_display_names` RPC and
  `getPlayerDisplayName`, preserving nickname/provider/email fallback rules.
- Subscribe to Supabase Presence sync events, reconcile joins/leaves into the
  scene, and remove the channel on dashboard unmount/navigation. Supabase
  Presence is ephemeral, so this needs no persistence table or migration.
- Use a separate “hub unavailable” status in the dashboard if the realtime
  subscription fails; the dashboard actions continue to work normally.

## Expected implementation areas

- `src/App.tsx`: extract/rework `GameDashboard` composition and pass the
  authenticated account's player-name sources plus the hub presence service.
- `src/hub/HubPresenceService.ts` (new): typed Supabase Presence channel,
  validation, canonical public-name resolution, subscription lifecycle, and
  error reporting, patterned after fishing's realtime service.
- `src/hub/AdventureHubScene.tsx` (new): semantic scene, bonfire, player
  figures, responsive action stations, and screen-reader roster.
- `src/styles/dashboard.css`: replace dashboard-specific card layout with the
  adventure hub scene/HUD styling and reduced-motion/mobile layouts; keep
  styles shared by run setup, Champions, and Abyss intact.
- `src/hub/HubPresenceService.test.ts` (new): service validation, canonical
  name resolution, sync reconciliation, and failure paths. Add a focused scene
  test only if the repository's existing React-test setup supports it.

## Considerations

- Preserve every existing control and its currently enforced availability
  policy; visual redesign must not allow access during an active/unknown run
  where it is currently blocked.
- Presence represents dashboard visitors only—people in Fishing, runs,
  Inventory, Shops, or any future screen are not shown in the hub.
- The current fishing service confirms the project has a tested Supabase
  Presence pattern that can be adapted without affecting fishing behavior.
- Use the existing test runner for focused TypeScript service tests, then run
  the targeted dashboard/build validation after implementation.
