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
  RIFT_JAVELIN_SKILL_ID,
  CINDER_MINE_SKILL_ID,
  STORM_RELAY_SKILL_ID,
  SOUL_TETHER_SKILL_ID,
  PHANTOM_ARSENAL_SKILL_ID,
} from '../../../content/skills/Skills'
import {
  getSkillCooldownReductionPercent,
  getSkillDamageIncreasePercent,
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
  RALLYING_STANDARD_SYNERGY_MAX_DURATION_SECONDS,
  RALLYING_STANDARD_COMMANDER_COOLDOWN_REDUCTION_PERCENT,
  GRAVITY_WELL_BASE_PULL_DISTANCE,
  GRAVITY_WELL_SINGULARITY_PULL_BONUS,
  GRAVITY_WELL_SINGULARITY_RADIUS_BONUS,
  GRAVITY_WELL_EVENT_HORIZON_DAMAGE_INCREASE_PERCENT,
  AEGIS_PULSE_BASE_DURATION_SECONDS,
  AEGIS_PULSE_BULWARK_SHIELD_AMOUNT_BONUS,
  AEGIS_PULSE_BULWARK_DURATION_BONUS_SECONDS,
  SHOCK_MAX_STACKS,
  RIFT_JAVELIN_MAX_RANGE,
  RIFT_JAVELIN_BARBED_DURATION_SECONDS,
  RIFT_JAVELIN_BARBED_PHYSICAL_CHAOS_RATIO,
  RIFT_JAVELIN_HOMEWARD_DAMAGE_INCREASE_PERCENT,
  CINDER_MINE_FUSE_SECONDS,
  CINDER_MINE_BURNING_DURATION_SECONDS,
  CINDER_MINE_BURNING_FIRE_DAMAGE_RATIO,
  CINDER_MINE_INFERNO_RADIUS_BONUS,
  CINDER_MINE_INFERNO_BURNING_RATIO_BONUS,
  CINDER_MINE_CLUSTER_OFFSET,
  CINDER_MINE_CLUSTER_DAMAGE_MULTIPLIER,
  STORM_RELAY_BASE_DURATION_SECONDS,
  STORM_RELAY_STRIKE_INTERVAL_SECONDS,
  STORM_RELAY_OVERCHARGE_STRIKE_INTERVAL_SECONDS,
  STORM_RELAY_OVERCHARGE_SHOCK_STACKS,
  STORM_RELAY_CONDUIT_BURST_RADIUS,
  STORM_RELAY_CONDUIT_BURST_DAMAGE_RATIO,
  SOUL_TETHER_DURATION_SECONDS,
  SOUL_TETHER_BASE_HEALING_RATIO,
  SOUL_TETHER_SIPHON_HEALING_BONUS,
} from '../../../game-config/skills'
import {
  createDamageValues,
  scaleDamageValues,
} from '../../../content/stats/Damage'
import type { EntityIdAllocator } from '../../ids'
import type { RandomSource } from '../../random/Random'
import {
  createPlayerDamageEventFromStats,
  createPlayerDamageProfileFromStats,
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
  TrapState,
  RelayState,
} from '../../state/GameState'
import {
  healPlayer,
  healSummon,
} from '../../combat/PlayerCombatLog'
import { getDerivedPlayerStats } from '../../stats/DerivedStats'
import {
  summonSkeletonIfReady,
  summonPhantomIfReady,
} from '../summons/SummonSystem'
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
    if (state.run.selectedUpgradeIds.includes('synergy-basic-attack-whirlwind')) {
      state.player.attackCooldownRemaining = Math.max(
        0,
        state.player.attackCooldownRemaining * 0.5,
      )
    }
    if (state.run.selectedUpgradeIds.includes('synergy-whirlwind-lancers-charge')) {
      state.player.lancerMomentumStacks = Math.min(
        LANCERS_CHARGE_MAX_MOMENTUM_STACKS,
        Math.max(0, state.player.lancerMomentumStacks ?? 0) + 1,
      )
      state.player.lancerMomentumDecayRemaining = LANCERS_CHARGE_MOMENTUM_DECAY_SECONDS
    }
    if (
      state.run.selectedUpgradeIds.includes('synergy-whirlwind-aegis-pulse') &&
      (state.player.aegisPulseShieldMaxAmount ?? 0) > 0 &&
      (state.player.aegisPulseShieldAmount ?? 0) > 0
    ) {
      const shieldMax = state.player.aegisPulseShieldMaxAmount ?? 0
      state.player.aegisPulseShieldAmount = Math.min(
        shieldMax,
        (state.player.aegisPulseShieldAmount ?? 0) + shieldMax * 0.2,
      )
      state.player.aegisPulseShieldRemaining = Math.max(
        state.player.aegisPulseShieldRemaining ?? 0,
        1,
      )
    }
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
  const maxTargets = (definition.maxTargets ?? 1) +
    Math.max(0, Math.floor(state.player.chainLightningBonusTargets ?? 0))
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
    const stormfrost = state.run.selectedUpgradeIds.includes(
      'synergy-chain-lightning-glacial-orb',
    )
    const targetWasChilled = (target.chillStacks ?? 0) > 0 ||
      (target.frozenRemainingDuration ?? 0) > 0
    if (
      state.run.selectedUpgradeIds.includes('chain-lightning-frost') ||
      stormfrost
    ) {
      event.frostApplication = {
        stacks: 1,
        durationSeconds: 4,
        freezeThreshold: 3,
        freezeDurationSeconds: 1,
      }
    }
    const overload = state.run.selectedUpgradeIds.includes(
      'chain-lightning-overload',
    )
    if (overload || (stormfrost && targetWasChilled)) {
      event.shockApplication = {
        stacks: (overload ? 1 : 0) + (stormfrost && targetWasChilled ? 1 : 0),
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
    state.player.chainLightningBonusTargets = 0
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
  const storedCharge = state.run.selectedUpgradeIds.includes(
    'synergy-soul-tether-vitality',
  )
    ? state.player.soulTetherVitalityCharge ?? 0
    : 0
  healing += storedCharge
  state.player.soulTetherVitalityCharge = 0
  healPlayer(
    state,
    healing,
    definition.name,
    random,
  )
  if (
    state.run.selectedUpgradeIds.includes('synergy-vitality-rallying-standard') &&
    (state.player.rallyingStandardRemaining ?? 0) > 0
  ) {
    const bannerRemaining = state.player.rallyingStandardRemaining ?? 0
    const bannerExtension = Math.min(
      2,
      Math.max(0, RALLYING_STANDARD_SYNERGY_MAX_DURATION_SECONDS - bannerRemaining),
    )
    state.player.rallyingStandardRemaining =
      bannerRemaining + bannerExtension
    if (bannerExtension > 0) {
      for (const effect of state.effects) {
        if (effect.skillId === RALLYING_STANDARD_SKILL_ID) {
          effect.remainingLifetime += bannerExtension
          effect.lifetime += bannerExtension
        }
      }
    }
  }
  if (
    state.run.selectedUpgradeIds.includes('synergy-vitality-aegis-pulse') &&
    (state.player.aegisPulseShieldMaxAmount ?? 0) > 0 &&
    (state.player.aegisPulseShieldAmount ?? 0) > 0
  ) {
    const shieldMax = state.player.aegisPulseShieldMaxAmount ?? 0
    state.player.aegisPulseShieldAmount = Math.min(
      shieldMax,
      (state.player.aegisPulseShieldAmount ?? 0) + healing * 0.5,
    )
  }
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
  const ironVanguard = state.run.selectedUpgradeIds.includes(
    'synergy-lancers-charge-aegis-pulse',
  )
  const shieldEmpowerment = ironVanguard &&
    (state.player.aegisPulseShieldAmount ?? 0) > 0
  const aegisEmpowermentBonus = shieldEmpowerment ? 25 : 0
  const singleTargetBonus = vanguard && struck.length === 1
    ? LANCERS_CHARGE_VANGUARD_SINGLE_TARGET_BONUS_PERCENT
    : 0
  const impalerPenalty = impaler ? -LANCERS_CHARGE_IMPALER_DAMAGE_REDUCTION_PERCENT : 0
  const damageIncreasePercent = levelIncrease +
    momentumStacks * momentumPercentPerStack +
    singleTargetBonus +
    impalerPenalty +
    aegisEmpowermentBonus

  if (shieldEmpowerment) {
    const shieldAmount = state.player.aegisPulseShieldAmount ?? 0
    state.player.aegisPulseShieldAmount = shieldAmount * 0.75
  }

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
  const healing = getSkillHealing(definition, skill.level)
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
  if (
    state.run.selectedUpgradeIds.includes(
      'synergy-raise-skeleton-rallying-standard',
    )
  ) {
    const skeletonSkill = state.player.skills.find(
      (candidate) => candidate.skillId === RAISE_SKELETON_SKILL_ID,
    )
    if (skeletonSkill) {
      skeletonSkill.cooldownRemaining = 0
    }
  }

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
  const anchorsToSkeletons = state.run.selectedUpgradeIds.includes(
    'synergy-raise-skeleton-gravity-well',
  )
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
      const skeletonAnchor = anchorsToSkeletons
        ? [...state.summons]
          .filter((summon) =>
            summon.hp > 0 &&
            (summon.skillId ?? RAISE_SKELETON_SKILL_ID) === RAISE_SKELETON_SKILL_ID
          )
          .sort((left, right) =>
            (left.x - enemy.x) ** 2 + (left.y - enemy.y) ** 2 -
            ((right.x - enemy.x) ** 2 + (right.y - enemy.y) ** 2) ||
            left.id - right.id
          )[0]
        : undefined
      const pullAnchorX = skeletonAnchor?.x ?? state.player.x
      const pullAnchorY = skeletonAnchor?.y ?? state.player.y
      const distance = Math.hypot(enemy.x - pullAnchorX, enemy.y - pullAnchorY)
      const minDistance = enemy.radius + state.player.radius + 8
      const controlFactor = 1 - Math.min(90, Math.max(0, enemy.controlResistance ?? 0)) / 100
      const pull = Math.min(pullDistance, Math.max(0, distance - minDistance)) * controlFactor
      if (pull > 0 && distance > 0) {
        enemy.x += ((pullAnchorX - enemy.x) / distance) * pull
        enemy.y += ((pullAnchorY - enemy.y) / distance) * pull
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
  if (state.run.selectedUpgradeIds.includes('synergy-chain-lightning-gravity-well')) {
    state.player.chainLightningBonusTargets = Math.max(
      1,
      state.player.chainLightningBonusTargets ?? 0,
    )
  }
  if (
    state.run.selectedUpgradeIds.includes('synergy-fiery-touch-gravity-well')
  ) {
    state.player.fieryTouchGravityPrimed = true
  }
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

  const shieldAmount = getSkillShieldAmount(definition, skill.level) +
    (bulwark ? AEGIS_PULSE_BULWARK_SHIELD_AMOUNT_BONUS : 0)
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

function collectRiftJavelinDamage(
  state: GameState,
  skill: SkillState,
  allocator: EntityIdAllocator,
): DamageEvent[] {
  const definition = getSkillDefinition(RIFT_JAVELIN_SKILL_ID)
  const playerStats = getDerivedPlayerStats(state.player)
  const barbed = state.run.selectedUpgradeIds.includes('rift-javelin-barbed')
  const homeward = state.run.selectedUpgradeIds.includes('rift-javelin-homeward')
  const maxRange = definition.maxRange ?? RIFT_JAVELIN_MAX_RANGE
  const target = findNearestLivingTarget(state, maxRange)
  if (!target) {
    return []
  }

  const damage = getSkillDamage(definition, skill.level)
  const damageIncreasePercent = getSkillDamageIncreasePercent(
    skill.skillId,
    skill.level,
    state.run.selectedUpgradeIds,
  )
  const outgoingDamage = createPlayerDamageProfileFromStats(
    playerStats,
    damage,
    {
      isProjectile: true,
      sourceTags: definition.tags,
      additionalIncreasedDamage: { global: damageIncreasePercent },
    },
  )
  const projectileDefinitionId = definition.projectileDefinitionId
  if (!projectileDefinitionId) {
    throw new Error('Rift Javelin must define a projectile.')
  }
  const projectileDefinition = getProjectileDefinition(projectileDefinitionId)
  const directionX = target.x - state.player.x
  const directionY = target.y - state.player.y
  const distance = Math.hypot(directionX, directionY) || 1
  const primedReturnBonus = Math.max(
    0,
    state.player.riftJavelinReturnBonusPercent ?? 0,
  )
  const returnDamageBonus = (homeward ? RIFT_JAVELIN_HOMEWARD_DAMAGE_INCREASE_PERCENT : 0) +
    primedReturnBonus

  state.projectiles.push({
    id: allocator.createEntityId(),
    ownerId: state.player.id,
    definitionId: projectileDefinition.id,
    skillId: skill.skillId,
    targetId: target.id,
    sourceTags: definition.tags,
    piercing: true,
    pierceHitTargetIds: [],
    pierceReturnRange: maxRange,
    ...(returnDamageBonus > 0
      ? { returnDamageMultiplier: 1 + returnDamageBonus / 100 }
      : {}),
    ...(barbed
      ? {
          impactPoisonApplication: {
            durationSeconds: RIFT_JAVELIN_BARBED_DURATION_SECONDS,
            physicalChaosRatio: RIFT_JAVELIN_BARBED_PHYSICAL_CHAOS_RATIO,
          },
        }
      : {}),
    x: state.player.x,
    y: state.player.y,
    velocityX: (directionX / distance) * projectileDefinition.speed,
    velocityY: (directionY / distance) * projectileDefinition.speed,
    radius: projectileDefinition.radius,
    damage: outgoingDamage.damage,
    criticalStrike: outgoingDamage.criticalStrike,
    remainingLifetime: projectileDefinition.lifetime,
  })
  state.player.riftJavelinReturnBonusPercent = 0

  skill.cooldownRemaining = getSkillCooldown(state, skill, definition.cooldown)
  markSkillUsed(skill)
  return []
}

function placeCinderMineIfReady(
  state: GameState,
  skill: SkillState,
  allocator: EntityIdAllocator,
): boolean {
  const definition = getSkillDefinition(CINDER_MINE_SKILL_ID)
  const playerStats = getDerivedPlayerStats(state.player)
  const inferno = state.run.selectedUpgradeIds.includes('cinder-mine-inferno')
  const cluster = state.run.selectedUpgradeIds.includes('cinder-mine-cluster')
  const damage = getSkillDamage(definition, skill.level)
  const damageIncreasePercent = getSkillDamageIncreasePercent(
    skill.skillId,
    skill.level,
    state.run.selectedUpgradeIds,
  )
  const outgoingDamage = createPlayerDamageProfileFromStats(
    playerStats,
    damage,
    {
      sourceTags: definition.tags,
      additionalIncreasedDamage: { global: damageIncreasePercent },
    },
  )
  const radius = scaleAreaValue(
    (definition.radius ?? 0) + (inferno ? CINDER_MINE_INFERNO_RADIUS_BONUS : 0),
    playerStats.areaOfEffect,
  )
  const burningApplication = {
    durationSeconds: CINDER_MINE_BURNING_DURATION_SECONDS,
    fireDamageRatio: CINDER_MINE_BURNING_FIRE_DAMAGE_RATIO +
      (inferno ? CINDER_MINE_INFERNO_BURNING_RATIO_BONUS : 0),
  }
  const mineDamage = cluster
    ? scaleDamageValues(outgoingDamage.damage, CINDER_MINE_CLUSTER_DAMAGE_MULTIPLIER)
    : outgoingDamage.damage

  state.traps ??= []
  state.traps.push({
    id: allocator.createEntityId(),
    ownerId: state.player.id,
    skillId: skill.skillId,
    x: state.player.x,
    y: state.player.y,
    radius,
    fuseRemaining: CINDER_MINE_FUSE_SECONDS,
    damage: mineDamage,
    criticalStrike: outgoingDamage.criticalStrike,
    burningApplication,
  })
  if (cluster) {
    state.traps.push({
      id: allocator.createEntityId(),
      ownerId: state.player.id,
      skillId: skill.skillId,
      x: state.player.x + CINDER_MINE_CLUSTER_OFFSET,
      y: state.player.y,
      radius,
      fuseRemaining: CINDER_MINE_FUSE_SECONDS,
      damage: mineDamage,
      criticalStrike: outgoingDamage.criticalStrike,
      burningApplication,
    })
  }

  addEffect(
    state,
    allocator,
    skill.skillId,
    [{ x: state.player.x, y: state.player.y }],
    radius,
    CINDER_MINE_FUSE_SECONDS,
  )
  skill.cooldownRemaining = getSkillCooldown(state, skill, definition.cooldown)
  markSkillUsed(skill)
  return true
}

/** Resolves armed Cinder Mine traps, detonating any whose fuse has elapsed. */
export function updateCinderMineTraps(
  state: GameState,
  fixedStepSeconds: number,
  allocator: EntityIdAllocator,
): DamageEvent[] {
  const events: DamageEvent[] = []
  const remaining: TrapState[] = []
  for (const trap of [...(state.traps ?? [])].sort((left, right) => left.id - right.id)) {
    trap.fuseRemaining -= fixedStepSeconds
    const affected = [...state.enemies, ...(state.bosses ?? [])]
      .filter((enemy) => enemy.hp > 0)
      .filter((enemy) => Math.hypot(enemy.x - trap.x, enemy.y - trap.y) <= trap.radius + enemy.radius)
      .sort((left, right) => left.id - right.id)
    if (trap.fuseRemaining > 0 && affected.length === 0) {
      remaining.push(trap)
      continue
    }
    for (const enemy of affected) {
      events.push({
        sourceId: trap.ownerId,
        sourceSkillId: trap.skillId,
        sourceTags: getSkillDefinition(trap.skillId).tags,
        targetId: enemy.id,
        damage: trap.damage,
        criticalStrike: trap.criticalStrike,
        ...(trap.burningApplication ? { burningApplication: trap.burningApplication } : {}),
      })
    }
    if (affected.length > 0) {
      const definition = getSkillDefinition(trap.skillId)
      addEffect(
        state,
        allocator,
        trap.skillId,
        [{ x: trap.x, y: trap.y }],
        trap.radius,
        definition.effectLifetime,
      )
    }
  }
  state.traps = remaining
  return events
}

function collectStormRelayChainDamage(
  state: GameState,
  allocator: EntityIdAllocator,
  relay: RelayState,
): DamageEvent[] {
  const events: DamageEvent[] = []
  const ashenCircuit = state.run.selectedUpgradeIds.includes(
    'synergy-cinder-mine-storm-relay',
  )
  const voltaicBond = state.run.selectedUpgradeIds.includes(
    'synergy-storm-relay-soul-tether',
  )
  const wardedConduit = state.run.selectedUpgradeIds.includes(
    'synergy-storm-relay-rallying-standard',
  )
  const visited = new Set<number>()
  let originX = relay.x
  let originY = relay.y
  const path: SkillEffectPoint[] = [{ x: originX, y: originY }]

  for (let jump = 0; jump < relay.maxTargets; jump += 1) {
    let target: EnemyState | BossState | undefined
    let targetDistanceSquared = Number.POSITIVE_INFINITY
    const range = jump === 0 ? relay.maxRange : relay.jumpRange
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
    const burningBonus = ashenCircuit &&
      (target.burningStacks?.length ?? 0) > 0
      ? 1
      : 0
    const shockStacks = Math.min(
      SHOCK_MAX_STACKS - 1,
      relay.shockStacks + burningBonus,
    )
    events.push({
      sourceId: relay.ownerId,
      sourceSkillId: relay.skillId,
      sourceTags: getSkillDefinition(relay.skillId).tags,
      targetId: target.id,
      damage: relay.damage,
      criticalStrike: relay.criticalStrike,
      shockApplication: {
        stacks: shockStacks,
        durationSeconds: relay.shockDurationSeconds,
        threshold: relay.shockThreshold,
        burstMultiplier: relay.shockBurstMultiplier,
      },
    })
    if (voltaicBond && state.player.soulTetherTargetId === target.id) {
      state.player.soulTetherRemaining =
        (state.player.soulTetherRemaining ?? 0) + 0.5
    }
    path.push({ x: target.x, y: target.y })
    originX = target.x
    originY = target.y
  }

  if (relay.burstRadius) {
    const burstDamage = scaleDamageValues(relay.damage, relay.burstDamageRatio ?? 1)
    for (const enemy of [...state.enemies, ...(state.bosses ?? [])]
      .filter((enemy) => enemy.hp > 0 && !visited.has(enemy.id))
      .filter((enemy) =>
        Math.hypot(enemy.x - relay.x, enemy.y - relay.y) <= (relay.burstRadius ?? 0) + enemy.radius,
      )
      .sort((left, right) => left.id - right.id)
    ) {
      events.push({
        sourceId: relay.ownerId,
        sourceSkillId: relay.skillId,
        sourceLabel: 'Conduit Burst',
        sourceTags: getSkillDefinition(relay.skillId).tags,
        targetId: enemy.id,
        damage: burstDamage,
        shockApplication: {
          stacks: Math.min(
            SHOCK_MAX_STACKS - 1,
            relay.shockStacks +
              (ashenCircuit && (enemy.burningStacks?.length ?? 0) > 0 ? 1 : 0),
          ),
          durationSeconds: relay.shockDurationSeconds,
          threshold: relay.shockThreshold,
          burstMultiplier: relay.shockBurstMultiplier,
        },
      })
      if (voltaicBond && state.player.soulTetherTargetId === enemy.id) {
        state.player.soulTetherRemaining =
          (state.player.soulTetherRemaining ?? 0) + 0.5
      }
    }
  }

  if (events.length > 0) {
    if (
      wardedConduit &&
      (state.player.rallyingStandardRemaining ?? 0) > 0
    ) {
      state.player.rallyingStandardRemaining =
        (state.player.rallyingStandardRemaining ?? 0) + 0.25
      for (const effect of state.effects) {
        if (effect.skillId === RALLYING_STANDARD_SKILL_ID) {
          effect.remainingLifetime += 0.25
          effect.lifetime += 0.25
        }
      }
    }
    addEffect(
      state,
      allocator,
      relay.skillId,
      path,
      16,
      getSkillDefinition(relay.skillId).effectLifetime,
    )
  }
  return events
}

function collectStormRelayCast(
  state: GameState,
  skill: SkillState,
  allocator: EntityIdAllocator,
): DamageEvent[] {
  const definition = getSkillDefinition(STORM_RELAY_SKILL_ID)
  const playerStats = getDerivedPlayerStats(state.player)
  const overcharge = state.run.selectedUpgradeIds.includes('storm-relay-overcharge')
  const conduit = state.run.selectedUpgradeIds.includes('storm-relay-conduit')
  const damage = getSkillDamage(definition, skill.level)
  const damageIncreasePercent = getSkillDamageIncreasePercent(
    skill.skillId,
    skill.level,
    state.run.selectedUpgradeIds,
  )
  const outgoingDamage = createPlayerDamageProfileFromStats(
    playerStats,
    damage,
    {
      sourceTags: definition.tags,
      additionalIncreasedDamage: { global: damageIncreasePercent },
    },
  )

  state.relays = (state.relays ?? []).filter((relay) => relay.skillId !== skill.skillId)
  const relay: RelayState = {
    id: allocator.createEntityId(),
    ownerId: state.player.id,
    skillId: skill.skillId,
    x: state.player.x,
    y: state.player.y,
    permanent: conduit,
    remainingDuration: STORM_RELAY_BASE_DURATION_SECONDS,
    strikeIntervalSeconds: overcharge
      ? STORM_RELAY_OVERCHARGE_STRIKE_INTERVAL_SECONDS
      : STORM_RELAY_STRIKE_INTERVAL_SECONDS,
    strikeCooldownRemaining: overcharge
      ? STORM_RELAY_OVERCHARGE_STRIKE_INTERVAL_SECONDS
      : STORM_RELAY_STRIKE_INTERVAL_SECONDS,
    damage: outgoingDamage.damage,
    criticalStrike: outgoingDamage.criticalStrike,
    maxRange: definition.maxRange ?? 0,
    jumpRange: definition.jumpRange ?? 0,
    maxTargets: definition.maxTargets ?? 1,
    shockStacks: overcharge ? STORM_RELAY_OVERCHARGE_SHOCK_STACKS : 1,
    shockDurationSeconds: 4,
    shockThreshold: 3,
    shockBurstMultiplier: 1.5,
    ...(conduit
      ? {
          burstRadius: STORM_RELAY_CONDUIT_BURST_RADIUS,
          burstDamageRatio: STORM_RELAY_CONDUIT_BURST_DAMAGE_RATIO,
        }
      : {}),
  }
  state.relays.push(relay)

  addEffect(
    state,
    allocator,
    skill.skillId,
    [{ x: state.player.x, y: state.player.y }],
    24,
    definition.effectLifetime,
  )
  const events = collectStormRelayChainDamage(state, allocator, relay)
  skill.cooldownRemaining = getSkillCooldown(state, skill, definition.cooldown)
  markSkillUsed(skill)
  return events
}

/** Ticks placed Storm Relays: strikes on their interval and expires when their duration ends. */
export function updateStormRelay(
  state: GameState,
  fixedStepSeconds: number,
  allocator: EntityIdAllocator,
): DamageEvent[] {
  const events: DamageEvent[] = []
  const remaining: RelayState[] = []
  for (const relay of [...(state.relays ?? [])].sort((left, right) => left.id - right.id)) {
    if (!relay.permanent) {
      relay.remainingDuration -= fixedStepSeconds
      if (relay.remainingDuration <= 0) {
        continue
      }
    }
    relay.strikeCooldownRemaining -= fixedStepSeconds
    if (relay.strikeCooldownRemaining <= 0) {
      events.push(...collectStormRelayChainDamage(state, allocator, relay))
      relay.strikeCooldownRemaining = relay.strikeIntervalSeconds
    }
    remaining.push(relay)
  }
  state.relays = remaining
  return events
}

function collectSoulTetherCast(
  state: GameState,
  skill: SkillState,
  allocator: EntityIdAllocator,
): DamageEvent[] {
  const definition = getSkillDefinition(SOUL_TETHER_SKILL_ID)
  const playerStats = getDerivedPlayerStats(state.player)
  const siphon = state.run.selectedUpgradeIds.includes('soul-tether-siphon')
  const target = findNearestLivingTarget(state, definition.maxRange ?? Number.POSITIVE_INFINITY)
  if (!target) {
    return []
  }

  const damage = getSkillDamage(definition, skill.level)
  const damageIncreasePercent = getSkillDamageIncreasePercent(
    skill.skillId,
    skill.level,
    state.run.selectedUpgradeIds,
  )
  const outgoingDamage = createPlayerDamageProfileFromStats(
    playerStats,
    damage,
    {
      sourceTags: definition.tags,
      additionalIncreasedDamage: { global: damageIncreasePercent },
    },
  )

  state.player.soulTetherTargetId = target.id
  state.player.soulTetherRemaining = SOUL_TETHER_DURATION_SECONDS
  state.player.soulTetherDamagePerSecond = outgoingDamage.damage.chaos
  state.player.soulTetherHealingRatio = SOUL_TETHER_BASE_HEALING_RATIO +
    (siphon ? SOUL_TETHER_SIPHON_HEALING_BONUS : 0)
  state.player.soulTetherHasRetargeted = false

  addEffect(
    state,
    allocator,
    skill.skillId,
    [{ x: state.player.x, y: state.player.y }, { x: target.x, y: target.y }],
    6,
    definition.effectLifetime,
    'line',
  )
  skill.cooldownRemaining = getSkillCooldown(state, skill, definition.cooldown)
  markSkillUsed(skill)
  return []
}

/** Ticks the active Soul Tether link, dealing chaos damage over time to its target. */
export function updateSoulTether(
  state: GameState,
  fixedStepSeconds: number,
  allocator: EntityIdAllocator,
): DamageEvent[] {
  const events: DamageEvent[] = []
  if ((state.player.soulTetherRemaining ?? 0) <= 0) {
    return events
  }
  state.player.soulTetherRemaining =
    (state.player.soulTetherRemaining ?? 0) - fixedStepSeconds
  if (state.player.soulTetherRemaining <= 0) {
    state.player.soulTetherTargetId = undefined
    state.player.soulTetherDamagePerSecond = 0
    return events
  }
  const targetId = state.player.soulTetherTargetId
  const target = targetId === undefined
    ? undefined
    : [...state.enemies, ...(state.bosses ?? [])].find(
        (enemy) => enemy.id === targetId && enemy.hp > 0,
      )
  if (!target) {
    state.player.soulTetherTargetId = undefined
    state.player.soulTetherRemaining = 0
    state.player.soulTetherDamagePerSecond = 0
    return events
  }
  const dps = state.player.soulTetherDamagePerSecond ?? 0
  if (dps > 0) {
    events.push({
      sourceId: state.player.id,
      sourceSkillId: SOUL_TETHER_SKILL_ID,
      sourceTags: ['chaos'],
      targetId: target.id,
      damage: createDamageValues({ chaos: dps * fixedStepSeconds }),
      damageOverTime: true,
    })
    const definition = getSkillDefinition(SOUL_TETHER_SKILL_ID)
    addEffect(
      state,
      allocator,
      SOUL_TETHER_SKILL_ID,
      [{ x: state.player.x, y: state.player.y }, { x: target.x, y: target.y }],
      6,
      definition.effectLifetime,
      'line',
    )
  }
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
    } else if (skill.skillId === RIFT_JAVELIN_SKILL_ID) {
      events.push(...collectRiftJavelinDamage(state, skill, allocator))
    } else if (skill.skillId === CINDER_MINE_SKILL_ID) {
      placeCinderMineIfReady(state, skill, allocator)
    } else if (skill.skillId === STORM_RELAY_SKILL_ID) {
      events.push(...collectStormRelayCast(state, skill, allocator))
    } else if (skill.skillId === SOUL_TETHER_SKILL_ID) {
      events.push(...collectSoulTetherCast(state, skill, allocator))
    } else if (skill.skillId === PHANTOM_ARSENAL_SKILL_ID) {
      if (summonPhantomIfReady(state, allocator)) {
        const definition = getSkillDefinition(PHANTOM_ARSENAL_SKILL_ID)
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
