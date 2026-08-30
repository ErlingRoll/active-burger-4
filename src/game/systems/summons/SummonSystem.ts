import type { EntityIdAllocator } from '../../ids'
import type {
  DamageEvent,
  GameState,
  SkillState,
  SummonState,
} from '../../state/GameState'
import {
  getSkillDefinition,
  RAISE_SKELETON_SKILL_ID,
  PHANTOM_ARSENAL_SKILL_ID,
  type SkillId,
} from '../../../content/skills/Skills'
import { getSkillDamageIncreasePercent } from '../../../content/upgrades/Upgrades'
import {
  createPlayerDamageEventFromStats,
  createPlayerDamageProfileFromStats,
} from '../../combat/DamageSources'
import {
  getProjectileDefinition,
  PHANTOM_ARSENAL_PROJECTILE_DEFINITION_ID,
  type ProjectileDefinitionId,
} from '../../../content/projectiles/Projectiles'
import { addDamageValues } from '../../../content/stats/Damage'
import { getDerivedPlayerStats } from '../../stats/DerivedStats'
import {
  clampPlayerPosition,
  getPlayerArenaBounds,
} from '../../../game-config/arena'
import {
  getFloorDifficultyProfile,
  getFloorStatMultiplier,
} from '../../../content/dungeons/Dungeons'
import {
  PHANTOM_ARSENAL_DURATION_SECONDS,
  PHANTOM_ARSENAL_MARKSMAN_RANGE_BONUS_PERCENT,
  PHANTOM_ARSENAL_MARKSMAN_DAMAGE_INCREASE_PERCENT,
  PHANTOM_ARSENAL_VOLLEY_MAX_COUNT_BONUS,
  PHANTOM_ARSENAL_VOLLEY_DAMAGE_REDUCTION_PERCENT,
} from '../../../game-config/skills'
import {
  getRallyingBannerCooldownReductionPercent,
  isPlayerInRallyingBanner,
} from '../skills/RallyingBanner'

const SUMMON_AGGRO_RANGE = 560
const SUMMON_MOVEMENT_SPEED = 180
const SUMMON_RADIUS = 16

function getSummonSkillId(summon: Readonly<SummonState>): SkillId {
  return summon.skillId ?? RAISE_SKELETON_SKILL_ID
}

function getSummonSkill(
  state: Readonly<GameState>,
  skillId: SkillId,
): SkillState | undefined {
  return state.player.skills.find((skill) => skill.skillId === skillId)
}

function getSummonCountBonus(
  state: Readonly<GameState>,
  skillId: SkillId,
): number {
  const hasLivingOtherSummon = state.summons.some((summon) =>
    summon.hp > 0 &&
    (summon.skillId ?? RAISE_SKELETON_SKILL_ID) !== skillId
  )
  const legionBonus = state.run.selectedUpgradeIds.includes(
    'synergy-phantom-arsenal-raise-skeleton',
  ) && hasLivingOtherSummon
    ? 1
    : 0
  const graveRallyBonus = skillId === RAISE_SKELETON_SKILL_ID &&
    state.run.selectedUpgradeIds.includes(
      'synergy-raise-skeleton-rallying-banner',
    ) &&
    isPlayerInRallyingBanner(state)
    ? 1
    : 0
  if (skillId === PHANTOM_ARSENAL_SKILL_ID) {
    const volley = state.run.selectedUpgradeIds.includes('phantom-arsenal-volley')
    return (state.player.phantomMaxCountBonus ?? 0) +
      (volley ? PHANTOM_ARSENAL_VOLLEY_MAX_COUNT_BONUS : 0) +
      legionBonus
  }
  return (state.player.skeletonMaxCountBonus ?? 0) +
    legionBonus +
    graveRallyBonus
}

function getSummonMaxHpBonus(
  state: Readonly<GameState>,
  skillId: SkillId,
): number {
  return skillId === PHANTOM_ARSENAL_SKILL_ID
    ? state.player.phantomMaxHpBonus ?? 0
    : state.player.skeletonMaxHpBonus ?? 0
}

function getSummonDamage(
  state: Readonly<GameState>,
  skill: Readonly<SkillState>,
): number {
  const definition = getSkillDefinition(skill.skillId)
  const levelIncrease = getSkillDamageIncreasePercent(
    skill.skillId,
    skill.level,
    state.run.selectedUpgradeIds,
  )
  let damage = (definition.summonBaseDamage ?? 0) * (1 + levelIncrease / 100)
  if (skill.skillId === PHANTOM_ARSENAL_SKILL_ID) {
    if (state.run.selectedUpgradeIds.includes('phantom-arsenal-marksman')) {
      damage *= 1 + PHANTOM_ARSENAL_MARKSMAN_DAMAGE_INCREASE_PERCENT / 100
    }
    if (state.run.selectedUpgradeIds.includes('phantom-arsenal-volley')) {
      damage *= 1 - PHANTOM_ARSENAL_VOLLEY_DAMAGE_REDUCTION_PERCENT / 100
    }
  }
  return damage
}

