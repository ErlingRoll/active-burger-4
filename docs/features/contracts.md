# Contracts and Collections

## Purpose

Contracts and collections are the cheapest way to make the existing content
feel larger. Neither adds a new place to play. Both add a reason to play the
places that already exist, and they are the two systems that most directly
serve players who have finished the content but not the game.

Contracts direct play outward. Collections reward play that has already
happened.

## Expedition contracts

A contract is a rotating objective completed through normal play.

- Three daily contracts and one weekly contract, replaced on a fixed schedule.
- Objectives span every system: clear floors, defeat elites carrying a named
  modifier, reach an Abyss depth, catch a species, craft at the Camp, salvage
  a quantity.
- Progress is credited from server-recorded results, never from client claims.
- Rewards are materials, box keys, and cosmetics. Contracts pay very little
  Essence, because Essence is the run's reward and a contract must not become
  a better run than a run.

The value of contracts is direction. A player who only fishes is handed a
reason to enter a dungeon, and a player who only clears floors is handed a
reason to visit the pond, without either being told they are behind.

Contracts must be achievable with the content the player already has. A
contract that requires a Champion from a player who has never won, or an Abyss
depth they cannot reach, is a broken contract rather than a stretch goal. Roll
contracts from the pool the account has unlocked.

Do not add streaks, login chains, or anything that is lost by missing a day. An
uncompleted contract simply rotates away.

## Collections

Collections record what a player has seen and reward completion.

- **Fish.** Species, rarity, and record size, in the shape fishing already
  implies.
- **Artifacts and gear.** Definitions seen, matching the duplicate handling
  that [artifacts.md](artifacts.md) already calls for.
- **Champions.** Classes cleared with, and the deepest floor reached with each.

Completion rewards follow the same rule as everything else outside the run:
options, capacity, access, and cosmetics. A completed fish page may unlock a
Camp recipe, a Trophy hall display, or a cosmetic. It may not grant damage.

A bestiary of enemies, elites and bosses was considered and set aside. It is
not planned; the elite modifiers stay documented in the wiki.

Collections are the one part of this proposal where a scrolling document screen
is appropriate, in the same way the wiki and the champions page already are.
They are reference screens rather than gameplay screens.

## Design constraints

- Contract definitions, pools, rotation schedules, and rewards live in a
  data-driven registry with stable IDs.
- Contract progress is derived from existing server-recorded run results,
  fishing results, and inventory operations. Do not add a new client reporting
  path that a modified browser could forge.
- Claiming a contract reward is idempotent.
- Collection state is derived from recorded events where possible, so it
  survives a schema change and cannot be lost by a single failed write.
- Nothing here expires in a way that penalises absence.
- Every reward must have a sink already defined in [economy.md](economy.md).
