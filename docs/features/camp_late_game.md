# The Camp after the last upgrade

> **Status:** Proposal, 2026-09-13. Nothing here is built.
> **Design:** [camp.md](camp.md) says what the Camp is and
> [camp_delivery_plan.md](camp_delivery_plan.md) says how it was built. This
> document says what keeps the Camp worth opening once every level in the
> building table is bought.

## The problem

The Camp as built is a closed loop with itself. The Woodline and the quarry
make timber and stone. The only things that spend timber and stone are the
buildings, plus two bait recipes that spend a little timber. Once every level
is bought, stone has no sink at all and timber has a small one. The
cross-system buildings, the Rift anchor, the Smokehouse, the Forge, the
tackle bench and the Trophy hall, are one-shot purchases: after construction
the Camp's only ongoing outputs are bait, cured fish, reforged artifacts and
exhaustion relief, and none of those spends what the Woodline and the quarry
make.

The table is also short. Storehouse 3, Woodline 2, quarry 2, anchor 3,
Forge 3, bench 1, Smokehouse 1, Trophy hall 1. A player who checks in on the
cap's rhythm is done in a couple of weeks, and then their Champions are idle
again, which is the dead end the Camp was built to remove.

The contracts board, shipped 2026-09-13, makes this sharper rather than
softer. Half the pool pays timber and stone, so the two materials now have a
second faucet and still the one finite sink. Rule 4 of
[economy.md](economy.md) names the result: a material with no sink
accumulates until it reads as broken. Stone reaches that state the day the
last building is raised.

## The principle

Do not extend the ladder. More levels delay the problem by a week a level, and
a long ladder is the second job the accrual cap was designed to prevent.

The Camp already has the rule that should carry it: every building consumes an
existing system's output and produces an existing system's input. What is
missing is not height but steady state. Construction is the Camp's onboarding.
Production has to be the game, and production is only a game if the dungeon,
the Abyss and fishing keep needing what the Camp makes every day.

So the plan has three parts, in the order they should ship, and one candidate
held back until the first three have been played.

1. Timber and stone get sinks that never close.
2. Every building gets a job, so the roster stays the reason to open the Camp.
3. Work orders, the Camp's face of the contracts board, give the sinks a
   reason on a rotating schedule.
4. Expeditions, the candidate: Champions leave the Camp and come back with a
   haul.

Each part passes the resource-graph test on its own, and each holds to the
constraints camp.md already sets: no combat statistic, no Essence, no
Champions, no gear, nothing the simulation reads, nothing that punishes
absence.

## Part 1: sinks that never close

### Provisions, a run-item category made at the Camp

[run_items.md](run_items.md) lists utility items as the next category after
the fish meal and asks that a category not be added until its source,
inventory behaviour, effect duration, duplicate handling and sink are defined.
They are defined here.

A **provision** is a stackable inventory item crafted at a Camp building from
timber, stone and one refined input, and selected before a run in the same
picker as the meal. It is consumed at run start through the existing pre-run
contract, its resolved effect is written into the run snapshot, and the
simulation reads only that snapshot. A provision never multiplies damage,
health or any other combat statistic; it changes what a run offers, in the
terms economy.md allows: options, capacity, access and time.

| Provision | Crafted at | Costs | Effect on the run |
| --- | --- | --- | --- |
| Torch bundle | Woodline | Timber | One extra choice on every gear or skill offer for the run |
| Whetstone | Quarry | Stone, scrap | One extra reroll of an offer, once a floor |
| Cairn stone | Quarry | Stone | One more floor box roll at a milestone floor; the box rarity table is unchanged |
| Rift lantern | Rift anchor | Timber, rift shards | An Abyss attempt shows the next floor's modifier offer one floor early |

One slot for provisions on a run to begin with, so the picker never becomes a
loadout screen and the strongest provision is a choice rather than a stack.
Duplicate handling is the same as for materials: they stack. The sink is the
run itself. Unused provisions sit in the bag; nothing expires.

The Torch bundle and the Whetstone are the two to ship first. They cost only
what the Camp makes plus scrap, they touch the offer flow that already has a
reroll concept, and neither changes a number in the damage pipeline.

Why this is the right sink: it is the one that makes a dungeon-only player
want the Camp without making the Camp mandatory. A run without a provision is
the run every player has today.

