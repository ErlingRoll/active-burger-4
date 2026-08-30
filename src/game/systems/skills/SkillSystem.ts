import {
  BASIC_ATTACK_SKILL_ID,
  CHAIN_LIGHTNING_SKILL_ID,
  getSkillDefinition,
  getSkillDamage,
  getSkillHealing,
  getSkillShieldAmount,
  getEffectiveSkillCooldown,
  type SkillId,
  RAISE_SKELETON_SKILL_ID,
  VITALITY_SKILL_ID,
  WHIRLWIND_SKILL_ID,
  GLACIAL_ORB_SKILL_ID,
  LANCERS_CHARGE_SKILL_ID,
  RALLYING_STANDARD_SKILL_ID,
  GRAVITY_WELL_SKILL_ID,
  AEGIS_PULSE_SKILL_ID,
} from '../../../content/skills/Skills'
import {
  getSkillCooldownReductionPercent,
  getSkillDamageIncreasePercent,
  getSkillSynergyEffectPercent,
} from '../../../content/upgrades/Upgrades'
import {
  createProjectileSpreadAngles,
  getProjectileDefinition,
} from '../../../content/projectiles/Projectiles'
import {
  GLACIAL_ORB_ICE_LANCE_DAMAGE_INCREASE_PERCENT,
  GLACIAL_ORB_PERMAFROST_RADIUS_BONUS,
  GLACIAL_ORB_PERMAFROST_EXTRA_CHILL_STACKS,
  LANCERS_CHARGE_MAX_MOMENTUM_STACKS,
  LANCERS_CHARGE_MOMENTUM_PERCENT_PER_STACK,
  LANCERS_CHARGE_VANGUARD_MOMENTUM_PERCENT_PER_STACK,
  LANCERS_CHARGE_VANGUARD_SINGLE_TARGET_BONUS_PERCENT,
  LANCERS_CHARGE_IMPALER_DAMAGE_REDUCTION_PERCENT,
  LANCERS_CHARGE_IMPALER_RANGE_BONUS,
  LANCERS_CHARGE_IMPALER_WIDTH_BONUS,
  LANCERS_CHARGE_MOMENTUM_DECAY_SECONDS,
  RALLYING_STANDARD_BASE_DURATION_SECONDS,
  RALLYING_STANDARD_HEAL_INTERVAL_SECONDS,
  RALLYING_STANDARD_EFFECT_RADIUS,
  RALLYING_STANDARD_BASE_DAMAGE_REDUCTION_PERCENT,
  RALLYING_STANDARD_BULWARK_DAMAGE_REDUCTION_BONUS_PERCENT,
  RALLYING_STANDARD_BULWARK_DURATION_BONUS_SECONDS,
  RALLYING_STANDARD_COMMANDER_COOLDOWN_REDUCTION_PERCENT,
  GRAVITY_WELL_BASE_PULL_DISTANCE,
  GRAVITY_WELL_SINGULARITY_PULL_BONUS,
  GRAVITY_WELL_SINGULARITY_RADIUS_BONUS,
  GRAVITY_WELL_EVENT_HORIZON_DAMAGE_INCREASE_PERCENT,
  AEGIS_PULSE_BASE_DURATION_SECONDS,
  AEGIS_PULSE_BULWARK_SHIELD_AMOUNT_BONUS,
  AEGIS_PULSE_BULWARK_DURATION_BONUS_SECONDS,
} from '../../../game-config/skills'
import type { EntityIdAllocator } from '../../ids'
import type { RandomSource } from '../../random/Random'
import {
  createPlayerDamageEventFromStats,
} from '../../combat/DamageSources'
import type {
  SkillState,
  DamageEvent,
  EnemyState,
  BossState,
  GameState,
  SkillEffectPoint,
  SkillEffectState,
  ProjectileState,
  FrostApplication,
} from '../../state/GameState'
import {
  healPlayer,
  healSummon,
} from '../../combat/PlayerCombatLog'
import { getDerivedPlayerStats } from '../../stats/DerivedStats'
import { summonSkeletonIfReady } from '../summons/SummonSystem'
import { clampPlayerPosition } from '../../../game-config/arena'

function scaleAreaValue(value: number, areaOfEffect: number): number {
  return value * (1 + Math.max(0, areaOfEffect) / 100)
}

