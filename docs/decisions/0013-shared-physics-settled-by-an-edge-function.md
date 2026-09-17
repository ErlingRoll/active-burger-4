# Shared physics, settled by an Edge Function

## Context

The Divine Gamba is a gambling machine whose outcome is physics: balls fall
through pegs into pockets that pay. Every other chance mechanic in the game
is rolled in plpgsql, and the first design for the machine was too, with the
browser animating a ball along the server's per-row left-or-right decisions.
The game's owner chose real physics instead: one simulation, seen by the
player and paid by the house.

That rules out rolling in SQL, and it rules out trusting the browser, which
the economy documents forbid for anything that creates Essence.

## Decision

The simulation is written once, in TypeScript under `src/divine-gamba/sim/`,
with rules that let two V8s agree bit for bit: a fixed timestep, plain
doubles, and only addition, subtraction, multiplication, division,
`Math.sqrt` and `Math.floor`; its own xorshift32 drawn in a fixed order;
iteration in a fixed order; a hard tick cap. A test greps the source for the
functions it must not use, and a golden fixture pins its output.

It runs in the browser to animate and in a Supabase Edge Function to settle.
The Supabase CLI bundles only what is under `supabase/functions/`, so a
script copies the modules into `supabase/functions/_shared/` and a test fails
when the copy is stale. `SIM_VERSION` travels with every play and is checked
at settlement, so a play begun under one version is never paid by another.

The charge and the settlement are separate transactions. `begin` charges the
wallet, freezes the machine and draws a server-random seed into a pending
play; the function runs the simulation from that play and calls `settle`,
which only the service role may execute and which re-checks every number
against the frozen machine rather than trusting the sum. A crash in between
leaves a pending play that the screen settles on its next visit, and a
settlement replayed returns what it paid the first time.

The browser starts the animation from `begin`'s response, before the house
has answered, and shows the house's numbers when they arrive. The cold start
of the function is hidden behind the drop.

## Consequences

- A second runtime joins the deploy: `supabase functions deploy` runs after
  `db push` in CI, and the function must exist on a project before the
  screen is shipped to it, or settlement fails with a 404.
- Running the function locally needs Docker. The simulation itself, the
  settlement RPC and the whole migration history do not: the RPCs were
  verified against a local Postgres with an `auth.uid()` shim.
- Any change that moves a ball is a `SIM_VERSION` bump and a fixture
  regeneration, and the odds tests must pass again. That cost is the point.
- Canvas 2D draws the board rather than PixiJS: forty balls and fifty pegs
  do not need a WebGL context, and the run renderer's chunk stays out of the
  hub. The view is a thin projection of recorded frames, so a swap is
  contained.