function getSkeletonFloorMaxHpMultiplier(state: Readonly<GameState>): number {
  const floor = state.run.floor ?? 1
  return getFloorStatMultiplier(floor) *
    getFloorDifficultyProfile(floor).ordinaryEnemyHpMultiplier
}

function getSummonMaxHp(
  state: Readonly<GameState>,
  skill: Readonly<SkillState>,
  definition: ReturnType<typeof getSkillDefinition>,
): number {
  const authoredMaxHp = (definition.summonBaseMaxHp ?? 10) +
    (definition.summonMaxHpPerLevel ?? 0) * Math.max(0, skill.level - 1)
  const floorMultiplier = skill.skillId === RAISE_SKELETON_SKILL_ID
    ? getSkeletonFloorMaxHpMultiplier(state)
    : 1
  return authoredMaxHp * floorMultiplier +
    getSummonMaxHpBonus(state, skill.skillId)
}

function fractionalPart(value: number): number {
  return value - Math.floor(value)
}

function initializeSwarmMovement(
  summon: SummonState,
  index: number,
): void {
  const seed = summon.id * 0.61803398875 + index * 0.41421356237
  if (
    summon.swarmAngle === undefined ||
    summon.swarmRadius === undefined ||
    summon.swarmAngularSpeed === undefined ||
    summon.swarmPhase === undefined
  ) {
    summon.swarmPhase = fractionalPart(seed)
    summon.swarmAngle = summon.swarmPhase * Math.PI * 2
    summon.swarmRadius = 44 + fractionalPart(seed * 1.73) * 8
    summon.swarmAngularSpeed = 0.7 + fractionalPart(seed * 2.41) * 0.8
  }
  summon.swarmMotionTime ??= 0
  summon.swarmPauseRemaining ??= 0
  summon.swarmNextPauseTime ??= 2.5 + fractionalPart(seed * 3.17) * 2.5
  summon.swarmPauseDuration ??= 0.25 + fractionalPart(seed * 4.07) * 0.45
}

function moveTowards(
  summon: SummonState,
  targetX: number,
  targetY: number,
  maxDistance: number,
): void {
  const offsetX = targetX - summon.x
  const offsetY = targetY - summon.y
  const distance = Math.hypot(offsetX, offsetY)
  if (distance <= maxDistance || distance <= 0) {
    summon.x = targetX
    summon.y = targetY
    return
  }
  const ratio = maxDistance / distance
  summon.x += offsetX * ratio
  summon.y += offsetY * ratio
}

function moveInSwarm(
  summon: SummonState,
  playerX: number,
  playerY: number,
  fixedStepSeconds: number,
): void {
  initializeSwarmMovement(summon, 0)
  const motionTime = (summon.swarmMotionTime ?? 0) + fixedStepSeconds
  summon.swarmMotionTime = motionTime
  const pauseRemaining = summon.swarmPauseRemaining ?? 0
  if (pauseRemaining > 0) {
    summon.swarmPauseRemaining = Math.max(0, pauseRemaining - fixedStepSeconds)
    return
  }
  const nextPauseTime = summon.swarmNextPauseTime ?? Number.POSITIVE_INFINITY
  if (motionTime >= nextPauseTime) {
    summon.swarmPauseRemaining = summon.swarmPauseDuration ?? 0.25
    summon.swarmNextPauseTime = nextPauseTime +
      2.5 + (summon.swarmPauseDuration ?? 0.25) * 2
    return
  }
  const angle = (summon.swarmAngle ?? 0) +
    (summon.swarmAngularSpeed ?? 0) * fixedStepSeconds
  summon.swarmAngle = angle % (Math.PI * 2)
  const phase = summon.swarmPhase ?? 0
  const radius = summon.swarmRadius ?? 36
  const targetX = playerX +
    Math.cos(angle) * radius +
    Math.sin(angle * 1.7 + phase * Math.PI * 2) * 8
  const targetY = playerY +
    Math.sin(angle) * radius +
    Math.cos(angle * 1.3 + phase * Math.PI * 2) * 8
  moveTowards(
    summon,
    targetX,
    targetY,
    SUMMON_MOVEMENT_SPEED * fixedStepSeconds,
  )
}

function moveTowardsTarget(
  summon: SummonState,
  target: Readonly<{ x: number; y: number }>,
  fixedStepSeconds: number,
): void {
  moveTowards(
    summon,
    target.x,
    target.y,
    SUMMON_MOVEMENT_SPEED * fixedStepSeconds,
  )
}

