export const DEFAULT_RUN_MODE_ID = 'dungeon' as const

export type RunModeId = 'dungeon' | 'infinite-abyss'

export const RUN_PREPARATION_SCHEMA_VERSION = 1 as const

export interface RunPreparationItemSnapshot {
  itemInstanceId: string
  definitionId: string
  quantity: number
  resolvedEffect?: Record<string, unknown>
}

export interface RunPreparationSnapshot {
  version: typeof RUN_PREPARATION_SCHEMA_VERSION
  items: readonly RunPreparationItemSnapshot[]
}

export interface RunPreparationEffects {
  movementSpeedPercent: number
  increasedHealingPercent: number
}

export const EMPTY_RUN_PREPARATION_SNAPSHOT: RunPreparationSnapshot = {
  version: RUN_PREPARATION_SCHEMA_VERSION,
  items: [],
}

export function isRunModeId(value: unknown): value is RunModeId {
  return value === 'dungeon' || value === 'infinite-abyss'
}

export function isRunPreparationSnapshot(
  value: unknown,
): value is RunPreparationSnapshot {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return false
  }
  const record = value as Record<string, unknown>
  if (record.version !== RUN_PREPARATION_SCHEMA_VERSION || !Array.isArray(record.items)) {
    return false
  }
  return record.items.every((item) => {
    if (
      typeof item !== 'object' ||
      item === null ||
      Array.isArray(item)
    ) {
      return false
    }
    const itemRecord = item as Record<string, unknown>
    return typeof itemRecord.itemInstanceId === 'string' &&
      itemRecord.itemInstanceId.length > 0 &&
      typeof itemRecord.definitionId === 'string' &&
      itemRecord.definitionId.length > 0 &&
      typeof itemRecord.quantity === 'number' &&
      Number.isInteger(itemRecord.quantity) &&
      itemRecord.quantity >= 1 &&
      (itemRecord.resolvedEffect === undefined ||
        typeof itemRecord.resolvedEffect === 'object' &&
        itemRecord.resolvedEffect !== null &&
        !Array.isArray(itemRecord.resolvedEffect))
  })
}

export function resolveRunPreparationEffects(
  preparation: RunPreparationSnapshot,
): RunPreparationEffects {
  const effects: RunPreparationEffects = {
    movementSpeedPercent: 0,
    increasedHealingPercent: 0,
  }
  for (const item of preparation.items) {
    const effect = item.resolvedEffect
    if (!effect) {
      continue
    }
    if (effect.type === 'fish-meal' &&
      effect.family === 'movement-speed' &&
      typeof effect.movementSpeedPercent === 'number' &&
      Number.isFinite(effect.movementSpeedPercent)) {
      effects.movementSpeedPercent += Math.max(0, effect.movementSpeedPercent)
    }
    if (effect.type === 'fish-meal' &&
      effect.family === 'increased-healing' &&
      typeof effect.increasedHealingPercent === 'number' &&
      Number.isFinite(effect.increasedHealingPercent)) {
      effects.increasedHealingPercent += Math.max(0, effect.increasedHealingPercent)
    }
  }
  return effects
}
