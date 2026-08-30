import {
  createProjectileSpreadAngles,
  getProjectileVolleyCount,
  getProjectileDefinition,
  PLAYER_PROJECTILE_CHAIN_RANGE,
} from '../../../content/projectiles/Projectiles'
import {
  BASIC_ATTACK_SKILL_ID,
  CINDER_MINE_SKILL_ID,
  FIERY_TOUCH_SKILL_ID,
  AEGIS_PULSE_SKILL_ID,
  PHANTOM_ARSENAL_SKILL_ID,
  SOUL_TETHER_SKILL_ID,
  RIFT_JAVELIN_SKILL_ID,
  getEffectiveSkillCooldown,
  getBasicAttackVariant,
  getSkillDefinition,
  getSkillDamage,
  isSkillId,
  GLACIAL_ORB_SKILL_ID,
  WHIRLWIND_SKILL_ID,
  type SkillTag,
} from '../../../content/skills/Skills'
import {
  getSkillCooldownReductionPercent,
  getSkillDamageIncreasePercent,
} from '../../../content/upgrades/Upgrades'
import {
  DAMAGE_TYPES,
  addDamageValues,
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
import { getEnemyAbilityDefinition } from '../../../content/enemies/EnemyAbilities'
import { getPostSpawnDamageMultiplier } from '../../../content/enemies/EnemyAcceleration'
import { getBossDefinition } from '../../../content/bosses/Bosses'
import {
  KNIGHT_EARLY_FLOOR_COUNT,
  KNIGHT_EARLY_FLOOR_DAMAGE_REDUCTION_PERCENT,
} from '../../../game-config/classes'
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
import {
  getEquippedWeaponArchetype,
} from '../../equipment/EquipmentState'
import {
  getRallyingBannerDamageReductionPercent,
  getRallyingBannerEffects,
} from '../skills/RallyingBanner'
import {
  getSplitChildren,
  getEnemyCombatTarget,
  updateEnemyBehaviors,
} from './EnemyBehaviors'
import type { ChildSpawnRequest } from './EnemyBehaviors'
import type {
  DamageEvent,
  BossState,
  EnemyState,
  GameState,
  PlayerState,
  ProjectileState,
  SkillEffectPoint,
  SkillEffectState,
} from '../../state/GameState'
import { getDerivedPlayerStats } from '../../stats/DerivedStats'
import { getGearDropChance } from '../../../content/gear/GearDrops'
import {
  GEAR_XP_BLESSING_MULTIPLIER,
} from '../../../game-config/gear'
import { resolveWorldModifierEffects } from '../../../content/modifiers/WorldModifiers'
import { SPAWN_BALANCE } from '../../../content/spawning/SpawnBalance'
import type { RandomSource } from '../../random/Random'
import {
  HEALING_POTION_ELITE_DROP_CHANCE,
  HEALING_POTION_ORDINARY_DROP_CHANCE,
} from '../../../content/progression/HealingPotions'
import {
  FROST_DEFAULT_DURATION_SECONDS,
  FROST_DEFAULT_FREEZE_DURATION_SECONDS,
  FROST_MAX_CHILL_STACKS,
  SHOCK_DEFAULT_DURATION_SECONDS,
  SHOCK_MAX_STACKS,
  AEGIS_PULSE_REPRISAL_RATIO,
  LANCERS_CHARGE_MAX_MOMENTUM_STACKS,
  LANCERS_CHARGE_MOMENTUM_DECAY_SECONDS,
  SOUL_TETHER_REQUIEM_BURST_TARGET_COUNT,
  SOUL_TETHER_SNAP_BURST_SECONDS_EQUIVALENT,
  SOUL_TETHER_RETARGET_DAMAGE_MULTIPLIER,
} from '../../../game-config/skills'

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

function getBasicAttackSynergyApplications(
  state: Readonly<GameState>,
): Pick<DamageEvent, 'frostApplication' | 'shockApplication'> {
  return {
    ...(state.run.selectedUpgradeIds.includes('synergy-basic-attack-glacial-orb')
      ? {
          frostApplication: {
            stacks: 1,
            durationSeconds: FROST_DEFAULT_DURATION_SECONDS,
            freezeThreshold: FROST_MAX_CHILL_STACKS,
            freezeDurationSeconds: FROST_DEFAULT_FREEZE_DURATION_SECONDS,
          },
        }
      : {}),
    ...(state.run.selectedUpgradeIds.includes('synergy-basic-attack-chain-lightning')
      ? {
          shockApplication: {
            stacks: 1,
            durationSeconds: SHOCK_DEFAULT_DURATION_SECONDS,
            threshold: SHOCK_MAX_STACKS,
            burstMultiplier: 1.5,
          },
        }
      : {}),
  }
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
  const gravityPrimed = state.run.selectedUpgradeIds.includes(
    'synergy-fiery-touch-gravity-well',
  ) && state.player.fieryTouchGravityPrimed === true
  const radius = scaleAreaValue(definition.radius ?? 0, playerStats.areaOfEffect) *
    (gravityPrimed ? 1.5 : 1)
  const thermalShock = state.run.selectedUpgradeIds.includes(
    'synergy-fiery-touch-glacial-orb',
  )
  const wildfire = state.run.selectedUpgradeIds.includes(
    'synergy-cinder-mine-fiery-touch',
  )
  const outgoingDamage = createPlayerDamageProfileFromStats(
    playerStats,
    getSkillDamage(definition, skill.level),
    {
      sourceTags: definition.tags,
      additionalIncreasedDamage: {
        global: state.player.fieryTouchDamageIncreasePercent ?? 0,
      },
    },
  )
  const events = [...state.enemies, ...(state.bosses ?? [])]
    .filter((enemy) => enemy.hp > 0)
    .sort((left, right) => left.id - right.id)
    .flatMap((enemy) => {
      const distance = Math.hypot(enemy.x - hitX, enemy.y - hitY)
      if (distance > radius + enemy.radius) {
        return []
      }
      const chilled = (enemy.chillStacks ?? 0) > 0 ||
        (enemy.frozenRemainingDuration ?? 0) > 0
      const events: DamageEvent[] = [{
        sourceId: state.player.id,
        sourceSkillId: FIERY_TOUCH_SKILL_ID,
        sourceTags: definition.tags,
        targetId: enemy.id,
        damage: thermalShock && chilled
          ? addDamageValues(
              outgoingDamage.damage,
              { cold: outgoingDamage.damage.fire * 0.5 },
            )
          : outgoingDamage.damage,
        criticalStrike: outgoingDamage.criticalStrike,
      }]
      if (thermalShock && chilled) {
        enemy.chillStacks = 0
        enemy.chillRemainingDuration = 0
        enemy.frozenRemainingDuration = 0
      }
      if (wildfire && (enemy.burningStacks?.length ?? 0) > 0) {
        const burstDamage = enemy.burningStacks?.reduce(
          (total, stack) =>
            total + stack.damagePerSecond * Math.max(0, stack.remainingDuration),
          0,
        ) ?? 0
        enemy.burningStacks = []
        if (burstDamage > 0) {
          events.push({
            sourceId: state.player.id,
            sourceSkillId: FIERY_TOUCH_SKILL_ID,
            sourceTags: definition.tags,
            sourceLabel: 'Wildfire',
            targetId: enemy.id,
            damage: createDamageValues({ fire: burstDamage }),
          })
        }
      }
      return events
    })

  if (gravityPrimed && events.length > 0) {
    state.player.fieryTouchGravityPrimed = false
  }
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

function createProjectileImpactEffect(
  state: GameState,
  allocator: EntityIdAllocator | undefined,
  projectile: ProjectileState,
  x: number,
  y: number,
): void {
  if (
    !allocator ||
    projectile.skillId !== GLACIAL_ORB_SKILL_ID ||
    projectile.impactEffectRadius === undefined
  ) {
    return
  }

  const definition = getSkillDefinition(GLACIAL_ORB_SKILL_ID)
  state.effects.push({
    id: allocator.createEntityId(),
    skillId: GLACIAL_ORB_SKILL_ID,
    x,
    y,
    radius: projectile.impactEffectRadius,
    lifetime: definition.effectLifetime,
    remainingLifetime: definition.effectLifetime,
    points: [{ x, y }],
  })
}

function collectProjectileImpactEvents(
  state: GameState,
  projectile: ProjectileState,
  hitEnemy: EnemyState | BossState,
  enemies: ReturnType<typeof createEnemySpatialHash>,
): DamageEvent[] {
  const getDamageForTarget = (targetId: number): DamageValues => {
    let damage = projectile.returning && projectile.returnDamageMultiplier !== undefined
      ? scaleDamageValues(projectile.damage, projectile.returnDamageMultiplier)
      : projectile.damage
    const precisionIncrease = !projectile.primaryTargetDamageApplied &&
      projectile.primaryTargetId === targetId
      ? Math.max(0, projectile.primaryTargetDamageIncreasePercent ?? 0)
      : 0
    if (precisionIncrease > 0) {
      projectile.primaryTargetDamageApplied = true
      damage = scaleDamageValues(damage, 1 + precisionIncrease / 100)
    }
    return damage
  }
  const impactRadius = projectile.impactRadius
  if (impactRadius === undefined || impactRadius <= 0) {
    return [{
      sourceId: projectile.ownerId,
      sourceSkillId: projectile.skillId,
      sourceTags: projectile.sourceTags,
      targetId: hitEnemy.id,
      damage: getDamageForTarget(hitEnemy.id),
      criticalStrike: projectile.criticalStrike,
      frostApplication: projectile.impactFrostApplication,
      shockApplication: projectile.impactShockApplication,
      poisonApplication: projectile.impactPoisonApplication,
    }]
  }

  const maxEnemyRadius = Math.max(
    0,
    ...state.enemies.map((enemy) => enemy.radius),
    ...(state.bosses ?? []).map((boss) => boss.radius),
  )
  return enemies
    .queryRadius(hitEnemy.x, hitEnemy.y, impactRadius + maxEnemyRadius)
    .filter((enemy) => enemy.hp > 0)
    .filter((enemy) =>
      Math.hypot(enemy.x - hitEnemy.x, enemy.y - hitEnemy.y) <=
        impactRadius + enemy.radius,
    )
    .sort((left, right) => left.id - right.id)
    .map((enemy) => ({
      sourceId: projectile.ownerId,
      sourceSkillId: projectile.skillId,
      sourceTags: projectile.sourceTags,
      targetId: enemy.id,
      damage: getDamageForTarget(enemy.id),
      criticalStrike: projectile.criticalStrike,
      frostApplication: projectile.impactFrostApplication,
      shockApplication: projectile.impactShockApplication,
      poisonApplication: projectile.impactPoisonApplication,
    }))
}

function getBasicAttackTarget(
  state: GameState,
): EnemyState | BossState | undefined {
  return findLivingTarget(state, state.player.targetId)
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
          state.run.selectedUpgradeIds,
        ),
      },
    },
  )
  const localExtraProjectiles = Math.min(
    variant.maxExtraProjectiles ?? 0,
    Math.max(0, Math.trunc(stats.basicAttackExtraProjectiles)),
  )
  const primaryTargetDamageIncreasePercent = Math.max(
    0,
    variant.primaryTargetDamageIncreasePercent ?? 0,
  )
  const remainingChains = Math.max(0, Math.trunc(stats.projectileChains))
  const projectileCount = getProjectileVolleyCount(
    variant.tags,
    stats.globalExtraProjectiles,
  ) + localExtraProjectiles
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
      ...(primaryTargetDamageIncreasePercent > 0
        ? {
            primaryTargetId: target.id,
            primaryTargetDamageIncreasePercent,
          }
        : {}),
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
      impactFrostApplication: getBasicAttackSynergyApplications(state).frostApplication,
      impactShockApplication: getBasicAttackSynergyApplications(state).shockApplication,
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
          state.run.selectedUpgradeIds,
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
        ...getBasicAttackSynergyApplications(state),
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
          state.run.selectedUpgradeIds,
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
        ...getBasicAttackSynergyApplications(state),
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
  updateEnemyBehaviors(state, fixedStepSeconds)
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
    if ((enemy.frozenRemainingDuration ?? 0) > 0) {
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
      {
        physical: enemy.contactDamage *
          getPostSpawnDamageMultiplier(state.time, enemy.spawnTime),
      },
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
    if (projectile.piercing && !projectile.returning) {
      const speed = Math.hypot(projectile.velocityX, projectile.velocityY)
      projectile.pierceTraveledDistance =
        (projectile.pierceTraveledDistance ?? 0) + speed * fixedStepSeconds
      if (
        projectile.pierceTraveledDistance >=
          (projectile.pierceReturnRange ?? Number.POSITIVE_INFINITY)
      ) {
        projectile.velocityX = -projectile.velocityX
        projectile.velocityY = -projectile.velocityY
        projectile.returning = true
        projectile.pierceHitTargetIds = []
      }
    }
  }
}

