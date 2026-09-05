# Fishing

## Purpose

Fishing is a separate downtime activity that supplies tradeable fish, bait,
rods, and occasional loot boxes. It supports dungeon preparation and Champion
recovery without interrupting the autoplay combat loop.

Fishing is not part of the combat simulation. A fishing attempt is resolved
before the next attempt begins, and its result is added to the player's
inventory.

## Pond presentation

The fishing screen presents a stylized pond rather than a plain form:

- Fish silhouettes swim through the water using renderer/UI-only animation.
- Ripples, water shimmer, shoreline vegetation, and lantern glows establish the
  pond atmosphere.
- The player is shown seated at a fishing spot around the pond with a visible
  rod.
- Each authenticated player currently at the pond is tracked through realtime
  presence and rendered at a deterministic position along the pond perimeter.
  The active-attempt refresh recovers fishers if a realtime event is missed.
  Anglers are data-driven rather than limited to a fixed set of presentation
  slots, so the pond can accommodate any number of visitors.
- Authenticated players on the pond receive lightweight realtime cast and catch
  activity. Other anglers animate their rods when a player casts and briefly
  show the caught fish above their head, with a rarity-colored highlight and
  glow. These events are visual-only and never contain inventory IDs, fish
  size, or private progression data.
- The entire Fishing viewport uses a dark cosmic backdrop with sparse stars and
  subtle blue/violet nebula gradients. The pond is a brighter foreground focal
  layer within that space.
- The Cast line action remains server-authoritative and deterministic; visual
  fish movement must never affect catch resolution.

The scene fills the available area below the shared navbar. Moonwater Pond is a
fixed fishing environment; players do not select between fishing spots. The
pond is the primary visual surface, while the rest of the screen is reserved
for fishing controls, catch feedback, and a compact inventory summary. The
scene should remain readable at small screen sizes and respect
`prefers-reduced-motion`. Fish and ambient effects must not obscure the catch
result, inventory, or fishing controls.

## Fishing screen interaction states

The screen uses explicit presentation states around the server request:

- **Ready to cast:** the player is seated and the cast action is available.
- **Casting:** the rod and line animate as the cast begins.
- **Watching the float:** fish continue swimming while the player waits.
- **Catch on the line:** the pond emphasizes the bite before the result card
  appears.

The visual sequence is presentation-only. It must not change the server result,
seed, ownership checks, or deterministic catch resolver.

Players can select an owned rod before casting. The fishing screen shows only a
compact summary of owned fish, rods, and boxes; the full collection belongs on
the Inventory screen.

## Fishing loop

1. Choose a rod, bait, and fishing mode for the fixed Moonwater Pond.
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
- Basic bait favors very common, small fish.
- River Worm improves rarity by 10 percentage points.
- Glow Grub improves rarity by 18 percentage points, increases normalized size
  by 5 percentage points, and adds 1 percentage point to the loot-box chance.
- Moonwater Lure improves rarity by 26 percentage points, increases normalized
  size by 10 percentage points, and adds 2 percentage points to the loot-box
  chance.
- Better bait comes from loot boxes and remains tradeable.
- Bait is consumed per attempt unless the equipped rod rolls a bait-retention
  result.

Better fishing must remain accessible after a player exhausts a Champion. The
player must be able to earn better bait or recovery fish through normal
dungeons, not only through a successful Abyss attempt.

## Fishing rods

Rods are unique rolled inventory items. A rod is rolled when it is created and
cannot be upgraded. Rods can be traded while unbound.

The default loadout uses a Wooden rod. It is Common, has no modifiers, and is
described as: “It's actually just a stick with some spare yarn attached to the
end.”

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

Rod metadata is rolled once when the inventory instance is created. The server
stores the rolled modifier IDs and derived values, and fishing attempts read
those values without rerolling the rod:

- Fortune shifts the deterministic fish roll toward higher-rarity entries.
- Quick Line reduces the server-calculated wait time.
- Bait Keeper can preserve non-unlimited bait after resolution.
- Treasure Sense increases the chance of a fishing loot box.
- Enchanter rolls a deterministic chance for a fish enchantment.

