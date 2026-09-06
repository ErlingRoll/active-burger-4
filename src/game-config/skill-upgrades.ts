import {
  BASIC_ATTACK_SKILL_ID,
  CHAIN_LIGHTNING_SKILL_ID,
  FIERY_TOUCH_SKILL_ID,
  RAISE_SKELETON_SKILL_ID,
  VITALITY_SKILL_ID,
  WHIRLWIND_SKILL_ID,
  WHIRLWIND_CYCLONE_AREA_OF_EFFECT_PER_STACK,
  WHIRLWIND_CYCLONE_COOLDOWN_REDUCTION_PER_STACK,
  WHIRLWIND_CYCLONE_GATHERING_STORM_DECAY_SECONDS,
  WHIRLWIND_CYCLONE_MAX_STACKS,
  GLACIAL_ORB_SKILL_ID,
  GLACIAL_ORB_PERMAFROST_RADIUS_BONUS,
  LANCERS_CHARGE_SKILL_ID,
  LANCERS_CHARGE_MOMENTUM_PERCENT_PER_STACK,
  LANCERS_CHARGE_VANGUARD_MOMENTUM_PERCENT_PER_STACK,
  LANCERS_CHARGE_VANGUARD_SINGLE_TARGET_BONUS_PERCENT,
  LANCERS_CHARGE_IMPALER_DAMAGE_REDUCTION_PERCENT,
  LANCERS_CHARGE_IMPALER_RANGE_BONUS,
  LANCERS_CHARGE_IMPALER_WIDTH_BONUS,
  RALLYING_BANNER_SKILL_ID,
  RALLYING_BANNER_BASE_DAMAGE_REDUCTION_PERCENT,
  RALLYING_BANNER_BULWARK_DAMAGE_REDUCTION_BONUS_PERCENT,
  RALLYING_BANNER_BULWARK_DURATION_BONUS_SECONDS,
  RALLYING_BANNER_BASE_DURATION_SECONDS,
  RALLYING_BANNER_AREA_OF_EFFECT_PER_RANK,
  RALLYING_BANNER_COMMANDER_COOLDOWN_REDUCTION_PERCENT,
  VITALITY_HEALING_PER_LEVEL,
  GRAVITY_WELL_SKILL_ID,
  GRAVITY_WELL_SINGULARITY_PULL_BONUS,
  GRAVITY_WELL_SINGULARITY_RADIUS_BONUS,
  GRAVITY_WELL_EVENT_HORIZON_DAMAGE_INCREASE_PERCENT,
  AEGIS_PULSE_SKILL_ID,
  AEGIS_PULSE_SHIELD_AMOUNT_PER_LEVEL,
  AEGIS_PULSE_BULWARK_SHIELD_AMOUNT_BONUS,
  AEGIS_PULSE_BULWARK_DURATION_BONUS_SECONDS,
  AEGIS_PULSE_REPRISAL_RATIO,
  FROST_MAX_CHILL_STACKS,
  FROST_DEFAULT_FREEZE_DURATION_SECONDS,
  RIFT_JAVELIN_SKILL_ID,
  RIFT_JAVELIN_BARBED_DURATION_SECONDS,
  RIFT_JAVELIN_HOMEWARD_DAMAGE_INCREASE_PERCENT,
  CINDER_MINE_SKILL_ID,
  CINDER_MINE_BURNING_FIRE_DAMAGE_RATIO,
  CINDER_MINE_CLUSTER_DAMAGE_MULTIPLIER,
  CINDER_MINE_INFERNO_BURNING_RATIO_BONUS,
  CINDER_MINE_INFERNO_RADIUS_BONUS,
  STORM_RELAY_SKILL_ID,
  STORM_RELAY_OVERCHARGE_STRIKE_INTERVAL_SECONDS,
  STORM_RELAY_STRIKE_INTERVAL_SECONDS,
  STORM_RELAY_CONDUIT_PULL_RADIUS,
  SOUL_TETHER_SKILL_ID,
  SOUL_TETHER_SIPHON_HEALING_BONUS,
  SOUL_TETHER_REQUIEM_BURST_TARGET_COUNT,
  PHANTOM_ARSENAL_SKILL_ID,
  PHANTOM_ARSENAL_VOLLEY_MAX_COUNT_BONUS,
  PHANTOM_ARSENAL_VOLLEY_DAMAGE_REDUCTION_PERCENT,
  PHANTOM_ARSENAL_MARKSMAN_RANGE_BONUS_PERCENT,
  PHANTOM_ARSENAL_MARKSMAN_DAMAGE_INCREASE_PERCENT,
  SIGIL_OF_RUIN_SKILL_ID,
  SIGIL_OF_RUIN_EXECUTION_DAMAGE_MULTIPLIER,
  SIGIL_OF_RUIN_CONTAGIOUS_STORED_CAP_MULTIPLIER,
  SIGIL_OF_RUIN_EXECUTION_HP_THRESHOLD,
  MIRRORCAST_SKILL_ID,
  MIRRORCAST_BASE_EFFECTIVENESS,
  MIRRORCAST_DOUBLE_EXPOSURE_EFFECTIVENESS,
  MIRRORCAST_DEFERRED_EFFECTIVENESS,
  MIRRORCAST_DOUBLE_EXPOSURE_ECHO_COUNT,
  CRITICAL_SPELLSTRIKE_SKILL_ID,
  CRITICAL_SPELLSTRIKE_BASE_EFFECTIVENESS,
  CRITICAL_SPELLSTRIKE_EFFECTIVENESS_PER_LEVEL,
  CRITICAL_SPELLSTRIKE_RAPID_COOLDOWN_SECONDS,
  CRITICAL_SPELLSTRIKE_OVERWHELMING_EFFECTIVENESS,
  RAZORWIRE_SKILL_ID,
  RAZORWIRE_TRIPWIRE_COUNT,
  RAZORWIRE_TRIPWIRE_DAMAGE_MULTIPLIER,
  RAZORWIRE_GUILLOTINE_SNAP_DAMAGE_MULTIPLIER,
  RAZORWIRE_GUILLOTINE_TENSION_CAP,
  BLOOD_RITE_SKILL_ID,
  BLOOD_RITE_CRIMSON_CHARGES,
  BLOOD_RITE_SANGUINE_HEAL_RATIO,
  PRISM_HALO_SKILL_ID,
  PRISM_HALO_REFRACTION_MAX_SPLITS,
  PRISM_HALO_REFRACTION_DAMAGE_MULTIPLIER,
  PRISM_HALO_CONVERGENCE_BURST_MULTIPLIER,
  PRISM_HALO_CONVERGENCE_WINDOW_SECONDS,
  RAISE_SKELETON_LEGION_BASE_ATTACK_SPEED_INCREASE_PERCENT,
  RAISE_SKELETON_LEGION_ATTACK_SPEED_PER_ADDITIONAL_SKELETON_PERCENT,
  RAISE_SKELETON_LEGION_MAX_ATTACK_SPEED_INCREASE_PERCENT,
  RAISE_SKELETON_ROTTING_BONES_POISON_DURATION_SECONDS,
  RAISE_SKELETON_ROTTING_BONES_POISON_PHYSICAL_CHAOS_RATIO,
} from './skills'
import type { UpgradeDefinition } from '../content/upgrades/Upgrades'
import { Rarity } from '../content/rarity/Rarity'
import { SYNERGY_UPGRADES } from './synergies'

const BASIC_ATTACK_LEVEL_DAMAGE_INCREASE_PERCENT = 10
const WHIRLWIND_LEVEL_DAMAGE_INCREASE_PERCENT = 8
const CHAIN_LIGHTNING_LEVEL_DAMAGE_INCREASE_PERCENT = 9
const CHAIN_LIGHTNING_CHAIN_INCREASE = 1
const FIERY_TOUCH_LEVEL_DAMAGE_INCREASE_PERCENT = 8
const FIERY_TOUCH_COOLDOWN_REDUCTION_PERCENT = 5
const VITALITY_GLOBAL_HEALING_INCREASE_PERCENT = 5
const RAISE_SKELETON_LEVEL_DAMAGE_INCREASE_PERCENT = 8
const MAGNET_COLLECTION_RANGE_INCREASE_PERCENT = 20
const VITALITY_MAX_HP_HEALING_PERCENT = 3
const VITALITY_LOW_HP_HEALING_MULTIPLIER = 2
const VITALITY_LOW_HP_DAMAGE_REDUCTION_PERCENT = 20
const WHIRLWIND_FROST_STACKS = 1
const WHIRLWIND_GUARD_DAMAGE_REDUCTION_PERCENT = 15
const BASIC_ATTACK_DAMAGE_CONVERSION_PERCENT = 70
const BASIC_ATTACK_MORE_PHYSICAL_DAMAGE_PERCENT = 10
const FIERY_TOUCH_DAMAGE_INCREASE_PERCENT = 25
const SKELETON_MAX_HP_INCREASE = 12
const GLACIAL_ORB_LEVEL_DAMAGE_INCREASE_PERCENT = 8
const GLACIAL_ORB_PERMAFROST_FROST_STACKS = 1
const GLACIAL_ORB_ICE_LANCE_DAMAGE_INCREASE_PERCENT = 40
const LANCERS_CHARGE_LEVEL_DAMAGE_INCREASE_PERCENT = 8
const RALLYING_BANNER_HEALING_INCREASE_PER_LEVEL = 2
const GRAVITY_WELL_LEVEL_DAMAGE_INCREASE_PERCENT = 9
const AEGIS_PULSE_LEVEL_DAMAGE_INCREASE_PERCENT = 8
const RIFT_JAVELIN_LEVEL_DAMAGE_INCREASE_PERCENT = 9
const CINDER_MINE_LEVEL_DAMAGE_INCREASE_PERCENT = 8
const STORM_RELAY_LEVEL_DAMAGE_INCREASE_PERCENT = 8
const SOUL_TETHER_LEVEL_DAMAGE_INCREASE_PERCENT = 8
const PHANTOM_ARSENAL_LEVEL_DAMAGE_INCREASE_PERCENT = 8
const SIGIL_OF_RUIN_LEVEL_DAMAGE_INCREASE_PERCENT = 9
const MIRRORCAST_LEVEL_EFFECTIVENESS_INCREASE_PERCENT = 8
const RAZORWIRE_LEVEL_DAMAGE_INCREASE_PERCENT = 8
const BLOOD_RITE_LEVEL_DAMAGE_INCREASE_PERCENT = 9
const PRISM_HALO_LEVEL_DAMAGE_INCREASE_PERCENT = 8

