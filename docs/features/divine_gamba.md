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

There is one machine, the same for every player, and two promises hold
about it. Both are properties of the physics and the pocket table together,
so neither is a formula. [tests/divineGambaOdds.test.ts](../../tests/divineGambaOdds.test.ts)
measures them by running the simulation, and a pocket table that breaks
either fails the build.

1. **The law of large numbers favours the house.** The return to player is
   below one at every stake and ball count: about 99%. Over enough balls the
   machine keeps Essence, slowly.
2. **A drop profits a little under half the time.** For a drop of three
   balls or more, the chance that it returns more than it cost is between
   forty and fifty percent, about 45% at the default five, and it is under
   fifty percent at every ball count from one to twenty. One ball on its own
   profits under three times in ten, because only the three outer pockets on
   each side pay above the ball; a drop of several does better because the
   pocket just inside them pays nearly the ball back. A lucky drop can still
   win six times its stake. The median drop loses, by a little.

The two are in tension. A machine that pays a ×10 jackpot and profits
nearly half the time returns more than it takes, because the jackpot's
Essence goes to drops that would have profited anyway; the jackpot is ×6
so that the middle pockets can carry the profit chance instead. The screen
shows the measured chance for the ball count chosen, so what the legend
says is what the machine does.

A jackpot pocket always drops a box beside its payout, so boxes are exactly
as rare as jackpots: about one ball in a hundred. A box's rarity is drawn
from weights in tenths of a percent, and a legendary box is one in a
thousand. Nothing the machine pays is combat power.

## How a drop works

Charge, simulate, settle. The charge and the settlement are separate
transactions so that a crash between them is safe and repeatable, and the
browser can start the balls falling the moment the wallet is charged.

1. **`begin_divine_gamba_play`** (plpgsql, the signed-in player) validates
   the ball count and the stake, builds the machine from its settings and
   the pocket table, charges the wallet, draws a seed from a server-random
   uuid, and writes a `pending` play carrying the seed, the machine and the
   simulation version. The same operation id returns the same play and
   charges nothing twice.
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
count, a stake and a play id, and nothing else.

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
  box roll, the rarity roll.
- Iteration by ball index, then row, then peg.
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

## Contracts

Three contracts credit the machine from the plays and balls the settlement
records: balls dropped, balls landed in a jackpot pocket, and boxes won.
They pay rift shards and a box; see
[contracts_delivery_plan.md](contracts_delivery_plan.md).

## The machine

The pocket table, the ball price, the stakes and the box weights live in
[src/divine-gamba/DivineGambaRegistry.ts](../../src/divine-gamba/DivineGambaRegistry.ts)
and in the migrations, and [tests/divineGambaRegistry.test.ts](../../tests/divineGambaRegistry.test.ts)
holds the two together the way the Camp's registry test does: the seed rows
are parsed out of the migrations and compared with the registry. A ball can
be bought at one, two or five times the base price, and the pockets pay the
same multiple of whatever was staked, so the odds are the same at every
stake.

The machine once had a parts counter, the Shardwright, selling per-account
upgrades for Essence and rift shards. It was withdrawn: the upgrades were
not liked, and one machine whose odds are the same for everyone is easier
to read and to trust.

## Economy

Written into the resource graph in [economy.md](economy.md): the Gamba
consumes Essence per ball; it produces Essence, less than it takes, and
boxes as often as jackpots land, a legendary one in a thousand. It
creates Essence from nothing on a lucky drop, which rule five of the economy
forbids of a system in general; it is allowed here because the return is
below one by test, so the machine destroys Essence in expectation, and
because the box faucet is capped by the same test. Automation loses money.

## Design constraints

- Every outcome, charge and grant is server-authoritative and idempotent
  under retry, refresh and two tabs.
- The seed is never derived from anything the client sends.
- The machine a play was paid for is frozen on the play; a change to the
  pocket table changes the next drop, not one in flight.
- A box is one of the five rarities, by the weights, by the roll that walks
  them, and by the column constraint on the ball rows; legendary is one in a
  thousand by the weights the registry test pins.
- No timer punishes absence. A pending play waits as long as it takes.
