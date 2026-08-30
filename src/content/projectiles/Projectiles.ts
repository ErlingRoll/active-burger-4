export type ProjectileDefinitionId = string

export interface ProjectileDefinition {
  id: ProjectileDefinitionId
  speed: number
  radius: number
  lifetime: number
  guidance: 'straight' | 'homing'
  turnRateDegreesPerSecond?: number
  retargetRange?: number
}

export const PLAYER_PROJECTILE_CHAIN_RANGE = 180

export const BASIC_ATTACK_ARROW_DEFINITION_ID: ProjectileDefinitionId =
  'basic-attack-arrow'
export const BASIC_ATTACK_ORB_DEFINITION_ID: ProjectileDefinitionId =
  'basic-attack-orb'
export const GLACIAL_ORB_PROJECTILE_DEFINITION_ID: ProjectileDefinitionId =
  'glacial-orb-projectile'

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
} as const satisfies Record<ProjectileDefinitionId, ProjectileDefinition>

export function getProjectileDefinition(
  definitionId: ProjectileDefinitionId,
): ProjectileDefinition {
  const definition = PROJECTILE_DEFINITIONS[definitionId]

  if (!definition) {
    throw new Error(`Unknown projectile definition: ${definitionId}`)
  }

  return definition
}
