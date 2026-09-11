# The Camp: delivery plan

> **Status:** Slices 0, 1 and 2, the Rift anchor, the Smokehouse and the Forge shipped 2026-09-11 and 2026-09-12; slice 3 and the Trophy hall are still proposals.
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
- **A Champion is a build the server can read.** The `champions` table stores
  `exhaustion_until` and a `build` snapshot: the level, the skills with their
  levels, the chosen upgrades, six equipment slots each with a rarity, rolled
  modifiers stored as stat and value pairs and a set id, the behaviour
  profile and the target priority. The Abyss exhausts a Champion through a
  trigger on the run's start snapshot, and that trigger already raises when
  the Champion is unavailable. The floor a Champion was won on is not in the
  snapshot, but `dungeon_runs.max_floor` is reachable through `source_run_id`.
- **Server time is already the clock.** `begin_fishing_attempt` returns
  `server_time` and the client converts deadlines into its own clock. The Camp
  does the same for accrual previews.

## The principle: a Champion works with the numbers it fights with

The Camp must not reduce a Champion to its class. The level, the gear and the
build are what the player earned in the run that won the Champion, and they
have to matter again every time the player decides who works and who
descends. So the Camp derives a **labour sheet** from the same resolved
strength the Champion fights with, and skill tags only decide where it
shines.

| From the build | Drives at the Camp | Why it reads right |
| --- | --- | --- |
| Attack speed | **Tempo:** the production rate | A fast fighter is a fast worker |
| Max HP | **Stamina:** that Champion's accrual cap | Hours before it downs tools |
| Attack damage | **Load:** extra units per claim | Hauls more per trip |
| Critical chance | Chance a claim pays a bonus stack | The same feel as a crit |
| Movement speed | Construction time, when slice 3 lands | Fetches faster |
| Level and source floor | A flat multiplier on everything | A veteran is better at all of it |
| Gear set | The job it is built for | Giant to the quarry, Splintering to the woodline, Scholar to the smokehouse and forge recipes, Astral to the rift anchor |
| Gear rarity per piece | How strong the set's bonus is | A legendary Giant piece counts for more than a common one |
| Skill tags, weighted by level | A smaller fit bonus per job | Fire hands at the smokehouse, summons as extra hands, cold for longer storage |
| Behaviour profile | Trades tempo against stamina | Aggressive burns fast, cautious lasts |

Two Knights with the same skills now differ because one wears a legendary
Giant set with forty percent attack speed on its gloves, and the player can
see that before assigning either.

### Proportions

The sheet is a sidegrade, and these bounds keep it one:

- Strength from level and gear carries most of the spread, about ×1.0 to
  ×1.6 on tempo and load.
- Set and tag fit adds up to ×1.25, on the matching job only.
- The behaviour profile moves one knob against the other: aggressive is
  +20% tempo and −25% stamina, cautious the reverse, balanced neither.
- Everything multiplied together is capped at ×2.0. The sheet carries that
  product as its `output`, and accrual reads only that figure.
- Stamina is clamped between six and twelve hours, so the Storehouse cap is
  still the ceiling and a strong roster cannot out-produce the Abyss.

A consequence to accept on purpose: the best Abyss build is also a fine
worker, so there is real tension when it comes off exhaustion. That is the
decision camp.md asks for, and the cap is what keeps it a decision rather
than a trap. If Camp strength should diverge from Abyss strength later, the
lever is to weight stamina and load above tempo, because deep Abyss builds
are usually built for tempo.

## Decisions to settle first

Each has a recommendation. Say no to any of them and the slices below still
hold; only the estimates move.

1. **Assignments live in their own table**, `camp_assignments`, keyed by
   Champion, rather than a column on `champions`. It keeps the roster RPCs
   untouched, cascades when a Champion is archived, and has room for the
   labour sheet and the accrual clock.
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
5. **The labour sheet is snapshotted at assignment.** The assign RPC derives
   it from the build on the server and stores it on the assignment row.
   Claims then read numbers rather than re-deriving them, and a later balance
   change never rewrites production that already happened.
