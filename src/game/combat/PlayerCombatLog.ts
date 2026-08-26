import type { DamageType } from '../../content/stats/Damage'
import type {
  GameState,
  PlayerCombatLogEntry,
} from '../state/GameState'

export const PLAYER_COMBAT_LOG_WINDOW_SECONDS = 10

function recordPlayerCombatEntry(
  state: GameState,
  entry: PlayerCombatLogEntry,
): void {
  const entries = state.run.playerCombatLog ??= []
  entries.push(entry)
  const earliestTime = state.time - PLAYER_COMBAT_LOG_WINDOW_SECONDS
  state.run.playerCombatLog = entries.filter((candidate) => candidate.time >= earliestTime)
}

export function recordPlayerDamage(
  state: GameState,
  amount: number,
  damageType: DamageType,
  source: string,
): void {
  if (amount <= 0) {
    return
  }
  recordPlayerCombatEntry(state, {
    time: state.time,
    kind: 'damage',
    amount,
    damageType,
    source,
    resultingHp: state.player.hp,
  })
}

export function healPlayer(
  state: GameState,
  requestedAmount: number,
  source: string,
): number {
  const amount = Math.max(
    0,
    Math.min(state.player.maxHp - state.player.hp, requestedAmount),
  )
  if (amount <= 0) {
    return 0
  }
  state.player.hp += amount
  recordPlayerCombatEntry(state, {
    time: state.time,
    kind: 'healing',
    amount,
    source,
    resultingHp: state.player.hp,
  })
  return amount
}
