export { DEFAULT_RUN_MODE_ID, isRunModeId } from '../shared/RunModes'
export type { RunModeId } from '../shared/RunModes'
import { isArtifactMetadata, type ArtifactMetadata } from '../content/artifacts/Artifacts'

export const RUN_PREPARATION_SCHEMA_VERSION = 1 as const

export interface RunPreparationItemSnapshot {
  itemInstanceId: string
  definitionId: string
  quantity: number
  resolvedEffect?: Record<string, unknown>
}

/**
 * An artifact taken into a run.
 *
 * The client sends the instance id and nothing else that matters; the server
 * copies the artifact's rolled metadata in from the owned instance, and it is
 * that copy, never the bag's, that the simulation reads. Absent on the way up,
 * present on the way back.
 */
export interface RunPreparationArtifactSnapshot {
  itemInstanceId: string
  definitionId: string
  quantity: number
  artifact?: ArtifactMetadata
}

export interface RunPreparationSnapshot {
  version: typeof RUN_PREPARATION_SCHEMA_VERSION
  items: readonly RunPreparationItemSnapshot[]
  /** Omitted by runs prepared before artifacts existed. */
  artifacts?: readonly RunPreparationArtifactSnapshot[]
}

export function isRunPreparationArtifactSnapshot(
  value: unknown,
): value is RunPreparationArtifactSnapshot {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const record = value as Record<string, unknown>
  return typeof record.itemInstanceId === 'string' &&
    record.itemInstanceId.length > 0 &&
    typeof record.definitionId === 'string' &&
    record.definitionId.length > 0 &&
    typeof record.quantity === 'number' &&
    Number.isInteger(record.quantity) &&
    record.quantity >= 1 &&
    (record.artifact === undefined || isArtifactMetadata(record.artifact))
}

/** The artifacts a run was played with, only those the server resolved. */
export function getPreparationArtifacts(
  preparation: RunPreparationSnapshot | undefined,
): ArtifactMetadata[] {
  return (preparation?.artifacts ?? []).flatMap((entry) => entry.artifact ? [entry.artifact] : [])
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
  if (record.artifacts !== undefined &&
    (!Array.isArray(record.artifacts) ||
      !record.artifacts.every(isRunPreparationArtifactSnapshot))) {
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
