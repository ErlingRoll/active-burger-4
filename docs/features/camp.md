# The Camp

## Purpose

The Camp is the idle layer of the game and the hub of its economy. It is where
materials produced by runs, the Abyss, and fishing are refined into the inputs
those same systems consume.

It is deliberately not a separate game. It is a set of stations on the existing
Adventure Hub scene, described in [dashboard_hub.md](dashboard_hub.md), which
already renders a night-time camp with a fire, a dungeon gate, and the other
players currently present.

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
| Forge | Scrap, rift shards | Artifact rerolls, better gear salvage yield, slot and storage upgrades |
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

The Storehouse, the Woodline, the quarry, the tackle bench, the Rift anchor
and the Smokehouse are live, each upgraded with timber and stone, the anchor
with rift shards as well. The Forge waits on artifacts and the Trophy hall on
collections; see the delivery plan.

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

The Camp is part of the hub scene and follows the hub's rules, not a
document's rules. On a desktop it must fit the viewport without scrolling,
including its station panels; on a phone the hub is a document and the Camp
is one more sheet in its dock. Intrinsic layout first: wrapping flex rows
with `flex: 1 1 min(<ideal>, 100%)` bases, `width: min(100%, <cap>)`, auto-fit
grids, and `clamp()` sized against `vh` for anything that has to survive a
short viewport. The hub's phone breakpoint is the one width breakpoint, and
the Camp shares it.

A building's detail view is a panel or a sheet, in the same shape as the in-run
HUD inspector, not a new full screen and not a scrolling document. If a
building's content cannot fit a panel, the building is doing too much.

Atmospheric motion only, with complete `prefers-reduced-motion` alternatives,
matching the rest of the hub.

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
