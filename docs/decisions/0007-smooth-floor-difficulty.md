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

The first five floors use a gentler 25% early stat step. Early spawn threat,
elite chance, and special-ability damage/frequency are also reduced before
gradually returning to the stronger mid-game anchors.

Ordinary contact damage uses the same floor multiplier as HP while retaining
the existing 0.8 baseline reduction. Enemy special-ability damage also uses
the HP multiplier plus its ability-specific tuning, keeping late-floor damage
pressure close to late-floor durability pressure.

Archer and Brute receive learnable mechanics across the run:

- Archer telegraphs an aimed line and then launches a hostile physical
  projectile.
- Brute telegraphs a close-range physical shockwave.

Both attacks use fixed-step cooldown state, a minimum warning window, the
player's normal resistance/damage-reduction pipeline, and deterministic
cleanup. Hostile projectiles are explicitly marked so existing non-player
projectile fixtures and future friendly projectiles remain compatible.

## Spawn-age ramp

Ordinary mobs retain their initial floor-scaled stats for a 10-second grace
period. During the following 60 seconds, their movement speed ramps linearly to
4x and their contact/special-ability damage ramps linearly to 2x. Both
multipliers are capped and use the same spawn timestamp, so a mob that survives
longer becomes more dangerous without creating a floor breakpoint.

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
