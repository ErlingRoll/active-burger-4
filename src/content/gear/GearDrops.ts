import type { EnemyDefinitionId } from '../enemies/Enemies'
import {
  getEliteModifierDefinition,
  type EliteModifierId,
} from '../enemies/EliteModifiers'
import {
  GEAR_DROP_CHANCE_BALANCE,
  GEAR_DROP_CHANCES,
} from './GearDropConfig'
import {
  calculateThreatPerSecond,
  SPAWN_BALANCE,
  type SpawnBalance,
} from '../spawning/SpawnBalance'

export interface GearPickupBalance {
  radius: number
  attractionRadius: number
  attractionSpeed: number
}

export interface GearDropChanceOptions {
  timeSeconds?: number
  floorNumber?: number
  chanceMultiplier?: number
  spawnBalance?: SpawnBalance
}

export function getGearDropFloorMultiplier(floorNumber?: number): number {
  const taper = GEAR_DROP_CHANCE_BALANCE.floorTaper
  if (!Number.isFinite(floorNumber)) {
    return 1
  }

  const floorRange = taper.endFloor - taper.startFloor
  if (floorRange <= 0) {
    return taper.endMultiplier
  }

  const progress = Math.min(
    1,
    Math.max(
      0,
      (Math.floor(floorNumber ?? taper.startFloor) - taper.startFloor) /
        floorRange,
    ),
  )
  return taper.startMultiplier +
    (taper.endMultiplier - taper.startMultiplier) * progress
}

export function getGearDropChance(
  enemyDefinitionId: EnemyDefinitionId,
  eliteModifier?: EliteModifierId,
  options: GearDropChanceOptions = {},
): number {
  const baseChance =
    GEAR_DROP_CHANCES[enemyDefinitionId as keyof typeof GEAR_DROP_CHANCES] ?? 0
  const spawnBalance = options.spawnBalance ?? SPAWN_BALANCE
  const currentThreatPerSecond = calculateThreatPerSecond(
    options.timeSeconds ?? 0,
    spawnBalance,
  )
  const threatRatio = currentThreatPerSecond > 0
    ? Math.min(
        1,
        Math.max(0, spawnBalance.baseThreatPerSecond) /
          currentThreatPerSecond,
      )
    : 1
  const threatNormalization = Math.pow(
    threatRatio,
    Math.max(0, GEAR_DROP_CHANCE_BALANCE.threatNormalizationExponent),
  )
  const multiplier = eliteModifier
    ? getEliteModifierDefinition(eliteModifier).gearDropChanceMultiplier
    : 1
  const floorMultiplier = getGearDropFloorMultiplier(options.floorNumber)
  const chanceMultiplier = Math.max(0, options.chanceMultiplier ?? 1)
  return Math.min(
    1,
    baseChance *
      threatNormalization *
      floorMultiplier *
      multiplier *
      chanceMultiplier,
  )
}

export function validateGearDropChances(
  chances: Readonly<Record<string, number>>,
): string[] {
  const errors: string[] = []
  for (const [enemyId, chance] of Object.entries(chances)) {
    if (!Number.isFinite(chance) || chance < 0 || chance > 1) {
      errors.push(
        `gearDropChances.${enemyId} must be a finite number between 0 and 1.`,
      )
    }
  }
  return errors
}

export function validateGearPickupBalance(
  balance: GearPickupBalance,
): string[] {
  const errors: string[] = []
  for (const key of ['radius', 'attractionRadius', 'attractionSpeed'] as const) {
    if (!Number.isFinite(balance[key]) || balance[key] <= 0) {
      errors.push(`gearPickupBalance.${key} must be a positive finite number.`)
    }
  }
  return errors
}
