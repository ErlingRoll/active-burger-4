// Stable identifier types for runtime entities and content definitions.
//
// Content IDs (Skill/Enemy/Item/Upgrade/Character) are plain strings so
// definitions can be looked up in data tables without depending on display
// names, which may change. See PLAN.md section 10.

export type SkillId = string
export type EnemyDefinitionId = string
export type ItemId = string
export type UpgradeId = string
export type CharacterId = string

/**
 * Numeric identity assigned to every runtime entity (player, enemies,
 * projectiles, pickups, summons, ...). See PLAN.md section 12.
 */
export type EntityId = number

export interface EntityIdAllocator {
  createEntityId(): EntityId
}

/**
 * Creates an incremental entity ID allocator owned by a single game
 * instance. Each `Game` owns its own allocator instead of relying on global
 * module state, so multiple simulations can run independently (for example
 * in headless balance tooling).
 */
export function createEntityIdAllocator(): EntityIdAllocator {
  let nextEntityId = 1

  return {
    createEntityId(): EntityId {
      return nextEntityId++
    },
  }
}
