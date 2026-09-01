import {
  RALLYING_BANNER_BASE_DAMAGE_REDUCTION_PERCENT,
  RALLYING_BANNER_BULWARK_DAMAGE_REDUCTION_BONUS_PERCENT,
  RALLYING_BANNER_COMMANDER_COOLDOWN_REDUCTION_PERCENT,
  RALLYING_BANNER_SKILL_ID,
  RALLYING_BANNER_SYNERGY_MAX_DURATION_SECONDS,
} from '../../../game-config/skills'
import type {
  GameState,
  SkillEffectState,
} from '../../state/GameState'

export function getRallyingBannerEffects(
  state: Readonly<GameState>,
): readonly SkillEffectState[] {
  return state.effects.filter(
    (effect) =>
      effect.skillId === RALLYING_BANNER_SKILL_ID &&
      effect.remainingLifetime > 0,
  )
}

export function getRallyingBannerEffectsAffectingPlayer(
  state: Readonly<GameState>,
): readonly SkillEffectState[] {
  return getRallyingBannerEffects(state).filter((effect) =>
    Math.hypot(state.player.x - effect.x, state.player.y - effect.y) <=
      effect.radius + state.player.radius,
  )
}

export function getNewestRallyingBannerEffect(
  state: Readonly<GameState>,
): SkillEffectState | undefined {
  return getRallyingBannerEffects(state).at(-1)
}

export function extendRallyingBannerDuration(
  effect: SkillEffectState,
  extensionSeconds: number,
): void {
  const extension = Math.min(
    extensionSeconds,
    Math.max(
      0,
      RALLYING_BANNER_SYNERGY_MAX_DURATION_SECONDS - effect.remainingLifetime,
    ),
  )
  effect.remainingLifetime += extension
  effect.lifetime += extension
}

export function isPlayerInRallyingBanner(
  state: Readonly<GameState>,
): boolean {
  const effects = getRallyingBannerEffects(state)
  return effects.length > 0
    ? effects.some((effect) =>
      Math.hypot(state.player.x - effect.x, state.player.y - effect.y) <=
        effect.radius + state.player.radius,
    )
    : (state.player.rallyingBannerRemaining ?? 0) > 0
}

export function getRallyingBannerDamageReductionPercent(
  state: Readonly<GameState>,
): number {
  if (!isPlayerInRallyingBanner(state)) {
    return 0
  }
  if (getRallyingBannerEffects(state).length === 0) {
    return state.player.rallyingBannerDamageReductionPercent ?? 0
  }
  return RALLYING_BANNER_BASE_DAMAGE_REDUCTION_PERCENT +
    (state.run.selectedUpgradeIds.includes('rallying-banner-bulwark')
      ? RALLYING_BANNER_BULWARK_DAMAGE_REDUCTION_BONUS_PERCENT
      : 0)
}

export function getRallyingBannerCooldownReductionPercent(
  state: Readonly<GameState>,
): number {
  if (!isPlayerInRallyingBanner(state)) {
    return 0
  }
  if (getRallyingBannerEffects(state).length === 0) {
    return state.player.rallyingBannerCooldownReductionPercent ?? 0
  }
  return state.run.selectedUpgradeIds.includes('rallying-banner-commander')
    ? RALLYING_BANNER_COMMANDER_COOLDOWN_REDUCTION_PERCENT
    : 0
}

export function syncRallyingBannerPlayerState(state: GameState): void {
  const effects = getRallyingBannerEffectsAffectingPlayer(state)
  state.player.rallyingBannerRemaining = effects.reduce(
    (remaining, effect) => Math.max(remaining, effect.remainingLifetime),
    0,
  )
  if (effects.length === 0) {
    state.player.rallyingBannerDamageReductionPercent = 0
    state.player.rallyingBannerCooldownReductionPercent = 0
    return
  }

  state.player.rallyingBannerDamageReductionPercent =
    RALLYING_BANNER_BASE_DAMAGE_REDUCTION_PERCENT +
    (state.run.selectedUpgradeIds.includes('rallying-banner-bulwark')
      ? RALLYING_BANNER_BULWARK_DAMAGE_REDUCTION_BONUS_PERCENT
      : 0)
  state.player.rallyingBannerCooldownReductionPercent =
    state.run.selectedUpgradeIds.includes('rallying-banner-commander')
      ? RALLYING_BANNER_COMMANDER_COOLDOWN_REDUCTION_PERCENT
      : 0
}
