# The Camp

## Purpose

The Camp is the idle layer of the game and the hub of its economy. It is where
materials produced by runs, the Abyss, and fishing are refined into the inputs
those same systems consume.

It is deliberately not a separate game. It is a screen of its own, reached
from a station on the Adventure Hub scene described in
[dashboard_hub.md](dashboard_hub.md), the way the Moonwater Pond is: the hub
stays the refuge with its fire, and the Camp is the ground beyond it where the
buildings stand.

The Camp produces no raw power. It produces options, capacity, access, and
time, in the terms set by [economy.md](economy.md).

## Champions staff the Camp

This is the central mechanic and the reason the Camp is worth building.

Today a Champion is created by every dungeon victory, spent on a single Abyss
attempt, and then exhausted for twenty-four hours with nothing to do. A
Champion is already an immutable build snapshot with a class, skills, gear, and
a behaviour profile, described in [champions.md](champions.md).

Let a Champion be assigned to a Camp job:

- A Champion occupies exactly one job at a time.
- An assigned Champion is unavailable for an Abyss attempt until unassigned.
- An **exhausted** Champion may work. Exhaustion blocks the Abyss, not labour.
- Assigning and unassigning is free and instant. The Camp must not become a
  scheduling puzzle with a cooldown on every decision.

This turns three existing dead ends into loops at once. Every completed dungeon
run gains ongoing value instead of producing a Champion the player may never
use. The Champion roster becomes a collection worth growing and diversifying.
Exhaustion becomes a scheduling decision rather than pure downtime.

### The labour sheet

A job's output scales with what is already stored in the Champion snapshot, so
no new player-facing stat is invented, and the Camp never reduces a Champion
to its class. The **labour sheet** is derived from the same build the Champion
fights with: level and the floor of the run that won it set its strength,
attack speed sets its tempo, Max HP its stamina, the increased-damage rolls its
load, critical chance the chance of a bonus haul, and the gear set and skill
tags decide where it is at home. Splintering gear and melee skills fit the
Woodline; Giant's gear and area skills fit the quarry; summons fit both, as
extra hands. The formulas and their bounds are in
[camp_delivery_plan.md](camp_delivery_plan.md).

The sheet is a modest multiplier, not a gate. Any Champion can work any job,
and everything multiplied together is capped at twice the base rate. The
purpose is to make a varied roster slightly better than a stack of clones, and
to make gear matter twice: once in the run that won the Champion, and again
every time the player chooses who works. The picker shows the sheet on every
row, so that choice is made with the numbers in view.

## Buildings

Each building consumes an existing system's output and produces an existing
system's input. A proposed building that fails that test does not belong here.

| Building | Consumes | Produces |
| --- | --- | --- |
| Smokehouse | Fish, roe | Cured fish: a meal fish raised an enchantment tier, so it feeds a run better |
| Forge | Scrap, rift shards | Artifact rerolls, and more scrap from a finished run's loadout |
| Tackle bench | Roe, timber, scrap | Bait and rod components that fishing cannot produce for itself |
| Rift anchor | Rift shards, Champion labour | Reduced Champion exhaustion over time: an exhausted Champion resting there recovers faster |
| Trophy hall | Bestiary and collection progress | Cosmetic and unlock rewards; see [contracts.md](contracts.md) |
| Storehouse | Timber and stone | Inventory capacity, and the accrual cap for offline production |
| Woodline and quarry | Champion labour only | Timber and stone |

The Smokehouse as built does two things. Gutting destroys a fish for roe, by
its rarity and size. Curing spends roe on a meal fish to raise its enchantment
a tier, Bright Scales to Deep Current to Astral Mark, and the run meal reads
that enchantment through the contract it already has: a cured fish is the same
fish with a stronger meal effect, so nothing new reaches the simulation. Rift
shards come out of the Abyss, one a completed floor and one more for every
five floors down, to six.

Every building but the Trophy hall is live, each upgraded with timber and
stone, the anchor and the Forge with rift shards and scrap as well. The Forge
rerolls an artifact's implicit and modifiers for scrap and shards, keeping its
base and rarity, and at its second and third levels raises the scrap a
finished run's loadout leaves behind by a quarter and by half. Slot and
storage upgrades stay with the Essence store, where artifact slots already
live. The Trophy hall waits on collections; see the delivery plan.

The Rift anchor deserves a note. It makes exhaustion a resource a player can
spend materials against rather than a wall they wait out, and it gives players
who dislike waiting a way past it that costs play rather than money. As built,
only an exhausted Champion can be sent there, and each hour it rests takes
minutes off its own timer at a rate the anchor's level and its labour sheet
set: thirty minutes an hour at level one, an hour an hour at level three, for
a sheet that multiplies to one. Relief is minutes off a timer that is already
running, so it shortens the wait and never removes it, and a Champion resting
at the anchor is a Champion not felling timber, which is the trade.

