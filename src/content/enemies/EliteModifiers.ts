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

export type EliteAuraStyle =
  | 'ring'
  | 'flames'
  | 'electric'
  | 'frost'
  | 'poison'

export interface ElitePoisonApplication {
  durationSeconds: number
  physicalChaosRatio: number
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
  behaviorOverride?: Extract<EnemyBehaviorDefinition, { kind: 'intercept' }>
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
    extraPhysicalDamageRatio: 0.5,
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
    extraPhysicalDamageRatio: 0.5,
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
    extraPhysicalDamageRatio: 0.5,
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
      durationSeconds: 4,
      physicalChaosRatio: 0.5,
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
} as const satisfies Record<EliteModifierId, EliteModifierDefinition>

export function getEliteModifierDefinition(
  modifierId: EliteModifierId,
): EliteModifierDefinition {
  return ELITE_MODIFIER_DEFINITIONS[modifierId]
}

export function isEliteModifierAllowedForEnemy(
  enemyDefinitionId: string,
  modifierId: EliteModifierId,
): boolean {
  return modifierId !== 'flanking' || enemyDefinitionId !== FLANKER_DEFINITION_ID
}
