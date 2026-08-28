import {
  getProjectileDefinition,
  PLAYER_PROJECTILE_CHAIN_RANGE,
} from '../../../content/projectiles/Projectiles'
import {
  BASIC_ATTACK_SKILL_ID,
  FIERY_TOUCH_SKILL_ID,
  getEffectiveSkillCooldown,
  getBasicAttackVariant,
  getSkillDefinition,
  getSkillDamage,
  isSkillId,
  WHIRLWIND_SKILL_ID,
  type SkillTag,
} from '../../../content/skills/Skills'
import {
  getSkillCooldownReductionPercent,
  getSkillDamageIncreasePercent,
} from '../../../content/upgrades/Upgrades'
import {
  DAMAGE_TYPES,
  createDamageValues,
  isCriticalStrike,
  mitigateDamageValues,
  normalizeCriticalStrikeStats,
  scaleDamageValues,
  sumDamageValues,
  type DamageResistanceValues,
  type DamageValues,
} from '../../../content/stats/Damage'
import { getEnemyDefinition } from '../../../content/enemies/Enemies'
import { getBossDefinition } from '../../../content/bosses/Bosses'
import type { EntityIdAllocator } from '../../ids'
import {
  createEnemySpatialHash,
  findNearestEnemy,
} from '../../combat/Targeting'
import {
  createMonsterDamageEvent,
  createPlayerDamageProfileFromStats,
} from '../../combat/DamageSources'
import {
  healPlayer,
  recordPlayerDamage,
} from '../../combat/PlayerCombatLog'
import { getEquippedWeaponArchetype } from '../../equipment/EquipmentState'
import {
  getSplitChildren,
  getEnemyCombatTarget,
  updateEnemyBehavior,
} from './EnemyBehaviors'
import type { ChildSpawnRequest } from './EnemyBehaviors'
import type {
  DamageEvent,
  BossState,
  EnemyState,
  GameState,
  ProjectileState,
  SkillEffectPoint,
  SkillEffectState,
} from '../../state/GameState'
import { getDerivedPlayerStats } from '../../stats/DerivedStats'
import { getGearDropChance } from '../../../content/gear/GearDrops'
import { resolveWorldModifierEffects } from '../../../content/modifiers/WorldModifiers'
import { SPAWN_BALANCE } from '../../../content/spawning/SpawnBalance'
import type { RandomSource } from '../../random/Random'
import {
  HEALING_POTION_ELITE_DROP_CHANCE,
  HEALING_POTION_ORDINARY_DROP_CHANCE,
} from '../../../content/progression/HealingPotions'

const ENEMY_CONTACT_DAMAGE_INTERVAL_SECONDS = 1
const DEGREES_TO_RADIANS = Math.PI / 180

interface Vector2 {
  x: number
  y: number
}

interface ResolvedDamage {
  mitigated: DamageValues
  preMitigation: DamageValues
}

function normalizeVector(x: number, y: number): Vector2 {
  const length = Math.hypot(x, y)
  if (length <= 0.0001) {
    return { x: 1, y: 0 }
  }
  return { x: x / length, y: y / length }
}

function rotateVector(vector: Vector2, angleRadians: number): Vector2 {
  const cosine = Math.cos(angleRadians)
  const sine = Math.sin(angleRadians)
  return {
    x: vector.x * cosine - vector.y * sine,
    y: vector.x * sine + vector.y * cosine,
  }
}

function normalizeAngle(angleRadians: number): number {
  let angle = angleRadians
  while (angle <= -Math.PI) {
    angle += Math.PI * 2
  }
  while (angle > Math.PI) {
    angle -= Math.PI * 2
  }
  return angle
}

function createBasicAttackCooldown(attackSpeed: number): number {
  return attackSpeed > 0 ? 1 / attackSpeed : Number.POSITIVE_INFINITY
}

function setBasicAttackCooldown(
  state: GameState,
  cooldown: number,
): void {
  state.player.attackCooldownRemaining = cooldown
  const basicAttack = state.player.skills.find(
    (skill) => skill.skillId === BASIC_ATTACK_SKILL_ID,
  )
  if (basicAttack) {
    basicAttack.cooldownRemaining = cooldown
    basicAttack.castCount = (basicAttack.castCount ?? 0) + 1
  }
}

function scaleAreaValue(
  value: number,
  areaOfEffect: number,
): number {
  return value * (1 + Math.max(0, areaOfEffect) / 100)
}