function isInsidePlayArea(
  entity: Readonly<{ x: number; y: number; radius: number }>,
): boolean {
  const bounds = getPlayerArenaBounds(entity.radius)
  return entity.x >= bounds.minX &&
    entity.x <= bounds.maxX &&
    entity.y >= bounds.minY &&
    entity.y <= bounds.maxY
}

function clampSummonPosition(summon: SummonState): void {
  const position = clampPlayerPosition(summon.x, summon.y, SUMMON_RADIUS)
  summon.x = position.x
  summon.y = position.y
}

export interface SummonStats {
  damage: number
  maxHp: number
  attackCooldown: number
  attackRange: number
  maximum: number
  ranged: boolean
  projectileDefinitionId?: ProjectileDefinitionId
  expiryDuration?: number
}

export function getSummonStats(
  state: Readonly<GameState>,
  skillId: SkillId,
): SummonStats | undefined {
  const skill = getSummonSkill(state, skillId)
  if (!skill) {
    return undefined
  }
  const definition = getSkillDefinition(skillId)
  const rallyingBannerCooldownReduction =
    getRallyingBannerCooldownReductionPercent(state)
  const isPhantom = skillId === PHANTOM_ARSENAL_SKILL_ID
  const marksman = isPhantom &&
    state.run.selectedUpgradeIds.includes('phantom-arsenal-marksman')
  const attackRange = (definition.summonAttackRange ?? 70) *
    (marksman ? 1 + PHANTOM_ARSENAL_MARKSMAN_RANGE_BONUS_PERCENT / 100 : 1)
  return {
    damage: getSummonDamage(state, skill),
    maxHp: getSummonMaxHp(state, skill, definition),
    attackCooldown: Math.max(
      0.1,
      (definition.summonAttackCooldown ?? 1) *
        (1 - Math.max(0, rallyingBannerCooldownReduction) / 100),
    ),
    attackRange,
    maximum: Math.max(
      1,
      Math.floor(
        (definition.summonBaseMaxCount ?? 1) +
          Math.max(0, getSummonCountBonus(state, skillId)),
      ),
    ),
    ranged: isPhantom,
    ...(isPhantom
      ? {
          projectileDefinitionId: PHANTOM_ARSENAL_PROJECTILE_DEFINITION_ID,
          expiryDuration: PHANTOM_ARSENAL_DURATION_SECONDS,
        }
      : {}),
  }
}

export function getSkeletonStats(
  state: Readonly<GameState>,
): SummonStats | undefined {
  return getSummonStats(state, RAISE_SKELETON_SKILL_ID)
}

export function getPhantomArsenalStats(
  state: Readonly<GameState>,
): SummonStats | undefined {
  return getSummonStats(state, PHANTOM_ARSENAL_SKILL_ID)
}

function summonIfReady(
  state: GameState,
  allocator: EntityIdAllocator,
  skillId: SkillId,
): boolean {
  const skill = getSummonSkill(state, skillId)
  if (!skill || skill.cooldownRemaining > 0) {
    return false
  }
  const stats = getSummonStats(state, skillId)
  const livingSummonCount = state.summons.filter(
    (summon) => summon.hp > 0 && getSummonSkillId(summon) === skillId,
  ).length
  if (!stats || livingSummonCount >= stats.maximum) {
    return false
  }
  const playerStats = getDerivedPlayerStats(state.player)
  const definition = getSkillDefinition(skillId)
  const index = livingSummonCount
  state.summons.push({
    id: allocator.createEntityId(),
    ownerId: state.player.id,
    skillId,
    x: state.player.x - 28 + index * 24,
    y: state.player.y + 20,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    contactCooldownRemaining: 0,
    attackCooldownRemaining: 0,
    ...(stats.expiryDuration !== undefined
      ? { expiryRemaining: stats.expiryDuration }
      : {}),
  })
  skill.cooldownRemaining = Math.max(
    0.1,
    (definition.cooldown ?? 5) *
      (1 - Math.max(0, playerStats.cooldownReduction) / 100),
  )
  return true
}

export function summonSkeletonIfReady(
  state: GameState,
  allocator: EntityIdAllocator,
): boolean {
  return summonIfReady(state, allocator, RAISE_SKELETON_SKILL_ID)
}

export function summonPhantomIfReady(
  state: GameState,
  allocator: EntityIdAllocator,
): boolean {
  return summonIfReady(state, allocator, PHANTOM_ARSENAL_SKILL_ID)
}