function addEffect(
  state: GameState,
  allocator: EntityIdAllocator,
  skillId: SkillId,
  points: readonly SkillEffectPoint[],
  radius: number,
  lifetime: number,
  shape?: 'arc' | 'line',
  periodicHealingAmount?: number,
): void {
  const origin = points[0]
  if (!origin) {
    return
  }
  const effect: SkillEffectState = {
    id: allocator.createEntityId(),
    skillId,
    ...(shape ? { shape } : {}),
    x: origin.x,
    y: origin.y,
    radius,
    remainingLifetime: lifetime,
    lifetime,
    points: points.map((point) => ({ x: point.x, y: point.y })),
    ...(periodicHealingAmount === undefined
      ? {}
      : {
          periodicHealingAmount,
          periodicHealingRemaining: RALLYING_STANDARD_HEAL_INTERVAL_SECONDS,
        }),
  }
  state.effects.push(effect)
}

export function updateSkillCooldowns(
  state: GameState,
  fixedStepSeconds: number,
): void {
  for (const skill of state.player.skills) {
    if (skill.skillId === BASIC_ATTACK_SKILL_ID) {
      continue
    }
    skill.cooldownRemaining = Math.max(
      0,
      skill.cooldownRemaining - fixedStepSeconds,
    )
  }
  state.player.lancerMomentumDecayRemaining = Math.max(
    0,
    (state.player.lancerMomentumDecayRemaining ?? 0) - fixedStepSeconds,
  )
  if (state.player.lancerMomentumDecayRemaining <= 0) {
    state.player.lancerMomentumStacks = 0
  }
}

export function updateSkillEffects(
  state: GameState,
  fixedStepSeconds: number,
  random?: Pick<RandomSource, 'next'>,
): void {
  const elapsed = Math.max(0, fixedStepSeconds)
  for (const effect of state.effects) {
    effect.remainingLifetime -= elapsed
    if (
      effect.skillId !== RALLYING_STANDARD_SKILL_ID ||
      effect.periodicHealingAmount === undefined
    ) {
      continue
    }
    effect.periodicHealingRemaining =
      (effect.periodicHealingRemaining ?? RALLYING_STANDARD_HEAL_INTERVAL_SECONDS) -
      elapsed
    while (
      effect.remainingLifetime > 0 &&
      (effect.periodicHealingRemaining ?? 0) <= 0
    ) {
      const healing = effect.periodicHealingAmount
      if (
        Math.hypot(state.player.x - effect.x, state.player.y - effect.y) <=
        effect.radius + state.player.radius
      ) {
        healPlayer(state, healing, getSkillDefinition(RALLYING_STANDARD_SKILL_ID).name, random)
      }
      for (const summon of state.summons) {
        if (
          summon.hp > 0 &&
          Math.hypot(summon.x - effect.x, summon.y - effect.y) <= effect.radius
        ) {
          healSummon(state, summon, healing, random)
        }
      }
      effect.periodicHealingRemaining =
        (effect.periodicHealingRemaining ?? 0) +
        RALLYING_STANDARD_HEAL_INTERVAL_SECONDS
    }
  }
  state.effects = state.effects.filter((effect) => effect.remainingLifetime > 0)
}

function getSkillCooldown(
  state: Readonly<GameState>,
  skill: Readonly<SkillState>,
  baseCooldown: number,
): number {
  const playerStats = getDerivedPlayerStats(state.player)
  const skillCooldownReduction = getSkillCooldownReductionPercent(
    skill.skillId,
    state.run.selectedUpgradeIds,
  )
  const rallyingStandardCooldownReduction =
    (state.player.rallyingStandardRemaining ?? 0) > 0
      ? state.player.rallyingStandardCooldownReductionPercent ?? 0
      : 0
  return getEffectiveSkillCooldown(
    baseCooldown,
    playerStats.cooldownReduction +
      skillCooldownReduction +
      rallyingStandardCooldownReduction,
  )
}

function markSkillUsed(skill: SkillState): void {
  skill.castCount = (skill.castCount ?? 0) + 1
}