## Offline accrual

Production accrues while the player is away, with a hard cap set by the
Storehouse. The cap starts at roughly eight hours and grows to no more than
about twelve.

The cap is the whole design. A short cap makes the Camp a check-in that rewards
returning. An uncapped or very long accrual makes it a second job, punishes
players who cannot log in daily, and quietly becomes the dominant source of
everything.

Rules:

- Accrual is computed from server timestamps, never from client time.
- Claiming is a single idempotent server operation. A refresh, a retry, or two
  open tabs cannot claim twice.
- Nothing decays. Reaching the cap stops production; it never destroys stock.
- Production is computed on claim from the elapsed interval, not by a ticking
  job. There is no server-side timer per player.

## Construction and upgrades

Buildings are constructed and upgraded with timber, stone, and the material
their tier implies. Construction is instant in the first slices; taking real
time, gated by the same accrual model and shortened by assigning Champions
rather than by payment, is the design intent and waits on the delivery plan's
slice 3.

Building levels raise throughput and unlock recipes. A building level must
never raise a combat statistic.

## Presentation

The Camp is a screen like the pond, not a document. The scene fills the
viewport under the header and the HUD sits over it: the place's name and a
ledger of the Camp's materials across the top, a plot for every building on
the ground, and an inspector for the open building. On a desktop nothing
scrolls; on a phone the plots stand two abreast and the inspector is a sheet
over them, and the sheet alone may scroll, the way the pond's inventory drawer
does. Sizes are `clamp()` against `vh` so the plots survive a short viewport,
and the phone layout is one width breakpoint shared with the hub's.

A plot says at a glance what its building is doing: its level as pips, who is
working it, what is waiting to be claimed, whether it can be built. A
building's detail view is the inspector beside the plots, not a new screen and
not a scrolling document; if a building's content cannot fit the inspector,
the building is doing too much. The Trophy hall stands on the scene as a
footprint with nothing to build, so the settlement reads as unfinished.

Atmospheric motion only, with complete `prefers-reduced-motion` alternatives,
matching the rest of the hub.

### Theme: a working camp at the treeline after dark

Accepted as a first iteration on 2026-09-11 and given six more passes the
same day. Every visual decision on the screen derives from that one sentence, and
a later pass should improve the execution of it rather than mix in a second
idea.

- **The place is cold; the work is warm.** The Camp's accent world is moss and
  pine green, declared in `src/styles/screen-frame.css` beside the pond's cyan
  and the codex's violet. The only warm colour on the screen is light thrown
  by something that burns: a lantern by a door, the coals of the Forge, the
  Smokehouse's fire, the Claim button. This is the refuge's own rule, where
  the bonfire is the only warm light, carried out to the ground beyond it.
  The Rift anchor is the one exception and glows violet, because it is a
  piece of the Abyss and takes the Abyss's colour wherever it appears.
- **The scene has depth.** Four silhouettes stand one behind another in
  `CampScreen.tsx`: a far range under haze with the keep on its ridge, the
  hills, the pines and the cut hillside, and a stand of near pines at the
  front left that the Woodline stands against. Low mist drifts along the far
  edge of the ground, a moon hangs over the quarry, a pool lies at the front
  where the tackle bench stands, and a trodden path runs from the front of
  the ground up to the Storehouse and out from there to every other
  building, drawn in the same box the buildings are placed in so it goes
  from one door to the next.
  The ground is lit by the plots, not by the sky, and a fog darkens the front
  so the buildings read against something quiet. The stars are the refuge's.
- **Buildings are drawn, in one hand.** Every plot carries a picture from
  `CampBuildingArt.tsx`, on one shared viewbox and one shared ground line, in
  the flat silhouette style of the pond's fish and the bag's icons. Colour is
  kept to the lit parts; the rest is the same dark timber and stone the
  ground is made of. A standing building throws lantern light on its plot and
  its lights move (smoke rises, coals flicker, the rift orb pulses); a
  building at level zero is the same picture drawn faint and grey on a
  dashed, staked-out plot, so the player sees what could stand there.
- **Buildings stand on the ground; there are no cards.** A plot has no plate
  and no border. Its building stands on an ellipse of trodden earth with its
  name on a sign beneath, and the ground is the only shape: it takes an
  accent ring while the inspector is open and becomes a dashed, staked-out
  footprint while nothing stands there. On a desktop each building has a
  place on the ground, given as a share of it rather than a cell of a grid:
  the Woodline in the trees at the back left and the quarry at the hillside
  on the back right, the Storehouse between them at the top of the path,
  the anchor a little apart and lower, and the workshops along the front
  with the tackle bench at the water. The further off a building stands the
  smaller it is drawn. The places are chosen not to overlap at any width,
  and because they are shares of the ground they fit with the inspector
  open or closed. A phone is placed too, in two columns with the right one
  half a step lower than the left, so the buildings stand along a path that
  winds up between them rather than in a grid. A plot lifts on hover and
  carries a lantern-amber "Ready" tag pinned to its sign while something
  waits.
