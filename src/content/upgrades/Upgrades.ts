import type { StatModifier } from '../stats/Stats'
import {
  BASIC_ATTACK_SKILL_ID,
  getSkillDefinition,
  type SkillId,
} from '../skills/Skills'
import type { DamageType } from '../stats/Damage'
import { INITIAL_UPGRADES } from '../../game-config/skill-upgrades'
import { Rarity } from '../rarity/Rarity'
import {
  getSkillSynergyEffectPercent,
  SYNERGY_UPGRADES,
} from '../../game-config/synergies'
import {
  REMOVE_SKILL_UPGRADE_ID,
  REMOVE_SYNERGY_UPGRADE_ID,
} from './UpgradeTypes'
import type { UpgradeDefinition, UpgradeId } from './UpgradeTypes'

export {
  REMOVE_SKILL_UPGRADE_ID,
  REMOVE_SYNERGY_UPGRADE_ID,
  getSkillChoiceType,
  getSkillUpgradeType,
  isSynergyUpgradeDefinition,
} from './UpgradeTypes'
export type {
  LevelUpUpgradeChoice,
  SkillChoiceType,
  SkillEvolutionId,
  SkillRemovalChoice,
  SkillUpgradeAction,
  SkillUpgradeType,
  SynergyEffect,
  SynergyRemovalChoice,
  SynergyUpgradeDefinition,
  UpgradeCategory,
  UpgradeChoice,
  UpgradeDefinition,
  UpgradeEligibilityState,
  UpgradeId,
  UpgradeRarity,
  UpgradeStat,
} from './UpgradeTypes'

export { INITIAL_UPGRADES } from '../../game-config/skill-upgrades'
export {
  SYNERGY_OFFER_CHANCE,
  SYNERGY_UPGRADES,
  getSynergyPartnerSkillIds,
  getSkillSynergyEffectPercent,
  isSynergyActive,
  isSkillSynergyActive,
  isSynergyPairEligible,
} from '../../game-config/synergies'

export function isSynergyUpgradeId(upgradeId: UpgradeId): boolean {
  return SYNERGY_UPGRADES.some((synergy) => synergy.id === upgradeId)
}

export function getUpgradeDefinition(upgradeId: UpgradeId): UpgradeDefinition {
  if (upgradeId === REMOVE_SKILL_UPGRADE_ID) {
    return {
      id: REMOVE_SKILL_UPGRADE_ID,
      name: 'Release Skill',
      description: 'Remove an acquired skill and lose all upgrades for it.',
      category: 'skill',
      rarity: Rarity.Rare,
      amount: 1,
      valueLabel: 'Remove skill',
      isEligible: () => false,
    }
  }
  if (upgradeId === REMOVE_SYNERGY_UPGRADE_ID) {
    return {
      id: REMOVE_SYNERGY_UPGRADE_ID,
      name: 'Release Synergy',
      description: 'Remove an active synergy and free both of its skill links.',
      category: 'skill',
      rarity: Rarity.Rare,
      amount: 1,
      valueLabel: 'Release synergy',
      isEligible: () => false,
    }
  }
  const definition = INITIAL_UPGRADES.find(
    (candidate) => candidate.id === upgradeId,
  )
  if (!definition) {
    throw new Error(`Unknown upgrade definition: ${upgradeId}`)
  }

  return definition
}

