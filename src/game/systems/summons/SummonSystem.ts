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
} from '../../../content/skills/Skills'
import { getSkillDamageIncreasePercent } from '../../../content/upgrades/Upgrades'
import { createPlayerDamageEventFromStats } from '../../combat/DamageSources'
import { getDerivedPlayerStats } from '../../stats/DerivedStats'

const SUMMON_CONTACT_DAMAGE_INTERVAL_SECONDS = 1
const SUMMON_AGGRO_RANGE = 560
const SUMMON_MOVEMENT_SPEED = 180

function getRaiseSkeletonSkill(
  state: Readonly<GameState>,
): SkillState | undefined {
  return state.player.skills.find(
    (skill) => skill.skillId === RAISE_SKELETON_SKILL_ID,
  )
}

function getMaximumSkeletons(
  state: Readonly<GameState>,
  skill: Readonly<SkillState>,
): number {
  const definition = getSkillDefinition(skill.skillId)
  return Math.max(
    1,
    Math.floor(
      (definition.summonBaseMaxCount ?? 1) +
        Math.max(0, state.player.skeletonMaxCountBonus ?? 0),
    ),
  )
}

function getSkeletonDamage(
  skill: Readonly<SkillState>,
): number {
  const definition = getSkillDefinition(skill.skillId)
  const levelIncrease = getSkillDamageIncreasePercent(
    skill.skillId,
    skill.level,
  )
  return (definition.summonBaseDamage ?? 0) * (1 + levelIncrease / 100)
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

export function getSkeletonStats(
  state: Readonly<GameState>,
): {
  damage: number
  maxHp: number
  attackCooldown: number
  attackRange: number
  maximum: number
} | undefined {
  const skill = getRaiseSkeletonSkill(state)
  if (!skill) {
    return undefined
  }
  const definition = getSkillDefinition(skill.skillId)
  return {
    damage: getSkeletonDamage(skill),
    maxHp: (definition.summonBaseMaxHp ?? 10) +
      (definition.summonMaxHpPerLevel ?? 0) * Math.max(0, skill.level - 1) +
      (state.player.skeletonMaxHpBonus ?? 0),
    attackCooldown: definition.summonAttackCooldown ?? 1,
    attackRange: definition.summonAttackRange ?? 70,
    maximum: getMaximumSkeletons(state, skill),
  }
}

export function summonSkeletonIfReady(
  state: GameState,
  allocator: EntityIdAllocator,
): boolean {
  const skill = getRaiseSkeletonSkill(state)
  if (!skill || skill.cooldownRemaining > 0) {
    return false
  }
  const stats = getSkeletonStats(state)
  const livingSummonCount = state.summons.filter((summon) => summon.hp > 0).length
  if (!stats || livingSummonCount >= stats.maximum) {
    return false
  }
  const playerStats = getDerivedPlayerStats(state.player)
  const definition = getSkillDefinition(skill.skillId)
  const index = livingSummonCount
  state.summons.push({
    id: allocator.createEntityId(),
    ownerId: state.player.id,
    x: state.player.x - 28 + index * 24,
    y: state.player.y + 20,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    contactCooldownRemaining: 0,
    attackCooldownRemaining: 0,
  })
  skill.cooldownRemaining = Math.max(
    0.1,
    (definition.cooldown ?? 5) *
      (1 - Math.max(0, playerStats.cooldownReduction) / 100),
  )
  return true
}

export function updateSummons(
  state: GameState,
  fixedStepSeconds: number,
  allocator: EntityIdAllocator,
): DamageEvent[] {
  const events: DamageEvent[] = []
  const stats = getSkeletonStats(state)
  if (!stats) {
    state.summons = []
    return events
  }
  const playerStats = getDerivedPlayerStats(state.player)
  const targets = [...state.enemies, ...(state.bosses ?? [])]
    .filter((enemy) => enemy.hp > 0)
    .sort((left, right) => left.id - right.id)

  state.summons.forEach((summon, index) => {
    if (summon.hp <= 0) {
      return
    }
    initializeSwarmMovement(summon, index)
    summon.attackCooldownRemaining = Math.max(
      0,
      summon.attackCooldownRemaining - fixedStepSeconds,
    )
    summon.contactCooldownRemaining = Math.max(
      0,
      summon.contactCooldownRemaining - fixedStepSeconds,
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

    const contactTarget = targets.find((enemy) => {
      const distance = Math.hypot(enemy.x - summon.x, enemy.y - summon.y)
      return distance <= enemy.radius + 16
    })
    if (contactTarget && summon.contactCooldownRemaining <= 0) {
      events.push({
        sourceId: contactTarget.id,
        targetId: summon.id,
        damage: {
          physical: contactTarget.contactDamage,
          lightning: 0,
          fire: 0,
          cold: 0,
          chaos: 0,
        },
      })
      summon.contactCooldownRemaining = SUMMON_CONTACT_DAMAGE_INTERVAL_SECONDS
    }

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
    const attackEffectLifetime = getSkillDefinition(
      RAISE_SKELETON_SKILL_ID,
    ).effectLifetime
    state.effects.push({
      id: allocator.createEntityId(),
      skillId: RAISE_SKELETON_SKILL_ID,
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
      RAISE_SKELETON_SKILL_ID,
      { physical: stats.damage },
      { sourceTags: getSkillDefinition(RAISE_SKELETON_SKILL_ID).tags },
    ))
  })
  return events
}

export function removeDeadSummons(state: GameState): void {
  state.summons = state.summons.filter((summon) => summon.hp > 0)
}
