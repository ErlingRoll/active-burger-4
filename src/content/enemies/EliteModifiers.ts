import {
  FLANKER_BEHAVIOR,
  FLANKER_DEFINITION_ID,
} from '../../game-config/enemies'
import type { EnemyBehaviorDefinition } from './Enemies'
import type { ElementalDamageType } from '../stats/Damage'

export type EliteModifierId =
  | 'hasted'
  | 'giant'
  | 'fiery'
  | 'electrocuting'
  | 'frigid'
  | 'poisoner'
  | 'flanking'
  | 'armored'
  | 'berserking'
  | 'volatile'
  | 'leeching'
  | 'wardbound'
  | 'maddening'
  | 'spiteful'
  | 'phasebound'

export const MAX_ELITE_MODIFIER_COUNT = 3

export type EliteModifierInput =
  | EliteModifierId
  | readonly EliteModifierId[]
  | undefined

export type EliteAuraStyle =
  | 'ring'
  | 'flames'
  | 'electric'
  | 'frost'
  | 'poison'
  | 'armor'
  | 'berserk'
  | 'volatile'
  | 'leech'
  | 'ward'
  | 'maddening'
  | 'spiteful'
  | 'phase'

export interface ElitePoisonApplication {
  durationSeconds: number
  physicalChaosRatio: number
}

export interface EliteBerserkingEffect {
  healthThreshold: number
  speedMultiplier: number
  contactDamageMultiplier: number
}

export interface EliteVolatileEffect {
  telegraphDurationSeconds: number
  radius: number
  contactDamageMultiplier: number
}

export interface EliteLeechingEffect {
  healingRatio: number
  poisonerHealingRatio: number
  maximumHealRatio: number
}

export interface EliteMaddeningEffect {
  radius: number
  attackSpeedMultiplier: number
}

export interface EliteSpitefulEffect {
  cooldownSeconds: number
  radius: number
  contactDamageMultiplier: number
}

export interface ElitePhaseboundEffect {
  intervalSeconds: number
  durationSeconds: number
  damageTakenMultiplier: number
}

export interface EliteModifierDefinition {
  id: EliteModifierId
  name: string
  speedMultiplier: number
  radiusMultiplier: number
  maxHpMultiplier: number
  xpRewardMultiplier: number
  gearDropChanceMultiplier: number
  markerColor: string
  auraStyle: EliteAuraStyle
  extraDamageType?: ElementalDamageType
  extraPhysicalDamageRatio?: number
  poisonApplication?: ElitePoisonApplication
  hastedPoisonApplication?: ElitePoisonApplication
  behaviorOverride?: Extract<EnemyBehaviorDefinition, { kind: 'intercept' }>
  physicalResistance?: number
  berserking?: EliteBerserkingEffect
  volatile?: EliteVolatileEffect
  leeching?: EliteLeechingEffect
  wardMaxHpRatio?: number
  maddening?: EliteMaddeningEffect
  spiteful?: EliteSpitefulEffect
  phasebound?: ElitePhaseboundEffect
}

/**
 * Elite tuning is content, rather than a renderer concern. Giant's 2x HP and
 * 1.5x size are intentionally explicit so reward and readability changes can
 * be balanced without changing simulation systems.
 */
