import { INITIAL_UPGRADES } from '../../content/upgrades/Upgrades'
import type {
  UpgradeChoice,
  UpgradeEligibilityState,
} from '../../content/upgrades/Upgrades'
import type { RandomSource } from '../random/Random'
import type { GameState } from '../state/GameState'

export const UPGRADE_CHOICES_PER_LEVEL = 3

/**
 * Generates unique choices from pure content definitions. The game supplies
 * runtime eligibility data and its own seeded RNG; content stays independent
 * from the simulation engine.
 */
export function generateUpgradeChoices(
  state: Readonly<GameState>,
  count: number,
  rng: RandomSource,
): UpgradeChoice[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`Upgrade choice count must be a non-negative integer: ${count}`)
  }

  const eligibilityState: UpgradeEligibilityState = {
    playerLevel: state.player.level,
    selectedUpgradeIds: [],
  }
  const eligible = INITIAL_UPGRADES.filter((upgrade) =>
    upgrade.isEligible(eligibilityState),
  )

  if (eligible.length < count) {
    throw new Error(
      `Cannot generate ${count} unique upgrade choices from ${eligible.length} eligible upgrades.`,
    )
  }

  const shuffled = [...eligible]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = rng.int(0, index)
    const current = shuffled[index]
    const replacement = shuffled[swapIndex]
    if (current && replacement) {
      shuffled[index] = replacement
      shuffled[swapIndex] = current
    }
  }

  return shuffled.slice(0, count).map((upgrade) => ({ upgradeId: upgrade.id }))
}