function collectWhirlwindDamage(
  state: GameState,
  skill: SkillState,
  allocator: EntityIdAllocator,
): DamageEvent[] {
  const definition = getSkillDefinition(WHIRLWIND_SKILL_ID)
  const playerStats = getDerivedPlayerStats(state.player)
  const radius = scaleAreaValue(
    definition.radius ?? 0,
    playerStats.areaOfEffect,
  )
  const damage = getSkillDamage(definition, skill.level)
  const events: DamageEvent[] = []

  const enemies = [...state.enemies, ...(state.bosses ?? [])].sort(
    (left, right) => left.id - right.id,
  )
  for (const enemy of enemies) {
    if (enemy.hp <= 0) {
      continue
    }
    const distance = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y)
    if (distance > radius + enemy.radius) {
      continue
    }
    const event = createPlayerDamageEventFromStats(
      playerStats,
      state.player.id,
      enemy.id,
      skill.skillId,
      damage,
      {
        sourceTags: definition.tags,
        additionalIncreasedDamage: {
          global: getSkillDamageIncreasePercent(
            skill.skillId,
            skill.level,
            state.run.selectedUpgradeIds,
          ),
        },
      },
    )
    if (state.run.selectedUpgradeIds.includes('whirlwind-frost')) {
      event.frostApplication = {
      stacks: 1,
      durationSeconds: 4,
      freezeThreshold: 3,
      freezeDurationSeconds: 1,
      }
    }
    events.push(event)
  }

  if (events.length > 0) {
    if (state.run.selectedUpgradeIds.includes('whirlwind-guard')) {
      state.player.whirlwindGuardRemaining = 1
    }
    addEffect(
      state,
      allocator,
      skill.skillId,
      [{ x: state.player.x, y: state.player.y }],
      radius,
      definition.effectLifetime,
    )
    skill.cooldownRemaining = getSkillCooldown(state, skill, definition.cooldown)
    markSkillUsed(skill)
  }
  return events
}

function collectChainLightningDamage(
  state: GameState,
  skill: SkillState,
  allocator: EntityIdAllocator,
): DamageEvent[] {
  const definition = getSkillDefinition(CHAIN_LIGHTNING_SKILL_ID)
  const maxRange = definition.maxRange ?? 0
  const jumpRange = definition.jumpRange ?? 0
  const maxTargets = definition.maxTargets ?? 1
  const playerStats = getDerivedPlayerStats(state.player)
  const damage = getSkillDamage(definition, skill.level)
  const events: DamageEvent[] = []
  const visited = new Set<number>()
  let originX = state.player.x
  let originY = state.player.y
  const path: SkillEffectPoint[] = [{ x: originX, y: originY }]

  for (let jump = 0; jump < maxTargets; jump += 1) {
    let target = undefined
    let targetDistanceSquared = Number.POSITIVE_INFINITY
    const range = jump === 0 ? maxRange : jumpRange
    const rangeSquared = range * range
    for (const enemy of [...state.enemies, ...(state.bosses ?? [])]) {
      if (enemy.hp <= 0 || visited.has(enemy.id)) {
        continue
      }
      const offsetX = enemy.x - originX
      const offsetY = enemy.y - originY
      const distanceSquared = offsetX * offsetX + offsetY * offsetY
      if (
        distanceSquared > rangeSquared ||
        distanceSquared > targetDistanceSquared ||
        (distanceSquared === targetDistanceSquared &&
          target !== undefined &&
          enemy.id > target.id)
      ) {
        continue
      }
      target = enemy
      targetDistanceSquared = distanceSquared
    }

    if (!target) {
      break
    }

    visited.add(target.id)
    const event = createPlayerDamageEventFromStats(
      playerStats,
      state.player.id,
      target.id,
      skill.skillId,
      damage,
      {
        sourceTags: definition.tags,
        additionalIncreasedDamage: {
          global: getSkillDamageIncreasePercent(
            skill.skillId,
            skill.level,
            state.run.selectedUpgradeIds,
          ),
        },
      },
    )
    if (state.run.selectedUpgradeIds.includes('chain-lightning-frost')) {
      event.frostApplication = {
      stacks: 1,
      durationSeconds: 4,
      freezeThreshold: 3,
      freezeDurationSeconds: 1,
      }
    }
    if (state.run.selectedUpgradeIds.includes('chain-lightning-overload')) {
      event.shockApplication = {
      stacks: 1,
      durationSeconds: 4,
      threshold: 3,
      burstMultiplier: 1.5,
      }
    }
    events.push(event)
    path.push({ x: target.x, y: target.y })
    originX = target.x
    originY = target.y
  }

  if (events.length > 0) {
    addEffect(
      state,
      allocator,
      skill.skillId,
      path,
      16,
      definition.effectLifetime,
    )
    skill.cooldownRemaining = getSkillCooldown(state, skill, definition.cooldown)
    markSkillUsed(skill)
  }
  return events
}

