import {
  createInfernoWardenEncounter,
  createStoneGolemEncounterTimeline,
  type EncounterDefinition,
} from '../encounters/Encounters'

export type DungeonDefinitionId = string
export type DungeonMaxFloorUnlockId = string

/** A maximum-floor contract enabled by a meta-progression unlock. */
export interface DungeonMaxFloorContract {
  id: string
  maxFloor: number
  requiredUnlockId: DungeonMaxFloorUnlockId
}

export interface DungeonDefinition {
  id: DungeonDefinitionId
  name: string
  /** Normal floors to clear before the final encounter. */
  defaultMaxFloor: number
  /** Every normal floor occupies this much deterministic simulation time. */
  floorDurationSeconds: number
  /** Early per-floor HP scaling for ordinary enemies. */
  ordinaryEnemyStatScalingPerFloor: number
  /** Early per-floor contact damage scaling for ordinary enemies. */
  ordinaryEnemyContactDamageScalingPerFloor: number
  /** Boss events reserve one complete floor and suspend normal spawning. */
  bossFloorDurationSeconds: number
  encounterTimeline: readonly EncounterDefinition[]
  maximumFloorContracts: readonly DungeonMaxFloorContract[]
}

export const DEFAULT_DUNGEON_ID: DungeonDefinitionId = 'default-dungeon'
export const DEFAULT_DUNGEON_MAX_FLOOR = 30
export const DUNGEON_FLOOR_DURATION_SECONDS = 60
export const BOSS_FLOOR_EVENT_DURATION_SECONDS = 120
export const ORDINARY_ENEMY_FLOOR_STAT_SCALING = 0.30
export const ORDINARY_ENEMY_LATE_FLOOR_STAT_SCALING = 0.18
export const ORDINARY_ENEMY_CONTACT_DAMAGE_FLOOR_SCALING = 0.10
export const ORDINARY_ENEMY_LATE_CONTACT_DAMAGE_FLOOR_SCALING = 0.072
export const ORDINARY_ENEMY_CONTACT_DAMAGE_MULTIPLIER = 0.8
export const FLOOR_SCALING_BREAKPOINT = 5
export const BOSS_HP_FLOOR_SCALING = 0.1125
export const BOSS_LATE_HP_FLOOR_SCALING = 0.036
export const BOSS_CONTACT_DAMAGE_FLOOR_SCALING = 0.072
export const BOSS_LATE_CONTACT_DAMAGE_FLOOR_SCALING = 0.027
export const EARLY_BOSS_DAMAGE_MULTIPLIER = 0.7
export const EARLY_BOSS_DAMAGE_FLOOR_COUNT = 3

export interface FloorDifficultyProfile {
  /** Additional multiplier applied after the authored ordinary-enemy curve. */
  ordinaryEnemyHpMultiplier: number
  /** Additional multiplier applied after the authored ordinary-enemy curve. */
  ordinaryEnemyContactDamageMultiplier: number
  ordinaryEnemySpeedMultiplier: number
  spawnThreatMultiplier: number
  eliteChanceMultiplier: number
  /** 0..1+ intensity used to tune ordinary-enemy abilities. */
  abilityIntensity: number
  abilityDamageMultiplier: number
  abilityCooldownMultiplier: number
  /** 0..1 composition pressure toward advanced enemy types. */
  compositionProgress: number
}

interface FloorDifficultyAnchor extends FloorDifficultyProfile {
  floor: number
}

