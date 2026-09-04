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
  attackSpeedPercent: number
  increasedHealingPercent: number
  maxHpPercent: number
  attackDamagePercent: number
  cooldownReductionPercent: number
  physicalResistancePercent: number
  eliteDamagePercent: number
  emergencyRevivePercent: number
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
    attackSpeedPercent: 0,
    increasedHealingPercent: 0,
    maxHpPercent: 0,
    attackDamagePercent: 0,
    cooldownReductionPercent: 0,
    physicalResistancePercent: 0,
    eliteDamagePercent: 0,
    emergencyRevivePercent: 0,
  }
  const caps: Record<keyof RunPreparationEffects, number> = {
    movementSpeedPercent: 6,
    attackSpeedPercent: 9,
    increasedHealingPercent: 12,
    maxHpPercent: 12,
    attackDamagePercent: 9,
    cooldownReductionPercent: 12,
    physicalResistancePercent: 10,
    eliteDamagePercent: 16,
    emergencyRevivePercent: 1,
  }
  for (const item of preparation.items) {
    const effect = item.resolvedEffect
    if (!effect) {
      continue
    }
    if (effect.type !== 'fish-meal' || typeof effect.family !== 'string') {
      continue
    }
    const effectKey = ({
      'movement-speed': 'movementSpeedPercent',
      'attack-speed': 'attackSpeedPercent',
      'increased-healing': 'increasedHealingPercent',
      'max-hp': 'maxHpPercent',
      'attack-damage': 'attackDamagePercent',
      'cooldown-reduction': 'cooldownReductionPercent',
      'physical-resistance': 'physicalResistancePercent',
      'elite-damage': 'eliteDamagePercent',
      'emergency-revive': 'emergencyRevivePercent',
    } as Record<string, keyof RunPreparationEffects>)[effect.family]
    if (!effectKey) {
      continue
    }
    const value = effect[effectKey]
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      continue
    }
    const nextValue = effectKey === 'emergencyRevivePercent'
      ? Math.max(effects.emergencyRevivePercent, value > 0 ? 1 : 0)
      : Math.min(
        caps[effectKey],
        effects[effectKey] + Math.max(0, value),
      )
    switch (effectKey) {
      case 'movementSpeedPercent':
        effects.movementSpeedPercent = nextValue
        break
      case 'attackSpeedPercent':
        effects.attackSpeedPercent = nextValue
        break
      case 'increasedHealingPercent':
        effects.increasedHealingPercent = nextValue
        break
      case 'maxHpPercent':
        effects.maxHpPercent = nextValue
        break
      case 'attackDamagePercent':
        effects.attackDamagePercent = nextValue
        break
      case 'cooldownReductionPercent':
        effects.cooldownReductionPercent = nextValue
        break
      case 'physicalResistancePercent':
        effects.physicalResistancePercent = nextValue
        break
      case 'eliteDamagePercent':
        effects.eliteDamagePercent = nextValue
        break
      case 'emergencyRevivePercent':
        effects.emergencyRevivePercent = nextValue
        break
    }
  }
  return effects
}
