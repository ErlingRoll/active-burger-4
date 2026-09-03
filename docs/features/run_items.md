# Run Items

## Purpose

Run items are inventory items selected before a dungeon or Infinite Abyss run.
They modify that run without adding combat actions or pausing the simulation
during combat.

Fish are the first run-item category. Other categories may be added after the
inventory and item-effect contracts are stable.

## Pre-run contract

Before starting a run, the player selects the items allowed by the mode. The
run-start operation must:

1. Validate ownership, item definition, quantity, and mode restrictions.
2. Reserve or consume the selected items atomically with run creation.
3. Resolve their effects using the current content version.
4. Store the item IDs and resolved effects in the run snapshot.

Retrying a run-start request must not consume the items twice. If run creation
fails, the items remain available.

The active simulation reads only the resolved run-item effects. It must not
perform inventory or network operations during a tick.

## Fish meal

The player can select up to five fish before each run. Fish effects last for
the whole run and are not manually activated during combat.

The first release should use a small set of effect families and guard against
stacking five copies of the strongest effect. Use either family slots,
diminishing returns, or explicit per-effect caps.

Fish used for a meal cannot also be used as revival fish. A fish is consumed at
most once.

## Future categories

Possible future run-item categories include:

- Utility items.
- Temporary defensive or offensive effects.
- Abyss-specific risk/reward items.
- Event keys or exploration tools.

Do not add a new category until its source, inventory behavior, effect
duration, duplicate handling, and shop/trade sink are defined.

## Design constraints

- Run items must be meaningful but not mandatory for normal progression.
- Item effects belong in data-driven content definitions.
- Effects must be deterministic under the run seed and content version.
- Items must not bypass server ownership checks when they affect tradeable
  rewards or competitive results.
- The UI must show what will be consumed and the resolved effect before the run
  is committed.
