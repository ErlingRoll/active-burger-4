import {
  BASIC_ATTACK_SKILL_ID,
  CHAIN_LIGHTNING_SKILL_ID,
  WHIRLWIND_SKILL_ID,
} from './skills'
import type { UpgradeDefinition } from '../content/upgrades/Upgrades'

const BASIC_ATTACK_LEVEL_DAMAGE_INCREASE_PERCENT = 10
const WHIRLWIND_LEVEL_DAMAGE_INCREASE_PERCENT = 8
const CHAIN_LIGHTNING_LEVEL_DAMAGE_INCREASE_PERCENT = 9

export const INITIAL_UPGRADES: readonly UpgradeDefinition[] = [
  {
    id: 'whirlwind-leech',
    name: 'Sanguine Whirlwind',
    description: 'Whirlwind restores 2% of actual damage dealt.',
    category: 'skill',
    rarity: 'uncommon',
    amount: 0.02,
    valueLabel: '+2% Whirlwind leech',
    skillId: WHIRLWIND_SKILL_ID,
    skillAction: 'unlock',
    whirlwindLeechAmount: 0.02,
    isEligible: (state) => state.ownedSkillIds.includes(WHIRLWIND_SKILL_ID),
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
      !state.ownedSkillIds.includes(WHIRLWIND_SKILL_ID) &&
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
      !state.ownedSkillIds.includes(CHAIN_LIGHTNING_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('chain-lightning-unlock'),
  },
  {
    id: 'basic-attack-level',
    name: 'Empowered Attack',
    description: `Increase Basic Attack damage by ${BASIC_ATTACK_LEVEL_DAMAGE_INCREASE_PERCENT}%.`,
    category: 'skill',
    rarity: 'common',
    amount: 1,
    valueLabel: `+${BASIC_ATTACK_LEVEL_DAMAGE_INCREASE_PERCENT}% Basic Attack damage`,
    skillId: BASIC_ATTACK_SKILL_ID,
    skillAction: 'level',
    skillDamageIncreasePercent: BASIC_ATTACK_LEVEL_DAMAGE_INCREASE_PERCENT,
    isEligible: (state) => (state.skillLevels[BASIC_ATTACK_SKILL_ID] ?? 0) >= 1,
  },
  {
    id: 'whirlwind-level',
    name: 'Sharpened Whirlwind',
    description: `Increase Whirlwind damage by ${WHIRLWIND_LEVEL_DAMAGE_INCREASE_PERCENT}%.`,
    category: 'skill',
    rarity: 'common',
    amount: 1,
    valueLabel: `+${WHIRLWIND_LEVEL_DAMAGE_INCREASE_PERCENT}% Whirlwind damage`,
    skillId: WHIRLWIND_SKILL_ID,
    skillAction: 'level',
    skillDamageIncreasePercent: WHIRLWIND_LEVEL_DAMAGE_INCREASE_PERCENT,
    isEligible: (state) => (state.skillLevels[WHIRLWIND_SKILL_ID] ?? 0) >= 1,
  },
  {
    id: 'chain-lightning-level',
    name: 'Conductive Lightning',
    description: `Increase Chain Lightning damage by ${CHAIN_LIGHTNING_LEVEL_DAMAGE_INCREASE_PERCENT}%.`,
    category: 'skill',
    rarity: 'common',
    amount: 1,
    valueLabel: `+${CHAIN_LIGHTNING_LEVEL_DAMAGE_INCREASE_PERCENT}% Chain Lightning damage`,
    skillId: CHAIN_LIGHTNING_SKILL_ID,
    skillAction: 'level',
    skillDamageIncreasePercent: CHAIN_LIGHTNING_LEVEL_DAMAGE_INCREASE_PERCENT,
    isEligible: (state) => (state.skillLevels[CHAIN_LIGHTNING_SKILL_ID] ?? 0) >= 1,
  },
]