### Stone at the Forge

The Forge is live and `reforge_artifact` prices a reroll in scrap and rift
shards by rarity. Adding stone to that price is a one-row change to the
reforge cost table and gives the quarry a purpose for as long as artifacts are
rerolled. It is the cheapest sink in this document and should ship with, or
before, the first provision. The Forge's own level table stays as it is.

### What is deliberately not a sink

- **The quartermaster buying timber and stone.** It would make the Camp an
  Essence faucet, which economy.md forbids in as many words. If it ever buys
  them, the band is priced so low that selling reads as tidying, not farming.
- **Upkeep.** No building falls into disrepair. Economy.md bans timers that
  punish absence, and upkeep is exactly that.

## Part 2: every building has a job

The labour sheet already knows more jobs than the jobs table does. The
delivery plan derives fit for Scholar gear and fire skills at the Smokehouse
and the Forge, and the sheet's tempo, load and stamina are meaningful at a
bench as much as at a treeline. Three jobs are live; the sheet was built for
six. Filling the table is the cheapest way to keep the roster the reason to
open the Camp.

| Job | Building | Consumes | Produces | Fit |
| --- | --- | --- | --- | --- |
| Tend the smoke | Smokehouse | Stocked fish | Roe an hour, from a queue the player fills | Scholar, `fire`, `dot` |
| Work the bench | Tackle bench | Stocked timber and scrap | Bait an hour, up to the cap, from the recipe the player chose | Scholar, `trigger`, `projectile` |
| Stoke the Forge | Forge | Stocked scrap | Forge heat: each unit is a discount on the next reforge's scrap, never its shards or stone | Giant, `fire`, `physical` |

Two rules keep these honest.

**A job at a crafting building only ever runs a recipe the player could run by
hand.** The Smokehouse job guts fish the player queued; it never chooses a
fish. The bench job crafts the bait the player chose, from inputs the player
stocked. The Forge job never rerolls anything; it only makes the reroll the
player asks for cheaper in the one material that is never scarce. Labour buys
time, never a result the player could not buy with a click. That keeps every
building skippable and keeps a job from becoming a second recipe table.

**A job's units follow the accrual model exactly.** Rate times elapsed, capped
by stamina and the Storehouse, settled on claim, paid from the inputs the
player stocked. The existing `camp_accrue` twin handles it; what is new is
that a claim consumes stocked inputs as it grants, which the upgrade RPC
already does for a level's cost. A job that runs out of inputs stops, and the
building's inspector says why.

The data model needs one thing: a `camp_stock` row per building holding what
the player has put in for the job to work on. Stocking and unstocking are
inventory operations, so nothing is created or lost between the bag and the
building, and a Champion unassigned mid-queue leaves the stock where it is.

Jobs bring the Camp's slot count to a number that matters against a roster of
ten. That is the point. A player choosing who works the smoke, who fells
timber, who rests at the anchor and who descends is the decision camp.md asks
for, and it never ends, because the Abyss keeps exhausting Champions and runs
keep making new ones.

## Part 3: work orders

The contracts board is live, and every objective in its pool reads play that
already happened: floors descended, fish caught, materials gathered. A **work
order** is a contract of the opposite shape. Its objective is a delivery made
at the Camp, and the delivery is what the contract consumes.

- One work order among the daily slots, rolled from the buildings the account
  has built, so a player without a Smokehouse never sees a cured fish order.
- Delivery is an inventory operation, `contract-deliver`, that destroys the
  delivered stack. Progress stays computed rather than stored, as the
  contracts plan requires: the objective counts deliveries in the ledger
  against the assignment, and the claim reads the same rows.
- A work order never pays the material it takes. One that takes stone pays
  scrap, shards, a box or a cosmetic; the pool's existing rule that a repeat
  pays half applies unchanged.
- No streaks. An undelivered order rotates away, and stock delivered toward
  it is gone, which is the sink, so the board says plainly what a delivery
  costs before it is made.

The contracts row of the resource graph consumes nothing today. Work orders
are what make it consume, and they are the rotating sink for timber and stone
that never closes. What the Camp adds is a Deliver button on the building's
inspector and one objective in the pool; the registry, the rotation and the
idempotent claim are the board's.

