import type { SpawnBalance } from '../../content/spawning/SpawnBalance'
import { SPAWN_BALANCE } from '../../content/spawning/SpawnBalance'
import type { EnemyDefinitionId } from '../ids'
import type { EliteModifierId } from '../../content/enemies/EliteModifiers'
import type { RandomSource } from '../random/Random'
import type { EnemyState, GameState, PlayerState } from '../state/GameState'

export interface SpawnRequest {
  definitionId: EnemyDefinitionId
  x: number
  y: number
  eliteModifier?: EliteModifierId
}

export type SpawnDirectorState = Pick<GameState, 'time'> & {
  player: Pick<PlayerState, 'x' | 'y'>
  enemies: readonly Pick<EnemyState, 'id' | 'hp'>[]
  encounter?: Pick<NonNullable<GameState['encounter']>, 'normalSpawnsSuspended'>
}

/**
 * Converts elapsed time into threat per second using the documented linear
 * balance curve. This is exported so balance tests and future tools can use
 * the same curve as the live director.
 */
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

/**
 * Schedules normal enemy spawns from run time and a threat budget. It owns no
 * runtime entities: the game turns returned requests into state entities.
 */
export class SpawnDirector {
  private readonly random: RandomSource
  private readonly balance: SpawnBalance
  private readonly fastStartThreatMultiplier: number
  private readonly fastStartDurationSeconds: number
  private threatBudget = 0
  private pendingEntry:
    | SpawnBalance['spawnEntries'][number]
    | undefined
  private readonly introducedEntries = new Set<
    SpawnBalance['spawnEntries'][number]
  >()

  constructor(
    random: RandomSource,
    balance: SpawnBalance = SPAWN_BALANCE,
    fastStartThreatMultiplier = 1,
    fastStartDurationSeconds = 0,
  ) {
    this.random = random
    this.balance = balance
    this.fastStartThreatMultiplier = fastStartThreatMultiplier
    this.fastStartDurationSeconds = fastStartDurationSeconds
  }

  get maxActiveEnemies(): number {
    return this.balance.maxActiveEnemies
  }

  /**
   * Adds this tick's threat budget and spends it on requests until the active
   * enemy cap or available budget is reached. A budget of less than one enemy
   * is retained, so spawn timing remains deterministic across frame deltas.
   */
  update(
    state: SpawnDirectorState,
    deltaSeconds: number,
  ): SpawnRequest[] {
    if (state.encounter?.normalSpawnsSuspended) {
      return []
    }
    const delta = Math.max(0, deltaSeconds)
    const fastStartActive = state.time < this.fastStartDurationSeconds
    this.threatBudget +=
      calculateThreatPerSecond(state.time, this.balance) *
      (fastStartActive ? this.fastStartThreatMultiplier : 1) *
      delta

    const requests: SpawnRequest[] = []
    let activeEnemyCount = 0
    for (const enemy of state.enemies) {
      if (enemy.hp > 0) {
        activeEnemyCount += 1
      }
    }
    const availableSlots = Math.max(
      0,
      this.balance.maxActiveEnemies - activeEnemyCount,
    )

    while (requests.length < availableSlots) {
      if (this.threatBudget < this.minimumThreatCost(state.time)) {
        break
      }
      this.pendingEntry ??= this.selectSpawnEntry(state.time)
      const entry = this.pendingEntry
      if (!entry) {
        break
      }
      if (this.threatBudget < entry.threatCost) {
        break
      }

      this.threatBudget -= entry.threatCost
      this.introducedEntries.add(entry)
      this.pendingEntry = undefined
      const angle = this.random.next() * Math.PI * 2
      const radius =
        this.balance.spawnRingInnerRadius +
        this.random.next() *
          (this.balance.spawnRingOuterRadius -
            this.balance.spawnRingInnerRadius)

      const eliteModifier = this.selectEliteModifier(state.time)
      requests.push({
        definitionId: entry.definitionId,
        x: state.player.x + Math.cos(angle) * radius,
        y: state.player.y + Math.sin(angle) * radius,
        ...(eliteModifier ? { eliteModifier } : {}),
      })
    }

    // Do not bank an unbounded backlog while the cap is full. Once an enemy
    // dies, at most one normal spawn's worth of pressure is waiting.
    if (availableSlots === 0) {
      this.threatBudget = Math.min(
        this.threatBudget,
        this.minimumThreatCost(state.time),
      )
    }

    return requests
  }

  private selectEliteModifier(
    timeSeconds: number,
  ): EliteModifierId | undefined {
    if (
      timeSeconds < this.balance.eliteStartTimeSeconds ||
      !this.random.chance(this.balance.eliteChance)
    ) {
      return undefined
    }

    const weightedModifiers = Object.entries(
      this.balance.eliteModifierWeights,
    ).filter(([, weight]) => weight > 0) as [EliteModifierId, number][]
    const totalWeight = weightedModifiers.reduce(
      (sum, [, weight]) => sum + weight,
      0,
    )
    if (totalWeight <= 0) {
      return undefined
    }

    let selection = this.random.next() * totalWeight
    for (const [modifierId, weight] of weightedModifiers) {
      selection -= weight
      if (selection < 0) {
        return modifierId
      }
    }
    return weightedModifiers[weightedModifiers.length - 1]?.[0]
  }

  private selectSpawnEntry(timeSeconds: number) {
    const entries = this.balance.spawnEntries.filter(
      (entry) =>
        (entry.startTimeSeconds ?? 0) <= Math.max(0, timeSeconds),
    )
    if (entries.length === 0) {
      return undefined
    }

    // Ensure every newly unlocked entry is shown once before returning to the
    // authored weighted mix. This keeps deterministic runs representative
    // without removing weighting from the long-term composition.
    const unintroducedEntries = entries.filter(
      (entry) => !this.introducedEntries.has(entry),
    )
    const candidates =
      unintroducedEntries.length > 0 ? unintroducedEntries : entries
    const totalWeight = candidates.reduce(
      (sum, entry) => sum + Math.max(0, entry.weight),
      0,
    )
    if (totalWeight <= 0) {
      return undefined
    }

    let selection = this.random.next() * totalWeight
    for (const entry of candidates) {
      selection -= Math.max(0, entry.weight)
      if (selection < 0) {
        return entry
      }
    }

    return candidates[candidates.length - 1]
  }

  private minimumThreatCost(timeSeconds: number): number {
    const entries = this.balance.spawnEntries.filter(
      (entry) =>
        (entry.startTimeSeconds ?? 0) <= Math.max(0, timeSeconds),
    )
    return entries.reduce(
      (minimum, entry) => Math.min(minimum, entry.threatCost),
      Number.POSITIVE_INFINITY,
    )
  }
}