const FLOOR_DIFFICULTY_ANCHORS: readonly FloorDifficultyAnchor[] = [
  {
    floor: 1,
    ordinaryEnemyHpMultiplier: 1,
    ordinaryEnemyContactDamageMultiplier: 1,
    ordinaryEnemySpeedMultiplier: 1,
    spawnThreatMultiplier: 1,
    eliteChanceMultiplier: 1,
    abilityIntensity: 0.18,
    abilityDamageMultiplier: 0.6,
    abilityCooldownMultiplier: 1.4,
    compositionProgress: 0,
  },
  {
    floor: 5,
    ordinaryEnemyHpMultiplier: 1,
    ordinaryEnemyContactDamageMultiplier: 1,
    ordinaryEnemySpeedMultiplier: 1,
    spawnThreatMultiplier: 1.04,
    eliteChanceMultiplier: 1.04,
    abilityIntensity: 0.25,
    abilityDamageMultiplier: 0.7,
    abilityCooldownMultiplier: 1.3,
    compositionProgress: 0.08,
  },
  {
    floor: 20,
    ordinaryEnemyHpMultiplier: 1,
    ordinaryEnemyContactDamageMultiplier: 1.12,
    ordinaryEnemySpeedMultiplier: 1.06,
    spawnThreatMultiplier: 1.16,
    eliteChanceMultiplier: 1.18,
    abilityIntensity: 0.52,
    abilityDamageMultiplier: 0.9,
    abilityCooldownMultiplier: 1,
    compositionProgress: 0.45,
  },
  {
    floor: 50,
    ordinaryEnemyHpMultiplier: 1.08,
    ordinaryEnemyContactDamageMultiplier: 1.3,
    ordinaryEnemySpeedMultiplier: 1.14,
    spawnThreatMultiplier: 1.34,
    eliteChanceMultiplier: 1.42,
    abilityIntensity: 0.76,
    abilityDamageMultiplier: 1.1,
    abilityCooldownMultiplier: 0.84,
    compositionProgress: 0.72,
  },
  {
    floor: 100,
    ordinaryEnemyHpMultiplier: 1.18,
    ordinaryEnemyContactDamageMultiplier: 1.58,
    ordinaryEnemySpeedMultiplier: 1.23,
    spawnThreatMultiplier: 1.55,
    eliteChanceMultiplier: 1.72,
    abilityIntensity: 1,
    abilityDamageMultiplier: 1.3,
    abilityCooldownMultiplier: 0.72,
    compositionProgress: 0.9,
  },
  {
    floor: 1000,
    ordinaryEnemyHpMultiplier: 1.5,
    ordinaryEnemyContactDamageMultiplier: 2,
    ordinaryEnemySpeedMultiplier: 1.38,
    spawnThreatMultiplier: 2,
    eliteChanceMultiplier: 2.15,
    abilityIntensity: 1.2,
    abilityDamageMultiplier: 1.6,
    abilityCooldownMultiplier: 0.58,
    compositionProgress: 1,
  },
]

function interpolateFloorDifficultyValue(
  floorNumber: number,
  key: keyof FloorDifficultyProfile,
): number {
  const floor = Math.max(1, Math.floor(floorNumber))
  const first = FLOOR_DIFFICULTY_ANCHORS[0]!
  const last = FLOOR_DIFFICULTY_ANCHORS[FLOOR_DIFFICULTY_ANCHORS.length - 1]!
  if (floor <= first.floor) {
    return first[key]
  }
  if (floor >= last.floor) {
    return last[key]
  }

  for (let index = 1; index < FLOOR_DIFFICULTY_ANCHORS.length; index += 1) {
    const upper = FLOOR_DIFFICULTY_ANCHORS[index]!
    if (floor > upper.floor) {
      continue
    }
    const lower = FLOOR_DIFFICULTY_ANCHORS[index - 1]!
    const progress = (floor - lower.floor) / (upper.floor - lower.floor)
    // Smoothstep avoids a visible derivative change at tuning anchors while
    // retaining explicit, reviewable values for each progression band.
    const smoothProgress = progress * progress * (3 - 2 * progress)
    return lower[key] + (upper[key] - lower[key]) * smoothProgress
  }

  return last[key]
}

