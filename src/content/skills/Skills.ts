import {
  BASIC_BOLT_DEFINITION_ID,
  type ProjectileDefinitionId,
} from '../projectiles/Projectiles'

export type SkillId =
  | 'basic-bolt'
  | 'whirlwind'
  | 'chain-lightning'

export type SkillTag =
  | 'physical'
  | 'projectile'
  | 'melee'
  | 'area'
  | 'lightning'

export type SkillKind = 'projectile' | 'area' | 'chain'

export interface SkillDefinition {
  id: SkillId
  name: string
  description: string
  kind: SkillKind
  tags: readonly SkillTag[]
  cooldown: number
  baseDamage: number
  damagePerLevel: number
  radius?: number
  maxRange?: number
  maxTargets?: number
  jumpRange?: number
  projectileDefinitionId?: ProjectileDefinitionId
  effectLifetime: number
}

export const BASIC_BOLT_SKILL_ID: SkillId = 'basic-bolt'
export const WHIRLWIND_SKILL_ID: SkillId = 'whirlwind'
export const CHAIN_LIGHTNING_SKILL_ID: SkillId = 'chain-lightning'

export const SKILL_DEFINITIONS = {
  [BASIC_BOLT_SKILL_ID]: {
    id: BASIC_BOLT_SKILL_ID,
    name: 'Basic Bolt',
    description: 'Automatically fires a bolt at the nearest enemy.',
    kind: 'projectile',
    tags: ['physical', 'projectile'],
    cooldown: 1,
    baseDamage: 10,
    damagePerLevel: 2,
    projectileDefinitionId: BASIC_BOLT_DEFINITION_ID,
    effectLifetime: 0.12,
  },
  [WHIRLWIND_SKILL_ID]: {
    id: WHIRLWIND_SKILL_ID,
    name: 'Whirlwind',
    description: 'Periodically damages every enemy close to you.',
    kind: 'area',
    tags: ['physical', 'melee', 'area'],
    cooldown: 2.5,
    baseDamage: 8,
    damagePerLevel: 3,
    radius: 90,
    effectLifetime: 0.2,
  },
  [CHAIN_LIGHTNING_SKILL_ID]: {
    id: CHAIN_LIGHTNING_SKILL_ID,
    name: 'Chain Lightning',
    description: 'Strikes a nearby enemy, then jumps to two distinct targets.',
    kind: 'chain',
    tags: ['lightning', 'area'],
    cooldown: 3.5,
    baseDamage: 7,
    damagePerLevel: 2,
    maxRange: 260,
    jumpRange: 150,
    maxTargets: 3,
    effectLifetime: 0.18,
  },
} as const satisfies Record<SkillId, SkillDefinition>

export function getSkillDefinition(skillId: SkillId): SkillDefinition {
  const definition = SKILL_DEFINITIONS[skillId]
  if (!definition) {
    throw new Error(`Unknown skill definition: ${skillId}`)
  }
  return definition
}

export function isSkillId(value: string): value is SkillId {
  return value in SKILL_DEFINITIONS
}

export function getSkillDamage(
  definition: SkillDefinition,
  level: number,
): number {
  return definition.baseDamage + Math.max(0, level - 1) * definition.damagePerLevel
}
