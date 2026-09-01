import {
  getEnemyAbilityDefinition,
  getEnemyAbilityForDefinition,
  type EnemyAbilityId,
  type EnemyAbilityDefinition,
} from '../../../content/enemies/EnemyAbilities'
import {
  getFloorStatMultiplier,
  getFloorDifficultyProfile,
} from '../../../content/dungeons/Dungeons'
import {
  getProjectileDefinition,
} from '../../../content/projectiles/Projectiles'
import {
  getPostSpawnDamageMultiplier,
} from '../../../content/enemies/EnemyAcceleration'
import { createDamageValues } from '../../../content/stats/Damage'
import {
  createMonsterDamageProfile,
} from '../../combat/DamageSources'
import {
  getEnemyCombatTarget,
} from './EnemyBehaviors'
import type { EntityIdAllocator } from '../../ids'
import type {
  DamageEvent,
  EnemyState,
  GameState,
  ProjectileState,
  TelegraphState,
} from '../../state/GameState'

const MIN_ENEMY_ABILITY_TELEGRAPH_SECONDS = 0.35
const MAX_ENEMY_ABILITY_INTENSITY = 1.2

function getEnemyAbilityTelegraphDuration(
  definition: EnemyAbilityDefinition,
  intensity: number,
): number {
  const normalizedIntensity = Math.min(
    MAX_ENEMY_ABILITY_INTENSITY,
    Math.max(0, intensity),
  )
  return Math.max(
    MIN_ENEMY_ABILITY_TELEGRAPH_SECONDS,
    definition.telegraphDuration * (1.15 - normalizedIntensity * 0.15),
  )
}

function getEnemyAbilityDamage(
  enemy: Readonly<EnemyState>,
  definition: EnemyAbilityDefinition,
  state: Readonly<GameState>,
): ReturnType<typeof createMonsterDamageProfile> {
  const profile = getFloorDifficultyProfile(state.run.floor ?? 1)
  const floorStatMultiplier = getFloorStatMultiplier(state.run.floor ?? 1)
  const postSpawnDamageMultiplier = getPostSpawnDamageMultiplier(
    state.time,
    enemy.spawnTime,
  )
  return createMonsterDamageProfile(
    createDamageValues({
      [definition.damageType]: definition.damage *
        floorStatMultiplier *
        profile.abilityDamageMultiplier *
        postSpawnDamageMultiplier,
    }),
    enemy,
  )
}

function hasActiveEnemyTelegraph(
  state: Readonly<GameState>,
  enemyId: number,
): boolean {
  return (state.telegraphs ?? []).some(
    (telegraph) =>
      telegraph.sourceKind === 'enemy' &&
      telegraph.sourceId === enemyId &&
      telegraph.remainingDuration > 0,
  )
}

function createEnemyAbilityTelegraph(
  state: GameState,
  allocator: EntityIdAllocator,
  enemy: EnemyState,
  definition: EnemyAbilityDefinition,
  target: ReturnType<typeof getEnemyCombatTarget>,
): TelegraphState {
  const profile = getFloorDifficultyProfile(state.run.floor ?? 1)
  const damage = getEnemyAbilityDamage(enemy, definition, state)
  const points = definition.kind === 'projectile'
    ? [
        { x: enemy.x, y: enemy.y },
        { x: target.x, y: target.y },
      ]
    : [{ x: enemy.x, y: enemy.y }]
  const telegraphDuration = getEnemyAbilityTelegraphDuration(
    definition,
    profile.abilityIntensity,
  )
  return {
    id: allocator.createEntityId(),
    sourceId: enemy.id,
    targetId: target.id,
    sourceKind: 'enemy',
    skillId: definition.id,
    kind: definition.kind === 'projectile'
      ? 'enemy-projectile'
      : 'enemy-shockwave',
    x: enemy.x,
    y: enemy.y,
    radius: definition.radius,
    remainingDuration: telegraphDuration,
    duration: telegraphDuration,
    points,
    damage: damage.damage,
    criticalStrike: damage.criticalStrike,
    ...(damage.poisonApplication
      ? { poisonApplication: damage.poisonApplication }
      : {}),
    ...(definition.projectileDefinitionId
      ? { projectileDefinitionId: definition.projectileDefinitionId }
      : {}),
  }
}

export function updateEnemyAbilities(
  state: GameState,
  allocator: EntityIdAllocator,
  fixedStepSeconds: number,
): void {
  const elapsed = Math.max(0, fixedStepSeconds)
  updateEnemyTelegraphPositions(state)
  const floorProfile = getFloorDifficultyProfile(state.run.floor ?? 1)
  for (const enemy of [...state.enemies].sort((left, right) => left.id - right.id)) {
    if (enemy.hp <= 0) {
      continue
    }
    const definition = getEnemyAbilityForDefinition(enemy.definitionId)
    if (!definition || floorProfile.abilityIntensity <= 0) {
      continue
    }
    enemy.abilityCooldownRemaining = Math.max(
      0,
      (enemy.abilityCooldownRemaining ?? 0) - elapsed,
    )
    if (
      enemy.abilityCooldownRemaining > 0 ||
      hasActiveEnemyTelegraph(state, enemy.id)
    ) {
      continue
    }

    const target = getEnemyCombatTarget(state, enemy)
    const distance = Math.hypot(target.x - enemy.x, target.y - enemy.y)
    if (distance > definition.range + target.radius) {
      continue
    }

    state.telegraphs ??= []
    state.telegraphs.push(
      createEnemyAbilityTelegraph(state, allocator, enemy, definition, target),
    )
    enemy.abilityCooldownRemaining =
      definition.cooldown * floorProfile.abilityCooldownMultiplier
  }
}