export function getFloorDifficultyProfile(
  floorNumber: number,
): FloorDifficultyProfile {
  return {
    ordinaryEnemyHpMultiplier: interpolateFloorDifficultyValue(
      floorNumber,
      'ordinaryEnemyHpMultiplier',
    ),
    ordinaryEnemyContactDamageMultiplier: interpolateFloorDifficultyValue(
      floorNumber,
      'ordinaryEnemyContactDamageMultiplier',
    ),
    ordinaryEnemySpeedMultiplier: interpolateFloorDifficultyValue(
      floorNumber,
      'ordinaryEnemySpeedMultiplier',
    ),
    spawnThreatMultiplier: interpolateFloorDifficultyValue(
      floorNumber,
      'spawnThreatMultiplier',
    ),
    eliteChanceMultiplier: interpolateFloorDifficultyValue(
      floorNumber,
      'eliteChanceMultiplier',
    ),
    abilityIntensity: interpolateFloorDifficultyValue(
      floorNumber,
      'abilityIntensity',
    ),
    abilityDamageMultiplier: interpolateFloorDifficultyValue(
      floorNumber,
      'abilityDamageMultiplier',
    ),
    abilityCooldownMultiplier: interpolateFloorDifficultyValue(
      floorNumber,
      'abilityCooldownMultiplier',
    ),
    compositionProgress: interpolateFloorDifficultyValue(
      floorNumber,
      'compositionProgress',
    ),
  }
}

/** Builds boss encounters for every normal floor, ending with Inferno Warden. */
export function createDungeonEncounterTimeline(
  maximumFloor: number,
): readonly EncounterDefinition[] {
  return [
    ...createStoneGolemEncounterTimeline(maximumFloor),
    createInfernoWardenEncounter(maximumFloor),
  ]
}

export const DEFAULT_DUNGEON_CONFIG: DungeonDefinition = {
  id: DEFAULT_DUNGEON_ID,
  name: 'The First Depths',
  defaultMaxFloor: DEFAULT_DUNGEON_MAX_FLOOR,
  floorDurationSeconds: DUNGEON_FLOOR_DURATION_SECONDS,
  ordinaryEnemyStatScalingPerFloor: ORDINARY_ENEMY_FLOOR_STAT_SCALING,
  ordinaryEnemyContactDamageScalingPerFloor:
    ORDINARY_ENEMY_CONTACT_DAMAGE_FLOOR_SCALING,
  bossFloorDurationSeconds: BOSS_FLOOR_EVENT_DURATION_SECONDS,
  encounterTimeline: createDungeonEncounterTimeline(DEFAULT_DUNGEON_MAX_FLOOR),
  maximumFloorContracts: [
    {
      id: 'default-dungeon-20-floor',
      maxFloor: 200,
      requiredUnlockId: 'default-dungeon-20-floor',
    },
    {
      id: 'default-dungeon-50-floor',
      maxFloor: 500,
      requiredUnlockId: 'default-dungeon-50-floor',
    },
    {
      id: 'default-dungeon-100-floor',
      maxFloor: 1000,
      requiredUnlockId: 'default-dungeon-100-floor',
    },
  ],
}

export const DUNGEON_DEFINITIONS: Readonly<Record<DungeonDefinitionId, DungeonDefinition>> = {
  [DEFAULT_DUNGEON_ID]: DEFAULT_DUNGEON_CONFIG,
}

export function getDungeonDefinition(
  id: DungeonDefinitionId = DEFAULT_DUNGEON_ID,
): DungeonDefinition {
  const definition = DUNGEON_DEFINITIONS[id]
  if (!definition) {
    throw new Error(`Unknown dungeon definition: ${id}`)
  }
  return definition
}

/**
 * Floor scaling is derived from the authored base each time. Callers must not
 * feed a previously scaled value back into this function.
 */
export function getFloorStatMultiplier(
  floorNumber: number,
  dungeon: DungeonDefinition = DEFAULT_DUNGEON_CONFIG,
): number {
  return getProgressiveFloorMultiplier(
    floorNumber,
    dungeon.ordinaryEnemyStatScalingPerFloor,
    ORDINARY_ENEMY_LATE_FLOOR_STAT_SCALING,
    FLOOR_SCALING_BREAKPOINT,
  )
}

