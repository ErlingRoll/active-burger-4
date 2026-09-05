import {
  calculateThreatPerSecond,
  SPAWN_BALANCE,
  type SpawnBalance,
} from '../../content/spawning/SpawnBalance'
import {
  getFloorDifficultyProfile,
} from '../../content/dungeons/Dungeons'
import type { EnemyDefinitionId } from '../ids'
import {
  isEliteModifierCombinationAllowed,
  isEliteModifierAllowedForEnemy,
  type EliteModifierId,
} from '../../content/enemies/EliteModifiers'
import type { RandomSource } from '../random/Random'
import type { EnemyState, GameState, PlayerState } from '../state/GameState'

export interface SpawnRequest {
  definitionId: EnemyDefinitionId
  x: number
  y: number
  eliteModifier?: EliteModifierId
  eliteModifiers?: readonly EliteModifierId[]
}

export const ACTIVE_ENEMY_CAP = 220
export const REINFORCEMENT_INTERVAL_SECONDS = 0.125

export type SpawnDirectorState = Pick<GameState, 'time'> & {
  player: Pick<PlayerState, 'x' | 'y'>
  enemies: readonly Pick<EnemyState, 'id' | 'hp'>[]
  run?: Pick<GameState['run'], 'floor'>
  encounter?: Pick<NonNullable<GameState['encounter']>, 'normalSpawnsSuspended'>
}