The rolled metadata is displayed with the rod in the fishing and inventory
screens. Existing rods without modifier metadata are enriched by the migration
when the feature is deployed.

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

The initial weighted catch table is:

| Fish | Base chance | Run effect |
| --- | ---: | --- |
| River Minnow | 29% | Movement speed |
| Reed Darter | 15% | Attack speed |
| Glassfin Trout | 12% | Healing received |
| Silver Perch | 10% | Maximum health |
| Lantern Pike | 9% | Attack damage |
| Moon Carp | 8% | Skill cooldown recovery |
| Tideback Catfish | 6% | Physical resistance |
| Revival Koi | 5% | Champion Abyss exhaustion recovery |
| Comet Eel | 4% | Elite and boss damage |
| Star Koi | 2% | One-time lethal-hit prevention |

Display weight is derived from each fish's normalized size percentile and its
species range, so larger species can weigh several kilograms or more:

| Fish | Display weight range |
| --- | ---: |
| River Minnow | 0.02–0.18 kg |
| Reed Darter | 0.08–0.45 kg |
| Glassfin Trout | 0.25–2.50 kg |
| Silver Perch | 0.40–3.20 kg |
| Lantern Pike | 1.50–8.00 kg |
| Moon Carp | 2.00–14.00 kg |
| Tideback Catfish | 3.00–18.00 kg |
| Revival Koi | 1.00–7.00 kg |
| Comet Eel | 0.80–9.00 kg |
| Star Koi | 4.00–24.00 kg |

Most fish have no enchantment. Rod Enchanter rolls use a deterministic
server-side chance of 1% to 5% based on rod rarity. Enchantments initially apply
only to run-meal-eligible fish; Revival Koi remains reserved for Champion
recovery.

The initial enchantment pool is:

| Enchantment | Meal effect bonus |
| --- | ---: |
| Bright Scales | +15% |
| Deep Current | +25% |
| Astral Mark | +40% |

The enchantment ID and value are stored on the fish instance, shown in the
catch and inventory views, and included in the resolved run-meal snapshot.

## Inventory ordering

Inventory grids apply any screen-specific sorting priorities first. After those
priorities, the default fallback is always:

1. Item type/category, alphabetically ascending.
2. Rarity, from Legendary down to Common.
3. Essence, from highest to lowest.

Items that remain equal preserve their existing order. Fish Essence includes
their authoritative size and enchantment modifiers; other item types use their
defined salvage Essence value when available.

## Fish uses

### Essence salvage

Fish can be salvaged from the Inventory screen as a one-way conversion into
Essence. Salvaging consumes exactly one fish instance and uses the existing
idempotent inventory operation, so retries cannot consume or award the same
fish twice.

The server validates the fish definition and normalized size before awarding
Essence. It does not trust a client-provided value:

```text
base value = Common 2, Uncommon 5, Rare 10, Epic 20, Legendary 40
size factor = 0.5 + normalized size percentile
enchantment factor = 1 + enchantment value / 100, or 1 when unenchanted
essence = floor(base value * size factor * enchantment factor)
```

Fish definitions store their authoritative rarity on the server, and a fish
must contain a normalized size from `0` through `1`. Invalid fish metadata is
rejected rather than silently converted. The confirmation flow makes the
one-way consumption explicit, and the result displays the Essence awarded
after the inventory refreshes.

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

Revival Koi can reduce a Champion's Abyss exhaustion. It is reserved for
recovery and cannot be selected as a run meal. Revival use consumes the fish and
cannot be combined with run-meal use.

Revival power is based on rarity and normalized size:

```text
reduction = min(remaining exhaustion, base value * rarity factor * size factor)
```

The size factor and maximum reduction are content-defined and capped. A
high-quality fish may clear a full 24-hour timer; common small fish should
provide only a small reduction or be ineligible.

### Shop and other sinks

Fish have deliberately low salvage value. Their primary value comes from run
effects, Champion recovery, crafting or collection objectives, and trading.
Salvage must not become an infinite Essence farm.

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

Realtime fishing-pond presence and shared catch announcements are available.
Emotes and inspecting another player's equipment remain optional future social
features.
