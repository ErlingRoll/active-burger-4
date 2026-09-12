# Contracts and collections: delivery plan

> **Status:** Shipped 2026-09-13: the contract board, the three collections and
> the Trophy hall. Later the same day the board moved onto the refuge and the
> daily slots became endless. Elite-by-modifier contracts wait on a kill
> record the run does not keep; see the note under objectives.
> **Design:** [contracts.md](contracts.md) says what contracts and collections
> are. This document says how they are built, in what order, and which
> decisions were settled on the way.

Contracts and collections are Phase 10 of the
[implementation plan](implementation_plan.md). They add no new place to play.
They add a reason to play the places that exist, and they do it from what the
server already remembers about play, so nothing here asks the browser to
report anything.

## What it is built on

Every objective and every collection is a query over rows that already exist,
so each slice is wiring rather than invention.

- **Runs are recorded.** `dungeon_runs` carries the mode, the class, the
  status, `current_floor` and the timestamps; `dungeon_run_snapshots` has a
  `floor` row for every floor reached and a terminal row with the run's kill
  count. Floors descended, dungeons won, monsters slain and the deepest Abyss
  floor are all sums and maxima over those two tables.
- **Catches are recorded.** `fishing_attempts` keeps the species, the rarity
  and the size of every completed attempt in its `result`.
- **Every material moves through the ledger.** `inventory_operations` records
  a craft with its batch count, a salvage with its quantity, a Camp claim with
  its units and a gutting at the Smokehouse, each under its own
  `operation_type`. Crafting, salvaging, gathering and gutting contracts
  read those rows.
- **Boxes and floors are recorded.** `loot_box_openings` has a row per box
  opened, and `abyss_floor_rewards` a row per completed Abyss floor.
- **The shop already rolls a per-player shelf from the account and the
  date**, seeded so a refresh cannot reroll it. The contract rotation does the
  same, with the same hash.
- **A claim is an inventory operation.** The Camp's claim proved the shape:
  one ledger row per operation id, a grant through `grant_inventory_items`
  under a derived id, and a second call that returns what the first paid.

## Decisions settled

1. **Progress is computed, never stored.** A contract's progress is a query
   over recorded events between the contract's window start and end, run
   when the board is read and again when a claim is made. There is no
   progress row to get out of step, no client reporting path, and no way for
   a modified browser to say it did something the tables do not show.
2. **A window is the period, not the assignment.** A daily contract counts
   everything recorded from midnight UTC to the next midnight, whether the
   board was opened before or after the play. A weekly one counts from
   Monday. A player who fished at dawn and read the board at noon is not
   punished for the order.
3. **The rotation is rolled once and stored.** Like the shop's shelf: the
   first read of a period inserts that period's assignments, chosen by a hash
   of the account, the period and the definition. Refreshing returns the same
   board. The rows are what a claim is made against, so a definition retuned
   later never changes what a contract already on the board asks for.
   **A daily slot never stays spent.** Claiming a daily contract deals the
   next one into its slot in the same transaction, drawn from the dailies
   the player can reach and not already on the board, the ones dealt fewest
   times today first, so the whole pool is seen before any repeats. The
   replacement's window opens at the claim and still closes at midnight, so
   the morning's play does not count toward a contract dealt at noon. The
   weekly contract is dealt once a week and claimed once.
   Every read of the board also deals into any daily slot with nothing live
   in it, so a slot emptied by a claim the pool could not follow, or by the
   board as it stood before dailies were endless, is filled the next time
   the refuge is opened.
4. **Eligibility is measured at the roll.** A contract that needs a Champion
   is not offered to a player without one, and one that needs the Smokehouse
   is not offered before it is built. A player who gains either sees the
   contract in the next period. Nothing offered is ever unreachable.
5. **A claim outlives its window.** The board shows the current period only,
   but a contract finished on Sunday and claimed on Monday still pays.
   Nothing is lost by missing a day; an unfinished contract simply rotates
   away.
6. **Contracts pay materials and boxes, never Essence.** The rewards are
   timber, stone, scrap, roe, rift shards and loot boxes, each with a sink
   that already exists. Rift shards from contracts are what
   [economy.md](economy.md) reserved for "deep-floor contracts later".
7. **Collections pay nothing that stacks.** A completed page earns a display
   in the Trophy hall and nothing else. The Trophy hall is a Camp building
   bought with timber and stone, and what it shows is derived from the same
   recorded events as the page, so it cannot be claimed twice because it is
   never claimed at all.
8. **No bestiary.** Kills are recorded as a count, not by enemy, and a
   bestiary was set aside on 2026-09-12. "Defeat elites carrying a named
   modifier" from contracts.md is therefore not in the pool; a slain-monsters
   objective counts the run's kill total instead.