export const ELITE_MODIFIER_DEFINITIONS = {
  hasted: {
    id: 'hasted',
    name: 'Hasted',
    speedMultiplier: 1.75,
    radiusMultiplier: 1,
    maxHpMultiplier: 1,
    xpRewardMultiplier: 1.5,
    gearDropChanceMultiplier: 1.5,
    markerColor: '#facc15',
    auraStyle: 'ring',
  },
  giant: {
    id: 'giant',
    name: 'Giant',
    speedMultiplier: 1,
    radiusMultiplier: 1.5,
    maxHpMultiplier: 2,
    xpRewardMultiplier: 2,
    gearDropChanceMultiplier: 2,
    markerColor: '#fb7185',
    auraStyle: 'ring',
  },
  fiery: {
    id: 'fiery',
    name: 'Fiery',
    speedMultiplier: 1,
    radiusMultiplier: 1,
    maxHpMultiplier: 1,
    xpRewardMultiplier: 1.5,
    gearDropChanceMultiplier: 1.5,
    markerColor: '#f97316',
    auraStyle: 'flames',
    extraDamageType: 'fire',
    extraPhysicalDamageRatio: 0.45,
  },
  electrocuting: {
    id: 'electrocuting',
    name: 'Electrocuting',
    speedMultiplier: 1,
    radiusMultiplier: 1,
    maxHpMultiplier: 1,
    xpRewardMultiplier: 1.5,
    gearDropChanceMultiplier: 1.5,
    markerColor: '#22d3ee',
    auraStyle: 'electric',
    extraDamageType: 'lightning',
    extraPhysicalDamageRatio: 0.4,
  },
  frigid: {
    id: 'frigid',
    name: 'Frigid',
    speedMultiplier: 1,
    radiusMultiplier: 1,
    maxHpMultiplier: 1,
    xpRewardMultiplier: 1.5,
    gearDropChanceMultiplier: 1.5,
    markerColor: '#93c5fd',
    auraStyle: 'frost',
    extraDamageType: 'cold',
    extraPhysicalDamageRatio: 0.35,
  },
  poisoner: {
    id: 'poisoner',
    name: 'Poisoner',
    speedMultiplier: 1,
    radiusMultiplier: 1,
    maxHpMultiplier: 1,
    xpRewardMultiplier: 1.5,
    gearDropChanceMultiplier: 1.5,
    markerColor: '#a3e635',
    auraStyle: 'poison',
    poisonApplication: {
      durationSeconds: 3,
      physicalChaosRatio: 0.3,
    },
    hastedPoisonApplication: {
      durationSeconds: 3,
      physicalChaosRatio: 0.2,
    },
  },
  flanking: {
    id: 'flanking',
    name: 'Flanking',
    speedMultiplier: 1,
    radiusMultiplier: 1,
    maxHpMultiplier: 1,
    xpRewardMultiplier: 1.5,
    gearDropChanceMultiplier: 1.5,
    markerColor: '#d946ef',
    auraStyle: 'ring',
    behaviorOverride: FLANKER_BEHAVIOR,
  },
  armored: {
    id: 'armored',
    name: 'Armored',
    speedMultiplier: 1,
    radiusMultiplier: 1,
    maxHpMultiplier: 1,
    xpRewardMultiplier: 1.5,
    gearDropChanceMultiplier: 1.5,
    markerColor: '#94a3b8',
    auraStyle: 'armor',
    physicalResistance: 35,
  },
  berserking: {
    id: 'berserking',
    name: 'Berserking',
    speedMultiplier: 1,
    radiusMultiplier: 1,
    maxHpMultiplier: 1,
    xpRewardMultiplier: 1.5,
    gearDropChanceMultiplier: 1.5,
    markerColor: '#ef4444',
    auraStyle: 'berserk',
    berserking: {
      healthThreshold: 0.5,
      speedMultiplier: 1.35,
      contactDamageMultiplier: 1.2,
    },
  },
  volatile: {
    id: 'volatile',
    name: 'Volatile',
    speedMultiplier: 1,
    radiusMultiplier: 1,
    maxHpMultiplier: 1,
    xpRewardMultiplier: 1.5,
    gearDropChanceMultiplier: 1.5,
    markerColor: '#fb923c',
    auraStyle: 'volatile',
    volatile: {
      telegraphDurationSeconds: 0.75,
      radius: 120,
      contactDamageMultiplier: 1.5,
    },
  },
  leeching: {
    id: 'leeching',
    name: 'Leeching',
    speedMultiplier: 1,
    radiusMultiplier: 1,
    maxHpMultiplier: 1,
    xpRewardMultiplier: 1.5,
    gearDropChanceMultiplier: 1.5,
    markerColor: '#f43f5e',
    auraStyle: 'leech',
    leeching: {
      healingRatio: 0.25,
      poisonerHealingRatio: 0.1,
      maximumHealRatio: 0.08,
    },
  },
  wardbound: {
    id: 'wardbound',
    name: 'Wardbound',
    speedMultiplier: 1,
    radiusMultiplier: 1,
    maxHpMultiplier: 1,
    xpRewardMultiplier: 1.5,
    gearDropChanceMultiplier: 1.5,
    markerColor: '#a78bfa',
    auraStyle: 'ward',
    wardMaxHpRatio: 0.3,
  },
  maddening: {
    id: 'maddening',
    name: 'Maddening',
    speedMultiplier: 1,
    radiusMultiplier: 1,
    maxHpMultiplier: 1,
    xpRewardMultiplier: 1.5,
    gearDropChanceMultiplier: 1.5,
    markerColor: '#c084fc',
    auraStyle: 'maddening',
    maddening: {
      radius: 180,
      attackSpeedMultiplier: 0.88,
    },
  },
  spiteful: {
    id: 'spiteful',
    name: 'Spiteful',
    speedMultiplier: 1,
    radiusMultiplier: 1,
    maxHpMultiplier: 1,
    xpRewardMultiplier: 1.5,
    gearDropChanceMultiplier: 1.5,
    markerColor: '#f472b6',
    auraStyle: 'spiteful',
    spiteful: {
      cooldownSeconds: 1.75,
      radius: 120,
      contactDamageMultiplier: 0.75,
    },
  },
  phasebound: {
    id: 'phasebound',
    name: 'Phasebound',
    speedMultiplier: 1,
    radiusMultiplier: 1,
    maxHpMultiplier: 1,
    xpRewardMultiplier: 1.5,
    gearDropChanceMultiplier: 1.5,
    markerColor: '#67e8f9',
    auraStyle: 'phase',
    phasebound: {
      intervalSeconds: 6,
      durationSeconds: 1,
      damageTakenMultiplier: 0.25,
    },
  },
} as const satisfies Record<EliteModifierId, EliteModifierDefinition>

