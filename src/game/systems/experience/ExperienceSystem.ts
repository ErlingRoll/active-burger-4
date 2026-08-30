import { xpRequiredForNextLevel } from '../../../content/progression/XpBalance'
import type { EntityId } from '../../ids'
import type {
  GameState,
  GearPickupState,
  HealingPotionPickupState,
  PickupState,
} from '../../state/GameState'
import {
  getDerivedPlayerStats,
  refreshPlayerDerivedStats,
} from '../../stats/DerivedStats'
import { SpatialHash } from '../../spatial/SpatialHash'
import {
  BOSS_DEATH_MAGNET_DURATION_SECONDS,
  BOSS_DEATH_MAGNET_RANGE_INCREASE_PERCENT,
} from '../../../content/bosses/BossRewards'

const PICKUP_CONTACT_EPSILON = 1e-6
const BOSS_DEATH_MAGNET_RANGE_BONUS =
  BOSS_DEATH_MAGNET_RANGE_INCREASE_PERCENT / 100
const PICKUP_ATTRACTION_MAX_SPEED_MULTIPLIER = 4

function getPickupAttractionSpeedMultiplier(
  distance: number,
  contactRange: number,
  attractionRadius: number,
): number {
  const attractionDistance = Math.max(0, attractionRadius - contactRange)
  if (attractionDistance === 0) {
    return PICKUP_ATTRACTION_MAX_SPEED_MULTIPLIER
  }
  const progress = Math.min(
    1,
    Math.max(0, (attractionRadius - distance) / attractionDistance),
  )
  return 1 + progress * (PICKUP_ATTRACTION_MAX_SPEED_MULTIPLIER - 1)
}

export function activateBossDeathMagnet(state: GameState): void {
  state.player.bossMagnetRemaining = BOSS_DEATH_MAGNET_DURATION_SECONDS
}

export function updateBossDeathMagnet(
  state: GameState,
  fixedStepSeconds: number,
): void {
  const remaining = state.player.bossMagnetRemaining
  if (remaining === undefined) {
    return
  }
  const elapsed = Number.isFinite(fixedStepSeconds)
    ? Math.max(0, fixedStepSeconds)
    : 0
  state.player.bossMagnetRemaining = Math.max(
    0,
    (Number.isFinite(remaining) ? remaining : 0) - elapsed,
  )
}

export function updatePickups(
  state: GameState,
  fixedStepSeconds: number,
  grantExperience: (amount: number) => void,
  collectGearPickup: (pickup: GearPickupState) => void = () => {},
  collectHealingPotion: (pickup: HealingPotionPickupState) => void = () => {},
): void {
  const player = state.player
  const configuredRangeMultiplier = player.pickupCollectionRangeMultiplier
  const pickupCollectionRangeMultiplier =
    configuredRangeMultiplier !== undefined &&
    Number.isFinite(configuredRangeMultiplier)
      ? Math.max(0, configuredRangeMultiplier)
      : 1
  const bossMagnetRangeBonus =
    Number.isFinite(player.bossMagnetRemaining) &&
    (player.bossMagnetRemaining ?? 0) > 0
      ? BOSS_DEATH_MAGNET_RANGE_BONUS
      : 0
  const effectivePickupCollectionRangeMultiplier =
    pickupCollectionRangeMultiplier + bossMagnetRangeBonus
  const pickups = new SpatialHash<GameState['pickups'][number]>()
  let broadphaseRadius = 0
  for (const pickup of state.pickups) {
    pickups.insert(pickup.id, pickup.x, pickup.y, pickup.radius, pickup)
    broadphaseRadius = Math.max(
      broadphaseRadius,
      pickup.attractionRadius * effectivePickupCollectionRangeMultiplier,
      player.radius + pickup.radius + PICKUP_CONTACT_EPSILON,
    )
  }
  const collectedIds = new Set<EntityId>()

  for (const pickup of pickups.queryRadius(
    player.x,
    player.y,
    broadphaseRadius,
  )) {
    const offsetX = player.x - pickup.x
    const offsetY = player.y - pickup.y
    const distance = Math.hypot(offsetX, offsetY)
    const contactRange = player.radius + pickup.radius
    const attractionRadius =
      pickup.attractionRadius * effectivePickupCollectionRangeMultiplier

    if (
      distance <= contactRange + PICKUP_CONTACT_EPSILON ||
      distance === 0
    ) {
      collectPickup(pickup, grantExperience, collectGearPickup, collectHealingPotion)
      collectedIds.add(pickup.id)
      if (state.run.phase !== 'playing') {
        break
      }
      continue
    }

    if (distance > attractionRadius) {
      continue
    }

    const distanceToContact = distance - contactRange
    const attractionSpeed = pickup.attractionSpeed *
      getPickupAttractionSpeedMultiplier(
        distance,
        contactRange,
        attractionRadius,
      )
    const movementDistance = Math.min(
      attractionSpeed * fixedStepSeconds,
      distanceToContact,
    )
    const movementRatio = movementDistance / distance
    pickup.x += offsetX * movementRatio
    pickup.y += offsetY * movementRatio

    const reachedContact = movementDistance >=
      distanceToContact - PICKUP_CONTACT_EPSILON
    const distanceAfterMovement = Math.hypot(
      player.x - pickup.x,
      player.y - pickup.y,
    )
    if (
      reachedContact ||
      distanceAfterMovement <= contactRange + PICKUP_CONTACT_EPSILON
    ) {
      collectPickup(pickup, grantExperience, collectGearPickup, collectHealingPotion)
      collectedIds.add(pickup.id)
    }

    // Once level-up is reached, leave remaining pickups in state. They will
    // be collected after the future upgrade flow resumes the run.
    if (state.run.phase !== 'playing') {
      break
    }
  }

  state.pickups = state.pickups.filter(
    (pickup) => !collectedIds.has(pickup.id),
  )
}

function collectPickup(
  pickup: PickupState,
  grantExperience: (amount: number) => void,
  collectGearPickup: (pickup: GearPickupState) => void,
  collectHealingPotion: (pickup: HealingPotionPickupState) => void,
): void {
  if (pickup.kind === 'gear') {
    collectGearPickup(pickup)
  } else if (pickup.kind === 'healing-potion') {
    collectHealingPotion(pickup)
  } else {
    grantExperience(pickup.xpAmount)
  }
}

export function grantExperience(state: GameState, amount: number): number {
  const experience = Number.isFinite(amount)
    ? Math.max(0, amount) * (
        1 + Math.max(0, getDerivedPlayerStats(state.player).experienceGainPercent) / 100
      )
    : 0
  state.player.xp += experience

  let levelsGained = 0
  while (
    state.player.xp >=
    xpRequiredForNextLevel(state.player.level)
  ) {
    state.player.level += 1
    levelsGained += 1
  }
  if (levelsGained > 0) {
    refreshPlayerDerivedStats(state.player)
  }

  return levelsGained
}
