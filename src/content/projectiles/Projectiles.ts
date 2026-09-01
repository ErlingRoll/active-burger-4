export type ProjectileDefinitionId = string

export interface ProjectileDefinition {
  id: ProjectileDefinitionId
  speed: number
  radius: number
  lifetime: number
  guidance: 'straight' | 'homing'
  homingDelaySeconds?: number
  turnRateDegreesPerSecond?: number
  retargetRange?: number
}

export const PLAYER_PROJECTILE_CHAIN_RANGE = 180
const DEGREES_TO_RADIANS = Math.PI / 180

export const BASIC_ATTACK_ARROW_DEFINITION_ID: ProjectileDefinitionId =
  'basic-attack-arrow'
export const BASIC_ATTACK_ORB_DEFINITION_ID: ProjectileDefinitionId =
  'basic-attack-orb'
export const GLACIAL_ORB_PROJECTILE_DEFINITION_ID: ProjectileDefinitionId =
  'glacial-orb-projectile'
export const CHAIN_LIGHTNING_PROJECTILE_DEFINITION_ID: ProjectileDefinitionId =
  'chain-lightning-projectile'
export const RIFT_JAVELIN_PROJECTILE_DEFINITION_ID: ProjectileDefinitionId =
  'rift-javelin-projectile'
export const PHANTOM_ARSENAL_PROJECTILE_DEFINITION_ID: ProjectileDefinitionId =
  'phantom-arsenal-projectile'
export const ENEMY_ARCHER_PROJECTILE_DEFINITION_ID: ProjectileDefinitionId =
  'enemy-archer-arrow'

export const PROJECTILE_DEFINITIONS = {
  [BASIC_ATTACK_ARROW_DEFINITION_ID]: {
    id: BASIC_ATTACK_ARROW_DEFINITION_ID,
    speed: 420,
    radius: 4,
    lifetime: 1.8,
    guidance: 'straight',
  },
  [BASIC_ATTACK_ORB_DEFINITION_ID]: {
    id: BASIC_ATTACK_ORB_DEFINITION_ID,
    speed: 320,
    radius: 6,
    lifetime: 2,
    guidance: 'homing',
    homingDelaySeconds: 0.5,
    turnRateDegreesPerSecond: 300,
    retargetRange: 280,
  },
  [GLACIAL_ORB_PROJECTILE_DEFINITION_ID]: {
    id: GLACIAL_ORB_PROJECTILE_DEFINITION_ID,
    speed: 360,
    radius: 9,
    lifetime: 1,
    guidance: 'straight',
  },
  [CHAIN_LIGHTNING_PROJECTILE_DEFINITION_ID]: {
    id: CHAIN_LIGHTNING_PROJECTILE_DEFINITION_ID,
    speed: 690,
    radius: 7,
    lifetime: 2.2,
    guidance: 'straight',
  },
  [RIFT_JAVELIN_PROJECTILE_DEFINITION_ID]: {
    id: RIFT_JAVELIN_PROJECTILE_DEFINITION_ID,
    speed: 480,
    radius: 8,
    lifetime: 1.4,
    guidance: 'straight',
  },
  [PHANTOM_ARSENAL_PROJECTILE_DEFINITION_ID]: {
    id: PHANTOM_ARSENAL_PROJECTILE_DEFINITION_ID,
    speed: 340,
    radius: 5,
    lifetime: 1.2,
    guidance: 'straight',
  },
  [ENEMY_ARCHER_PROJECTILE_DEFINITION_ID]: {
    id: ENEMY_ARCHER_PROJECTILE_DEFINITION_ID,
    speed: 480,
    radius: 7,
    lifetime: 3,
    guidance: 'straight',
  },
} as const satisfies Record<ProjectileDefinitionId, ProjectileDefinition>

export function getProjectileVolleyCount(
  sourceTags: readonly string[],
  globalExtraProjectiles: number,
): number {
  if (!sourceTags.includes('projectile')) {
    return 1
  }
  return 1 + Math.max(0, Math.trunc(globalExtraProjectiles))
}

/**
 * Returns centered angular offsets for a projectile volley. The configured
 * spread is the angle between adjacent projectiles.
 */
export function createProjectileSpreadAngles(
  projectileCount: number,
  spreadDegrees: number,
): number[] {
  if (projectileCount <= 1 || spreadDegrees <= 0) {
    return [0]
  }
  const step = spreadDegrees * DEGREES_TO_RADIANS
  const center = (projectileCount - 1) / 2
  return Array.from({ length: projectileCount }, (_, index) =>
    (index - center) * step
  )
}

export function getProjectileDefinition(
  definitionId: ProjectileDefinitionId,
): ProjectileDefinition {
  const definition = PROJECTILE_DEFINITIONS[definitionId]

  if (!definition) {
    throw new Error(`Unknown projectile definition: ${definitionId}`)
  }

  return definition
}