export function getEliteModifierDefinition(
  modifierId: EliteModifierId,
): EliteModifierDefinition {
  return ELITE_MODIFIER_DEFINITIONS[modifierId]
}

export function normalizeEliteModifierIds(
  modifierInput: EliteModifierInput,
): EliteModifierId[] {
  const modifierIds = Array.isArray(modifierInput)
    ? modifierInput
    : modifierInput
      ? [modifierInput]
      : []
  return [...new Set(modifierIds)].slice(0, MAX_ELITE_MODIFIER_COUNT)
}

export function getEliteModifierIds(
  entity: Pick<{
    eliteModifier?: EliteModifierId
    eliteModifiers?: readonly EliteModifierId[]
  }, 'eliteModifier' | 'eliteModifiers'>,
): readonly EliteModifierId[] {
  return entity.eliteModifiers?.length
    ? entity.eliteModifiers
    : entity.eliteModifier
      ? [entity.eliteModifier]
      : []
}

export function getEliteModifierRewardMultiplier(
  modifierInput: EliteModifierInput,
  rewardKey: 'xpRewardMultiplier' | 'gearDropChanceMultiplier',
): number {
  return normalizeEliteModifierIds(modifierInput).reduce(
    (multiplier, modifierId) =>
      multiplier + getEliteModifierDefinition(modifierId)[rewardKey] - 1,
    1,
  )
}

export function getElitePoisonApplication(
  modifierInput: EliteModifierInput,
): ElitePoisonApplication | undefined {
  const modifierIds = normalizeEliteModifierIds(modifierInput)
  const poisoner = modifierIds.includes('poisoner')
    ? getEliteModifierDefinition('poisoner')
    : undefined
  if (!poisoner?.poisonApplication) {
    return undefined
  }
  return modifierIds.includes('hasted')
    ? poisoner.hastedPoisonApplication ?? poisoner.poisonApplication
    : poisoner.poisonApplication
}