export { calculateThreatPerSecond } from '../../content/spawning/SpawnBalance'

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
  private reinforcementMode = false
  private reinforcementCooldownRemaining = 0
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

  /** Checkpoint serialization: returns indices into balance.spawnEntries. */
  getSerializableState(): {
    threatBudget: number
    pendingEntryIndex: number | null
    introducedEntryIndices: number[]
    reinforcementMode: boolean
    reinforcementCooldownRemaining: number
  } {
    return {
      threatBudget: this.threatBudget,
      pendingEntryIndex: this.pendingEntry
        ? this.balance.spawnEntries.indexOf(this.pendingEntry)
        : null,
      introducedEntryIndices: [...this.introducedEntries].map(
        (entry) => this.balance.spawnEntries.indexOf(entry),
      ),
      reinforcementMode: this.reinforcementMode,
      reinforcementCooldownRemaining: this.reinforcementCooldownRemaining,
    }
  }

  /** Checkpoint restore: accepts indices produced by getSerializableState(). */
  restoreSerializableState(snapshot: {
    threatBudget: number
    pendingEntryIndex: number | null
    introducedEntryIndices: number[]
    reinforcementMode?: boolean
    reinforcementCooldownRemaining?: number
  }): void {
    this.threatBudget = snapshot.threatBudget
    this.pendingEntry =
      snapshot.pendingEntryIndex !== null
        ? this.balance.spawnEntries[snapshot.pendingEntryIndex]
        : undefined
    this.introducedEntries.clear()
    for (const index of snapshot.introducedEntryIndices) {
      const entry = this.balance.spawnEntries[index]
      if (entry) {
        this.introducedEntries.add(entry)
      }
    }
    this.reinforcementMode = snapshot.reinforcementMode ?? false
    this.reinforcementCooldownRemaining =
      snapshot.reinforcementCooldownRemaining ?? 0
  }

  /**
   * Adds this tick's threat budget and spends it on requests until the budget
   * is exhausted. A budget of less than one enemy is retained, so spawn timing
   * remains deterministic across frame deltas.
   */
  update(
    state: SpawnDirectorState,
    deltaSeconds: number,
  ): SpawnRequest[] {
    if (state.encounter?.normalSpawnsSuspended) {
      return []
    }
    const delta = Math.max(0, deltaSeconds)
    if (state.enemies.length >= ACTIVE_ENEMY_CAP) {
      this.reinforcementMode = true
    }
    const availableSlots = Math.max(0, ACTIVE_ENEMY_CAP - state.enemies.length)
    const isReinforcementUpdate = this.reinforcementMode
    if (isReinforcementUpdate) {
      this.reinforcementCooldownRemaining = Math.max(
        0,
        this.reinforcementCooldownRemaining - delta,
      )
    }
    const fastStartActive = state.time < this.fastStartDurationSeconds
    const floorDifficulty = getFloorDifficultyProfile(state.run?.floor ?? 1)
    this.threatBudget +=
      calculateThreatPerSecond(state.time, this.balance) *
      floorDifficulty.spawnThreatMultiplier *
      (fastStartActive ? this.fastStartThreatMultiplier : 1) *
      delta

    const requests: SpawnRequest[] = []
    while (requests.length < availableSlots) {
      if (
        isReinforcementUpdate &&
        this.reinforcementCooldownRemaining > 0
      ) {
        break
      }
      if (this.threatBudget < this.minimumThreatCost(state.time)) {
        break
      }
      this.pendingEntry ??= this.selectSpawnEntry(
        state.time,
        floorDifficulty.compositionProgress,
      )
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

      const eliteModifiers = this.selectEliteModifiers(
        state.time,
        state.run?.floor ?? 1,
        entry.definitionId,
      )
      requests.push({
        definitionId: entry.definitionId,
        x: state.player.x + Math.cos(angle) * radius,
        y: state.player.y + Math.sin(angle) * radius,
        ...(eliteModifiers.length > 0
          ? {
              eliteModifier: eliteModifiers[0],
              eliteModifiers,
            }
          : {}),
      })
      if (isReinforcementUpdate) {
          this.reinforcementCooldownRemaining = REINFORCEMENT_INTERVAL_SECONDS
      }
    }

    return requests
  }

  private selectEliteModifiers(
    timeSeconds: number,
    floorNumber: number,
    enemyDefinitionId: EnemyDefinitionId,
  ): EliteModifierId[] {
    const floorDifficulty = getFloorDifficultyProfile(floorNumber)
    if (
      timeSeconds < this.balance.eliteStartTimeSeconds ||
      !this.random.chance(
        Math.min(
          1,
          this.balance.eliteChance * floorDifficulty.eliteChanceMultiplier,
        ),
      )
    ) {
      return []
    }

    const weightedModifiers = Object.entries(
      this.balance.eliteModifierWeights,
    ).filter(
      ([modifierId, weight]) =>
        weight > 0 &&
        isEliteModifierAllowedForEnemy(
          enemyDefinitionId,
          modifierId as EliteModifierId,
        ),
    ) as [EliteModifierId, number][]
    const totalWeight = weightedModifiers.reduce(
      (sum, [, weight]) => sum + weight,
      0,
    )
    if (totalWeight <= 0) {
      return []
    }

    const selectedModifiers: EliteModifierId[] = []
    const availableModifiers = [...weightedModifiers]
    const maxModifiers = Math.min(
      Math.max(
        floorDifficulty.maxEliteModifierCount,
        this.balance.minimumEliteModifierCount,
      ),
      availableModifiers.length,
    )
    const minimumModifiers = Math.min(
      Math.max(1, this.balance.minimumEliteModifierCount),
      maxModifiers,
    )
    const modifierCount = this.random.int(minimumModifiers, maxModifiers)
    while (selectedModifiers.length < modifierCount) {
      const eligibleModifiers = availableModifiers.filter(([modifierId]) =>
        isEliteModifierCombinationAllowed(selectedModifiers, modifierId),
      )
      if (eligibleModifiers.length === 0) {
        break
      }
      const availableWeight = eligibleModifiers.reduce(
        (sum, [, weight]) => sum + weight,
        0,
      )
      let selection = this.random.next() * availableWeight
      let selected = false
      for (const [modifierId, weight] of eligibleModifiers) {
        selection -= weight
        if (selection < 0) {
          selectedModifiers.push(modifierId)
          availableModifiers.splice(
            availableModifiers.findIndex(([id]) => id === modifierId),
            1,
          )
          selected = true
          break
        }
      }
      if (!selected) {
        const fallback = eligibleModifiers[eligibleModifiers.length - 1]
        if (fallback) {
          selectedModifiers.push(fallback[0])
          availableModifiers.splice(
            availableModifiers.findIndex(([id]) => id === fallback[0]),
            1,
          )
        }
      }
    }
    return selectedModifiers
  }

  private selectSpawnEntry(
    timeSeconds: number,
    compositionProgress: number,
  ) {
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
      (sum, entry) => sum + this.getSpawnEntryWeight(entry, compositionProgress),
      0,
    )
    if (totalWeight <= 0) {
      return undefined
    }

    let selection = this.random.next() * totalWeight
    for (const entry of candidates) {
      selection -= this.getSpawnEntryWeight(entry, compositionProgress)
      if (selection < 0) {
        return entry
      }
    }

    return candidates[candidates.length - 1]
  }

  private getSpawnEntryWeight(
    entry: SpawnBalance['spawnEntries'][number],
    compositionProgress: number,
  ): number {
    const advancedEnemy =
      entry.definitionId === 'archer' ||
      entry.definitionId === 'brute' ||
      entry.definitionId === 'splitter' ||
      entry.definitionId === 'flanker'
    const compositionMultiplier = advancedEnemy
      ? 1 + Math.max(0, Math.min(1, compositionProgress))
      : 1
    return Math.max(0, entry.weight) * compositionMultiplier
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
