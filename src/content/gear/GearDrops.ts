import type { EnemyDefinitionId } from '../enemies/Enemies'
import {
  getEliteModifierDefinition,
  type EliteModifierId,
} from '../enemies/EliteModifiers'

/** Per-enemy probability of generating a gear orb on death. */
export const GEAR_DROP_CHANCES = {
  slime: 0.02,
  runner: 0.02,
  archer: 0.04,
  splitter: 0.04,
  brute: 0.06,
} as const satisfies Record<EnemyDefinitionId, number>

export const GEAR_DROP_FORCE_KILL_COUNT = 50

export interface GearPickupBalance {
  radius: number
  attractionRadius: number
  attractionSpeed: number
}

export const GEAR_PICKUP_BALANCE = {
  radius: 12,
  attractionRadius: 180,
  attractionSpeed: 360,
} as const satisfies GearPickupBalance

export function getGearDropChance(
  enemyDefinitionId: EnemyDefinitionId,
  eliteModifier?: EliteModifierId,
): number {
  const baseChance =
    GEAR_DROP_CHANCES[enemyDefinitionId as keyof typeof GEAR_DROP_CHANCES] ?? 0
  const multiplier = eliteModifier
    ? getEliteModifierDefinition(eliteModifier).gearDropChanceMultiplier
    : 1
  // Elite rewards improve authored chances but never turn ordinary drops into
  // an unconditional drop; the kill-50 guarantee remains the only guarantee.
  return Math.min(1, baseChance * multiplier)
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
