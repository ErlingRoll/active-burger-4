import type { ItemId } from '../gear/Items'
import type { StatValues } from '../stats/Stats'
import type { SkillId } from '../skills/Skills'
import type { PlaystyleId } from '../../game-config/classes'
import {
  PLAYSTYLE_DEFINITIONS,
  PLAYSTYLE_IDS,
} from '../../game-config/classes'

export interface PlaystyleDefinition {
  readonly id: PlaystyleId
  readonly name: string
  readonly description: string
  readonly baseStats: StatValues
  readonly startingWeaponItemId: ItemId
  readonly startingSkillIds: readonly SkillId[]
  readonly visual: {
    readonly fillColor: number
    readonly outlineColor: number
  }
}

export { DEFAULT_PLAYSTYLE_ID } from '../../game-config/classes'
export { PLAYSTYLE_DEFINITIONS, PLAYSTYLE_IDS } from '../../game-config/classes'
export type { PlaystyleId } from '../../game-config/classes'

export function isPlaystyleId(value: unknown): value is PlaystyleId {
  return typeof value === 'string' && (PLAYSTYLE_IDS as readonly string[]).includes(value)
}

export function getPlaystyleDefinition(id: PlaystyleId): PlaystyleDefinition {
  return PLAYSTYLE_DEFINITIONS[id]
}
