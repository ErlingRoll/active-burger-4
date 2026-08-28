import {
  BASIC_ATTACK_SKILL_ID,
  CHAIN_LIGHTNING_SKILL_ID,
  RAISE_SKELETON_SKILL_ID,
  VITALITY_SKILL_ID,
  WHIRLWIND_SKILL_ID,
} from './skills'
import type { UpgradeDefinition } from '../content/upgrades/Upgrades'

const BASIC_ATTACK_LEVEL_DAMAGE_INCREASE_PERCENT = 10
const WHIRLWIND_LEVEL_DAMAGE_INCREASE_PERCENT = 8
const CHAIN_LIGHTNING_LEVEL_DAMAGE_INCREASE_PERCENT = 9
const VITALITY_HEALING_INCREASE_PER_LEVEL = 2
const VITALITY_GLOBAL_HEALING_INCREASE_PERCENT = 2
const RAISE_SKELETON_LEVEL_DAMAGE_INCREASE_PERCENT = 8
const MAGNET_COLLECTION_RANGE_INCREASE_PERCENT = 10

export const INITIAL_UPGRADES: readonly UpgradeDefinition[] = [
  {
    id: 'raise-skeleton-unlock',
    name: 'Raise Skeleton',
    description: 'Unlock an automatic skeleton summoning skill.',
    category: 'skill',
    rarity: 'common',
    amount: 1,
    valueLabel: 'Unlock skill',
    skillId: RAISE_SKELETON_SKILL_ID,
    skillAction: 'unlock',
    isEligible: (state) =>
      state.ownedSkillIds.length < state.skillSlotCount &&
      !state.ownedSkillIds.includes(RAISE_SKELETON_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('raise-skeleton-unlock'),
  },
  {
    id: 'raise-skeleton-level',
    name: 'Hardened Bones',
    description: `Increase each skeleton's damage by ${RAISE_SKELETON_LEVEL_DAMAGE_INCREASE_PERCENT}% and max HP by 5.`,
    category: 'skill',
    rarity: 'common',
    amount: 1,
    valueLabel: `+${RAISE_SKELETON_LEVEL_DAMAGE_INCREASE_PERCENT}% skeleton damage, +5 skeleton max HP`,
    skillId: RAISE_SKELETON_SKILL_ID,
    skillAction: 'level',
    skillDamageIncreasePercent: RAISE_SKELETON_LEVEL_DAMAGE_INCREASE_PERCENT,
    isEligible: (state) => (state.skillLevels[RAISE_SKELETON_SKILL_ID] ?? 0) >= 1,
  },
  {
    id: 'raise-skeleton-max-count',
    name: 'Expanded Crypt',
    description: 'Increase the maximum number of active skeletons by 1.',
    category: 'skill',
    rarity: 'uncommon',
    amount: 1,
    valueLabel: '+1 maximum skeleton',
    skillId: RAISE_SKELETON_SKILL_ID,
    summonMaxCountIncrease: 1,
    isEligible: (state) => state.ownedSkillIds.includes(RAISE_SKELETON_SKILL_ID),
  },
  {
    id: 'whirlwind-leech',
    name: 'Sanguine Whirlwind',
    description: 'Whirlwind restores 2% of actual damage dealt.',
    category: 'skill',
    rarity: 'uncommon',
    amount: 0.02,
    valueLabel: '+2% Whirlwind leech',
    skillId: WHIRLWIND_SKILL_ID,
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
    id: 'magnet',
    name: 'Magnet',
    description: `Increase XP, health potion, equipment, and item collection range by ${MAGNET_COLLECTION_RANGE_INCREASE_PERCENT}%.`,
    category: 'passive',
    rarity: 'common',
    amount: MAGNET_COLLECTION_RANGE_INCREASE_PERCENT,
    valueLabel: `+${MAGNET_COLLECTION_RANGE_INCREASE_PERCENT}% collection range`,
    pickupCollectionRangeIncreasePercent: MAGNET_COLLECTION_RANGE_INCREASE_PERCENT,
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
      state.ownedSkillIds.length < state.skillSlotCount &&
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
      state.ownedSkillIds.length < state.skillSlotCount &&
      !state.ownedSkillIds.includes(CHAIN_LIGHTNING_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('chain-lightning-unlock'),
  },
  {
    id: 'vitality-unlock',
    name: 'Vitality',
    description: 'Unlock an automatic healing skill.',
    category: 'skill',
    rarity: 'common',
    amount: 1,
    valueLabel: 'Unlock skill',
    skillId: VITALITY_SKILL_ID,
    skillAction: 'unlock',
    isEligible: (state) =>
      state.ownedSkillIds.length < state.skillSlotCount &&
      !state.ownedSkillIds.includes(VITALITY_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('vitality-unlock'),
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
  {
    id: 'vitality-level',
    name: 'Greater Vitality',
    description: `Increase Vitality healing by ${VITALITY_HEALING_INCREASE_PER_LEVEL} HP per cast.`,
    category: 'skill',
    rarity: 'common',
    amount: 1,
    valueLabel: `+${VITALITY_HEALING_INCREASE_PER_LEVEL} HP per Vitality cast`,
    skillId: VITALITY_SKILL_ID,
    skillAction: 'level',
    skillHealingIncreaseAmount: VITALITY_HEALING_INCREASE_PER_LEVEL,
    isEligible: (state) => (state.skillLevels[VITALITY_SKILL_ID] ?? 0) >= 1,
  },
  {
    id: 'vitality-increased-healing',
    name: 'Restorative Vitality',
    description: `Increase healing from all sources by ${VITALITY_GLOBAL_HEALING_INCREASE_PERCENT}%.`,
    category: 'skill',
    rarity: 'uncommon',
    amount: VITALITY_GLOBAL_HEALING_INCREASE_PERCENT,
    valueLabel: `+${VITALITY_GLOBAL_HEALING_INCREASE_PERCENT}% increased healing`,
    skillId: VITALITY_SKILL_ID,
    increasedHealingPercent: VITALITY_GLOBAL_HEALING_INCREASE_PERCENT,
    isEligible: (state) => state.ownedSkillIds.includes(VITALITY_SKILL_ID),
  },
]
