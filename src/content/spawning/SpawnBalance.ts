import {
  ARCHER_DEFINITION_ID,
  BRUTE_DEFINITION_ID,
  RUNNER_DEFINITION_ID,
  SLIME_DEFINITION_ID,
  SPLITTER_DEFINITION_ID,
  type EnemyDefinitionId,
} from '../enemies/Enemies'

export interface SpawnEntry {
  definitionId: EnemyDefinitionId
  threatCost: number
  weight: number
  /** Optional time gate for introducing a composition entry. */
  startTimeSeconds?: number
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
 * Composition is intentionally data-driven. Entries are introduced over time
 * while the director keeps the same seeded selection and ring-placement order.
 */
export const SPAWN_BALANCE = {
  baseThreatPerSecond: 1,
  threatGrowthPerMinute: 0.5,
  maxActiveEnemies: 30,
  spawnEntries: [
    {
      definitionId: SLIME_DEFINITION_ID,
      threatCost: 1,
      weight: 8,
    },
    {
      definitionId: RUNNER_DEFINITION_ID,
      threatCost: 2,
      weight: 3,
    },
    {
      definitionId: ARCHER_DEFINITION_ID,
      threatCost: 3,
      weight: 2,
      startTimeSeconds: 30,
    },
    {
      definitionId: BRUTE_DEFINITION_ID,
      threatCost: 4,
      weight: 1,
      startTimeSeconds: 60,
    },
    {
      definitionId: SPLITTER_DEFINITION_ID,
      threatCost: 5,
      weight: 1,
      startTimeSeconds: 90,
    },
  ],
  // The inner radius is outside the close-combat area and the default browser
  // arena's central view, while the outer radius keeps the ring bounded.
  spawnRingInnerRadius: 500,
  spawnRingOuterRadius: 650,
} as const satisfies SpawnBalance