function collectVitalityHealing(
  state: GameState,
  skill: SkillState,
  allocator: EntityIdAllocator,
  random?: Pick<RandomSource, 'next'>,
): DamageEvent[] {
  const definition = getSkillDefinition(VITALITY_SKILL_ID)
  let healing = getSkillHealing(definition, skill.level)
  healing += state.player.maxHp *
    (state.player.vitalityMaxHpHealingPercent ?? 0) / 100
  if (
    state.player.hp / Math.max(1, state.player.maxHp) <= 0.4 &&
    state.player.vitalityLowHpHealingMultiplier
  ) {
    healing *= state.player.vitalityLowHpHealingMultiplier
  }
  healing *= 1 + getSkillSynergyEffectPercent(
    skill.skillId,
    state.run.selectedUpgradeIds,
    'healingIncreasePercent',
  ) / 100
  healPlayer(
    state,
    healing,
    definition.name,
    random,
  )
  addEffect(
    state,
    allocator,
    skill.skillId,
    [{ x: state.player.x, y: state.player.y }],
    28,
    definition.effectLifetime,
  )
  skill.cooldownRemaining = getSkillCooldown(state, skill, definition.cooldown)
  markSkillUsed(skill)
  return []
}

function findNearestLivingTarget(
  state: GameState,
  maxRange: number,
): EnemyState | BossState | undefined {
  const maxRangeSquared = maxRange * maxRange
  let target: EnemyState | BossState | undefined
  let targetDistanceSquared = Number.POSITIVE_INFINITY
  for (const enemy of [...state.enemies, ...(state.bosses ?? [])]) {
    if (enemy.hp <= 0) {
      continue
    }
    const offsetX = enemy.x - state.player.x
    const offsetY = enemy.y - state.player.y
    const distanceSquared = offsetX * offsetX + offsetY * offsetY
    if (distanceSquared > maxRangeSquared) {
      continue
    }
    if (
      distanceSquared < targetDistanceSquared ||
      (distanceSquared === targetDistanceSquared &&
        (target === undefined || enemy.id < target.id))
    ) {
      target = enemy
      targetDistanceSquared = distanceSquared
    }
  }
  return target
}

function createGlacialOrbProjectile(
  state: GameState,
  allocator: EntityIdAllocator,
  target: EnemyState | BossState,
  damage: DamageEvent['damage'],
  criticalStrike: DamageEvent['criticalStrike'],
  spreadAngleRadians: number,
  impactRadius: number,
  impactEffectRadius: number,
  impactFrostApplication: FrostApplication,
): ProjectileState {
  const skillDefinition = getSkillDefinition(GLACIAL_ORB_SKILL_ID)
  const definitionId = skillDefinition.projectileDefinitionId
  if (!definitionId) {
    throw new Error('Glacial Orb must define a projectile.')
  }
  const projectileDefinition = getProjectileDefinition(definitionId)
  const directionX = target.x - state.player.x
  const directionY = target.y - state.player.y
  const distance = Math.hypot(directionX, directionY)
  const directionAngle = Math.atan2(directionY, directionX) + spreadAngleRadians

  return {
    id: allocator.createEntityId(),
    ownerId: state.player.id,
    definitionId: projectileDefinition.id,
    skillId: GLACIAL_ORB_SKILL_ID,
    targetId: target.id,
    sourceTags: skillDefinition.tags,
    x: state.player.x,
    y: state.player.y,
    velocityX: Math.cos(directionAngle) * projectileDefinition.speed,
    velocityY: Math.sin(directionAngle) * projectileDefinition.speed,
    radius: projectileDefinition.radius,
    damage,
    criticalStrike,
    impactRadius,
    impactEffectRadius,
    impactFrostApplication,
    remainingLifetime: Math.max(
      0.1,
      Math.min(projectileDefinition.lifetime, distance / projectileDefinition.speed),
    ),
  }
}