## Part 4, the candidate: expeditions

Held until parts 1 to 3 have been played, because it is the one part that
makes the Camp produce things other systems already produce, and rule 1 of
economy.md, that no system is the best source of what it consumes, is the
rule this would break first.

A Champion is sent out from the Camp for a fixed number of hours and returns
with a themed haul. Provisions are the fare: an expedition costs timber and
stone as supplies, and a provision changes what the Champion brings back.

| Expedition | Hours | Supplies | Returns with |
| --- | --- | --- | --- |
| The treeline | 4 | Timber | Roe, a common box, rarely a rod |
| The cut | 8 | Stone | Scrap, an uncommon box |
| The rift's edge | 12 | Timber, stone, a Rift lantern | One or two rift shards, rarely a rare box |

The same accrual model applies, with `completes_at` on the assignment instead
of a rate, and an expedition is claimed on return. An exhausted Champion can
go, because exhaustion blocks the Abyss and not labour. The labour sheet
decides the haul's size and bonus chance the way it decides a claim's.

The tension it adds is the good kind: a Champion on a twelve hour expedition
is not resting at the anchor, not felling timber and not descending. The
haul's value has to sit well under one completed Abyss floor's, and the shard
expedition should pay a fraction of what a floor pays, so the Abyss stays the
only real source. If that tuning cannot be found, the expedition drops shards
and keeps boxes and roe.

## What is not in this plan

- **More building levels.** Not because levels are wrong, but because they
  are the cheapest thing to add later once a sink exists to justify them. A
  Woodline 3 that feeds a Torch bundle recipe is worth having; a Woodline 3
  that only feeds Storehouse 4 is a week's delay.
- **Timed construction (slice 3 of the delivery plan).** It is still optional
  and still only worth doing if players return on the cap's rhythm. Nothing
  here depends on it.
- **Prestige or re-founding a building at max.** A real idea, and the natural
  place for a choice at the top of the table, but it is a fourth accrual
  variant and should wait until the first three are in.
- **Retuning the contract pool away from timber and stone.** Tempting, but
  it treats the faucet as the problem when the sink is. Once work orders
  exist the board can pay and take the same materials on different days,
  which is the rhythm a board should have.
- **Decay, upkeep, or anything lost by missing a day.**

## Resource graph, after this plan

| System | Produces | Consumes |
| --- | --- | --- |
| Dungeon run | Essence, a Champion on victory, scrap, boxes | Fish meal, provisions, artifacts |
| Infinite Abyss | Rift shards, one box per floor, standing | A Champion, artifacts, fish meal, provisions |
| Fishing | Fish, roe, rods, boxes | Bait |
| Camp | Provisions, bait, cured fish, roe, reforged artifacts, capacity, exhaustion relief | Scrap, roe, rift shards, timber, stone, Champion labour, stocked inputs |
| Contracts | Materials, boxes, cosmetics | Work-order deliveries: timber, stone, cured fish, bait |
| Expeditions, if built | Roe, scrap, boxes, a few shards | Timber, stone, provisions, Champion time |

Timber and stone now have five consumers that never close: provisions, the
Forge's reroll price, jobs that run on stocked inputs, work orders, and
expedition supplies. Stone alone reaches the Whetstone, the Cairn stone and
the Forge the day the quarry opens.

## Data model

Reference data, in the pattern the existing tables set:

```text
camp_provision_definitions   id, building_id, inputs jsonb, effect_id, effect_value
camp_job_definitions         + input_definition_id, input_per_unit     for stocked jobs
contract_definitions         + objective 'deliver-items', parameter {definitionId}
camp_expedition_definitions  id, hours, supplies jsonb, haul jsonb        part 4
```

Per player, written only by RPCs:

```text
camp_stock          profile_id, building_id, definition_id, quantity     pk (profile_id, building_id, definition_id)
camp_assignments    + completes_at                                       part 4
```

Provisions are inventory items with a `provision` category and a definition
in `src/inventory/ItemDefinitions.ts`. The run-start RPC gains a `provisions`
argument beside the meal, validates and consumes it the same way, and writes
the resolved effect into the snapshot. The simulation reads the snapshot's
resolved provision effects through the same run-item contract the meal uses.

RPCs, in the pattern of the ones that exist:

