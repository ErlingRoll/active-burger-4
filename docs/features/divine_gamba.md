# Divine Gamba

## Purpose

The Divine Gamba is the refuge's gambling machine: a screen where a player
buys one to twenty balls of Essence and watches them fall through a field of
pegs into pockets that pay a multiple of the ball, and now and then a loot
box. It is the first meta system built to be *fun to lose at*: the drop is
the reward, and the Essence it takes is the sink.

It exists because the meta economy had faucets and refiners but no place
where Essence simply leaves. The store buys access, the shop's spread is
small, and nothing else takes Essence at volume. The Gamba does, on the
player's own initiative, and pays some of it back in a shape that makes the
next drop worth watching.

## House rules

Two promises hold, and both are properties of the physics and the pocket
table together, so neither is a formula. [tests/divineGambaOdds.test.ts](../../tests/divineGambaOdds.test.ts)
measures them by running the simulation for every loadout the Shardwright can
sell, and a new part that breaks either fails the build.

1. **The law of large numbers favours the house.** The return to player is
   below one for every loadout, stake and ball count: about 88% on a bare
   machine, never above 94% however it is fitted. Over enough balls the
   machine keeps Essence.
2. **A single drop profits less than half the time.** For every loadout,
   stake and ball count from one to twenty, the chance that a drop returns
   more than it cost is under fifty percent. On a bare machine one ball
   profits about three times in ten; twenty balls, far less often. A lucky
   drop can still win ten times its stake. The median drop loses.

By construction, only the outer pockets pay above the ball price, and they
hold under a third of landings. The centre pays a fraction. A jackpot pocket
always drops a box beside its payout, so boxes are exactly as rare as
jackpots: about one ball in a hundred on a bare machine and under one in
twenty however it is fitted. The lined pockets beside the jackpots can drop
one too. A box's rarity is drawn from weights in tenths of a percent, and a
legendary box is one in a thousand. Nothing the machine pays is combat power.

## How a drop works

Charge, simulate, settle. The charge and the settlement are separate
transactions so that a crash between them is safe and repeatable, and the
browser can start the balls falling the moment the wallet is charged.

1. **`begin_divine_gamba_play`** (plpgsql, the signed-in player) validates
   the ball count, the stake and the modifiers, folds the player's installed
   parts and enabled modifiers into one machine, charges the wallet, draws a
   seed from a server-random uuid, and writes a `pending` play carrying the
   seed, the machine and the simulation version. The same operation id
   returns the same play and charges nothing twice.
2. **The browser** runs the shared simulation from that seed on that machine
   and animates it. In parallel it asks the house to settle.
3. **`divine-gamba-settle`** (an Edge Function) verifies the caller's token,
   loads the pending play with the service role, checks the caller owns it
   and that its simulation version matches the one bundled, runs the same
   simulation, and calls **`settle_divine_gamba_play`**, which only the
   service role may execute. That function re-checks every ball against the
   frozen machine, recomputes each payout from the pocket table rather than
   trusting the sum it was sent, credits the wallet, grants any boxes through
   the inventory ledger, and marks the play `settled`. Settling a settled
   play returns what it paid the first time.
4. **The tally** shows the browser's prediction while balls are falling and
   the house's numbers once it has settled. They agree, because the
   simulation is deterministic; if ever they did not the house's answer is
   shown and the disagreement is logged. A settlement that fails leaves the
   play pending, and the screen settles every pending play on its next visit.

The browser never tells the server where a ball landed. It sends a ball
count, a stake, a list of modifier ids and a play id, and nothing else.

## The simulation

[src/divine-gamba/sim/](../../src/divine-gamba/sim/) is a fixed-timestep 2D
simulation of round balls falling through a triangle of pegs between two
walls. It runs in the browser and, copied by
[scripts/sync-divine-gamba-sim.mjs](../../scripts/sync-divine-gamba-sim.mjs)
into the Edge Function bundle, on the server, and the two must agree bit for
bit. The rules that make that true:

- Plain doubles and nothing but addition, subtraction, multiplication,
  division, `Math.sqrt` and `Math.floor`, which IEEE 754 rounds identically
  on every V8. No `Math.sin`, `Math.pow`, `Math.hypot` or `Math.random`, no
  `Date`. [tests/divineGambaSim.test.ts](../../tests/divineGambaSim.test.ts)
  greps for them.
