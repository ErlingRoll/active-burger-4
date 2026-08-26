import type { SpawnBalance } from '../../content/spawning/SpawnBalance'
import { SPAWN_BALANCE } from '../../content/spawning/SpawnBalance'
import type { EnemyDefinitionId } from '../ids'
import type { RandomSource } from '../random/Random'
import type { EnemyState, GameState, PlayerState } from '../state/GameState'

export interface SpawnRequest {
  definitionId: EnemyDefinitionId
  x: number
  y: number
}

export type SpawnDirectorState = Pick<GameState, 'time'> & {
  player: Pick<PlayerState, 'x' | 'y'>
  enemies: readonly Pick<EnemyState, 'id' | 'hp'>[]
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
  private threatBudget = 0

  constructor(random: RandomSource, balance: SpawnBalance = SPAWN_BALANCE) {
    this.random = random
    this.balance = balance
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
    const delta = Math.max(0, deltaSeconds)
    this.threatBudget +=
      calculateThreatPerSecond(state.time, this.balance) * delta

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

      const entry = this.selectSpawnEntry(this.threatBudget, state.time)
      if (!entry) {
        break
      }

      this.threatBudget -= entry.threatCost
      const angle = this.random.next() * Math.PI * 2
      const radius =
        this.balance.spawnRingInnerRadius +
        this.random.next() *
          (this.balance.spawnRingOuterRadius -
            this.balance.spawnRingInnerRadius)

      requests.push({
        definitionId: entry.definitionId,
        x: state.player.x + Math.cos(angle) * radius,
        y: state.player.y + Math.sin(angle) * radius,
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

  private selectSpawnEntry(maxThreatCost: number, timeSeconds: number) {
    const entries = this.balance.spawnEntries.filter(
      (entry) =>
        (entry.startTimeSeconds ?? 0) <= Math.max(0, timeSeconds),
    )
    if (entries.length === 0) {
      return undefined
    }

    const totalWeight = entries.reduce(
      (sum, entry) =>
        entry.threatCost <= maxThreatCost
          ? sum + Math.max(0, entry.weight)
          : sum,
      0,
    )
    if (totalWeight <= 0) {
      return undefined
    }

    let selection = this.random.next() * totalWeight
    for (const entry of entries) {
      if (entry.threatCost > maxThreatCost) {
        continue
      }

      selection -= Math.max(0, entry.weight)
      if (selection < 0) {
        return entry
      }
    }

    return entries.find((entry) => entry.threatCost <= maxThreatCost)
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
