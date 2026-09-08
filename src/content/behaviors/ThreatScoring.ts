import type { EnemyDefinitionId } from '../enemies/Enemies'

/**
 * Threat values are content data rather than a property of the movement
 * system. Pack pressure is applied by the evaluator for nearby entities.
 */
export interface ThreatScoreDefinition {
  base: number
  packBonus: number
  eliteMultiplier: number
}

export const THREAT_SCORE_DEFINITIONS: Readonly<
  Partial<Record<EnemyDefinitionId, ThreatScoreDefinition>>
> = {
  slime: { base: 1, packBonus: 0.35, eliteMultiplier: 1.5 },
  runner: { base: 1.5, packBonus: 0.3, eliteMultiplier: 1.5 },
  archer: { base: 2.5, packBonus: 0.2, eliteMultiplier: 1.5 },
  splitter: { base: 2.5, packBonus: 0.3, eliteMultiplier: 1.5 },
  brute: { base: 4, packBonus: 0.25, eliteMultiplier: 1.75 },
  flanker: { base: 2.5, packBonus: 0.25, eliteMultiplier: 1.5 },
}

export const DEFAULT_THREAT_SCORE_DEFINITION: ThreatScoreDefinition = {
  base: 1,
  packBonus: 0.25,
  eliteMultiplier: 1.5,
}

export const BOSS_THREAT_SCORE = 10

export function getThreatScoreDefinition(
  definitionId: EnemyDefinitionId,
): ThreatScoreDefinition {
  return THREAT_SCORE_DEFINITIONS[definitionId] ??
    DEFAULT_THREAT_SCORE_DEFINITION
}