function findProjectileTarget(
  state: Readonly<GameState>,
  targetId: number | undefined,
): GameState['player'] | GameState['summons'][number] | undefined {
  if (targetId === state.player.id) {
    return state.player
  }
  return state.summons.find((summon) => summon.id === targetId && summon.hp > 0)
}

export function updateEnemyTelegraphPositions(state: GameState): void {
  for (const telegraph of state.telegraphs ?? []) {
    if (telegraph.sourceKind !== 'enemy' || telegraph.kind !== 'enemy-projectile') {
      continue
    }
    const enemy = state.enemies.find(
      (candidate) => candidate.id === telegraph.sourceId && candidate.hp > 0,
    )
    const target = findProjectileTarget(state, telegraph.targetId)
    if (!enemy || !target) {
      continue
    }
    telegraph.x = enemy.x
    telegraph.y = enemy.y
    telegraph.points = [
      { x: enemy.x, y: enemy.y },
      { x: target.x, y: target.y },
    ]
  }
}

function createEnemyProjectile(
  state: GameState,
  allocator: EntityIdAllocator,
  telegraph: TelegraphState,
  enemy: EnemyState,
  ability: EnemyAbilityDefinition,
): ProjectileState | undefined {
  if (!telegraph.projectileDefinitionId) {
    return undefined
  }
  const target = findProjectileTarget(state, telegraph.targetId)
  if (!target) {
    return undefined
  }
  const definition = getProjectileDefinition(telegraph.projectileDefinitionId)
  const directionX = target.x - enemy.x
  const directionY = target.y - enemy.y
  const distance = Math.hypot(directionX, directionY)
  const normalizedX = distance > 0.0001 ? directionX / distance : 1
  const normalizedY = distance > 0.0001 ? directionY / distance : 0
  return {
    id: allocator.createEntityId(),
    ownerId: enemy.id,
    definitionId: definition.id,
    hostile: true,
    sourceAbilityId: ability.id,
    targetId: target.id,
    x: enemy.x,
    y: enemy.y,
    velocityX: normalizedX * definition.speed,
    velocityY: normalizedY * definition.speed,
    radius: definition.radius,
    damage: telegraph.damage,
    criticalStrike: telegraph.criticalStrike,
    ...(telegraph.poisonApplication
      ? { impactPoisonApplication: telegraph.poisonApplication }
      : {}),
    remainingLifetime: definition.lifetime,
  }
}

export function resolveEnemyTelegraphs(
  state: GameState,
  allocator: EntityIdAllocator,
): DamageEvent[] {
  const events: DamageEvent[] = []
  const remaining: TelegraphState[] = []
  for (const telegraph of [...(state.telegraphs ?? [])].sort(
    (left, right) => left.id - right.id,
  )) {
    if (telegraph.sourceKind !== 'enemy') {
      remaining.push(telegraph)
      continue
    }
    if (telegraph.remainingDuration > 0) {
      remaining.push(telegraph)
      continue
    }
    if (telegraph.skillId === 'elite-volatile') {
      const enemy = state.enemies.find(
        (candidate) => candidate.id === telegraph.sourceId,
      )
      if (enemy) {
        enemy.volatileExplosionResolved = true
      }
      const targets = [state.player, ...state.summons].filter(
        (target) => target.hp > 0,
      )
      for (const target of targets) {
        const distance = Math.hypot(target.x - telegraph.x, target.y - telegraph.y)
        const targetRadius = target.id === state.player.id ? state.player.radius : 13
        if (distance <= telegraph.radius + targetRadius) {
          events.push({
            sourceId: telegraph.sourceId,
            targetId: target.id,
            damage: telegraph.damage,
            sourceLabel: 'Volatile Explosion',
          })
        }
      }
      continue
    }
    const enemy = state.enemies.find(
      (candidate) => candidate.id === telegraph.sourceId && candidate.hp > 0,
    )
    if (!enemy) {
      continue
    }
    const abilityId = isEnemyAbilityId(telegraph.skillId)
      ? telegraph.skillId
      : undefined
    if (!abilityId) {
      continue
    }
    const ability = getEnemyAbilityDefinition(abilityId)
    if (telegraph.kind === 'enemy-projectile') {
      const projectile = createEnemyProjectile(
        state,
        allocator,
        telegraph,
        enemy,
        ability,
      )
      if (projectile) {
        state.projectiles.push(projectile)
      }
      continue
    }

    const targets = [state.player, ...state.summons].filter(
      (target) => target.hp > 0,
    )
    for (const target of targets) {
      const distance = Math.hypot(target.x - telegraph.x, target.y - telegraph.y)
      const targetRadius = target.id === state.player.id ? state.player.radius : 13
      if (distance > telegraph.radius + targetRadius) {
        continue
      }
      events.push({
        sourceId: telegraph.sourceId,
        targetId: target.id,
        damage: telegraph.damage,
        criticalStrike: telegraph.criticalStrike,
        ...(telegraph.poisonApplication
          ? { poisonApplication: telegraph.poisonApplication }
          : {}),
        sourceLabel: ability.name,
      })
    }
  }
  state.telegraphs = remaining
  return events
}

function isEnemyAbilityId(
  value: TelegraphState['skillId'],
): value is EnemyAbilityId {
  return value === 'archer-shot' || value === 'brute-shockwave'
}