export function getEliteBerserkingEffect(
  entity: Pick<
    { eliteModifier?: EliteModifierId; eliteModifiers?: readonly EliteModifierId[]; hp: number; maxHp: number },
    'eliteModifier' | 'eliteModifiers' | 'hp' | 'maxHp'
  >,
): EliteBerserkingEffect | undefined {
  const effect = getEliteModifierIds(entity)
    .map(getEliteModifierDefinition)
    .find((modifier) => modifier.berserking)?.berserking
  return effect && entity.hp / Math.max(1, entity.maxHp) <= effect.healthThreshold
    ? effect
    : undefined
}

export function getEliteLeechingEffect(
  modifierInput: EliteModifierInput,
): Pick<EliteLeechingEffect, 'healingRatio' | 'maximumHealRatio'> | undefined {
  const modifierIds = normalizeEliteModifierIds(modifierInput)
  const effect = modifierIds.includes('leeching')
    ? getEliteModifierDefinition('leeching').leeching
    : undefined
  if (!effect) {
    return undefined
  }
  return {
    healingRatio: modifierIds.includes('poisoner')
      ? effect.poisonerHealingRatio
      : effect.healingRatio,
    maximumHealRatio: effect.maximumHealRatio,
  }
}

export function getElitePhaseboundDamageMultiplier(
  entity: Pick<
    {
      eliteModifier?: EliteModifierId
      eliteModifiers?: readonly EliteModifierId[]
      spawnTime?: number
      frozenRemainingDuration?: number
    },
    'eliteModifier' | 'eliteModifiers' | 'spawnTime' | 'frozenRemainingDuration'
  >,
  timeSeconds: number,
  phaseBlocked = false,
): number {
  const effect = getEliteModifierIds(entity)
    .map(getEliteModifierDefinition)
    .find((modifier) => modifier.phasebound)?.phasebound
  if (!effect || phaseBlocked || (entity.frozenRemainingDuration ?? 0) > 0) {
    return 1
  }
  const elapsed = Math.max(0, timeSeconds - (entity.spawnTime ?? timeSeconds))
  const phaseOffset = elapsed % effect.intervalSeconds
  return phaseOffset >= effect.intervalSeconds - effect.durationSeconds
    ? effect.damageTakenMultiplier
    : 1
}

export function isElitePhaseboundActive(
  entity: Pick<
    {
      eliteModifier?: EliteModifierId
      eliteModifiers?: readonly EliteModifierId[]
      spawnTime?: number
      frozenRemainingDuration?: number
    },
    'eliteModifier' | 'eliteModifiers' | 'spawnTime' | 'frozenRemainingDuration'
  >,
  timeSeconds: number,
  phaseBlocked = false,
): boolean {
  return getElitePhaseboundDamageMultiplier(entity, timeSeconds, phaseBlocked) < 1
}

export function isEliteModifierAllowedForEnemy(
  enemyDefinitionId: string,
  modifierId: EliteModifierId,
): boolean {
  if (modifierId === 'flanking' && enemyDefinitionId === FLANKER_DEFINITION_ID) {
    return false
  }
  return modifierId !== 'volatile' || enemyDefinitionId !== 'splitter'
}

export function isEliteModifierCombinationAllowed(
  selectedModifierIds: readonly EliteModifierId[],
  candidateModifierId: EliteModifierId,
): boolean {
  const selected = new Set(selectedModifierIds)
  if (
    (candidateModifierId === 'hasted' && selected.has('berserking')) ||
    (candidateModifierId === 'berserking' && selected.has('hasted'))
  ) {
    return false
  }
  const formsMaddeningFlankerHastedTriple =
    (candidateModifierId === 'maddening' &&
      selected.has('hasted') &&
      selected.has('flanking')) ||
    (candidateModifierId === 'hasted' &&
      selected.has('maddening') &&
      selected.has('flanking')) ||
    (candidateModifierId === 'flanking' &&
      selected.has('maddening') &&
      selected.has('hasted'))
  return !formsMaddeningFlankerHastedTriple
}
