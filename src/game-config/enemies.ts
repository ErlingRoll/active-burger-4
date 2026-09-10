// Typed by the schema leaf, never by `content/enemies/Enemies`, which
// re-exports this module's data and would form an import cycle.
import type { EnemyDefinition, EnemyDefinitionId } from '../content/enemies/EnemyTypes'
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
    maxHp: 50,
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
      shape: 'slime',
    },
  },
  [RUNNER_DEFINITION_ID]: {
    id: RUNNER_DEFINITION_ID,
    name: 'Runner',
    radius: 14,
    maxHp: 26,
    speed: 187.5,
    contactDamage: 5,
    xpReward: 5,
    gearDropChance: GEAR_DROP_CHANCES.runner,
    controlResistance: 10,
    behavior: { kind: 'chase' },
    render: {
      color: '#f97316',
      outlineColor: '#fed7aa',
      /*
       * Drawn a third larger than it is. The runner and the flanker are the
       * two smallest bodies in the roster and the two fastest, which is the
       * worst pairing for reading a fight: they were a flicker crossing the
       * arena. The scale is the renderer's, so they read at a slime's size
       * while keeping the small hitbox their speed is balanced around.
       */
      scale: 1.3,
      shape: 'dart',
    },
  },
  [BRUTE_DEFINITION_ID]: {
    id: BRUTE_DEFINITION_ID,
    name: 'Brute',
    radius: 30,
    maxHp: 210,
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
      shape: 'bulwark',
    },
  },
  [ARCHER_DEFINITION_ID]: {
    id: ARCHER_DEFINITION_ID,
    name: 'Archer',
    radius: 16,
    maxHp: 60,
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
      shape: 'bow',
    },
  },
  [SPLITTER_DEFINITION_ID]: {
    id: SPLITTER_DEFINITION_ID,
    name: 'Splitter',
    radius: 22,
    maxHp: 104,
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
      shape: 'cluster',
    },
  },
  [FLANKER_DEFINITION_ID]: {
    id: FLANKER_DEFINITION_ID,
    name: 'Flanker',
    radius: 15,
    maxHp: 46,
    speed: 132,
    contactDamage: 6,
    xpReward: 7,
    gearDropChance: GEAR_DROP_CHANCES.runner,
    controlResistance: 25,
    behavior: FLANKER_BEHAVIOR,
    render: {
      // Larger than its hitbox for the same reason as the runner above.
      color: '#ec4899',
      outlineColor: '#fbcfe8',
      scale: 1.3,
      shape: 'hook',
    },
  },
} as const satisfies Record<EnemyDefinitionId, EnemyDefinition>
