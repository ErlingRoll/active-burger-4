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

### Champion aptitude

A job's output scales with something already stored in the Champion snapshot,
so no new player-facing stat is invented. Use the class affinity and the floor
the Champion was created on. A Frost Warden works the smokehouse better than
the forge; a Champion from a deep clear works any job better than one from a
shallow clear.

Aptitude is a modest multiplier, not a gate. Any Champion can work any job. The
purpose is to make a varied roster slightly better than a stack of clones, not
to lock a player out of a building because they have the wrong class.

## Buildings

Each building consumes an existing system's output and produces an existing
system's input. A proposed building that fails that test does not belong here.

| Building | Consumes | Produces |
| --- | --- | --- |
| Smokehouse | Fish, roe | Preserved meals: longer or combined fish effects for a run |
| Forge | Scrap, rift shards | Artifact rerolls, better gear salvage yield, slot and storage upgrades |
| Tackle bench | Roe, timber, scrap | Bait and rod components that fishing cannot produce for itself |
| Rift anchor | Rift shards, Champion labour | Reduced Champion exhaustion over time |
| Trophy hall | Bestiary and collection progress | Cosmetic and unlock rewards; see [contracts.md](contracts.md) |
| Storehouse | Timber and stone | Inventory capacity, and the accrual cap for offline production |
| Woodline and quarry | Champion labour only | Timber and stone |

The Rift anchor deserves a note. It makes exhaustion a resource a player can
spend materials against rather than a wall they wait out, and it gives players
who dislike waiting a way past it that costs play rather than money. Cap the
total reduction so it shortens the wait and never removes it.

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
their tier implies. Construction takes real time, gated by the same accrual
model, and can be shortened by assigning Champions rather than by payment.

Building levels raise throughput and unlock recipes. A building level must
never raise a combat statistic.

## Presentation

The Camp is part of the hub scene and follows the hub's rules, not a
document's rules. It must fit the viewport without scrolling, including its
station panels, and it must adapt without width breakpoints. Use intrinsic
layout: wrapping flex rows with `flex: 1 1 min(<ideal>, 100%)` bases,
`width: min(100%, <cap>)`, auto-fit grids, and `clamp()` sized against `vh` for
anything that has to survive a short viewport.

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
