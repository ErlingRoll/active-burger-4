# The Camp: delivery plan

> **Status:** Proposal, written 2026-09-11 against the code as it stood that day.
> **Design:** [camp.md](camp.md) says what the Camp is. This document says how to
> build it, in what order, and which decisions are still open.

The Camp is Phase 12 of the [implementation plan](implementation_plan.md).
Its foundation already shipped: scrap has a source (dungeon gear salvage) and
a sink (the workbench recipes), and the quartermaster's shop exists so material
prices exist before material production does. What remains is the idle layer
itself: Champion labour, accrual, claiming, and the buildings.

## What the Camp is built on

The plan leans on code that exists, so each slice is wiring rather than
invention.

- **The hub is DOM and CSS, not Pixi.** `src/hub/AdventureHubScene.tsx`
  draws the fire, the descent and the visitors as positioned elements inside
  `.hub-camp`, with a HUD layer of panels over it. The station rail
  (`.hub-utility-stations`) holds five buttons; a sixth is the Camp's door.
  On a phone the HUD becomes a bottom sheet with hand-ordered panels, and the
  hub is a document screen, so it may scroll there.
- **Inventory is server-authoritative and idempotent.** Every write goes
  through a security-definer RPC that claims an `inventory_operations` row by
  operation id, and grants happen only inside the server through
  `grant_inventory_items`. The Camp's claim follows that pattern exactly; it
  never needs a client-callable grant.
- **Materials are items.** `scrap` is the only `material` today. Timber and
  stone are two more rows in `inventory_item_definitions` and two entries in
  `src/inventory/ItemDefinitions.ts`; no schema change.
- **Recipes are a server table with a client mirror.** `craft_inventory_item`
  takes one input and one output. The tackle bench needs multi-input recipes,
  which is a small widening of that table, not a new system.
- **Champions have no job column.** The `champions` table stores
  `exhaustion_until` and a `build` snapshot. The Abyss exhausts a Champion
  through a trigger on the run's start snapshot. The floor a Champion was won
  on is not in the snapshot, but `dungeon_runs.max_floor` is reachable through
  `source_run_id`.
- **Server time is already the clock.** `begin_fishing_attempt` returns
  `server_time` and the client converts deadlines into its own clock. The Camp
  does the same for accrual previews.

## Decisions to settle first

Each has a recommendation. Say no to any of them and the slices below still
hold; only the estimates move.

1. **Assignments live in their own table**, `camp_assignments`, keyed by
   Champion, rather than a column on `champions`. It keeps the roster RPCs
   untouched, cascades when a Champion is archived, and has room for the
   fields a job needs (aptitude, the accrual clock).
2. **Unassigning settles production.** Taking a Champion off a job claims
   what it produced into the inventory as part of the same operation. Nothing
   is forfeited, and the player never has to remember to claim before
   reassigning. This is the choice that keeps assignment "free and instant".
3. **Construction is instant in the first slices.** Paying timber and stone
   raises a building's level immediately. Timed construction shortened by
   labour is real design intent in camp.md, but it is a second accrual model
   on top of the first, and it can be added in its own slice once the first
   one has been played.
4. **The first sink for timber and stone is the Storehouse.** "Sinks before
   faucets" means the Woodline and quarry cannot ship without a consumer, and
   the Storehouse is the one every player wants: it raises the accrual cap.
   The tackle bench follows as the second sink.
5. **Aptitude is snapshotted at assignment.** Class affinity and source-run
   depth are resolved once, when the Champion is assigned, and stored on the
   assignment row. Claims then read a number rather than re-deriving it, and
   a later balance change never rewrites production that already happened.
6. **The Camp opens as a panel on the hub, not as buildings drawn in the
   scene.** A "Camp" station opens a panel in the HUD (a sheet on a phone),
   in the shape of the expedition panel. Drawing the woodline and quarry into
   the scene is worth doing, but after the loop is played and the visuals can
   be judged on their own.
7. **Media queries are allowed.** camp.md's "adapt without width breakpoints"
   predates the change of rule on 2026-09-09; the hub itself uses a phone
   breakpoint. Update that sentence when the Camp ships.

## Data model

Reference data, readable by every signed-in player:

