import type { WeaponArchetype } from '../content/gear/Items'
import {
  BASIC_ATTACK_ARROW_DEFINITION_ID,
  BASIC_ATTACK_ORB_DEFINITION_ID,
} from '../content/projectiles/Projectiles'
import type {
  BasicAttackVariantDefinition,
  SkillDefinition,
  SkillId,
} from '../content/skills/SkillConfigs'

export const BASIC_ATTACK_SKILL_ID: SkillId = 'basic-attack'
export const WHIRLWIND_SKILL_ID: SkillId = 'whirlwind'
export const CHAIN_LIGHTNING_SKILL_ID: SkillId = 'chain-lightning'
export const VITALITY_SKILL_ID: SkillId = 'vitality'
export const RAISE_SKELETON_SKILL_ID: SkillId = 'raise-skeleton'
export const FIERY_TOUCH_SKILL_ID: SkillId = 'fiery-touch'
export const GLACIAL_ORB_SKILL_ID: SkillId = 'glacial-orb'
export const LANCERS_CHARGE_SKILL_ID: SkillId = 'lancers-charge'
export const RALLYING_STANDARD_SKILL_ID: SkillId = 'rallying-standard'
export const GRAVITY_WELL_SKILL_ID: SkillId = 'gravity-well'
export const AEGIS_PULSE_SKILL_ID: SkillId = 'aegis-pulse'
export const DEFAULT_SKILL_SLOT_COUNT = 5
export const SKILL_REMOVAL_CHANCE = 0.05
export const FROST_MAX_CHILL_STACKS = 3
export const FROST_DEFAULT_DURATION_SECONDS = 4
export const FROST_DEFAULT_FREEZE_DURATION_SECONDS = 1
export const SHOCK_MAX_STACKS = 3
export const SHOCK_DEFAULT_DURATION_SECONDS = 4
export const GLACIAL_ORB_ICE_LANCE_DAMAGE_INCREASE_PERCENT = 40
export const GLACIAL_ORB_PERMAFROST_RADIUS_BONUS = 25
export const GLACIAL_ORB_PERMAFROST_EXTRA_CHILL_STACKS = 1
export const LANCERS_CHARGE_MAX_MOMENTUM_STACKS = 3
export const LANCERS_CHARGE_MOMENTUM_PERCENT_PER_STACK = 6
export const LANCERS_CHARGE_VANGUARD_MOMENTUM_PERCENT_PER_STACK = 10
export const LANCERS_CHARGE_VANGUARD_SINGLE_TARGET_BONUS_PERCENT = 15
export const LANCERS_CHARGE_IMPALER_DAMAGE_REDUCTION_PERCENT = 15
export const LANCERS_CHARGE_IMPALER_RANGE_BONUS = 50
export const LANCERS_CHARGE_IMPALER_WIDTH_BONUS = 25
export const LANCERS_CHARGE_MOMENTUM_DECAY_SECONDS = 4
export const RALLYING_STANDARD_BASE_DURATION_SECONDS = 6
export const RALLYING_STANDARD_EFFECT_RADIUS = 96
export const RALLYING_STANDARD_BASE_DAMAGE_REDUCTION_PERCENT = 10
export const RALLYING_STANDARD_BULWARK_DAMAGE_REDUCTION_BONUS_PERCENT = 15
export const RALLYING_STANDARD_BULWARK_DURATION_BONUS_SECONDS = 4
export const RALLYING_STANDARD_COMMANDER_COOLDOWN_REDUCTION_PERCENT = 12
export const GRAVITY_WELL_BASE_PULL_DISTANCE = 60
export const GRAVITY_WELL_SINGULARITY_PULL_BONUS = 40
export const GRAVITY_WELL_SINGULARITY_RADIUS_BONUS = 30
export const GRAVITY_WELL_EVENT_HORIZON_DAMAGE_INCREASE_PERCENT = 50
export const AEGIS_PULSE_BASE_DURATION_SECONDS = 4
export const AEGIS_PULSE_BULWARK_SHIELD_AMOUNT_BONUS = 12
export const AEGIS_PULSE_BULWARK_DURATION_BONUS_SECONDS = 2
export const AEGIS_PULSE_REPRISAL_RATIO = 0.5

