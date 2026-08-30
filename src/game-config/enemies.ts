import type { EnemyDefinition, EnemyDefinitionId } from '../content/enemies/Enemies'
import { GEAR_DROP_CHANCES } from './gear'

export const SLIME_DEFINITION_ID: EnemyDefinitionId = 'slime'
export const RUNNER_DEFINITION_ID: EnemyDefinitionId = 'runner'
export const BRUTE_DEFINITION_ID: EnemyDefinitionId = 'brute'
export const ARCHER_DEFINITION_ID: EnemyDefinitionId = 'archer'
export const SPLITTER_DEFINITION_ID: EnemyDefinitionId = 'splitter'
export const FLANKER_DEFINITION_ID: EnemyDefinitionId = 'flanker'

export const FLANKER_BEHAVIOR = {
  kind: 'intercept',
  predictionSeconds: 1,
  lateralOffset: 90,
  engagementDistance: 56,
} as const satisfies Extract<EnemyDefinition['behavior'], { kind: 'intercept' }>

export const ENEMY_DEFINITIONS = {
  [SLIME_DEFINITION_ID]: {
    id: SLIME_DEFINITION_ID,
    name: 'Slime',
    radius: 18,
    maxHp: 25,
    speed: 90,
    contactDamage: 6,
    xpReward: 4,
    gearDropChance: GEAR_DROP_CHANCES.slime,
    controlResistance: 0,
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
    name: 'Runner',
    radius: 14,
    maxHp: 13,
    speed: 187.5,
    contactDamage: 5,
    xpReward: 5,
    gearDropChance: GEAR_DROP_CHANCES.runner,
    controlResistance: 10,
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
    name: 'Brute',
    radius: 30,
    maxHp: 105,
    speed: 48,
    contactDamage: 12,
    xpReward: 11,
    gearDropChance: GEAR_DROP_CHANCES.brute,
    controlResistance: 60,
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
    name: 'Archer',
    radius: 16,
    maxHp: 30,
    speed: 72,
    contactDamage: 9,
    xpReward: 8,
    gearDropChance: GEAR_DROP_CHANCES.archer,
    controlResistance: 20,
    behavior: {
      kind: 'standoff',
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
    name: 'Splitter',
    radius: 22,
    maxHp: 52,
    speed: 63,
    contactDamage: 8,
    xpReward: 10,
    gearDropChance: GEAR_DROP_CHANCES.splitter,
    controlResistance: 15,
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
  [FLANKER_DEFINITION_ID]: {
    id: FLANKER_DEFINITION_ID,
    name: 'Flanker',
    radius: 15,
    maxHp: 23,
    speed: 132,
    contactDamage: 6,
    xpReward: 7,
    gearDropChance: GEAR_DROP_CHANCES.runner,
    controlResistance: 25,
    behavior: FLANKER_BEHAVIOR,
    render: {
      color: '#ec4899',
      outlineColor: '#fbcfe8',
      scale: 1,
      shape: 'triangle',
    },
  },
} as const satisfies Record<EnemyDefinitionId, EnemyDefinition>
