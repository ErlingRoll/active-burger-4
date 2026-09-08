import type { CharacterClassDefinition as CharacterClassDefinitionSchema } from './CharacterClassTypes'
import type { CharacterClassId } from '../../game-config/classes'
import {
  CHARACTER_CLASS_DEFINITIONS,
  CHARACTER_CLASS_IDS,
} from '../../game-config/classes'

export type { CharacterClassSilhouette } from './CharacterClassTypes'

/** The class schema specialised with the concrete roster's id union. */
export type CharacterClassDefinition = CharacterClassDefinitionSchema<CharacterClassId>

export { DEFAULT_CHARACTER_CLASS_ID } from '../../game-config/classes'
export { CHARACTER_CLASS_DEFINITIONS, CHARACTER_CLASS_IDS } from '../../game-config/classes'
export type { CharacterClassId } from '../../game-config/classes'

export function isCharacterClassId(value: unknown): value is CharacterClassId {
  return typeof value === 'string' && (CHARACTER_CLASS_IDS as readonly string[]).includes(value)
}

export function getCharacterClassDefinition(id: CharacterClassId): CharacterClassDefinition {
  return CHARACTER_CLASS_DEFINITIONS[id]
}