function collectGlacialOrbDamage(
  state: GameState,
  skill: SkillState,
  allocator: EntityIdAllocator,
): DamageEvent[] {
  const definition = getSkillDefinition(GLACIAL_ORB_SKILL_ID)
  const playerStats = getDerivedPlayerStats(state.player)
  const permafrost = state.run.selectedUpgradeIds.includes('glacial-orb-permafrost')
  const iceLance = state.run.selectedUpgradeIds.includes('glacial-orb-ice-lance')
  const target = findNearestLivingTarget(state, definition.maxRange ?? 0)
  if (!target) {
    return []
  }

  const damage = getSkillDamage(definition, skill.level)
  const damageIncreasePercent = getSkillDamageIncreasePercent(
    skill.skillId,
    skill.level,
    state.run.selectedUpgradeIds,
  )
  const explosionRadius = scaleAreaValue(
    (definition.radius ?? 0) + (permafrost ? GLACIAL_ORB_PERMAFROST_RADIUS_BONUS : 0),
    playerStats.areaOfEffect,
  )
  const isChilledOrFrozen = (target.chillStacks ?? 0) > 0 ||
    (target.frozenRemainingDuration ?? 0) > 0
  const iceLanceBonus = iceLance && isChilledOrFrozen
    ? GLACIAL_ORB_ICE_LANCE_DAMAGE_INCREASE_PERCENT
    : 0
  const damageEvent = createPlayerDamageEventFromStats(
    playerStats,
    state.player.id,
    target.id,
    skill.skillId,
    damage,
    {
      sourceTags: definition.tags,
      additionalIncreasedDamage: {
        global: damageIncreasePercent + iceLanceBonus,
      },
    },
  )
  const impactFrostApplication: FrostApplication = {
    stacks: permafrost ? 1 + GLACIAL_ORB_PERMAFROST_EXTRA_CHILL_STACKS : 1,
    durationSeconds: 4,
    freezeThreshold: 3,
    freezeDurationSeconds: 1,
  }
  const projectileCount = 1 + Math.max(
    0,
    Math.trunc(playerStats.globalExtraProjectiles),
  )
  const spreadAngles = createProjectileSpreadAngles(
    projectileCount,
    definition.spreadDegrees ?? 0,
  )
  state.projectiles.push(
    ...spreadAngles.map((spreadAngleRadians) =>
      createGlacialOrbProjectile(
        state,
        allocator,
        target,
        damageEvent.damage,
        damageEvent.criticalStrike,
        spreadAngleRadians,
        iceLance ? 0 : explosionRadius,
        iceLance ? 10 : explosionRadius,
        impactFrostApplication,
      ),
    ),
  )

  skill.cooldownRemaining = getSkillCooldown(state, skill, definition.cooldown)
  markSkillUsed(skill)
  return []
}

