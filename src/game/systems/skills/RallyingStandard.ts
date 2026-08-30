import {
  RALLYING_STANDARD_BASE_DAMAGE_REDUCTION_PERCENT,
  RALLYING_STANDARD_BULWARK_DAMAGE_REDUCTION_BONUS_PERCENT,
  RALLYING_STANDARD_COMMANDER_COOLDOWN_REDUCTION_PERCENT,
  RALLYING_STANDARD_SKILL_ID,
} from '../../../game-config/skills'
import type {
  GameState,
  SkillEffectState,
} from '../../state/GameState'

export function getRallyingStandardEffects(
  state: Readonly<GameState>,
): readonly SkillEffectState[] {
  return state.effects.filter(
    (effect) =>
      effect.skillId === RALLYING_STANDARD_SKILL_ID &&
      effect.remainingLifetime > 0,
  )
}

export function getRallyingStandardEffectsAffectingPlayer(
  state: Readonly<GameState>,
): readonly SkillEffectState[] {
  return getRallyingStandardEffects(state).filter((effect) =>
    Math.hypot(state.player.x - effect.x, state.player.y - effect.y) <=
      effect.radius + state.player.radius,
  )
}

export function isPlayerInRallyingStandard(
  state: Readonly<GameState>,
): boolean {
  const effects = getRallyingStandardEffects(state)
  return effects.length > 0
    ? effects.some((effect) =>
      Math.hypot(state.player.x - effect.x, state.player.y - effect.y) <=
        effect.radius + state.player.radius,
    )
    : (state.player.rallyingStandardRemaining ?? 0) > 0
}

export function getRallyingStandardDamageReductionPercent(
  state: Readonly<GameState>,
): number {
  if (!isPlayerInRallyingStandard(state)) {
    return 0
  }
  if (getRallyingStandardEffects(state).length === 0) {
    return state.player.rallyingStandardDamageReductionPercent ?? 0
  }
  return RALLYING_STANDARD_BASE_DAMAGE_REDUCTION_PERCENT +
    (state.run.selectedUpgradeIds.includes('rallying-standard-bulwark')
      ? RALLYING_STANDARD_BULWARK_DAMAGE_REDUCTION_BONUS_PERCENT
      : 0)
}

export function getRallyingStandardCooldownReductionPercent(
  state: Readonly<GameState>,
): number {
  if (!isPlayerInRallyingStandard(state)) {
    return 0
  }
  if (getRallyingStandardEffects(state).length === 0) {
    return state.player.rallyingStandardCooldownReductionPercent ?? 0
  }
  return state.run.selectedUpgradeIds.includes('rallying-standard-commander')
    ? RALLYING_STANDARD_COMMANDER_COOLDOWN_REDUCTION_PERCENT
    : 0
}

export function syncRallyingStandardPlayerState(state: GameState): void {
  const effects = getRallyingStandardEffectsAffectingPlayer(state)
  state.player.rallyingStandardRemaining = effects.reduce(
    (remaining, effect) => Math.max(remaining, effect.remainingLifetime),
    0,
  )
  if (effects.length === 0) {
    state.player.rallyingStandardDamageReductionPercent = 0
    state.player.rallyingStandardCooldownReductionPercent = 0
    return
  }

  state.player.rallyingStandardDamageReductionPercent =
    RALLYING_STANDARD_BASE_DAMAGE_REDUCTION_PERCENT +
    (state.run.selectedUpgradeIds.includes('rallying-standard-bulwark')
      ? RALLYING_STANDARD_BULWARK_DAMAGE_REDUCTION_BONUS_PERCENT
      : 0)
  state.player.rallyingStandardCooldownReductionPercent =
    state.run.selectedUpgradeIds.includes('rallying-standard-commander')
      ? RALLYING_STANDARD_COMMANDER_COOLDOWN_REDUCTION_PERCENT
      : 0
}