6. **The Camp is a screen of its own, with a plot for every building.**
   It shipped first as a panel on the hub, in the shape of the expedition
   panel, and moved to its own screen on 2026-09-11 once the loop had been
   played: the hub's "Camp" station now walks out to it, the way the pond's
   does, and each building stands on a plot with its own picture, level and
   status, opening an inspector beside the plots (a sheet on a phone).
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
                            base_rate_per_hour, fit_set_id, fit_tags text[], active
camp_skill_tags             skill_id, tag              seeded from the skill registry
```

Per player, select-only under RLS, written only by RPCs:

```text
camp_buildings      profile_id, building_id, level                 pk (profile_id, building_id)
camp_assignments    profile_id, champion_id, job_id,
                    tempo, stamina_hours, load, bonus_chance, fit, sheet jsonb,
                    assigned_at, accrued_from                      pk champion_id
```

`accrued_from` is the accrual clock. It is the moment from which unclaimed
production is measured, and it advances only by the time a claim actually
paid for. The four sheet columns are what the claim reads; `sheet` keeps the
full breakdown for display. Claims go through `inventory_operations` under a
new `operation_type`, `camp-claim`, so the check constraint is widened a
third time.

### The labour sheet, in one place

Everything in the principle's table except upgrades is summable straight
from the build JSON: the level, each slot's rarity, each modifier's stat and
value, each set id, the skill ids and levels, the behaviour profile. So the
sheet is a SQL function over `build` and `max_floor`, with a TypeScript twin
in `src/content/camp/CampLabour.ts` that computes the identical sheet for the
picker, the champions page and the tests. The full stat resolver in the
simulation is not ported; the sheet reads the same inputs through a simpler,
mirrored formula.

```text
strength   = 1 + 0.01 × max(0, level − 10) + 0.02 × max(0, max_floor − 10), capped at 1.30
tempo      = clamp(strength × (1 + attack_speed_percent / 200) × profile_tempo, 1.0, 2.0)
stamina    = clamp(8 × (1 + max_hp_on_gear / 400) × profile_stamina, 6, 12)
load       = clamp(strength × (1 + increased_damage_percent / 300), 1.0, 2.0)
bonus      = min(critical_chance_percent, 25) / 100
fit        = 1 + set_fit(job, equipment) + tag_fit(job, skills), capped at 1.25
haste      = 1 + movement_speed_percent / 100
output     = min(2.0, tempo × load × fit)
```

Every figure is rounded to four decimals so a double and a Postgres numeric
agree. The sums come straight from the rolled gear modifiers: attack speed and
movement speed are percent rolls, Max HP is a flat roll (twelve to seventy a
piece, so four hundred is the divisor that lets a hardy set reach the twelve
hour ceiling), and `increased_damage_percent` is the four increased-damage
rolls added together, global and typed alike. `set_fit` counts each piece
wearing the job's set at one for common through five for legendary, half a
percent a point and capped at fifteen; `tag_fit` adds a percent per level of
each skill carrying one of the job's tags, capped at ten. A Champion made by
the development tools has no source run; when the run is missing,
`build.level` stands in for `max_floor`, so a generated Champion works the
Camp exactly like an earned one. Upgrades that touch stats are left out at
first and can be added by seeding their values into a reference table, the
way recipes are mirrored.

### Accrual

The arithmetic is a pure function, mirrored in SQL and in
`src/content/camp/CampAccrual.ts`, and the TypeScript version is the one the
tests pin down.

```text
rate           = base_rate_per_hour × rate_multiplier(level) × output
elapsed_hours  = min(now − accrued_from, min(stamina, storehouse_cap_hours))
units          = floor(rate × elapsed_hours)
paid_hours     = units / rate
accrued_from   = now − (elapsed_hours − paid_hours)
```

Three properties fall out of that and become tests:

- Claiming twice in a row pays nothing the second time.
- Claiming at two points pays the same total as claiming once at the second
  point, because the unpaid fraction of an hour carries forward.
- Past the cap, waiting longer pays nothing more, and nothing is lost.

The bonus chance is rolled once per claim from a seed derived from the
operation id, so a retry cannot reroll it.

### RPCs

| RPC | Does |
| --- | --- |
| `get_camp_state()` | Buildings, assignments with their sheets, each job's pending units, and `server_time`. |
| `assign_champion_to_camp_job(op, champion, job)` | Owner check; not archived; not in an active or paused run; a free slot at the job; derives and stores the labour sheet; starts the clock. |
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
src/content/camp/        CampBuildings.ts, CampJobs.ts, CampLabour.ts,
                         CampAccrual.ts (+ tests)          registries, pure
src/camp/                CampTypes.ts, CampService.ts (+ test),
                         CampScreen.tsx (+ test), CampBuildingArt.tsx,
                         LabourSheetLine.tsx, Smokehouse.ts, Forge.ts
src/inventory/           timber and stone definitions, MaterialIcon glyphs
src/services/            a camp ServiceHandle on AppServices
src/hub/                 the Camp station, which opens the screen
src/app/                 the /camp route and its lazy screen
src/characters/          the labour sheet and "Working · Woodline" on the details
src/app/screens/         run setup excludes working Champions from the Abyss
```

