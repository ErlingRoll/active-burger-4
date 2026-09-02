import type { GameState } from '../../state/GameState'

/**
 * Removes combat state that must not cross a floor boundary.
 *
 * Progression, equipment, pickups, skill levels, and cooldowns intentionally
 * remain part of the run. The boss-death pickup magnet also remains active
 * across the boundary. Runtime combat state is cleared here so new skills and
 * effects have one boundary-reset contract to follow.
 */
export function resetFloorCombatState(state: GameState): void {
  state.enemies = []
  state.bosses = []
  state.telegraphs = []
  state.projectiles = []
  state.summons = []
  state.effects = []
  state.traps = []
  state.relays = []
  state.wires = []

  const player = state.player
  player.attackCooldownRemaining = 0
  player.lastHitVisual = undefined
  player.targetId = undefined
  player.basicAttackSynergyHitCount = 0
  player.basicAttackSynergyTriggerCooldownRemaining = 0
  player.whirlwindGuardRemaining = 0
  player.chainLightningBonusTargets = 0
  player.fieryTouchGravityPrimed = false
  player.lancerMomentumStacks = 0
  player.lancerMomentumDecayRemaining = 0
  player.rallyingBannerRemaining = 0
  player.rallyingBannerDamageReductionPercent = 0
  player.rallyingBannerCooldownReductionPercent = 0
  player.aegisPulseShieldAmount = 0
  player.aegisPulseShieldMaxAmount = 0
  player.aegisPulseShieldRemaining = 0
  player.aegisPulseShieldDuration = 0
  player.soulTethers = []
  player.soulTetherVitalityCharge = 0
  player.vitalityRiftPrimed = false
  player.mendingReturnHealingRemaining = 0
  player.gravityWellEchoPrimed = false
  player.bloodRiteShieldRestored = 0
  player.riftJavelinReturnBonusPercent = 0
  player.ruinSigils = []
  player.mirrorcast = undefined
  player.bloodDebt = undefined
  player.prismHalo = undefined
  player.prismConvergence = []
  player.poisonStacks = []

  for (const skill of player.skills) {
    skill.resonanceAttackCount = 0
  }

  const behavior = player.behaviorController
  if (behavior) {
    behavior.lastCandidate = undefined
    behavior.commitmentRemaining = 0
    behavior.committedSource = undefined
    behavior.committedTargetId = undefined
    behavior.committedPickupId = undefined
  }
}
