
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

- The CSS-built camp scene and stylized adventurer-figure direction is
  confirmed.
- Preserve every existing control and its currently enforced availability
  policy; visual redesign must not allow access during an active/unknown run
  where it is currently blocked.
- Presence represents dashboard visitors only—people in Fishing, runs,
  Inventory, Shops, or any future screen are not shown in the hub.
- The current fishing service confirms the project has a tested Supabase
  Presence pattern that can be adapted without affecting fishing behavior.
- Use the existing test runner for focused TypeScript service tests, then run
  the targeted dashboard/build validation after implementation.

---

## Hub Visual Refinement Phase

### Screenshot assessment

The first hub version establishes the right theme, but the visual hierarchy is
still panel-first:

- The central courtyard has too much unused black space, while the fire and
  gate are too small to read as a memorable hub focal point.
- The one visible local visitor is visually close to the fire and gate, so the
  player figure can be mistaken for scenery rather than a gathered adventurer.
- The utility, expedition, resource, and leaderboard panels float at the
  perimeter rather than feeling spatially connected to the camp.
- The scene needs more authored depth between its background gate and
  foreground fire, rather than relying on a large flat dark field.

### Recommended refinement direction

Evolve the screen into a **scene-first Emberwatch courtyard**:

1. **Make the bonfire the unmistakable focal point.**
   - Scale the firepit and flame substantially, add stone-ring/log geometry,
     rising embers, stronger local firelight, and a warm ground-light pool.
   - Move the gate farther back and make it a supporting background landmark,
     not a competing central object.

2. **Make gathered players readable and intentional.**
   - Reserve a clear ring around the fire; no visitor may occupy the fire/gate
     centerline.
   - Give player figures a stronger silhouette (cloak, head, weapon/staff
     accent, cast ground shadow), variable but deterministic palette accents,
     and better name-chip placement.
   - Place the local player at the front of the fire circle, with a clear
     “You” marker. Remote visitors fill alternate seating positions around the
     fire and remain complete in the accessible roster.

3. **Turn UI panels into physical camp landmarks.**
   - Inventory becomes a supply chest/rack, Fishing a lit path/pond sign,
     Champions a memorial/banner stand, and Essence store an arcane workbench.
   - Keep these as semantic buttons, but give each a small illustrated CSS
     prop and hover illumination so they feel part of the courtyard.
   - Make the expedition action a foreground gate/waystone prompt, still
     visually distinguished as the main next-step action.

4. **Increase scene depth without adding external art assets.**
   - Add layered stone ground, edge ruins, hanging banners, foreground
     silhouettes, ambient ember particles, and subtle fire-driven light pulses.
   - Preserve the warm orange/amber camp palette while reserving violet only
     for the Infinite Abyss control.

5. **Clarify the information hierarchy.**
   - Reduce the visual weight and footprint of the Essence/store card.
   - Restyle the leaderboard as a notice board mounted at the scene edge.
   - Keep the hero copy concise and positioned over a darker, intentionally
     composed area so it does not compete with the fire.

6. **Keep functional and accessibility safeguards.**
   - Retain every existing action, disabled explanation, run status, error,
     live visitor count, keyboard path, and reduced-motion behavior.
   - Keep all atmospheric animation CSS-only and provide static reduced-motion
     rendering.

### Expected implementation areas

- `src/hub/AdventureHubScene.tsx`: rearrange scene layers, reserve player
  slots, enrich player figures and action-station markup, and retain the
  existing behavior/API surface.
- `src/styles/dashboard.css`: replace the current sparse hub positioning with
  layered courtyard, bonfire, landmark, and player-figure styling plus
  responsive/reduced-motion adaptations.
- `src/hub/AdventureHubScene.test.tsx` (if supported by the existing React
  test environment): assert preserved accessible action labels and roster
  semantics. Otherwise use focused service tests and production build
  validation.

### Scope boundary

This phase is deliberately visual and structural only. It does not change
dashboard presence data, introduce player avatars/assets, add chat, or alter
the availability rules for any existing action.

The selected direction is an atmospheric courtyard with subtle camp stations.
The bonfire, visitor gathering, and layered environmental depth take priority
over giving every action an equally prominent landmark.
