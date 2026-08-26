import {
  BASIC_ATTACK_SKILL_ID,
  CHAIN_LIGHTNING_SKILL_ID,
  WHIRLWIND_SKILL_ID,
  type SkillId,
} from '../skills/Skills'
import type { Rarity } from '../rarity/Rarity'
import type { StatModifier, StatKey } from '../stats/Stats'

export type UpgradeId =
  | 'damage-boost'
  | 'attack-speed-boost'
  | 'whirlwind-unlock'
  | 'chain-lightning-unlock'
  | 'basic-attack-level'
  | 'whirlwind-level'
  | 'chain-lightning-level'
  | 'whirlwind-leech'
export type UpgradeCategory = 'passive' | 'skill'
export type UpgradeRarity = Rarity
export type UpgradeStat = Extract<
  StatKey,
  'attackDamage' | 'attackSpeed'
>
export type SkillUpgradeAction = 'unlock' | 'level'

export interface UpgradeChoice {
  upgradeId: UpgradeId
  rarity: UpgradeRarity
}

export interface UpgradeEligibilityState {
  playerLevel: number
  selectedUpgradeIds: readonly UpgradeId[]
  ownedSkillIds: readonly SkillId[]
  skillLevels: Readonly<Record<string, number>>
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
  meleeLeechAmount?: number
}

const hasSkill = (
  state: Readonly<UpgradeEligibilityState>,
  skillId: SkillId,
): boolean => state.ownedSkillIds.includes(skillId)

const skillLevelAtLeast = (
  state: Readonly<UpgradeEligibilityState>,
  skillId: SkillId,
  level: number,
): boolean => (state.skillLevels[skillId] ?? 0) >= level

/**
 * Stat upgrades remain repeatable. Unlock upgrades disappear after acquisition,
 * while rank upgrades become eligible once their skill is owned.
 */
export const INITIAL_UPGRADES: readonly UpgradeDefinition[] = [
  {
    id: 'whirlwind-leech',
    name: 'Sanguine Whirlwind',
    description: 'Whirlwind restores 2% of actual melee damage dealt.',
    category: 'skill',
    rarity: 'uncommon',
    amount: 0.02,
    valueLabel: '+2% melee leech',
    skillId: WHIRLWIND_SKILL_ID,
    skillAction: 'unlock',
    meleeLeechAmount: 0.02,
    isEligible: (state) => hasSkill(state, WHIRLWIND_SKILL_ID),
  },
  {
    id: 'damage-boost',
    name: 'Heavy Hitter',
    description: 'Increase Basic Attack damage.',
    category: 'passive',
    rarity: 'common',
    stat: 'attackDamage',
    amount: 2,
    modifiers: [
      { stat: 'attackDamage', operation: 'add', value: 2, sourceId: 'upgrade:damage-boost' },
    ],
    valueLabel: '+2 damage',
    skillId: BASIC_ATTACK_SKILL_ID,
    isEligible: () => true,
  },
  {
    id: 'attack-speed-boost',
    name: 'Rapid Fire',
    description: 'Attack more often with Basic Attack.',
    category: 'passive',
    rarity: 'common',
    stat: 'attackSpeed',
    amount: 0.2,
    modifiers: [
      { stat: 'attackSpeed', operation: 'add', value: 0.2, sourceId: 'upgrade:attack-speed-boost' },
    ],
    valueLabel: '+0.2 attacks/sec',
    skillId: BASIC_ATTACK_SKILL_ID,
    isEligible: () => true,
  },
  {
    id: 'whirlwind-unlock',
    name: 'Whirlwind',
    description: 'Unlock a close-range area attack.',
    category: 'skill',
    rarity: 'common',
    amount: 1,
    valueLabel: 'Unlock skill',
    skillId: WHIRLWIND_SKILL_ID,
    skillAction: 'unlock',
    isEligible: (state) =>
      !hasSkill(state, WHIRLWIND_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('whirlwind-unlock'),
  },
  {
    id: 'chain-lightning-unlock',
    name: 'Chain Lightning',
    description: 'Unlock a lightning attack that jumps between enemies.',
    category: 'skill',
    rarity: 'common',
    amount: 1,
    valueLabel: 'Unlock skill',
    skillId: CHAIN_LIGHTNING_SKILL_ID,
    skillAction: 'unlock',
    isEligible: (state) =>
      !hasSkill(state, CHAIN_LIGHTNING_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('chain-lightning-unlock'),
  },
  {
    id: 'basic-attack-level',
    name: 'Empowered Attack',
    description: 'Increase Basic Attack skill rank.',
    category: 'skill',
    rarity: 'common',
    amount: 1,
    valueLabel: '+1 Basic Attack rank',
    skillId: BASIC_ATTACK_SKILL_ID,
    skillAction: 'level',
    isEligible: (state) => skillLevelAtLeast(state, BASIC_ATTACK_SKILL_ID, 1),
  },
  {
    id: 'whirlwind-level',
    name: 'Sharpened Whirlwind',
    description: 'Increase Whirlwind damage with a skill rank.',
    category: 'skill',
    rarity: 'common',
    amount: 1,
    valueLabel: '+1 Whirlwind rank',
    skillId: WHIRLWIND_SKILL_ID,
    skillAction: 'level',
    isEligible: (state) => skillLevelAtLeast(state, WHIRLWIND_SKILL_ID, 1),
  },
  {
    id: 'chain-lightning-level',
    name: 'Conductive Lightning',
    description: 'Increase Chain Lightning damage with a skill rank.',
    category: 'skill',
    rarity: 'common',
    amount: 1,
    valueLabel: '+1 Chain Lightning rank',
    skillId: CHAIN_LIGHTNING_SKILL_ID,
    skillAction: 'level',
    isEligible: (state) =>
      skillLevelAtLeast(state, CHAIN_LIGHTNING_SKILL_ID, 1),
  },
]

export function getUpgradeDefinition(upgradeId: UpgradeId): UpgradeDefinition {
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
