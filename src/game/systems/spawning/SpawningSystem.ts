import {
  getEnemyDefinition,
  SLIME_DEFINITION_ID,
} from '../../../content/enemies/Enemies'
import {
  getEliteModifierDefinition,
  type EliteModifierId,
} from '../../../content/enemies/EliteModifiers'
import { XP_BALANCE } from '../../../content/progression/XpBalance'
import { GEAR_PICKUP_BALANCE } from '../../../content/gear/GearDrops'
import { BASIC_BOLT_SKILL_ID } from '../../../content/skills/Skills'
import type {
  EnemyDefinitionId,
  EntityId,
  EntityIdAllocator,
} from '../../ids'
import type { SpawnDirector } from '../../spawning/SpawnDirector'
import type {
  EnemyState,
  GameState,
  GearPickupState,
  XpPickupState,
  PlayerState,
} from '../../state/GameState'

export interface WorldPosition {
  x: number
  y: number
}

export function createInitialPlayerState(id: EntityId): PlayerState {
  return {
    id,
    x: 0,
    y: 0,
    radius: 16,
    hp: 100,
    maxHp: 100,
    level: 1,
    xp: 0,
    movementSpeed: 200,
    attackDamage: 10,
    attackSpeed: 1,
    attackRange: 50,
    attackCooldownRemaining: 0,
    baseStats: {
      maxHp: 100,
      movementSpeed: 200,
      attackDamage: 10,
      attackSpeed: 1,
      attackRange: 50,
    },
    statModifiers: [],
    equipment: {},
    targetId: undefined,
    skills: [
      {
        skillId: BASIC_BOLT_SKILL_ID,
        level: 1,
        cooldownRemaining: 0,
      },
    ],
  }
}

export function spawnEnemy(
  state: GameState,
  idAllocator: EntityIdAllocator,
  definitionId: EnemyDefinitionId,
  position: WorldPosition,
  xpRewardOverride?: number,
  eliteModifier?: EliteModifierId,
): EntityId {
  const definition = getEnemyDefinition(definitionId)
  const modifier = eliteModifier
    ? getEliteModifierDefinition(eliteModifier)
    : undefined
  const baseXpReward = xpRewardOverride ?? definition.xpReward
  const xpReward =
    baseXpReward > 0
      ? Math.round(baseXpReward * (modifier?.xpRewardMultiplier ?? 1))
      : baseXpReward
  const maxHp = Math.round(
    definition.maxHp * (modifier?.maxHpMultiplier ?? 1),
  )
  const enemy: EnemyState = {
    id: idAllocator.createEntityId(),
    definitionId: definition.id,
    x: position.x,
    y: position.y,
    radius: definition.radius * (modifier?.radiusMultiplier ?? 1),
    hp: maxHp,
    maxHp,
    speed: definition.speed * (modifier?.speedMultiplier ?? 1),
    contactDamage: definition.contactDamage,
    xpReward,
    ...(modifier ? { eliteModifier: modifier.id } : {}),
    targetId: state.player.id,
  }

  state.enemies.push(enemy)
  return enemy.id
}

export function spawnSlime(
  state: GameState,
  idAllocator: EntityIdAllocator,
  position: WorldPosition,
): EntityId {
  const definition = getEnemyDefinition(SLIME_DEFINITION_ID)
  return spawnEnemy(state, idAllocator, definition.id, position)
}

export function spawnXpPickup(
  state: GameState,
  idAllocator: EntityIdAllocator,
  position: WorldPosition,
  xpAmount: number,
): EntityId {
  const pickup: XpPickupState = {
    id: idAllocator.createEntityId(),
    kind: 'xp',
    x: position.x,
    y: position.y,
    xpAmount,
    radius: XP_BALANCE.pickupRadius,
    attractionRadius: XP_BALANCE.pickupAttractionRadius,
    attractionSpeed: XP_BALANCE.pickupAttractionSpeed,
  }

  state.pickups.push(pickup)
  return pickup.id
}

export function spawnGearPickup(
  state: GameState,
  idAllocator: EntityIdAllocator,
  position: WorldPosition,
  sourceEnemyDefinitionId?: EnemyDefinitionId,
): EntityId {
  const pickup: GearPickupState = {
    id: idAllocator.createEntityId(),
    kind: 'gear',
    x: position.x,
    y: position.y,
    radius: GEAR_PICKUP_BALANCE.radius,
    attractionRadius: GEAR_PICKUP_BALANCE.attractionRadius,
    attractionSpeed: GEAR_PICKUP_BALANCE.attractionSpeed,
    ...(sourceEnemyDefinitionId ? { sourceEnemyDefinitionId } : {}),
  }

  state.pickups.push(pickup)
  state.run.gearDropGenerated = true
  return pickup.id
}

export function updateEnemySpawns(
  state: GameState,
  spawnDirector: SpawnDirector,
  idAllocator: EntityIdAllocator,
  fixedStepSeconds: number,
): void {
  const requests = spawnDirector.update(state, fixedStepSeconds)
  for (const request of requests) {
    spawnEnemy(
      state,
      idAllocator,
      request.definitionId,
      request,
      undefined,
      request.eliteModifier,
    )
  }
}