export const BASIC_ATTACK_VARIANTS = {
  sword: {
    id: 'sword',
    description: 'Sweeps a wide melee arc through enemies in front of you.',
    kind: 'area',
    attackRange: 45,
    tags: ['physical', 'melee', 'area'],
    swingArcDegrees: 100,
    effectLifetime: 0.14,
    visual: {
      kind: 'area',
      icon: '🗡',
      primaryColor: '#f97316',
      secondaryColor: '#fdba74',
      outlineColor: '#ffedd5',
    },
  },
  bow: {
    id: 'bow',
    description: 'Fires arrows in a wide spread toward the current target.',
    kind: 'projectile',
    attackRange: 160,
    tags: ['physical', 'projectile'],
    projectileDefinitionId: BASIC_ATTACK_ARROW_DEFINITION_ID,
    spreadDegrees: 15,
    maxExtraProjectiles: 4,
    effectLifetime: 0.12,
    visual: {
      kind: 'projectile',
      icon: '➶',
      primaryColor: '#84cc16',
      secondaryColor: '#bef264',
      outlineColor: '#ecfccb',
      trailLength: 22,
      trailWidth: 3,
      projectileShape: 'arrow',
    },
  },
  wand: {
    id: 'wand',
    description: 'Launches seeking bolts in a wide spread toward a living target.',
    kind: 'projectile',
    attackRange: 110,
    tags: ['physical', 'projectile'],
    projectileDefinitionId: BASIC_ATTACK_ORB_DEFINITION_ID,
    spreadDegrees: 30,
    maxExtraProjectiles: 4,
    effectLifetime: 0.12,
    visual: {
      kind: 'projectile',
      icon: '✦',
      primaryColor: '#22d3ee',
      secondaryColor: '#a855f7',
      outlineColor: '#e0f2fe',
      trailLength: 16,
      trailWidth: 5,
      projectileShape: 'orb',
    },
  },
  staff: {
    id: 'staff',
    description: 'Creates a 40-unit area hit that poisons every enemy it strikes for 4 seconds. Each poison stack deals 50% of the applying hit physical and chaos damage per second.',
    kind: 'area',
    attackRange: 110,
    tags: ['physical', 'area', 'dot'],
    areaShape: 'circle',
    areaRadius: 40,
    poisonApplication: {
      durationSeconds: 4,
      physicalChaosRatio: 0.5,
    },
    effectLifetime: 0.16,
    visual: {
      kind: 'area',
      icon: '✦',
      primaryColor: '#a855f7',
      secondaryColor: '#d8b4fe',
      outlineColor: '#f3e8ff',
    },
  },
} as const satisfies Record<WeaponArchetype, BasicAttackVariantDefinition>