The panel is a HUD panel on the desktop and a sheet on a phone, and it holds:
one card per building with its level, its jobs and their assigned Champions,
the pending output per job counting up on the client from `server_time`, one
Claim button for the whole Camp, and an upgrade row showing the next level's
cost against what the bag holds.

The Champion picker is where the sheet earns its keep. Each row shows the
name, the availability pill, and the sheet as one line: "Tempo ×1.3 ·
Stamina 10h · Load ×1.1 · Giant: quarry". The champions page shows the same
line under the details, so gear matters twice: once in the run that won the
Champion, and again every time the player chooses who works. An exhausted
Champion is pickable, because exhaustion blocks the Abyss and not labour.

## Slices

Each slice is a commit series on main that leaves the game whole, with lint,
the unit suite and the build green, and the screens checked by screenshot at
390×844 and 1920×1080.

### Slice 0: foundations *(shipped 2026-09-11)*

Timber and stone as items on both sides; the reference tables and their seed
rows, including the skill tag table seeded from the registry with a
documentation test that keeps it true; the `camp-claim` ledger type; the
content registries; the labour sheet and accrual functions as SQL and
TypeScript twins, with tests that feed both the same builds and expect the
same sheets. No UI. Ships with the Storehouse level table so the materials
have a named sink from the first commit.

As built: `src/content/camp/` holds the registries and the two twins, the
migration `20260911150000_add_camp_foundations.sql` holds the tables, the
seeds, `camp_labour_sheet` and `camp_accrue`, and the fixture set lives in
`tests/fixtures/`. The migration ends by asserting the fixtures against its
own functions, so applying it is the SQL side of the test, and
`tests/campRegistry.test.ts` asserts the same files against the TypeScript
side and checks the migration's fixture block is a copy of them. The bonus
stack a critical chance pays is not yet rolled anywhere; that is the claim
RPC's job in slice 1, from a seed derived from the operation id.

### Slice 1: labour *(shipped 2026-09-11)*

The per-player tables and the five RPCs; the Camp service; the hub station
and panel with the Woodline and the quarry at level 1, the Storehouse at
level 1 with an eight-hour cap; the picker with the labour sheet; assign,
unassign and claim; the Abyss lockout on the server and in run setup; the
sheet and the job on the champions page. This is the slice to play before
anything else is decided, because it is where the loop either feels like a
check-in or does not, and where the sheet either reads at a glance or does
not.