export function updateSummons(
  state: GameState,
  fixedStepSeconds: number,
  allocator: EntityIdAllocator,
): DamageEvent[] {
  const events: DamageEvent[] = []
  const playerStats = getDerivedPlayerStats(state.player)
  const statsCache = new Map<SkillId, SummonStats | undefined>()
  const getCachedStats = (skillId: SkillId): SummonStats | undefined => {
    if (!statsCache.has(skillId)) {
      statsCache.set(skillId, getSummonStats(state, skillId))
    }
    return statsCache.get(skillId)
  }
  const targets = [...state.enemies, ...(state.bosses ?? [])]
    .filter((enemy) => enemy.hp > 0)
    .filter((enemy) => isInsidePlayArea(enemy))
    .sort((left, right) => left.id - right.id)

  state.summons.forEach((summon, index) => {
    if (summon.hp <= 0) {
      return
    }
    if (summon.expiryRemaining !== undefined) {
      summon.expiryRemaining -= fixedStepSeconds
      if (summon.expiryRemaining <= 0) {
        summon.hp = 0
        return
      }
    }
    const skillId = getSummonSkillId(summon)
    const stats = getCachedStats(skillId)
    if (!stats) {
      summon.hp = 0
      return
    }
    clampSummonPosition(summon)
    initializeSwarmMovement(summon, index)
    summon.attackCooldownRemaining = Math.max(
      0,
      summon.attackCooldownRemaining - fixedStepSeconds,
    )
    const target = targets
      .map((enemy) => ({
        enemy,
        distanceSquared: (enemy.x - summon.x) ** 2 + (enemy.y - summon.y) ** 2,
      }))
      .filter((candidate) => candidate.distanceSquared <= SUMMON_AGGRO_RANGE ** 2)
      .sort((left, right) =>
        left.distanceSquared - right.distanceSquared || left.enemy.id - right.enemy.id,
      )[0]?.enemy
    if (target) {
      const distanceToTarget = Math.hypot(target.x - summon.x, target.y - summon.y)
      if (distanceToTarget > stats.attackRange) {
        moveTowardsTarget(summon, target, fixedStepSeconds)
      }
    } else {
      moveInSwarm(summon, state.player.x, state.player.y, fixedStepSeconds)
    }
    clampSummonPosition(summon)

    if (summon.attackCooldownRemaining > 0) {
      return
    }
    const attackTarget = targets
      .map((enemy) => ({
        enemy,
        distanceSquared: (enemy.x - summon.x) ** 2 + (enemy.y - summon.y) ** 2,
      }))
      .filter((candidate) => candidate.distanceSquared <= stats.attackRange ** 2)
      .sort((left, right) =>
        left.distanceSquared - right.distanceSquared || left.enemy.id - right.enemy.id,
      )[0]?.enemy
    if (!attackTarget) {
      return
    }
    summon.attackCooldownRemaining = stats.attackCooldown
    const skillDefinition = getSkillDefinition(skillId)

    if (stats.ranged && stats.projectileDefinitionId) {
      const projectileDefinition = getProjectileDefinition(stats.projectileDefinitionId)
      const outgoingDamage = createPlayerDamageProfileFromStats(
        playerStats,
        { physical: stats.damage },
        {
          isProjectile: true,
          sourceTags: skillDefinition.tags,
        },
      )
      const directionX = attackTarget.x - summon.x
      const directionY = attackTarget.y - summon.y
      const distance = Math.hypot(directionX, directionY) || 1
      const tethered = state.run.selectedUpgradeIds.includes(
        'synergy-soul-tether-phantom-arsenal',
      ) && state.player.soulTetherTargetId === attackTarget.id
      state.projectiles.push({
        id: allocator.createEntityId(),
        ownerId: summon.id,
        definitionId: projectileDefinition.id,
        skillId,
        targetId: attackTarget.id,
        sourceTags: skillDefinition.tags,
        x: summon.x,
        y: summon.y,
        velocityX: (directionX / distance) * projectileDefinition.speed,
        velocityY: (directionY / distance) * projectileDefinition.speed,
        radius: projectileDefinition.radius,
        damage: tethered
          ? addDamageValues(
              outgoingDamage.damage,
              { chaos: outgoingDamage.damage.physical * 0.25 },
            )
          : outgoingDamage.damage,
        criticalStrike: outgoingDamage.criticalStrike,
        remainingLifetime: projectileDefinition.lifetime,
      })
      return
    }

    const attackEffectLifetime = skillDefinition.effectLifetime
    state.effects.push({
      id: allocator.createEntityId(),
      skillId,
      shape: 'line',
      x: summon.x,
      y: summon.y,
      radius: stats.attackRange,
      lifetime: attackEffectLifetime,
      remainingLifetime: attackEffectLifetime,
      points: [
        { x: summon.x, y: summon.y },
        { x: attackTarget.x, y: attackTarget.y },
      ],
    })
    events.push(createPlayerDamageEventFromStats(
      playerStats,
      summon.id,
      attackTarget.id,
      skillId,
      { physical: stats.damage },
      { sourceTags: skillDefinition.tags },
    ))
  })
  return events
}

export function removeDeadSummons(state: GameState): void {
  state.summons = state.summons.filter((summon) => summon.hp > 0)
}
