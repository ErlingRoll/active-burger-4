# ADR 0006: Deterministic player behavior controller

## Status

Accepted

## Context

Active Burger 4 uses autonomous player movement as part of its gameplay build. Dodge,
gear collection, kiting, and combat positioning must cooperate without allowing
render-frame timing, React state, or PixiJS to determine a run's outcome.

## Decision

Player movement is owned by a simulation-side Behavior Controller. It evaluates one
data-defined candidate at a time using stable entity-ID tie-breaking:

1. Dodge imminent hostile telegraphs.
2. Pursue safe gear.
3. Kite local threats.
4. Move into combat range.
5. Hold position.

Dodge is a strict emergency preemption. All other candidates use profile-defined
priorities, safety thresholds, commitment durations, and hysteresis values to prevent
oscillation.

The first run profiles are Balanced, Aggressive, and Cautious. New runs start in Free
movement by default, allowing direct WASD control; players may switch among the
autonomous profiles through the in-run Behavior screen. Free movement disables
automatic behavior, including Dodge. Profile selections are explicit simulation
actions; deterministic automatic decisions consume no random state. React and PixiJS
only project the active profile and selected intent.

## Consequences

The same seed, behavior-profile selection history, and fixed-step progression produce
the same movement decisions. Behavior changes are explainable through UI projections
and can be expanded by content-defined traits without creating separate systems that
compete to move the player. A generic planner/GOAP framework remains out of scope until
the ordered candidate model proves insufficient.
