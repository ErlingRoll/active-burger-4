import type { WeaponArchetype } from '../gear/Items'
import {
  BASIC_ATTACK_ARROW_DEFINITION_ID,
  BASIC_ATTACK_ORB_DEFINITION_ID,
  type ProjectileDefinitionId,
} from '../projectiles/Projectiles'
import type { PartialDamageValues } from '../stats/Damage'

export type SkillId =
  | 'basic-attack'
  | 'whirlwind'
  | 'chain-lightning'

export type SkillTag =
  | 'physical'
  | 'projectile'
  | 'melee'
  | 'area'
  | 'lightning'
  | 'fire'
  | 'cold'
  | 'chaos'

export type SkillKind = 'projectile' | 'area' | 'chain'

/**
 * Rendering metadata owned by skill content. The renderer uses this contract
 * to project effects without knowing individual skill IDs.
 */
export interface SkillVisualPresentation {
  kind: 'projectile' | 'area' | 'chain'
  icon: string
  primaryColor: string
  secondaryColor: string
  outlineColor: string
  trailLength?: number
  trailWidth?: number
  nodeRadius?: number
  projectileShape?: 'arrow' | 'orb'
}

export interface SkillDefinition {
  id: SkillId
  name: string
  description: string
  kind: SkillKind
  tags: readonly SkillTag[]
  cooldown: number
  baseDamage: PartialDamageValues
  damagePerLevel: PartialDamageValues
  radius?: number
  maxRange?: number
  maxTargets?: number
  jumpRange?: number
  projectileDefinitionId?: ProjectileDefinitionId
  effectLifetime: number
  visual: SkillVisualPresentation
}

export interface BasicAttackVariantDefinition {
  id: WeaponArchetype
  description: string
  kind: 'projectile' | 'area'
  tags: readonly SkillTag[]
  projectileDefinitionId?: ProjectileDefinitionId
  swingArcDegrees?: number
  spreadDegrees?: number
  maxExtraProjectiles?: number
  effectLifetime: number
  visual: SkillVisualPresentation
}

export const BASIC_ATTACK_SKILL_ID: SkillId = 'basic-attack'
export const WHIRLWIND_SKILL_ID: SkillId = 'whirlwind'
export const CHAIN_LIGHTNING_SKILL_ID: SkillId = 'chain-lightning'

export const BASIC_ATTACK_VARIANTS = {
  sword: {
    id: 'sword',
    description: 'Sweeps a wide melee arc through enemies in front of you.',
    kind: 'area',
    tags: ['physical', 'melee', 'area'],
    swingArcDegrees: 110,
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
    description: 'Fires arrows in a tight spread toward the current target.',
    kind: 'projectile',
    tags: ['physical', 'projectile'],
    projectileDefinitionId: BASIC_ATTACK_ARROW_DEFINITION_ID,
    spreadDegrees: 8,
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
    description: 'Launches a seeking bolt that curves toward a living target.',
    kind: 'projectile',
    tags: ['physical', 'projectile'],
    projectileDefinitionId: BASIC_ATTACK_ORB_DEFINITION_ID,
    spreadDegrees: 6,
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
    damagePerLevel: { physical: 2 },
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
    damagePerLevel: { physical: 3 },
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
    damagePerLevel: { lightning: 2 },
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
} as const satisfies Record<SkillId, SkillDefinition>

export function getBasicAttackVariant(
  weaponArchetype?: WeaponArchetype,
): BasicAttackVariantDefinition {
  return BASIC_ATTACK_VARIANTS[weaponArchetype ?? 'wand']
}