- Its own xorshift32, seeded per ball from the play seed and the ball's
  index, drawn in a fixed order: release jitter, one draw per peg hit, the
  split roll, the box roll, the rarity roll.
- Iteration by ball index, then row, then peg. A split child is dropped
  after every paid ball, from its parent's position at the split.
- A hard tick cap; a ball still falling at the cap lands in the pocket under
  it. Two runs with the same input are identical, and
  [tests/fixtures/divineGambaPlays.json](../../tests/fixtures/divineGambaPlays.json)
  pins the output so a refactor cannot move a pocket unnoticed.
- `SIM_VERSION` is stored on every play and checked at settlement. Bump it
  for any change that could move where a ball lands, and regenerate the
  fixtures.

Recording the frames for the animation never changes the outcome; the
server does not record them.

## Sound and the reveal

The simulation records the tick of every peg strike beside the frames, so
the board plays a tick per strike as the balls fall, a thump or a chord as
each lands by what its pocket pays, and a fanfare for a jackpot. A box that
fell is opened before the tally settles: a reel of boxes runs past a marker
and slows onto the one the ball rolled, ticking as tiles pass. The reel is
theatre and honest theatre: the rarity was decided by the simulation before
it starts, and the cosmetic tiles are drawn from the play's seed by the
machine's own weights, so a replay spins the same reel. Reduced motion
skips the spin and shows the box.

## The free drop

One ball a day on the house: the base stake, no modifiers, nothing charged.
It is an ordinary play in every other way, simulated, settled and paid like
a paid one, so a jackpot from a free ball drops its box like any other. The
day is the UTC calendar day, remembered on the play, and a unique index
refuses a second ask however two tabs time it. There is no streak and
nothing is lost by missing a day, which is what the contracts document asks
of anything that rewards a visit.

## Contracts

Three contracts credit the machine from the plays and balls the settlement
records: balls dropped, balls landed in a jackpot pocket, and boxes won. A
free drop counts like a paid one. They pay rift shards and a box, the two
things the machine itself asks for; see
[contracts_delivery_plan.md](contracts_delivery_plan.md).

## The Shardwright

Parts and modifiers are per-account unlocks bought with Essence from the
wallet and rift shards from the bag, in one transaction through the
inventory ledger. They are not items: they cannot be traded, salvaged or
lost. A **part** is fitted for good and always on. A **modifier** is owned
and switched on before a drop, and one that raises the expected return
carries a surcharge on the ball price sized so that the house rules still
hold with it on. The pockets pay against the stake price, never the
surcharged price, which is what makes a surcharge pure house edge.

The catalogue, the pocket tables and the fold from installed parts to a
machine live in [src/divine-gamba/DivineGambaRegistry.ts](../../src/divine-gamba/DivineGambaRegistry.ts)
and in the migration, and [tests/divineGambaRegistry.test.ts](../../tests/divineGambaRegistry.test.ts)
holds the two together the way the Camp's registry test does: the seed rows
are parsed out of the migration, and the machine fixtures the migration
asserts against `divine_gamba_resolve_machine` are the ones the TypeScript
fold is asserted against.

This is the second sink for rift shards, after the Rift anchor, and it is
why the Abyss pays them.

## Economy

Written into the resource graph in [economy.md](economy.md): the Gamba
consumes Essence per ball, and Essence and rift shards for parts; it
produces Essence, less than it takes, and boxes as often as jackpots land, a
legendary one in a thousand. It
creates Essence from nothing on a lucky drop, which rule five of the economy
forbids of a system in general; it is allowed here because the return is
below one by test, so the machine destroys Essence in expectation, and
because the box faucet is capped by the same test. Automation loses money.

## Design constraints

- Every outcome, charge and grant is server-authoritative and idempotent
  under retry, refresh and two tabs.
- The seed is never derived from anything the client sends.
- The machine a play was paid for is frozen on the play; a part bought while
  balls are falling changes the next drop, not this one.
- A box is one of the five rarities, by the weights, by the roll that walks
  them, and by the column constraint on the ball rows; legendary is one in a
  thousand by the weights the registry test pins.
- No timer punishes absence. A pending play waits as long as it takes.
