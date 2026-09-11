import { RARITIES, Rarity } from '../content/rarity/Rarity'
import type { LootBoxRarity } from './LootBoxes'

/**
 * What is inside a box, and how often.
 *
 * The roll itself happens on the server, in `open_loot_box`, because a client
 * that decides its own loot decides its own economy. This table is the same
 * one written out for the interface to read: it is what the hover card shows
 * before a box is opened, and it is what a player checks a disappointing pull
 * against. `LootBoxContents.test.ts` parses the migration and fails if the two
 * ever stop agreeing, so this is a mirror rather than a second source.
 *
 * Weights are out of a thousand, matching the server's roll, and each entry's
 * weight is the width of its own band rather than the running cutoff the SQL
 * is written with.
 */
export interface LootBoxDropEntry {
  readonly definitionId: string
  /** Parts per thousand. The entries of one table sum to exactly 1000. */
  readonly weight: number
}

/**
 * A rod never drops from a box below its own rarity, and its odds only get
 * better in boxes above that. Within a box, the weight set aside for rods is
 * split the same way rarity itself is (`RARITY_WEIGHTS`): the higher a rod's
 * own tier, the smaller its slice, so the Starlit rod stays the rarest thing
 * in a legendary box even though it's the only box that can give it at all.
 *
 * Artifacts start at rare: one draw in twenty there, about one in eight from
 * an epic and one in four from a legendary, split evenly across the five
 * bases. Their weight is taken from the fish and bait, never from the rods.
 */
export const LOOT_BOX_DROP_TABLES: Readonly<Record<LootBoxRarity, readonly LootBoxDropEntry[]>> = {
  [Rarity.Common]: [
    { definitionId: 'river-minnow', weight: 550 },
    { definitionId: 'revival-koi', weight: 200 },
    { definitionId: 'river-worm', weight: 150 },
    { definitionId: 'glow-grub', weight: 50 },
    { definitionId: 'starter-fishing-rod', weight: 50 },
  ],
  [Rarity.Uncommon]: [
    { definitionId: 'river-minnow', weight: 400 },
    { definitionId: 'revival-koi', weight: 250 },
    { definitionId: 'river-worm', weight: 200 },
    { definitionId: 'glow-grub', weight: 100 },
    { definitionId: 'starter-fishing-rod', weight: 35 },
    { definitionId: 'silverline-fishing-rod', weight: 15 },
  ],
  [Rarity.Rare]: [
    { definitionId: 'river-minnow', weight: 225 },
    { definitionId: 'revival-koi', weight: 225 },
    { definitionId: 'river-worm', weight: 250 },
    { definitionId: 'glow-grub', weight: 150 },
    { definitionId: 'moonwater-lure', weight: 50 },
    { definitionId: 'starter-fishing-rod', weight: 32 },
    { definitionId: 'silverline-fishing-rod', weight: 13 },
    { definitionId: 'tideback-fishing-rod', weight: 5 },
    { definitionId: 'artifact-cartographers-compass', weight: 10 },
    { definitionId: 'artifact-ember-reliquary', weight: 10 },
    { definitionId: 'artifact-echoing-tuning-fork', weight: 10 },
    { definitionId: 'artifact-wayfarers-anklet', weight: 10 },
    { definitionId: 'artifact-gluttons-kettle', weight: 10 },
  ],
  [Rarity.Epic]: [
    { definitionId: 'river-minnow', weight: 160 },
    { definitionId: 'revival-koi', weight: 160 },
    { definitionId: 'river-worm', weight: 210 },
    { definitionId: 'glow-grub', weight: 200 },
    { definitionId: 'moonwater-lure', weight: 100 },
    { definitionId: 'starter-fishing-rod', weight: 30 },
    { definitionId: 'silverline-fishing-rod', weight: 13 },
    { definitionId: 'tideback-fishing-rod', weight: 5 },
    { definitionId: 'moonwater-fishing-rod', weight: 2 },
    { definitionId: 'artifact-cartographers-compass', weight: 24 },
    { definitionId: 'artifact-ember-reliquary', weight: 24 },
    { definitionId: 'artifact-echoing-tuning-fork', weight: 24 },
    { definitionId: 'artifact-wayfarers-anklet', weight: 24 },
    { definitionId: 'artifact-gluttons-kettle', weight: 24 },
  ],
  [Rarity.Legendary]: [
    { definitionId: 'river-minnow', weight: 50 },
    { definitionId: 'revival-koi', weight: 100 },
    { definitionId: 'river-worm', weight: 150 },
    { definitionId: 'glow-grub', weight: 200 },
    { definitionId: 'moonwater-lure', weight: 150 },
    { definitionId: 'starter-fishing-rod', weight: 60 },
    { definitionId: 'silverline-fishing-rod', weight: 25 },
    { definitionId: 'tideback-fishing-rod', weight: 10 },
    { definitionId: 'moonwater-fishing-rod', weight: 4 },
    { definitionId: 'starlit-fishing-rod', weight: 1 },
    { definitionId: 'artifact-cartographers-compass', weight: 50 },
    { definitionId: 'artifact-ember-reliquary', weight: 50 },
    { definitionId: 'artifact-echoing-tuning-fork', weight: 50 },
    { definitionId: 'artifact-wayfarers-anklet', weight: 50 },
    { definitionId: 'artifact-gluttons-kettle', weight: 50 },
  ],
}

/**
 * How many things a box of each rarity gives up.
 *
 * A box that always yielded exactly one item had nothing to build an opening
 * around: there was no reason to watch it. The count rises with the rarity so
 * that a legendary is worth the ceremony it gets.
 */
export const LOOT_BOX_ITEM_COUNTS: Readonly<Record<LootBoxRarity, number>> = {
  [Rarity.Common]: 1,
  [Rarity.Uncommon]: 1,
  [Rarity.Rare]: 2,
  [Rarity.Epic]: 3,
  [Rarity.Legendary]: 4,
}

export const LOOT_BOX_ROLL_RANGE = 1000

export function getLootBoxDropTable(rarity: LootBoxRarity): readonly LootBoxDropEntry[] {
  return LOOT_BOX_DROP_TABLES[rarity]
}

export function getLootBoxItemCount(rarity: LootBoxRarity): number {
  return LOOT_BOX_ITEM_COUNTS[rarity]
}

/** A drop's chance as a percentage, for display. */
export function getLootBoxDropPercent(entry: LootBoxDropEntry): number {
  return (entry.weight / LOOT_BOX_ROLL_RANGE) * 100
}

/**
 * The table sorted for reading: the best odds first, so the hover card opens
 * with what a player is most likely to actually get.
 */
export function getLootBoxDropTableForDisplay(
  rarity: LootBoxRarity,
): readonly LootBoxDropEntry[] {
  return [...getLootBoxDropTable(rarity)].sort((left, right) => right.weight - left.weight)
}

/** Every rarity, weakest first. Used to lay the boxes out in a fixed order. */
export const LOOT_BOX_RARITY_ORDER: readonly LootBoxRarity[] = RARITIES
