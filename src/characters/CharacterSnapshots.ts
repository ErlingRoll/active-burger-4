/**
 * Re-exports the champion build schema and its checkpoint converter.
 *
 * Both live in `game/checkpoint/CharacterBuild.ts` because they describe
 * simulation state. This module keeps the character feature's import site
 * stable and is the only thing the Supabase-backed service needs to know about.
 */
export {
  CHARACTER_SCHEMA_VERSION,
  isCharacterBuildSnapshot,
} from '../game/checkpoint/CharacterBuild'
export { createCharacterBuildSnapshot } from '../game/checkpoint/GameCheckpoint'
export type {
  CharacterBuildSkill,
  CharacterBuildSnapshot,
} from '../game/checkpoint/CharacterBuild'
