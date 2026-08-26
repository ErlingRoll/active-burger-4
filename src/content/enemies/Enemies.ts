import { GEAR_DROP_CHANCES } from '../gear/GearDrops'

export type EnemyDefinitionId = string
export type EnemyBehaviorKind = 'chase' | 'standoff' | 'split'
export type EnemyRenderShape = 'circle' | 'diamond' | 'triangle' | 'hexagon'

export interface EnemyRenderDefinition {
  color: string
  outlineColor: string
  scale: number
  shape: EnemyRenderShape
}

export interface EnemySplitDefinition {
  childDefinitionId: EnemyDefinitionId
  childCount: number
  childrenAwardXp: boolean
  spreadRadius: number
}

export type EnemyBehaviorDefinition =
  | { kind: 'chase' }
  | { kind: 'standoff'; desiredDistance: number; retreatDistance: number }
  | { kind: 'split'; split: EnemySplitDefinition }

export interface EnemyDefinition {
  id: EnemyDefinitionId
  radius: number
  maxHp: number
  speed: number
  contactDamage: number
  xpReward: number
  gearDropChance: number
  behavior: EnemyBehaviorDefinition
  render: EnemyRenderDefinition
}

export const SLIME_DEFINITION_ID: EnemyDefinitionId = 'slime'
export const RUNNER_DEFINITION_ID: EnemyDefinitionId = 'runner'
export const BRUTE_DEFINITION_ID: EnemyDefinitionId = 'brute'
export const ARCHER_DEFINITION_ID: EnemyDefinitionId = 'archer'
export const SPLITTER_DEFINITION_ID: EnemyDefinitionId = 'splitter'

export const ENEMY_DEFINITIONS = {
  [SLIME_DEFINITION_ID]: {
    id: SLIME_DEFINITION_ID,
    radius: 18,
    maxHp: 20,
    speed: 60,
    contactDamage: 5,
    xpReward: 5,
    gearDropChance: GEAR_DROP_CHANCES.slime,
    behavior: { kind: 'chase' },
    render: {
      color: '#ef4444',
      outlineColor: '#fecaca',
      scale: 1,
      shape: 'circle',
    },
  },
  [RUNNER_DEFINITION_ID]: {
    id: RUNNER_DEFINITION_ID,
    radius: 14,
    maxHp: 10,
    speed: 125,
    contactDamage: 4,
    xpReward: 6,
    gearDropChance: GEAR_DROP_CHANCES.runner,
    behavior: { kind: 'chase' },
    render: {
      color: '#f97316',
      outlineColor: '#fed7aa',
      scale: 1,
      shape: 'triangle',
    },
  },
  [BRUTE_DEFINITION_ID]: {
    id: BRUTE_DEFINITION_ID,
    radius: 30,
    maxHp: 85,
    speed: 32,
    contactDamage: 10,
    xpReward: 14,
    gearDropChance: GEAR_DROP_CHANCES.brute,
    behavior: { kind: 'chase' },
    render: {
      color: '#7c3aed',
      outlineColor: '#ddd6fe',
      scale: 1.15,
      shape: 'hexagon',
    },
  },
  [ARCHER_DEFINITION_ID]: {
    id: ARCHER_DEFINITION_ID,
    radius: 16,
    maxHp: 24,
    speed: 48,
    contactDamage: 7,
    xpReward: 10,
    gearDropChance: GEAR_DROP_CHANCES.archer,
    behavior: {
      kind: 'standoff',
      // Stay just inside player targeting range while avoiding contact.
      desiredDistance: 45,
      retreatDistance: 34,
    },
    render: {
      color: '#06b6d4',
      outlineColor: '#a5f3fc',
      scale: 1,
      shape: 'diamond',
    },
  },
  [SPLITTER_DEFINITION_ID]: {
    id: SPLITTER_DEFINITION_ID,
    radius: 22,
    maxHp: 42,
    speed: 42,
    contactDamage: 6,
    xpReward: 12,
    gearDropChance: GEAR_DROP_CHANCES.splitter,
    behavior: {
      kind: 'split',
      split: {
        childDefinitionId: SLIME_DEFINITION_ID,
        childCount: 2,
        childrenAwardXp: false,
        spreadRadius: 28,
      },
    },
    render: {
      color: '#84cc16',
      outlineColor: '#d9f99d',
      scale: 1.05,
      shape: 'diamond',
    },
  },
} as const satisfies Record<EnemyDefinitionId, EnemyDefinition>

export function getEnemyDefinition(
  definitionId: EnemyDefinitionId,
): EnemyDefinition {
  const definition = ENEMY_DEFINITIONS[definitionId]

  if (!definition) {
    throw new Error(`Unknown enemy definition: ${definitionId}`)
  }

  return definition
}
