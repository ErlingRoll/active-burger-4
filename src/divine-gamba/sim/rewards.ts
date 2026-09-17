import type { DivineGambaMachineConfig } from './types.ts'
import type { DivineGambaRandom } from './random.ts'

/**
 * What a pocket pays, in whole Essence.
 *
 * Integer arithmetic, floored, so the SQL that re-computes the sum when a play
 * settles gets the same number from the same table.
 */
export function pocketPayout(
  machine: DivineGambaMachineConfig,
  pocketIndex: number,
  stakePrice: number,
): number {
  const pocket = machine.pockets[pocketIndex]
  if (pocket === undefined) {
    return 0
  }
  return Math.floor(stakePrice * pocket.multiplierPercent / 100)
}

/** A pocket's box chance in basis points, capped at certain. */
export function pocketBoxChanceBasisPoints(
  machine: DivineGambaMachineConfig,
  pocketIndex: number,
): number {
  const pocket = machine.pockets[pocketIndex]
  if (pocket === undefined) {
    return 0
  }
  const chance = Math.floor(pocket.boxChanceBasisPoints)
  return chance > 10000 ? 10000 : chance < 0 ? 0 : chance
}

/** The rarities a box can be, in the order the weights are walked. */
export const BOX_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const

/**
 * Rolls whether a landed ball brings a box and, if so, which rarity.
 *
 * Always draws once for the box so every ball uses its stream the same way
 * whatever pocket it fell into; draws a second time only when a box is due.
 * The weights are walked in `BOX_RARITIES` order; a rarity the table does not
 * name has no weight and is never drawn.
 */
export function rollBox(
  machine: DivineGambaMachineConfig,
  pocketIndex: number,
  random: DivineGambaRandom,
): string | null {
  const chance = pocketBoxChanceBasisPoints(machine, pocketIndex)
  const roll = random.nextBasisPoints()
  if (roll >= chance) {
    return null
  }
  let total = 0
  for (const rarity of BOX_RARITIES) {
    total += weightOf(machine, rarity)
  }
  if (total <= 0) {
    return null
  }
  let pick = random.nextUint() % total
  for (const rarity of BOX_RARITIES) {
    const weight = weightOf(machine, rarity)
    if (pick < weight) {
      return rarity
    }
    pick -= weight
  }
  return BOX_RARITIES[BOX_RARITIES.length - 1] ?? null
}

function weightOf(machine: DivineGambaMachineConfig, rarity: string): number {
  const weight = machine.boxRarityWeights[rarity]
  return weight === undefined || weight < 0 ? 0 : Math.floor(weight)
}
