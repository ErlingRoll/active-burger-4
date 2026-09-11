import {
  isCharacterClassId,
  type CharacterClassId,
} from '../../content/classes/CharacterClasses'
import {
  isBehaviorProfileId,
  type BehaviorProfileId,
} from '../../content/behaviors/BehaviorProfiles'
import {
  isTargetPriorityId,
  type TargetPriorityId,
} from '../../content/behaviors/TargetPriorities'
import { isSkillId, type SkillId } from '../../content/skills/Skills'
import type { UpgradeId } from '../../content/upgrades/UpgradeTypes'
import type { EquipmentLoadout } from '../equipment/EquipmentTypes'

/**
 * The immutable build a champion carries into a run.
 *
 * This shape is simulation input: `GameState` holds one, `GameCheckpoint`
 * validates one, and the Supabase-backed character service stores one. It
 * therefore lives inside `game/` and is re-exported by `characters/`, rather
 * than the other way round, so the simulation never depends upward on a
 * feature module.
 */

export const CHARACTER_SCHEMA_VERSION = 1 as const

export interface CharacterBuildSkill {
  skillId: SkillId
  level: number
}

export interface CharacterBuildSnapshot {
  schemaVersion: typeof CHARACTER_SCHEMA_VERSION
  /** Character level at the time this build was captured. Older snapshots may omit it. */
  level?: number
  classId: CharacterClassId
  skills: readonly CharacterBuildSkill[]
  selectedUpgradeIds: readonly UpgradeId[]
  equipment: EquipmentLoadout
  behaviorProfileId: BehaviorProfileId
  /** Omitted by builds saved before target priorities existed. */
  targetPriorityId?: TargetPriorityId
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Shared with GameCheckpoint's converter, which validates the same fields. */
export function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1
}

/** Validates an untrusted build, e.g. one restored from storage or the server. */
export function isCharacterBuildSnapshot(
  value: unknown,
): value is CharacterBuildSnapshot {
  if (!isRecord(value) ||
    value.schemaVersion !== CHARACTER_SCHEMA_VERSION ||
    !isCharacterClassId(value.classId) ||
    (value.level !== undefined && !isPositiveInteger(value.level)) ||
    !Array.isArray(value.skills) ||
    !Array.isArray(value.selectedUpgradeIds) ||
    !isRecord(value.equipment) ||
    !isBehaviorProfileId(value.behaviorProfileId) ||
    /*
     * Absent is fine and present-but-unknown is not, the same terms as the
     * level above. A hard requirement here would reject every Champion saved
     * before priorities existed.
     */
    (value.targetPriorityId !== undefined && !isTargetPriorityId(value.targetPriorityId))) {
    return false
  }
  const seenSkills = new Set<string>()
  const validSkills = value.skills.every((skill): skill is CharacterBuildSkill => {
    if (!isRecord(skill) ||
      typeof skill.skillId !== 'string' ||
      !isSkillId(skill.skillId) ||
      !isPositiveInteger(skill.level) ||
      seenSkills.has(skill.skillId)) {
      return false
    }
    seenSkills.add(skill.skillId)
    return true
  })
  return validSkills &&
    value.selectedUpgradeIds.every((upgradeId) => typeof upgradeId === 'string')
}
