import type { WeaponArchetype } from '../gear/Items'
import type { PartialDamageValues } from '../stats/Damage'
import type { ProjectileDefinitionId } from '../projectiles/Projectiles'
import { BASIC_ATTACK_VARIANTS } from '../../game-config/skills'

export type SkillId =
  | 'basic-attack'
  | 'whirlwind'
  | 'chain-lightning'
  | 'vitality'

export type SkillTag =
  | 'physical'
  | 'projectile'
  | 'melee'
  | 'area'
  | 'lightning'
  | 'fire'
  | 'cold'
  | 'chaos'
  | 'defensive'

export type SkillKind = 'projectile' | 'area' | 'chain' | 'utility'

/**
 * Rendering metadata owned by skill content. The renderer uses this contract
 * to project effects without knowing individual skill IDs.
 */
export interface SkillVisualPresentation {
  kind: 'projectile' | 'area' | 'chain' | 'utility'
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
  baseHealing?: number
  healingPerLevel?: number
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

export {
  BASIC_ATTACK_SKILL_ID,
  BASIC_ATTACK_VARIANTS,
  CHAIN_LIGHTNING_SKILL_ID,
  SKILL_DEFINITIONS,
  VITALITY_SKILL_ID,
  WHIRLWIND_SKILL_ID,
} from '../../game-config/skills'

export function getBasicAttackVariant(
  weaponArchetype?: WeaponArchetype,
): BasicAttackVariantDefinition {
  return BASIC_ATTACK_VARIANTS[weaponArchetype ?? 'wand']
}