export const INITIAL_UPGRADES: readonly UpgradeDefinition[] = [
  {
    id: 'raise-skeleton-unlock',
    name: 'Raise Skeleton',
    description: 'Unlock an automatic skeleton summoning skill.',
    category: 'skill',
    rarity: Rarity.Common,
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
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: `+${RAISE_SKELETON_LEVEL_DAMAGE_INCREASE_PERCENT}% increased skeleton damage, +5 skeleton max HP`,
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
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: '+1 maximum skeleton',
    skillId: RAISE_SKELETON_SKILL_ID,
    summonMaxCountIncrease: 1,
    isEligible: (state) => state.ownedSkillIds.includes(RAISE_SKELETON_SKILL_ID),
  },
  {
    id: 'raise-skeleton-guardian',
    name: 'Guardian Bones',
    description: 'Skeletons gain 12 maximum HP and hold the frontline longer.',
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: SKELETON_MAX_HP_INCREASE,
    valueLabel: `+${SKELETON_MAX_HP_INCREASE} skeleton maximum HP`,
    skillId: RAISE_SKELETON_SKILL_ID,
    summonMaxHpIncrease: SKELETON_MAX_HP_INCREASE,
    isEligible: (state) =>
      state.ownedSkillIds.includes(RAISE_SKELETON_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('raise-skeleton-guardian'),
  },
  {
    id: 'raise-skeleton-legion',
    name: 'Grave Legion',
    description: `Skeletons attack ${RAISE_SKELETON_LEGION_BASE_ATTACK_SPEED_INCREASE_PERCENT}% faster. Each additional living skeleton grants another ${RAISE_SKELETON_LEGION_ATTACK_SPEED_PER_ADDITIONAL_SKELETON_PERCENT}% attack speed, up to ${RAISE_SKELETON_LEGION_MAX_ATTACK_SPEED_INCREASE_PERCENT}% total.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: RAISE_SKELETON_LEGION_BASE_ATTACK_SPEED_INCREASE_PERCENT,
    valueLabel: `+${RAISE_SKELETON_LEGION_BASE_ATTACK_SPEED_INCREASE_PERCENT}% attack speed, +${RAISE_SKELETON_LEGION_ATTACK_SPEED_PER_ADDITIONAL_SKELETON_PERCENT}% per additional skeleton (max +${RAISE_SKELETON_LEGION_MAX_ATTACK_SPEED_INCREASE_PERCENT}%)`,
    skillId: RAISE_SKELETON_SKILL_ID,
    evolution: 'raise-skeleton-legion',
    skeletonLegion: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(RAISE_SKELETON_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('raise-skeleton-legion') &&
      !state.selectedUpgradeIds.includes('raise-skeleton-rotting-bones'),
  },
  {
    id: 'raise-skeleton-rotting-bones',
    name: 'Rotting Bones',
    description: `Skeleton attacks apply a Poison stack lasting ${RAISE_SKELETON_ROTTING_BONES_POISON_DURATION_SECONDS} seconds, dealing ${Math.round(RAISE_SKELETON_ROTTING_BONES_POISON_PHYSICAL_CHAOS_RATIO * 100)}% of the hit's physical damage as chaos damage per second.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: RAISE_SKELETON_ROTTING_BONES_POISON_PHYSICAL_CHAOS_RATIO,
    valueLabel: `Applies ${RAISE_SKELETON_ROTTING_BONES_POISON_DURATION_SECONDS}s Poison at ${Math.round(RAISE_SKELETON_ROTTING_BONES_POISON_PHYSICAL_CHAOS_RATIO * 100)}% hit damage/sec`,
    skillId: RAISE_SKELETON_SKILL_ID,
    evolution: 'raise-skeleton-rotting-bones',
    evolutionTags: ['poison', 'damage-over-time'],
    skeletonRottingBones: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(RAISE_SKELETON_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('raise-skeleton-legion') &&
      !state.selectedUpgradeIds.includes('raise-skeleton-rotting-bones'),
  },
  {
    id: 'whirlwind-leech',
    name: 'Sanguine Whirlwind',
    description: 'Whirlwind restores 2% of actual damage dealt.',
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 0.02,
    valueLabel: '+2% Whirlwind leech',
    skillId: WHIRLWIND_SKILL_ID,
    whirlwindLeechAmount: 0.02,
    isEligible: (state) => state.ownedSkillIds.includes(WHIRLWIND_SKILL_ID),
  },
  {
    id: 'whirlwind-frost',
    name: 'Rime Cyclone',
    description: `Whirlwind applies ${WHIRLWIND_FROST_STACKS} Chill stack per hit; ${FROST_MAX_CHILL_STACKS} stacks freeze an enemy for ${FROST_DEFAULT_FREEZE_DURATION_SECONDS} second.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: WHIRLWIND_FROST_STACKS,
    valueLabel: '+1 Chill stack per Whirlwind hit',
    skillId: WHIRLWIND_SKILL_ID,
    evolution: 'whirlwind-control',
    evolutionTags: ['chill', 'freeze'],
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
    rarity: Rarity.Uncommon,
    amount: WHIRLWIND_GUARD_DAMAGE_REDUCTION_PERCENT,
    valueLabel: '+15% Whirlwind Guard damage reduction',
    skillId: WHIRLWIND_SKILL_ID,
    evolution: 'whirlwind-guard',
    evolutionTags: ['duration'],
    whirlwindGuardDamageReductionPercent: WHIRLWIND_GUARD_DAMAGE_REDUCTION_PERCENT,
    isEligible: (state) =>
      state.ownedSkillIds.includes(WHIRLWIND_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('whirlwind-guard'),
  },
  {
    id: 'whirlwind-cyclone',
    name: 'Cyclone',
    description: `Each Whirlwind cast that hits an enemy gains a stack of Gathering Storm, up to ${WHIRLWIND_CYCLONE_MAX_STACKS}. Each stack grants ${WHIRLWIND_CYCLONE_COOLDOWN_REDUCTION_PER_STACK}% cooldown reduction and ${WHIRLWIND_CYCLONE_AREA_OF_EFFECT_PER_STACK}% area of effect. All stacks fall off if Whirlwind has not hit an enemy in the last ${WHIRLWIND_CYCLONE_GATHERING_STORM_DECAY_SECONDS} seconds.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: `Gathering Storm: 0/${WHIRLWIND_CYCLONE_MAX_STACKS} stacks`,
    skillId: WHIRLWIND_SKILL_ID,
    evolution: 'whirlwind-cyclone',
    evolutionTags: ['cooldown-reduction', 'area-of-effect'],
    whirlwindCyclone: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(WHIRLWIND_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('whirlwind-cyclone'),
  },
  {
    id: 'basic-attack-lightning-attunement',
    name: 'Stormbound Attack',
    description: `Convert ${BASIC_ATTACK_DAMAGE_CONVERSION_PERCENT}% of Basic Attack's final physical damage to Lightning damage. Attunement preserves the converted damage type.`,
    category: 'skill',
    rarity: Rarity.Rare,
    amount: BASIC_ATTACK_DAMAGE_CONVERSION_PERCENT,
    valueLabel: `Convert ${BASIC_ATTACK_DAMAGE_CONVERSION_PERCENT}% physical to Lightning`,
    skillId: BASIC_ATTACK_SKILL_ID,
    evolution: 'basic-attack-lightning-attunement',
    evolutionTags: ['elemental-damage'],
    basicAttackDamageConversionType: 'lightning',
    isEligible: (state) =>
      state.ownedSkillIds.includes(BASIC_ATTACK_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('basic-attack-lightning-attunement'),
  },
  {
    id: 'basic-attack-fire-attunement',
    name: 'Flamebound Attack',
    description: `Convert ${BASIC_ATTACK_DAMAGE_CONVERSION_PERCENT}% of Basic Attack's final physical damage to Fire damage. Attunement preserves the converted damage type.`,
    category: 'skill',
    rarity: Rarity.Rare,
    amount: BASIC_ATTACK_DAMAGE_CONVERSION_PERCENT,
    valueLabel: `Convert ${BASIC_ATTACK_DAMAGE_CONVERSION_PERCENT}% physical to Fire`,
    skillId: BASIC_ATTACK_SKILL_ID,
    evolution: 'basic-attack-fire-attunement',
    evolutionTags: ['elemental-damage'],
    basicAttackDamageConversionType: 'fire',
    isEligible: (state) =>
      state.ownedSkillIds.includes(BASIC_ATTACK_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('basic-attack-fire-attunement'),
  },
  {
    id: 'basic-attack-cold-attunement',
    name: 'Frostbound Attack',
    description: `Convert ${BASIC_ATTACK_DAMAGE_CONVERSION_PERCENT}% of Basic Attack's final physical damage to Cold damage. Attunement preserves the converted damage type.`,
    category: 'skill',
    rarity: Rarity.Rare,
    amount: BASIC_ATTACK_DAMAGE_CONVERSION_PERCENT,
    valueLabel: `Convert ${BASIC_ATTACK_DAMAGE_CONVERSION_PERCENT}% physical to Cold`,
    skillId: BASIC_ATTACK_SKILL_ID,
    evolution: 'basic-attack-cold-attunement',
    evolutionTags: ['elemental-damage'],
    basicAttackDamageConversionType: 'cold',
    isEligible: (state) =>
      state.ownedSkillIds.includes(BASIC_ATTACK_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('basic-attack-cold-attunement'),
  },
  {
    id: 'basic-attack-chaos-attunement',
    name: 'Riftbound Attack',
    description: `Convert ${BASIC_ATTACK_DAMAGE_CONVERSION_PERCENT}% of Basic Attack's final physical damage to Chaos damage. Attunement preserves the converted damage type.`,
    category: 'skill',
    rarity: Rarity.Rare,
    amount: BASIC_ATTACK_DAMAGE_CONVERSION_PERCENT,
    valueLabel: `Convert ${BASIC_ATTACK_DAMAGE_CONVERSION_PERCENT}% physical to Chaos`,
    skillId: BASIC_ATTACK_SKILL_ID,
    evolution: 'basic-attack-chaos-attunement',
    evolutionTags: ['chaos-damage'],
    basicAttackDamageConversionType: 'chaos',
    isEligible: (state) =>
      state.ownedSkillIds.includes(BASIC_ATTACK_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('basic-attack-chaos-attunement'),
  },
  {
    id: 'basic-attack-brutality',
    name: 'Brutal Attack',
    description: `Basic Attack deals ${BASIC_ATTACK_MORE_PHYSICAL_DAMAGE_PERCENT}% more Physical damage after increases. This also increases Attunement damage.`,
    category: 'skill',
    rarity: Rarity.Rare,
    amount: BASIC_ATTACK_MORE_PHYSICAL_DAMAGE_PERCENT,
    valueLabel: `${BASIC_ATTACK_MORE_PHYSICAL_DAMAGE_PERCENT}% more Physical damage`,
    skillId: BASIC_ATTACK_SKILL_ID,
    evolution: 'basic-attack-brutality',
    basicAttackMorePhysicalDamagePercent: BASIC_ATTACK_MORE_PHYSICAL_DAMAGE_PERCENT,
    isEligible: (state) =>
      state.ownedSkillIds.includes(BASIC_ATTACK_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('basic-attack-brutality'),
  },
  {
    id: 'magnet',
    name: 'Magnet',
    description: `Increase XP, health potion, equipment, and item collection range by ${MAGNET_COLLECTION_RANGE_INCREASE_PERCENT}%.`,
    category: 'passive',
    rarity: Rarity.Rare,
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
    rarity: Rarity.Common,
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
    rarity: Rarity.Common,
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
    rarity: Rarity.Common,
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
    description: `Increase Basic Attack damage by ${BASIC_ATTACK_LEVEL_DAMAGE_INCREASE_PERCENT}%. This also increases Attunement damage.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: `+${BASIC_ATTACK_LEVEL_DAMAGE_INCREASE_PERCENT}% increased Basic Attack damage`,
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
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: `+${WHIRLWIND_LEVEL_DAMAGE_INCREASE_PERCENT}% increased Whirlwind damage`,
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
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: `+${CHAIN_LIGHTNING_LEVEL_DAMAGE_INCREASE_PERCENT}% increased Chain Lightning damage`,
    skillId: CHAIN_LIGHTNING_SKILL_ID,
    skillAction: 'level',
    skillDamageIncreasePercent: CHAIN_LIGHTNING_LEVEL_DAMAGE_INCREASE_PERCENT,
    isEligible: (state) => (state.skillLevels[CHAIN_LIGHTNING_SKILL_ID] ?? 0) >= 1,
  },
  {
    id: 'chain-lightning-extra-chain',
    name: 'Forked Current',
    description: `Chain Lightning chains to ${CHAIN_LIGHTNING_CHAIN_INCREASE} additional enemy. This upgrade is repeatable.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: CHAIN_LIGHTNING_CHAIN_INCREASE,
    repeatable: true,
    valueLabel: `+${CHAIN_LIGHTNING_CHAIN_INCREASE} Chain Lightning chain`,
    skillId: CHAIN_LIGHTNING_SKILL_ID,
    chainLightningChainIncrease: CHAIN_LIGHTNING_CHAIN_INCREASE,
    isEligible: (state) => state.ownedSkillIds.includes(CHAIN_LIGHTNING_SKILL_ID),
  },
  {
    id: 'fiery-touch-unlock',
    name: 'Fiery Touch',
    description: 'Unlocks a fire burst that triggers when you directly hit an enemy.',
    category: 'skill',
    rarity: Rarity.Common,
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
    description: `Increase Fiery Touch damage by ${FIERY_TOUCH_LEVEL_DAMAGE_INCREASE_PERCENT}%.`,
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: `+${FIERY_TOUCH_LEVEL_DAMAGE_INCREASE_PERCENT}% increased Fiery Touch damage`,
    skillId: FIERY_TOUCH_SKILL_ID,
    skillAction: 'level',
    skillDamageIncreasePercent: FIERY_TOUCH_LEVEL_DAMAGE_INCREASE_PERCENT,
    isEligible: (state) => (state.skillLevels[FIERY_TOUCH_SKILL_ID] ?? 0) >= 1,
  },
  {
    id: 'fiery-touch-cooldown-reduction',
    name: 'Rapid Ignition',
    description: `Reduce Fiery Touch cooldown by ${FIERY_TOUCH_COOLDOWN_REDUCTION_PERCENT}%. This upgrade is repeatable.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: FIERY_TOUCH_COOLDOWN_REDUCTION_PERCENT,
    repeatable: true,
    valueLabel: `+${FIERY_TOUCH_COOLDOWN_REDUCTION_PERCENT}% Fiery Touch cooldown reduction`,
    skillId: FIERY_TOUCH_SKILL_ID,
    evolution: 'fiery-touch-frequency',
    evolutionTags: ['cooldown-reduction'],
    skillCooldownReductionPercent: FIERY_TOUCH_COOLDOWN_REDUCTION_PERCENT,
    isEligible: (state) => state.ownedSkillIds.includes(FIERY_TOUCH_SKILL_ID),
  },
  {
    id: 'fiery-touch-ember',
    name: 'Emberstorm',
    description: `Fiery Touch deals ${FIERY_TOUCH_DAMAGE_INCREASE_PERCENT}% more damage, but does not gain extra triggers.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: FIERY_TOUCH_DAMAGE_INCREASE_PERCENT,
    valueLabel: `+${FIERY_TOUCH_DAMAGE_INCREASE_PERCENT}% more Fiery Touch damage`,
    skillId: FIERY_TOUCH_SKILL_ID,
    evolution: 'fiery-touch-ember',
    fieryTouchMoreDamagePercent: FIERY_TOUCH_DAMAGE_INCREASE_PERCENT,
    isEligible: (state) =>
      state.ownedSkillIds.includes(FIERY_TOUCH_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('fiery-touch-ember'),
  },
  {
    id: 'vitality-level',
    name: 'Greater Vitality',
    description: `Increase Vitality healing by ${VITALITY_HEALING_PER_LEVEL} HP per cast.`,
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: `+${VITALITY_HEALING_PER_LEVEL} HP per Vitality cast`,
    skillId: VITALITY_SKILL_ID,
    skillAction: 'level',
    skillHealingIncreaseAmount: VITALITY_HEALING_PER_LEVEL,
    isEligible: (state) => (state.skillLevels[VITALITY_SKILL_ID] ?? 0) >= 1,
  },
  {
    id: 'vitality-increased-healing',
    name: 'Restorative Vitality',
    description: `Increase healing from all sources by ${VITALITY_GLOBAL_HEALING_INCREASE_PERCENT}%.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: VITALITY_GLOBAL_HEALING_INCREASE_PERCENT,
    valueLabel: `+${VITALITY_GLOBAL_HEALING_INCREASE_PERCENT}% increased healing`,
    skillId: VITALITY_SKILL_ID,
    increasedHealingPercent: VITALITY_GLOBAL_HEALING_INCREASE_PERCENT,
    isEligible: (state) => state.ownedSkillIds.includes(VITALITY_SKILL_ID),
  },
  {
    id: 'vitality-renewal',
    name: 'Renewal',
    description: 'Vitality also heals 3% of your maximum HP on each cast.',
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: VITALITY_MAX_HP_HEALING_PERCENT,
    valueLabel: `+${VITALITY_MAX_HP_HEALING_PERCENT}% max HP healing per cast`,
    skillId: VITALITY_SKILL_ID,
    evolution: 'vitality-renewal',
    evolutionRankValueLabel: `+${VITALITY_MAX_HP_HEALING_PERCENT}% max HP healing per cast`,
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
    rarity: Rarity.Uncommon,
    amount: VITALITY_LOW_HP_HEALING_MULTIPLIER,
    valueLabel: '2x low-health healing, 20% low-health damage reduction',
    skillId: VITALITY_SKILL_ID,
    evolution: 'vitality-last-stand',
    evolutionRankValueLabel: `+${VITALITY_HEALING_PER_LEVEL} HP per cast`,
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
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: '+1 Chill stack per lightning hit',
    skillId: CHAIN_LIGHTNING_SKILL_ID,
    evolution: 'chain-lightning-frost',
    evolutionTags: ['chill'],
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
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: 'Shock; 3 stacks detonate for 150% lightning damage',
    skillId: CHAIN_LIGHTNING_SKILL_ID,
    evolution: 'chain-lightning-overload',
    evolutionTags: ['shock', 'overload'],
    chainLightningOverload: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(CHAIN_LIGHTNING_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('chain-lightning-overload'),
  },
  {
    id: 'glacial-orb-unlock',
    name: 'Glacial Orb',
    description: 'Unlock a cold projectile that explodes and chills enemies caught in the blast.',
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: 'Unlock skill',
    skillId: GLACIAL_ORB_SKILL_ID,
    skillAction: 'unlock',
    isEligible: (state) =>
      state.ownedSkillIds.length < state.skillSlotCount &&
      !state.ownedSkillIds.includes(GLACIAL_ORB_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('glacial-orb-unlock'),
  },
  {
    id: 'glacial-orb-level',
    name: 'Glacial Focus',
    description: `Increase Glacial Orb damage by ${GLACIAL_ORB_LEVEL_DAMAGE_INCREASE_PERCENT}%.`,
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: `+${GLACIAL_ORB_LEVEL_DAMAGE_INCREASE_PERCENT}% increased Glacial Orb damage`,
    skillId: GLACIAL_ORB_SKILL_ID,
    skillAction: 'level',
    skillDamageIncreasePercent: GLACIAL_ORB_LEVEL_DAMAGE_INCREASE_PERCENT,
    isEligible: (state) => (state.skillLevels[GLACIAL_ORB_SKILL_ID] ?? 0) >= 1,
  },
  {
    id: 'glacial-orb-permafrost',
    name: 'Permafrost',
    description: `Glacial Orb applies an extra Chill stack and increases its explosion radius by ${GLACIAL_ORB_PERMAFROST_RADIUS_BONUS}.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: GLACIAL_ORB_PERMAFROST_FROST_STACKS,
    valueLabel: `+1 Chill stack, +${GLACIAL_ORB_PERMAFROST_RADIUS_BONUS} explosion radius`,
    skillId: GLACIAL_ORB_SKILL_ID,
    evolution: 'glacial-orb-permafrost',
    evolutionTags: ['chill'],
    glacialOrbFrostStacks: GLACIAL_ORB_PERMAFROST_FROST_STACKS,
    isEligible: (state) =>
      state.ownedSkillIds.includes(GLACIAL_ORB_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('glacial-orb-permafrost') &&
      !state.selectedUpgradeIds.includes('glacial-orb-ice-lance'),
  },
  {
    id: 'glacial-orb-ice-lance',
    name: 'Ice Lance',
    description: `Glacial Orb no longer explodes, but deals ${GLACIAL_ORB_ICE_LANCE_DAMAGE_INCREASE_PERCENT}% more damage to Chilled or Frozen enemies.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: GLACIAL_ORB_ICE_LANCE_DAMAGE_INCREASE_PERCENT,
    valueLabel: `Single-target, +${GLACIAL_ORB_ICE_LANCE_DAMAGE_INCREASE_PERCENT}% more damage vs Chilled/Frozen`,
    skillId: GLACIAL_ORB_SKILL_ID,
    evolution: 'glacial-orb-ice-lance',
    evolutionTags: ['chill', 'freeze'],
    glacialOrbIceLance: true,
    glacialOrbIceLanceDamageIncreasePercent: GLACIAL_ORB_ICE_LANCE_DAMAGE_INCREASE_PERCENT,
    isEligible: (state) =>
      state.ownedSkillIds.includes(GLACIAL_ORB_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('glacial-orb-ice-lance') &&
      !state.selectedUpgradeIds.includes('glacial-orb-permafrost'),
  },
  {
    id: 'lancers-charge-unlock',
    name: "Lancer's Charge",
    description: 'Unlock a directional melee dash that strikes everything in its path.',
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: 'Unlock skill',
    skillId: LANCERS_CHARGE_SKILL_ID,
    skillAction: 'unlock',
    isEligible: (state) =>
      state.ownedSkillIds.length < state.skillSlotCount &&
      !state.ownedSkillIds.includes(LANCERS_CHARGE_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('lancers-charge-unlock'),
  },
  {
    id: 'lancers-charge-level',
    name: 'Honed Point',
    description: `Increase Lancer's Charge damage by ${LANCERS_CHARGE_LEVEL_DAMAGE_INCREASE_PERCENT}%.`,
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: `+${LANCERS_CHARGE_LEVEL_DAMAGE_INCREASE_PERCENT}% increased Lancer's Charge damage`,
    skillId: LANCERS_CHARGE_SKILL_ID,
    skillAction: 'level',
    skillDamageIncreasePercent: LANCERS_CHARGE_LEVEL_DAMAGE_INCREASE_PERCENT,
    isEligible: (state) => (state.skillLevels[LANCERS_CHARGE_SKILL_ID] ?? 0) >= 1,
  },
  {
    id: 'lancers-charge-vanguard',
    name: 'Vanguard',
    description: `Momentum increases from ${LANCERS_CHARGE_MOMENTUM_PERCENT_PER_STACK}% to ${LANCERS_CHARGE_VANGUARD_MOMENTUM_PERCENT_PER_STACK}% damage per stack, plus ${LANCERS_CHARGE_VANGUARD_SINGLE_TARGET_BONUS_PERCENT}% increased damage against a single target.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: `Momentum ${LANCERS_CHARGE_MOMENTUM_PERCENT_PER_STACK}% -> ${LANCERS_CHARGE_VANGUARD_MOMENTUM_PERCENT_PER_STACK}%/stack, +${LANCERS_CHARGE_VANGUARD_SINGLE_TARGET_BONUS_PERCENT}% increased single-target damage`,
    skillId: LANCERS_CHARGE_SKILL_ID,
    evolution: 'lancers-charge-vanguard',
    lancersChargeVanguard: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(LANCERS_CHARGE_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('lancers-charge-vanguard') &&
      !state.selectedUpgradeIds.includes('lancers-charge-impaler'),
  },
  {
    id: 'lancers-charge-impaler',
    name: 'Impaler',
    description: `Lancer's Charge gains +${LANCERS_CHARGE_IMPALER_RANGE_BONUS} range and +${LANCERS_CHARGE_IMPALER_WIDTH_BONUS} corridor width, but deals ${LANCERS_CHARGE_IMPALER_DAMAGE_REDUCTION_PERCENT}% less damage per target.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: `+${LANCERS_CHARGE_IMPALER_RANGE_BONUS} range, +${LANCERS_CHARGE_IMPALER_WIDTH_BONUS} width, ${LANCERS_CHARGE_IMPALER_DAMAGE_REDUCTION_PERCENT}% less damage`,
    skillId: LANCERS_CHARGE_SKILL_ID,
    evolution: 'lancers-charge-impaler',
    lancersChargeImpaler: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(LANCERS_CHARGE_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('lancers-charge-impaler') &&
      !state.selectedUpgradeIds.includes('lancers-charge-vanguard'),
  },
  {
    id: 'rallying-banner-unlock',
    name: 'Rallying Banner',
    description: 'Unlock a support banner that heals you immediately, then heals you and living summons inside it every second while active, while reducing incoming damage.',
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: 'Unlock skill',
    skillId: RALLYING_BANNER_SKILL_ID,
    skillAction: 'unlock',
    isEligible: (state) =>
      state.ownedSkillIds.length < state.skillSlotCount &&
      !state.ownedSkillIds.includes(RALLYING_BANNER_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('rallying-banner-unlock'),
  },
  {
    id: 'rallying-banner-level',
    name: 'Inspiring Banner',
    description: `Increase Rallying Banner immediate and periodic healing by ${RALLYING_BANNER_HEALING_INCREASE_PER_LEVEL} HP per heal.`,
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: `+${RALLYING_BANNER_HEALING_INCREASE_PER_LEVEL} HP to each Rallying Banner heal`,
    skillId: RALLYING_BANNER_SKILL_ID,
    skillAction: 'level',
    skillHealingIncreaseAmount: RALLYING_BANNER_HEALING_INCREASE_PER_LEVEL,
    isEligible: (state) => (state.skillLevels[RALLYING_BANNER_SKILL_ID] ?? 0) >= 1,
  },
  {
    id: 'rallying-banner-area-of-effect',
    name: 'Expansive Banner',
    description: `Rallying Banner gains ${RALLYING_BANNER_AREA_OF_EFFECT_PER_RANK}% increased area of effect. This upgrade is repeatable.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: RALLYING_BANNER_AREA_OF_EFFECT_PER_RANK,
    repeatable: true,
    valueLabel: `+${RALLYING_BANNER_AREA_OF_EFFECT_PER_RANK}% Rallying Banner area of effect`,
    skillId: RALLYING_BANNER_SKILL_ID,
    rallyingBannerAreaOfEffectPercent: RALLYING_BANNER_AREA_OF_EFFECT_PER_RANK,
    isEligible: (state) => state.ownedSkillIds.includes(RALLYING_BANNER_SKILL_ID),
  },
  {
    id: 'rallying-banner-commander',
    name: 'Commander',
    description: `While the banner is active, skills and skeleton attacks gain ${RALLYING_BANNER_COMMANDER_COOLDOWN_REDUCTION_PERCENT}% cooldown reduction.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: `${RALLYING_BANNER_COMMANDER_COOLDOWN_REDUCTION_PERCENT}% skill and skeleton cooldown reduction while active`,
    skillId: RALLYING_BANNER_SKILL_ID,
    evolution: 'rallying-banner-commander',
    evolutionTags: ['cooldown-reduction'],
    rallyingBannerCommander: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(RALLYING_BANNER_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('rallying-banner-commander') &&
      !state.selectedUpgradeIds.includes('rallying-banner-bulwark'),
  },
  {
    id: 'rallying-banner-bulwark',
    name: 'Bulwark',
    description: `The banner gains ${RALLYING_BANNER_BULWARK_DAMAGE_REDUCTION_BONUS_PERCENT}% additional damage reduction (${RALLYING_BANNER_BASE_DAMAGE_REDUCTION_PERCENT + RALLYING_BANNER_BULWARK_DAMAGE_REDUCTION_BONUS_PERCENT}% total) and lasts ${RALLYING_BANNER_BULWARK_DURATION_BONUS_SECONDS} seconds longer (${RALLYING_BANNER_BASE_DURATION_SECONDS + RALLYING_BANNER_BULWARK_DURATION_BONUS_SECONDS} seconds total).`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: `+${RALLYING_BANNER_BULWARK_DAMAGE_REDUCTION_BONUS_PERCENT}% damage reduction, +${RALLYING_BANNER_BULWARK_DURATION_BONUS_SECONDS}s duration`,
    skillId: RALLYING_BANNER_SKILL_ID,
    evolution: 'rallying-banner-bulwark',
    evolutionTags: ['duration'],
    rallyingBannerBulwark: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(RALLYING_BANNER_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('rallying-banner-bulwark') &&
      !state.selectedUpgradeIds.includes('rallying-banner-commander'),
  },
  {
    id: 'gravity-well-unlock',
    name: 'Gravity Well',
    description: 'Unlock a pull-and-control zone that drags enemies in and deals chaos damage.',
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: 'Unlock skill',
    skillId: GRAVITY_WELL_SKILL_ID,
    skillAction: 'unlock',
    isEligible: (state) =>
      state.ownedSkillIds.length < state.skillSlotCount &&
      !state.ownedSkillIds.includes(GRAVITY_WELL_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('gravity-well-unlock'),
  },
  {
    id: 'gravity-well-level',
    name: 'Dense Singularity',
    description: `Increase Gravity Well damage by ${GRAVITY_WELL_LEVEL_DAMAGE_INCREASE_PERCENT}%.`,
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: `+${GRAVITY_WELL_LEVEL_DAMAGE_INCREASE_PERCENT}% increased Gravity Well damage`,
    skillId: GRAVITY_WELL_SKILL_ID,
    skillAction: 'level',
    skillDamageIncreasePercent: GRAVITY_WELL_LEVEL_DAMAGE_INCREASE_PERCENT,
    isEligible: (state) => (state.skillLevels[GRAVITY_WELL_SKILL_ID] ?? 0) >= 1,
  },
  {
    id: 'gravity-well-singularity',
    name: 'Singularity',
    description: `Gravity Well gains +${GRAVITY_WELL_SINGULARITY_PULL_BONUS} pull distance, +${GRAVITY_WELL_SINGULARITY_RADIUS_BONUS} radius, and applies 1 Chill stack to every enemy it pulls.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: `+${GRAVITY_WELL_SINGULARITY_PULL_BONUS} pull distance, +${GRAVITY_WELL_SINGULARITY_RADIUS_BONUS} radius, +1 Chill stack`,
    skillId: GRAVITY_WELL_SKILL_ID,
    evolution: 'gravity-well-singularity',
    evolutionTags: ['chill'],
    gravityWellSingularity: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(GRAVITY_WELL_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('gravity-well-singularity') &&
      !state.selectedUpgradeIds.includes('gravity-well-event-horizon'),
  },
  {
    id: 'gravity-well-event-horizon',
    name: 'Event Horizon',
    description: `Gravity Well no longer pulls enemies, but deals ${GRAVITY_WELL_EVENT_HORIZON_DAMAGE_INCREASE_PERCENT}% more damage.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: 'No pull, +50% more damage',
    skillId: GRAVITY_WELL_SKILL_ID,
    evolution: 'gravity-well-event-horizon',
    gravityWellEventHorizon: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(GRAVITY_WELL_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('gravity-well-event-horizon') &&
      !state.selectedUpgradeIds.includes('gravity-well-singularity'),
  },
  {
    id: 'aegis-pulse-unlock',
    name: 'Aegis Pulse',
    description: 'Unlock a defensive burst that damages nearby enemies and grants a temporary shield.',
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: 'Unlock skill',
    skillId: AEGIS_PULSE_SKILL_ID,
    skillAction: 'unlock',
    isEligible: (state) =>
      state.ownedSkillIds.length < state.skillSlotCount &&
      !state.ownedSkillIds.includes(AEGIS_PULSE_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('aegis-pulse-unlock'),
  },
  {
    id: 'aegis-pulse-level',
    name: 'Reinforced Aegis',
    description: `Increase Aegis Pulse damage by ${AEGIS_PULSE_LEVEL_DAMAGE_INCREASE_PERCENT}% and shield amount by ${AEGIS_PULSE_SHIELD_AMOUNT_PER_LEVEL} HP.`,
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: `+${AEGIS_PULSE_LEVEL_DAMAGE_INCREASE_PERCENT}% increased damage, +${AEGIS_PULSE_SHIELD_AMOUNT_PER_LEVEL} shield`,
    skillId: AEGIS_PULSE_SKILL_ID,
    skillAction: 'level',
    skillDamageIncreasePercent: AEGIS_PULSE_LEVEL_DAMAGE_INCREASE_PERCENT,
    isEligible: (state) => (state.skillLevels[AEGIS_PULSE_SKILL_ID] ?? 0) >= 1,
  },
  {
    id: 'aegis-pulse-bulwark',
    name: 'Bulwark',
    description: `Aegis Pulse adds ${AEGIS_PULSE_BULWARK_SHIELD_AMOUNT_BONUS} shield and ${AEGIS_PULSE_BULWARK_DURATION_BONUS_SECONDS} seconds to each shield.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: `+${AEGIS_PULSE_BULWARK_SHIELD_AMOUNT_BONUS} shield, +${AEGIS_PULSE_BULWARK_DURATION_BONUS_SECONDS}s duration`,
    skillId: AEGIS_PULSE_SKILL_ID,
    evolution: 'aegis-pulse-bulwark',
    evolutionTags: ['duration'],
    aegisPulseBulwark: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(AEGIS_PULSE_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('aegis-pulse-bulwark') &&
      !state.selectedUpgradeIds.includes('aegis-pulse-reprisal'),
  },
  {
    id: 'aegis-pulse-reprisal',
    name: 'Reprisal',
    description: 'When the Aegis Pulse shield absorbs damage, it reflects a portion back at the attacker. Reflected damage is based only on damage absorbed and is not increased by global damage bonuses.',
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: `Reflects ${Math.round(AEGIS_PULSE_REPRISAL_RATIO * 100)}% of absorbed damage (not global damage)`,
    skillId: AEGIS_PULSE_SKILL_ID,
    evolution: 'aegis-pulse-reprisal',
    aegisPulseReprisal: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(AEGIS_PULSE_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('aegis-pulse-reprisal') &&
      !state.selectedUpgradeIds.includes('aegis-pulse-bulwark'),
  },
  {
    id: 'rift-javelin-unlock',
    name: 'Rift Javelin',
    description: 'Unlock a long-range javelin that pierces every enemy in its path and returns along the same path.',
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: 'Unlock skill',
    skillId: RIFT_JAVELIN_SKILL_ID,
    skillAction: 'unlock',
    isEligible: (state) =>
      state.ownedSkillIds.length < state.skillSlotCount &&
      !state.ownedSkillIds.includes(RIFT_JAVELIN_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('rift-javelin-unlock'),
  },
  {
    id: 'rift-javelin-level',
    name: 'Honed Javelin',
    description: `Increase Rift Javelin damage by ${RIFT_JAVELIN_LEVEL_DAMAGE_INCREASE_PERCENT}%.`,
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: `+${RIFT_JAVELIN_LEVEL_DAMAGE_INCREASE_PERCENT}% increased Rift Javelin damage`,
    skillId: RIFT_JAVELIN_SKILL_ID,
    skillAction: 'level',
    skillDamageIncreasePercent: RIFT_JAVELIN_LEVEL_DAMAGE_INCREASE_PERCENT,
    isEligible: (state) => (state.skillLevels[RIFT_JAVELIN_SKILL_ID] ?? 0) >= 1,
  },
  {
    id: 'rift-javelin-barbed',
    name: 'Barbed Javelin',
    description: `Rift Javelin hits apply a Poison stack lasting ${RIFT_JAVELIN_BARBED_DURATION_SECONDS} seconds that deals Chaos damage over time.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: `Applies a ${RIFT_JAVELIN_BARBED_DURATION_SECONDS}s Poison stack per hit`,
    skillId: RIFT_JAVELIN_SKILL_ID,
    evolution: 'rift-javelin-barbed',
    evolutionTags: ['poison', 'damage-over-time'],
    riftJavelinBarbed: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(RIFT_JAVELIN_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('rift-javelin-barbed') &&
      !state.selectedUpgradeIds.includes('rift-javelin-homeward'),
  },
  {
    id: 'rift-javelin-homeward',
    name: 'Homeward Edge',
    description: `Rift Javelin deals ${RIFT_JAVELIN_HOMEWARD_DAMAGE_INCREASE_PERCENT}% more damage while returning to you.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: `+${RIFT_JAVELIN_HOMEWARD_DAMAGE_INCREASE_PERCENT}% more damage on the return trip`,
    skillId: RIFT_JAVELIN_SKILL_ID,
    evolution: 'rift-javelin-homeward',
    riftJavelinHomeward: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(RIFT_JAVELIN_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('rift-javelin-homeward') &&
      !state.selectedUpgradeIds.includes('rift-javelin-barbed'),
  },
  {
    id: 'cinder-mine-unlock',
    name: 'Cinder Mine',
    description: 'Unlock a delayed fire trap that explodes and leaves enemies Burning.',
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: 'Unlock skill',
    skillId: CINDER_MINE_SKILL_ID,
    skillAction: 'unlock',
    isEligible: (state) =>
      state.ownedSkillIds.length < state.skillSlotCount &&
      !state.ownedSkillIds.includes(CINDER_MINE_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('cinder-mine-unlock'),
  },
  {
    id: 'cinder-mine-level',
    name: 'Volatile Charge',
    description: `Increase Cinder Mine damage by ${CINDER_MINE_LEVEL_DAMAGE_INCREASE_PERCENT}%.`,
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: `+${CINDER_MINE_LEVEL_DAMAGE_INCREASE_PERCENT}% increased Cinder Mine damage`,
    skillId: CINDER_MINE_SKILL_ID,
    skillAction: 'level',
    skillDamageIncreasePercent: CINDER_MINE_LEVEL_DAMAGE_INCREASE_PERCENT,
    isEligible: (state) => (state.skillLevels[CINDER_MINE_SKILL_ID] ?? 0) >= 1,
  },
  {
    id: 'cinder-mine-inferno',
    name: 'Inferno Charge',
    description: `Cinder Mine's Fire blast radius grows by ${CINDER_MINE_INFERNO_RADIUS_BONUS} and its Burning stacks deal ${Math.round((CINDER_MINE_BURNING_FIRE_DAMAGE_RATIO + CINDER_MINE_INFERNO_BURNING_RATIO_BONUS) * 100)}% of the applying hit's Fire damage per second (up from ${Math.round(CINDER_MINE_BURNING_FIRE_DAMAGE_RATIO * 100)}%).`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: `+${CINDER_MINE_INFERNO_RADIUS_BONUS} radius, ${Math.round((CINDER_MINE_BURNING_FIRE_DAMAGE_RATIO + CINDER_MINE_INFERNO_BURNING_RATIO_BONUS) * 100)}% Burning ratio`,
    skillId: CINDER_MINE_SKILL_ID,
    evolution: 'cinder-mine-inferno',
    evolutionTags: ['burning', 'area-of-effect'],
    cinderMineInferno: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(CINDER_MINE_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('cinder-mine-inferno') &&
      !state.selectedUpgradeIds.includes('cinder-mine-cluster'),
  },
  {
    id: 'cinder-mine-cluster',
    name: 'Cluster Charges',
    description: `Cinder Mine deploys a second mine alongside the first, dealing ${Math.round(CINDER_MINE_CLUSTER_DAMAGE_MULTIPLIER * 100)}% damage.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: `Deploys 2 mines per cast, second at ${Math.round(CINDER_MINE_CLUSTER_DAMAGE_MULTIPLIER * 100)}% damage`,
    skillId: CINDER_MINE_SKILL_ID,
    evolution: 'cinder-mine-cluster',
    cinderMineCluster: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(CINDER_MINE_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('cinder-mine-cluster') &&
      !state.selectedUpgradeIds.includes('cinder-mine-inferno'),
  },
  {
    id: 'storm-relay-unlock',
    name: 'Storm Relay',
    description: 'Unlock a persistent lightning relay that periodically strikes and chains to nearby enemies.',
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: 'Unlock skill',
    skillId: STORM_RELAY_SKILL_ID,
    skillAction: 'unlock',
    isEligible: (state) =>
      state.ownedSkillIds.length < state.skillSlotCount &&
      !state.ownedSkillIds.includes(STORM_RELAY_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('storm-relay-unlock'),
  },
  {
    id: 'storm-relay-level',
    name: 'Amplified Relay',
    description: `Increase Storm Relay damage by ${STORM_RELAY_LEVEL_DAMAGE_INCREASE_PERCENT}%.`,
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: `+${STORM_RELAY_LEVEL_DAMAGE_INCREASE_PERCENT}% increased Storm Relay damage`,
    skillId: STORM_RELAY_SKILL_ID,
    skillAction: 'level',
    skillDamageIncreasePercent: STORM_RELAY_LEVEL_DAMAGE_INCREASE_PERCENT,
    isEligible: (state) => (state.skillLevels[STORM_RELAY_SKILL_ID] ?? 0) >= 1,
  },
  {
    id: 'storm-relay-overcharge',
    name: 'Overcharge',
    description: `Storm Relay strikes every ${STORM_RELAY_OVERCHARGE_STRIKE_INTERVAL_SECONDS}s instead of every ${STORM_RELAY_STRIKE_INTERVAL_SECONDS}s and applies extra Shock stacks.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: `${STORM_RELAY_OVERCHARGE_STRIKE_INTERVAL_SECONDS}s strike interval, +1 Shock stack`,
    skillId: STORM_RELAY_SKILL_ID,
    evolution: 'storm-relay-overcharge',
    evolutionTags: ['shock', 'overload'],
    stormRelayOvercharge: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(STORM_RELAY_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('storm-relay-overcharge') &&
      !state.selectedUpgradeIds.includes('storm-relay-conduit'),
  },
  {
    id: 'storm-relay-conduit',
    name: 'Conduit',
    description: `Before each strike, Storm Relay pulls nearby enemies within ${STORM_RELAY_CONDUIT_PULL_RADIUS} units toward itself. The pull scales with Area of Effect and is reduced by enemy Tenacity.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: 'Pulls nearby enemies before each strike',
    skillId: STORM_RELAY_SKILL_ID,
    evolution: 'storm-relay-conduit',
    evolutionTags: ['duration', 'area-of-effect'],
    stormRelayConduit: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(STORM_RELAY_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('storm-relay-conduit') &&
      !state.selectedUpgradeIds.includes('storm-relay-overcharge'),
  },
  {
    id: 'soul-tether-unlock',
    name: 'Soul Tether',
    description: 'Unlock a chaos link to a nearby enemy that favors closer targets, damages it over time, and restores some of that damage as health.',
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: 'Unlock skill',
    skillId: SOUL_TETHER_SKILL_ID,
    skillAction: 'unlock',
    isEligible: (state) =>
      state.ownedSkillIds.length < state.skillSlotCount &&
      !state.ownedSkillIds.includes(SOUL_TETHER_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('soul-tether-unlock'),
  },
  {
    id: 'soul-tether-level',
    name: 'Deepened Bond',
    description: `Increase Soul Tether damage by ${SOUL_TETHER_LEVEL_DAMAGE_INCREASE_PERCENT}%.`,
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: `+${SOUL_TETHER_LEVEL_DAMAGE_INCREASE_PERCENT}% increased Soul Tether damage`,
    skillId: SOUL_TETHER_SKILL_ID,
    skillAction: 'level',
    skillDamageIncreasePercent: SOUL_TETHER_LEVEL_DAMAGE_INCREASE_PERCENT,
    isEligible: (state) => (state.skillLevels[SOUL_TETHER_SKILL_ID] ?? 0) >= 1,
  },
  {
    id: 'soul-tether-siphon',
    name: 'Vampiric Tether',
    description: `Soul Tether restores an additional ${Math.round(SOUL_TETHER_SIPHON_HEALING_BONUS * 100)}% of its damage as health.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: `+${Math.round(SOUL_TETHER_SIPHON_HEALING_BONUS * 100)}% healing ratio`,
    skillId: SOUL_TETHER_SKILL_ID,
    evolution: 'soul-tether-siphon',
    evolutionTags: ['leech'],
    soulTetherSiphon: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(SOUL_TETHER_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('soul-tether-siphon') &&
      !state.selectedUpgradeIds.includes('soul-tether-requiem'),
  },
  {
    id: 'soul-tether-requiem',
    name: 'Requiem Chain',
    description: `When the tethered enemy dies, the snap burst chains to up to ${SOUL_TETHER_REQUIEM_BURST_TARGET_COUNT} nearby enemies instead of one.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: `Snap burst chains to ${SOUL_TETHER_REQUIEM_BURST_TARGET_COUNT} enemies`,
    skillId: SOUL_TETHER_SKILL_ID,
    evolution: 'soul-tether-requiem',
    soulTetherRequiem: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(SOUL_TETHER_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('soul-tether-requiem') &&
      !state.selectedUpgradeIds.includes('soul-tether-siphon'),
  },
  {
    id: 'phantom-arsenal-unlock',
    name: 'Phantom Arsenal',
    description: 'Unlock a temporary spectral archer that fires physical bolts at nearby enemies.',
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: 'Unlock skill',
    skillId: PHANTOM_ARSENAL_SKILL_ID,
    skillAction: 'unlock',
    isEligible: (state) =>
      state.ownedSkillIds.length < state.skillSlotCount &&
      !state.ownedSkillIds.includes(PHANTOM_ARSENAL_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('phantom-arsenal-unlock'),
  },
  {
    id: 'phantom-arsenal-level',
    name: 'Spectral Focus',
    description: `Increase Phantom Arsenal damage by ${PHANTOM_ARSENAL_LEVEL_DAMAGE_INCREASE_PERCENT}%.`,
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: `+${PHANTOM_ARSENAL_LEVEL_DAMAGE_INCREASE_PERCENT}% increased Phantom Arsenal damage`,
    skillId: PHANTOM_ARSENAL_SKILL_ID,
    skillAction: 'level',
    skillDamageIncreasePercent: PHANTOM_ARSENAL_LEVEL_DAMAGE_INCREASE_PERCENT,
    isEligible: (state) => (state.skillLevels[PHANTOM_ARSENAL_SKILL_ID] ?? 0) >= 1,
  },
  {
    id: 'phantom-arsenal-volley',
    name: 'Spectral Volley',
    description: `Phantom Arsenal keeps ${PHANTOM_ARSENAL_VOLLEY_MAX_COUNT_BONUS} additional archer active, each dealing ${PHANTOM_ARSENAL_VOLLEY_DAMAGE_REDUCTION_PERCENT}% less damage.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: `+${PHANTOM_ARSENAL_VOLLEY_MAX_COUNT_BONUS} active archer, ${PHANTOM_ARSENAL_VOLLEY_DAMAGE_REDUCTION_PERCENT}% less damage each`,
    skillId: PHANTOM_ARSENAL_SKILL_ID,
    evolution: 'phantom-arsenal-volley',
    phantomArsenalVolley: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(PHANTOM_ARSENAL_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('phantom-arsenal-volley') &&
      !state.selectedUpgradeIds.includes('phantom-arsenal-marksman'),
  },
  {
    id: 'phantom-arsenal-marksman',
    name: "Marksman's Focus",
    description: `The single Phantom Arsenal archer gains ${PHANTOM_ARSENAL_MARKSMAN_RANGE_BONUS_PERCENT}% more range and ${PHANTOM_ARSENAL_MARKSMAN_DAMAGE_INCREASE_PERCENT}% more damage.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: `+${PHANTOM_ARSENAL_MARKSMAN_RANGE_BONUS_PERCENT}% more range, +${PHANTOM_ARSENAL_MARKSMAN_DAMAGE_INCREASE_PERCENT}% more damage`,
    skillId: PHANTOM_ARSENAL_SKILL_ID,
    evolution: 'phantom-arsenal-marksman',
    phantomArsenalMarksman: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(PHANTOM_ARSENAL_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('phantom-arsenal-marksman') &&
      !state.selectedUpgradeIds.includes('phantom-arsenal-volley'),
  },
  {
    id: 'sigil-of-ruin-unlock',
    name: 'Sigil of Ruin',
    description: 'Unlock a chaos brand that charges from different damage sources and detonates.',
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: 'Unlock skill',
    skillId: SIGIL_OF_RUIN_SKILL_ID,
    skillAction: 'unlock',
    isEligible: (state) =>
      state.ownedSkillIds.length < state.skillSlotCount &&
      !state.ownedSkillIds.includes(SIGIL_OF_RUIN_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('sigil-of-ruin-unlock'),
  },
  {
    id: 'sigil-of-ruin-level',
    name: 'Deepening Ruin',
    description: `Increase Sigil of Ruin detonation damage by ${SIGIL_OF_RUIN_LEVEL_DAMAGE_INCREASE_PERCENT}%.`,
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: `+${SIGIL_OF_RUIN_LEVEL_DAMAGE_INCREASE_PERCENT}% increased Ruin detonation damage`,
    skillId: SIGIL_OF_RUIN_SKILL_ID,
    skillAction: 'level',
    skillDamageIncreasePercent: SIGIL_OF_RUIN_LEVEL_DAMAGE_INCREASE_PERCENT,
    isEligible: (state) => (state.skillLevels[SIGIL_OF_RUIN_SKILL_ID] ?? 0) >= 1,
  },
  {
    id: 'sigil-of-ruin-contagious-script',
    name: 'Contagious Script',
    description: `A Ruin Sigil detonation spreads sigils to nearby enemies with ${Math.round(SIGIL_OF_RUIN_CONTAGIOUS_STORED_CAP_MULTIPLIER * 100)}% of the normal stored-damage cap.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: `${Math.round(SIGIL_OF_RUIN_CONTAGIOUS_STORED_CAP_MULTIPLIER * 100)}% stored-damage cap on spread sigils`,
    skillId: SIGIL_OF_RUIN_SKILL_ID,
    evolution: 'sigil-of-ruin-contagious-script',
    evolutionTags: ['ruin-sigil', 'chaos-damage'],
    sigilOfRuinContagiousScript: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(SIGIL_OF_RUIN_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('sigil-of-ruin-contagious-script') &&
      !state.selectedUpgradeIds.includes('sigil-of-ruin-execution-protocol'),
  },
  {
    id: 'sigil-of-ruin-execution-protocol',
    name: 'Execution Protocol',
    description: `A fully charged Ruin Sigil waits until the target drops below ${Math.round(SIGIL_OF_RUIN_EXECUTION_HP_THRESHOLD * 100)}% HP, then detonates for ${Math.round((SIGIL_OF_RUIN_EXECUTION_DAMAGE_MULTIPLIER - 1) * 100)}% more damage.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: `+${Math.round((SIGIL_OF_RUIN_EXECUTION_DAMAGE_MULTIPLIER - 1) * 100)}% more detonation damage below ${Math.round(SIGIL_OF_RUIN_EXECUTION_HP_THRESHOLD * 100)}% HP`,
    skillId: SIGIL_OF_RUIN_SKILL_ID,
    evolution: 'sigil-of-ruin-execution-protocol',
    evolutionTags: ['ruin-sigil'],
    sigilOfRuinExecutionProtocol: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(SIGIL_OF_RUIN_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('sigil-of-ruin-execution-protocol') &&
      !state.selectedUpgradeIds.includes('sigil-of-ruin-contagious-script'),
  },
  {
    id: 'mirrorcast-unlock',
    name: 'Mirrorcast',
    description: `Unlock an Echo that copies your next eligible non-Basic skill at ${Math.round(MIRRORCAST_BASE_EFFECTIVENESS * 100)}% effectiveness. After unlocking, open any eligible skill's tooltip and choose Focus Echo to make Mirrorcast wait for that skill instead.`,
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: 'Unlock skill',
    skillId: MIRRORCAST_SKILL_ID,
    skillAction: 'unlock',
    isEligible: (state) =>
      state.ownedSkillIds.length < state.skillSlotCount &&
      !state.ownedSkillIds.includes(MIRRORCAST_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('mirrorcast-unlock'),
  },
  {
    id: 'mirrorcast-level',
    name: 'Sharper Reflection',
    description: `Increase the effectiveness of Mirrorcast copies by ${MIRRORCAST_LEVEL_EFFECTIVENESS_INCREASE_PERCENT}%.`,
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: `+${MIRRORCAST_LEVEL_EFFECTIVENESS_INCREASE_PERCENT}% copy effectiveness`,
    skillId: MIRRORCAST_SKILL_ID,
    skillAction: 'level',
    skillDamageIncreasePercent: MIRRORCAST_LEVEL_EFFECTIVENESS_INCREASE_PERCENT,
    isEligible: (state) => (state.skillLevels[MIRRORCAST_SKILL_ID] ?? 0) >= 1,
  },
  {
    id: 'mirrorcast-double-exposure',
    name: 'Double Exposure',
    description: `Mirrorcast arms ${MIRRORCAST_DOUBLE_EXPOSURE_ECHO_COUNT} Echoes instead of one, each copying at ${Math.round(MIRRORCAST_DOUBLE_EXPOSURE_EFFECTIVENESS * 100)}% effectiveness.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: `${MIRRORCAST_DOUBLE_EXPOSURE_ECHO_COUNT} Echoes at ${Math.round(MIRRORCAST_DOUBLE_EXPOSURE_EFFECTIVENESS * 100)}% effectiveness`,
    skillId: MIRRORCAST_SKILL_ID,
    evolution: 'mirrorcast-double-exposure',
    evolutionTags: ['echo'],
    mirrorcastDoubleExposure: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(MIRRORCAST_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('mirrorcast-double-exposure') &&
      !state.selectedUpgradeIds.includes('mirrorcast-deferred-echo'),
  },
  {
    id: 'mirrorcast-deferred-echo',
    name: 'Deferred Echo',
    description: `The Echo copies later at ${Math.round(MIRRORCAST_DEFERRED_EFFECTIVENESS * 100)}% effectiveness, and retargets onto a new enemy if its target dies first.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: `${Math.round(MIRRORCAST_DEFERRED_EFFECTIVENESS * 100)}% effectiveness, retargets on kill`,
    skillId: MIRRORCAST_SKILL_ID,
    evolution: 'mirrorcast-deferred-echo',
    evolutionTags: ['echo'],
    mirrorcastDeferredEcho: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(MIRRORCAST_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('mirrorcast-deferred-echo') &&
      !state.selectedUpgradeIds.includes('mirrorcast-double-exposure'),
  },
  {
    id: 'critical-spellstrike-unlock',
    name: 'Critical Spellstrike',
    description: `Unlock a passive trigger: resolved Basic Attack critical hits replay your focused Triggerable skill at ${Math.round(CRITICAL_SPELLSTRIKE_BASE_EFFECTIVENESS * 100)}% effectiveness. Grants +50% global critical chance and -70% global critical multiplier.`,
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: 'Unlock skill',
    skillId: CRITICAL_SPELLSTRIKE_SKILL_ID,
    skillAction: 'unlock',
    isEligible: (state) =>
      state.ownedSkillIds.length < state.skillSlotCount &&
      !state.ownedSkillIds.includes(CRITICAL_SPELLSTRIKE_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('critical-spellstrike-unlock'),
  },
  {
    id: 'critical-spellstrike-level',
    name: 'Critical Focus',
    description: `Increase Critical Spellstrike trigger effectiveness by ${Math.round(CRITICAL_SPELLSTRIKE_EFFECTIVENESS_PER_LEVEL * 100)}%.`,
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: `+${Math.round(CRITICAL_SPELLSTRIKE_EFFECTIVENESS_PER_LEVEL * 100)}% trigger effectiveness`,
    skillId: CRITICAL_SPELLSTRIKE_SKILL_ID,
    skillAction: 'level',
    isEligible: (state) => (state.skillLevels[CRITICAL_SPELLSTRIKE_SKILL_ID] ?? 0) >= 1,
  },
  {
    id: 'critical-spellstrike-rapid-invocation',
    name: 'Rapid Invocation',
    description: `Reduce Critical Spellstrike base cooldown from 1.0 to ${CRITICAL_SPELLSTRIKE_RAPID_COOLDOWN_SECONDS.toFixed(1)} seconds before ordinary cooldown reduction.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: `${CRITICAL_SPELLSTRIKE_RAPID_COOLDOWN_SECONDS.toFixed(1)}s base cooldown before CDR`,
    skillId: CRITICAL_SPELLSTRIKE_SKILL_ID,
    evolution: 'critical-spellstrike-rapid-invocation',
    criticalSpellstrikeRapidInvocation: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(CRITICAL_SPELLSTRIKE_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('critical-spellstrike-rapid-invocation') &&
      !state.selectedUpgradeIds.includes('critical-spellstrike-overwhelming-spellstrike'),
  },
  {
    id: 'critical-spellstrike-overwhelming-spellstrike',
    name: 'Overwhelming Spellstrike',
    description: `Set Critical Spellstrike baseline trigger effectiveness to ${Math.round(CRITICAL_SPELLSTRIKE_OVERWHELMING_EFFECTIVENESS * 100)}%; Critical Focus still adds ${Math.round(CRITICAL_SPELLSTRIKE_EFFECTIVENESS_PER_LEVEL * 100)}% per rank.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: `${Math.round(CRITICAL_SPELLSTRIKE_OVERWHELMING_EFFECTIVENESS * 100)}% baseline trigger effectiveness`,
    skillId: CRITICAL_SPELLSTRIKE_SKILL_ID,
    evolution: 'critical-spellstrike-overwhelming-spellstrike',
    criticalSpellstrikeOverwhelming: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(CRITICAL_SPELLSTRIKE_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('critical-spellstrike-overwhelming-spellstrike') &&
      !state.selectedUpgradeIds.includes('critical-spellstrike-rapid-invocation'),
  },
  {
    id: 'razorwire-unlock',
    name: 'Razorwire',
    description: 'Unlock a persistent wire that damages and slows enemies who cross it.',
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: 'Unlock skill',
    skillId: RAZORWIRE_SKILL_ID,
    skillAction: 'unlock',
    isEligible: (state) =>
      state.ownedSkillIds.length < state.skillSlotCount &&
      !state.ownedSkillIds.includes(RAZORWIRE_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('razorwire-unlock'),
  },
  {
    id: 'razorwire-level',
    name: 'Honed Edges',
    description: `Increase Razorwire crossing damage by ${RAZORWIRE_LEVEL_DAMAGE_INCREASE_PERCENT}%.`,
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: `+${RAZORWIRE_LEVEL_DAMAGE_INCREASE_PERCENT}% increased Razorwire damage`,
    skillId: RAZORWIRE_SKILL_ID,
    skillAction: 'level',
    skillDamageIncreasePercent: RAZORWIRE_LEVEL_DAMAGE_INCREASE_PERCENT,
    isEligible: (state) => (state.skillLevels[RAZORWIRE_SKILL_ID] ?? 0) >= 1,
  },
  {
    id: 'razorwire-tripwire-network',
    name: 'Tripwire Network',
    description: `Razorwire deploys ${RAZORWIRE_TRIPWIRE_COUNT} shorter wires around the target, each dealing ${Math.round((1 - RAZORWIRE_TRIPWIRE_DAMAGE_MULTIPLIER) * 100)}% less damage.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: `${RAZORWIRE_TRIPWIRE_COUNT} wires at ${Math.round(RAZORWIRE_TRIPWIRE_DAMAGE_MULTIPLIER * 100)}% damage each`,
    skillId: RAZORWIRE_SKILL_ID,
    evolution: 'razorwire-tripwire-network',
    evolutionTags: ['wire'],
    razorwireTripwireNetwork: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(RAZORWIRE_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('razorwire-tripwire-network') &&
      !state.selectedUpgradeIds.includes('razorwire-guillotine-line'),
  },
  {
    id: 'razorwire-guillotine-line',
    name: 'Guillotine Line',
    description: `Razorwire strings one longer, narrower wire that builds Tension on each crossing and snaps for ${Math.round(RAZORWIRE_GUILLOTINE_SNAP_DAMAGE_MULTIPLIER * 100)}% crossing damage at ${RAZORWIRE_GUILLOTINE_TENSION_CAP} Tension.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: `${Math.round(RAZORWIRE_GUILLOTINE_SNAP_DAMAGE_MULTIPLIER * 100)}% damage snap at ${RAZORWIRE_GUILLOTINE_TENSION_CAP} Tension`,
    skillId: RAZORWIRE_SKILL_ID,
    evolution: 'razorwire-guillotine-line',
    evolutionTags: ['wire', 'tension'],
    razorwireGuillotineLine: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(RAZORWIRE_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('razorwire-guillotine-line') &&
      !state.selectedUpgradeIds.includes('razorwire-tripwire-network'),
  },
  {
    id: 'blood-rite-unlock',
    name: 'Blood Rite',
    description: 'Unlock a ritual that sacrifices HP to store Blood Debt for your next skill.',
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: 'Unlock skill',
    skillId: BLOOD_RITE_SKILL_ID,
    skillAction: 'unlock',
    isEligible: (state) =>
      state.ownedSkillIds.length < state.skillSlotCount &&
      !state.ownedSkillIds.includes(BLOOD_RITE_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('blood-rite-unlock'),
  },
  {
    id: 'blood-rite-level',
    name: 'Deeper Sacrifice',
    description: `Increase Blood Rite pulse and Blood Debt damage by ${BLOOD_RITE_LEVEL_DAMAGE_INCREASE_PERCENT}%.`,
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: `+${BLOOD_RITE_LEVEL_DAMAGE_INCREASE_PERCENT}% increased Blood Rite damage`,
    skillId: BLOOD_RITE_SKILL_ID,
    skillAction: 'level',
    skillDamageIncreasePercent: BLOOD_RITE_LEVEL_DAMAGE_INCREASE_PERCENT,
    isEligible: (state) => (state.skillLevels[BLOOD_RITE_SKILL_ID] ?? 0) >= 1,
  },
  {
    id: 'blood-rite-sanguine-pact',
    name: 'Sanguine Pact',
    description: `Part of the damage empowered by Blood Debt heals you for ${Math.round(BLOOD_RITE_SANGUINE_HEAL_RATIO * 100)}% of the bonus.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: `Empowered damage heals ${Math.round(BLOOD_RITE_SANGUINE_HEAL_RATIO * 100)}%`,
    skillId: BLOOD_RITE_SKILL_ID,
    evolution: 'blood-rite-sanguine-pact',
    evolutionTags: ['blood-debt', 'leech'],
    bloodRiteSanguinePact: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(BLOOD_RITE_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('blood-rite-sanguine-pact') &&
      !state.selectedUpgradeIds.includes('blood-rite-crimson-debt'),
  },
  {
    id: 'blood-rite-crimson-debt',
    name: 'Crimson Debt',
    description: `Blood Rite stores ${BLOOD_RITE_CRIMSON_CHARGES} smaller Blood Debt charges instead of one.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: `${BLOOD_RITE_CRIMSON_CHARGES} smaller Blood Debt charges`,
    skillId: BLOOD_RITE_SKILL_ID,
    evolution: 'blood-rite-crimson-debt',
    evolutionTags: ['blood-debt'],
    bloodRiteCrimsonDebt: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(BLOOD_RITE_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('blood-rite-crimson-debt') &&
      !state.selectedUpgradeIds.includes('blood-rite-sanguine-pact'),
  },
  {
    id: 'prism-halo-unlock',
    name: 'Prism Halo',
    description: 'Unlock three orbiting shards that fire Fire, Cold, and Lightning at nearby enemies.',
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: 'Unlock skill',
    skillId: PRISM_HALO_SKILL_ID,
    skillAction: 'unlock',
    isEligible: (state) =>
      state.ownedSkillIds.length < state.skillSlotCount &&
      !state.ownedSkillIds.includes(PRISM_HALO_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('prism-halo-unlock'),
  },
  {
    id: 'prism-halo-level',
    name: 'Focused Facets',
    description: `Increase Prism Halo shard damage by ${PRISM_HALO_LEVEL_DAMAGE_INCREASE_PERCENT}%.`,
    category: 'skill',
    rarity: Rarity.Common,
    amount: 1,
    valueLabel: `+${PRISM_HALO_LEVEL_DAMAGE_INCREASE_PERCENT}% increased Prism Halo damage`,
    skillId: PRISM_HALO_SKILL_ID,
    skillAction: 'level',
    skillDamageIncreasePercent: PRISM_HALO_LEVEL_DAMAGE_INCREASE_PERCENT,
    isEligible: (state) => (state.skillLevels[PRISM_HALO_SKILL_ID] ?? 0) >= 1,
  },
  {
    id: 'prism-halo-chromatic-convergence',
    name: 'Chromatic Convergence',
    description: `Landing Fire, Cold, and Lightning on the same enemy within ${PRISM_HALO_CONVERGENCE_WINDOW_SECONDS} seconds triggers a Prism Burst for ${Math.round(PRISM_HALO_CONVERGENCE_BURST_MULTIPLIER * 100)}% total shard damage split across all three elements.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: `Prism Burst: ${Math.round(PRISM_HALO_CONVERGENCE_BURST_MULTIPLIER * 100)}% total shard damage`,
    skillId: PRISM_HALO_SKILL_ID,
    evolution: 'prism-halo-chromatic-convergence',
    evolutionTags: ['convergence'],
    prismHaloChromaticConvergence: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(PRISM_HALO_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('prism-halo-chromatic-convergence') &&
      !state.selectedUpgradeIds.includes('prism-halo-refraction'),
  },
  {
    id: 'prism-halo-refraction',
    name: 'Refraction',
    description: `Each Prism shard impact splits into up to ${PRISM_HALO_REFRACTION_MAX_SPLITS} projectiles that each deal ${Math.round(PRISM_HALO_REFRACTION_DAMAGE_MULTIPLIER * 100)}% of the shard's damage to nearby enemies.`,
    category: 'skill',
    rarity: Rarity.Uncommon,
    amount: 1,
    valueLabel: `${PRISM_HALO_REFRACTION_MAX_SPLITS} projectiles at ${Math.round(PRISM_HALO_REFRACTION_DAMAGE_MULTIPLIER * 100)}% damage`,
    skillId: PRISM_HALO_SKILL_ID,
    evolution: 'prism-halo-refraction',
    evolutionTags: ['projectile-chain'],
    prismHaloRefraction: true,
    isEligible: (state) =>
      state.ownedSkillIds.includes(PRISM_HALO_SKILL_ID) &&
      !state.selectedUpgradeIds.includes('prism-halo-refraction') &&
      !state.selectedUpgradeIds.includes('prism-halo-chromatic-convergence'),
  },
  ...SYNERGY_UPGRADES,
]
