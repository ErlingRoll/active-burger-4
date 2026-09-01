import { getDerivedPlayerStats } from '../stats/DerivedStats'
import {
  BASIC_ATTACK_SKILL_ID,
  type SkillId,
} from '../../content/skills/Skills'
import type { GameState, PlayerState } from '../state/GameState'
import { DEFAULT_RESONANCE_ATTACKS } from '../../game-config/skills'

function getResonanceRequirement(player: Readonly<PlayerState>): number {
  const value = getDerivedPlayerStats(player).resonance
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_RESONANCE_ATTACKS
}

export function isSkillResonant(
  state: Readonly<GameState>,
  skillId: SkillId,
): boolean {
  const skill = state.player.skills.find((candidate) => candidate.skillId === skillId)
  return skill !== undefined &&
    (skill.resonanceAttackCount ?? 0) >= getResonanceRequirement(state.player)
}

export function recordBasicAttackForResonance(state: GameState): void {
  const requirement = getResonanceRequirement(state.player)
  for (const skill of state.player.skills) {
    if (skill.skillId === BASIC_ATTACK_SKILL_ID) {
      continue
    }
    skill.resonanceAttackCount = Math.min(
      requirement,
      Math.max(0, skill.resonanceAttackCount ?? 0) + 1,
    )
  }
}

export function consumeSkillResonance(state: GameState, skillId: SkillId): void {
  const skill = state.player.skills.find((candidate) => candidate.skillId === skillId)
  if (skill) {
    skill.resonanceAttackCount = 0
  }
}