```text
camp_building_definitions   id, name, sort_order, active
camp_building_levels        building_id, level, cost jsonb, accrual_cap_hours,
                            rate_multiplier, job_slots
camp_job_definitions        id, building_id, output_definition_id,
                            base_rate_per_hour, active
```

Per player, select-only under RLS, written only by RPCs:

```text
camp_buildings      profile_id, building_id, level                 pk (profile_id, building_id)
camp_assignments    profile_id, champion_id, job_id, aptitude,
                    assigned_at, accrued_from                      pk champion_id
```

`accrued_from` is the accrual clock. It is the moment from which unclaimed
production is measured, and it advances only by the time a claim actually
paid for. Claims go through `inventory_operations` under a new
`operation_type`, `camp-claim`, so the check constraint is widened a third
time.

### Accrual, in one place

The arithmetic is a pure function, mirrored in SQL and in
`src/content/camp/CampAccrual.ts`, and the TypeScript version is the one the
tests pin down.

```text
rate           = base_rate_per_hour × rate_multiplier(level) × aptitude
elapsed_hours  = min(now − accrued_from, accrual_cap_hours)
units          = floor(rate × elapsed_hours)
paid_hours     = units / rate
accrued_from   = now − (elapsed_hours − paid_hours)
```

Three properties fall out of that and become tests:

- Claiming twice in a row pays nothing the second time.
- Claiming at two points pays the same total as claiming once at the second
  point, because the unpaid fraction of an hour carries forward.
- Past the cap, waiting longer pays nothing more, and nothing is lost.

### Aptitude

```text
aptitude = 1.0
         × (1.25 if the class has affinity with the job, else 1.0)
         × (1 + 0.02 × max(0, source_run.max_floor − 10)), capped at 1.30
```

A modest multiplier, never a gate, as camp.md asks. The class affinity table
is content (`src/content/camp/CampAptitude.ts`): Knight and War Shepherd to
the quarry, Ranger and Riftwalker to the woodline, Frost Warden and Ashen
Alchemist to the smokehouse when it exists, Necromancer and Bloodweaver to
the rift anchor when it exists.

### RPCs

| RPC | Does |
| --- | --- |
| `get_camp_state()` | Buildings, assignments, each job's pending units, and `server_time`. |
| `assign_champion_to_camp_job(op, champion, job)` | Owner check; not archived; not in an active or paused run; a free slot at the job; snapshots aptitude; starts the clock. |
| `unassign_champion_from_camp(op, champion)` | Settles the Champion's production through the claim path, then deletes the row. |
| `claim_camp_production(op)` | One operation for every job; grants each output under `op || ':' || definition_id`; returns what was paid and `server_time`. |
| `upgrade_camp_building(op, building)` | Consumes the level's cost oldest-stack-first, as `craft_inventory_item` does; raises the level. |

Two existing RPCs gain a hook. `archive_champion` and the replacement path in
`create_champion_from_run` must settle and remove an assignment before the
Champion goes. And the Abyss must refuse an assigned Champion: extend
`apply_abyss_champion_exhaustion` to raise when the Champion has a
`camp_assignments` row, so the lockout holds even if a client skips the
check.

## Client

```text
src/content/camp/        CampBuildings.ts, CampJobs.ts, CampAptitude.ts,
                         CampAccrual.ts (+ tests)          registries, pure
src/camp/                CampTypes.ts, CampService.ts (+ test),
                         CampPanel.tsx (+ test), CampJobCard.tsx,
                         CampChampionPicker.tsx
src/inventory/           timber and stone definitions, MaterialIcon glyphs
src/services/            a camp ServiceHandle on AppServices
src/hub/                 a sixth station and the panel's mount point
src/characters/          "Working · Woodline" on the availability pill
src/app/screens/         run setup excludes working Champions from the Abyss
```

The panel is a HUD panel on the desktop and a sheet on a phone, and it holds:
one card per building with its level, its jobs and their assigned Champions,
the pending output per job counting up on the client from `server_time`, one
Claim button for the whole Camp, and an upgrade row showing the next level's
cost against what the bag holds. The Champion picker lists the roster with
the same availability pill the champions page uses, and an exhausted Champion
is pickable, because exhaustion blocks the Abyss and not labour.

