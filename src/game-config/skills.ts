import type { WeaponArchetype } from '../content/gear/Items'
import { BOW_PRECISION_DAMAGE_INCREASE_PERCENT } from '../content/gear/ImplicitModifiers'
import {
  BASIC_ATTACK_ARROW_DEFINITION_ID,
  BASIC_ATTACK_ORB_DEFINITION_ID,
  GLACIAL_ORB_PROJECTILE_DEFINITION_ID,
  RIFT_JAVELIN_PROJECTILE_DEFINITION_ID,
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
export const RALLYING_BANNER_SKILL_ID: SkillId = 'rallying-banner'
export const GRAVITY_WELL_SKILL_ID: SkillId = 'gravity-well'
export const AEGIS_PULSE_SKILL_ID: SkillId = 'aegis-pulse'
export const RIFT_JAVELIN_SKILL_ID: SkillId = 'rift-javelin'
export const CINDER_MINE_SKILL_ID: SkillId = 'cinder-mine'
export const STORM_RELAY_SKILL_ID: SkillId = 'storm-relay'
export const SOUL_TETHER_SKILL_ID: SkillId = 'soul-tether'
export const PHANTOM_ARSENAL_SKILL_ID: SkillId = 'phantom-arsenal'
export const SIGIL_OF_RUIN_SKILL_ID: SkillId = 'sigil-of-ruin'
export const MIRRORCAST_SKILL_ID: SkillId = 'mirrorcast'
export const RAZORWIRE_SKILL_ID: SkillId = 'razorwire'
export const BLOOD_RITE_SKILL_ID: SkillId = 'blood-rite'
export const PRISM_HALO_SKILL_ID: SkillId = 'prism-halo'
export const DEFAULT_SKILL_SLOT_COUNT = 5
export const DEFAULT_RESONANCE_ATTACKS = 5
export const DEFAULT_ATTUNEMENT_PERCENT = 50
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
export const RALLYING_BANNER_BASE_DURATION_SECONDS = 6
export const RALLYING_BANNER_HEAL_INTERVAL_SECONDS = 1
export const RALLYING_BANNER_EFFECT_RADIUS = 96
export const RALLYING_BANNER_SYNERGY_MAX_DURATION_SECONDS = 12
export const RALLYING_BANNER_RESONANCE_DURATION_BONUS_SECONDS = 4
export const RALLYING_BANNER_BASE_DAMAGE_REDUCTION_PERCENT = 10
export const RALLYING_BANNER_BULWARK_DAMAGE_REDUCTION_BONUS_PERCENT = 15
export const RALLYING_BANNER_BULWARK_DURATION_BONUS_SECONDS = 4
export const RALLYING_BANNER_COMMANDER_COOLDOWN_REDUCTION_PERCENT = 12
export const GRAVITY_WELL_BASE_PULL_DISTANCE = 60
export const GRAVITY_WELL_SINGULARITY_PULL_BONUS = 40
export const GRAVITY_WELL_SINGULARITY_RADIUS_BONUS = 30
export const GRAVITY_WELL_EVENT_HORIZON_DAMAGE_INCREASE_PERCENT = 50
export const AEGIS_PULSE_BASE_DURATION_SECONDS = 4
export const AEGIS_PULSE_SHIELD_AMOUNT_PER_LEVEL = 6
export const AEGIS_PULSE_BULWARK_SHIELD_AMOUNT_BONUS = 12
export const AEGIS_PULSE_BULWARK_DURATION_BONUS_SECONDS = 2
export const AEGIS_PULSE_REPRISAL_RATIO = 0.5
export const AEGIS_PULSE_RESONANCE_SHIELD_MULTIPLIER = 1.5
export const RIFT_JAVELIN_RESONANCE_RETURN_BONUS_PERCENT = 50
export const SOUL_TETHER_RESONANCE_DAMAGE_MULTIPLIER = 2
export const PHANTOM_ARSENAL_RESONANCE_DURATION_BONUS_SECONDS = 4

export const RIFT_JAVELIN_MAX_RANGE = 260
export const RIFT_JAVELIN_BARBED_DURATION_SECONDS = 3
export const RIFT_JAVELIN_BARBED_PHYSICAL_CHAOS_RATIO = 0.35
export const RIFT_JAVELIN_HOMEWARD_DAMAGE_INCREASE_PERCENT = 40

export const CINDER_MINE_FUSE_SECONDS = 1.1
export const CINDER_MINE_BURNING_DURATION_SECONDS = 3
export const CINDER_MINE_BURNING_FIRE_DAMAGE_RATIO = 0.4
export const CINDER_MINE_INFERNO_RADIUS_BONUS = 30
export const CINDER_MINE_INFERNO_BURNING_RATIO_BONUS = 0.2
export const CINDER_MINE_CLUSTER_OFFSET = 46
export const CINDER_MINE_CLUSTER_DAMAGE_MULTIPLIER = 0.65

export const STORM_RELAY_BASE_DURATION_SECONDS = 9
export const STORM_RELAY_STRIKE_INTERVAL_SECONDS = 1.8
export const STORM_RELAY_OVERCHARGE_STRIKE_INTERVAL_SECONDS = 1.1
export const STORM_RELAY_OVERCHARGE_SHOCK_STACKS = 2
export const STORM_RELAY_CONDUIT_BURST_RADIUS = 90
export const STORM_RELAY_CONDUIT_BURST_DAMAGE_RATIO = 0.6

export const SOUL_TETHER_DURATION_SECONDS = 7
export const SOUL_TETHER_BASE_HEALING_RATIO = 0.05
export const SOUL_TETHER_SIPHON_HEALING_BONUS = 0.05
export const SOUL_TETHER_RETARGET_DAMAGE_MULTIPLIER = 0.5
export const SOUL_TETHER_SNAP_BURST_SECONDS_EQUIVALENT = 3.5
export const SOUL_TETHER_REQUIEM_BURST_TARGET_COUNT = 3

export const RAISE_SKELETON_LEGION_BASE_ATTACK_SPEED_INCREASE_PERCENT = 5
export const RAISE_SKELETON_LEGION_ATTACK_SPEED_PER_ADDITIONAL_SKELETON_PERCENT = 3
export const RAISE_SKELETON_LEGION_MAX_ATTACK_SPEED_INCREASE_PERCENT = 14
export const RAISE_SKELETON_ROTTING_BONES_POISON_DURATION_SECONDS = 2
export const RAISE_SKELETON_ROTTING_BONES_POISON_PHYSICAL_CHAOS_RATIO = 0.12

export const PHANTOM_ARSENAL_DURATION_SECONDS = 12
export const PHANTOM_ARSENAL_VOLLEY_MAX_COUNT_BONUS = 1
export const PHANTOM_ARSENAL_VOLLEY_DAMAGE_REDUCTION_PERCENT = 20
export const PHANTOM_ARSENAL_MARKSMAN_RANGE_BONUS_PERCENT = 50
export const PHANTOM_ARSENAL_MARKSMAN_DAMAGE_INCREASE_PERCENT = 30

// Sigil of Ruin: a Ruin Sigil is placed on the nearest enemy. It gains at most
// one charge per distinct damage source category (Basic Attack, skill, summon,
// DoT) and detonates for chaos damage based on the capped damage dealt while
// marked once it reaches its charge threshold.
export const SIGIL_OF_RUIN_MAX_RANGE = 300
export const SIGIL_OF_RUIN_DURATION_SECONDS = 5
export const SIGIL_OF_RUIN_DETONATION_CHARGES = 3
export const SIGIL_OF_RUIN_RESONANCE_STARTING_CHARGES = 2
export const SIGIL_OF_RUIN_STORED_DAMAGE_CAP = 150
export const SIGIL_OF_RUIN_DETONATION_DAMAGE_RATIO = 0.75
export const SIGIL_OF_RUIN_EXECUTION_HP_THRESHOLD = 0.35
export const SIGIL_OF_RUIN_EXECUTION_DAMAGE_MULTIPLIER = 1.6
export const SIGIL_OF_RUIN_CONTAGIOUS_STORED_CAP_MULTIPLIER = 0.5
export const SIGIL_OF_RUIN_SPREAD_MAX_TARGETS = 3
export const SIGIL_OF_RUIN_SPREAD_RADIUS = 140

// Mirrorcast: arms an echo that copies the next non-Basic skill cast after a
// short delay at reduced effectiveness. Copies never arm another echo, so the
// skill can never nest into itself.
export const MIRRORCAST_CAPTURE_WINDOW_SECONDS = 6
export const MIRRORCAST_COPY_DELAY_SECONDS = 0.6
export const MIRRORCAST_DEFERRED_COPY_DELAY_SECONDS = 1.2
export const MIRRORCAST_BASE_EFFECTIVENESS = 0.5
export const MIRRORCAST_RESONANCE_EFFECTIVENESS = 0.7
export const MIRRORCAST_DOUBLE_EXPOSURE_EFFECTIVENESS = 0.35
export const MIRRORCAST_DEFERRED_EFFECTIVENESS = 0.65
export const MIRRORCAST_DOUBLE_EXPOSURE_ECHO_COUNT = 2
export const MIRRORCAST_COPY_MAX_RANGE = 320

// Razorwire: throws two anchors around the nearest enemy and connects them with
// a persistent wire. Crossing the wire deals physical damage and applies a brief
// slow, gated by a per-enemy crossing cooldown so there is no per-tick damage.
export const RAZORWIRE_DURATION_SECONDS = 8
export const RAZORWIRE_MAX_RANGE = 240
export const RAZORWIRE_WIRE_LENGTH = 160
export const RAZORWIRE_CROSSING_COOLDOWN_SECONDS = 0.9
export const RAZORWIRE_SLOW_CHILL_STACKS = 1
export const RAZORWIRE_SLOW_DURATION_SECONDS = 1.5
export const RAZORWIRE_CROSSING_MARGIN = 18
export const RAZORWIRE_TRIPWIRE_COUNT = 3
export const RAZORWIRE_TRIPWIRE_LENGTH = 96
export const RAZORWIRE_TRIPWIRE_DAMAGE_MULTIPLIER = 0.55
export const RAZORWIRE_GUILLOTINE_LENGTH = 240
export const RAZORWIRE_GUILLOTINE_MARGIN = 9
export const RAZORWIRE_GUILLOTINE_TENSION_CAP = 3
export const RAZORWIRE_GUILLOTINE_SNAP_DAMAGE_MULTIPLIER = 2.6

// Blood Rite: sacrifices a bounded portion of current HP (never lethal) to store
// Blood Debt. The next skill consumes the debt for a bounded, type-appropriate
// bonus. It emits a small chaos pulse on cast.
export const BLOOD_RITE_PULSE_RADIUS = 96
export const BLOOD_RITE_SACRIFICE_FRACTION = 0.15
export const BLOOD_RITE_MIN_HP_AFTER = 1
export const BLOOD_RITE_DEBT_DURATION_SECONDS = 8
export const BLOOD_RITE_BASE_POTENCY = 12
export const BLOOD_RITE_POTENCY_PER_SACRIFICED_HP = 0.8
export const BLOOD_RITE_MAX_POTENCY = 60
export const BLOOD_RITE_RESONANCE_POTENCY_MULTIPLIER = 1.5
export const BLOOD_RITE_SANGUINE_HEAL_RATIO = 0.4
export const BLOOD_RITE_CRIMSON_CHARGES = 2
export const BLOOD_RITE_CRIMSON_POTENCY_MULTIPLIER = 0.6
export const BLOOD_RITE_UTILITY_DURATION_BONUS_SECONDS = 2

// Prism Halo: three orbiting shards fire Fire, Cold, and Lightning in rotation
// at nearby enemies, applying the matching element status. Resonance fires all
// three at once and distributes Attunement a single time per volley.
export const PRISM_HALO_DURATION_SECONDS = 8
export const PRISM_HALO_RANGE = 220
export const PRISM_HALO_FIRE_INTERVAL_SECONDS = 0.7
export const PRISM_HALO_SHARD_COUNT = 3
export const PRISM_HALO_ORBIT_RADIUS = 46
export const PRISM_HALO_ORBIT_ANGULAR_SPEED = 2.4
export const PRISM_HALO_BURNING_DURATION_SECONDS = 3
export const PRISM_HALO_BURNING_FIRE_DAMAGE_RATIO = 0.35
export const PRISM_HALO_CHILL_STACKS = 1
export const PRISM_HALO_CHILL_DURATION_SECONDS = 4
export const PRISM_HALO_SHOCK_STACKS = 1
export const PRISM_HALO_SHOCK_DURATION_SECONDS = 4
export const PRISM_HALO_CONVERGENCE_WINDOW_SECONDS = 2.5
export const PRISM_HALO_CONVERGENCE_BURST_MULTIPLIER = 1.4
export const PRISM_HALO_REFRACTION_MAX_SPLITS = 2
export const PRISM_HALO_REFRACTION_DAMAGE_MULTIPLIER = 0.45
export const PRISM_HALO_REFRACTION_SPLIT_RADIUS = 120

// Synergy tuning shared by the new skills' interaction hooks (new skills only
// synergize with one another so existing skills keep their 3 synergy partners).
export const SIGIL_OF_RUIN_SANGUINE_HEAL_RATIO = 0.25
export const MIRRORCAST_WIRE_DURATION_BONUS_SECONDS = 2
export const RAZORWIRE_BLOODWIRE_CHAOS_DAMAGE = 8
export const BLOOD_RITE_PRISM_DURATION_BONUS_SECONDS = 2

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
    description: `Fires precise arrows in a wide spread toward the current target. Each arrow deals ${BOW_PRECISION_DAMAGE_INCREASE_PERCENT}% increased damage to that target.`,
    kind: 'projectile',
    attackRange: 160,
    tags: ['physical', 'projectile'],
    projectileDefinitionId: BASIC_ATTACK_ARROW_DEFINITION_ID,
    spreadDegrees: 15,
    maxExtraProjectiles: 4,
    primaryTargetDamageIncreasePercent: BOW_PRECISION_DAMAGE_INCREASE_PERCENT,
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
    description: 'Creates a 40-unit physical area hit that poisons every enemy it strikes for 4 seconds. Each Poison stack deals Chaos damage per second equal to 50% of the applying hit physical and chaos damage.',
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
    canProduceDirectHit: true,
    cooldown: 1,
    baseDamage: { physical: 0 },
    damagePerLevel: {},
    projectileDefinitionId: BASIC_ATTACK_ORB_DEFINITION_ID,
    effectLifetime: 0.12,
    resonanceEffect: undefined,
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
    canProduceDirectHit: true,
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
    resonanceEffect: {
      id: 'whirlwind-reset-attack',
      name: 'Cyclonic Reset',
      description: 'Resets Basic Attack immediately.',
    },
  },
  [CHAIN_LIGHTNING_SKILL_ID]: {
    id: CHAIN_LIGHTNING_SKILL_ID,
    name: 'Chain Lightning',
    description: 'Strikes a nearby enemy, then jumps to up to four distinct targets.',
    kind: 'chain',
    tags: ['lightning', 'area'],
    canProduceDirectHit: true,
    cooldown: 3,
    baseDamage: { lightning: 8 },
    damagePerLevel: {},
    maxRange: 260,
    jumpRange: 150,
    maxTargets: 5,
    effectLifetime: 0.18,
    visual: {
      kind: 'chain',
      icon: '⚡',
      primaryColor: '#22d3ee',
      secondaryColor: '#fef08a',
      outlineColor: '#cffafe',
      nodeRadius: 10,
    },
    resonanceEffect: {
      id: 'chain-lightning-extra-jump',
      name: 'Arc Overload',
      description: 'Chains to one additional enemy.',
    },
  },
  [VITALITY_SKILL_ID]: {
    id: VITALITY_SKILL_ID,
    name: 'Vitality',
    description: 'Automatically restores 6 HP every 5 seconds. Each level adds 2 HP per cast, and Vitality healing can critically strike.',
    kind: 'utility',
    tags: ['defensive'],
    canProduceDirectHit: false,
    cooldown: 5,
    baseDamage: {},
    damagePerLevel: {},
    baseHealing: 6,
    healingPerLevel: 2,
    effectLifetime: 0.3,
    visual: {
      kind: 'utility',
      icon: '♥',
      primaryColor: '#22c55e',
      secondaryColor: '#86efac',
      outlineColor: '#dcfce7',
    },
    resonanceEffect: {
      id: 'vitality-double-heal',
      name: 'Surging Vitality',
      description: 'Doubles this cast’s healing.',
    },
  },
  [RAISE_SKELETON_SKILL_ID]: {
    id: RAISE_SKELETON_SKILL_ID,
    name: 'Raise Skeleton',
    description: 'Summons a persistent skeleton that attacks nearby enemies.',
    kind: 'utility',
    tags: ['physical', 'summon'],
    canProduceDirectHit: true,
    cooldown: 5,
    baseDamage: {},
    damagePerLevel: {},
    summonBaseDamage: 6,
    summonDamageIncreasePercentPerLevel: 8,
    summonBaseMaxHp: 30,
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
    resonanceEffect: {
      id: 'raise-skeleton-reanimate',
      name: 'Reanimation',
      description: 'Restores all living Skeletons to full health.',
    },
  },
  [FIERY_TOUCH_SKILL_ID]: {
    id: FIERY_TOUCH_SKILL_ID,
    name: 'Fiery Touch',
    description: 'Direct hits ignite the struck enemy, damaging nearby enemies.',
    kind: 'area',
    tags: ['fire', 'area', 'trigger'],
    canProduceDirectHit: true,
    cooldown: 2,
    baseDamage: { fire: 10 },
    damagePerLevel: {},
    radius: 80,
    effectLifetime: 0.24,
    visual: {
      kind: 'area',
      icon: '🔥',
      primaryColor: '#f97316',
      secondaryColor: '#facc15',
      outlineColor: '#fff7ed',
    },
    resonanceEffect: {
      id: 'fiery-touch-inferno',
      name: 'Inferno Trigger',
      description: 'Expands the trigger radius by 50%.',
    },
  },
  [GLACIAL_ORB_SKILL_ID]: {
    id: GLACIAL_ORB_SKILL_ID,
    name: 'Glacial Orb',
    description: 'Launches a cold orb at the nearest enemy that explodes and chills everyone caught in the blast.',
    kind: 'area',
    tags: ['cold', 'projectile', 'area'],
    canProduceDirectHit: true,
    cooldown: 3.2,
    baseDamage: { cold: 9 },
    damagePerLevel: {},
    projectileDefinitionId: GLACIAL_ORB_PROJECTILE_DEFINITION_ID,
    spreadDegrees: 15,
    radius: 55,
    maxRange: 240,
    effectLifetime: 0.22,
    visual: {
      kind: 'area',
      icon: '❄',
      primaryColor: '#38bdf8',
      secondaryColor: '#bae6fd',
      outlineColor: '#e0f2fe',
      trailLength: 20,
      trailWidth: 5,
      projectileShape: 'orb',
    },
    resonanceEffect: {
      id: 'glacial-orb-deep-freeze',
      name: 'Deep Freeze',
      description: 'Applies one additional Chill stack on impact.',
    },
  },
  [LANCERS_CHARGE_SKILL_ID]: {
    id: LANCERS_CHARGE_SKILL_ID,
    name: "Lancer's Charge",
    description: 'Dashes toward the nearest enemy, striking everything in a narrow corridor and building Momentum with each hit.',
    kind: 'area',
    tags: ['physical', 'melee', 'area'],
    canProduceDirectHit: true,
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
    resonanceEffect: {
      id: 'lancers-charge-momentum',
      name: 'Relentless Momentum',
      description: 'Grants one additional Momentum stack after the charge.',
    },
  },
  [RALLYING_BANNER_SKILL_ID]: {
    id: RALLYING_BANNER_SKILL_ID,
    name: 'Rallying Banner',
    description: 'Plants a stationary banner with a 96-unit radius that heals you immediately, then heals you and living summons inside it every second while active. Reduces incoming damage while active. Deals no direct damage.',
    kind: 'utility',
    tags: ['defensive', 'duration'],
    canProduceDirectHit: false,
    cooldown: 16,
    baseDamage: {},
    damagePerLevel: {},
    baseHealing: 4,
    healingPerLevel: 2,
    effectLifetime: RALLYING_BANNER_BASE_DURATION_SECONDS,
    visual: {
      kind: 'utility',
      icon: '🚩',
      primaryColor: '#facc15',
      secondaryColor: '#fde68a',
      outlineColor: '#fef9c3',
    },
    resonanceEffect: {
      id: 'rallying-banner-rally',
      name: 'Grand Rally',
      description: 'Extends the banner duration by 4 seconds.',
    },
  },
  [GRAVITY_WELL_SKILL_ID]: {
    id: GRAVITY_WELL_SKILL_ID,
    name: 'Gravity Well',
    description: 'Crushes the space around you, pulling nearby enemies in and dealing chaos damage.',
    kind: 'area',
    tags: ['chaos', 'area'],
    canProduceDirectHit: true,
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
    resonanceEffect: {
      id: 'gravity-well-crush',
      name: 'Crushing Gravity',
      description: 'Doubles the pull distance of this cast.',
    },
  },
  [AEGIS_PULSE_SKILL_ID]: {
    id: AEGIS_PULSE_SKILL_ID,
    name: 'Aegis Pulse',
    description: `Releases a defensive burst that damages nearby enemies and grants a 14-HP absorb shield for ${AEGIS_PULSE_BASE_DURATION_SECONDS} seconds.`,
    kind: 'area',
    tags: ['physical', 'area', 'defensive'],
    canProduceDirectHit: true,
    cooldown: 11,
    baseDamage: { physical: 6 },
    damagePerLevel: {},
    radius: 70,
    shieldBaseAmount: 14,
    shieldAmountPerLevel: AEGIS_PULSE_SHIELD_AMOUNT_PER_LEVEL,
    effectLifetime: 0.3,
    visual: {
      kind: 'area',
      icon: '🛡',
      primaryColor: '#0ea5e9',
      secondaryColor: '#bae6fd',
      outlineColor: '#e0f2fe',
    },
    resonanceEffect: {
      id: 'aegis-pulse-fortify',
      name: 'Fortified Pulse',
      description: 'Increases the new shield by 50%.',
    },
  },
  [RIFT_JAVELIN_SKILL_ID]: {
    id: RIFT_JAVELIN_SKILL_ID,
    name: 'Rift Javelin',
    description: 'Hurls a long-range javelin that pierces every enemy in its path, then returns along the same path, hitting each enemy once outbound and once inbound.',
    kind: 'projectile',
    tags: ['physical', 'projectile'],
    canProduceDirectHit: true,
    cooldown: 3.4,
    baseDamage: { physical: 16 },
    damagePerLevel: {},
    projectileDefinitionId: RIFT_JAVELIN_PROJECTILE_DEFINITION_ID,
    spreadDegrees: 15,
    maxRange: RIFT_JAVELIN_MAX_RANGE,
    effectLifetime: 0.2,
    visual: {
      kind: 'projectile',
      icon: '⟰',
      primaryColor: '#8b5cf6',
      secondaryColor: '#a78bfa',
      outlineColor: '#ddd6fe',
      trailLength: 32,
      trailWidth: 4,
      projectileShape: 'arrow',
    },
    resonanceEffect: {
      id: 'rift-javelin-return',
      name: 'Rift Echo',
      description: 'The returning javelin deals 50% more damage.',
    },
  },
  [CINDER_MINE_SKILL_ID]: {
    id: CINDER_MINE_SKILL_ID,
    name: 'Cinder Mine',
    description: `Drops a fire trap that arms for ${CINDER_MINE_FUSE_SECONDS} seconds, then deals Fire damage in its blast and leaves every enemy caught in it Burning for ${CINDER_MINE_BURNING_DURATION_SECONDS} seconds. Burning deals Fire damage over time.`,
    kind: 'area',
    tags: ['fire', 'area', 'dot'],
    canProduceDirectHit: true,
    cooldown: 3.8,
    baseDamage: { fire: 15 },
    damagePerLevel: {},
    radius: 65,
    effectLifetime: 0.3,
    visual: {
      kind: 'area',
      icon: '⏱',
      primaryColor: '#ea580c',
      secondaryColor: '#fdba74',
      outlineColor: '#ffedd5',
    },
    resonanceEffect: {
      id: 'cinder-mine-quick-fuse',
      name: 'Quick Fuse',
      description: 'The first mine arms immediately.',
    },
  },
  [STORM_RELAY_SKILL_ID]: {
    id: STORM_RELAY_SKILL_ID,
    name: 'Storm Relay',
    description: `Plants a lightning relay that strikes the nearest enemy every ${STORM_RELAY_STRIKE_INTERVAL_SECONDS} seconds, chaining to nearby enemies and applying Shock, for ${STORM_RELAY_BASE_DURATION_SECONDS} seconds.`,
    kind: 'chain',
    tags: ['lightning', 'area', 'duration'],
    canProduceDirectHit: true,
    cooldown: 9,
    baseDamage: { lightning: 7 },
    damagePerLevel: {},
    maxRange: 240,
    jumpRange: 150,
    maxTargets: 3,
    effectLifetime: 0.18,
    visual: {
      kind: 'chain',
      icon: '🗼',
      primaryColor: '#38bdf8',
      secondaryColor: '#fef08a',
      outlineColor: '#e0f2fe',
      nodeRadius: 9,
    },
    resonanceEffect: {
      id: 'storm-relay-chain',
      name: 'Thunderhead',
      description: 'The relay chains to one additional enemy.',
    },
  },
  [SOUL_TETHER_SKILL_ID]: {
    id: SOUL_TETHER_SKILL_ID,
    name: 'Soul Tether',
    description: `Each cast latches onto the nearest enemy for ${SOUL_TETHER_DURATION_SECONDS} seconds. The tether deals Chaos damage only over time and restores a portion of that damage as health. Tethers are independent, and each snaps to one weaker nearby enemy when its target dies.`,
    kind: 'utility',
    tags: ['chaos', 'dot', 'trigger'],
    canProduceDirectHit: false,
    cooldown: 6.5,
    baseDamage: { chaos: 7 },
    damagePerLevel: {},
    maxRange: 320,
    effectLifetime: 0.15,
    visual: {
      kind: 'utility',
      icon: '🔗',
      primaryColor: '#a855f7',
      secondaryColor: '#f0abfc',
      outlineColor: '#fae8ff',
    },
    resonanceEffect: {
      id: 'soul-tether-amplify',
      name: 'Soul Surge',
      description: 'Doubles tether damage for its duration.',
    },
  },
  [PHANTOM_ARSENAL_SKILL_ID]: {
    id: PHANTOM_ARSENAL_SKILL_ID,
    name: 'Phantom Arsenal',
    description: `Summons a temporary spectral archer that fires physical bolts at nearby enemies for ${PHANTOM_ARSENAL_DURATION_SECONDS} seconds before fading.`,
    kind: 'utility',
    tags: ['physical', 'projectile', 'summon'],
    canProduceDirectHit: true,
    cooldown: 6,
    baseDamage: {},
    damagePerLevel: {},
    summonBaseDamage: 5,
    summonDamageIncreasePercentPerLevel: 8,
    summonBaseMaxHp: 8,
    summonMaxHpPerLevel: 3,
    summonAttackCooldown: 1.3,
    summonAttackRange: 190,
    summonBaseMaxCount: 1,
    spreadDegrees: 15,
    effectLifetime: 0.3,
    visual: {
      kind: 'utility',
      icon: '👻',
      primaryColor: '#60a5fa',
      secondaryColor: '#bfdbfe',
      outlineColor: '#eff6ff',
    },
    resonanceEffect: {
      id: 'phantom-arsenal-echo',
      name: 'Spectral Echo',
      description: 'Extends all Phantom Arsenal archer durations by 4 seconds.',
    },
  },
  [SIGIL_OF_RUIN_SKILL_ID]: {
    id: SIGIL_OF_RUIN_SKILL_ID,
    name: 'Sigil of Ruin',
    description: `Brands the nearest enemy with a Ruin Sigil for ${SIGIL_OF_RUIN_DURATION_SECONDS} seconds. The sigil gains one charge for each distinct damage source category that strikes the target, and at ${SIGIL_OF_RUIN_DETONATION_CHARGES} charges it detonates for chaos damage based on the capped damage dealt while marked.`,
    kind: 'utility',
    tags: ['chaos', 'trigger'],
    canProduceDirectHit: true,
    cooldown: 4.5,
    baseDamage: { chaos: 6 },
    damagePerLevel: {},
    maxRange: SIGIL_OF_RUIN_MAX_RANGE,
    effectLifetime: 0.2,
    visual: {
      kind: 'utility',
      icon: '⛧',
      primaryColor: '#a21caf',
      secondaryColor: '#f0abfc',
      outlineColor: '#fae8ff',
    },
    resonanceEffect: {
      id: 'sigil-of-ruin-overcharge',
      name: 'Cursed Brand',
      description: `The Ruin Sigil starts with ${SIGIL_OF_RUIN_RESONANCE_STARTING_CHARGES} charges and its detonation spreads 1-charge sigils to nearby enemies.`,
    },
  },
  [MIRRORCAST_SKILL_ID]: {
    id: MIRRORCAST_SKILL_ID,
    name: 'Mirrorcast',
    description: `Weaves a fragile Echo. The next non-Basic skill you cast is copied after a short delay at reduced effectiveness, without resetting the original cooldown. Mirrorcast can never copy itself.`,
    kind: 'utility',
    tags: ['trigger'],
    canProduceDirectHit: true,
    cooldown: 7,
    baseDamage: {},
    damagePerLevel: {},
    effectLifetime: 0.3,
    visual: {
      kind: 'utility',
      icon: '❖',
      primaryColor: '#38bdf8',
      secondaryColor: '#e0f2fe',
      outlineColor: '#f0f9ff',
    },
    resonanceEffect: {
      id: 'mirrorcast-true-image',
      name: 'True Image',
      description: 'The Echo copies at higher effectiveness and preserves an additional secondary effect.',
    },
  },
  [RAZORWIRE_SKILL_ID]: {
    id: RAZORWIRE_SKILL_ID,
    name: 'Razorwire',
    description: `Throws two anchors around the nearest enemy and strings a persistent Wire between them for ${RAZORWIRE_DURATION_SECONDS} seconds. Enemies crossing the Wire take physical damage and are briefly Chilled, limited by a short per-enemy crossing cooldown.`,
    kind: 'area',
    tags: ['physical', 'area'],
    canProduceDirectHit: true,
    cooldown: 6,
    baseDamage: { physical: 14 },
    damagePerLevel: {},
    radius: RAZORWIRE_WIRE_LENGTH / 2,
    maxRange: RAZORWIRE_MAX_RANGE,
    effectLifetime: 0.2,
    visual: {
      kind: 'area',
      icon: '⛓',
      primaryColor: '#94a3b8',
      secondaryColor: '#e2e8f0',
      outlineColor: '#f8fafc',
    },
    resonanceEffect: {
      id: 'razorwire-lattice',
      name: 'Razor Lattice',
      description: 'Strings a second crossing Wire to form a lattice around the target.',
    },
  },
  [BLOOD_RITE_SKILL_ID]: {
    id: BLOOD_RITE_SKILL_ID,
    name: 'Blood Rite',
    description: `Sacrifices a bounded portion of current HP (never lethal) to store Blood Debt and release a chaos pulse. Your next skill consumes the Blood Debt for a bounded, type-appropriate bonus.`,
    kind: 'utility',
    tags: ['chaos'],
    canProduceDirectHit: true,
    cooldown: 8,
    baseDamage: { chaos: 8 },
    damagePerLevel: {},
    radius: BLOOD_RITE_PULSE_RADIUS,
    effectLifetime: 0.3,
    visual: {
      kind: 'utility',
      icon: '🩸',
      primaryColor: '#b91c1c',
      secondaryColor: '#f87171',
      outlineColor: '#fee2e2',
    },
    resonanceEffect: {
      id: 'blood-rite-free-offering',
      name: 'Free Offering',
      description: 'Blood Rite costs no HP and stores a larger Blood Debt.',
    },
  },
  [PRISM_HALO_SKILL_ID]: {
    id: PRISM_HALO_SKILL_ID,
    name: 'Prism Halo',
    description: `Summons a Prism of three orbiting shards for ${PRISM_HALO_DURATION_SECONDS} seconds that fire Fire, Cold, and Lightning in rotation at nearby enemies, applying Fire Burning, Chill, and Shock.`,
    kind: 'utility',
    tags: ['fire', 'cold', 'lightning', 'duration'],
    canProduceDirectHit: true,
    cooldown: 7.5,
    baseDamage: { fire: 7 },
    damagePerLevel: {},
    maxRange: PRISM_HALO_RANGE,
    effectLifetime: 0.18,
    visual: {
      kind: 'utility',
      icon: '🔆',
      primaryColor: '#f97316',
      secondaryColor: '#38bdf8',
      outlineColor: '#fef9c3',
    },
    resonanceEffect: {
      id: 'prism-halo-full-spectrum',
      name: 'Full Spectrum',
      description: 'All three shards fire simultaneously, distributing Attunement once per volley.',
    },
  },
} as const satisfies Record<SkillId, SkillDefinition>