function collectLancersChargeDamage(
  state: GameState,
  skill: SkillState,
  allocator: EntityIdAllocator,
): DamageEvent[] {
  const definition = getSkillDefinition(LANCERS_CHARGE_SKILL_ID)
  const playerStats = getDerivedPlayerStats(state.player)
  const vanguard = state.run.selectedUpgradeIds.includes('lancers-charge-vanguard')
  const impaler = state.run.selectedUpgradeIds.includes('lancers-charge-impaler')
  const length = (definition.maxRange ?? 0) + (impaler ? LANCERS_CHARGE_IMPALER_RANGE_BONUS : 0)
  const halfWidth = scaleAreaValue(
    (definition.radius ?? 0) + (impaler ? LANCERS_CHARGE_IMPALER_WIDTH_BONUS : 0),
    playerStats.areaOfEffect,
  )
  const target = findNearestLivingTarget(state, length)
  if (!target) {
    return []
  }

  const originX = state.player.x
  const originY = state.player.y
  const directionX = target.x - originX
  const directionY = target.y - originY
  const directionLength = Math.hypot(directionX, directionY) || 1
  const forwardX = directionX / directionLength
  const forwardY = directionY / directionLength
  const dashDistance = Math.min(
    length,
    Math.max(
      0,
      directionLength - target.radius - state.player.radius - 4,
    ),
  )
  const dashDestination = clampPlayerPosition(
    state.player.x + forwardX * dashDistance,
    state.player.y + forwardY * dashDistance,
    state.player.radius,
  )
  state.player.x = dashDestination.x
  state.player.y = dashDestination.y

  const struck = [...state.enemies, ...(state.bosses ?? [])]
    .filter((enemy) => enemy.hp > 0)
    .filter((enemy) => {
      const offsetX = enemy.x - originX
      const offsetY = enemy.y - originY
      const forward = offsetX * forwardX + offsetY * forwardY
      const lateral = Math.abs(offsetX * -forwardY + offsetY * forwardX)
      return (
        forward >= -enemy.radius &&
        forward <= length + enemy.radius &&
        lateral <= halfWidth + enemy.radius
      )
    })
    .sort((left, right) => left.id - right.id)

  const damage = getSkillDamage(definition, skill.level)
  const levelIncrease = getSkillDamageIncreasePercent(
    skill.skillId,
    skill.level,
    state.run.selectedUpgradeIds,
  )
  const momentumStacks = Math.min(
    LANCERS_CHARGE_MAX_MOMENTUM_STACKS,
    Math.max(0, state.player.lancerMomentumStacks ?? 0),
  )
  const momentumPercentPerStack = vanguard
    ? LANCERS_CHARGE_VANGUARD_MOMENTUM_PERCENT_PER_STACK
    : LANCERS_CHARGE_MOMENTUM_PERCENT_PER_STACK
  const singleTargetBonus = vanguard && struck.length === 1
    ? LANCERS_CHARGE_VANGUARD_SINGLE_TARGET_BONUS_PERCENT
    : 0
  const impalerPenalty = impaler ? -LANCERS_CHARGE_IMPALER_DAMAGE_REDUCTION_PERCENT : 0
  const damageIncreasePercent = levelIncrease +
    momentumStacks * momentumPercentPerStack +
    singleTargetBonus +
    impalerPenalty

  const events: DamageEvent[] = struck.map((enemy) =>
    createPlayerDamageEventFromStats(
      playerStats,
      state.player.id,
      enemy.id,
      skill.skillId,
      damage,
      {
        sourceTags: definition.tags,
        additionalIncreasedDamage: { global: damageIncreasePercent },
      },
    ),
  )

  state.player.lancerMomentumStacks = Math.min(
    LANCERS_CHARGE_MAX_MOMENTUM_STACKS,
    momentumStacks + 1,
  )
  state.player.lancerMomentumDecayRemaining = LANCERS_CHARGE_MOMENTUM_DECAY_SECONDS

  addEffect(
    state,
    allocator,
    skill.skillId,
    [
      { x: originX, y: originY },
      { x: originX + forwardX * length, y: originY + forwardY * length },
    ],
    halfWidth,
    definition.effectLifetime,
    'line',
  )
  skill.cooldownRemaining = getSkillCooldown(state, skill, definition.cooldown)
  markSkillUsed(skill)
  return events
}

function collectRallyingStandardEffect(
  state: GameState,
  skill: SkillState,
  allocator: EntityIdAllocator,
  random?: Pick<RandomSource, 'next'>,
): DamageEvent[] {
  const definition = getSkillDefinition(RALLYING_STANDARD_SKILL_ID)
  const bulwark = state.run.selectedUpgradeIds.includes('rallying-standard-bulwark')
  const commander = state.run.selectedUpgradeIds.includes('rallying-standard-commander')
  const healing = getSkillHealing(definition, skill.level) *
    (1 + getSkillSynergyEffectPercent(
      skill.skillId,
      state.run.selectedUpgradeIds,
      'healingIncreasePercent',
    ) / 100)
  healPlayer(state, healing, definition.name, random)

  const duration = RALLYING_STANDARD_BASE_DURATION_SECONDS +
    (bulwark ? RALLYING_STANDARD_BULWARK_DURATION_BONUS_SECONDS : 0)
  state.player.rallyingStandardRemaining = duration
  state.player.rallyingStandardDamageReductionPercent =
    RALLYING_STANDARD_BASE_DAMAGE_REDUCTION_PERCENT +
    (bulwark ? RALLYING_STANDARD_BULWARK_DAMAGE_REDUCTION_BONUS_PERCENT : 0)
  state.player.rallyingStandardCooldownReductionPercent = commander
    ? RALLYING_STANDARD_COMMANDER_COOLDOWN_REDUCTION_PERCENT
    : 0

  addEffect(
    state,
    allocator,
    skill.skillId,
    [{ x: state.player.x, y: state.player.y }],
    RALLYING_STANDARD_EFFECT_RADIUS,
    duration,
    undefined,
    healing,
  )
  skill.cooldownRemaining = getSkillCooldown(state, skill, definition.cooldown)
  markSkillUsed(skill)
  return []
}

