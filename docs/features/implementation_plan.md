# Feature Implementation Plan

This plan implements the feature set described by the documents in this
directory. It intentionally keeps the game single-character per run. A
Champion may replace the active character in the Infinite Abyss, but multiple
Champions, AI companions, and real-time combat multiplayer are out of scope.

## Delivery principles

- Preserve the deterministic, renderer-independent simulation.
- Keep inventory, rewards, and trading outside the simulation tick.
- Use stable IDs and immutable snapshots for content and player builds.
- Make reward and ownership operations server-authoritative before introducing
  tradeable permanent power.
- Implement one narrow vertical slice before expanding the loot tables.
- Put balance values in data-driven registries and test probability curves with
  seeded simulations.

## Dependency order

```text
Durable run lifecycle
  -> item/inventory foundation
  -> saved character revisions and Champion snapshots
  -> pre-run fish effects
  -> fishing MVP
  -> Infinite Abyss
  -> loot boxes
  -> exhaustion and Revival Koi
  -> artifacts and equipment slots
  -> trading and marketplace
  -> borrowing, leaderboards, and social fishing
```

## Phase 0: Design contracts and balance harness

Define the shared contracts before adding UI:

- Stable IDs for fish, bait, rods, boxes, artifacts, classes, skills, and
  character revisions.
- Content and schema version policy.
- Inventory item instance format.
- Run-start snapshot format.
- Item effect resolution rules.
- Rarity, weighting, pity, and duplicate handling conventions.
- Server/client trust boundaries.

Add deterministic pure functions for:

- Fish catch rolls.
- Rod modifier rolls.
- Box rarity and loot-table rolls.
- Fish effect potency.
- Revival reduction.
- Abyss modifier selection and score.

**Exit criteria:** each function can be tested without React, PixiJS,
Supabase, IndexedDB, or browser APIs.

## Phase 1: Durable run foundation

Complete the existing durable dungeon-run milestone before consuming inventory
items:

- Supabase-owned run locking.
- Initial, floor, terminal, and forfeit snapshots.
- Continue, Save & Quit, and Forfeit lifecycle.
- Idempotent run start and terminal reward submission.
- Exact restoration of the complete deterministic simulation boundary.
- Content-version metadata in every run snapshot.

Extend the run boundary to support a mode ID and mode-specific snapshot data.

**Exit criteria:** a refresh or retry cannot duplicate a run, floor reward, or
item consumption.

## Phase 2: Inventory and meta-item foundation

Create the first general inventory service and UI:

- Item definitions and item instances.
- Stackable and unique item behavior.
- Ownership, quantity, binding, and source metadata.
- Inventory queries and filtered presentation.
- Atomic grant, consume, reserve, release, and salvage operations.
- Server-side RLS and RPCs.
- Local cache that never becomes authoritative.
- Toasts and result-screen presentation for granted items.

Start with fish, bait, and rods. Do not implement the market yet.

**Exit criteria:** a server-granted item cannot be duplicated by refresh,
retries, or two tabs.

## Phase 3: Saved Characters and Champions

Implement the build snapshot model:

- Character recipe editor.
- Immutable character revisions.
- Stable class and skill IDs.
- Validation against unlocks and legal combinations.
- Champion creation from a completed dungeon build.
- Champion list, naming, deletion/archive, and selection.
- Fresh runtime initialization from a Champion snapshot.
- Content-version and migration handling.

Keep the current single `state.player` architecture. The selected Champion is
converted into the existing player state rather than adding a party array.

**Exit criteria:** editing a saved character cannot change a Champion or an
active run, and an old revision can still be loaded when definitions exist.

## Phase 4: Pre-run fish meals

Add the first run-item flow:

- Fish inventory selection screen.
- Maximum of five fish.
- Effect-family stacking limits or diminishing returns.
- Preview of resolved effects and consumed items.
- Atomic run-start reservation/consumption.
- Snapshot of fish IDs and resolved effects.
- Normal dungeon and Abyss mode restrictions.
- Run results showing consumed fish.

Begin with a small set of sidegrade effects. Avoid universal percentage damage
bonuses as the only fish design.

**Exit criteria:** meal effects are deterministic, cannot be consumed twice,
and cannot be changed after the run starts.

## Phase 5: Fishing MVP

Implement fishing as a separate screen and service:

- Fishing spot and bait selection.
- Basic bait with unlimited usage.
- Auto fishing.
- Manual fishing with a bounded quality improvement.
- Fish species, rarity, normalized size, and shop value.
- Rod item creation with deterministic modifier rolls.
- Bait consumption and bait-retention modifiers.
- Fishing result presentation and inventory grants.

Add better bait and rod sources through dungeon rewards or development
fixtures so the loop can be tested without the marketplace.

**Exit criteria:** basic fishing is useful but not the best Essence source, and
better fishing does not depend on already owning an unachievable item.

## Phase 6: Infinite Abyss vertical slice

