import type { SpawnBalance } from '../spawning/SpawnBalance'
import type { StatKey } from '../stats/Stats'

export const WORLD_MODIFIER_IDS = [
  'swarming',
  'juggernauts',
  'glass-world',
  'elite-invasion',
  'fast-start',
] as const

export type WorldModifierId = (typeof WORLD_MODIFIER_IDS)[number]

export interface WorldModifierDefinition {
  readonly id: WorldModifierId
  readonly name: string
  readonly description: string
  readonly difficulty: number
  readonly essenceRewardMultiplier: number
}

export const WORLD_MODIFIER_DEFINITIONS: Readonly<
  Record<WorldModifierId, WorldModifierDefinition>
> = {
  swarming: {
    id: 'swarming',
    name: 'Swarming',
    description: 'Enemy pressure is increased.',
    difficulty: 2,
    essenceRewardMultiplier: 1.1,
  },
  juggernauts: {
    id: 'juggernauts',
    name: 'Juggernauts',
    description: 'Ordinary enemies are tougher and more damaging, but slower.',
    difficulty: 3,
    essenceRewardMultiplier: 1.2,
  },
  'glass-world': {
    id: 'glass-world',
    name: 'Glass World',
    description: 'Start with less health but stronger, faster attacks.',
    difficulty: 4,
    essenceRewardMultiplier: 1.15,
  },
  'elite-invasion': {
    id: 'elite-invasion',
    name: 'Elite Invasion',
    description: 'Elites appear earlier and far more often.',
    difficulty: 5,
    essenceRewardMultiplier: 1.25,
  },
  'fast-start': {
    id: 'fast-start',
    name: 'Fast Start',
    description: 'The first two minutes build threat much faster.',
    difficulty: 2,
    essenceRewardMultiplier: 1.1,
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
  return ids.map((id) => WORLD_MODIFIER_DEFINITIONS[id])
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
  const definitions = getWorldModifierDefinitions(normalizedIds)

  return {
    ids: normalizedIds,
    difficulty: definitions.reduce((total, definition) => total + definition.difficulty, 0),
    essenceRewardMultiplier: definitions.reduce(
      (total, definition) => total * definition.essenceRewardMultiplier,
      1,
    ),
    playerStatMultipliers: glassWorld
      ? { maxHp: 0.65, attackDamage: 1.1, movementSpeed: 1.05 }
      : {},
    ordinaryEnemyMaxHpMultiplier: juggernauts ? 1.25 : 1,
    ordinaryEnemyContactDamageMultiplier: juggernauts ? 1.2 : 1,
    ordinaryEnemySpeedMultiplier: juggernauts ? 0.9 : 1,
    spawnBalance: {
      ...baseBalance,
      baseThreatPerSecond: baseBalance.baseThreatPerSecond * (swarming ? 1.35 : 1),
      threatGrowthPerMinute: baseBalance.threatGrowthPerMinute * (swarming ? 1.2 : 1),
      eliteChance: eliteInvasion ? 0.25 : baseBalance.eliteChance,
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