export function collectProjectileDamage(
  state: GameState,
  enemies = createEnemySpatialHash(state),
  idAllocator?: EntityIdAllocator,
): DamageEvent[] {
  const damageEvents: DamageEvent[] = []
  const projectiles = [...state.projectiles].sort(
    (left, right) => left.id - right.id,
  )
  for (const projectile of projectiles) {
    if (projectile.remainingLifetime <= 0 || projectile.visualOnly) {
      continue
    }

    if (projectile.hostile) {
      const target = projectile.targetId === state.player.id
        ? state.player
        : state.summons.find(
            (summon) => summon.id === projectile.targetId && summon.hp > 0,
          )
      if (!target) {
        projectile.remainingLifetime = 0
        continue
      }
      const targetRadius = target.id === state.player.id ? state.player.radius : 13
      const collisionDistance = targetRadius + projectile.radius
      const distanceSquared =
        (target.x - projectile.x) ** 2 + (target.y - projectile.y) ** 2
      if (distanceSquared <= collisionDistance * collisionDistance) {
        damageEvents.push({
          sourceId: projectile.ownerId,
          targetId: target.id,
          damage: projectile.damage,
          criticalStrike: projectile.criticalStrike,
          sourceLabel: projectile.sourceAbilityId
            ? getEnemyAbilityDefinition(projectile.sourceAbilityId).name
            : 'Enemy projectile',
        })
        projectile.remainingLifetime = 0
      }
      continue
    }

    let hitEnemy: EnemyState | BossState | undefined
    let hitDistanceSquared = Number.POSITIVE_INFINITY

    for (const enemy of enemies.queryRadius(
      projectile.x,
      projectile.y,
      projectile.radius,
    )) {
      if (
        projectile.piercing
          ? (projectile.pierceHitTargetIds ?? []).includes(enemy.id)
          : enemy.id === projectile.lastHitTargetId
      ) {
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
      damageEvents.push(
        ...collectProjectileImpactEvents(state, projectile, hitEnemy, enemies),
      )
      createProjectileImpactEffect(
        state,
        idAllocator,
        projectile,
        hitEnemy.x,
        hitEnemy.y,
      )
      if (
        projectile.skillId === RIFT_JAVELIN_SKILL_ID &&
        projectile.returning
      ) {
        if (
          state.run.selectedUpgradeIds.includes(
            'synergy-rift-javelin-lancers-charge',
          )
        ) {
          state.player.lancerMomentumStacks = Math.min(
            LANCERS_CHARGE_MAX_MOMENTUM_STACKS,
            Math.max(0, state.player.lancerMomentumStacks ?? 0) + 1,
          )
          state.player.lancerMomentumDecayRemaining =
            LANCERS_CHARGE_MOMENTUM_DECAY_SECONDS
        }
        if (
          state.run.selectedUpgradeIds.includes(
            'synergy-rift-javelin-cinder-mine',
          )
        ) {
          for (const trap of state.traps ?? []) {
            if (
              trap.skillId === CINDER_MINE_SKILL_ID &&
              Math.hypot(trap.x - hitEnemy.x, trap.y - hitEnemy.y) <=
                trap.radius + hitEnemy.radius
            ) {
              trap.fuseRemaining = 0
            }
          }
        }
      }
      if (
        projectile.skillId === PHANTOM_ARSENAL_SKILL_ID &&
        state.run.selectedUpgradeIds.includes(
          'synergy-phantom-arsenal-rift-javelin',
        )
      ) {
        state.player.riftJavelinReturnBonusPercent = 25
      }
      if (projectile.piercing) {
        projectile.pierceHitTargetIds = [
          ...(projectile.pierceHitTargetIds ?? []),
          hitEnemy.id,
        ]
        continue
      }
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

function recordSkillDamage(
  state: GameState,
  sourceSkillId: DamageEvent['sourceSkillId'],
  actualDamage: number,
): void {
  if (!sourceSkillId || actualDamage <= 0) {
    return
  }
  state.run.skillDamageDealt ??= {}
  state.run.skillDamageDealt[sourceSkillId] =
    (state.run.skillDamageDealt[sourceSkillId] ?? 0) + actualDamage
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
      const playerDamageFactor = getIncomingPlayerDamageFactor(state)
      const playerEvent = playerDamageFactor === 1
        ? event
        : { ...event, damage: scaleDamageValues(event.damage, playerDamageFactor) }
      const resolvedDamage = resolveEventDamage(
        playerEvent,
        getDerivedPlayerStats(state.player).resistances,
        rng,
      )
      const source = getPlayerDamageSource(state, event)
      let totalAbsorbedByShield = 0
      for (const damageType of DAMAGE_TYPES) {
        let actualDamage = Math.min(state.player.hp, resolvedDamage.mitigated[damageType])
        if (actualDamage <= 0) {
          continue
        }
        if (
          (state.player.aegisPulseShieldRemaining ?? 0) > 0 &&
          (state.player.aegisPulseShieldAmount ?? 0) > 0
        ) {
          const absorbed = Math.min(actualDamage, state.player.aegisPulseShieldAmount ?? 0)
          state.player.aegisPulseShieldAmount = (state.player.aegisPulseShieldAmount ?? 0) - absorbed
          totalAbsorbedByShield += absorbed
          actualDamage -= absorbed
        }
        if (actualDamage <= 0) {
          continue
        }
        state.player.hp -= actualDamage
        recordPlayerDamage(state, actualDamage, damageType, source)
      }
      if (
        totalAbsorbedByShield > 0 &&
        event.sourceId !== undefined &&
        !event.damageOverTime &&
        state.run.selectedUpgradeIds.includes('aegis-pulse-reprisal')
      ) {
        pendingEvents.push({
          sourceId: state.player.id,
          sourceSkillId: AEGIS_PULSE_SKILL_ID,
          sourceTags: ['physical'],
          sourceLabel: 'Reprisal',
          targetId: event.sourceId,
          damage: createDamageValues({
            physical: totalAbsorbedByShield * AEGIS_PULSE_REPRISAL_RATIO,
          }),
        })
      }
      applyPoisonApplication(
        state,
        state.player,
        playerEvent,
        resolvedDamage.preMitigation,
      )
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
      const shatters = (enemy.frozenRemainingDuration ?? 0) > 0 &&
        event.damage.physical > 0
      if (shatters) {
        enemy.frozenRemainingDuration = 0
      }
      const enemyEvent = shatters
        ? { ...event, damage: scaleDamageValues(event.damage, 1.5) }
        : event
      const resolvedDamage = resolveEventDamage(enemyEvent, enemy.resistances, rng)
      const actualDamage = Math.min(
        enemy.hp,
        sumDamageValues(resolvedDamage.mitigated),
      )
      enemy.hp -= actualDamage
      recordSkillDamage(state, event.sourceSkillId, actualDamage)
      applyPoisonApplication(
        state,
        enemy,
        enemyEvent,
        resolvedDamage.preMitigation,
      )
      applyFrostApplication(enemy, enemyEvent)
      if (isPlayerOwnedDirectHit(state, event)) {
        applyGearFrostApplication(state, enemy, enemyEvent)
      }
      applyShockApplication(enemy, enemyEvent, pendingEvents)
      applyBurningApplication(state, enemy, enemyEvent, resolvedDamage.preMitigation)
      applyMeleeLeech(state, event, actualDamage)
      applySoulTetherHealing(state, event, actualDamage)
      if (isPlayerOwnedDirectHit(state, event)) {
        pendingEvents.push(...collectFieryTouchTriggerEvents(
          state,
          hitX,
          hitY,
          idAllocator,
        ))
      }
      if (enemy.hp <= 0 && state.player.soulTetherTargetId === enemy.id) {
        pendingEvents.push(...triggerSoulTetherSnap(state, enemy))
      }
      continue
    }
    const boss = state.bosses?.find(
      (candidate) => candidate.id === event.targetId && candidate.hp > 0,
    )
    if (boss) {
      const hitX = boss.x
      const hitY = boss.y
      const shatters = (boss.frozenRemainingDuration ?? 0) > 0 &&
        event.damage.physical > 0
      if (shatters) {
        boss.frozenRemainingDuration = 0
      }
      const bossEvent = shatters
        ? { ...event, damage: scaleDamageValues(event.damage, 1.5) }
        : event
      const resolvedDamage = resolveEventDamage(bossEvent, boss.resistances, rng)
      const actualDamage = Math.min(
        boss.hp,
        sumDamageValues(resolvedDamage.mitigated),
      )
      boss.hp -= actualDamage
      recordSkillDamage(state, event.sourceSkillId, actualDamage)
      applyPoisonApplication(
        state,
        boss,
        bossEvent,
        resolvedDamage.preMitigation,
      )
      applyFrostApplication(boss, bossEvent)
      if (isPlayerOwnedDirectHit(state, event)) {
        applyGearFrostApplication(state, boss, bossEvent)
      }
      applyShockApplication(boss, bossEvent, pendingEvents)
      applyBurningApplication(state, boss, bossEvent, resolvedDamage.preMitigation)
      applyMeleeLeech(state, event, actualDamage)
      applySoulTetherHealing(state, event, actualDamage)
      if (isPlayerOwnedDirectHit(state, event)) {
        pendingEvents.push(...collectFieryTouchTriggerEvents(
          state,
          hitX,
          hitY,
          idAllocator,
        ))
      }
      if (boss.hp <= 0 && state.player.soulTetherTargetId === boss.id) {
        pendingEvents.push(...triggerSoulTetherSnap(state, boss))
      }

    }
  }
}

function getIncomingPlayerDamageFactor(state: GameState): number {
  const player = state.player
  let reduction = 0
  if (
    player.playstyleId === 'knight' &&
    (state.run.floor ?? 1) >= 1 &&
    (state.run.floor ?? 1) <= KNIGHT_EARLY_FLOOR_COUNT
  ) {
    reduction += KNIGHT_EARLY_FLOOR_DAMAGE_REDUCTION_PERCENT
  }
  if (player.hp / Math.max(1, player.maxHp) <= 0.4) {
    reduction += player.vitalityLowHpDamageReductionPercent ?? 0
  }
  if ((player.whirlwindGuardRemaining ?? 0) > 0) {
    reduction += player.whirlwindGuardDamageReductionPercent ?? 0
  }
  reduction += getRallyingBannerDamageReductionPercent(state)
  return Math.max(0, 1 - Math.min(75, reduction) / 100)
}

function applyFrostApplication(
  target: EnemyState,
  event: Readonly<DamageEvent>,
): void {
  const application = event.frostApplication
  if (!application || target.hp <= 0) {
    return
  }
  const controlFactor = 1 - Math.min(90, Math.max(0, target.controlResistance ?? 0)) / 100
  const stacks = Math.max(1, Math.floor(application.stacks * controlFactor))
  target.chillStacks = Math.min(
    FROST_MAX_CHILL_STACKS,
    (target.chillStacks ?? 0) + stacks,
  )
  target.chillRemainingDuration = Math.max(
    target.chillRemainingDuration ?? 0,
    Math.min(FROST_DEFAULT_DURATION_SECONDS, application.durationSeconds),
  )
  const threshold = application.freezeThreshold ?? FROST_MAX_CHILL_STACKS
  if (target.chillStacks >= threshold) {
    const freezeDuration = Math.min(
      FROST_DEFAULT_FREEZE_DURATION_SECONDS,
      application.freezeDurationSeconds ?? FROST_DEFAULT_FREEZE_DURATION_SECONDS,
    ) * controlFactor
    target.frozenRemainingDuration = Math.max(
      target.frozenRemainingDuration ?? 0,
      freezeDuration,
    )
    target.chillStacks = 0
    target.chillRemainingDuration = 0
  }
}

function applyShockApplication(
  target: EnemyState,
  event: Readonly<DamageEvent>,
  pendingEvents: DamageEvent[],
): void {
  const application = event.shockApplication
  if (!application || target.hp <= 0) {
    return
  }

  target.shockStacks = Math.min(
    SHOCK_MAX_STACKS,
    (target.shockStacks ?? 0) + Math.max(0, application.stacks),
  )
  target.shockRemainingDuration = Math.max(
    target.shockRemainingDuration ?? 0,
    Math.min(SHOCK_DEFAULT_DURATION_SECONDS, application.durationSeconds),
  )
  const threshold = application.threshold ?? SHOCK_MAX_STACKS
  if (target.shockStacks >= threshold) {
    target.shockStacks = 0
    target.shockRemainingDuration = 0
    pendingEvents.push({
      sourceId: event.sourceId,
      sourceSkillId: event.sourceSkillId,
      sourceTags: event.sourceTags,
      sourceLabel: 'Overload',
      targetId: target.id,
      damage: scaleDamageValues(event.damage, application.burstMultiplier ?? 1.5),
    })
  }
}

function applyGearFrostApplication(
  state: GameState,
  target: EnemyState,
  event: Readonly<DamageEvent>,
): void {
  const stacks = getDerivedPlayerStats(state.player).frostStacksOnHit
  if (stacks <= 0 || event.damageOverTime) {
    return
  }
  applyFrostApplication(target, {
    targetId: target.id,
    damage: createDamageValues(),
    frostApplication: {
      stacks,
      durationSeconds: FROST_DEFAULT_DURATION_SECONDS,
    },
  })
}

export function updateFrost(
  state: GameState,
  fixedStepSeconds: number,
): void {
  const elapsed = Math.max(0, fixedStepSeconds)
  for (const enemy of [...state.enemies, ...(state.bosses ?? [])]) {
    enemy.chillRemainingDuration = Math.max(
      0,
      (enemy.chillRemainingDuration ?? 0) - elapsed,
    )
    if (enemy.chillRemainingDuration <= 0) {
      enemy.chillStacks = 0
    }
    enemy.frozenRemainingDuration = Math.max(
      0,
      (enemy.frozenRemainingDuration ?? 0) - elapsed,
    )
    enemy.shockRemainingDuration = Math.max(
      0,
      (enemy.shockRemainingDuration ?? 0) - elapsed,
    )
    if (enemy.shockRemainingDuration <= 0) {
      enemy.shockStacks = 0
    }
  }
  state.player.whirlwindGuardRemaining = Math.max(
    0,
    (state.player.whirlwindGuardRemaining ?? 0) - elapsed,
  )
  if (getRallyingBannerEffects(state).length === 0) {
    state.player.rallyingBannerRemaining = Math.max(
      0,
      (state.player.rallyingBannerRemaining ?? 0) - elapsed,
    )
    if (state.player.rallyingBannerRemaining <= 0) {
      state.player.rallyingBannerDamageReductionPercent = 0
      state.player.rallyingBannerCooldownReductionPercent = 0
    }
  }
  state.player.aegisPulseShieldRemaining = Math.max(
    0,
    (state.player.aegisPulseShieldRemaining ?? 0) - elapsed,
  )
  if (state.player.aegisPulseShieldRemaining <= 0) {
    state.player.aegisPulseShieldAmount = 0
    state.player.aegisPulseShieldMaxAmount = 0
    state.player.aegisPulseShieldDuration = 0
  }
}

function applyPoisonApplication(
  state: GameState,
  target: EnemyState | PlayerState,
  event: Readonly<DamageEvent>,
  preMitigationDamage: Readonly<DamageValues>,
): void {
  const application = event.poisonApplication
  if (!application || target.hp <= 0) {
    return
  }
  const sourceDamage = preMitigationDamage.physical + preMitigationDamage.chaos
  const dotMultiplier = event.sourceId === state.player.id
    ? getDerivedPlayerStats(state.player).dotMultiplier
    : 0
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
    ...(event.sourceSkillId ? { sourceSkillId: event.sourceSkillId } : {}),
  })
}

