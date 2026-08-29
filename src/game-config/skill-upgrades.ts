import {
  BASIC_ATTACK_SKILL_ID,
  CHAIN_LIGHTNING_SKILL_ID,
  FIERY_TOUCH_SKILL_ID,
  RAISE_SKELETON_SKILL_ID,
  VITALITY_SKILL_ID,
  WHIRLWIND_SKILL_ID,
} from './skills'
import type { UpgradeDefinition } from '../content/upgrades/Upgrades'

const BASIC_ATTACK_LEVEL_DAMAGE_INCREASE_PERCENT = 10
const WHIRLWIND_LEVEL_DAMAGE_INCREASE_PERCENT = 8
const CHAIN_LIGHTNING_LEVEL_DAMAGE_INCREASE_PERCENT = 9
const FIERY_TOUCH_LEVEL_DAMAGE_INCREASE = 5
const FIERY_TOUCH_COOLDOWN_REDUCTION_PERCENT = 5
const VITALITY_HEALING_INCREASE_PER_LEVEL = 2
const VITALITY_GLOBAL_HEALING_INCREASE_PERCENT = 2
const RAISE_SKELETON_LEVEL_DAMAGE_INCREASE_PERCENT = 8
const MAGNET_COLLECTION_RANGE_INCREASE_PERCENT = 20
const VITALITY_MAX_HP_HEALING_PERCENT = 3
const VITALITY_LOW_HP_HEALING_MULTIPLIER = 2
const VITALITY_LOW_HP_DAMAGE_REDUCTION_PERCENT = 20
const WHIRLWIND_FROST_STACKS = 1
const WHIRLWIND_GUARD_DAMAGE_REDUCTION_PERCENT = 15
const BASIC_ATTACK_RANGE_INCREASE = 15
const FIERY_TOUCH_DAMAGE_INCREASE_PERCENT = 25
const SKELETON_MAX_HP_INCREASE = 12

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
    branch: 'raise-skeleton-horde',
    summonMaxCountIncrease: 1,
    isEligible: (state) => state.ownedSkillIds.includes(RAISE_SKELETON_SKILL_ID),
  },
  {
    id: 'raise-skeleton-guardian',
    name: 'Guardian Bones',
    description: 'Skeletons gain 12 maximum HP and hold the frontline longer.',
    category: 'skill',
    rarity: 'uncommon',
    amount: SKELETON_MAX_HP_INCREASE,
    valueLabel: `+${SKELETON_MAX_HP_INCREASE} skeleton maximum HP`,
    skillId: RAISE_SKELETON_SKILL_ID,
    branch: 'raise-skeleton-guardian',
    summonMaxHpIncrease: SKELETON_MAX_HP_INCREASE,
    isEligible: (state) =>
      state.ownedSkillIds.includes(RAISE_SKELETON_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('raise-skeleton-guardian'),
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
    id: 'whirlwind-frost',
    name: 'Rime Cyclone',
    description: 'Whirlwind applies Chill and briefly freezes enemies after repeated hits.',
    category: 'skill',
    rarity: 'uncommon',
    amount: WHIRLWIND_FROST_STACKS,
    valueLabel: '+1 Chill stack per Whirlwind hit',
    skillId: WHIRLWIND_SKILL_ID,
    branch: 'whirlwind-control',
    whirlwindFrostStacks: WHIRLWIND_FROST_STACKS,
    isEligible: (state) =>
      state.ownedSkillIds.includes(WHIRLWIND_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('whirlwind-frost'),
  },
  {
    id: 'whirlwind-guard',
    name: 'Whirlwind Guard',
    description: 'Whirlwind grants 15% damage reduction for 1 second after it hits.',
    category: 'skill',
    rarity: 'uncommon',
    amount: WHIRLWIND_GUARD_DAMAGE_REDUCTION_PERCENT,
    valueLabel: '+15% Whirlwind Guard damage reduction',
    skillId: WHIRLWIND_SKILL_ID,
    branch: 'whirlwind-guard',
    whirlwindGuardDamageReductionPercent: WHIRLWIND_GUARD_DAMAGE_REDUCTION_PERCENT,
    isEligible: (state) =>
      state.ownedSkillIds.includes(WHIRLWIND_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('whirlwind-guard'),
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
    id: 'basic-attack-barrage',
    name: 'Barrage',
    description: 'Basic Attack fires 0.15 attacks per second faster.',
    category: 'skill',
    rarity: 'uncommon',
    stat: 'attackSpeed',
    amount: 0.15,
    modifiers: [
      { stat: 'attackSpeed', operation: 'add', value: 0.15, sourceId: 'upgrade:basic-attack-barrage' },
    ],
    valueLabel: '+0.15 Basic Attack attacks/sec',
    skillId: BASIC_ATTACK_SKILL_ID,
    branch: 'basic-attack-barrage',
    isEligible: (state) =>
      state.ownedSkillIds.includes(BASIC_ATTACK_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('basic-attack-barrage'),
  },
  {
    id: 'basic-attack-precision',
    name: 'Deadeye',
    description: 'Basic Attack gains 15 attack range for safer positioning.',
    category: 'skill',
    rarity: 'uncommon',
    stat: 'attackRange',
    amount: BASIC_ATTACK_RANGE_INCREASE,
    modifiers: [
      { stat: 'attackRange', operation: 'add', value: BASIC_ATTACK_RANGE_INCREASE, sourceId: 'upgrade:basic-attack-precision' },
    ],
    valueLabel: `+${BASIC_ATTACK_RANGE_INCREASE} Basic Attack range`,
    skillId: BASIC_ATTACK_SKILL_ID,
    branch: 'basic-attack-precision',
    isEligible: (state) =>
      state.ownedSkillIds.includes(BASIC_ATTACK_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('basic-attack-precision'),
  },
  {
    id: 'magnet',
    name: 'Magnet',
    description: `Increase XP, health potion, equipment, and item collection range by ${MAGNET_COLLECTION_RANGE_INCREASE_PERCENT}%.`,
    category: 'passive',
    rarity: 'rare',
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
    id: 'fiery-touch-unlock',
    name: 'Fiery Touch',
    description: 'Unlocks a fire burst that triggers when you directly hit an enemy.',
    category: 'skill',
    rarity: 'common',
    amount: 1,
    valueLabel: 'Unlock skill',
    skillId: FIERY_TOUCH_SKILL_ID,
    skillAction: 'unlock',
    isEligible: (state) =>
      state.ownedSkillIds.length < state.skillSlotCount &&
      !state.ownedSkillIds.includes(FIERY_TOUCH_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('fiery-touch-unlock'),
  },
  {
    id: 'fiery-touch-level',
    name: 'Kindled Touch',
    description: `Increase Fiery Touch damage by ${FIERY_TOUCH_LEVEL_DAMAGE_INCREASE}.`,
    category: 'skill',
    rarity: 'common',
    amount: 1,
    valueLabel: `+${FIERY_TOUCH_LEVEL_DAMAGE_INCREASE} Fiery Touch fire damage per level`,
    skillId: FIERY_TOUCH_SKILL_ID,
    skillAction: 'level',
    isEligible: (state) => (state.skillLevels[FIERY_TOUCH_SKILL_ID] ?? 0) >= 1,
  },
  {
    id: 'fiery-touch-cooldown-reduction',
    name: 'Rapid Ignition',
    description: `Reduce Fiery Touch cooldown by ${FIERY_TOUCH_COOLDOWN_REDUCTION_PERCENT}%. This upgrade is repeatable.`,
    category: 'skill',
    rarity: 'uncommon',
    amount: FIERY_TOUCH_COOLDOWN_REDUCTION_PERCENT,
    valueLabel: `+${FIERY_TOUCH_COOLDOWN_REDUCTION_PERCENT}% Fiery Touch cooldown reduction`,
    skillId: FIERY_TOUCH_SKILL_ID,
    branch: 'fiery-touch-frequency',
    skillCooldownReductionPercent: FIERY_TOUCH_COOLDOWN_REDUCTION_PERCENT,
    isEligible: (state) => state.ownedSkillIds.includes(FIERY_TOUCH_SKILL_ID),
  },
  {
    id: 'fiery-touch-ember',
    name: 'Emberstorm',
    description: `Fiery Touch deals ${FIERY_TOUCH_DAMAGE_INCREASE_PERCENT}% more damage, but does not gain extra triggers.`,
    category: 'skill',
    rarity: 'uncommon',
    amount: FIERY_TOUCH_DAMAGE_INCREASE_PERCENT,
    valueLabel: `+${FIERY_TOUCH_DAMAGE_INCREASE_PERCENT}% Fiery Touch damage`,
    skillId: FIERY_TOUCH_SKILL_ID,
    branch: 'fiery-touch-ember',
    fieryTouchDamageIncreasePercent: FIERY_TOUCH_DAMAGE_INCREASE_PERCENT,
    isEligible: (state) =>
      state.ownedSkillIds.includes(FIERY_TOUCH_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('fiery-touch-ember'),
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
  {
    id: 'vitality-renewal',
    name: 'Renewal',
    description: 'Vitality also heals 3% of maximum HP, making steady regeneration and overheal more valuable.',
    category: 'skill',
    rarity: 'uncommon',
    amount: VITALITY_MAX_HP_HEALING_PERCENT,
    valueLabel: `+${VITALITY_MAX_HP_HEALING_PERCENT}% maximum HP per cast`,
    skillId: VITALITY_SKILL_ID,
    branch: 'vitality-renewal',
    vitalityMaxHpHealingPercent: VITALITY_MAX_HP_HEALING_PERCENT,
    isEligible: (state) =>
      state.ownedSkillIds.includes(VITALITY_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('vitality-renewal'),
  },
  {
    id: 'vitality-last-stand',
    name: 'Last Stand',
    description: 'Below 40% health, Vitality heals for twice as much and you take 20% less damage.',
    category: 'skill',
    rarity: 'uncommon',
    amount: VITALITY_LOW_HP_HEALING_MULTIPLIER,
    valueLabel: '2x low-health healing, 20% low-health damage reduction',
    skillId: VITALITY_SKILL_ID,
    branch: 'vitality-last-stand',
    vitalityLowHpHealingMultiplier: VITALITY_LOW_HP_HEALING_MULTIPLIER,
    vitalityLowHpDamageReductionPercent: VITALITY_LOW_HP_DAMAGE_REDUCTION_PERCENT,
    isEligible: (state) =>
      state.ownedSkillIds.includes(VITALITY_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('vitality-last-stand'),
  },
  {
    id: 'chain-lightning-frost',
    name: 'Freezing Conduit',
    description: 'Chain Lightning applies Chill to every enemy it hits.',
    category: 'skill',
    rarity: 'uncommon',
    amount: 1,
    valueLabel: '+1 Chill stack per lightning hit',
    skillId: CHAIN_LIGHTNING_SKILL_ID,
    branch: 'chain-lightning-frost',
    chainLightningFrost: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(CHAIN_LIGHTNING_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('chain-lightning-frost'),
  },
  {
    id: 'chain-lightning-overload',
    name: 'Overload',
    description: 'Chain Lightning applies Shock; three stacks detonate for 150% lightning damage.',
    category: 'skill',
    rarity: 'uncommon',
    amount: 1,
    valueLabel: 'Shock stacks and overload detonations',
    skillId: CHAIN_LIGHTNING_SKILL_ID,
    branch: 'chain-lightning-overload',
    chainLightningOverload: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(CHAIN_LIGHTNING_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('chain-lightning-overload'),
  },
]