- **Things stand between the buildings, and more of them as the Camp is
  built.** A settlement has furniture in its gaps, drawn in
  `CampFurniture.tsx` in the same box the plots are placed in. A new Camp
  has a tent and one lantern post by the Storehouse. The rest waits for a
  building: a lantern on the front path once the tackle bench stands, a
  woodpile once the Smokehouse does, a lantern by the Forge once it is
  built, a cart at the fork once the Woodline is raised, a rail fence by
  the quarry once it is, and crates by the Storehouse door once it holds
  more. A phone shows only the two lanterns that fit between its columns.
- **Output is carried along the path.** While the Woodline or the quarry has
  output waiting, a figure walks the drawn path from that building to the
  Storehouse with a bundle on its shoulder (timber or stone, by the route)
  and back without one, turning at each end. The route is the path's own
  points as keyframes in shares of the ground, so it follows the path at
  any width. The haulers stand down under `prefers-reduced-motion`.
- **Champions are figures at the foot of the building.** Every job slot is a
  small figure on the building's ground line: a dark silhouette with a
  lantern in hand while the slot is filled, and a dashed outline while it is
  empty, so a free slot reads as a place to stand. A working figure walks
  its ground line, out and back with a pause and a turn at each end, the
  turn a flip so the lantern changes hands; two figures at one building walk
  different distances at different paces so they never move in step.
- **The ground is alive.** Fireflies drift and blink over the front of the
  ground and the mist moves; both stand still under `prefers-reduced-motion`.
- **The inspector is the same material as the plots,** a darker glass beside
  them on a desktop and a sheet rising over them on a phone, headed by the
  building's own picture and its level.
- **The chrome is timber and lantern light.** Erling found the first
  chrome, dark glass with a green line, uninteresting against the scene, so
  the fifth pass gave it the camp's own materials. A plank (dark timber,
  bevelled, with the off-white lettering a camp would paint on it) is
  declared once on the screen root and every board reads it: the sign
  under each building hangs on two nails and takes the accent as a frame
  while its inspector is open; the ledger of materials is one board with
  dividers rather than a row of pills; the side panel's heading is a plank;
  a Champion's class is its initial on a small round badge wherever a
  Champion is named. A lantern flickers beside the screen's title, and the
  Claim button breathes while something waits to be claimed.
- **The sheet is read as meters.** Wherever a Champion is offered for work,
  tempo, stamina, load and fit are four small bars filled across the range
  the formula can reach, amber at the top of it, so a row of Champions can
  be compared at a glance; the line of numbers still stands under them.
- **A building's inspector shows its whole climb.** The ladder of levels
  lists what each one does and costs, the ones already climbed lit, the
  next one priced against the bag with the Build or Upgrade button on its
  rung, and the building's own picture stands at the foot of the column
  with its light. The ladder is the reason to open a building that is not
  ready to be raised: it says what the building becomes.
- **Nothing on the ground moves when a building opens.** Erling found the
  first placed layout jarring: the inspector was a sibling of the ground, so
  opening a plot narrowed the ground and every building slid and shrank at
  once, the quarry by four hundred pixels at Full HD. On a desktop the side
  of the screen is therefore always occupied. With no building open it holds
  the roster, every Champion with its class and where it stands (working at
  the Woodline, resting at the anchor, available, exhausted) and what it has
  pending; a Champion at work opens its building from there. Opening a plot
  swaps the roster for the inspector in the same box, with a short fade, and
  the ground keeps its size. A phone has no side column: the inspector is a
  sheet over the plots and the roster is not shown.

The seventh pass closed the list. What a later one might take: the
buildings' pictures themselves could change with their level, and the
Trophy hall's footprint could become a building once Phase 10 gives it
something to hold.

## Design constraints

- The Camp never produces Essence, gear, artifacts, or Champions.
- No building output multiplies damage, health, or any other combat statistic.
- Every recipe, building, tier, and accrual rate lives in a data-driven
  registry with a stable ID.
- The simulation never reads Camp state. Camp output reaches a run only as an
  inventory item selected before the run, through the existing run-item
  contract in [run_items.md](run_items.md).
- A player who never opens the Camp can still complete the dungeon, the Abyss,
  and every collection.
- Champion labour must not create a reason to keep a Champion permanently out
  of the Abyss. If the best play is never to run the Abyss again, the job
  rewards are too strong.