function isPlayerOwnedDirectHit(
  state: Readonly<GameState>,
  event: Readonly<DamageEvent>,
): boolean {
  if (
    event.damageOverTime ||
    event.sourceSkillId === FIERY_TOUCH_SKILL_ID ||
    event.sourceId === undefined
  ) {
    return false
  }
  return event.sourceId === state.player.id ||
    state.summons.some(
      (summon) => summon.id === event.sourceId && summon.ownerId === state.player.id,
    )
}

function collectFieryTouchTriggerEvents(
  state: GameState,
  hitX: number,
  hitY: number,
  idAllocator?: EntityIdAllocator,
): DamageEvent[] {
  const skill = state.player.skills.find(
    (candidate) => candidate.skillId === FIERY_TOUCH_SKILL_ID,
  )
  if (!skill || skill.cooldownRemaining > 0) {
    return []
  }

  const definition = getSkillDefinition(FIERY_TOUCH_SKILL_ID)
  const playerStats = getDerivedPlayerStats(state.player)
  const cooldownReduction = playerStats.cooldownReduction +
    getSkillCooldownReductionPercent(
      FIERY_TOUCH_SKILL_ID,
      state.run.selectedUpgradeIds,
    )
  const radius = scaleAreaValue(definition.radius ?? 0, playerStats.areaOfEffect)
  const outgoingDamage = createPlayerDamageProfileFromStats(
    playerStats,
    getSkillDamage(definition, skill.level),
    { sourceTags: definition.tags },
  )
  const events = [...state.enemies, ...(state.bosses ?? [])]
    .filter((enemy) => enemy.hp > 0)
    .sort((left, right) => left.id - right.id)
    .flatMap((enemy) => {
      const distance = Math.hypot(enemy.x - hitX, enemy.y - hitY)
      return distance <= radius + enemy.radius
        ? [{
            sourceId: state.player.id,
            sourceSkillId: FIERY_TOUCH_SKILL_ID,
            sourceTags: definition.tags,
            targetId: enemy.id,
            damage: outgoingDamage.damage,
            criticalStrike: outgoingDamage.criticalStrike,
          }]
        : []
    })

  skill.cooldownRemaining = getEffectiveSkillCooldown(
    definition.cooldown,
    cooldownReduction,
  )
  if (idAllocator) {
    state.effects.push({
      id: idAllocator.createEntityId(),
      skillId: FIERY_TOUCH_SKILL_ID,
      x: hitX,
      y: hitY,
      radius,
      lifetime: definition.effectLifetime,
      remainingLifetime: definition.effectLifetime,
      points: [{ x: hitX, y: hitY }],
    })
  }
  return events
}

function scaleSwordArcDegrees(
  baseArcDegrees: number,
  areaOfEffect: number,
): number {
  return Math.min(180, baseArcDegrees * (1 + Math.max(0, areaOfEffect) / 200))
}

function getBasicAttackEngagementRange(
  state: Readonly<GameState>,
): number {
  const stats = getDerivedPlayerStats(state.player)
  const variant = getBasicAttackVariant(getEquippedWeaponArchetype(state.player))
  const attackRange = variant.kind === 'area' && variant.areaShape !== 'circle'
    ? scaleAreaValue(stats.attackRange, stats.areaOfEffect)
    : stats.attackRange
  return attackRange + state.player.radius
}

function buildArcEffectPoints(
  originX: number,
  originY: number,
  facingAngle: number,
  range: number,
  arcRadians: number,
): SkillEffectPoint[] {
  const points: SkillEffectPoint[] = [{ x: originX, y: originY }]
  const steps = 6
  const start = facingAngle - arcRadians / 2
  const step = arcRadians / steps
  for (let index = 0; index <= steps; index += 1) {
    const angle = start + step * index
    points.push({
      x: originX + Math.cos(angle) * range,
      y: originY + Math.sin(angle) * range,
    })
  }
  return points
}

function createBasicAttackEffect(
  state: GameState,
  allocator: EntityIdAllocator,
  effect: Omit<SkillEffectState, 'id'>,
): void {
  state.effects.push({
    id: allocator.createEntityId(),
    ...effect,
  })
}

function getBasicAttackTarget(
  state: GameState,
): EnemyState | BossState | undefined {
  return findLivingTarget(state, state.player.targetId)
}