function collectGravityWellDamage(
  state: GameState,
  skill: SkillState,
  allocator: EntityIdAllocator,
): DamageEvent[] {
  const definition = getSkillDefinition(GRAVITY_WELL_SKILL_ID)
  const playerStats = getDerivedPlayerStats(state.player)
  const singularity = state.run.selectedUpgradeIds.includes('gravity-well-singularity')
  const eventHorizon = state.run.selectedUpgradeIds.includes('gravity-well-event-horizon')
  const radius = scaleAreaValue(
    (definition.radius ?? 0) + (singularity ? GRAVITY_WELL_SINGULARITY_RADIUS_BONUS : 0),
    playerStats.areaOfEffect,
  )
  const pullDistance = eventHorizon
    ? 0
    : GRAVITY_WELL_BASE_PULL_DISTANCE + (singularity ? GRAVITY_WELL_SINGULARITY_PULL_BONUS : 0)
  const damage = getSkillDamage(definition, skill.level)
  const damageIncreasePercent = getSkillDamageIncreasePercent(
    skill.skillId,
    skill.level,
    state.run.selectedUpgradeIds,
  ) +
    (eventHorizon ? GRAVITY_WELL_EVENT_HORIZON_DAMAGE_INCREASE_PERCENT : 0)

  const affected = [...state.enemies, ...(state.bosses ?? [])]
    .filter((enemy) => enemy.hp > 0)
    .filter((enemy) => Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y) <= radius + enemy.radius)
    .sort((left, right) => left.id - right.id)

  if (affected.length === 0) {
    return []
  }

  const events: DamageEvent[] = affected.map((enemy) => {
    if (pullDistance > 0) {
      const distance = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y)
      const minDistance = enemy.radius + state.player.radius + 8
      const controlFactor = 1 - Math.min(90, Math.max(0, enemy.controlResistance ?? 0)) / 100
      const pull = Math.min(pullDistance, Math.max(0, distance - minDistance)) * controlFactor
      if (pull > 0 && distance > 0) {
        enemy.x += ((state.player.x - enemy.x) / distance) * pull
        enemy.y += ((state.player.y - enemy.y) / distance) * pull
      }
    }
    const event = createPlayerDamageEventFromStats(
      playerStats,
      state.player.id,
      enemy.id,
      skill.skillId,
      damage,
      {
        sourceTags: definition.tags,
        additionalIncreasedDamage: { global: damageIncreasePercent },
      },
    )
    if (singularity) {
      event.frostApplication = {
        stacks: 1,
        durationSeconds: 4,
        freezeThreshold: 3,
        freezeDurationSeconds: 1,
      }
    }
    return event
  })

  addEffect(
    state,
    allocator,
    skill.skillId,
    [{ x: state.player.x, y: state.player.y }],
    radius,
    definition.effectLifetime,
  )
  skill.cooldownRemaining = getSkillCooldown(state, skill, definition.cooldown)
  markSkillUsed(skill)
  return events
}

