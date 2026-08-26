import {
  SLIME_DEFINITION_ID,
  type EnemyDefinitionId,
} from '../enemies/Enemies'

export interface SpawnEntry {
  definitionId: EnemyDefinitionId
  threatCost: number
  weight: number
}

export interface SpawnBalance {
  /**
   * Threat starts at the base rate and grows linearly with elapsed minutes:
   * `baseThreatPerSecond + threatGrowthPerMinute * minutes`.
   */
  baseThreatPerSecond: number
  threatGrowthPerMinute: number
  maxActiveEnemies: number
  spawnEntries: readonly SpawnEntry[]
  spawnRingInnerRadius: number
  spawnRingOuterRadius: number
}

/**
 * The first endless-combat slice deliberately has one enemy entry. Keeping
 * the entry and all pacing/ring values here lets later content expand the
 * director without putting balance constants in the simulation engine.
 */
export const SPAWN_BALANCE = {
  baseThreatPerSecond: 1,
  threatGrowthPerMinute: 0.5,
  maxActiveEnemies: 30,
  spawnEntries: [
    {
      definitionId: SLIME_DEFINITION_ID,
      threatCost: 1,
      weight: 1,
    },
  ],
  // The inner radius is outside the close-combat area and the default browser
  // arena's central view, while the outer radius keeps the ring bounded.
  spawnRingInnerRadius: 500,
  spawnRingOuterRadius: 650,
} as const satisfies SpawnBalance
