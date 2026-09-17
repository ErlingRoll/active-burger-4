import { RARITIES, RARITY_ORDER, Rarity } from '../content/rarity/Rarity'
import { ARTIFACT_RARITY_WEIGHTS } from '../content/artifacts/Artifacts'
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
  /**
   * How many of the thing one draw hands over. A single River Worm was a
   * wasted draw from a legendary box, so consumables come in stacks that
   * grow with the box; anything with its own roll, a rod, a fish, an
   * artifact, is always one.
   */
  readonly quantity: number
}

/**
 * The rules a box of each rarity opens under, beside its table.
 *
 * The tables alone could not make a legendary box feel legendary: four
 * independent draws from a table that was half bait gave no floor under the
 * pull, and the artifact's own rarity roll ignored the box entirely, so a
 * legendary box handed out a common artifact two draws in five. These rules
 * are what the box promises before the draws start.
 */
export interface LootBoxRules {
  /** Draws from the table, each rolled on its own. */
  readonly draws: number
  /**
   * Artifacts handed over before the draws, base chosen at random and
   * rolled under the box's floors. The legendary box's one certain thing.
   */
  readonly guaranteedArtifacts: number
  /**
   * The lowest rarity an artifact from this box can roll. The roll keeps
   * the relative weights of the rarities from the floor upward, so a
   * legendary box's artifact is epic five times in six and legendary once.
   */
  readonly artifactRarityFloor: Rarity | null
  /**
   * The least Potential an artifact from this box is made with, so a
   * legendary box's artifact is the best base the Forge can be given.
   */
  readonly artifactPotentialMin: number | null
  /** Where a fish's size percentile starts; the roll fills up to 0.95 above it. */
  readonly fishSizeFloor: number
  /** Chance, per hundred, that a meal fish comes out enchanted. Never a Revival Koi. */
  readonly fishEnchantmentChancePercent: number
}

function drop(definitionId: string, weight: number, quantity = 1): LootBoxDropEntry {
  return { definitionId, weight, quantity }
}

const ARTIFACT_BASE_IDS = [
  'artifact-cartographers-compass',
  'artifact-ember-reliquary',
  'artifact-echoing-tuning-fork',
  'artifact-wayfarers-anklet',
  'artifact-gluttons-kettle',
] as const

function artifacts(weightEach: number): LootBoxDropEntry[] {
  return ARTIFACT_BASE_IDS.map((definitionId) => drop(definitionId, weightEach))
}

/**
 * A rod never drops from a box below its own rarity, nor from one more than
 * a tier above it: the Wooden rod is a stick with yarn on it, and it has no
 * business in a rare box. Within a box, the weight set aside for rods
 * favours the tier nearest the box's own, so the Starlit rod stays the
 * rarest thing in a legendary box even though it is the only box that can
 * give it at all, and it can be given at all: about one legendary box in
 * thirty, not one in two hundred and fifty.
 *
 * Artifacts start at rare, about one draw in ten there, one in five and a
 * half from an epic and one in four from a legendary, split evenly across
 * the five bases, and a legendary box hands one over before its draws begin.
 *
 * Fish are the real meal species from the rare box up, each stamped with its
 * own rarity rather than the box's, so a box never produces a legendary
 * minnow. Bait comes in stacks that grow with the box, and the legendary
 * table carries a bundle of rift shards, which with the box's artifact is the
 * fee to work it at the Forge.
 */
export const LOOT_BOX_DROP_TABLES: Readonly<Record<LootBoxRarity, readonly LootBoxDropEntry[]>> = {
  [Rarity.Common]: [
    drop('river-minnow', 550),
    drop('revival-koi', 200),
    drop('river-worm', 150),
    drop('glow-grub', 50),
    drop('starter-fishing-rod', 50),
  ],
  [Rarity.Uncommon]: [
    drop('river-minnow', 400),
    drop('revival-koi', 250),
    drop('river-worm', 200),
    drop('glow-grub', 100),
    drop('starter-fishing-rod', 35),
    drop('silverline-fishing-rod', 15),
  ],
  [Rarity.Rare]: [
    drop('river-minnow', 175),
    drop('revival-koi', 200),
    drop('moon-carp', 50),
    drop('river-worm', 200, 2),
    drop('glow-grub', 180, 2),
    drop('moonwater-lure', 60, 2),
    drop('silverline-fishing-rod', 22),
    drop('tideback-fishing-rod', 18),
    ...artifacts(19),
  ],
  [Rarity.Epic]: [
    drop('river-minnow', 100),
    drop('revival-koi', 150),
    drop('moon-carp', 60),
    drop('comet-eel', 30),
    drop('river-worm', 130, 3),
    drop('glow-grub', 180, 3),
    drop('moonwater-lure', 130, 3),
    drop('tideback-fishing-rod', 24),
    drop('moonwater-fishing-rod', 16),
    ...artifacts(36),
  ],
  [Rarity.Legendary]: [
    drop('revival-koi', 100),
    drop('moon-carp', 60),
    drop('comet-eel', 60),
    drop('star-koi', 30),
    drop('glow-grub', 100, 5),
    drop('moonwater-lure', 250, 5),
    drop('rift-shard', 100, 8),
    drop('moonwater-fishing-rod', 40),
    drop('starlit-fishing-rod', 10),
    ...artifacts(50),
  ],
}

