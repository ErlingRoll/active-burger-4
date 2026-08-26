# ADR 0005: Deterministic elite enemies

## Status

Accepted

## Context

Milestone 12 needs elite enemies without allowing PixiJS or React to make
gameplay decisions. Elite assignment must therefore be part of the normal
seeded spawn path and remain attached to the enemy state.

## Decision

The spawn director starts rolling for elites at 45 seconds and assigns a
modifier to 10% of normal director spawns. Hasted and Giant are selected with
content weights of 2:1. Hasted has 1.75x speed; Giant has 1.5x radius and 2x
max HP. Hasted awards 1.5x XP and 1.5x authored gear chance; Giant awards 2x
XP and 2x authored gear chance. Gear chances are capped at 100%, while the
existing kill-50 guarantee remains the only unconditional drop.
XP multipliers round to the nearest whole pickup amount because the existing
XP system awards integer pickups.

Elite modifiers are assigned once in simulation state. Splitter children use
their authored child spawn path and do not inherit the parent modifier.
Rendering projects the state into a gold/pink ring and a temporary Pixi Text
label above every enemy; it does not roll or infer elite gameplay state.

## Consequences

Runs with the same seed and actions produce the same elite assignments,
statistics, rewards, and labels. Labels can be removed when real enemy
textures arrive without changing simulation behavior. The 45-second gate keeps
the opening composition readable while still exposing elites during a normal
run.
