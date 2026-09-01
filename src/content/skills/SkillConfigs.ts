import type { WeaponArchetype } from '../gear/Items'
import type { PartialDamageValues } from '../stats/Damage'
import type { ProjectileDefinitionId } from '../projectiles/Projectiles'
import { BASIC_ATTACK_VARIANTS } from '../../game-config/skills'

export type SkillId =
  | 'basic-attack'
  | 'whirlwind'
  | 'chain-lightning'
  | 'vitality'
  | 'raise-skeleton'
  | 'fiery-touch'
  | 'glacial-orb'
  | 'lancers-charge'
  | 'rallying-banner'
  | 'gravity-well'
  | 'aegis-pulse'
  | 'rift-javelin'
  | 'cinder-mine'
  | 'storm-relay'
  | 'soul-tether'
  | 'phantom-arsenal'
  | 'sigil-of-ruin'
  | 'mirrorcast'
  | 'razorwire'
  | 'blood-rite'
  | 'prism-halo'

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
  | 'summon'
  | 'dot'
  | 'trigger'
  | 'duration'

export type SkillKind = 'projectile' | 'area' | 'chain' | 'utility'

export interface SkillResonanceEffect {
  id: string
  name: string
  description: string
}

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
  /** Whether this skill or its owned summons can produce direct-hit effects. */
  canProduceDirectHit: boolean
  cooldown: number
  baseDamage: PartialDamageValues
  baseHealing?: number
  healingPerLevel?: number
  /** Base absorb-shield amount granted on cast (e.g. Aegis Pulse). */
  shieldBaseAmount?: number
  shieldAmountPerLevel?: number
  summonBaseDamage?: number
  summonDamageIncreasePercentPerLevel?: number
  summonBaseMaxHp?: number
  summonMaxHpPerLevel?: number
  summonAttackCooldown?: number
  summonAttackRange?: number
  summonBaseMaxCount?: number
  radius?: number
  maxRange?: number
  maxTargets?: number
  jumpRange?: number
  projectileDefinitionId?: ProjectileDefinitionId
  /** Angle between adjacent projectiles when this skill fires a volley. */
  spreadDegrees?: number
  effectLifetime: number
  visual: SkillVisualPresentation
  /** The one additional effect produced when this skill consumes Resonance. */
  resonanceEffect?: SkillResonanceEffect
}

export interface BasicAttackVariantDefinition {
  id: WeaponArchetype
  description: string
  kind: 'projectile' | 'area'
  attackRange: number
  tags: readonly SkillTag[]
  projectileDefinitionId?: ProjectileDefinitionId
  swingArcDegrees?: number
  spreadDegrees?: number
  maxExtraProjectiles?: number
  /** Increased projectile damage against the target selected for this volley. */
  primaryTargetDamageIncreasePercent?: number
  areaShape?: 'arc' | 'circle'
  areaRadius?: number
  poisonApplication?: {
    durationSeconds: number
    physicalChaosRatio: number
  }
  effectLifetime: number
  visual: SkillVisualPresentation
}

export {
  BASIC_ATTACK_SKILL_ID,
  BASIC_ATTACK_VARIANTS,
  CHAIN_LIGHTNING_SKILL_ID,
  FIERY_TOUCH_SKILL_ID,
  SKILL_DEFINITIONS,
  VITALITY_SKILL_ID,
  RAISE_SKELETON_SKILL_ID,
  WHIRLWIND_SKILL_ID,
  GLACIAL_ORB_SKILL_ID,
  LANCERS_CHARGE_SKILL_ID,
  RALLYING_BANNER_SKILL_ID,
  GRAVITY_WELL_SKILL_ID,
  AEGIS_PULSE_SKILL_ID,
  RIFT_JAVELIN_SKILL_ID,
  CINDER_MINE_SKILL_ID,
  STORM_RELAY_SKILL_ID,
  SOUL_TETHER_SKILL_ID,
  PHANTOM_ARSENAL_SKILL_ID,
  SIGIL_OF_RUIN_SKILL_ID,
  MIRRORCAST_SKILL_ID,
  RAZORWIRE_SKILL_ID,
  BLOOD_RITE_SKILL_ID,
  PRISM_HALO_SKILL_ID,
} from '../../game-config/skills'

export function getBasicAttackVariant(
  weaponArchetype?: WeaponArchetype,
): BasicAttackVariantDefinition {
  return BASIC_ATTACK_VARIANTS[weaponArchetype ?? 'wand']
}
