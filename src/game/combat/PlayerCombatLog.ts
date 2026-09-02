import type { DamageType } from '../../content/stats/Damage'
import type {
  GameState,
  PlayerCombatLogEntry,
  SummonState,
} from '../state/GameState'
import {
  isCriticalStrike,
  normalizeCriticalStrikeStats,
} from '../../content/stats/Damage'
import type { SkillId } from '../../content/skills/Skills'
import type { RandomSource } from '../random/Random'
import { getDerivedPlayerStats } from '../stats/DerivedStats'
import { calculateHealingAmount } from '../engine/CombatCalculations'

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

function recordSkillHealing(
  state: GameState,
  sourceSkillId: SkillId | undefined,
  amount: number,
): void {
  if (!sourceSkillId || amount <= 0) {
    return
  }
  state.run.skillHealingDone ??= {}
  state.run.skillHealingDone[sourceSkillId] =
    (state.run.skillHealingDone[sourceSkillId] ?? 0) + amount
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
  random?: Pick<RandomSource, 'next'>,
  sourceSkillId?: SkillId,
): number {
  const playerStats = getDerivedPlayerStats(state.player)
  const missingHp = Math.max(0, state.player.maxHp - state.player.hp)
  if (requestedAmount <= 0 || missingHp <= 0) {
    return 0
  }
  const criticalStrike = {
    chance: playerStats.critChance,
    multiplier: playerStats.critMultiplier,
  }
  const isCritical = random
    ? isCriticalStrike(criticalStrike, random.next())
    : false
  const amount = calculateHealingAmount({
    requestedAmount,
    increasedHealingPercent: playerStats.increasedHealing,
    missingHp,
    criticalMultiplierPercent: normalizeCriticalStrikeStats(criticalStrike).multiplier,
    isCritical,
  })
  if (amount <= 0) {
    return 0
  }
  state.player.hp += amount
  recordSkillHealing(state, sourceSkillId, amount)
  recordPlayerCombatEntry(state, {
    time: state.time,
    kind: 'healing',
    amount,
    source,
    resultingHp: state.player.hp,
  })
  return amount
}

export function healSummon(
  state: GameState,
  summon: SummonState,
  requestedAmount: number,
  random?: Pick<RandomSource, 'next'>,
  sourceSkillId?: SkillId,
): number {
  const playerStats = getDerivedPlayerStats(state.player)
  const missingHp = Math.max(0, summon.maxHp - summon.hp)
  if (requestedAmount <= 0 || missingHp <= 0 || summon.hp <= 0) {
    return 0
  }
  const criticalStrike = {
    chance: playerStats.critChance,
    multiplier: playerStats.critMultiplier,
  }
  const isCritical = random
    ? isCriticalStrike(criticalStrike, random.next())
    : false
  const amount = calculateHealingAmount({
    requestedAmount,
    increasedHealingPercent: playerStats.increasedHealing,
    missingHp,
    criticalMultiplierPercent: normalizeCriticalStrikeStats(criticalStrike).multiplier,
    isCritical,
  })
  if (amount <= 0) {
    return 0
  }
  summon.hp += amount
  recordSkillHealing(state, sourceSkillId, amount)
  return amount
}