function createProjectileSpreadAngles(
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

function resolveProjectileTarget(
  state: Readonly<GameState>,
  projectile: Readonly<ProjectileState>,
  retargetRange: number,
  enemies = createEnemySpatialHash(state),
): EnemyState | BossState | undefined {
  const trackedTarget = findLivingTarget(state, projectile.targetId)
  if (trackedTarget) {
    return trackedTarget
  }
  return findNearestEnemy(
    {
      originX: projectile.x,
      originY: projectile.y,
      maxRange: retargetRange,
      excludeTargetId: projectile.lastHitTargetId,
    },
    state,
    enemies,
  )
}

function steerProjectileTowardTarget(
  projectile: ProjectileState,
  target: Readonly<EnemyState | BossState>,
  maxTurnRadians: number,
  speed: number,
): void {
  const currentDirection = normalizeVector(projectile.velocityX, projectile.velocityY)
  const desiredDirection = normalizeVector(
    target.x - projectile.x,
    target.y - projectile.y,
  )
  const currentAngle = Math.atan2(currentDirection.y, currentDirection.x)
  const desiredAngle = Math.atan2(desiredDirection.y, desiredDirection.x)
  const angleDelta = normalizeAngle(desiredAngle - currentAngle)
  const nextAngle = currentAngle + Math.max(
    -maxTurnRadians,
    Math.min(maxTurnRadians, angleDelta),
  )
  projectile.velocityX = Math.cos(nextAngle) * speed
  projectile.velocityY = Math.sin(nextAngle) * speed
}

function createBasicAttackProjectileState(
  state: Readonly<GameState>,
  idAllocator: EntityIdAllocator,
  target: Readonly<EnemyState | BossState>,
): ProjectileState[] {
  const player = state.player
  const stats = getDerivedPlayerStats(player)
  const skillDefinition = getSkillDefinition(BASIC_ATTACK_SKILL_ID)
  const variant = getBasicAttackVariant(getEquippedWeaponArchetype(player))
  const projectileDefinition = getProjectileDefinition(
    variant.projectileDefinitionId ?? skillDefinition.projectileDefinitionId!,
  )
  const toTarget = normalizeVector(target.x - player.x, target.y - player.y)
  const skillLevel = player.skills.find(
    (skill) => skill.skillId === BASIC_ATTACK_SKILL_ID,
  )?.level ?? 1
  const baseDamage = getSkillDamage(skillDefinition, skillLevel)
  baseDamage.physical += stats.attackDamage
  const outgoingDamage = createPlayerDamageProfileFromStats(
    stats,
    baseDamage,
    {
      isProjectile: true,
      sourceTags: [...variant.tags],
      additionalIncreasedDamage: {
        global: getSkillDamageIncreasePercent(
          BASIC_ATTACK_SKILL_ID,
          skillLevel,
        ),
      },
    },
  )
  const extraProjectiles = Math.min(
    variant.maxExtraProjectiles ?? 0,
    Math.max(0, Math.trunc(stats.basicAttackExtraProjectiles)),
  )
  const remainingChains = Math.max(0, Math.trunc(stats.projectileChains))
  const projectileCount = 1 + extraProjectiles
  const spreadAngles = createProjectileSpreadAngles(
    projectileCount,
    variant.spreadDegrees ?? 0,
  )
  return spreadAngles.map((spreadAngle) => {
    const direction = rotateVector(toTarget, spreadAngle)
    return {
      id: idAllocator.createEntityId(),
      ownerId: player.id,
      definitionId: projectileDefinition.id,
      skillId: BASIC_ATTACK_SKILL_ID,
      targetId: target.id,
      sourceTags: [...variant.tags],
      basicAttackWeaponArchetype: variant.id,
      remainingChains,
      chainRange: remainingChains > 0
        ? scaleAreaValue(PLAYER_PROJECTILE_CHAIN_RANGE, stats.areaOfEffect)
        : undefined,
      x: player.x,
      y: player.y,
      velocityX: direction.x * projectileDefinition.speed,
      velocityY: direction.y * projectileDefinition.speed,
      radius: projectileDefinition.radius,
      damage: outgoingDamage.damage,
      criticalStrike: outgoingDamage.criticalStrike,
      remainingLifetime: projectileDefinition.lifetime,
    }
  })
}

function canProjectileChain(
  state: Readonly<GameState>,
  projectile: Readonly<ProjectileState>,
): boolean {
  return projectile.ownerId === state.player.id &&
    (projectile.remainingChains ?? 0) > 0 &&
    (projectile.chainRange ?? 0) > 0
}

function relaunchProjectileTowardTarget(
  projectile: ProjectileState,
  hitTarget: Readonly<EnemyState | BossState>,
  nextTarget: Readonly<EnemyState | BossState>,
): void {
  const definition = getProjectileDefinition(projectile.definitionId)
  const direction = normalizeVector(
    nextTarget.x - hitTarget.x,
    nextTarget.y - hitTarget.y,
  )
  projectile.x = hitTarget.x
  projectile.y = hitTarget.y
  projectile.targetId = nextTarget.id
  projectile.lastHitTargetId = hitTarget.id
  projectile.remainingChains = Math.max(0, (projectile.remainingChains ?? 0) - 1)
  projectile.velocityX = direction.x * definition.speed
  projectile.velocityY = direction.y * definition.speed
}

function collectSwordBasicAttackDamage(
  state: GameState,
  target: Readonly<EnemyState | BossState>,
  allocator: EntityIdAllocator,
): DamageEvent[] {
  const player = state.player
  const stats = getDerivedPlayerStats(player)
  const skill = player.skills.find((candidate) => candidate.skillId === BASIC_ATTACK_SKILL_ID)
  if (!skill) {
    return []
  }
  const variant = getBasicAttackVariant(getEquippedWeaponArchetype(player))
  const range = scaleAreaValue(stats.attackRange, stats.areaOfEffect)
  const distanceToTarget = Math.hypot(target.x - player.x, target.y - player.y)
  if (distanceToTarget > range + target.radius) {
    return []
  }
  const facing = normalizeVector(target.x - player.x, target.y - player.y)
  const facingAngle = Math.atan2(facing.y, facing.x)
  const arcRadians = scaleSwordArcDegrees(
    variant.swingArcDegrees ?? 100,
    stats.areaOfEffect,
  ) * DEGREES_TO_RADIANS
  const skillDefinition = getSkillDefinition(BASIC_ATTACK_SKILL_ID)
  const baseDamage = getSkillDamage(skillDefinition, skill.level)
  baseDamage.physical += stats.attackDamage
  const outgoingDamage = createPlayerDamageProfileFromStats(
    stats,
    baseDamage,
    {
      sourceTags: [...variant.tags],
      additionalIncreasedDamage: {
        global: getSkillDamageIncreasePercent(
          BASIC_ATTACK_SKILL_ID,
          skill.level,
        ),
      },
    },
  )
  const events = [...state.enemies, ...(state.bosses ?? [])]
    .sort((left, right) => left.id - right.id)
    .flatMap((enemy) => {
      if (enemy.hp <= 0) {
        return []
      }
      const offsetX = enemy.x - player.x
      const offsetY = enemy.y - player.y
      const distance = Math.hypot(offsetX, offsetY)
      if (distance > range + enemy.radius) {
        return []
      }
      const enemyAngle = Math.atan2(offsetY, offsetX)
      const angleToEnemy = Math.abs(normalizeAngle(enemyAngle - facingAngle))
      const radiusAllowance = distance <= enemy.radius
        ? Math.PI / 2
        : Math.asin(Math.min(1, enemy.radius / distance))
      if (angleToEnemy > arcRadians / 2 + radiusAllowance) {
        return []
      }
      return [{
        sourceId: player.id,
        sourceSkillId: BASIC_ATTACK_SKILL_ID,
        sourceTags: [...variant.tags],
        targetId: enemy.id,
        damage: outgoingDamage.damage,
        criticalStrike: outgoingDamage.criticalStrike,
      }]
    })
  if (events.length > 0) {
    createBasicAttackEffect(state, allocator, {
      skillId: BASIC_ATTACK_SKILL_ID,
      shape: 'arc',
      basicAttackWeaponArchetype: variant.id,
      x: player.x,
      y: player.y,
      radius: range,
      lifetime: variant.effectLifetime,
      remainingLifetime: variant.effectLifetime,
      points: buildArcEffectPoints(player.x, player.y, facingAngle, range, arcRadians),
    })
  }
  return events
}

function collectStaffBasicAttackDamage(
  state: GameState,
  target: Readonly<EnemyState | BossState>,
  allocator: EntityIdAllocator,
): DamageEvent[] {
  const player = state.player
  const stats = getDerivedPlayerStats(player)
  const skill = player.skills.find((candidate) => candidate.skillId === BASIC_ATTACK_SKILL_ID)
  if (!skill) {
    return []
  }
  const variant = getBasicAttackVariant(getEquippedWeaponArchetype(player))
  const range = stats.attackRange
  if (Math.hypot(target.x - player.x, target.y - player.y) > range + target.radius) {
    return []
  }
  const radius = scaleAreaValue(variant.areaRadius ?? 40, stats.areaOfEffect)
  const skillDefinition = getSkillDefinition(BASIC_ATTACK_SKILL_ID)
  const baseDamage = getSkillDamage(skillDefinition, skill.level)
  baseDamage.physical += stats.attackDamage
  const outgoingDamage = createPlayerDamageProfileFromStats(
    stats,
    baseDamage,
    {
      sourceTags: [...variant.tags],
      additionalIncreasedDamage: {
        global: getSkillDamageIncreasePercent(
          BASIC_ATTACK_SKILL_ID,
          skill.level,
        ),
      },
    },
  )
  const events = [...state.enemies, ...(state.bosses ?? [])]
    .sort((left, right) => left.id - right.id)
    .flatMap((enemy) => {
      if (enemy.hp <= 0) {
        return []
      }
      const distance = Math.hypot(enemy.x - target.x, enemy.y - target.y)
      if (distance > radius + enemy.radius) {
        return []
      }
      return [{
        sourceId: player.id,
        sourceSkillId: BASIC_ATTACK_SKILL_ID,
        sourceTags: [...variant.tags],
        targetId: enemy.id,
        damage: outgoingDamage.damage,
        criticalStrike: outgoingDamage.criticalStrike,
        ...(variant.poisonApplication
          ? { poisonApplication: variant.poisonApplication }
          : {}),
      }]
    })
  if (events.length > 0) {
    createBasicAttackEffect(state, allocator, {
      skillId: BASIC_ATTACK_SKILL_ID,
      basicAttackWeaponArchetype: variant.id,
      x: target.x,
      y: target.y,
      radius,
      lifetime: variant.effectLifetime,
      remainingLifetime: variant.effectLifetime,
      points: [{ x: target.x, y: target.y }],
    })
  }
  return events
}

function findLivingTarget(
  state: Readonly<GameState>,
  targetId: number | undefined,
): EnemyState | BossState | undefined {
  if (targetId === undefined) {
    return undefined
  }
  return state.enemies.find((enemy) => enemy.id === targetId && enemy.hp > 0) ??
    state.bosses?.find((boss) => boss.id === targetId && boss.hp > 0)
}

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

  for (const enemy of [...state.enemies, ...(state.bosses ?? [])].sort(
    (left, right) => left.id - right.id,
  )) {
    if (enemy.hp <= 0) {
      continue
    }

    const cooldown = Math.max(
      0,
      (enemy.contactCooldownRemaining ?? 0) - elapsed,
    )
    enemy.contactCooldownRemaining = cooldown
    const target = getEnemyCombatTarget(state, enemy)
    enemy.targetId = target.id
    const contactDistance = target.radius + enemy.radius
    const distanceSquared =
      (enemy.x - target.x) ** 2 + (enemy.y - target.y) ** 2
    if (
      cooldown > 0 ||
      distanceSquared > contactDistance * contactDistance ||
      enemy.contactDamage <= 0
    ) {
      continue
    }

    events.push(createMonsterDamageEvent(
      enemy,
      target.id,
      { physical: enemy.contactDamage },
    ))
    enemy.contactCooldownRemaining = ENEMY_CONTACT_DAMAGE_INTERVAL_SECONDS
    enemy.lastMeleeAttackTime = state.time
  }

  return events
}