As built: `20260911170000_add_camp_labour.sql` holds `camp_buildings`,
`camp_assignments`, `get_camp_state`, `assign_champion_to_camp_job`,
`unassign_champion_from_camp` and `claim_camp_production`; the upgrade RPC
waits for slice 2. Every mutation answers with the whole Camp state, so the
client never reconciles a guess. Two hooks hold the rules: a trigger on the
champions table's archived flag settles and removes an assignment, which
covers both the champions page and a victory that replaces a Champion at a
full roster, and the Abyss exhaustion trigger refuses a working Champion. A
Champion is also refused a job while it is mid-descent, and moving it between
jobs settles the old one in the same call. Slots are counted per building,
which is what `job_slots` means. The bonus stack is a critical hit at the
Camp: rolled once per claim from the operation id and the Champion, it pays a
quarter again on top. The floor a Champion was won on reaches the client
through the Camp state rather than a column on the champions table, so the
picker previews the sheet the server will store. On the client, `src/camp/`
holds the service, the panel and the sheet line; the panel opens from a sixth
station on the hub and sits in the HUD's centre column on a desktop and in the
dock on a phone.

### Slice 2: construction *(shipped 2026-09-12)*

`upgrade_camp_building`; Storehouse levels 2 and 3 raising the cap to ten and
twelve hours; Woodline and quarry levels raising the rate and adding a second
slot; the tackle bench with multi-input recipes that spend timber alongside
scrap, so the bench is cheaper in scrap than the workbench for the same bait.
The recipe table gains an `inputs jsonb` column and the craft RPC consumes
each input in turn. The client recipe registry already mirrors the server's
rows and `tests/craftingRecipes.test.ts` keeps it that way; the new column
extends that test rather than replacing it.

As built: `20260912100000_add_camp_construction.sql` adds
`upgrade_camp_building`, which settles the building's pending production
first so the new rate applies from the upgrade and never to hours worked at
the old one, then consumes the level's cost oldest-stack-first and raises the
level under a `camp-upgrade` ledger row. A building a player starts without
has a `starting_level` of zero; the tackle bench is the first. Recipes gained
an `inputs` list and a `camp_building_id`, backfilled from the single-input
columns for every row before, and the craft consumes each input in turn and
refuses a bench recipe until the bench is built. The bench's two recipes turn
timber and scrap into a River Worm and a Glow Grub, at half the scrap the
workbench asks. On the client the bag's workbench shows only the recipes
without a building, and the Camp panel shows the bench's; every card ends in
an upgrade row that prices the next level against what the bag holds.

### Slice 3: timed construction (optional)

Construction takes real time and Champions assigned to a building site
shorten it, scaled by movement speed from the sheet. Same accrual model,
applied to a `completes_at` on `camp_buildings`. Only worth doing if slice 1
shows players returning on the cap's rhythm; if they do not, time on
construction is a wall rather than a rhythm.

### Later, each behind its own prerequisite

- **Rift anchor** *(shipped 2026-09-12)*. Rift shards come from the Abyss's
  floors, granted beside the floor box by the same trigger: one a floor and one
  more for every five floors down, to six. The anchor is built with shards,
  timber and stone, and its one job, `anchor-rest`, has the job table's new
  `effect` of `exhaustion-relief`: an exhausted Champion is sent there (a
  rested one is refused), its units are minutes, and a claim takes them off
  its own `exhaustion_until`, never past now. Levels raise the rate by half
  and then double it, and open a second slot. The labour sheet applies as at
  any job, so a Champion in Astral gear rests faster.
- **Smokehouse** *(shipped 2026-09-12)*. Roe comes from gutting, which is an
  RPC at the Smokehouse rather than a bag action: `gut_fish_at_smokehouse`
  destroys a fish and grants roe by rarity and size. Curing,
  `cure_fish_at_smokehouse`, spends roe to raise a meal fish's enchantment a
  tier, writing the same `enchantmentId` and `enchantmentValue` the fishing
  rod's Enchanter rolls, so the run meal already knows how to read it and no
  new item category was needed. Both are inventory operations under their own
  ledger types. The panel's Smokehouse card opens a fish picker for either.
