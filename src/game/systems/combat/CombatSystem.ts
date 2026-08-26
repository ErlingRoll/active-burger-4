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
import {
  createEnemySpatialHash,
  findNearestEnemy,
} from '../../combat/Targeting'
import {
  getSplitChildren,
  updateEnemyBehavior,
} from './EnemyBehaviors'
import type { ChildSpawnRequest } from './EnemyBehaviors'
import type {
  DamageEvent,
  BossState,
  EnemyState,
  GameState,
  ProjectileState,
} from '../../state/GameState'
import { getDerivedPlayerStats } from '../../stats/DerivedStats'
import {
  getGearDropChance,
  GEAR_DROP_FORCE_KILL_COUNT,
} from '../../../content/gear/GearDrops'
import type { RandomSource } from '../../random/Random'

const ENEMY_CONTACT_DAMAGE_INTERVAL_SECONDS = 1

export function updateEnemyChase(
  state: GameState,
  fixedStepSeconds: number,
): void {
  for (const enemy of state.enemies) {
    updateEnemyBehavior(state, enemy, fixedStepSeconds)
  }
}

/**
 * Emits at most one contact hit per enemy each second. This keeps sustained
 * melee pressure readable while preserving fixed-step deterministic damage.
 */
export function collectEnemyContactDamage(
  state: GameState,
  fixedStepSeconds: number,
): DamageEvent[] {
  const events: DamageEvent[] = []
  const elapsed = Math.max(0, fixedStepSeconds)

  for (const enemy of [...state.enemies].sort((left, right) => left.id - right.id)) {
    if (enemy.hp <= 0) {
      continue
    }

    const cooldown = Math.max(
      0,
      (enemy.contactCooldownRemaining ?? 0) - elapsed,
    )
    enemy.contactCooldownRemaining = cooldown
    const contactDistance = state.player.radius + enemy.radius
    const distanceSquared =
      (enemy.x - state.player.x) ** 2 + (enemy.y - state.player.y) ** 2
    if (
      cooldown > 0 ||
      distanceSquared > contactDistance * contactDistance ||
      enemy.contactDamage <= 0
    ) {
      continue
    }

    events.push({
      sourceId: enemy.id,
      targetId: state.player.id,
      amount: enemy.contactDamage,
      damageType: 'physical',
    })
    enemy.contactCooldownRemaining = ENEMY_CONTACT_DAMAGE_INTERVAL_SECONDS
  }

  return events
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

export function resolvePlayerTarget(
  state: GameState,
  enemySpatialHash = createEnemySpatialHash(state),
): void {
  const player = state.player
  const stats = getDerivedPlayerStats(player)
  const engagementRange = stats.attackRange + player.radius
  const currentTarget = findLivingTarget(state, player.targetId)
  const currentTargetInRange = currentTarget !== undefined &&
    distanceSquared(player.x, player.y, currentTarget.x, currentTarget.y) <=
      engagementRange * engagementRange
  const target = currentTargetInRange
    ? currentTarget
    : findNearestEnemy(
        {
          originX: player.x,
          originY: player.y,
          maxRange: engagementRange,
        },
        state,
        enemySpatialHash,
      )

  player.targetId = target?.id
}

function findLivingTarget(
  state: GameState,
  targetId: number | undefined,
): EnemyState | BossState | undefined {
  if (targetId === undefined) {
    return undefined
  }
  return state.enemies.find((enemy) => enemy.id === targetId && enemy.hp > 0) ??
    state.bosses?.find((boss) => boss.id === targetId && boss.hp > 0)
}

function distanceSquared(
  leftX: number,
  leftY: number,
  rightX: number,
  rightY: number,
): number {
  return (leftX - rightX) ** 2 + (leftY - rightY) ** 2
}

export function spawnBasicBoltIfReady(
  state: GameState,
  idAllocator: EntityIdAllocator,
): void {
  const player = state.player
  const stats = getDerivedPlayerStats(player)
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
  ) ?? state.bosses?.find(
    (boss) => boss.id === targetId && boss.hp > 0,
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
    skillId: BASIC_BOLT_SKILL_ID,
    x: player.x,
    y: player.y,
    velocityX: directionX * definition.speed,
    velocityY: directionY * definition.speed,
    radius: definition.radius,
    damage: stats.attackDamage + getSkillDamage(skillDefinition, basicBolt.level) -
      skillDefinition.baseDamage,
    remainingLifetime: definition.lifetime,
  }

  state.projectiles.push(projectile)
  player.attackCooldownRemaining =
    stats.attackSpeed > 0 ? 1 / stats.attackSpeed : Number.POSITIVE_INFINITY
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

export function collectProjectileDamage(
  state: GameState,
  enemies = createEnemySpatialHash(state),
): DamageEvent[] {
  const damageEvents: DamageEvent[] = []
  const projectiles = [...state.projectiles].sort(
    (left, right) => left.id - right.id,
  )
  for (const projectile of projectiles) {
    if (projectile.remainingLifetime <= 0) {
      continue
    }

    let hitEnemy: EnemyState | BossState | undefined
    let hitDistanceSquared = Number.POSITIVE_INFINITY

    for (const enemy of enemies.queryRadius(
      projectile.x,
      projectile.y,
      projectile.radius,
    )) {
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
    if (event.targetId === state.player.id) {
      state.player.hp = Math.max(0, state.player.hp - Math.max(0, event.amount))
      continue
    }
    const enemy = state.enemies.find(
      (candidate) => candidate.id === event.targetId && candidate.hp > 0,
    )
    if (enemy) {
      enemy.hp = Math.max(0, enemy.hp - Math.max(0, event.amount))
      continue
    }
    const boss = state.bosses?.find(
      (candidate) => candidate.id === event.targetId && candidate.hp > 0,
    )
    if (boss) {
      boss.hp = Math.max(0, boss.hp - Math.max(0, event.amount))
    }
  }
}

export function removeDeadEntities(
  state: GameState,
  spawnPickup: (position: { x: number; y: number }, xpAmount: number) => void,
  spawnEnemy?: (
    definitionId: string,
    position: { x: number; y: number },
    xpRewardOverride?: number,
  ) => void,
  spawnGearPickup?: (
    position: { x: number; y: number },
    sourceEnemyDefinitionId: string,
  ) => void,
  random?: RandomSource,
): void {
  const livingEnemies: EnemyState[] = []
  const childSpawns: ChildSpawnRequest[] = []
  let killCount = 0
  for (const enemy of state.enemies) {
    if (enemy.hp > 0) {
      livingEnemies.push(enemy)
    } else {
      killCount += 1
      // Create the drop before removing the enemy so every observed death
      // produces exactly one pickup during this cleanup pass.
      if (enemy.xpReward > 0) {
        spawnPickup({ x: enemy.x, y: enemy.y }, enemy.xpReward)
      }
      const killNumber = state.run.killCount + killCount
      const forceGearDrop =
        killNumber === GEAR_DROP_FORCE_KILL_COUNT &&
        state.run.gearDropGenerated !== true
      const randomGearDrop =
        !forceGearDrop &&
        (random?.chance(
          getGearDropChance(enemy.definitionId, enemy.eliteModifier),
        ) ?? false)
      if (forceGearDrop || randomGearDrop) {
        state.run.gearDropGenerated = true
        spawnGearPickup?.(
          { x: enemy.x, y: enemy.y },
          enemy.definitionId,
        )
      }
      childSpawns.push(...getSplitChildren(enemy))
    }
  }
  state.enemies = livingEnemies
  state.run.killCount += killCount
  if (spawnEnemy) {
    for (const child of childSpawns) {
      spawnEnemy(
        child.definitionId,
        { x: child.x, y: child.y },
        child.xpRewardOverride,
      )
    }
  }
  state.projectiles = state.projectiles.filter(
    (projectile) => projectile.remainingLifetime > 0,
  )
}