Implement the mode using one selected Champion:

- Abyss run configuration and entry validation.
- Floor 1 start and independent floor counter.
- Separate 10x HP and 10x damage base profile.
- No normal XP or equipment drops.
- Persistent modifier choice at floor completion.
- Danger Score and modifier combination guardrails.
- One completed-floor reward event.
- Abyss-specific score counters.
- Champion exhaustion reservation.

Initially reuse normal floor timing, enemy content, and rendering where safe.
Add dedicated Abyss presentation only after the simulation rules are stable.

**Exit criteria:** a deterministic test can replay an Abyss attempt and produce
the same modifiers, score, floor state, and terminal result.

## Phase 7: Loot boxes

Add the shared loot-box system:

- Box item definitions and rarity.
- Floor-based Abyss rarity curve capped at floor 100.
- Normal-run maximum rarity of Rare.
- Rarity-specific weighted pools.
- One box per completed Abyss floor.
- Fishing source tables.
- Duplicate and salvage outcomes.
- Idempotent grant processing.
- Chest-like pickup and reveal UI.

Start with fish, bait, rods, materials, and cosmetics. Add artifacts only after
box frequency and duplicate rates have been measured.

**Exit criteria:** each completed floor creates exactly one reward, and reward
quality follows the configured floor curve in seeded distribution tests.

## Phase 8: Exhaustion and Revival Koi

Implement the Champion recovery loop:

- 24-hour offline exhaustion timestamps.
- Exhaustion applied when an Abyss attempt is committed.
- One Champion affected per attempt.
- Revival-fish eligibility.
- Normalized rarity and size formula.
- Remaining-time cap and full-clear behavior.
- Recovery UI and confirmation.
- Server-authoritative consume-and-reduce RPC.
- Recovery audit history.

Test entry, victory, defeat, forfeit, disconnect, retry, and duplicate
recovery requests.

**Exit criteria:** no flow can consume a Revival Koi without reducing
exhaustion, reduce more than the remaining time, or apply recovery twice.

## Phase 9: Artifacts

Add permanent artifacts after loot boxes have measurable output:

- Stable artifact definitions.
- Server-generated rolled values.
- One initial artifact slot.
- Unlocks for slots two and three.
- Pre-run artifact selection.
- Run snapshot of selected artifacts.
- Sidegrade effect families and stacking rules.
- Artifact inventory, salvage, and duplicate handling.
- Bind-on-equip behavior.

Artifacts must be usable with both owned and borrowed Champions without copying
the owner's account inventory.

**Exit criteria:** artifact values cannot be client-authored, equipped artifacts
cannot be traded, and the game remains playable with zero artifacts.

## Phase 10: Trading and marketplace

Only after inventory, binding, and server grants are reliable:

- Listings for eligible fish, rods, bait, and unbound artifacts.
- Atomic purchase and cancellation.
- Currency reservation and refund behavior.
- Ownership transfer history.
- Expiration and stale-listing handling.
- Rate limits and basic abuse controls.
- Search, filters, price history, and listing presentation.

Keep Essence and direct account unlocks non-tradeable. Use low-value salvage
instead of large Essence payouts for unwanted permanent-power items.

**Exit criteria:** concurrent purchase attempts produce one winner, ownership
cannot be duplicated, and a failed transaction leaves both parties consistent.

## Phase 11: Borrowing and social expansion

After Champion snapshots and validation are stable:

- Public Champion publishing.
- Borrow permissions and usage limits.
- Borrower-owned fish and artifact loadouts.
- Owner and borrower exhaustion policy.
- Build inspection with private data removed.
- Shareable build summaries.
- Fishing collection displays and catch sharing.

Real-time fishing ponds, presence, emotes, and social moderation are separate
projects and should not block the economy release.

## Phase 12: Competitive validation and balancing

Add this only if leaderboards become a priority:

- Separate Adventure and Ranked Abyss rulesets.
- Server-side score validation or replay verification.
- Anti-tamper checks for item grants and run results.
- Seasonal or historical content-version policy.
- Public score breakdown showing Champion, modifiers, fish, artifacts, and
  completed floors.

Balance with telemetry that is explicitly opt-in and privacy-safe, or with
aggregated server reward data. Measure:

- Abyss entry and completion rates.
- Median floor and modifier selections.
- Loot-box rarity distribution.
- Duplicate and salvage rates.
- Fish consumption versus shop sale.
- Champion exhaustion recovery time.
- Artifact slot usage and effect diversity.

## Cross-phase validation

Every phase must pass the existing focused tests, lint, and build checks. UI
changes require browser coverage where appropriate. Content changes require
stable-ID and migration tests. Persistence changes require retry, refresh,
offline, and duplicate-request tests.

The implementation must preserve the boundaries documented in `PLAN.md`: the
simulation remains deterministic and independent from React, PixiJS, Supabase,
IndexedDB, the DOM, and network APIs.
