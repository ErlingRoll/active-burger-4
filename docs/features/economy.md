# Meta Economy

## Purpose

This document is the contract every meta system must satisfy. It exists
because the game's problem is not a shortage of systems. There is already a
dungeon, the Infinite Abyss, fishing, Champions, loot boxes, artifacts, a hub
with live presence, and Essence.

The problem is that each of those systems terminates in itself. Fish are eaten
or sold. A Champion is created by a victory, spent on one Abyss attempt, and
then idles for a day. A loot box grants an item that no recipe consumes. Gear
is destroyed at the end of the run that produced it.

Adding more self-contained systems makes the game wider without making it
deeper. A new meta system earns its place by consuming an existing system's
output and producing an input an existing system needs.

## Rules

These apply to every meta system, existing or proposed.

1. **No system is the best source of what it consumes.** Fishing must not be
   the best source of bait, and the camp must not be the best source of the
   materials it refines. This is what forces a player to touch more than one
   system without any system being mandatory.
2. **Nothing outside the run produces raw power.** Meta systems produce
   options, capacity, access, and time: sidegrade effects, inventory and slot
   capacity, content unlocks, and reduced Champion exhaustion. This restates
   [PLAN.md](../../PLAN.md) section 69, and it is the rule most likely to be
   broken by a convenient building or an attractive market listing.
3. **One progression currency.** Essence stays the only currency. Everything
   else is an inventory item with a definition, a stack, and a named sink. Do
   not add a second currency to make a system feel separate.
4. **Sinks before faucets.** A new material must have its consumer defined in
   the same change as its producer. A material with no sink accumulates until
   it reads as broken.
5. **Value is created in exactly two places.** Runs and fishing create items.
   The camp transforms them. The market moves them. A system that creates
   value from nothing is an exploit surface, and this game plays itself, so
   assume it will be automated.
6. **Every system is skippable.** A player who only runs dungeons may fall
   behind on convenience and breadth. They must not fall behind on power.

## Resource graph

Write a proposed system into this table before designing it. A row that
produces something no other row consumes, or consumes nothing, is not ready.

| System | Produces | Consumes |
| --- | --- | --- |
| Dungeon run | Essence, a Champion on victory, scrap, boxes up to Rare | Fish meal, artifacts, camp consumables |
| Infinite Abyss | Rift shards, one box per completed floor, leaderboard standing | A Champion, artifacts, fish meal |
| Fishing | Fish, roe, rods, occasional boxes | Bait, tackle crafted at the camp |
| Camp | Refined materials, meals, bait, capacity, exhaustion relief | Scrap, roe, rift shards, timber and stone, Champion labour |
| Contracts | Materials, box keys, cosmetic unlocks | Nothing; it pays for play that is already happening |
| Market | Nothing | Listing fees and time |

The market row is deliberately empty on the left, for player listings. The
consignment shop that shipped first is the exception that proves it: it creates
what it sells and destroys what it buys, which is why the day's quantity is
capped and the spread between the two prices is always a loss. See
[marketplace.md](marketplace.md).

## Materials

Four material families, each with one primary source, so a player can always
name where a material comes from. These names are provisional and belong in a
content registry, not in engine code.

| Material | Primary source | Primary sinks |
| --- | --- | --- |
| Scrap | Salvaging run gear and duplicate loot-box items | Bait at the workbench and the bench, the Forge and its artifact rerolls |
| Timber and stone | Camp passive production | Building construction and upgrades |
| Roe | Gutting fish at the Smokehouse | Curing meal fish; bait crafting later |
| Rift shard | Abyss floors, deep-floor contracts later | The Rift anchor and the Forge's artifact rerolls |

Scrap is live. Completing a dungeon grants it from the equipment on the
terminal checkpoint, at one, two, four, seven or twelve per piece by rarity, and
the workbench on the bag spends eight of it on a River Worm. Only dungeon runs
pay: an Abyss attempt wears a Champion's saved gear, which does not change
between attempts, so paying for it would be a faucet one loadout could run
forever. Timber and stone are live too: Champions sent to the Woodline and
the quarry produce them while the player is away, up to the Storehouse's cap,
and the Storehouse, the Woodline, the quarry, the tackle bench, the Rift anchor
and the Smokehouse are their sinks: each next level is bought with them, and the bench spends timber
alongside scrap on bait. Roe is live, gutted from fish at the Smokehouse and
spent there to cure a meal fish. Rift shards are live, paid by every completed
Abyss floor and spent on the Rift anchor.

Materials are stackable inventory items using the existing item instance
format, not a new balance column on the account. This keeps them tradeable,
salvageable, and grantable through the same server-authoritative operations as
fish and rods.

Duplicate loot-box items resolve into scrap. This gives duplicates the
crafting sink that [artifacts.md](artifacts.md) asks for without turning boxes
into an Essence faucet.

## Essence policy

Essence is earned from runs, spent on account unlocks, and is never tradeable.
It must not become the universal solvent that lets a player buy past every
other system. In particular:

- The camp does not produce Essence.
- Contracts do not pay Essence as their main reward.
- The market does not price anything in Essence once player listings exist;
  see [marketplace.md](marketplace.md) for the currency question.
- Salvage pays materials, not Essence, wherever a material sink exists.

## Player types this is meant to serve

Breadth is the goal, but breadth through interlock rather than through count.
Three systems that feed each other serve more player types than seven that do
not, because each player reaches the others through the one they like.

| Player type | Served by | Reaches the rest through |
| --- | --- | --- |
| Theorycrafter | Skills, synergies, evolutions, artifacts | Meals and rerolls that need materials |
| Idler | The camp and offline accrual | Champions, which only runs produce |
| Collector | Fish, bestiary, artifact collection | Contracts that direct play |
| Competitor | Abyss depth, which is what the leaderboard ranks | Preparation systems that raise the ceiling |
| Trader | The market | Everything, because it moves everything |
| Socialiser | Hub presence, pond presence, borrowed Champions | Published builds |

## Design constraints

- Every material, recipe, and building value lives in a data-driven registry
  with a stable ID, like existing content.
- The simulation never reads the camp, the market, or a contract. Meta systems
  resolve into run-start snapshot data or they do not affect the run at all.
- All grants, consumptions, and transfers are server-authoritative and
  idempotent under retry, refresh, and two open tabs.
- No meta system may run a timer that punishes absence. Accrual caps and
  exhaustion are allowed; decay and expiring stockpiles are not.
- A player with an empty camp, no artifacts, and no market history must still
  be able to complete the dungeon.
