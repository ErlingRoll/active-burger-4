import type { SpawnBalance } from '../spawning/SpawnBalance'
import type { StatKey } from '../stats/Stats'

export const WORLD_MODIFIER_IDS = [
  'swarming',
  'fast-start',
  'juggernauts',
  'glass-world',
  'shorter-minute',
  'elite-invasion',
] as const

export type WorldModifierId = (typeof WORLD_MODIFIER_IDS)[number]

export interface WorldModifierDefinition {
  readonly id: WorldModifierId
  readonly name: string
  readonly description: string
  readonly difficulty: number
  readonly essenceRewardMultiplier: number
}

/** Later modifiers add less reward so stacking challenges stays sustainable. */
export const WORLD_MODIFIER_REWARD_DIMINISHING_FACTOR = 0.75
export const WORLD_MODIFIER_MAX_REWARD_MULTIPLIER = 1.5

export const WORLD_MODIFIER_DEFINITIONS: Readonly<
  Record<WorldModifierId, WorldModifierDefinition>
> = {
  swarming: {
    id: 'swarming',
    name: 'Swarming',
    description: 'Start with 35% more threat and gain 20% more threat over time.',
    difficulty: 2,
    essenceRewardMultiplier: 1.1,
  },
  juggernauts: {
    id: 'juggernauts',
    name: 'Juggernauts',
    description: 'All non-boss enemies have 25% more health and 20% more contact damage, but move 10% slower.',
    difficulty: 3,
    essenceRewardMultiplier: 1.2,
  },
  'glass-world': {
    id: 'glass-world',
    name: 'Glass World',
    description: 'Maximum health is reduced by 25%; basic attacks fire 10% faster and deal 10% more damage.',
    difficulty: 3,
    essenceRewardMultiplier: 1.15,
  },
  'shorter-minute': {
    id: 'shorter-minute',
    name: 'Shorter Minute',
    description: 'Normal floors last 45 seconds instead of 60, leaving less time to build before the boss.',
    difficulty: 3,
    essenceRewardMultiplier: 1.15,
  },
  'elite-invasion': {
    id: 'elite-invasion',
    name: 'Elite Invasion',
    description: 'Elites start at 20 seconds and appear on 22% of normal spawns.',
    difficulty: 5,
    essenceRewardMultiplier: 1.2,
  },
  'fast-start': {
    id: 'fast-start',
    name: 'Fast Start',
    description: 'For the first two minutes, threat builds 40% faster.',
    difficulty: 2,
    essenceRewardMultiplier: 1.08,
  },
}

export interface WorldModifierEffects {
  readonly ids: readonly WorldModifierId[]
  readonly difficulty: number
  readonly essenceRewardMultiplier: number
  readonly playerStatMultipliers: Readonly<Partial<Record<StatKey, number>>>
  readonly ordinaryEnemyMaxHpMultiplier: number
  readonly ordinaryEnemyContactDamageMultiplier: number
  readonly ordinaryEnemySpeedMultiplier: number
  readonly floorDurationMultiplier: number
  readonly spawnBalance: SpawnBalance
  readonly fastStartThreatMultiplier: number
  readonly fastStartDurationSeconds: number
}

export function isWorldModifierId(value: unknown): value is WorldModifierId {
  return typeof value === 'string' &&
    (WORLD_MODIFIER_IDS as readonly string[]).includes(value)
}

export function normalizeWorldModifierIds(
  ids: readonly unknown[] | undefined,
): WorldModifierId[] {
  if (!ids) {
    return []
  }
  return [...new Set(ids.filter(isWorldModifierId))].sort()
}

export function getWorldModifierDefinitions(
  ids: readonly WorldModifierId[],
): readonly WorldModifierDefinition[] {
  return ids
    .map((id) => WORLD_MODIFIER_DEFINITIONS[id])
    .sort((left, right) => {
      const difficultyDelta = left.difficulty - right.difficulty
      if (difficultyDelta !== 0) {
        return difficultyDelta
      }
      return WORLD_MODIFIER_IDS.indexOf(left.id) - WORLD_MODIFIER_IDS.indexOf(right.id)
    })
}

export function calculateWorldModifierRewardMultiplier(
  ids: readonly unknown[] | undefined,
): number {
  return Math.min(
    WORLD_MODIFIER_MAX_REWARD_MULTIPLIER,
    getWorldModifierDefinitions(normalizeWorldModifierIds(ids)).reduce(
      (total, definition, index) =>
        total * (
          1 +
          (definition.essenceRewardMultiplier - 1) *
            Math.pow(WORLD_MODIFIER_REWARD_DIMINISHING_FACTOR, index)
        ),
      1,
    ),
  )
}

export function resolveWorldModifierEffects(
  ids: readonly unknown[] | undefined,
  baseBalance: SpawnBalance,
): WorldModifierEffects {
  const normalizedIds = normalizeWorldModifierIds(ids)
  const selected = new Set(normalizedIds)
  const swarming = selected.has('swarming')
  const eliteInvasion = selected.has('elite-invasion')
  const fastStart = selected.has('fast-start')
  const juggernauts = selected.has('juggernauts')
  const glassWorld = selected.has('glass-world')
  const shorterMinute = selected.has('shorter-minute')
  const definitions = getWorldModifierDefinitions(normalizedIds)

  return {
    ids: normalizedIds,
    difficulty: definitions.reduce((total, definition) => total + definition.difficulty, 0),
    essenceRewardMultiplier: calculateWorldModifierRewardMultiplier(normalizedIds),
    playerStatMultipliers: glassWorld
      ? { maxHp: 0.75, attackDamage: 1.1, attackSpeed: 1.1, movementSpeed: 1.05 }
      : {},
    ordinaryEnemyMaxHpMultiplier: juggernauts ? 1.25 : 1,
    ordinaryEnemyContactDamageMultiplier: juggernauts ? 1.2 : 1,
    ordinaryEnemySpeedMultiplier: juggernauts ? 0.9 : 1,
    floorDurationMultiplier: shorterMinute ? 0.75 : 1,
    spawnBalance: {
      ...baseBalance,
      baseThreatPerSecond: baseBalance.baseThreatPerSecond * (swarming ? 1.35 : 1),
      threatGrowthPerMinute: baseBalance.threatGrowthPerMinute * (swarming ? 1.2 : 1),
      eliteChance: eliteInvasion ? 0.22 : baseBalance.eliteChance,
      eliteStartTimeSeconds: Math.min(
        baseBalance.eliteStartTimeSeconds,
        eliteInvasion ? 20 : Number.POSITIVE_INFINITY,
        fastStart ? 30 : Number.POSITIVE_INFINITY,
      ),
      eliteModifierWeights: eliteInvasion
        ? {
            hasted: 18,
            giant: 22,
            fiery: 20,
            electrocuting: 20,
            frigid: 20,
            poisoner: 20,
            flanking: 20,
          }
        : baseBalance.eliteModifierWeights,
    },
    fastStartThreatMultiplier: fastStart ? 1.4 : 1,
    fastStartDurationSeconds: fastStart ? 120 : 0,
  }
}