- **Forge** *(shipped 2026-09-12, once Phase 9 had landed)*. Built for
  timber, stone and scrap, raised with rift shards. `reforge_artifact` spends
  scrap and shards by the artifact's rarity and rolls its implicit and
  modifiers again through `roll_artifact_metadata`, from a seed derived from
  the instance and a reforge count kept on its metadata, so the same function
  a box uses decides the roll and a retry cannot roll twice. The base and the
  rarity stay. An artifact away on a run has no quantity in the bag and is
  refused. Levels two and three apply `camp_forge_salvage_multiplier` to the
  scrap `complete_dungeon_run` pays for a finished loadout. The panel's Forge
  card opens an artifact picker with each relic's summary and price.
- **Trophy hall** needs collections (Phase 10).

### A note on the market

Once a Champion has a labour sheet, it has a value a stranger can read, which
makes Champions worth trading in a way an Abyss-only roster never was. The
current market documents keep Champions non-tradeable and put borrowing in
Phase 14. Trading a Champion outright is feasible on this data model, since a
Champion is an immutable snapshot with a unique id and a single owner, and a
transfer is an atomic change of `profile_id` that first settles its
assignment, respects the buyer's roster limit of ten, and carries the
exhaustion timer with it. Whether to allow it is a decision for
[marketplace.md](marketplace.md), not for this plan; the plan only makes sure
nothing here would stand in its way.

## Opening numbers

Proposals to tune, not decisions. The target is that one Champion on one job
fills a Storehouse upgrade in about two days of check-ins, and that a full
roster on the Camp still cannot out-produce a single Abyss run's worth of
value. The sheet's bounds above are part of this table.

| Thing | Value |
| --- | --- |
| Accrual cap | 8 h at Storehouse 1, 10 h at 2, 12 h at 3 |
| Woodline, level 1 | 4 timber per hour per Champion at tempo ×1, 1 slot |
| Quarry, level 1 | 4 stone per hour per Champion at tempo ×1, 1 slot |
| Level 2 of either | ×1.5 rate, 2 slots, costs 40 timber and 40 stone |
| Storehouse 2 | 48 timber, 48 stone |
| Storehouse 3 | 120 timber, 120 stone, 40 scrap |
| Tackle bench 1 | 40 timber, 20 stone |
| Bench recipe | 5 timber and 4 scrap for one River Worm, against 8 scrap at the workbench |

## Verification

- Labour sheet and accrual: unit tests on the pure functions, including the
  three properties above, and a fixture set of builds whose sheets the SQL
  twin must reproduce under `npm run supabase:validate`.
- Service: stubbed `rpc` calls asserting the exact argument bag, as
  `ShopService.test.ts` does.
- Panel: a component test that assigns, claims and reads the toast, and one
  that renders the sheet line for a known build.
- Migrations: `npm run supabase:validate` locally with Docker; CI applies the
  whole history and lints it on every push to main.
- Screens: `npm run screenshot -- --path dashboard` at both viewports with
  the panel open, and no end-to-end runs unless asked.

## Risks

- **Two tabs.** Both claim; the ledger pays once and the second tab receives
  the first tab's result with `was_processed = false`.
- **Clock skew.** The client counts up from `server_time`, never from its own
  clock, and the server recomputes on claim.
- **The twins drift.** The SQL sheet and the TypeScript sheet disagree after
  a change to one. The shared fixture set is the guard, and the sheet stored
  on the assignment row is what the claim uses, so a drift shows in the
  picker before it shows in anyone's inventory.
- **A Champion leaves while working.** Archive, roster replacement and Abyss
  start all pass through the assignment table before they proceed.
- **The Camp becomes the reason not to run the Abyss.** The cap and the
  sheet's bounds are the lever; slice 1 is the measurement.

## Documents to update when it ships

- `camp.md`: the breakpoint sentence, the aptitude section replaced by the
  labour sheet, and the building table to match what exists.
- `implementation_plan.md`: the Phase 12 checklist.
- `IMPLEMENTATION_CHECKLIST.md`: a milestone 31 line.
- `economy.md`: timber and stone move from "proposal" to "live".
- `marketplace.md`: the Champion trading question, if it is taken up.