function collectAegisPulseDamage(
  state: GameState,
  skill: SkillState,
  allocator: EntityIdAllocator,
): DamageEvent[] {
  const definition = getSkillDefinition(AEGIS_PULSE_SKILL_ID)
  const playerStats = getDerivedPlayerStats(state.player)
  const bulwark = state.run.selectedUpgradeIds.includes('aegis-pulse-bulwark')
  const radius = scaleAreaValue(definition.radius ?? 0, playerStats.areaOfEffect)
  const damage = getSkillDamage(definition, skill.level)
  const damageIncreasePercent = getSkillDamageIncreasePercent(
    skill.skillId,
    skill.level,
    state.run.selectedUpgradeIds,
  )

  const events: DamageEvent[] = [...state.enemies, ...(state.bosses ?? [])]
    .filter((enemy) => enemy.hp > 0)
    .filter((enemy) => Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y) <= radius + enemy.radius)
    .sort((left, right) => left.id - right.id)
    .map((enemy) =>
      createPlayerDamageEventFromStats(
        playerStats,
        state.player.id,
        enemy.id,
        skill.skillId,
        damage,
        {
          sourceTags: definition.tags,
          additionalIncreasedDamage: { global: damageIncreasePercent },
        },
      ),
    )

  const shieldAmount = (
    getSkillShieldAmount(definition, skill.level) +
    (bulwark ? AEGIS_PULSE_BULWARK_SHIELD_AMOUNT_BONUS : 0)
  ) * (
    1 + getSkillSynergyEffectPercent(
      skill.skillId,
      state.run.selectedUpgradeIds,
      'shieldIncreasePercent',
    ) / 100
  )
  const shieldDuration = AEGIS_PULSE_BASE_DURATION_SECONDS +
    (bulwark ? AEGIS_PULSE_BULWARK_DURATION_BONUS_SECONDS : 0)
  state.player.aegisPulseShieldAmount = shieldAmount
  state.player.aegisPulseShieldMaxAmount = shieldAmount
  state.player.aegisPulseShieldRemaining = shieldDuration
  state.player.aegisPulseShieldDuration = shieldDuration

  addEffect(
    state,
    allocator,
    skill.skillId,
    [{ x: state.player.x, y: state.player.y }],
    radius,
    definition.effectLifetime,
  )
  skill.cooldownRemaining = getSkillCooldown(state, skill, definition.cooldown)
  markSkillUsed(skill)
  return events
}

/**
 * Resolves ready non-projectile skills in stable skill order. Damage is queued
 * for the same deterministic damage pass as projectiles.
 */
export function collectSkillDamage(
  state: GameState,
  allocator: EntityIdAllocator,
  random?: Pick<RandomSource, 'next'>,
): DamageEvent[] {
  const events: DamageEvent[] = []
  const skills = [...state.player.skills].sort((left, right) =>
    left.skillId < right.skillId ? -1 : left.skillId > right.skillId ? 1 : 0,
  )

  for (const skill of skills) {
    if (skill.cooldownRemaining > 0) {
      continue
    }
    if (skill.skillId === WHIRLWIND_SKILL_ID) {
      events.push(...collectWhirlwindDamage(state, skill, allocator))
    } else if (skill.skillId === CHAIN_LIGHTNING_SKILL_ID) {
      events.push(...collectChainLightningDamage(state, skill, allocator))
    } else if (skill.skillId === VITALITY_SKILL_ID) {
      events.push(...collectVitalityHealing(state, skill, allocator, random))
    } else if (skill.skillId === GLACIAL_ORB_SKILL_ID) {
      events.push(...collectGlacialOrbDamage(state, skill, allocator))
    } else if (skill.skillId === LANCERS_CHARGE_SKILL_ID) {
      events.push(...collectLancersChargeDamage(state, skill, allocator))
    } else if (skill.skillId === RALLYING_STANDARD_SKILL_ID) {
      events.push(...collectRallyingStandardEffect(state, skill, allocator, random))
    } else if (skill.skillId === GRAVITY_WELL_SKILL_ID) {
      events.push(...collectGravityWellDamage(state, skill, allocator))
    } else if (skill.skillId === AEGIS_PULSE_SKILL_ID) {
      events.push(...collectAegisPulseDamage(state, skill, allocator))
    } else if (skill.skillId === RAISE_SKELETON_SKILL_ID) {
      if (summonSkeletonIfReady(state, allocator)) {
        const definition = getSkillDefinition(RAISE_SKELETON_SKILL_ID)
        addEffect(
          state,
          allocator,
          skill.skillId,
          [{ x: state.player.x, y: state.player.y }],
          24,
          definition.effectLifetime,
        )
        markSkillUsed(skill)
      }
    }
  }

  return events
}
