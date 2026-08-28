import {
  ARCHER_DEFINITION_ID,
  BRUTE_DEFINITION_ID,
  RUNNER_DEFINITION_ID,
  SLIME_DEFINITION_ID,
  SPLITTER_DEFINITION_ID,
} from '../enemies/EnemyConfig'
import type { EnemyDefinitionId } from '../enemies/Enemies'
import type { EliteModifierId } from '../enemies/EliteModifiers'

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
   spawnEntries: readonly SpawnEntry[]
  spawnRingInnerRadius: number
  spawnRingOuterRadius: number
  /**
   * Elites begin after 45 seconds so the first composition is readable. Once
   * enabled, 10% of normal director spawns receive one weighted modifier.
   * Splitter children bypass this roll and remain ordinary children.
   */
  eliteChance: number
  eliteStartTimeSeconds: number
  eliteModifierWeights: Readonly<Record<EliteModifierId, number>>
}

/**
 * Composition is intentionally data-driven. Entries are introduced over time
 * while the director keeps the same seeded selection and ring-placement order.
 */
export const SPAWN_BALANCE = {
  baseThreatPerSecond: 1,
  threatGrowthPerMinute: 0.5,
  spawnEntries: [
    {
      definitionId: SLIME_DEFINITION_ID,
      threatCost: 1,
      weight: 8,
    },
    {
      definitionId: RUNNER_DEFINITION_ID,
      threatCost: 2,
      weight: 4,
      startTimeSeconds: 10,
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
  eliteChance: 0.1,
  eliteStartTimeSeconds: 45,
  eliteModifierWeights: {
    hasted: 2,
    giant: 1,
    fiery: 1,
    electrocuting: 1,
    frigid: 1,
  },
} as const satisfies SpawnBalance

export function calculateThreatPerSecond(
  timeSeconds: number,
  balance: SpawnBalance = SPAWN_BALANCE,
): number {
  const elapsedMinutes = Math.max(0, timeSeconds) / 60
  return (
    balance.baseThreatPerSecond +
    balance.threatGrowthPerMinute * elapsedMinutes
  )
}