## Data model

Reference data, readable by every signed-in player:

```text
contract_definitions   id, name, cadence ('daily' | 'weekly'), objective, target,
                       parameter jsonb, reward jsonb, requires_champion,
                       requires_building_id, sort_order, active
```

Per player, select-only under RLS, written only by RPCs:

```text
contract_assignments   id, profile_id, definition_id, cadence, period_key,
                       window_start, window_end, slot, claimed_at,
                       claim_operation_id
                       unique (profile_id, cadence, period_key, slot)
                         where claimed_at is null
```

A claimed row keeps its slot number as the record of the day; only the live
rows hold a slot, which is what the partial index says.

`period_key` is the UTC date for a daily contract and the ISO week
(`2026-W37`) for a weekly one. The window is stored on the row so a claim
made after the period reads the same bounds the board did. Claims go through
`inventory_operations` under a new `operation_type`, `contract-claim`.

### Objectives

| Objective | Counts | From |
| --- | --- | --- |
| `descend-floors` | Floor checkpoints of dungeon runs in the window | `dungeon_run_snapshots` |
| `win-dungeon` | Dungeon runs that ended in victory in the window | `dungeon_runs` |
| `slay-monsters` | Kill counts of runs that ended in the window | terminal `dungeon_run_snapshots` |
| `reach-abyss-depth` | The deepest floor of an Abyss run started in the window | `dungeon_runs` |
| `descend-abyss` | Abyss floors completed in the window | `abyss_floor_rewards` |
| `catch-fish` | Completed catches, at or above `parameter.minRarity` when set | `fishing_attempts` |
| `catch-species` | Catches of `parameter.definitionId` | `fishing_attempts` |
| `open-loot-boxes` | Boxes opened | `loot_box_openings` |
| `craft-items` | Batches crafted at either bench | `inventory_operations` of type `craft` |
| `salvage-items` | Items salvaged, singly or in a sweep | `inventory_operations` of types `salvage` and `salvage-sweep` |
| `gather-materials` | Timber and stone paid by Camp claims | `inventory_operations` of type `camp-claim` |
| `gut-fish` | Fish gutted at the Smokehouse | `inventory_operations` of type `camp-gut` |

Each is one branch of `contract_progress(profile, definition, window)`. The
TypeScript registry in `src/content/contracts/Contracts.ts` mirrors the
definition rows, and `tests/contractRegistry.test.ts` parses the seed rows out
of the migration the way the Camp's registry test does, so a contract added or
retuned on one side without the other fails the build.

### The pool

Eleven daily contracts and five weekly ones, three and one drawn a period.
The daily pool is wide enough that a player sees a different board most days
and narrow enough that every contract is reachable in a session; the weekly
pool asks for the one thing a week of play produces.

| Contract | Cadence | Asks | Pays | Needs |
| --- | --- | --- | --- | --- |
| Down the stairs | daily | Descend 8 floors | 12 timber, 12 stone | |
| A cull | daily | Slay 300 monsters | 6 scrap | |
| A day's catch | daily | Catch 5 fish | 4 roe | |
| Something rare | daily | Catch a rare fish or better | an uncommon box | |
| The pike | daily | Catch a Lantern Pike | 10 stone | |
| The trout | daily | Catch a Glassfin Trout | 10 timber | |
| Unboxing | daily | Open 2 loot boxes | 5 scrap | |
| At the bench | daily | Craft 2 batches | 8 timber | |
| Clear out | daily | Salvage 5 items | 6 timber, 6 stone | |
| Timber and stone | daily | Gather 30 at the Camp | 8 scrap | a Champion |
| Into the rift | daily | Complete 5 Abyss floors | 2 rift shards | a Champion |
| The Smokehouse | daily | Gut 2 fish | 10 stone | the Smokehouse |
| The long way down | weekly | Win a dungeon | a rare box, 20 scrap | |
| Deep descent | weekly | Reach Abyss floor 10 | a rare box, 6 rift shards | a Champion |
| The angler | weekly | Catch 25 fish | a rare box, 10 roe | |
| The great cull | weekly | Slay 1500 monsters | a rare box, 30 timber, 30 stone | |
| Camp stores | weekly | Gather 150 at the Camp | a rare box, 20 scrap | a Champion |

### Collections

Three pages, each a query with no table of its own:

- **Fish.** Per species: catches, best rarity and the record size, from
  `fishing_attempts`.
- **Artifacts.** Per base: how many have been found and the best rarity,
  from `loot_box_openings` and the artifact instances the bag holds, counted
  by instance so a box and the relic it made are one find.
- **Champions.** Per class: dungeons won and the deepest Abyss floor, from
  `dungeon_runs` by `class_id`.

