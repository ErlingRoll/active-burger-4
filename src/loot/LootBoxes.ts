import {
  RARITIES,
  Rarity,
  isRarity,
  type Rarity as RarityValue,
} from '../content/rarity/Rarity'

export type LootBoxRarity = RarityValue

export interface LootBoxDefinition {
  id: string
  rarity: LootBoxRarity
  name: string
}

export const LOOT_BOX_DEFINITIONS: Readonly<Record<LootBoxRarity, LootBoxDefinition>> = {
  [Rarity.Common]: { id: 'loot-box-common', rarity: Rarity.Common, name: 'Common Loot Box' },
  [Rarity.Uncommon]: { id: 'loot-box-uncommon', rarity: Rarity.Uncommon, name: 'Uncommon Loot Box' },
  [Rarity.Rare]: { id: 'loot-box-rare', rarity: Rarity.Rare, name: 'Rare Loot Box' },
  [Rarity.Epic]: { id: 'loot-box-epic', rarity: Rarity.Epic, name: 'Epic Loot Box' },
  [Rarity.Legendary]: { id: 'loot-box-legendary', rarity: Rarity.Legendary, name: 'Legendary Loot Box' },
}

export function isLootBoxRarity(value: unknown): value is LootBoxRarity {
  return isRarity(value)
}

export function getLootBoxDefinition(rarity: LootBoxRarity): LootBoxDefinition {
  return LOOT_BOX_DEFINITIONS[rarity]
}

/**
 * The rarity roll is a number in [0, 10000) and each rarity owns a band of it.
 * The bands widen and narrow with the floor alone: the danger score and the
 * seed only pick where in the range the roll lands.
 *
 * One function computes the cutoffs for both the resolver and the chance
 * table, so the odds the HUD shows can never drift from what the roll does.
 * The database trigger `grant_abyss_floor_loot_box` carries the same formula
 * and is what actually awards the box.
 */
const ROLL_RANGE = 10000

/** Every 10th floor pays at least an epic box, whatever the curve says. */
const MILESTONE_FLOOR_INTERVAL = 10
/**
 * Of the milestone roll's range, the share added on top of the floor's own
 * legendary band: a milestone's legendary chance is the curve's plus five
 * points, so the tenth floor is a better floor than the ninth in every rarity,
 * not only in its floor.
 */
const MILESTONE_LEGENDARY_BONUS = 500

function isMilestoneFloor(completedFloor: number): boolean {
  return Math.max(1, Math.floor(completedFloor)) % MILESTONE_FLOOR_INTERVAL === 0
}

function abyssLootBoxRollCutoffs(completedFloor: number): {
  readonly common: number
  readonly uncommon: number
  readonly rare: number
  readonly epic: number
} {
  const floor = Math.max(1, Math.floor(completedFloor))
  const progress = Math.min(1, floor / 100)
  const common = Math.floor(8000 - progress * 5000)
  const uncommon = common + Math.floor(1700 + progress * 1000)
  const rare = uncommon + Math.floor(300 + progress * 1200)
  const epic = rare + Math.floor(progress * 1500)
  return { common, uncommon, rare, epic }
}

/** The milestone roll's legendary band: the curve's own band plus the bonus. */
function milestoneLegendaryCutoff(epicCutoff: number): number {
  return ROLL_RANGE - epicCutoff + MILESTONE_LEGENDARY_BONUS
}

export function resolveAbyssLootBoxRarity(
  seed: number,
  completedFloor: number,
  dangerScore: number,
): LootBoxRarity {
  if (!Number.isSafeInteger(seed) || !Number.isSafeInteger(completedFloor)) {
    throw new Error('Loot-box resolution requires integer seed and floor values.')
  }
  const floor = Math.max(1, Math.floor(completedFloor))
  const rarityFloor = Math.min(floor, 100)
  const danger = Math.max(0, Math.floor(dangerScore))
  const normalizedSeed = seed >>> 0
  const mixedSeed = (
    normalizedSeed +
    rarityFloor * 2654435761 +
    danger * 97
  ) >>> 0
  const roll = mixedSeed % ROLL_RANGE
  const cutoffs = abyssLootBoxRollCutoffs(floor)
  if (isMilestoneFloor(floor)) {
    const bonusMixedSeed = (mixedSeed ^ 0x5bd1e995) >>> 0
    return bonusMixedSeed % ROLL_RANGE < milestoneLegendaryCutoff(cutoffs.epic)
      ? Rarity.Legendary
      : Rarity.Epic
  }
  if (roll < cutoffs.common) return Rarity.Common
  if (roll < cutoffs.uncommon) return Rarity.Uncommon
  if (roll < cutoffs.rare) return Rarity.Rare
  if (roll < cutoffs.epic) return Rarity.Epic
  return Rarity.Legendary
}

/**
 * The probability of each box rarity for completing the given Abyss floor,
 * as fractions that sum to one. The floor is what the player is on now: the
 * box is graded by the floor being left, so the odds for floor N are the odds
 * shown while floor N is in play.
 */
export function getAbyssLootBoxRarityChances(
  completedFloor: number,
): Readonly<Record<LootBoxRarity, number>> {
  const cutoffs = abyssLootBoxRollCutoffs(completedFloor)
  if (isMilestoneFloor(completedFloor)) {
    const legendary = milestoneLegendaryCutoff(cutoffs.epic) / ROLL_RANGE
    return {
      [Rarity.Common]: 0,
      [Rarity.Uncommon]: 0,
      [Rarity.Rare]: 0,
      [Rarity.Epic]: 1 - legendary,
      [Rarity.Legendary]: legendary,
    }
  }
  return {
    [Rarity.Common]: cutoffs.common / ROLL_RANGE,
    [Rarity.Uncommon]: (cutoffs.uncommon - cutoffs.common) / ROLL_RANGE,
    [Rarity.Rare]: (cutoffs.rare - cutoffs.uncommon) / ROLL_RANGE,
    [Rarity.Epic]: (cutoffs.epic - cutoffs.rare) / ROLL_RANGE,
    [Rarity.Legendary]: (ROLL_RANGE - cutoffs.epic) / ROLL_RANGE,
  }
}

/**
 * Rift shards paid beside the floor box: one a floor, and one more for every
 * five floors down, to six. The database trigger `grant_abyss_floor_loot_box`
 * carries the same formula and is what actually grants them; this copy is
 * what the HUD counts with, so the two must not drift.
 */
const RIFT_SHARDS_PER_FLOOR_CAP = 6
const RIFT_SHARD_BONUS_FLOOR_INTERVAL = 5

export function getAbyssFloorRiftShards(completedFloor: number): number {
  const floor = Math.max(1, Math.floor(completedFloor))
  return Math.min(
    RIFT_SHARDS_PER_FLOOR_CAP,
    1 + Math.floor(floor / RIFT_SHARD_BONUS_FLOOR_INTERVAL),
  )
}

/** The shards a descent has banked after completing the given number of floors. */
export function getAbyssRiftShardsBanked(completedFloors: number): number {
  let total = 0
  for (let floor = 1; floor <= completedFloors; floor += 1) {
    total += getAbyssFloorRiftShards(floor)
  }
  return total
}

export function getAbyssLootBoxRarityLabel(rarity: LootBoxRarity): string {
  return RARITIES.find((candidate) => candidate === rarity)!.replace(/^./, (letter) =>
    letter.toUpperCase(),
  )
}
