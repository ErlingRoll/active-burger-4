import {
  BASIC_ATTACK_SKILL_ID,
  isSkillId,
} from '../../content/skills/Skills'
import {
  DEFAULT_SKILL_SLOT_COUNT,
  SKILL_REMOVAL_CHANCE,
} from '../../game-config/skills'
import { INITIAL_UPGRADES } from '../../content/upgrades/Upgrades'
import type {
  LevelUpUpgradeChoice,
  SkillRemovalChoice,
  UpgradeChoice,
  UpgradeEligibilityState,
  UpgradeDefinition,
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
): LevelUpUpgradeChoice[] {
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
    skillSlotCount: getSkillSlotCount(state),
  }
  const eligible = INITIAL_UPGRADES
    .filter((upgrade) => upgrade.isEligible(eligibilityState))
    .filter((upgrade) => isBranchCompatible(upgrade, eligibilityState))
    .filter(isSelectableUpgrade)

  if (eligible.length < count) {
    throw new Error(
      `Cannot generate ${count} unique upgrade choices from ${eligible.length} eligible upgrades.`,
    )
  }

    function isSelectableUpgrade(
    upgrade: UpgradeDefinition,
  ): upgrade is UpgradeDefinition & { id: UpgradeChoice['upgradeId'] } {
    return upgrade.id !== 'remove-skill'
  }

  const choices: LevelUpUpgradeChoice[] = []
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
    choices.push(
      ...shuffled
        .slice(0, count)
        .map((upgrade) => ({ upgradeId: upgrade.id, rarity: upgrade.rarity })),
    )
  } else {
    const remaining = [...eligible]
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
  }

  const removableSkillIds = state.player.skills
    .map((skill) => skill.skillId)
    .filter(isSkillId)
    .filter((skillId) => skillId !== BASIC_ATTACK_SKILL_ID)
  if (
    count > 0 &&
    removableSkillIds.length > 0 &&
    rng.chance(SKILL_REMOVAL_CHANCE)
  ) {
    const skillId = removableSkillIds[rng.int(0, removableSkillIds.length - 1)]
    const removalChoice: SkillRemovalChoice = {
      upgradeId: 'remove-skill',
      skillId,
      rarity: 'rare',
    }
    choices[choices.length - 1] = removalChoice
  }
  return choices
}

function isBranchCompatible(
  upgrade: UpgradeDefinition,
  state: UpgradeEligibilityState,
): boolean {
  if (!upgrade.branch) {
    return true
  }
  return !state.selectedUpgradeIds.some((selectedId) => {
    const selected = INITIAL_UPGRADES.find((candidate) => candidate.id === selectedId)
    if (!selected) {
      return false
    }
    return selected.skillId === upgrade.skillId &&
      selected.branch !== undefined &&
      selected.branch !== upgrade.branch
  })
}

function getSkillSlotCount(state: Readonly<GameState>): number {
  const configuredCount = state.player.skillSlotCount
  return typeof configuredCount === 'number' && Number.isFinite(configuredCount)
    ? Math.max(1, Math.floor(configuredCount))
    : DEFAULT_SKILL_SLOT_COUNT
}
