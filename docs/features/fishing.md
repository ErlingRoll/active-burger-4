# Fishing

## Purpose

Fishing is a separate downtime activity that supplies tradeable fish, bait,
rods, and occasional loot boxes. It supports dungeon preparation and Champion
recovery without interrupting the autoplay combat loop.

Fishing is not part of the combat simulation. A fishing attempt is resolved
before the next attempt begins, and its result is added to the player's
inventory.

## Fishing loop

1. Choose an unlocked fishing spot, rod, bait, and fishing mode.
2. Start an attempt.
3. Wait for a deterministic catch result.
4. In manual mode, complete the fishing interaction before the timeout.
5. Receive a fish or an occasional fishing loot box.

Auto fishing always eventually produces a result. Manual fishing has better
expected fish rarity and size, but it requires the player to remain present.
Manual fishing must improve the result rather than create a second mandatory
progression track.

Initial target timings:

- Normal catch time: 10-30 seconds.
- Pity timeout: 45-60 seconds.
- Rod speed modifiers reduce waiting time but do not remove the pity result.

## Bait

- Basic bait has unlimited use.
- Basic bait catches only very common, small fish.
- The shop pays only a small amount of Essence for basic fish. This is an
  introductory sink, not a replacement for dungeon progression.
- Better bait comes from dungeon runs, Abyss loot boxes, fishing rewards, and
  trading.
- Bait is consumed per attempt unless the equipped rod rolls a bait-retention
  result.

Better fishing must remain accessible after a player exhausts a Champion. The
player must be able to earn better bait or recovery fish through normal
dungeons, not only through a successful Abyss attempt.

## Fishing rods

Rods are unique rolled inventory items. A rod is rolled when it is created and
cannot be upgraded. Rods can be traded while unbound.

Rarity determines the number of modifiers:

| Rarity | Modifiers |
| --- | ---: |
| Common | 1 |
| Uncommon | 2 |
| Rare | 3 |
| Epic | 4 |
| Legendary | 5 |

The initial modifier pool is:

- Increased fish rarity.
- Increased loot-box chance.
- Chance to retain bait.
- Faster fishing speed.
- Increased enchantment chance.

Modifier values use the existing tier convention, but final ranges must be
validated against catch-rate simulations. Rod bonuses must not allow an
unbounded supply of high-rarity loot.

## Fish data

Each fish instance contains:

- Stable species ID.
- Rarity from Common through Legendary.
- Size value and a normalized size percentile.
- Optional enchantment ID and rolled value.
- Unique inventory item ID.

Species determines the appearance, base effect, and special interactions.
Rarity affects catch probability, visual presentation, effect potency, and shop
value. Size affects visual scale, shop value, and effect potency. Effects should
use normalized size rather than raw kilograms so different species remain
balanceable.

Most fish have no enchantment. The initial target enchantment chance is 5%,
subject to later balance changes. Enchantments are a later expansion and are not
required for the first fishing implementation.

## Fish uses

### Run meal

Fish are consumed before a dungeon or Abyss run. The player can select up to
five fish. Their effects are resolved once at run start and remain fixed for
that run.

The selected fish are removed or reserved atomically with run creation. A
checkpoint stores the selected fish IDs and resolved effects so reconnecting
cannot recalculate or consume them twice.

The first implementation should use a small number of effect families and
prevent five copies of one offensive effect from becoming the universal optimal
loadout. This can be done with one-slot-per-family rules or diminishing returns.

### Revival fish

Eligible fish, including Revival Koi, can reduce a Champion's Abyss exhaustion.
Revival use consumes the fish and cannot be combined with run-meal use.

Revival power is based on rarity and normalized size:

```text
reduction = min(remaining exhaustion, base value * rarity factor * size factor)
```

The size factor and maximum reduction are content-defined and capped. A
high-quality fish may clear a full 24-hour timer; common small fish should
provide only a small reduction or be ineligible.

### Shop and other sinks

Fish have deliberately low shop value. Their primary value comes from run
effects, Champion recovery, crafting or collection objectives, and trading.
Shop sales must not become an infinite Essence farm.

## Fishing loot boxes

Fishing can rarely produce a loot box. Rod, bait, and fishing mode influence
the chance and maximum quality. The global loot-box rules in
`infinite_abyss.md` apply unless a source-specific table explicitly overrides
them.

Fishing loot tables initially focus on fish, bait, rods, materials, and
cosmetics. High-end Abyss artifacts should not accidentally become common
fishing output.

## Social scope

Trading fish and rods is a later server-backed feature. Sharing catches and
public collection displays can follow the inventory implementation.

Real-time fishing ponds, player presence, emotes, and inspecting another
player's equipment are optional future social features. They are not required
for the first fishing release.