export function updatePoison(
  state: GameState,
  fixedStepSeconds: number,
): DamageEvent[] {
  const events: DamageEvent[] = []
  const elapsed = Math.max(0, fixedStepSeconds)
  for (const target of [
    state.player,
    ...state.enemies,
    ...(state.bosses ?? []),
  ]) {
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
          ...(stack.sourceSkillId ? { sourceSkillId: stack.sourceSkillId } : {}),
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

function applyBurningApplication(
  state: Readonly<GameState>,
  target: EnemyState,
  event: Readonly<DamageEvent>,
  preMitigationDamage: Readonly<DamageValues>,
): void {
  const application = event.burningApplication
  if (!application || target.hp <= 0) {
    return
  }
  const dotMultiplier = event.sourceId === state.player.id
    ? getDerivedPlayerStats(state.player).dotMultiplier
    : 0
  const damagePerSecond = preMitigationDamage.fire *
    application.fireDamageRatio *
    (1 + dotMultiplier / 100)
  if (damagePerSecond <= 0) {
    return
  }
  target.burningStacks ??= []
  target.burningStacks.push({
    remainingDuration: application.durationSeconds,
    damagePerSecond,
    ...(event.sourceSkillId ? { sourceSkillId: event.sourceSkillId } : {}),
  })
}

export function updateBurning(
  state: GameState,
  fixedStepSeconds: number,
): DamageEvent[] {
  const events: DamageEvent[] = []
  const elapsed = Math.max(0, fixedStepSeconds)
  for (const target of [...state.enemies, ...(state.bosses ?? [])]) {
    if (!target.burningStacks || target.burningStacks.length === 0) {
      continue
    }
    for (const stack of target.burningStacks) {
      if (stack.remainingDuration <= 0 || stack.damagePerSecond <= 0) {
        continue
      }
      const damage = stack.damagePerSecond * Math.min(elapsed, stack.remainingDuration)
      if (damage > 0) {
        events.push({
          sourceLabel: 'Burning',
          ...(stack.sourceSkillId ? { sourceSkillId: stack.sourceSkillId } : {}),
          targetId: target.id,
          damage: createDamageValues({ fire: damage }),
          damageOverTime: true,
        })
      }
      stack.remainingDuration -= elapsed
    }
    target.burningStacks = target.burningStacks.filter(
      (stack) => stack.remainingDuration > 0 && stack.damagePerSecond > 0,
    )
  }
  return events
}

function applySoulTetherHealing(
  state: GameState,
  event: Readonly<DamageEvent>,
  actualDamage: number,
): void {
  if (
    event.sourceSkillId !== SOUL_TETHER_SKILL_ID ||
    event.sourceId !== state.player.id ||
    actualDamage <= 0
  ) {
    return
  }
  const ratio = state.player.soulTetherHealingRatio ?? 0
  if (ratio <= 0) {
    return
  }
  const healing = actualDamage * ratio
  if (state.run.selectedUpgradeIds.includes('synergy-soul-tether-vitality')) {
    state.player.soulTetherVitalityCharge = Math.min(
      20,
      (state.player.soulTetherVitalityCharge ?? 0) + healing * 0.5,
    )
  }
  healPlayer(state, healing, 'Soul Tether')
}

function triggerSoulTetherSnap(
  state: GameState,
  deadEnemy: Readonly<EnemyState | BossState>,
): DamageEvent[] {
  const events: DamageEvent[] = []
  const alreadyRetargeted = state.player.soulTetherHasRetargeted ?? false
  if (alreadyRetargeted) {
    state.player.soulTetherTargetId = undefined
    state.player.soulTetherRemaining = 0
    state.player.soulTetherDamagePerSecond = 0
    return events
  }

  const requiem = state.run.selectedUpgradeIds.includes('soul-tether-requiem')
  const burstTargetCount = requiem ? SOUL_TETHER_REQUIEM_BURST_TARGET_COUNT : 1
  const nearby = [...state.enemies, ...(state.bosses ?? [])]
    .filter((enemy) => enemy.hp > 0 && enemy.id !== deadEnemy.id)
    .map((enemy) => ({
      enemy,
      distanceSquared: (enemy.x - deadEnemy.x) ** 2 + (enemy.y - deadEnemy.y) ** 2,
    }))
    .sort((left, right) =>
      left.distanceSquared - right.distanceSquared || left.enemy.id - right.enemy.id,
    )
    .slice(0, burstTargetCount)
    .map((candidate) => candidate.enemy)

  if (nearby.length === 0) {
    state.player.soulTetherTargetId = undefined
    state.player.soulTetherRemaining = 0
    state.player.soulTetherDamagePerSecond = 0
    return events
  }

  const burstDamage = (state.player.soulTetherDamagePerSecond ?? 0) *
    SOUL_TETHER_SNAP_BURST_SECONDS_EQUIVALENT
  if (burstDamage > 0) {
    for (const enemy of nearby) {
      events.push({
        sourceId: state.player.id,
        sourceSkillId: SOUL_TETHER_SKILL_ID,
        sourceLabel: 'Soul Snap',
        sourceTags: ['chaos'],
        targetId: enemy.id,
        damage: createDamageValues({ chaos: burstDamage }),
      })
    }
  }

  const newTarget = nearby[0]!
  state.player.soulTetherTargetId = newTarget.id
  state.player.soulTetherDamagePerSecond =
    (state.player.soulTetherDamagePerSecond ?? 0) * SOUL_TETHER_RETARGET_DAMAGE_MULTIPLIER
  state.player.soulTetherHasRetargeted = true
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
          floorNumber: state.run.floor,
          chanceMultiplier: state.player.gearDropChanceMultiplier,
          spawnBalance,
        }),
      ) ?? false)
      if (randomGearDrop) {
        state.run.gearDropGenerated = true
        if (state.run.gearXpBlessingActive) {
          spawnPickup(
            { x: enemy.x, y: enemy.y },
            enemy.xpReward * GEAR_XP_BLESSING_MULTIPLIER,
          )
        } else {
          spawnGearPickup?.(
            { x: enemy.x, y: enemy.y },
            enemy.definitionId,
          )
        }
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
