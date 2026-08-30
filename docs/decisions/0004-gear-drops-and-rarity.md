# 0004: Gear drops, equipment choices, and rarity

## Context

Gear needs to create build choices without adding an inventory economy or making
React responsible for simulation results. Existing level-up choices also need a
shared rarity model so the visual language and offer weights are consistent.

## Decision

Enemy death uses seeded drop rolls defined by enemy content. Effective gear
chance is normalized against spawn threat and tapered continuously by dungeon
floor: it starts at 100% of the authored rate on floor 1, reaches 50% on floor
30, and remains at 50% beyond floor 30. If a run has not generated a gear orb
by its 50th kill, that kill generates one. Generation, not collection, satisfies
the safeguard.

Gear orbs are distinct simulation pickups. Collecting one queues a gear-only,
three-choice flow. Level-up and gear flows are resolved in order, one at a
time. Items equip immediately, replacing their occupied slot if necessary.

All offers have a content-defined rarity. Weighted selection uses centralized
placeholder weights. Gear flows can contain a rare eligible item-upgrade offer:
common, uncommon, and rare items may improve one tier, while epic and legendary
items cannot. The bounded improvement roll is seeded and stored on the equipped
item.

Modifiers are evaluated deterministically as:

```text
(base + all additive modifiers) * all multiplicative modifiers
```

## Consequences

Gear is run-scoped and deterministic. The UI can show immutable item and
comparison snapshots while simulation owns rolls, queues, equipment, and stat
evaluation. Ground drops, permanent inventory, crafting, and generic
event-triggered item effects remain outside this milestone.