/**
 * The legendary box's artifact is made with at least this much Potential,
 * where any other artifact rolls from thirty: it is meant to be worked.
 */
export const LEGENDARY_LOOT_BOX_ARTIFACT_POTENTIAL_MIN = 70

export const LOOT_BOX_RULES: Readonly<Record<LootBoxRarity, LootBoxRules>> = {
  [Rarity.Common]: {
    draws: 1,
    guaranteedArtifacts: 0,
    artifactRarityFloor: null,
    artifactPotentialMin: null,
    fishSizeFloor: 0.25,
    fishEnchantmentChancePercent: 0,
  },
  [Rarity.Uncommon]: {
    draws: 1,
    guaranteedArtifacts: 0,
    artifactRarityFloor: null,
    artifactPotentialMin: null,
    fishSizeFloor: 0.3,
    fishEnchantmentChancePercent: 0,
  },
  [Rarity.Rare]: {
    draws: 2,
    guaranteedArtifacts: 0,
    artifactRarityFloor: Rarity.Uncommon,
    artifactPotentialMin: null,
    fishSizeFloor: 0.4,
    fishEnchantmentChancePercent: 0,
  },
  [Rarity.Epic]: {
    draws: 3,
    guaranteedArtifacts: 0,
    artifactRarityFloor: Rarity.Rare,
    artifactPotentialMin: null,
    fishSizeFloor: 0.5,
    fishEnchantmentChancePercent: 50,
  },
  [Rarity.Legendary]: {
    draws: 3,
    guaranteedArtifacts: 1,
    artifactRarityFloor: Rarity.Epic,
    artifactPotentialMin: LEGENDARY_LOOT_BOX_ARTIFACT_POTENTIAL_MIN,
    fishSizeFloor: 0.65,
    fishEnchantmentChancePercent: 100,
  },
}

/** The top of the size range a box fish can roll to, whatever the floor. */
export const LOOT_BOX_FISH_SIZE_CEILING = 0.95

export const LOOT_BOX_ROLL_RANGE = 1000

export function getLootBoxDropTable(rarity: LootBoxRarity): readonly LootBoxDropEntry[] {
  return LOOT_BOX_DROP_TABLES[rarity]
}

export function getLootBoxRules(rarity: LootBoxRarity): LootBoxRules {
  return LOOT_BOX_RULES[rarity]
}

/**
 * How many things a box of each rarity gives up: its guaranteed artifacts
 * and then its draws.
 *
 * A box that always yielded exactly one item had nothing to build an opening
 * around: there was no reason to watch it. The count rises with the rarity so
 * that a legendary is worth the ceremony it gets.
 */
export function getLootBoxItemCount(rarity: LootBoxRarity): number {
  const rules = LOOT_BOX_RULES[rarity]
  return rules.guaranteedArtifacts + rules.draws
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

/**
 * The chance of each rarity for an artifact out of this box, as fractions
 * that sum to one: the artifact table's own weights, cut off at the box's
 * floor and renormalised. Null for a box that gives no artifacts.
 */
export function getLootBoxArtifactRarityChances(
  rarity: LootBoxRarity,
): Readonly<Record<Rarity, number>> | null {
  const floor = LOOT_BOX_RULES[rarity].artifactRarityFloor
  const hasArtifacts = LOOT_BOX_DROP_TABLES[rarity].some((entry) => entry.definitionId.startsWith('artifact-')) ||
    LOOT_BOX_RULES[rarity].guaranteedArtifacts > 0
  if (!hasArtifacts) {
    return null
  }
  const floorIndex = floor === null ? 0 : RARITY_ORDER[floor]
  const total = RARITIES.reduce(
    (sum, candidate) => RARITY_ORDER[candidate] >= floorIndex ? sum + ARTIFACT_RARITY_WEIGHTS[candidate] : sum,
    0,
  )
  return Object.fromEntries(RARITIES.map((candidate) => [
    candidate,
    RARITY_ORDER[candidate] >= floorIndex ? ARTIFACT_RARITY_WEIGHTS[candidate] / total : 0,
  ])) as Record<Rarity, number>
}

/** Every rarity, weakest first. Used to lay the boxes out in a fixed order. */
export const LOOT_BOX_RARITY_ORDER: readonly LootBoxRarity[] = RARITIES
