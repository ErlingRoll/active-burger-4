import type { StatModifier, StatKey } from '../stats/Stats'
import type { SkillId } from '../skills/Skills'
import { INITIAL_UPGRADES } from '../../game-config/skill-upgrades'
import type { Rarity } from '../rarity/Rarity'

export const REMOVE_SKILL_UPGRADE_ID = 'remove-skill' as const
export type UpgradeId =
  | 'attack-speed-boost'
  | 'whirlwind-unlock'
  | 'chain-lightning-unlock'
  | 'basic-attack-level'
  | 'whirlwind-level'
  | 'chain-lightning-level'
  | 'vitality-unlock'
  | 'vitality-level'
  | 'vitality-increased-healing'
  | 'raise-skeleton-unlock'
  | 'raise-skeleton-level'
  | 'raise-skeleton-max-count'
  | 'whirlwind-leech'
  | 'magnet'
  | typeof REMOVE_SKILL_UPGRADE_ID
export type UpgradeCategory = 'passive' | 'skill'
export type UpgradeRarity = Rarity
export type UpgradeStat = Extract<
  StatKey,
  'attackDamage' | 'attackSpeed'
>
export type SkillUpgradeAction = 'unlock' | 'level'

export interface UpgradeChoice {
  upgradeId: Exclude<UpgradeId, typeof REMOVE_SKILL_UPGRADE_ID>
  rarity: UpgradeRarity
}

export interface SkillRemovalChoice {
  upgradeId: typeof REMOVE_SKILL_UPGRADE_ID
  skillId: SkillId
  rarity: UpgradeRarity
}

export type LevelUpUpgradeChoice = UpgradeChoice | SkillRemovalChoice

export interface UpgradeEligibilityState {
  playerLevel: number
  selectedUpgradeIds: readonly UpgradeId[]
  ownedSkillIds: readonly SkillId[]
  skillLevels: Readonly<Record<string, number>>
  skillSlotCount: number
}

export interface UpgradeDefinition {
  id: UpgradeId
  name: string
  description: string
  category: UpgradeCategory
  rarity: UpgradeRarity
  stat?: UpgradeStat
  amount: number
  /** Optional explicit modifiers for passive content and future scaling. */
  modifiers?: readonly StatModifier[]
  valueLabel: string
  skillId?: SkillId
  skillAction?: SkillUpgradeAction
  isEligible: (state: Readonly<UpgradeEligibilityState>) => boolean
  whirlwindLeechAmount?: number
  /** Additive pickup collection range increase per rank, expressed as a percent. */
  pickupCollectionRangeIncreasePercent?: number
  /** Percentage added to the skill's damage increase pool per rank. */
  skillDamageIncreasePercent?: number
  /** Flat healing added to the skill's cast amount per rank. */
  skillHealingIncreaseAmount?: number
  /** Percentage added to all healing received per rank. */
  increasedHealingPercent?: number
  /** Number of additional persistent summons allowed per rank. */
  summonMaxCountIncrease?: number
}

export { INITIAL_UPGRADES } from '../../game-config/skill-upgrades'

export function getUpgradeDefinition(upgradeId: UpgradeId): UpgradeDefinition {
  if (upgradeId === REMOVE_SKILL_UPGRADE_ID) {
    return {
      id: REMOVE_SKILL_UPGRADE_ID,
      name: 'Release Skill',
      description: 'Remove an acquired skill and lose all upgrades for it.',
      category: 'skill',
      rarity: 'rare',
      amount: 1,
      valueLabel: 'Remove skill',
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
): number {
  const levelUpgrade = INITIAL_UPGRADES.find(
    (upgrade) =>
      upgrade.skillId === skillId && upgrade.skillAction === 'level',
  )
  return Math.max(0, level - 1) *
    Math.max(0, levelUpgrade?.skillDamageIncreasePercent ?? 0)
}