export function updateAttackCooldown(
  state: GameState,
  fixedStepSeconds: number,
): void {
  const player = state.player
  const basicAttack = player.skills.find(
    (skill) => skill.skillId === BASIC_ATTACK_SKILL_ID,
  )
  player.attackCooldownRemaining = Math.max(
    0,
    player.attackCooldownRemaining - fixedStepSeconds,
  )
  if (basicAttack) {
    basicAttack.cooldownRemaining = player.attackCooldownRemaining
  }
}

export function resolvePlayerTarget(
  state: GameState,
  enemySpatialHash = createEnemySpatialHash(state),
): void {
  const player = state.player
  const engagementRange = getBasicAttackEngagementRange(state)
  const currentTarget = findLivingTarget(state, player.targetId)
  const target = currentTarget
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

export function performBasicAttackIfReady(
  state: GameState,
  idAllocator: EntityIdAllocator,
): DamageEvent[] {
  const player = state.player
  const target = getBasicAttackTarget(state)
  const basicAttack = player.skills.find(
    (skill) => skill.skillId === BASIC_ATTACK_SKILL_ID,
  )

  if (
    !target ||
    player.attackCooldownRemaining > 0 ||
    !basicAttack
  ) {
    if (!target && player.targetId !== undefined) {
      player.targetId = undefined
    }
    return []
  }

  const variant = getBasicAttackVariant(getEquippedWeaponArchetype(player))
  const cooldown = createBasicAttackCooldown(getDerivedPlayerStats(player).attackSpeed)

  if (variant.kind === 'area') {
    const events = variant.areaShape === 'circle'
      ? collectStaffBasicAttackDamage(state, target, idAllocator)
      : collectSwordBasicAttackDamage(state, target, idAllocator)
    if (events.length > 0) {
      setBasicAttackCooldown(state, cooldown)
    }
    return events
  }

  const projectileDefinition = getProjectileDefinition(
    variant.projectileDefinitionId ?? getSkillDefinition(BASIC_ATTACK_SKILL_ID).projectileDefinitionId!,
  )
  const projectileRange =
    projectileDefinition.speed * projectileDefinition.lifetime +
    projectileDefinition.radius
  const targetDistanceSquared =
    (target.x - player.x) ** 2 + (target.y - player.y) ** 2
  if (targetDistanceSquared > projectileRange * projectileRange) {
    return []
  }

  state.projectiles.push(
    ...createBasicAttackProjectileState(state, idAllocator, target),
  )
  setBasicAttackCooldown(state, cooldown)
  return []
}

export function updateProjectiles(
  state: GameState,
  fixedStepSeconds: number,
): void {
  let enemySpatialHash = undefined
  for (const projectile of state.projectiles) {
    const definition = getProjectileDefinition(projectile.definitionId)
    if (definition.guidance === 'homing') {
      enemySpatialHash ??= createEnemySpatialHash(state)
      const target = resolveProjectileTarget(
        state,
        projectile,
        definition.retargetRange ?? definition.speed * definition.lifetime,
        enemySpatialHash,
      )
      if (target) {
        projectile.targetId = target.id
        steerProjectileTowardTarget(
          projectile,
          target,
          (definition.turnRateDegreesPerSecond ?? 0) * DEGREES_TO_RADIANS * fixedStepSeconds,
          definition.speed,
        )
      } else {
        projectile.targetId = undefined
      }
    }
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
      if (enemy.id === projectile.lastHitTargetId) {
        continue
      }
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
        sourceSkillId: projectile.skillId,
        sourceTags: projectile.sourceTags,
        targetId: hitEnemy.id,
        damage: projectile.damage,
        criticalStrike: projectile.criticalStrike,
      })
      if (canProjectileChain(state, projectile)) {
        const nextTarget = findNearestEnemy(
          {
            originX: hitEnemy.x,
            originY: hitEnemy.y,
            maxRange: projectile.chainRange ?? 0,
            excludeTargetId: hitEnemy.id,
          },
          state,
          enemies,
        )
        if (nextTarget) {
          relaunchProjectileTowardTarget(projectile, hitEnemy, nextTarget)
          continue
        }
      }
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

function resolveEventDamage(
  event: Readonly<DamageEvent>,
  resistances: Readonly<Partial<DamageResistanceValues>> | undefined,
  rng?: Pick<RandomSource, 'next'>,
): ResolvedDamage {
  const criticalStrike = event.criticalStrike
  const isCritical = criticalStrike
    ? isCriticalStrike(criticalStrike, rng?.next() ?? 1)
    : false
  const damageAfterCrit = criticalStrike && isCritical
    ? scaleDamageValues(
        event.damage,
        normalizeCriticalStrikeStats(criticalStrike).multiplier / 100,
      )
    : event.damage
  return {
    preMitigation: damageAfterCrit,
    mitigated: mitigateDamageValues(damageAfterCrit, resistances),
  }
}

function getPlayerDamageSource(
  state: Readonly<GameState>,
  event: Readonly<DamageEvent>,
): string {
  if (event.sourceLabel) {
    return event.sourceLabel
  }
  const boss = state.bosses?.find((candidate) => candidate.id === event.sourceId)
  if (boss) {
    return getBossDefinition(boss.bossDefinitionId).name
  }
  const enemy = state.enemies.find((candidate) => candidate.id === event.sourceId)
  if (enemy) {
    return getEnemyDefinition(enemy.definitionId).name
  }
  return 'Unknown source'
}

export function applyDamageEvents(
  state: GameState,
  events: readonly DamageEvent[],
  rng?: Pick<RandomSource, 'next'>,
  idAllocator?: EntityIdAllocator,
): void {
  const pendingEvents = [...events]
  for (let eventIndex = 0; eventIndex < pendingEvents.length; eventIndex += 1) {
    const event = pendingEvents[eventIndex]!
    if (event.targetId === state.player.id) {
      const resolvedDamage = resolveEventDamage(
        event,
        getDerivedPlayerStats(state.player).resistances,
        rng,
      )
      const source = getPlayerDamageSource(state, event)
      for (const damageType of DAMAGE_TYPES) {
        const actualDamage = Math.min(state.player.hp, resolvedDamage.mitigated[damageType])
        if (actualDamage <= 0) {
          continue
        }
        state.player.hp -= actualDamage
        recordPlayerDamage(state, actualDamage, damageType, source)
      }
      continue
    }
    const summon = state.summons.find(
      (candidate) => candidate.id === event.targetId && candidate.hp > 0,
    )
    if (summon) {
      const resolvedDamage = resolveEventDamage(event, undefined, rng)
      summon.hp = Math.max(
        0,
        summon.hp - sumDamageValues(resolvedDamage.mitigated),
      )
      continue
    }
    const enemy = state.enemies.find(
      (candidate) => candidate.id === event.targetId && candidate.hp > 0,
    )
    if (enemy) {
      const hitX = enemy.x
      const hitY = enemy.y
      const resolvedDamage = resolveEventDamage(event, enemy.resistances, rng)
      const actualDamage = Math.min(
        enemy.hp,
        sumDamageValues(resolvedDamage.mitigated),
      )
      enemy.hp -= actualDamage
      applyPoisonApplication(
        state,
        enemy,
        event,
        resolvedDamage.preMitigation,
      )
      applyMeleeLeech(state, event, actualDamage)
      if (isPlayerOwnedDirectHit(state, event)) {
        pendingEvents.push(...collectFieryTouchTriggerEvents(
          state,
          hitX,
          hitY,
          idAllocator,
        ))
      }
      continue
    }
    const boss = state.bosses?.find(
      (candidate) => candidate.id === event.targetId && candidate.hp > 0,
    )
    if (boss) {
      const hitX = boss.x
      const hitY = boss.y
      const resolvedDamage = resolveEventDamage(event, boss.resistances, rng)
      const actualDamage = Math.min(
        boss.hp,
        sumDamageValues(resolvedDamage.mitigated),
      )
      boss.hp -= actualDamage
      applyPoisonApplication(
        state,
        boss,
        event,
        resolvedDamage.preMitigation,
      )
      applyMeleeLeech(state, event, actualDamage)
      if (isPlayerOwnedDirectHit(state, event)) {
        pendingEvents.push(...collectFieryTouchTriggerEvents(
          state,
          hitX,
          hitY,
          idAllocator,
        ))
      }
    }
  }
}

function applyPoisonApplication(
  state: GameState,
  target: EnemyState,
  event: Readonly<DamageEvent>,
  preMitigationDamage: Readonly<DamageValues>,
): void {
  const application = event.poisonApplication
  if (!application || target.hp <= 0) {
    return
  }
  const sourceDamage = preMitigationDamage.physical + preMitigationDamage.chaos
  const dotMultiplier = getDerivedPlayerStats(state.player).dotMultiplier
  const damagePerSecond = sourceDamage *
    application.physicalChaosRatio *
    (1 + dotMultiplier / 100)
  if (damagePerSecond <= 0) {
    return
  }
  target.poisonStacks ??= []
  target.poisonStacks.push({
    remainingDuration: application.durationSeconds,
    damagePerSecond,
  })
}

export function updatePoison(
  state: GameState,
  fixedStepSeconds: number,
): DamageEvent[] {
  const events: DamageEvent[] = []
  const elapsed = Math.max(0, fixedStepSeconds)
  for (const target of [...state.enemies, ...(state.bosses ?? [])]) {
    if (!target.poisonStacks || target.poisonStacks.length === 0) {
      continue
    }
    for (const stack of target.poisonStacks) {
      if (stack.remainingDuration <= 0 || stack.damagePerSecond <= 0) {
        continue
      }
      const damage = stack.damagePerSecond * Math.min(elapsed, stack.remainingDuration)
      if (damage > 0) {
        events.push({
          sourceLabel: 'Poison',
          targetId: target.id,
          damage: createDamageValues({ chaos: damage }),
          damageOverTime: true,
        })
      }
      stack.remainingDuration -= elapsed
    }
    target.poisonStacks = target.poisonStacks.filter(
      (stack) => stack.remainingDuration > 0 && stack.damagePerSecond > 0,
    )
  }
  return events
}

function applyMeleeLeech(
  state: GameState,
  event: DamageEvent,
  actualDamage: number,
): void {
  if (
    event.damageOverTime ||
    !event.sourceSkillId ||
    event.sourceId !== state.player.id ||
    actualDamage <= 0
  ) {
    return
  }
  const sourceTags = event.sourceTags ??
    (isSkillId(event.sourceSkillId)
      ? getSkillDefinition(event.sourceSkillId).tags
      : ([] as readonly SkillTag[]))
  const playerStats = getDerivedPlayerStats(state.player)
  const meleeLeech = Math.max(
    playerStats.meleeLeech,
    state.player.meleeLeech ?? 0,
  )
  const whirlwindLeech = Math.max(
    playerStats.whirlwindLeech,
    state.player.whirlwindLeech ?? 0,
    state.player.whirlwindLeech === undefined &&
      state.player.upgradeWhirlwindLeech === undefined
      ? state.player.meleeLeech ?? 0
      : 0,
  )
  const leechAmount = event.sourceSkillId === WHIRLWIND_SKILL_ID
    ? whirlwindLeech
    : sourceTags.includes('melee')
      ? meleeLeech
      : 0
  if (leechAmount <= 0) {
    return
  }
  const source = isSkillId(event.sourceSkillId)
    ? `${getSkillDefinition(event.sourceSkillId).name} leech`
    : 'Melee leech'
  healPlayer(
    state,
    actualDamage * leechAmount,
    source,
  )
}

export function removeDeadEntities(
  state: GameState,
  spawnPickup: (position: { x: number; y: number }, xpAmount: number) => void,
  spawnEnemy?: (
    definitionId: string,
    position: { x: number; y: number },
    xpRewardOverride?: number,
    canDropLoot?: boolean,
  ) => void,
  spawnGearPickup?: (
    position: { x: number; y: number },
    sourceEnemyDefinitionId: string,
  ) => void,
  random?: RandomSource,
  spawnHealingPotion?: (position: { x: number; y: number }) => void,
): void {
  const livingEnemies: EnemyState[] = []
  const childSpawns: ChildSpawnRequest[] = []
  const spawnBalance = resolveWorldModifierEffects(
    state.run.worldModifierIds,
    SPAWN_BALANCE,
  ).spawnBalance
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
      const randomGearDrop = enemy.canDropLoot !== false && (random?.chance(
        getGearDropChance(enemy.definitionId, enemy.eliteModifier, {
          timeSeconds: state.time,
          chanceMultiplier: state.player.gearDropChanceMultiplier,
          spawnBalance,
        }),
      ) ?? false)
      if (randomGearDrop) {
        state.run.gearDropGenerated = true
        spawnGearPickup?.(
          { x: enemy.x, y: enemy.y },
          enemy.definitionId,
        )
      }
      if (enemy.canDropLoot !== false) {
        const potionChance = enemy.eliteModifier
          ? HEALING_POTION_ELITE_DROP_CHANCE
          : HEALING_POTION_ORDINARY_DROP_CHANCE
        if (random?.chance(potionChance) ?? false) {
          spawnHealingPotion?.({ x: enemy.x, y: enemy.y })
        }
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
        child.canDropLoot,
      )
    }
  }
  state.projectiles = state.projectiles.filter(
    (projectile) => projectile.remainingLifetime > 0,
  )
}
