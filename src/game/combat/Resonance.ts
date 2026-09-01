import { getDerivedPlayerStats } from '../stats/DerivedStats'
import type { GameState, PlayerState } from '../state/GameState'
import { DEFAULT_RESONANCE_ATTACKS } from '../../game-config/skills'

function getResonanceRequirement(player: Readonly<PlayerState>): number {
  const value = getDerivedPlayerStats(player).resonance
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_RESONANCE_ATTACKS
}

export function isSkillResonant(state: Readonly<GameState>): boolean {
  return (state.player.resonanceAttackCount ?? 0) >=
    getResonanceRequirement(state.player)
}

export function recordBasicAttackForResonance(state: GameState): void {
  const requirement = getResonanceRequirement(state.player)
  state.player.resonanceAttackCount = Math.min(
    requirement,
    Math.max(0, state.player.resonanceAttackCount ?? 0) + 1,
  )
}

export function consumeSkillResonance(state: GameState): void {
  state.player.resonanceAttackCount = 0
}