export function getFloorContactDamageMultiplier(
  floorNumber: number,
  dungeon: DungeonDefinition = DEFAULT_DUNGEON_CONFIG,
): number {
  return getProgressiveFloorMultiplier(
    floorNumber,
    dungeon.ordinaryEnemyContactDamageScalingPerFloor,
    ORDINARY_ENEMY_LATE_CONTACT_DAMAGE_FLOOR_SCALING,
    FLOOR_SCALING_BREAKPOINT,
  )
}

function getProgressiveFloorMultiplier(
  floorNumber: number,
  earlyPerFloor: number,
  latePerFloor: number,
  breakpointFloor: number,
): number {
  const floor = Math.max(1, Math.floor(floorNumber))
  const floorsAfterFirst = floor - 1
  const earlyFloorCount = Math.max(0, Math.floor(breakpointFloor) - 1)
  return 1 +
    Math.min(floorsAfterFirst, earlyFloorCount) * earlyPerFloor +
    Math.max(floorsAfterFirst - earlyFloorCount, 0) *
      latePerFloor
}

export function getBossHpMultiplier(floorNumber: number): number {
  return getProgressiveFloorMultiplier(
    floorNumber,
    BOSS_HP_FLOOR_SCALING,
    BOSS_LATE_HP_FLOOR_SCALING,
    10,
  )
}

export function getBossContactDamageMultiplier(floorNumber: number): number {
  return getProgressiveFloorMultiplier(
    floorNumber,
    BOSS_CONTACT_DAMAGE_FLOOR_SCALING,
    BOSS_LATE_CONTACT_DAMAGE_FLOOR_SCALING,
    10,
  )
}

export function getBossDamageMultiplier(floorNumber: number): number {
  return Math.max(1, Math.floor(floorNumber)) <= EARLY_BOSS_DAMAGE_FLOOR_COUNT
    ? EARLY_BOSS_DAMAGE_MULTIPLIER
    : 1
}

export interface OrdinaryEnemyStats {
  maxHp: number
  contactDamage: number
}

export function scaleOrdinaryEnemyStats(
  authoredStats: OrdinaryEnemyStats,
  floorNumber: number,
  dungeon: DungeonDefinition = DEFAULT_DUNGEON_CONFIG,
): OrdinaryEnemyStats {
  const multiplier = getFloorStatMultiplier(floorNumber, dungeon)
  const contactDamageMultiplier = getFloorContactDamageMultiplier(
    floorNumber,
    dungeon,
  )
  return {
    maxHp: authoredStats.maxHp * multiplier,
    contactDamage: authoredStats.contactDamage *
      contactDamageMultiplier *
      ORDINARY_ENEMY_CONTACT_DAMAGE_MULTIPLIER,
  }
}

/** Checks a maximum-floor contract without changing unlock state. */
export function isDungeonMaxFloorUnlocked(
  contract: DungeonMaxFloorContract,
  unlockedIds: ReadonlySet<string> = new Set(),
): boolean {
  return unlockedIds.has(contract.requiredUnlockId)
}

/** Resolves a run's maximum normal floor without permitting arbitrary values. */
export function resolveDungeonMaxFloor(
  dungeon: DungeonDefinition,
  contractId?: string,
  unlockedIds: ReadonlySet<string> = new Set(),
): number {
  if (!contractId) {
    return dungeon.defaultMaxFloor
  }
  const contract = dungeon.maximumFloorContracts.find(
    (candidate) => candidate.id === contractId,
  )
  if (!contract) {
    throw new Error(`Unknown dungeon maximum-floor contract: ${contractId}`)
  }
  if (!isDungeonMaxFloorUnlocked(contract, unlockedIds)) {
    throw new Error(
      `Dungeon maximum-floor contract "${contractId}" requires unlock "${contract.requiredUnlockId}"`,
    )
  }
  return contract.maxFloor
}
