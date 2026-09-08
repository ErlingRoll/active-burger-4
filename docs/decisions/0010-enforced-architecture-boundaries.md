# Enforced architecture boundaries

## Context

PLAN.md sections 8 and 9 described a layering the repository did not have. The
simulation was supposed to be independent of React, PixiJS, Dexie, Supabase, and
the DOM. That held in the sense that no such import existed, but `game/` did
reach upward into feature modules (`abyss/`, `meta/`, `characters/`), and the
`content/` and `game-config/` directories imported each other, so they were not
two layers so much as two halves of one module. The module graph carried nine
import cycles, one of them a true runtime cycle between the `inventory` and
`fishing` barrels.

Nothing checked any of this, so the drift was invisible. The `strict` compiler
option was also absent from every tsconfig, and `e2e/` was in no project's
`include`, so `tsc -b` never looked at it. oxlint exited zero with a dozen
warnings.

## Decision

The boundaries are executable. `tests/architecture.test.ts` reads the import
graph and fails the build when:

- `src/game/` imports React, React DOM, PixiJS, Dexie, or the Supabase client.
- `src/game/` imports anything outside `game/`, `content/`, `game-config/`, and
  `shared/`.
- `src/content/` imports `src/game/`.
- The module graph contains a cycle.

To satisfy the layering rather than weaken the rule, four modules moved to the
side of the boundary their dependents were already on:

- The Abyss modifier registry moved to `content/modifiers/`, beside the world
  modifiers it mirrors, because `GameState` needs its identifier type.
- Essence reward maths moved to `content/progression/`. It is balance content
  with no imports, and `game/ui/Snapshots.ts` needs it.
- Threat evaluation moved to `game/systems/behavior/`. The tuning table stays in
  `content/`, as its own comment always said it should; the evaluation reads
  simulation state and belongs on the game side.
- The champion build snapshot and its validator moved to `game/checkpoint/`. The
  build is simulation input, so `characters/` re-exports it rather than owning
  it.

`content/` and `game-config/` now depend one way. The schema types live in leaf
modules (`EnemyTypes.ts`, `UpgradeTypes.ts`, `CharacterClassTypes.ts`) that
import no tuning data, so `game-config/` can be typed by them without importing
a module that re-exports its own values back. `CharacterClassDefinition` is
generic over its identifier because the identifier union is derived from the
roster in `game-config/`.

`src/shared/` holds the few leaves both sides genuinely need, the
`RandomSource` contract and run-mode identity, so neither has to depend on the
other to reach them. Each keeps its implementation where it was and is
re-exported from the original path.

## Compiler and linter

`strict`, `noUncheckedIndexedAccess`, and `noImplicitOverride` are on in every
project, and `tsconfig.e2e.json` brings the Playwright specs into `tsc -b`.
The codebase was already strict-clean; only the index checks needed work, and
they are satisfied by types (`shared/arrays.ts`) and labelled runtime assertions
(`testing/assertDefined.ts`) rather than casts or non-null assertions.

`npm run lint` runs `oxlint --deny-warnings`. Where a warning is a false
positive, such as a layout effect that must measure the DOM or an imperative
data load, the suppression is scoped to the line and carries the reason.

## Consequences

A regression fails CI instead of waiting to be noticed in review. The cost is
that moving a module across a boundary now requires either satisfying the rule
or amending the test, which is the intended friction.
