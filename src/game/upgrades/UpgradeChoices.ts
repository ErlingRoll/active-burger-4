import {
  BASIC_ATTACK_SKILL_ID,
  isSkillId,
} from '../../content/skills/Skills'
import type { SkillTag } from '../../content/skills/Skills'
import { getSkillDefinition } from '../../content/skills/Skills'
import {
  DEFAULT_SKILL_SLOT_COUNT,
  SKILL_REMOVAL_CHANCE,
} from '../../game-config/skills'
import { INITIAL_UPGRADES } from '../../content/upgrades/Upgrades'
import type {
  LevelUpUpgradeChoice,
  SkillRemovalChoice,
  SynergyRemovalChoice,
  UpgradeChoice,
  UpgradeEligibilityState,
  UpgradeDefinition,
} from '../../content/upgrades/Upgrades'
import {
  isSynergyUpgradeId,
  isSynergyUpgradeDefinition,
  REMOVE_SYNERGY_UPGRADE_ID,
} from '../../content/upgrades/Upgrades'
import type { RandomSource } from '../random/Random'
import type { GameState } from '../state/GameState'
import {
  RARITIES,
  RARITY_WEIGHTS,
  Rarity,
} from '../../content/rarity/Rarity'
import {
  DEFAULT_PLAYSTYLE_ID,
  getPlaystyleDefinition,
  isPlaystyleId,
} from '../../content/playstyles/Playstyles'
import {
  getSynergyPartnerSkillIds,
  SYNERGY_OFFER_CHANCE,
} from '../../game-config/synergies'

export const UPGRADE_CHOICES_PER_LEVEL = 3

type SelectableUpgradeDefinition = UpgradeDefinition & {
  id: UpgradeChoice['upgradeId']
}

/**
 * Generates unique choices from pure content definitions. The game supplies
 * runtime eligibility data and its own seeded RNG; content stays independent
 * from the simulation engine.
 */
export function generateUpgradeChoices(
  state: Readonly<GameState>,
  count: number,
  rng: RandomSource,
  synergyRng: RandomSource = rng,
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
    return upgrade.id !== 'remove-skill' &&
      upgrade.id !== REMOVE_SYNERGY_UPGRADE_ID
  }

  const choices: LevelUpUpgradeChoice[] = []
  const remainingUpgrades = eligible.filter(
    (upgrade) => !isSynergyUpgradeDefinition(upgrade),
  )
  const remainingSynergies = eligible.filter(isSynergyUpgradeDefinition)
  while (choices.length < count) {
    const selected = pickWeightedRarityUpgrade(remainingUpgrades, state, rng)
    if (!selected) {
      break
    }
    choices.push({ upgradeId: selected.id, rarity: selected.rarity })
    remainingUpgrades.splice(remainingUpgrades.indexOf(selected), 1)
  }

  for (let index = 0; index < choices.length; index += 1) {
    if (
      remainingSynergies.length === 0 ||
      !synergyRng.chance(SYNERGY_OFFER_CHANCE)
    ) {
      continue
    }
    const selected = pickWeightedUpgrade(remainingSynergies, state, synergyRng)
    if (!selected) {
      continue
    }
    choices[index] = { upgradeId: selected.id, rarity: selected.rarity }
    remainingSynergies.splice(remainingSynergies.indexOf(selected), 1)
  }

  while (choices.length < count && remainingSynergies.length > 0) {
    const selected = pickWeightedUpgrade(remainingSynergies, state, synergyRng)
    if (!selected) {
      break
    }
    choices.push({ upgradeId: selected.id, rarity: selected.rarity })
    remainingSynergies.splice(remainingSynergies.indexOf(selected), 1)
  }

  const removableSkillIds = state.player.skills
    .map((skill) => skill.skillId)
    .filter(isSkillId)
    .filter((skillId) => skillId !== BASIC_ATTACK_SKILL_ID)
  const activeSynergyIds = state.run.selectedUpgradeIds.filter(isSynergyUpgradeId)
  if (
    count > 0 &&
    (activeSynergyIds.length > 0 || removableSkillIds.length > 0) &&
    rng.chance(SKILL_REMOVAL_CHANCE)
  ) {
    if (activeSynergyIds.length > 0) {
      const synergyId = activeSynergyIds[
        rng.int(0, activeSynergyIds.length - 1)
      ]
      const removalChoice: SynergyRemovalChoice = {
        upgradeId: REMOVE_SYNERGY_UPGRADE_ID,
        synergyId,
        rarity: Rarity.Rare,
      }
      choices[choices.length - 1] = removalChoice
    } else if (removableSkillIds.length > 0) {
      const skillId = removableSkillIds[rng.int(0, removableSkillIds.length - 1)]
      const removalChoice: SkillRemovalChoice = {
        upgradeId: 'remove-skill',
        skillId,
        rarity: Rarity.Rare,
      }
      choices[choices.length - 1] = removalChoice
    }
  }
  return choices
}

function pickWeightedUpgrade(
  candidates: readonly SelectableUpgradeDefinition[],
  state: Readonly<GameState>,
  rng: RandomSource,
): SelectableUpgradeDefinition | undefined {
  const weights = candidates.map((upgrade) => ({
    upgrade,
    weight: getSkillUnlockWeight(upgrade, state),
  }))
  const totalWeight = weights.reduce((total, candidate) => total + candidate.weight, 0)
  let roll = rng.next() * totalWeight
  for (const candidate of weights) {
    roll -= candidate.weight
    if (roll < 0) {
      return candidate.upgrade
    }
  }
  return weights[weights.length - 1]?.upgrade
}

function pickWeightedRarityUpgrade(
  candidates: readonly SelectableUpgradeDefinition[],
  state: Readonly<GameState>,
  rng: RandomSource,
): SelectableUpgradeDefinition | undefined {
  if (candidates.length === 0) {
    return undefined
  }
  if (new Set(candidates.map((upgrade) => upgrade.rarity)).size === 1) {
    return pickWeightedUpgrade(candidates, state, rng)
  }

  const availableRarities = RARITIES.filter((rarity) =>
    candidates.some((upgrade) => upgrade.rarity === rarity),
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
  return pickWeightedUpgrade(
    candidates.filter((upgrade) => upgrade.rarity === selectedRarity),
    state,
    rng,
  )
}

export function getSkillUnlockWeight(
  upgrade: UpgradeDefinition,
  state: Readonly<GameState>,
): number {
  if (upgrade.skillAction !== 'unlock' || !upgrade.skillId) {
    return 1
  }
  const skill = getSkillDefinition(upgrade.skillId)
  const playstyleId = isPlaystyleId(state.player.playstyleId)
    ? state.player.playstyleId
    : DEFAULT_PLAYSTYLE_ID
  const affinityTags: readonly SkillTag[] =
    getPlaystyleDefinition(playstyleId).skillAffinity.tags
  const affinityWeight = skill.tags.some((tag) => affinityTags.includes(tag)) ? 3 : 1
  const ownedSkillIds = state.player.skills
    .map((candidate) => candidate.skillId)
    .filter(isSkillId)
  const synergyWeight = getSynergyPartnerSkillIds(upgrade.skillId, ownedSkillIds).length > 0
    ? 2
    : 1
  return affinityWeight * synergyWeight
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
