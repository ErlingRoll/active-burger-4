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
export const DEFAULT_SKILL_SLOT_COUNT = 5
export const SKILL_REMOVAL_CHANCE = 0.05

export const BASIC_ATTACK_VARIANTS = {
  sword: {
    id: 'sword',
    description: 'Sweeps a wide melee arc through enemies in front of you.',
    kind: 'area',
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
    description: 'Automatically restores 2 HP every 5 seconds. Each level adds 2 HP per cast.',
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
} as const satisfies Record<SkillId, SkillDefinition>
