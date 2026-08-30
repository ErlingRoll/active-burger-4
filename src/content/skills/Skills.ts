import {
  SKILL_DEFINITIONS,
  type SkillDefinition,
  type SkillId,
} from './SkillConfigs'
import {
  addDamageValues,
  createDamageValues,
  scaleDamageValues,
  type DamageValues,
} from '../stats/Damage'

export {
  BASIC_ATTACK_SKILL_ID,
  BASIC_ATTACK_VARIANTS,
  CHAIN_LIGHTNING_SKILL_ID,
  FIERY_TOUCH_SKILL_ID,
  RAISE_SKELETON_SKILL_ID,
  SKILL_DEFINITIONS,
  VITALITY_SKILL_ID,
  WHIRLWIND_SKILL_ID,
  GLACIAL_ORB_SKILL_ID,
  LANCERS_CHARGE_SKILL_ID,
  RALLYING_STANDARD_SKILL_ID,
  GRAVITY_WELL_SKILL_ID,
  AEGIS_PULSE_SKILL_ID,
  RIFT_JAVELIN_SKILL_ID,
  CINDER_MINE_SKILL_ID,
  STORM_RELAY_SKILL_ID,
  SOUL_TETHER_SKILL_ID,
  PHANTOM_ARSENAL_SKILL_ID,
  getBasicAttackVariant,
} from './SkillConfigs'
export type {
  BasicAttackVariantDefinition,
  SkillDefinition,
  SkillId,
  SkillKind,
  SkillTag,
  SkillVisualPresentation,
} from './SkillConfigs'

export function getEffectiveSkillCooldown(
  baseCooldown: number,
  cooldownReduction: number,
): number {
  return Math.max(
    0.1,
    baseCooldown * (1 - Math.max(0, cooldownReduction) / 100),
  )
}

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
): DamageValues {
  return addDamageValues(
    definition.baseDamage,
    scaleDamageValues(
      createDamageValues(definition.damagePerLevel),
      Math.max(0, level - 1),
    ),
  )
}

export function getSkillHealing(
  definition: SkillDefinition,
  level: number,
): number {
  return Math.max(
    0,
    (definition.baseHealing ?? 0) +
      (definition.healingPerLevel ?? 0) * Math.max(0, level - 1),
  )
}

export function getSkillShieldAmount(
  definition: SkillDefinition,
  level: number,
): number {
  return Math.max(
    0,
    (definition.shieldBaseAmount ?? 0) +
      (definition.shieldAmountPerLevel ?? 0) * Math.max(0, level - 1),
  )
}
