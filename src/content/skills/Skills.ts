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
  RAISE_SKELETON_SKILL_ID,
  SKILL_DEFINITIONS,
  VITALITY_SKILL_ID,
  WHIRLWIND_SKILL_ID,
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