export const SKILL_DEFINITIONS = {
  [BASIC_ATTACK_SKILL_ID]: {
    id: BASIC_ATTACK_SKILL_ID,
    name: 'Basic Attack',
    description: 'Automatically attacks with your equipped weapon archetype.',
    kind: 'projectile',
    tags: ['physical', 'projectile'],
    cooldown: 1,
    baseDamage: { physical: 0 },
    damagePerLevel: {},
    projectileDefinitionId: BASIC_ATTACK_ORB_DEFINITION_ID,
    effectLifetime: 0.12,
    visual: {
      kind: 'projectile',
      icon: '✦',
      primaryColor: '#22d3ee',
      secondaryColor: '#a855f7',
      outlineColor: '#e0f2fe',
      trailLength: 16,
      trailWidth: 5,
      projectileShape: 'orb',
    },
  },
  [WHIRLWIND_SKILL_ID]: {
    id: WHIRLWIND_SKILL_ID,
    name: 'Whirlwind',
    description: 'Periodically damages every enemy close to you.',
    kind: 'area',
    tags: ['physical', 'melee', 'area'],
    cooldown: 2.5,
    baseDamage: { physical: 8 },
    damagePerLevel: {},
    radius: 90,
    effectLifetime: 0.2,
    visual: {
      kind: 'area',
      icon: '⟳',
      primaryColor: '#a78bfa',
      secondaryColor: '#c4b5fd',
      outlineColor: '#ede9fe',
    },
  },
  [CHAIN_LIGHTNING_SKILL_ID]: {
    id: CHAIN_LIGHTNING_SKILL_ID,
    name: 'Chain Lightning',
    description: 'Strikes a nearby enemy, then jumps to two distinct targets.',
    kind: 'chain',
    tags: ['lightning', 'area'],
    cooldown: 3.5,
    baseDamage: { lightning: 7 },
    damagePerLevel: {},
    maxRange: 260,
    jumpRange: 150,
    maxTargets: 3,
    effectLifetime: 0.18,
    visual: {
      kind: 'chain',
      icon: '⚡',
      primaryColor: '#22d3ee',
      secondaryColor: '#fef08a',
      outlineColor: '#cffafe',
      nodeRadius: 10,
    },
  },
  [VITALITY_SKILL_ID]: {
    id: VITALITY_SKILL_ID,
    name: 'Vitality',
    description: 'Automatically restores 2 HP every 5 seconds. Each level adds 2 HP per cast. Vitality healing can critically strike.',
    kind: 'utility',
    tags: ['defensive'],
    cooldown: 5,
    baseDamage: {},
    damagePerLevel: {},
    baseHealing: 2,
    healingPerLevel: 2,
    effectLifetime: 0.3,
    visual: {
      kind: 'utility',
      icon: '♥',
      primaryColor: '#22c55e',
      secondaryColor: '#86efac',
      outlineColor: '#dcfce7',
    },
  },
  [RAISE_SKELETON_SKILL_ID]: {
    id: RAISE_SKELETON_SKILL_ID,
    name: 'Raise Skeleton',
    description: 'Summons a persistent skeleton that attacks nearby enemies.',
    kind: 'utility',
    tags: ['physical', 'summon'],
    cooldown: 5,
    baseDamage: {},
    damagePerLevel: {},
    summonBaseDamage: 6,
    summonDamageIncreasePercentPerLevel: 8,
    summonBaseMaxHp: 10,
    summonMaxHpPerLevel: 5,
    summonAttackCooldown: 1,
    summonAttackRange: 70,
    summonBaseMaxCount: 1,
    effectLifetime: 0.3,
    visual: {
      kind: 'utility',
      icon: '☠',
      primaryColor: '#c084fc',
      secondaryColor: '#e9d5ff',
      outlineColor: '#f5f3ff',
    },
  },
  [FIERY_TOUCH_SKILL_ID]: {
    id: FIERY_TOUCH_SKILL_ID,
    name: 'Fiery Touch',
    description: 'Direct hits ignite the struck enemy, damaging nearby enemies.',
    kind: 'area',
    tags: ['fire', 'area', 'trigger'],
    cooldown: 2,
    baseDamage: { fire: 10 },
    damagePerLevel: { fire: 5 },
    radius: 80,
    effectLifetime: 0.24,
    visual: {
      kind: 'area',
      icon: '🔥',
      primaryColor: '#f97316',
      secondaryColor: '#facc15',
      outlineColor: '#fff7ed',
    },
  },
  [GLACIAL_ORB_SKILL_ID]: {
    id: GLACIAL_ORB_SKILL_ID,
    name: 'Glacial Orb',
    description: 'Launches a cold orb at the nearest enemy that explodes and chills everyone caught in the blast.',
    kind: 'area',
    tags: ['cold', 'projectile', 'area'],
    cooldown: 3.2,
    baseDamage: { cold: 9 },
    damagePerLevel: {},
    radius: 55,
    maxRange: 240,
    effectLifetime: 0.22,
    visual: {
      kind: 'area',
      icon: '❄',
      primaryColor: '#38bdf8',
      secondaryColor: '#bae6fd',
      outlineColor: '#e0f2fe',
    },
  },
  [LANCERS_CHARGE_SKILL_ID]: {
    id: LANCERS_CHARGE_SKILL_ID,
    name: "Lancer's Charge",
    description: 'Dashes toward the nearest enemy, striking everything in a narrow corridor and building Momentum with each hit.',
    kind: 'area',
    tags: ['physical', 'melee', 'area'],
    cooldown: 2.6,
    baseDamage: { physical: 11 },
    damagePerLevel: {},
    radius: 36,
    maxRange: 170,
    effectLifetime: 0.16,
    visual: {
      kind: 'area',
      icon: '➳',
      primaryColor: '#fb923c',
      secondaryColor: '#fdba74',
      outlineColor: '#ffedd5',
    },
  },
  [RALLYING_STANDARD_SKILL_ID]: {
    id: RALLYING_STANDARD_SKILL_ID,
    name: 'Rallying Banner',
    description: 'Plants a banner that restores health and reduces incoming damage for its duration. Deals no direct damage.',
    kind: 'utility',
    tags: ['defensive', 'duration'],
    cooldown: 16,
    baseDamage: {},
    damagePerLevel: {},
    baseHealing: 4,
    healingPerLevel: 2,
    effectLifetime: RALLYING_STANDARD_BASE_DURATION_SECONDS,
    visual: {
      kind: 'utility',
      icon: '🚩',
      primaryColor: '#facc15',
      secondaryColor: '#fde68a',
      outlineColor: '#fef9c3',
    },
  },
  [GRAVITY_WELL_SKILL_ID]: {
    id: GRAVITY_WELL_SKILL_ID,
    name: 'Gravity Well',
    description: 'Crushes the space around you, pulling nearby enemies in and dealing chaos damage.',
    kind: 'area',
    tags: ['chaos', 'area'],
    cooldown: 5,
    baseDamage: { chaos: 7 },
    damagePerLevel: {},
    radius: 130,
    effectLifetime: 0.35,
    visual: {
      kind: 'area',
      icon: '🌀',
      primaryColor: '#7c3aed',
      secondaryColor: '#c4b5fd',
      outlineColor: '#ede9fe',
    },
  },
  [AEGIS_PULSE_SKILL_ID]: {
    id: AEGIS_PULSE_SKILL_ID,
    name: 'Aegis Pulse',
    description: 'Releases a defensive burst that damages nearby enemies and grants a temporary absorb shield.',
    kind: 'area',
    tags: ['physical', 'area', 'defensive'],
    cooldown: 11,
    baseDamage: { physical: 6 },
    damagePerLevel: {},
    radius: 70,
    shieldBaseAmount: 14,
    shieldAmountPerLevel: 6,
    effectLifetime: 0.3,
    visual: {
      kind: 'area',
      icon: '🛡',
      primaryColor: '#0ea5e9',
      secondaryColor: '#bae6fd',
      outlineColor: '#e0f2fe',
    },
  },
} as const satisfies Record<SkillId, SkillDefinition>