export function getUpgradeDescription(upgrade: UpgradeDefinition): string {
  if (upgrade.skillAction === 'level') {
    if (!upgrade.skillId) {
      throw new Error(`Level upgrade ${upgrade.id} must reference a skill.`)
    }
    return `+1 Level to ${getSkillDefinition(upgrade.skillId).name}`
  }
  if (!upgrade.evolution) {
    return upgrade.description
  }
  if (upgrade.repeatable) {
    return `${upgrade.description} Each additional rank: ${upgrade.valueLabel}.`
  }
  if (!upgrade.skillId) {
    throw new Error(`Evolution ${upgrade.id} must reference a skill.`)
  }

  const skillRankUpgrade = INITIAL_UPGRADES.find(
    (candidate) =>
      candidate.skillId === upgrade.skillId && candidate.skillAction === 'level',
  )
  if (!skillRankUpgrade) {
    throw new Error(
      `Evolution ${upgrade.id} has no level upgrade for skill ${upgrade.skillId}.`,
    )
  }

  const rankEffect = upgrade.evolutionRankValueLabel ??
    skillRankUpgrade.valueLabel.replace(/\s+per level$/i, '')
  return `${upgrade.description} Each additional rank: ${rankEffect}.`
}

export function getUpgradeChoiceDescription(upgrade: UpgradeDefinition): string {
  if (
    upgrade.skillId === BASIC_ATTACK_SKILL_ID &&
    upgrade.evolution !== undefined &&
    upgrade.repeatable !== true
  ) {
    return upgrade.description
  }
  return getUpgradeDescription(upgrade)
}

export function getBasicAttackDamageConversionType(
  selectedUpgradeIds: readonly UpgradeId[],
): Exclude<DamageType, 'physical'> | undefined {
  return INITIAL_UPGRADES.find((upgrade) =>
    selectedUpgradeIds.includes(upgrade.id) &&
    upgrade.basicAttackDamageConversionType !== undefined
  )?.basicAttackDamageConversionType
}

export function getBasicAttackMorePhysicalDamagePercent(
  selectedUpgradeIds: readonly UpgradeId[],
): number {
  return INITIAL_UPGRADES.reduce(
    (total, upgrade) =>
      selectedUpgradeIds.includes(upgrade.id)
        ? total + (upgrade.basicAttackMorePhysicalDamagePercent ?? 0)
        : total,
    0,
  )
}

export function getUpgradeModifiers(
  definition: UpgradeDefinition,
): readonly StatModifier[] {
  if (definition.modifiers) {
    return definition.modifiers
  }
  if (!definition.stat) {
    return []
  }
  return [{
    stat: definition.stat,
    operation: 'add',
    value: definition.amount,
    sourceId: `upgrade:${definition.id}`,
  }]
}

export function getSkillDamageIncreasePercent(
  skillId: SkillId,
  level: number,
  selectedUpgradeIds: readonly UpgradeId[] = [],
): number {
  const levelUpgrade = INITIAL_UPGRADES.find(
    (upgrade) =>
      upgrade.skillId === skillId && upgrade.skillAction === 'level',
  )
  return Math.max(0, level - 1) *
    Math.max(0, levelUpgrade?.skillDamageIncreasePercent ?? 0) +
    getSkillSynergyEffectPercent(
      skillId,
      selectedUpgradeIds,
      'damageIncreasePercent',
    )
}

export function getSkillCooldownReductionPercent(
  skillId: SkillId,
  selectedUpgradeIds: readonly UpgradeId[],
): number {
  const upgrade = INITIAL_UPGRADES.find(
    (candidate) =>
      candidate.skillId === skillId &&
      candidate.skillCooldownReductionPercent !== undefined,
  )
  if (!upgrade?.skillCooldownReductionPercent) {
    return 0
  }
  return selectedUpgradeIds.filter((upgradeId) => upgradeId === upgrade.id).length *
    upgrade.skillCooldownReductionPercent
}

export function getRallyingBannerAreaOfEffectPercent(
  selectedUpgradeIds: readonly UpgradeId[],
): number {
  const upgrade = INITIAL_UPGRADES.find(
    (candidate) => candidate.rallyingBannerAreaOfEffectPercent !== undefined,
  )
  if (!upgrade?.rallyingBannerAreaOfEffectPercent) {
    return 0
  }
  return selectedUpgradeIds.filter((upgradeId) => upgradeId === upgrade.id).length *
    upgrade.rallyingBannerAreaOfEffectPercent
}
