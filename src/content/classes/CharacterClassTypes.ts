import type { ItemId } from '../gear/Items'
import type { CharacterStatValues } from '../stats/Stats'
import type { SkillId, SkillTag } from '../skills/Skills'

/**
 * Character class schema types.
 *
 * Held apart from `CharacterClasses.ts` so `game-config/classes.ts` can be
 * typed by them without importing a module that re-exports its own data back.
 * The definition is generic over its id because `CharacterClassId` is derived
 * from the roster in `game-config/classes.ts`, which this module must not
 * depend on; both sides specialise it with the concrete union.
 */

export type CharacterClassSilhouette =
  | 'armored-knight'
  | 'ranger'
  | 'necromancer'
  | 'frost-warden'
  | 'ashen-alchemist'
  | 'war-shepherd'
  | 'riftwalker'
  | 'bloodweaver'

export interface CharacterClassDefinition<TId extends string = string> {
  readonly id: TId
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
    readonly silhouette: CharacterClassSilhouette
    readonly icon: string
    readonly fillColor: number
    readonly outlineColor: number
  }
}
