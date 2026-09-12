import type { SkillTag } from '../skills/SkillConfigs'
import type { GearSetId } from '../../game-config/gear-sets'

/**
 * The Camp's registry shapes.
 *
 * Every row here mirrors a reference table the migrations seed, so that the
 * hub can name a building and price an upgrade before the server is asked,
 * and `tests/campRegistry.test.ts` fails the build when the two drift. The
 * server re-reads its own rows for every decision that moves an item.
 */

export type CampBuildingId =
  | 'storehouse'
  | 'woodline'
  | 'quarry'
  | 'tackle-bench'
  | 'rift-anchor'
  | 'smokehouse'
  | 'forge'
  | 'trophy-hall'

export type CampJobId = 'woodline-timber' | 'quarry-stone' | 'anchor-rest'

/**
 * What a job's units are. An item job grants its output on claim; a relief
 * job takes its units, as minutes, off the working Champion's own exhaustion.
 */
export type CampJobEffect = 'item' | 'exhaustion-relief'

export interface CampBuildingDefinition {
  id: CampBuildingId
  name: string
  description: string
  sortOrder: number
  /** The level a player starts at: one for a building that is simply there, zero for one that must be built. */
  startingLevel: number
}

/** What a level costs and what it does, keyed by building and level. */
export interface CampBuildingLevel {
  buildingId: CampBuildingId
  level: number
  /** Inventory definition id to quantity. Empty for a level every player starts at. */
  cost: Readonly<Record<string, number>>
  /** The offline accrual cap this level sets. Only the Storehouse sets one. */
  accrualCapHours: number | null
  /** Multiplies every job's base rate at this level. */
  rateMultiplier: number
  /** How many Champions the building's jobs can hold between them. */
  jobSlots: number
}

export interface CampJobDefinition {
  id: CampJobId
  buildingId: CampBuildingId
  name: string
  effect: CampJobEffect
  /** The item an item job grants; null for a relief job. */
  outputDefinitionId: string | null
  /** Units per hour for one Champion whose sheet multiplies to exactly one. */
  baseRatePerHour: number
  /** The gear set a Champion is built for when it works here. */
  fitSetId: GearSetId
  /** Skill tags that make a Champion at home in this job. */
  fitTags: readonly SkillTag[]
}
