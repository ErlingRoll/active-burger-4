import type { ProjectileDefinitionId } from '../../game/ids'

export interface ProjectileDefinition {
  id: ProjectileDefinitionId
  speed: number
  radius: number
  lifetime: number
}

export const BASIC_BOLT_DEFINITION_ID: ProjectileDefinitionId = 'basic-bolt'

export const PROJECTILE_DEFINITIONS = {
  [BASIC_BOLT_DEFINITION_ID]: {
    id: BASIC_BOLT_DEFINITION_ID,
    speed: 360,
    radius: 5,
    lifetime: 2,
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
