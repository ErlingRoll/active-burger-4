import { isSkillId } from '../../content/skills/Skills'
import { INITIAL_UPGRADES } from '../../content/upgrades/Upgrades'
import type {
  UpgradeChoice,
  UpgradeEligibilityState,
} from '../../content/upgrades/Upgrades'
import type { RandomSource } from '../random/Random'
import type { GameState } from '../state/GameState'
import { RARITIES, RARITY_WEIGHTS } from '../../content/rarity/Rarity'

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
    selectedUpgradeIds: state.run.selectedUpgradeIds,
    ownedSkillIds: state.player.skills
      .map((skill) => skill.skillId)
      .filter(isSkillId),
    skillLevels: Object.fromEntries(
      state.player.skills.map((skill) => [skill.skillId, skill.level]),
    ),
  }
  const eligible = INITIAL_UPGRADES.filter((upgrade) =>
    upgrade.isEligible(eligibilityState),
  )

  if (eligible.length < count) {
    throw new Error(
      `Cannot generate ${count} unique upgrade choices from ${eligible.length} eligible upgrades.`,
    )
  }

  if (new Set(eligible.map((upgrade) => upgrade.rarity)).size === 1) {
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
    return shuffled
      .slice(0, count)
      .map((upgrade) => ({ upgradeId: upgrade.id, rarity: upgrade.rarity }))
  }

  const remaining = [...eligible]
  const choices: UpgradeChoice[] = []
  while (choices.length < count) {
    const availableRarities = RARITIES.filter((rarity) =>
      remaining.some((upgrade) => upgrade.rarity === rarity),
    )
    const totalWeight = availableRarities.reduce(
      (total, rarity) => total + RARITY_WEIGHTS[rarity],
      0,
    )
    let roll = rng.next() * totalWeight
    let selectedRarity = availableRarities[availableRarities.length - 1]
    for (const rarity of availableRarities) {
      roll -= RARITY_WEIGHTS[rarity]
      if (roll < 0) {
        selectedRarity = rarity
        break
      }
    }
    const candidates = remaining.filter(
      (upgrade) => upgrade.rarity === selectedRarity,
    )
    const selected = candidates[rng.int(0, candidates.length - 1)]
    if (selected) {
      choices.push({ upgradeId: selected.id, rarity: selected.rarity })
      remaining.splice(remaining.indexOf(selected), 1)
    }
  }
  return choices
}