`get_collection_state()` returns all three. The pages and their milestones
live in `src/content/collections/Collections.ts`: a milestone is a page and a
count, and reaching it earns a named display. The Trophy hall reads the same
state and shows the displays earned; a page's milestones and the hall's
displays are the same list read twice.

### RPCs

| RPC | Does |
| --- | --- |
| `get_contract_state()` | Rolls the day's and the week's assignments if they do not exist, then returns the live dailies, the week's contract, how many dailies were claimed today, and `server_time`. |
| `claim_contract_reward(op, assignment)` | Owner check; the assignment is unclaimed; progress at or above target; grants each reward line under `op || ':' || definition`; stamps `claimed_at`; deals a replacement into a daily slot. Returns what was paid and the state. |
| `get_collection_state()` | The three pages. |

## Client

```text
src/content/contracts/     Contracts.ts (+ test)            registry, pure
src/content/collections/   Collections.ts (+ test)          pages, milestones, pure
src/contracts/             ContractTypes.ts, ContractService.ts (+ test),
                           ContractBoard.tsx (+ test), on the refuge
src/collections/           CollectionTypes.ts, CollectionService.ts (+ test),
                           CollectionsScreen.tsx (+ test)
src/camp/                  the Trophy hall as a building with an inspector
src/hub/, src/app/         the board's panel on the refuge, a path and a
                           header link to the collections, one route
src/styles/contracts.css   the board's panel and the collections screen
```

The contract board is a panel on the refuge, beside the leaderboard: the
three dailies and the week's contract as one line each, with the ask, a bar
counting the window's events against the target, the pay as icons, and a
Claim that appears at the target. A claimed daily's line is replaced by the
next contract's; the weekly line reads "Claimed". The panel reads the state
on open and after every claim, and never guesses in between. The collections
screen is a reference document, as contracts.md asks: one section per page
with an entry per species, base and class, greyed until found, and the
milestones beneath.

## Slices

### Slice 1: the board *(shipped 2026-09-13)*

The reference table and its seed rows, the assignment table, the rotation,
the progress function and the claim, all in
`20260913120000_add_contracts_and_collections.sql`; the registry with its
test; the service with its stubbed-RPC test; the board with a component
test that reads it and claims a finished contract; the paths, links and
routes. Revised the same day by
`20260913150000_daily_contracts_replace_on_claim.sql`: the board moved from
a screen of its own onto the refuge, and a claimed daily is replaced on the
spot.

### Slice 2: collections and the Trophy hall *(shipped 2026-09-13)*

`get_collection_state()` in the same migration; the pages and milestones
registry with a test that derives displays from a known state; the
collections service and screen; the Trophy hall seeded as a building at
level zero, bought for timber and stone, with an inspector that lists the
displays earned and opens the collections.

### Later

- **Contracts that name an elite modifier** need the terminal snapshot to
  record kills by enemy and modifier. That is a change to the run boundary
  and is not made here.
- **Cosmetic rewards** wait on a cosmetic system. The reward column is jsonb
  so a cosmetic can be added as a reward line without a schema change.

## Verification

- Registry: `tests/contractRegistry.test.ts` parses the seed rows and
  compares them with the TypeScript registry; the camp registry test already
  covers the Trophy hall's building and level rows.
- Services: stubbed `rpc` calls asserting the exact argument bag and the
  mapping of every response shape, as `CampService.test.ts` does.
- Screens: a component test for the board that renders a known state,
  claims a finished contract, reads the toast and sees the replacement
  dealt, and one for the collections screen.
- Migrations: `npm run supabase:validate` locally with Docker; CI applies the
  whole history and lints it.
- End to end: `e2e/contracts.spec.ts` signs in, reads the board on the
  refuge and the collections. Opt-in like every other browser suite.

## Risks

- **A window straddles a deploy.** Assignments are rolled per period on
  first read, so a definition added mid-day appears the next day, never in
  the middle of a board.
- **Two tabs claim.** The ledger pays once; the second tab receives the first
  tab's result with `was_processed = false`.
- **Progress counts a run that began before the window.** A run that ends
  inside the window counts its whole kill total, and a floor reached inside
  the window counts whatever floor it was. Accepted: it is generous in the
  player's favour and never the other way.
- **Contracts become the reason to play.** They pay no Essence and no power,
  so a contract is never a better run than a run.

## Documents updated when it shipped

- `contracts.md`: a status line.
- `implementation_plan.md`: Phase 10 marked done.
- `IMPLEMENTATION_CHECKLIST.md`: a milestone 32 line.
- `camp.md` and `camp_delivery_plan.md`: the Trophy hall live.
- `economy.md`: rift shards from contracts live.
