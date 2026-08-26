import {
  BASIC_BOLT_DEFINITION_ID,
  getProjectileDefinition,
} from '../../../content/projectiles/Projectiles'
import {
  BASIC_BOLT_SKILL_ID,
  getSkillDamage,
  getSkillDefinition,
} from '../../../content/skills/Skills'
import type { EntityIdAllocator } from '../../ids'
import { findNearestEnemy } from '../../combat/Targeting'
import type {
  DamageEvent,
  EnemyState,
  GameState,
  ProjectileState,
} from '../../state/GameState'

export function updateEnemyChase(
  state: GameState,
  fixedStepSeconds: number,
): void {
  const player = state.player

  for (const enemy of state.enemies) {
    const offsetX = player.x - enemy.x
    const offsetY = player.y - enemy.y
    const distance = Math.hypot(offsetX, offsetY)
    const contactRange = player.radius + enemy.radius
    const travelDistance = enemy.speed * fixedStepSeconds

    if (distance <= contactRange || distance === 0) {
      continue
    }

    const distanceToContact = distance - contactRange
    const movementDistance = Math.min(travelDistance, distanceToContact)
    const movementRatio = movementDistance / distance

    enemy.x += offsetX * movementRatio
    enemy.y += offsetY * movementRatio
  }
}

export function updateAttackCooldown(
  state: GameState,
  fixedStepSeconds: number,
): void {
  const player = state.player
  const basicBolt = player.skills.find(
    (skill) => skill.skillId === BASIC_BOLT_SKILL_ID,
  )
  player.attackCooldownRemaining = Math.max(
    0,
    player.attackCooldownRemaining - fixedStepSeconds,
  )
  if (basicBolt) {
    basicBolt.cooldownRemaining = player.attackCooldownRemaining
  }
}

export function resolvePlayerTarget(state: GameState): void {
  const player = state.player
  const target = findNearestEnemy(
    {
      originX: player.x,
      originY: player.y,
      maxRange: player.attackRange,
    },
    state,
  )

  player.targetId = target?.id
}

export function spawnBasicBoltIfReady(
  state: GameState,
  idAllocator: EntityIdAllocator,
): void {
  const player = state.player
  const targetId = player.targetId
  const basicBolt = player.skills.find(
    (skill) => skill.skillId === BASIC_BOLT_SKILL_ID,
  )

  if (
    targetId === undefined ||
    player.attackCooldownRemaining > 0 ||
    !basicBolt
  ) {
    return
  }

  const target = state.enemies.find(
    (enemy) => enemy.id === targetId && enemy.hp > 0,
  )
  if (!target) {
    player.targetId = undefined
    return
  }

  const skillDefinition = getSkillDefinition(BASIC_BOLT_SKILL_ID)
  const definition = getProjectileDefinition(
    skillDefinition.projectileDefinitionId ?? BASIC_BOLT_DEFINITION_ID,
  )
  const offsetX = target.x - player.x
  const offsetY = target.y - player.y
  const distance = Math.hypot(offsetX, offsetY)
  const directionX = distance === 0 ? 0 : offsetX / distance
  const directionY = distance === 0 ? 0 : offsetY / distance

  const projectile: ProjectileState = {
    id: idAllocator.createEntityId(),
    ownerId: player.id,
    definitionId: definition.id,
    x: player.x,
    y: player.y,
    velocityX: directionX * definition.speed,
    velocityY: directionY * definition.speed,
    radius: definition.radius,
    damage: player.attackDamage + getSkillDamage(skillDefinition, basicBolt.level) -
      skillDefinition.baseDamage,
    remainingLifetime: definition.lifetime,
  }

  state.projectiles.push(projectile)
  player.attackCooldownRemaining =
    player.attackSpeed > 0 ? 1 / player.attackSpeed : Number.POSITIVE_INFINITY
  basicBolt.cooldownRemaining = player.attackCooldownRemaining
}

export function updateProjectiles(
  state: GameState,
  fixedStepSeconds: number,
): void {
  for (const projectile of state.projectiles) {
    projectile.x += projectile.velocityX * fixedStepSeconds
    projectile.y += projectile.velocityY * fixedStepSeconds
    projectile.remainingLifetime -= fixedStepSeconds
  }
}

export function collectProjectileDamage(state: GameState): DamageEvent[] {
  const damageEvents: DamageEvent[] = []
  const projectiles = [...state.projectiles].sort(
    (left, right) => left.id - right.id,
  )
  const enemies = [...state.enemies]
    .filter((enemy) => enemy.hp > 0)
    .sort((left, right) => left.id - right.id)

  for (const projectile of projectiles) {
    if (projectile.remainingLifetime <= 0) {
      continue
    }

    let hitEnemy: EnemyState | undefined
    let hitDistanceSquared = Number.POSITIVE_INFINITY

    for (const enemy of enemies) {
      const offsetX = enemy.x - projectile.x
      const offsetY = enemy.y - projectile.y
      const collisionDistance = enemy.radius + projectile.radius
      const distanceSquared = offsetX * offsetX + offsetY * offsetY

      if (distanceSquared > collisionDistance * collisionDistance) {
        continue
      }

      if (
        distanceSquared < hitDistanceSquared ||
        (distanceSquared === hitDistanceSquared &&
          (hitEnemy === undefined || enemy.id < hitEnemy.id))
      ) {
        hitEnemy = enemy
        hitDistanceSquared = distanceSquared
      }
    }

    if (hitEnemy) {
      damageEvents.push({
        sourceId: projectile.ownerId,
        sourceSkillId: BASIC_BOLT_SKILL_ID,
        targetId: hitEnemy.id,
        amount: projectile.damage,
        damageType: 'physical',
      })
      projectile.remainingLifetime = 0
    }
  }

  return damageEvents.sort((left, right) => {
    const targetOrder = left.targetId - right.targetId
    if (targetOrder !== 0) {
      return targetOrder
    }

    const leftSourceId = left.sourceId ?? Number.MAX_SAFE_INTEGER
    const rightSourceId = right.sourceId ?? Number.MAX_SAFE_INTEGER
    return leftSourceId - rightSourceId
  })
}

export function applyDamageEvents(
  state: GameState,
  events: readonly DamageEvent[],
): void {
  for (const event of events) {
    const enemy = state.enemies.find(
      (candidate) => candidate.id === event.targetId && candidate.hp > 0,
    )
    if (!enemy) {
      continue
    }

    enemy.hp = Math.max(0, enemy.hp - Math.max(0, event.amount))
  }
}

export function removeDeadEntities(
  state: GameState,
  spawnPickup: (position: { x: number; y: number }, xpAmount: number) => void,
): void {
  const livingEnemies: EnemyState[] = []
  let killCount = 0
  for (const enemy of state.enemies) {
    if (enemy.hp > 0) {
      livingEnemies.push(enemy)
    } else {
      killCount += 1
      // Create the drop before removing the enemy so every observed death
      // produces exactly one pickup during this cleanup pass.
      spawnPickup({ x: enemy.x, y: enemy.y }, enemy.xpReward)
    }
  }
  state.enemies = livingEnemies
  state.run.killCount += killCount
  state.projectiles = state.projectiles.filter(
    (projectile) => projectile.remainingLifetime > 0,
  )
}