## Slices

Each slice is a commit series on main that leaves the game whole, with lint,
the unit suite and the build green, and the screens checked by screenshot at
390×844 and 1920×1080.

### Slice 0: foundations

Timber and stone as items on both sides; the reference tables and their seed
rows; the `camp-claim` ledger type; the content registries; the accrual and
aptitude functions with their tests. No UI. Ships with the Storehouse level
table so the materials have a named sink from the first commit.

### Slice 1: labour

The per-player tables and the five RPCs; the Camp service; the hub station
and panel with the Woodline and the quarry at level 1, the Storehouse at
level 1 with an eight-hour cap; assign, unassign and claim; the Abyss lockout
on the server and in run setup; the job shown on the champions page. This is
the slice to play before anything else is decided, because it is where the
loop either feels like a check-in or does not.

### Slice 2: construction

`upgrade_camp_building`; Storehouse levels 2 and 3 raising the cap to ten and
twelve hours; Woodline and quarry levels raising the rate and adding a second
slot; the tackle bench with multi-input recipes that spend timber alongside
scrap, so the bench is cheaper in scrap than the workbench for the same bait.
The recipe table gains a `inputs jsonb` column and the craft RPC consumes
each input in turn. The client recipe registry is brought back in line with
the server's three rows while it is being touched.

### Slice 3: timed construction (optional)

Construction takes real time and Champions assigned to a building site
shorten it. Same accrual model, applied to a `completes_at` on
`camp_buildings`. Only worth doing if slice 1 shows players returning on the
cap's rhythm; if they do not, time on construction is a wall rather than a
rhythm.

### Later, each behind its own prerequisite

- **Rift anchor** needs rift shards, which need a source: Abyss floor boxes.
- **Smokehouse** needs roe, which needs gutting: an inventory operation that
  destroys a fish and grants roe by rarity and size.
- **Forge** needs artifacts (Phase 9).
- **Trophy hall** needs collections (Phase 10).

## Opening numbers

Proposals to tune, not decisions. The target is that one Champion on one job
fills a Storehouse upgrade in about two days of check-ins, and that a full
roster on the Camp still cannot out-produce a single Abyss run's worth of
value.

| Thing | Value |
| --- | --- |
| Accrual cap | 8 h at Storehouse 1, 10 h at 2, 12 h at 3 |
| Woodline, level 1 | 4 timber per hour per Champion, 1 slot |
| Quarry, level 1 | 4 stone per hour per Champion, 1 slot |
| Level 2 of either | ×1.5 rate, 2 slots, costs 40 timber and 40 stone |
| Storehouse 2 | 48 timber, 48 stone |
| Storehouse 3 | 120 timber, 120 stone, 40 scrap |
| Tackle bench 1 | 40 timber, 20 stone |
| Bench recipe | 5 timber and 4 scrap for one River Worm, against 8 scrap at the workbench |

## Verification

- Accrual and aptitude: unit tests on the pure functions, including the three
  properties above.
- Service: stubbed `rpc` calls asserting the exact argument bag, as
  `ShopService.test.ts` does.
- Panel: a component test that assigns, claims and reads the toast.
- Migrations: `npm run supabase:validate` locally with Docker; CI applies the
  whole history and lints it on every push to main.
- Screens: `npm run screenshot -- --path dashboard` at both viewports with
  the panel open, and no end-to-end runs unless asked.

## Risks

- **Two tabs.** Both claim; the ledger pays once and the second tab receives
  the first tab's result with `was_processed = false`.
- **Clock skew.** The client counts up from `server_time`, never from its own
  clock, and the server recomputes on claim.
- **A Champion leaves while working.** Archive, roster replacement and Abyss
  start all pass through the assignment table before they proceed.
- **The Camp becomes the reason not to run the Abyss.** The cap and the rates
  are the lever; slice 1 is the measurement.

## Documents to update when it ships

- `camp.md`: the breakpoint sentence, and the building table to match what
  exists.
- `implementation_plan.md`: the Phase 12 checklist.
- `IMPLEMENTATION_CHECKLIST.md`: a milestone 31 line.
- `economy.md`: timber and stone move from "proposal" to "live".
