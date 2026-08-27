import type { EnemyDefinition, EnemyDefinitionId } from '../content/enemies/Enemies'
import { GEAR_DROP_CHANCES } from './gear'

export const SLIME_DEFINITION_ID: EnemyDefinitionId = 'slime'
export const RUNNER_DEFINITION_ID: EnemyDefinitionId = 'runner'
export const BRUTE_DEFINITION_ID: EnemyDefinitionId = 'brute'
export const ARCHER_DEFINITION_ID: EnemyDefinitionId = 'archer'
export const SPLITTER_DEFINITION_ID: EnemyDefinitionId = 'splitter'

export const ENEMY_DEFINITIONS = {
  [SLIME_DEFINITION_ID]: {
    id: SLIME_DEFINITION_ID,
    name: 'Slime',
    radius: 18,
    maxHp: 20,
    speed: 60,
    contactDamage: 5,
    xpReward: 4,
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
    name: 'Runner',
    radius: 14,
    maxHp: 10,
    speed: 125,
    contactDamage: 4,
    xpReward: 5,
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
    name: 'Brute',
    radius: 30,
    maxHp: 85,
    speed: 32,
    contactDamage: 10,
    xpReward: 11,
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
    name: 'Archer',
    radius: 16,
    maxHp: 24,
    speed: 48,
    contactDamage: 7,
    xpReward: 8,
    gearDropChance: GEAR_DROP_CHANCES.archer,
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
    maxHp: 42,
    speed: 42,
    contactDamage: 6,
    xpReward: 10,
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
