import type { ItemId } from '../gear/Items'
import type { CharacterStatValues } from '../stats/Stats'
import type { SkillId } from '../skills/Skills'
import type { SkillTag } from '../skills/Skills'
import type { CharacterClassId } from '../../game-config/classes'
import {
  CHARACTER_CLASS_DEFINITIONS,
  CHARACTER_CLASS_IDS,
} from '../../game-config/classes'

export interface CharacterClassDefinition {
  readonly id: CharacterClassId
  readonly name: string
  readonly description: string
  readonly baseStats: CharacterStatValues
  readonly startingWeaponItemId: ItemId
  readonly startingSkillIds: readonly SkillId[]
  readonly skillAffinity: {
    readonly tags: readonly SkillTag[]
    readonly label: string
    readonly description: string
  }
  readonly visual: {
    readonly fillColor: number
    readonly outlineColor: number
  }
}

export { DEFAULT_CHARACTER_CLASS_ID } from '../../game-config/classes'
export { CHARACTER_CLASS_DEFINITIONS, CHARACTER_CLASS_IDS } from '../../game-config/classes'
export type { CharacterClassId } from '../../game-config/classes'

export function isCharacterClassId(value: unknown): value is CharacterClassId {
  return typeof value === 'string' && (CHARACTER_CLASS_IDS as readonly string[]).includes(value)
}

export function getCharacterClassDefinition(id: CharacterClassId): CharacterClassDefinition {
  return CHARACTER_CLASS_DEFINITIONS[id]
}