| RPC | Does |
| --- | --- |
| `stock_camp_building(op, building, definition, quantity)` | Moves a stack from the bag into a building's stock. |
| `unstock_camp_building(op, building, definition, quantity)` | The reverse. |
| `claim_camp_production(op)` | Unchanged in shape; a stocked job's claim consumes stock as it grants. |
| `craft_inventory_item` | Unchanged; provision recipes are rows with a `camp_building_id`. |
| `reforge_artifact` | Unchanged in shape; the price table gains stone, and a Forge-heat balance discounts the scrap. |
| `deliver_to_contract(op, assignment, quantity)` | Part 3; destroys the stack under `contract-deliver` and the objective counts it. |
| `send_champion_on_expedition(op, champion, expedition)` | Part 4; consumes supplies, sets `completes_at`. |

## Slices

### Slice A: stone at the Forge, and provisions

Stone in the reforge price first, because it is one row and one test. Then
the `provision` category and two definitions, the Torch bundle and the
Whetstone; their recipes at the Woodline and the quarry; the run-start
argument and snapshot field; the picker slot beside the meal; the offer flow
reading the snapshot for an extra choice and a reroll. This is the slice to
play first, because it is the one that tells us whether a dungeon-only player
opens the Camp for it.

### Slice B: stocked jobs

`camp_stock` and the two stocking RPCs; the Smokehouse, bench and Forge jobs
with their fit; the claim consuming stock; the inspector's stock row and the
"out of inputs" state. The registry test and the fixture set gain the three
jobs.

### Slice C: work orders

The `deliver-items` objective and the `contract-deliver` ledger type; a
handful of work orders in the daily pool, each requiring the building it
delivers to; a Deliver button on the inspector. The contract registry test
covers the new rows the way it covers the rest.

### Slice D: expeditions, if A to C leave the Camp still reading as maintenance

The definitions, `completes_at`, the send and claim path, and the tuning pass
against Abyss floor value.

## Opening numbers

Proposals to tune. The rule from the delivery plan holds: a full roster on
the Camp still cannot out-produce one Abyss run's worth of value.

| Thing | Value |
| --- | --- |
| Stone in a reforge | 10 · 20 · 40 · 80 · 160 by rarity, beside the scrap and shards already asked |
| Torch bundle | 20 timber, 4 scrap; one a run |
| Whetstone | 20 stone, 8 scrap; one a run |
| Cairn stone | 40 stone; one a run |
| Rift lantern | 30 timber, 3 rift shards; one an Abyss attempt |
| Tend the smoke | 2 fish gutted an hour at tempo ×1, from stock |
| Work the bench | 1 bait an hour at tempo ×1, from stock, the recipe chosen by the player |
| Stoke the Forge | 4 heat an hour at tempo ×1 from 1 scrap each; a unit of heat is a scrap off the next reforge, to half its scrap price |
| Work order | 60 to 120 timber or stone, or 3 to 6 cured fish, for scrap, 2 shards or a box |
| Expedition haul | Under half of one completed Abyss floor's value |

## Decisions to settle first

Each has a recommendation. Say no and the slices still hold; only the
estimates move.

1. **Provisions are one slot, not five.** The meal already has five slots and
   family caps; a second five-slot picker makes preparation a chore.
   Recommend one, and raise it only if a second provision family appears.
2. **A stocked job never chooses.** The player queues fish and picks the bait
   recipe; labour only runs the clock. Recommend keeping this rule absolute,
   because the moment a job picks the best fish it becomes a gate on
   knowledge the player should be exercising.
3. **The Camp does not produce rift shards until expeditions prove they can
   pay under a floor.** Recommend holding that line through slices A to C.
4. **Any Champion works any job stays true.** The new jobs have fit sets and
   tags like the old ones, capped at the same ×1.25, and no job is closed to
   any Champion. Recommend no change to the bound.
5. **The offer flow reads provisions from the snapshot only.** The extra
   choice and the reroll are numbers on the run's start snapshot, in the same
   place the meal's resolved effects live. Recommend no new path into the
   simulation.
6. **A work order takes what the board pays, on a different day.** The pool
   already pays timber and stone; work orders take them back. Recommend
   leaving the pool's rewards alone and letting the two shapes of contract
   set the rhythm between them.
