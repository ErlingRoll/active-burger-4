# 0002: Deterministic automatic combat update order

## Context

Milestone 4 introduces player attacks, moving projectiles, collisions, damage,
and enemy removal while preserving headless deterministic simulation.

## Decision

Each fixed simulation tick updates the attack cooldown, moves enemies, resolves
the nearest living target, spawns a data-driven Basic Bolt when ready, moves
projectiles, queues projectile collision damage, applies damage in stable
EntityId order, and finally removes expired projectiles and dead enemies.
Target and collision candidates are ordered by distance and then EntityId rather
than relying on array insertion order.

## Consequences

Combat has reproducible outcomes across render frame rates and can be tested
without PixiJS or browser APIs. The initial attack is intentionally limited to
the Basic Bolt projectile; additional skills and effects remain future
milestones.
