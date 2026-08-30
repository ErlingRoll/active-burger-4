# Decision 0007: Smooth high-floor difficulty

## Context

Ordinary enemies previously gained mostly health and contact damage as floors
advanced. The existing roster included ranged and elite identities, but
ordinary enemies did not create ranged or telegraphed threats. This made deep
floors feel like a slower damage check.

## Decision

Difficulty uses a smooth, capped floor profile instead of a hard floor-20
breakpoint. The profile interpolates between authored tuning anchors and
controls supplemental ordinary-enemy health, contact damage, movement speed,
spawn threat, elite chance, composition pressure, and special-ability tuning.
The existing authored dungeon stat curve remains the baseline.

Archer and Brute receive learnable mechanics across the run:

- Archer telegraphs an aimed line and then launches a hostile physical
  projectile.
- Brute telegraphs a close-range physical shockwave.

Both attacks use fixed-step cooldown state, a minimum warning window, the
player's normal resistance/damage-reduction pipeline, and deterministic
cleanup. Hostile projectiles are explicitly marked so existing non-player
projectile fixtures and future friendly projectiles remain compatible.

Floor 20 increases the slope of the profile gradually. It does not unlock a
separate ruleset or introduce an adjacent-floor difficulty spike. World
modifiers and boss enrage remain independent multipliers.

## Consequences

- Early floors teach the same attack language at lower damage and frequency.
- Higher floors gain positional pressure and more advanced compositions in
  addition to numerical scaling.
- Enemy attack behavior is reusable for future abilities because telegraphs and
  hostile projectile resolution are shared systems.
- Balance can be tuned at explicit floor anchors and verified with adjacent
  floor tests.
