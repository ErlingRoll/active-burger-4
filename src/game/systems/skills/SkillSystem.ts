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
  RALLYING_BANNER_SKILL_ID,
  GRAVITY_WELL_SKILL_ID,
  AEGIS_PULSE_SKILL_ID,
  RIFT_JAVELIN_SKILL_ID,
  CINDER_MINE_SKILL_ID,
  STORM_RELAY_SKILL_ID,
  SOUL_TETHER_SKILL_ID,
  PHANTOM_ARSENAL_SKILL_ID,
  SIGIL_OF_RUIN_SKILL_ID,
  MIRRORCAST_SKILL_ID,
  CRITICAL_SPELLSTRIKE_SKILL_ID,
  RAZORWIRE_SKILL_ID,
  BLOOD_RITE_SKILL_ID,
  PRISM_HALO_SKILL_ID,
} from '../../../content/skills/Skills'
import {
  getSkillCooldownReductionPercent,
  getSkillDamageIncreasePercent,
} from '../../../content/upgrades/Upgrades'
import {
  createProjectileSpreadAngles,
  getProjectileDefinition,
  getProjectileVolleyCount,
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
  RALLYING_BANNER_BASE_DURATION_SECONDS,
  RALLYING_BANNER_HEAL_INTERVAL_SECONDS,
  RALLYING_BANNER_EFFECT_RADIUS,
  RALLYING_BANNER_BULWARK_DURATION_BONUS_SECONDS,
  RALLYING_BANNER_RESONANCE_DURATION_BONUS_SECONDS,
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
  STORM_RELAY_SYNERGY_MAX_DURATION_SECONDS,
  STORM_RELAY_STRIKE_INTERVAL_SECONDS,
  STORM_RELAY_OVERCHARGE_STRIKE_INTERVAL_SECONDS,
  STORM_RELAY_OVERCHARGE_SHOCK_STACKS,
  STORM_RELAY_CONDUIT_PULL_RADIUS,
  STORM_RELAY_CONDUIT_PULL_DISTANCE,
  SOUL_TETHER_DURATION_SECONDS,
  SOUL_TETHER_SYNERGY_MAX_DURATION_SECONDS,
  SOUL_TETHER_BASE_HEALING_RATIO,
  SOUL_TETHER_SIPHON_HEALING_BONUS,
  SOUL_TETHER_TARGET_DISTANCE_JITTER_PERCENT,
  AEGIS_PULSE_RESONANCE_SHIELD_MULTIPLIER,
  RIFT_JAVELIN_RESONANCE_RETURN_BONUS_PERCENT,
  SOUL_TETHER_RESONANCE_DAMAGE_MULTIPLIER,
  PHANTOM_ARSENAL_RESONANCE_DURATION_BONUS_SECONDS,
  SIGIL_OF_RUIN_MAX_RANGE,
  SIGIL_OF_RUIN_DURATION_SECONDS,
  SIGIL_OF_RUIN_RESONANCE_STARTING_CHARGES,
  SIGIL_OF_RUIN_STORED_DAMAGE_CAP,
  MIRRORCAST_CAPTURE_WINDOW_SECONDS,
  MIRRORCAST_COPY_DELAY_SECONDS,
  MIRRORCAST_DEFERRED_COPY_DELAY_SECONDS,
  MIRRORCAST_BASE_EFFECTIVENESS,
  MIRRORCAST_RESONANCE_EFFECTIVENESS,
  MIRRORCAST_DOUBLE_EXPOSURE_EFFECTIVENESS,
  MIRRORCAST_DEFERRED_EFFECTIVENESS,
  MIRRORCAST_DOUBLE_EXPOSURE_ECHO_COUNT,
  MIRRORCAST_COPY_MAX_RANGE,
  CRITICAL_SPELLSTRIKE_BASE_EFFECTIVENESS,
  CRITICAL_SPELLSTRIKE_OVERWHELMING_EFFECTIVENESS,
  CRITICAL_SPELLSTRIKE_EFFECTIVENESS_PER_LEVEL,
  getCriticalSpellstrikeBaseCooldown,
  RAZORWIRE_DURATION_SECONDS,
  RAZORWIRE_SYNERGY_MAX_DURATION_SECONDS,
  RAZORWIRE_MAX_RANGE,
  RAZORWIRE_WIRE_LENGTH,
  RAZORWIRE_CROSSING_COOLDOWN_SECONDS,
  RAZORWIRE_SLOW_CHILL_STACKS,
  RAZORWIRE_SLOW_DURATION_SECONDS,
  RAZORWIRE_CROSSING_MARGIN,
  RAZORWIRE_TRIPWIRE_COUNT,
  RAZORWIRE_TRIPWIRE_LENGTH,
  RAZORWIRE_TRIPWIRE_DAMAGE_MULTIPLIER,
  RAZORWIRE_GUILLOTINE_LENGTH,
  RAZORWIRE_GUILLOTINE_MARGIN,
  RAZORWIRE_GUILLOTINE_TENSION_CAP,
  RAZORWIRE_GUILLOTINE_SNAP_DAMAGE_MULTIPLIER,
  BLOOD_RITE_PULSE_RADIUS,
  BLOOD_RITE_SACRIFICE_FRACTION,
  BLOOD_RITE_MIN_HP_AFTER,
  BLOOD_RITE_DEBT_DURATION_SECONDS,
  BLOOD_RITE_BASE_POTENCY,
  BLOOD_RITE_POTENCY_PER_SACRIFICED_HP,
  BLOOD_RITE_MAX_POTENCY,
  BLOOD_RITE_RESONANCE_POTENCY_MULTIPLIER,
  BLOOD_RITE_SANGUINE_HEAL_RATIO,
  BLOOD_RITE_CRIMSON_CHARGES,
  BLOOD_RITE_CRIMSON_POTENCY_MULTIPLIER,
  BLOOD_RITE_UTILITY_DURATION_BONUS_SECONDS,
  PRISM_HALO_DURATION_SECONDS,
  PRISM_HALO_SYNERGY_MAX_DURATION_SECONDS,
  PRISM_HALO_RANGE,
  PRISM_HALO_FIRE_INTERVAL_SECONDS,
  PRISM_HALO_ORBIT_RADIUS,
  PRISM_HALO_ORBIT_ANGULAR_SPEED,
  PRISM_HALO_BURNING_DURATION_SECONDS,
  PRISM_HALO_BURNING_FIRE_DAMAGE_RATIO,
  PRISM_HALO_CHILL_STACKS,
  PRISM_HALO_CHILL_DURATION_SECONDS,
  PRISM_HALO_SHOCK_STACKS,
  PRISM_HALO_SHOCK_DURATION_SECONDS,
  PRISM_HALO_CONVERGENCE_WINDOW_SECONDS,
  PRISM_HALO_CONVERGENCE_BURST_MULTIPLIER,
  PRISM_HALO_REFRACTION_MAX_SPLITS,
  PRISM_HALO_REFRACTION_DAMAGE_MULTIPLIER,
  PRISM_HALO_REFRACTION_SPLIT_RADIUS,
  MIRRORCAST_WIRE_DURATION_BONUS_SECONDS,
  RAZORWIRE_BLOODWIRE_CHAOS_DAMAGE,
  BLOOD_RITE_PRISM_DURATION_BONUS_SECONDS,
  VANGUARD_STANDARD_BANNER_EXTENSION_SECONDS,
  ASHEN_LEGION_MAX_GUARD_CHARGES,
  ASHEN_LEGION_GUARD_DURATION_SECONDS,
  AURORA_RELAY_DAMAGE_RATIO,
  MENDING_RETURN_MAX_HEAL_PERCENT,
  FROSTLINE_DAMAGE_RATIO,
  FROSTLINE_CROSSING_COOLDOWN_SECONDS,
} from '../../../game-config/skills'
import {
  createDamageValues,
  scaleDamageValues,
  addDamageValues,
  sumDamageValues,
  DAMAGE_TYPES,
  type DamageValues,
} from '../../../content/stats/Damage'
import type { EntityIdAllocator } from '../../ids'
import type { RandomSource } from '../../random/Random'
import {
  createPlayerDamageEventFromStats,
  getAttunementSourceAdditionalIncreasedDamage,
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
  SoulTetherState,
  MirrorcastCopyState,
  WireState,
} from '../../state/GameState'
import {
  healPlayer,
  healSummon,
} from '../../combat/PlayerCombatLog'
import { getDerivedPlayerStats } from '../../stats/DerivedStats'
import {
  extendRallyingBannerDuration,
  getRallyingBannerCooldownReductionPercent,
  getNewestRallyingBannerEffect,
  getRallyingBannerEffectsAffectingPlayer,
  syncRallyingBannerPlayerState,
} from './RallyingBanner'
import {
  summonSkeletonIfReady,
  summonPhantomIfReady,
} from '../summons/SummonSystem'
import {
  consumeSkillResonance,
  isSkillResonant,
} from '../../combat/Resonance'
import {
  calculateAreaValue,
  extendDurationUpToMaximum,
} from '../../engine/CombatCalculations'
import { clampPlayerPosition } from '../../../game-config/arena'

function pullEnemyToward(
  enemy: EnemyState | BossState,
  anchorX: number,
  anchorY: number,
  maximumPullDistance: number,
  minimumDistance: number,
): void {
  const distance = Math.hypot(enemy.x - anchorX, enemy.y - anchorY)
  const controlFactor = 1 - Math.min(90, Math.max(0, enemy.controlResistance ?? 0)) / 100
  const pull = Math.min(
    maximumPullDistance,
    Math.max(0, distance - minimumDistance),
  ) * controlFactor
  if (pull > 0 && distance > 0) {
    enemy.x += ((anchorX - enemy.x) / distance) * pull
    enemy.y += ((anchorY - enemy.y) / distance) * pull
  }
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
          periodicHealingRemaining: RALLYING_BANNER_HEAL_INTERVAL_SECONDS,
        }),
  }
  state.effects.push(effect)
}

function getSoulTetherVisualPoints(
  state: Readonly<GameState>,
  tether: Readonly<SoulTetherState>,
  target: Readonly<EnemyState | BossState>,
  tethers: readonly SoulTetherState[] = state.player.soulTethers ?? [],
): SkillEffectPoint[] {
  const sameTargetTethers = tethers
    .filter((candidate) => candidate.targetId === target.id)
    .sort((left, right) => left.id - right.id)
  const tetherIndex = sameTargetTethers.indexOf(tether)
  const lateralOffset = (
    tetherIndex - (sameTargetTethers.length - 1) / 2
  ) * 10
  const directionX = target.x - state.player.x
  const directionY = target.y - state.player.y
  const length = Math.hypot(directionX, directionY)
  const perpendicularX = length > 0 ? -directionY / length : 0
  const perpendicularY = length > 0 ? directionX / length : 1
  const offsetX = perpendicularX * lateralOffset
  const offsetY = perpendicularY * lateralOffset
  return [
    { x: state.player.x + offsetX, y: state.player.y + offsetY },
    { x: target.x + offsetX, y: target.y + offsetY },
  ]
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
      effect.skillId !== RALLYING_BANNER_SKILL_ID ||
      effect.periodicHealingAmount === undefined
    ) {
      continue
    }
    effect.periodicHealingRemaining =
      (effect.periodicHealingRemaining ?? RALLYING_BANNER_HEAL_INTERVAL_SECONDS) -
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
        healPlayer(
          state,
          healing,
          getSkillDefinition(RALLYING_BANNER_SKILL_ID).name,
          random,
          RALLYING_BANNER_SKILL_ID,
        )
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
        RALLYING_BANNER_HEAL_INTERVAL_SECONDS
    }
  }
  state.effects = state.effects.filter((effect) => effect.remainingLifetime > 0)
  syncRallyingBannerPlayerState(state)
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
  const rallyingBannerCooldownReduction =
    getRallyingBannerCooldownReductionPercent(state)
  return getEffectiveSkillCooldown(
    baseCooldown,
    playerStats.cooldownReduction +
      skillCooldownReduction +
      rallyingBannerCooldownReduction,
  )
}

function markSkillUsed(skill: SkillState): void {
  skill.castCount = (skill.castCount ?? 0) + 1
}

function applySkillResonanceEffect(
  state: GameState,
  skillId: SkillId,
): void {
  if (skillId === WHIRLWIND_SKILL_ID) {
    state.player.attackCooldownRemaining = 0
    return
  }
  if (skillId === RAISE_SKELETON_SKILL_ID) {
    for (const summon of state.summons) {
      if (
        summon.hp > 0 &&
        (summon.skillId ?? RAISE_SKELETON_SKILL_ID) === RAISE_SKELETON_SKILL_ID
      ) {
        summon.hp = summon.maxHp
      }
    }
    return
  }
  if (skillId === LANCERS_CHARGE_SKILL_ID) {
    state.player.lancerMomentumStacks = Math.min(
      LANCERS_CHARGE_MAX_MOMENTUM_STACKS,
      Math.max(0, state.player.lancerMomentumStacks ?? 0) + 1,
    )
    state.player.lancerMomentumDecayRemaining = LANCERS_CHARGE_MOMENTUM_DECAY_SECONDS
    return
  }
  if (skillId === PHANTOM_ARSENAL_SKILL_ID) {
    for (const summon of state.summons) {
      if (
        summon.hp > 0 &&
        (summon.skillId ?? RAISE_SKELETON_SKILL_ID) === PHANTOM_ARSENAL_SKILL_ID &&
        summon.expiryRemaining !== undefined
      ) {
        summon.expiryRemaining += PHANTOM_ARSENAL_RESONANCE_DURATION_BONUS_SECONDS
      }
    }
  }
}

function collectWhirlwindDamage(
  state: GameState,
  skill: SkillState,
  allocator: EntityIdAllocator,
): DamageEvent[] {
  const definition = getSkillDefinition(WHIRLWIND_SKILL_ID)
  const playerStats = getDerivedPlayerStats(state.player)
  const radius = calculateAreaValue(
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
        attunementSourceAdditionalIncreasedDamage:
          getAttunementSourceAdditionalIncreasedDamage(state),
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
  random?: Pick<RandomSource, 'next'>,
): DamageEvent[] {
  const definition = getSkillDefinition(CHAIN_LIGHTNING_SKILL_ID)
  const target = findNearestLivingTarget(state, definition.maxRange ?? 0)
  if (!target) {
    return []
  }

  const maxTargets = (definition.maxTargets ?? 1) +
    Math.max(0, Math.floor(state.player.chainLightningChainBonus ?? 0)) +
    Math.max(0, Math.floor(state.player.chainLightningBonusTargets ?? 0)) +
    (isSkillResonant(state, skill.skillId) ? 1 : 0)
  const playerStats = getDerivedPlayerStats(state.player)
  const damage = getSkillDamage(definition, skill.level)
  const outgoingDamage = createPlayerDamageProfileFromStats(
    playerStats,
    damage,
    {
      isProjectile: true,
      sourceTags: definition.tags,
      additionalIncreasedDamage: {
        global: getSkillDamageIncreasePercent(
          skill.skillId,
          skill.level,
          state.run.selectedUpgradeIds,
        ),
      },
      attunementSourceAdditionalIncreasedDamage:
        getAttunementSourceAdditionalIncreasedDamage(state),
    },
  )
  const projectileDefinitionId = definition.projectileDefinitionId
  if (!projectileDefinitionId) {
    throw new Error('Chain Lightning must define a projectile.')
  }
  const projectileDefinition = getProjectileDefinition(projectileDefinitionId)
  const frost = state.run.selectedUpgradeIds.includes('chain-lightning-frost') ||
    state.run.selectedUpgradeIds.includes('synergy-chain-lightning-glacial-orb')
  const overload = state.run.selectedUpgradeIds.includes('chain-lightning-overload')
  const projectileCount = getProjectileVolleyCount(
    definition.tags,
    playerStats.globalExtraProjectiles,
  )
  const directionAngle = Math.atan2(
    target.y - state.player.y,
    target.x - state.player.x,
  )
  const spreadAngles = createProjectileSpreadAngles(
    projectileCount,
    definition.spreadDegrees ?? 0,
  )
  const chainRange = calculateAreaValue(definition.jumpRange ?? 0, playerStats.areaOfEffect)
  state.projectiles.push(
    ...spreadAngles.map((spreadAngle, projectileIndex) => {
      const angle = directionAngle + spreadAngle
      return {
        id: allocator.createEntityId(),
        ownerId: state.player.id,
        definitionId: projectileDefinition.id,
        skillId: skill.skillId,
        targetId: target.id,
        sourceTags: definition.tags,
        remainingChains: Math.max(0, maxTargets - 1),
        chainRange,
        chainTargetSelectionState: Math.floor(
          (random?.next() ?? ((projectileIndex + 1) / (projectileCount + 1))) *
            0x1_0000_0000,
        ) >>> 0,
        chainOriginX: state.player.x,
        chainOriginY: state.player.y,
        ...(frost
          ? {
              impactFrostApplication: {
                stacks: 1,
                durationSeconds: 4,
                freezeThreshold: 3,
                freezeDurationSeconds: 1,
              },
            }
          : {}),
        ...(overload
          ? {
              impactShockApplication: {
                stacks: 1,
                durationSeconds: 4,
                threshold: 3,
                burstMultiplier: 1.5,
              },
            }
          : {}),
        x: state.player.x,
        y: state.player.y,
        velocityX: Math.cos(angle) * projectileDefinition.speed,
        velocityY: Math.sin(angle) * projectileDefinition.speed,
        radius: projectileDefinition.radius,
        damage: outgoingDamage.damage,
        criticalStrike: outgoingDamage.criticalStrike,
        remainingLifetime: projectileDefinition.lifetime,
      }
    }),
  )
  state.player.chainLightningBonusTargets = 0
  skill.cooldownRemaining = getSkillCooldown(state, skill, definition.cooldown)
  markSkillUsed(skill)
  return []
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
  if (isSkillResonant(state, skill.skillId)) {
    healing *= 2
  }
  state.player.soulTetherVitalityCharge = 0
  healPlayer(
    state,
    healing,
    definition.name,
    random,
    VITALITY_SKILL_ID,
  )
  if (state.run.selectedUpgradeIds.includes('synergy-vitality-rift-javelin')) {
    state.player.vitalityRiftPrimed = true
  }
  const newestBanner = getNewestRallyingBannerEffect(state)
  if (
    state.run.selectedUpgradeIds.includes('synergy-vitality-rallying-banner') &&
    newestBanner
  ) {
    extendRallyingBannerDuration(newestBanner, 2)
    syncRallyingBannerPlayerState(state)
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

function findSlightlyRandomSoulTetherTarget(
  state: GameState,
  maxRange: number,
  random?: Pick<RandomSource, 'next'>,
): EnemyState | BossState | undefined {
  const maxRangeSquared = maxRange * maxRange
  return [...state.enemies, ...(state.bosses ?? [])]
    .filter((enemy) => enemy.hp > 0)
    .map((enemy) => {
      const offsetX = enemy.x - state.player.x
      const offsetY = enemy.y - state.player.y
      const distanceSquared = offsetX * offsetX + offsetY * offsetY
      return { enemy, distanceSquared }
    })
    .filter((candidate) => candidate.distanceSquared <= maxRangeSquared)
    .map((candidate) => {
      const jitter = random
        ? 1 + (random.next() * 2 - 1) * SOUL_TETHER_TARGET_DISTANCE_JITTER_PERCENT
        : 1
      return {
        ...candidate,
        selectionDistanceSquared: candidate.distanceSquared * jitter,
      }
    })
    .sort((left, right) =>
      left.selectionDistanceSquared - right.selectionDistanceSquared ||
      left.enemy.id - right.enemy.id,
    )[0]?.enemy
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
  const explosionRadius = calculateAreaValue(
    (definition.radius ?? 0) + (permafrost ? GLACIAL_ORB_PERMAFROST_RADIUS_BONUS : 0),
    playerStats.areaOfEffect,
  )
  const isChilledOrFrozen = (target.chillStacks ?? 0) > 0 ||
    (target.frozenRemainingDuration ?? 0) > 0
  const iceLanceMoreDamagePercent = iceLance && isChilledOrFrozen
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
        global: damageIncreasePercent,
      },
      moreDamagePercent: iceLanceMoreDamagePercent,
      attunementSourceAdditionalIncreasedDamage:
        getAttunementSourceAdditionalIncreasedDamage(state),
    },
  )
  const impactFrostApplication: FrostApplication = {
    stacks: (permafrost ? 1 + GLACIAL_ORB_PERMAFROST_EXTRA_CHILL_STACKS : 1) +
      (isSkillResonant(state, skill.skillId) ? 1 : 0),
    durationSeconds: 4,
    freezeThreshold: 3,
    freezeDurationSeconds: 1,
  }
  const projectileCount = getProjectileVolleyCount(
    definition.tags,
    playerStats.globalExtraProjectiles,
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
  const halfWidth = calculateAreaValue(
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
  if (state.run.selectedUpgradeIds.includes('synergy-lancers-charge-rallying-banner')) {
    const newestBanner = getRallyingBannerEffectsAffectingPlayer(state).at(-1)
    if (newestBanner) {
      extendRallyingBannerDuration(
        newestBanner,
        VANGUARD_STANDARD_BANNER_EXTENSION_SECONDS,
      )
    }
    syncRallyingBannerPlayerState(state)
  }

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
        attunementSourceAdditionalIncreasedDamage:
          getAttunementSourceAdditionalIncreasedDamage(state),
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

function collectRallyingBannerEffect(
  state: GameState,
  skill: SkillState,
  allocator: EntityIdAllocator,
  random?: Pick<RandomSource, 'next'>,
): DamageEvent[] {
  const definition = getSkillDefinition(RALLYING_BANNER_SKILL_ID)
  const bulwark = state.run.selectedUpgradeIds.includes('rallying-banner-bulwark')
  const healing = getSkillHealing(definition, skill.level)
  healPlayer(
    state,
    healing,
    definition.name,
    random,
    RALLYING_BANNER_SKILL_ID,
  )

  const duration = RALLYING_BANNER_BASE_DURATION_SECONDS +
    (bulwark ? RALLYING_BANNER_BULWARK_DURATION_BONUS_SECONDS : 0) +
    (isSkillResonant(state, skill.skillId) ? RALLYING_BANNER_RESONANCE_DURATION_BONUS_SECONDS : 0)
  if (
    state.run.selectedUpgradeIds.includes(
      'synergy-raise-skeleton-rallying-banner',
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
    RALLYING_BANNER_EFFECT_RADIUS,
    duration,
    undefined,
    healing,
  )
  syncRallyingBannerPlayerState(state)
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
  const radius = calculateAreaValue(
    (definition.radius ?? 0) + (singularity ? GRAVITY_WELL_SINGULARITY_RADIUS_BONUS : 0),
    playerStats.areaOfEffect,
  )
  const pullDistance = eventHorizon
    ? 0
    : (GRAVITY_WELL_BASE_PULL_DISTANCE +
        (singularity ? GRAVITY_WELL_SINGULARITY_PULL_BONUS : 0)) *
      (isSkillResonant(state, skill.skillId) ? 2 : 1)
  const anchorsToSkeletons = state.run.selectedUpgradeIds.includes(
    'synergy-raise-skeleton-gravity-well',
  )
  const damage = getSkillDamage(definition, skill.level)
  const damageIncreasePercent = getSkillDamageIncreasePercent(
    skill.skillId,
    skill.level,
    state.run.selectedUpgradeIds,
  )

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
      const minDistance = enemy.radius + state.player.radius + 8
      pullEnemyToward(
        enemy,
        pullAnchorX,
        pullAnchorY,
        pullDistance,
        minDistance,
      )
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
        moreDamagePercent: eventHorizon
          ? GRAVITY_WELL_EVENT_HORIZON_DAMAGE_INCREASE_PERCENT
          : 0,
        attunementSourceAdditionalIncreasedDamage:
          getAttunementSourceAdditionalIncreasedDamage(state),
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
    state.run.selectedUpgradeIds.includes('synergy-gravity-well-phantom-arsenal') &&
    affected.length > 0
  ) {
    state.player.gravityWellEchoPrimed = true
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
  const radius = calculateAreaValue(definition.radius ?? 0, playerStats.areaOfEffect)
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
          attunementSourceAdditionalIncreasedDamage:
            getAttunementSourceAdditionalIncreasedDamage(state),
        },
      ),
    )

  const shieldAmount = (
    getSkillShieldAmount(definition, skill.level) +
    (bulwark ? AEGIS_PULSE_BULWARK_SHIELD_AMOUNT_BONUS : 0)
  ) * (isSkillResonant(state, skill.skillId) ? AEGIS_PULSE_RESONANCE_SHIELD_MULTIPLIER : 1)
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
      attunementSourceAdditionalIncreasedDamage:
        getAttunementSourceAdditionalIncreasedDamage(state),
    },
  )
  const projectileDefinitionId = definition.projectileDefinitionId
  if (!projectileDefinitionId) {
    throw new Error('Rift Javelin must define a projectile.')
  }
  const projectileDefinition = getProjectileDefinition(projectileDefinitionId)
  const directionX = target.x - state.player.x
  const directionY = target.y - state.player.y
  const projectileCount = getProjectileVolleyCount(
    definition.tags,
    playerStats.globalExtraProjectiles,
  )
  const directionAngle = Math.atan2(directionY, directionX)
  const spreadAngles = createProjectileSpreadAngles(
    projectileCount,
    definition.spreadDegrees ?? 0,
  )
  const primedReturnBonus = Math.max(
    0,
    state.player.riftJavelinReturnBonusPercent ?? 0,
  )
  const returnDamageBonus =
    (homeward ? RIFT_JAVELIN_HOMEWARD_DAMAGE_INCREASE_PERCENT : 0) +
    primedReturnBonus +
    (isSkillResonant(state, skill.skillId) ? RIFT_JAVELIN_RESONANCE_RETURN_BONUS_PERCENT : 0)
  const mendingReturn =
    state.run.selectedUpgradeIds.includes('synergy-vitality-rift-javelin') &&
    state.player.vitalityRiftPrimed === true
  if (mendingReturn) {
    state.player.vitalityRiftPrimed = false
    state.player.mendingReturnHealingRemaining = MENDING_RETURN_MAX_HEAL_PERCENT
  }

  state.projectiles.push(
    ...spreadAngles.map((spreadAngle) => {
      const angle = directionAngle + spreadAngle
      return {
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
        ...(mendingReturn ? { mendingReturn: true } : {}),
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
        velocityX: Math.cos(angle) * projectileDefinition.speed,
        velocityY: Math.sin(angle) * projectileDefinition.speed,
        radius: projectileDefinition.radius,
        damage: outgoingDamage.damage,
        criticalStrike: outgoingDamage.criticalStrike,
        remainingLifetime: projectileDefinition.lifetime,
      }
    }),
  )
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
      attunementSourceAdditionalIncreasedDamage:
        getAttunementSourceAdditionalIncreasedDamage(state),
    },
  )
  const radius = calculateAreaValue(
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
    fuseRemaining: isSkillResonant(state, skill.skillId) ? 0 : CINDER_MINE_FUSE_SECONDS,
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

/** Updates Cinder Mine traps, detonating any that have an enemy in range. */
export function updateCinderMineTraps(
  state: GameState,
  fixedStepSeconds: number,
  allocator: EntityIdAllocator,
): DamageEvent[] {
  const events: DamageEvent[] = []
  const remaining: TrapState[] = []
  for (const trap of [...(state.traps ?? [])].sort((left, right) => left.id - right.id)) {
    trap.fuseRemaining = Math.max(0, trap.fuseRemaining - fixedStepSeconds)
    const affected = [...state.enemies, ...(state.bosses ?? [])]
      .filter((enemy) => enemy.hp > 0)
      .filter((enemy) => Math.hypot(enemy.x - trap.x, enemy.y - trap.y) <= trap.radius + enemy.radius)
      .sort((left, right) => left.id - right.id)
    if (trap.fuseRemaining > 0 || affected.length === 0) {
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
      if (state.run.selectedUpgradeIds.includes('synergy-raise-skeleton-cinder-mine')) {
        for (const summon of state.summons) {
          if (
            summon.hp > 0 &&
            (summon.skillId ?? RAISE_SKELETON_SKILL_ID) === RAISE_SKELETON_SKILL_ID
          ) {
            summon.emberGuardCharges = Math.min(
              ASHEN_LEGION_MAX_GUARD_CHARGES,
              (summon.emberGuardCharges ?? 0) + 1,
            )
            summon.emberGuardRemaining = ASHEN_LEGION_GUARD_DURATION_SECONDS
          }
        }
      }
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
    'synergy-storm-relay-rallying-banner',
  )
  const spectrumFork = relay.spectrumForkPrimed === true &&
    state.run.selectedUpgradeIds.includes('synergy-storm-relay-prism-halo')
  const targetCount = relay.maxTargets + (spectrumFork ? 1 : 0)
  const visited = new Set<number>()
  let originX = relay.x
  let originY = relay.y
  const path: SkillEffectPoint[] = [{ x: originX, y: originY }]

  if (relay.pullRadius && relay.pullDistance) {
    for (const enemy of [...state.enemies, ...(state.bosses ?? [])]
      .filter((enemy) => enemy.hp > 0)
      .filter((enemy) =>
        Math.hypot(enemy.x - relay.x, enemy.y - relay.y) <=
          (relay.pullRadius ?? 0) + enemy.radius
      )
      .sort((left, right) => left.id - right.id)) {
      pullEnemyToward(
        enemy,
        relay.x,
        relay.y,
        relay.pullDistance,
        enemy.radius + 8,
      )
    }
  }

  for (let jump = 0; jump < targetCount; jump += 1) {
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
      damage: spectrumFork && jump === relay.maxTargets
        ? scaleDamageValues(relay.damage, AURORA_RELAY_DAMAGE_RATIO)
        : relay.damage,
      criticalStrike: relay.criticalStrike,
      shockApplication: {
        stacks: shockStacks,
        durationSeconds: relay.shockDurationSeconds,
        threshold: relay.shockThreshold,
        burstMultiplier: relay.shockBurstMultiplier,
      },
    })
    if (voltaicBond) {
      const newestTether = (state.player.soulTethers ?? [])
        .filter((tether) =>
          tether.targetId === target.id && tether.remainingDuration > 0
        )
        .at(-1)
      if (newestTether) {
        const remainingDuration = newestTether.remainingDuration
        newestTether.remainingDuration = extendDurationUpToMaximum(
          remainingDuration,
          0.5,
          SOUL_TETHER_SYNERGY_MAX_DURATION_SECONDS,
        )
        newestTether.duration += newestTether.remainingDuration - remainingDuration
      }
    }
    path.push({ x: target.x, y: target.y })
    originX = target.x
    originY = target.y
  }

  if (events.length > 0) {
    if (spectrumFork) {
      relay.spectrumForkPrimed = false
    }
    const newestBanner = getNewestRallyingBannerEffect(state)
    if (wardedConduit && newestBanner) {
      extendRallyingBannerDuration(newestBanner, 0.25)
      syncRallyingBannerPlayerState(state)
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
      attunementSourceAdditionalIncreasedDamage:
        getAttunementSourceAdditionalIncreasedDamage(state),
    },
  )

  state.relays ??= []
  const relay: RelayState = {
    id: allocator.createEntityId(),
    ownerId: state.player.id,
    skillId: skill.skillId,
    x: state.player.x,
    y: state.player.y,
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
    maxTargets: (definition.maxTargets ?? 1) +
      (isSkillResonant(state, skill.skillId) ? 1 : 0),
    shockStacks: overcharge ? STORM_RELAY_OVERCHARGE_SHOCK_STACKS : 1,
    shockDurationSeconds: 4,
    shockThreshold: 3,
    shockBurstMultiplier: 1.5,
    ...(conduit
      ? {
          pullRadius: calculateAreaValue(
            STORM_RELAY_CONDUIT_PULL_RADIUS,
            playerStats.areaOfEffect,
          ),
          pullDistance: STORM_RELAY_CONDUIT_PULL_DISTANCE,
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
    relay.remainingDuration -= fixedStepSeconds
    if (relay.remainingDuration <= 0) {
      continue
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
  random?: Pick<RandomSource, 'next'>,
): DamageEvent[] {
  const definition = getSkillDefinition(SOUL_TETHER_SKILL_ID)
  const playerStats = getDerivedPlayerStats(state.player)
  const siphon = state.run.selectedUpgradeIds.includes('soul-tether-siphon')
  const target = findSlightlyRandomSoulTetherTarget(
    state,
    definition.maxRange ?? Number.POSITIVE_INFINITY,
    random,
  )
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
      attunementSourceAdditionalIncreasedDamage:
        getAttunementSourceAdditionalIncreasedDamage(state),
    },
  )

  const tether: SoulTetherState = {
    id: allocator.createEntityId(),
    targetId: target.id,
    duration: SOUL_TETHER_DURATION_SECONDS,
    remainingDuration: SOUL_TETHER_DURATION_SECONDS,
    damagePerSecond: outgoingDamage.damage.chaos *
      (isSkillResonant(state, skill.skillId) ? SOUL_TETHER_RESONANCE_DAMAGE_MULTIPLIER : 1),
    healingRatio: SOUL_TETHER_BASE_HEALING_RATIO +
      (siphon ? SOUL_TETHER_SIPHON_HEALING_BONUS : 0),
    hasRetargeted: false,
  }
  state.player.soulTethers = [...(state.player.soulTethers ?? []), tether]

  addEffect(
    state,
    allocator,
    skill.skillId,
    getSoulTetherVisualPoints(state, tether, target),
    6,
    definition.effectLifetime,
    'line',
  )
  skill.cooldownRemaining = getSkillCooldown(state, skill, definition.cooldown)
  markSkillUsed(skill)
  return []
}

/** Ticks each active Soul Tether link, dealing chaos damage over time to its target. */
export function updateSoulTether(
  state: GameState,
  fixedStepSeconds: number,
  allocator: EntityIdAllocator,
): DamageEvent[] {
  const events: DamageEvent[] = []
  const elapsed = Math.max(0, fixedStepSeconds)
  const tethers = state.player.soulTethers ?? []
  const activeTethers: SoulTetherState[] = []
  const ticks: Array<{
    tether: SoulTetherState
    target: EnemyState | BossState
    duration: number
  }> = []
  for (const tether of tethers) {
    tether.scorchingLifelineCooldownRemaining = Math.max(
      0,
      (tether.scorchingLifelineCooldownRemaining ?? 0) - elapsed,
    )
    const activeDuration = Math.min(
      elapsed,
      Math.max(0, tether.remainingDuration),
    )
    tether.remainingDuration -= elapsed
    const target = [...state.enemies, ...(state.bosses ?? [])].find(
      (enemy) => enemy.id === tether.targetId && enemy.hp > 0,
    )
    if (target && activeDuration > 0) {
      ticks.push({ tether, target, duration: activeDuration })
    }
    if (target && tether.remainingDuration > 0) {
      activeTethers.push(tether)
    }
  }
  state.player.soulTethers = activeTethers

  const definition = getSkillDefinition(SOUL_TETHER_SKILL_ID)
  for (const tick of ticks) {
    if (tick.tether.damagePerSecond <= 0) {
      continue
    }
    events.push({
      sourceId: state.player.id,
      sourceSkillId: SOUL_TETHER_SKILL_ID,
      sourceInstanceId: tick.tether.id,
      sourceHealingRatio: tick.tether.healingRatio,
      sourceTags: ['chaos'],
      targetId: tick.target.id,
      damage: createDamageValues({
        chaos: tick.tether.damagePerSecond * tick.duration,
      }),
      damageOverTime: true,
    })
    addEffect(
      state,
      allocator,
      SOUL_TETHER_SKILL_ID,
      getSoulTetherVisualPoints(state, tick.tether, tick.target, tethers),
      6,
      definition.effectLifetime,
      'line',
    )
  }
  return events
}

// ---------------------------------------------------------------------------
// Sigil of Ruin, Mirrorcast, Razorwire, Blood Rite, and Prism Halo
// ---------------------------------------------------------------------------

function findNearbyLivingEnemies(
  state: Readonly<GameState>,
  x: number,
  y: number,
  radius: number,
  excludeIds: ReadonlySet<number>,
): Array<EnemyState | BossState> {
  const radiusSquared = radius * radius
  return [...state.enemies, ...(state.bosses ?? [])]
    .filter((enemy) => enemy.hp > 0 && !excludeIds.has(enemy.id))
    .map((enemy) => ({
      enemy,
      distanceSquared: (enemy.x - x) ** 2 + (enemy.y - y) ** 2,
    }))
    .filter((candidate) => candidate.distanceSquared <= radiusSquared)
    .sort((left, right) =>
      left.distanceSquared - right.distanceSquared || left.enemy.id - right.enemy.id,
    )
    .map((candidate) => candidate.enemy)
}

function stripAttunementDamage(
  damage: Readonly<DamageValues>,
  attunement: Readonly<DamageValues> | undefined,
): DamageValues {
  if (!attunement) {
    return { ...damage }
  }
  const stripped = { ...damage }
  for (const damageType of DAMAGE_TYPES) {
    stripped[damageType] = Math.max(0, stripped[damageType] - attunement[damageType])
  }
  return stripped
}

function collectSigilOfRuinCast(
  state: GameState,
  skill: SkillState,
  allocator: EntityIdAllocator,
): DamageEvent[] {
  const definition = getSkillDefinition(SIGIL_OF_RUIN_SKILL_ID)
  const target = findNearestLivingTarget(state, definition.maxRange ?? SIGIL_OF_RUIN_MAX_RANGE)
  if (!target) {
    return []
  }
  const resonant = isSkillResonant(state, skill.skillId)
  const damageIncreasePercent = getSkillDamageIncreasePercent(
    skill.skillId,
    skill.level,
    state.run.selectedUpgradeIds,
  )
  const detonationDamageMultiplier = 1 + damageIncreasePercent / 100
  const startingCharges = resonant ? SIGIL_OF_RUIN_RESONANCE_STARTING_CHARGES : 0
  state.player.ruinSigils ??= []
  const existing = state.player.ruinSigils.find(
    (sigil) => sigil.targetId === target.id,
  )
  if (existing) {
    existing.remainingDuration = SIGIL_OF_RUIN_DURATION_SECONDS
    existing.detonationDamageMultiplier = detonationDamageMultiplier
    existing.charges = Math.max(existing.charges, startingCharges)
    existing.spreadOnDetonate = existing.spreadOnDetonate || resonant
  } else {
    state.player.ruinSigils.push({
      id: allocator.createEntityId(),
      targetId: target.id,
      remainingDuration: SIGIL_OF_RUIN_DURATION_SECONDS,
      charges: startingCharges,
      chargedCategories: [],
      storedDamage: 0,
      storedDamageCap: SIGIL_OF_RUIN_STORED_DAMAGE_CAP,
      detonationDamageMultiplier,
      armed: false,
      spreadOnDetonate: resonant,
      canSpread: true,
    })
  }
  addEffect(
    state,
    allocator,
    skill.skillId,
    [{ x: target.x, y: target.y }],
    18,
    definition.effectLifetime,
  )
  skill.cooldownRemaining = getSkillCooldown(state, skill, definition.cooldown)
  markSkillUsed(skill)
  return []
}

/** Ticks Ruin Sigil durations and expires marks whose timer has elapsed. */
export function updateRuinSigils(
  state: GameState,
  fixedStepSeconds: number,
): void {
  const sigils = state.player.ruinSigils
  if (!sigils || sigils.length === 0) {
    return
  }
  const livingIds = new Set(
    [...state.enemies, ...(state.bosses ?? [])]
      .filter((enemy) => enemy.hp > 0)
      .map((enemy) => enemy.id),
  )
  state.player.ruinSigils = sigils.filter((sigil) => {
    sigil.remainingDuration -= fixedStepSeconds
    return sigil.remainingDuration > 0 && livingIds.has(sigil.targetId)
  })
}

function classifySkillEffect(
  definition: ReturnType<typeof getSkillDefinition>,
): 'shield' | 'healing' | 'damage' | 'utility' {
  if ((definition.shieldBaseAmount ?? 0) > 0) {
    return 'shield'
  }
  if ((definition.baseHealing ?? 0) > 0) {
    return 'healing'
  }
  const dealsDamage = definition.canProduceDirectHit &&
    (sumDamageValues(definition.baseDamage) > 0 ||
      definition.tags.some((tag) =>
        tag === 'physical' ||
        tag === 'fire' ||
        tag === 'cold' ||
        tag === 'lightning' ||
        tag === 'chaos',
      ))
  return dealsDamage ? 'damage' : 'utility'
}

function grantMirrorWardShield(state: GameState, amount: number): void {
  if (amount <= 0) {
    return
  }
  const currentMax = state.player.aegisPulseShieldMaxAmount ?? 0
  const newMax = Math.max(currentMax, amount)
  state.player.aegisPulseShieldMaxAmount = newMax
  state.player.aegisPulseShieldAmount = Math.min(
    newMax,
    (state.player.aegisPulseShieldAmount ?? 0) + amount,
  )
  state.player.aegisPulseShieldDuration = AEGIS_PULSE_BASE_DURATION_SECONDS
  state.player.aegisPulseShieldRemaining = Math.max(
    state.player.aegisPulseShieldRemaining ?? 0,
    AEGIS_PULSE_BASE_DURATION_SECONDS,
  )
}

function castMirrorcast(
  state: GameState,
  skill: SkillState,
  allocator: EntityIdAllocator,
): DamageEvent[] {
  const definition = getSkillDefinition(MIRRORCAST_SKILL_ID)
  const resonant = isSkillResonant(state, skill.skillId)
  const doubleExposure = state.run.selectedUpgradeIds.includes('mirrorcast-double-exposure')
  const deferred = state.run.selectedUpgradeIds.includes('mirrorcast-deferred-echo')
  const echoCount = doubleExposure ? MIRRORCAST_DOUBLE_EXPOSURE_ECHO_COUNT : 1
  let effectiveness = doubleExposure
    ? MIRRORCAST_DOUBLE_EXPOSURE_EFFECTIVENESS
    : deferred
      ? MIRRORCAST_DEFERRED_EFFECTIVENESS
      : MIRRORCAST_BASE_EFFECTIVENESS
  if (resonant) {
    effectiveness = Math.max(effectiveness, MIRRORCAST_RESONANCE_EFFECTIVENESS)
  }
  const levelBonus = getSkillDamageIncreasePercent(
    skill.skillId,
    skill.level,
    state.run.selectedUpgradeIds,
  ) / 100
  effectiveness *= 1 + levelBonus
  state.player.mirrorcast = {
    status: 'armed',
    captureRemaining: MIRRORCAST_CAPTURE_WINDOW_SECONDS,
    echoCount,
    effectiveness,
    preserveSecondary: resonant,
    deferred,
    copies: [],
  }
  addEffect(
    state,
    allocator,
    skill.skillId,
    [{ x: state.player.x, y: state.player.y }],
    20,
    definition.effectLifetime,
  )
  skill.cooldownRemaining = getSkillCooldown(state, skill, definition.cooldown)
  markSkillUsed(skill)
  return []
}

/** Captures the just-cast skill into an armed Mirrorcast Echo, if any. */
function captureMirrorcastIfArmed(state: GameState, castSkill: SkillState): void {
  const mirrorcast = state.player.mirrorcast
  if (
    !mirrorcast ||
    mirrorcast.status !== 'armed' ||
    castSkill.skillId === MIRRORCAST_SKILL_ID ||
    castSkill.skillId === BASIC_ATTACK_SKILL_ID ||
    !getSkillDefinition(castSkill.skillId).tags.includes('triggerable') ||
    (state.player.mirrorcastTargetSkillId !== undefined &&
      state.player.mirrorcastTargetSkillId !== castSkill.skillId)
  ) {
    return
  }
  const target = findNearestLivingTarget(state, MIRRORCAST_COPY_MAX_RANGE)
  const baseDelay = mirrorcast.deferred
    ? MIRRORCAST_DEFERRED_COPY_DELAY_SECONDS
    : MIRRORCAST_COPY_DELAY_SECONDS
  const copies: MirrorcastCopyState[] = []
  for (let index = 0; index < mirrorcast.echoCount; index += 1) {
    copies.push({
      skillId: castSkill.skillId,
      level: castSkill.level,
      delayRemaining: baseDelay * (1 + index * 0.5),
      effectiveness: mirrorcast.effectiveness,
      targetId: target?.id,
      retargetOnKill: mirrorcast.deferred,
      preserveSecondary: mirrorcast.preserveSecondary,
    })
  }
  mirrorcast.copies = copies
  mirrorcast.status = 'pending'
}

function executeMirrorcastCopy(
  state: GameState,
  allocator: EntityIdAllocator,
  copy: MirrorcastCopyState,
  random?: Pick<RandomSource, 'next'>,
): DamageEvent[] {
  const events: DamageEvent[] = []
  const mirrorWire = state.run.selectedUpgradeIds.includes('synergy-mirrorcast-razorwire')
  const prismaticEcho = state.run.selectedUpgradeIds.includes('synergy-mirrorcast-prism-halo')

  if (mirrorWire) {
    const newestWire = (state.wires ?? [])
      .filter((wire) => wire.remainingDuration > 0)
      .at(-1)
    if (newestWire) {
      newestWire.remainingDuration = extendDurationUpToMaximum(
        newestWire.remainingDuration,
        MIRRORCAST_WIRE_DURATION_BONUS_SECONDS,
        RAZORWIRE_SYNERGY_MAX_DURATION_SECONDS,
      )
    }
  }
  if (prismaticEcho && state.player.prismHalo) {
    const prismTarget = findNearestLivingTarget(state, PRISM_HALO_RANGE)
    if (prismTarget) {
      const element = PRISM_ELEMENTS[state.player.prismHalo.nextElementIndex % PRISM_ELEMENTS.length]!
      state.player.prismHalo.nextElementIndex =
        (state.player.prismHalo.nextElementIndex + 1) % PRISM_ELEMENTS.length
      events.push(...firePrismShard(state, allocator, prismTarget, element, false).map(
        (event) => ({ ...event, sourceSkillId: copy.skillId }),
      ))
    }
  }

  events.push(...executeMirrorcastSkillEffect(state, allocator, copy, random))
  return events
}

/** Ticks the Mirrorcast Echo: disarms on window expiry or runs due copies. */
export function updateMirrorcast(
  state: GameState,
  fixedStepSeconds: number,
  allocator: EntityIdAllocator,
  random?: Pick<RandomSource, 'next'>,
): DamageEvent[] {
  const mirrorcast = state.player.mirrorcast
  if (!mirrorcast) {
    return []
  }
  if (mirrorcast.status === 'armed') {
    mirrorcast.captureRemaining -= fixedStepSeconds
    if (mirrorcast.captureRemaining <= 0) {
      state.player.mirrorcast = undefined
    }
    return []
  }
  const events: DamageEvent[] = []
  const remaining: MirrorcastCopyState[] = []
  for (const copy of mirrorcast.copies) {
    copy.delayRemaining -= fixedStepSeconds
    if (copy.delayRemaining > 0) {
      remaining.push(copy)
      continue
    }
    events.push(...executeMirrorcastCopy(state, allocator, copy, random))
  }
  if (remaining.length === 0) {
    state.player.mirrorcast = undefined
  } else {
    mirrorcast.copies = remaining
  }
  return events
}

/**
 * Replays a cast through its normal implementation using an isolated skill
 * state, then scales only output created by the Echo. This keeps cooldowns,
 * cast counts, and resonance on the source skill unchanged.
 */
function executeMirrorcastSkillEffect(
  state: GameState,
  allocator: EntityIdAllocator,
  copy: MirrorcastCopyState,
  random?: Pick<RandomSource, 'next'>,
): DamageEvent[] {
  const echoSkill: SkillState = {
    skillId: copy.skillId,
    level: copy.level,
    cooldownRemaining: 0,
  }
  const hpBefore = state.player.hp
  const effectsStart = state.effects.length
  const projectilesStart = state.projectiles.length
  const trapsStart = state.traps?.length ?? 0
  const relaysStart = state.relays?.length ?? 0
  const tethersStart = state.player.soulTethers?.length ?? 0
  const wiresStart = state.wires?.length ?? 0
  const sigilsStart = state.player.ruinSigils?.length ?? 0
  let events: DamageEvent[] = []

  if (copy.skillId === WHIRLWIND_SKILL_ID) {
    events = collectWhirlwindDamage(state, echoSkill, allocator)
  } else if (copy.skillId === CHAIN_LIGHTNING_SKILL_ID) {
    events = collectChainLightningDamage(state, echoSkill, allocator, random)
  } else if (copy.skillId === VITALITY_SKILL_ID) {
    events = collectVitalityHealing(state, echoSkill, allocator, random)
  } else if (copy.skillId === GLACIAL_ORB_SKILL_ID) {
    events = collectGlacialOrbDamage(state, echoSkill, allocator)
  } else if (copy.skillId === LANCERS_CHARGE_SKILL_ID) {
    events = collectLancersChargeDamage(state, echoSkill, allocator)
  } else if (copy.skillId === RALLYING_BANNER_SKILL_ID) {
    events = collectRallyingBannerEffect(state, echoSkill, allocator, random)
  } else if (copy.skillId === GRAVITY_WELL_SKILL_ID) {
    events = collectGravityWellDamage(state, echoSkill, allocator)
  } else if (copy.skillId === AEGIS_PULSE_SKILL_ID) {
    events = collectAegisPulseDamage(state, echoSkill, allocator)
  } else if (copy.skillId === RIFT_JAVELIN_SKILL_ID) {
    events = collectRiftJavelinDamage(state, echoSkill, allocator)
  } else if (copy.skillId === CINDER_MINE_SKILL_ID) {
    placeCinderMineIfReady(state, echoSkill, allocator)
  } else if (copy.skillId === STORM_RELAY_SKILL_ID) {
    events = collectStormRelayCast(state, echoSkill, allocator)
  } else if (copy.skillId === SOUL_TETHER_SKILL_ID) {
    events = collectSoulTetherCast(state, echoSkill, allocator, random)
  } else if (copy.skillId === SIGIL_OF_RUIN_SKILL_ID) {
    events = collectSigilOfRuinCast(state, echoSkill, allocator)
  } else if (copy.skillId === RAZORWIRE_SKILL_ID) {
    events = collectRazorwireCast(state, echoSkill, allocator)
  } else if (copy.skillId === BLOOD_RITE_SKILL_ID) {
    events = collectBloodRiteCast(state, echoSkill, allocator)
  } else if (copy.skillId === PRISM_HALO_SKILL_ID) {
    events = collectPrismHaloCast(state, echoSkill, allocator)
  } else {
    throw new Error(`Mirrorcast cannot execute unsupported skill "${copy.skillId}".`)
  }

  state.player.hp = Math.min(
    state.player.maxHp,
    Math.max(0, hpBefore + (state.player.hp - hpBefore) * copy.effectiveness),
  )
  for (const effect of state.effects.slice(effectsStart)) {
    if (effect.periodicHealingAmount !== undefined) {
      effect.periodicHealingAmount *= copy.effectiveness
    }
  }
  for (const projectile of state.projectiles.slice(projectilesStart)) {
    projectile.damage = scaleDamageValues(projectile.damage, copy.effectiveness)
  }
  for (const trap of (state.traps ?? []).slice(trapsStart)) {
    trap.damage = scaleDamageValues(trap.damage, copy.effectiveness)
  }
  for (const relay of (state.relays ?? []).slice(relaysStart)) {
    relay.damage = scaleDamageValues(relay.damage, copy.effectiveness)
  }
  for (const tether of (state.player.soulTethers ?? []).slice(tethersStart)) {
    tether.damagePerSecond *= copy.effectiveness
  }
  for (const wire of (state.wires ?? []).slice(wiresStart)) {
    wire.damage = scaleDamageValues(wire.damage, copy.effectiveness)
  }
  for (const sigil of (state.player.ruinSigils ?? []).slice(sigilsStart)) {
    sigil.detonationDamageMultiplier *= copy.effectiveness
  }
  if (copy.skillId === AEGIS_PULSE_SKILL_ID) {
    state.player.aegisPulseShieldAmount =
      (state.player.aegisPulseShieldAmount ?? 0) * copy.effectiveness
    state.player.aegisPulseShieldMaxAmount =
      (state.player.aegisPulseShieldMaxAmount ?? 0) * copy.effectiveness
  }
  if (copy.skillId === BLOOD_RITE_SKILL_ID && state.player.bloodDebt) {
    state.player.bloodDebt.potency *= copy.effectiveness
    state.player.bloodDebt.sacrificedHealth *= copy.effectiveness
  }
  if (copy.skillId === PRISM_HALO_SKILL_ID && state.player.prismHalo) {
    state.player.prismHalo.effectiveness = copy.effectiveness
  }

  return events.map((event) => ({
    ...event,
    sourceSkillId: copy.skillId,
    sourceLabel: event.sourceLabel
      ? `${event.sourceLabel} (Echo)`
      : `${getSkillDefinition(copy.skillId).name} (Echo)`,
    damage: scaleDamageValues(event.damage, copy.effectiveness),
  }))
}

/**
 * Replays the focused Triggerable skill after a resolved Basic Attack critical.
 * This intentionally bypasses normal skill collection, preserving the target's
 * cooldown, cast count, and Resonance.
 */
export function triggerCriticalSpellstrike(
  state: GameState,
  allocator: EntityIdAllocator,
  random?: Pick<RandomSource, 'next'>,
): DamageEvent[] {
  const trigger = state.player.skills.find(
    (skill) => skill.skillId === CRITICAL_SPELLSTRIKE_SKILL_ID,
  )
  const targetId = state.player.criticalSpellstrikeTargetSkillId
  const target = targetId
    ? state.player.skills.find((skill) => skill.skillId === targetId)
    : undefined
  if (
    !trigger ||
    trigger.cooldownRemaining > 0 ||
    !target ||
    !getSkillDefinition(target.skillId).tags.includes('triggerable')
  ) {
    return []
  }

  const selected = state.run.selectedUpgradeIds
  const baseCooldown = getCriticalSpellstrikeBaseCooldown(selected)
  const baseline = selected.includes('critical-spellstrike-overwhelming-spellstrike')
    ? CRITICAL_SPELLSTRIKE_OVERWHELMING_EFFECTIVENESS
    : CRITICAL_SPELLSTRIKE_BASE_EFFECTIVENESS
  const effectiveness = isSkillResonant(state, trigger.skillId)
    ? 1
    : baseline +
      Math.max(0, trigger.level - 1) * CRITICAL_SPELLSTRIKE_EFFECTIVENESS_PER_LEVEL
  const copies = selected.includes('synergy-critical-spellstrike-mirrorcast') ? 2 : 1
  const events: DamageEvent[] = []
  for (let index = 0; index < copies; index += 1) {
    const copy: MirrorcastCopyState = {
      skillId: target.skillId,
      level: target.level,
      delayRemaining: 0,
      effectiveness,
      targetId: undefined,
      retargetOnKill: false,
      preserveSecondary: false,
    }
    if (selected.includes('synergy-critical-spellstrike-razorwire')) {
      const newestWire = (state.wires ?? [])
        .filter((wire) => wire.remainingDuration > 0)
        .at(-1)
      if (newestWire) {
        newestWire.remainingDuration = extendDurationUpToMaximum(
          newestWire.remainingDuration,
          MIRRORCAST_WIRE_DURATION_BONUS_SECONDS,
          RAZORWIRE_SYNERGY_MAX_DURATION_SECONDS,
        )
      }
    }
    if (selected.includes('synergy-critical-spellstrike-prism-halo') && state.player.prismHalo) {
      const prismTarget = findNearestLivingTarget(state, PRISM_HALO_RANGE)
      if (prismTarget) {
        const element = PRISM_ELEMENTS[state.player.prismHalo.nextElementIndex % PRISM_ELEMENTS.length]!
        state.player.prismHalo.nextElementIndex =
          (state.player.prismHalo.nextElementIndex + 1) % PRISM_ELEMENTS.length
        events.push(...firePrismShard(state, allocator, prismTarget, element, true).map(
          (event) => ({ ...event, sourceSkillId: target.skillId }),
        ))
      }
    }
    events.push(...executeMirrorcastSkillEffect(state, allocator, copy, random))
  }
  trigger.cooldownRemaining = getSkillCooldown(
    state,
    trigger,
    baseCooldown,
  )
  markSkillUsed(trigger)
  consumeSkillResonance(state, trigger.skillId)
  return events
}

function createRazorwire(
  state: GameState,
  allocator: EntityIdAllocator,
  centerX: number,
  centerY: number,
  directionAngle: number,
  length: number,
  margin: number,
  damage: DamageValues,
  criticalStrike: DamageEvent['criticalStrike'],
  guillotine: boolean,
): void {
  const halfLength = length / 2
  const offsetX = Math.cos(directionAngle) * halfLength
  const offsetY = Math.sin(directionAngle) * halfLength
  state.wires ??= []
  state.wires.push({
    id: allocator.createEntityId(),
    ownerId: state.player.id,
    skillId: RAZORWIRE_SKILL_ID,
    ax: centerX - offsetX,
    ay: centerY - offsetY,
    bx: centerX + offsetX,
    by: centerY + offsetY,
    remainingDuration: RAZORWIRE_DURATION_SECONDS,
    damage,
    criticalStrike,
    slowChillStacks: RAZORWIRE_SLOW_CHILL_STACKS,
    slowDurationSeconds: RAZORWIRE_SLOW_DURATION_SECONDS,
    crossingCooldownSeconds: RAZORWIRE_CROSSING_COOLDOWN_SECONDS,
    crossingMargin: margin,
    crossingCooldowns: [],
    enemySides: [],
    guillotine,
    tensionCap: RAZORWIRE_GUILLOTINE_TENSION_CAP,
    snapDamageMultiplier: RAZORWIRE_GUILLOTINE_SNAP_DAMAGE_MULTIPLIER,
    tension: [],
  })
}

function createRazorwirePattern(
  state: GameState,
  allocator: EntityIdAllocator,
  target: EnemyState | BossState,
  damage: DamageValues,
  criticalStrike: DamageEvent['criticalStrike'],
  resonant: boolean,
): void {
  const tripwire = state.run.selectedUpgradeIds.includes('razorwire-tripwire-network')
  const guillotine = state.run.selectedUpgradeIds.includes('razorwire-guillotine-line')
  const toTargetAngle = Math.atan2(
    target.y - state.player.y,
    target.x - state.player.x,
  )
  const perpendicularAngle = toTargetAngle + Math.PI / 2
  if (tripwire) {
    const tripwireDamage = scaleDamageValues(
      damage,
      RAZORWIRE_TRIPWIRE_DAMAGE_MULTIPLIER,
    )
    for (let index = 0; index < RAZORWIRE_TRIPWIRE_COUNT; index += 1) {
      const angle = perpendicularAngle + (Math.PI * index) / RAZORWIRE_TRIPWIRE_COUNT
      createRazorwire(
        state,
        allocator,
        target.x,
        target.y,
        angle,
        RAZORWIRE_TRIPWIRE_LENGTH,
        RAZORWIRE_CROSSING_MARGIN,
        tripwireDamage,
        criticalStrike,
        false,
      )
    }
  } else if (guillotine) {
    createRazorwire(
      state,
      allocator,
      target.x,
      target.y,
      perpendicularAngle,
      RAZORWIRE_GUILLOTINE_LENGTH,
      RAZORWIRE_GUILLOTINE_MARGIN,
      damage,
      criticalStrike,
      true,
    )
  } else {
    createRazorwire(
      state,
      allocator,
      target.x,
      target.y,
      perpendicularAngle,
      RAZORWIRE_WIRE_LENGTH,
      RAZORWIRE_CROSSING_MARGIN,
      damage,
      criticalStrike,
      false,
    )
    if (resonant) {
      createRazorwire(
        state,
        allocator,
        target.x,
        target.y,
        toTargetAngle,
        RAZORWIRE_WIRE_LENGTH,
        RAZORWIRE_CROSSING_MARGIN,
        damage,
        criticalStrike,
        false,
      )
    }
  }
}

function collectRazorwireCast(
  state: GameState,
  skill: SkillState,
  allocator: EntityIdAllocator,
): DamageEvent[] {
  const definition = getSkillDefinition(RAZORWIRE_SKILL_ID)
  const target = findNearestLivingTarget(state, definition.maxRange ?? RAZORWIRE_MAX_RANGE)
  if (!target) {
    return []
  }
  const playerStats = getDerivedPlayerStats(state.player)
  const resonant = isSkillResonant(state, skill.skillId)
  const damageIncreasePercent = getSkillDamageIncreasePercent(
    skill.skillId,
    skill.level,
    state.run.selectedUpgradeIds,
  )
  const outgoingDamage = createPlayerDamageProfileFromStats(
    playerStats,
    getSkillDamage(definition, skill.level),
    {
      sourceTags: definition.tags,
      additionalIncreasedDamage: { global: damageIncreasePercent },
      attunementSourceAdditionalIncreasedDamage:
        getAttunementSourceAdditionalIncreasedDamage(state),
    },
  )
  createRazorwirePattern(
    state,
    allocator,
    target,
    outgoingDamage.damage,
    outgoingDamage.criticalStrike,
    resonant,
  )
  addEffect(
    state,
    allocator,
    skill.skillId,
    [{ x: target.x, y: target.y }],
    definition.radius ?? 24,
    definition.effectLifetime,
  )
  skill.cooldownRemaining = getSkillCooldown(state, skill, definition.cooldown)
  markSkillUsed(skill)
  return []
}

function getWireSide(wire: Readonly<WireState>, x: number, y: number): number {
  const dirX = wire.bx - wire.ax
  const dirY = wire.by - wire.ay
  const cross = dirX * (y - wire.ay) - dirY * (x - wire.ax)
  return Math.sign(cross)
}

function isWithinWireSpan(
  wire: Readonly<WireState>,
  x: number,
  y: number,
): boolean {
  const dirX = wire.bx - wire.ax
  const dirY = wire.by - wire.ay
  const lengthSquared = dirX * dirX + dirY * dirY
  if (lengthSquared <= 0) {
    return false
  }
  const projection = ((x - wire.ax) * dirX + (y - wire.ay) * dirY) / lengthSquared
  const marginFraction = wire.crossingMargin / Math.sqrt(lengthSquared)
  return projection >= -marginFraction && projection <= 1 + marginFraction
}

/** Resolves Razorwire crossings deterministically and expires ended wires. */
export function updateRazorwires(
  state: GameState,
  fixedStepSeconds: number,
  allocator: EntityIdAllocator,
): DamageEvent[] {
  const wires = state.wires
  if (!wires || wires.length === 0) {
    return []
  }
  const events: DamageEvent[] = []
  const livingEnemies = [...state.enemies, ...(state.bosses ?? [])].filter(
    (enemy) => enemy.hp > 0,
  )
  const livingIds = new Set(livingEnemies.map((enemy) => enemy.id))
  const bloodwire = state.run.selectedUpgradeIds.includes('synergy-razorwire-blood-rite') &&
    (state.player.bloodDebt?.charges ?? 0) > 0
  const remaining: WireState[] = []
  for (const wire of [...wires].sort((left, right) => left.id - right.id)) {
    wire.remainingDuration -= fixedStepSeconds
    if (wire.remainingDuration <= 0) {
      continue
    }
    wire.frostedRemainingDuration = Math.max(
      0,
      (wire.frostedRemainingDuration ?? 0) - fixedStepSeconds,
    )
    wire.frostedCrossingCooldownRemaining = Math.max(
      0,
      (wire.frostedCrossingCooldownRemaining ?? 0) - fixedStepSeconds,
    )
    for (const cooldown of wire.crossingCooldowns) {
      cooldown.remaining = Math.max(0, cooldown.remaining - fixedStepSeconds)
    }
    for (const enemy of [...livingEnemies].sort((left, right) => left.id - right.id)) {
      const side = getWireSide(wire, enemy.x, enemy.y)
      const sideEntry = wire.enemySides.find((entry) => entry.enemyId === enemy.id)
      const previousSide = sideEntry?.side ?? 0
      const crossed = previousSide !== 0 &&
        side !== 0 &&
        side !== previousSide &&
        isWithinWireSpan(wire, enemy.x, enemy.y)
      if (sideEntry) {
        sideEntry.side = side
      } else {
        wire.enemySides.push({ enemyId: enemy.id, side })
      }
      if (!crossed) {
        continue
      }
      const cooldownEntry = wire.crossingCooldowns.find(
        (entry) => entry.enemyId === enemy.id,
      )
      if (cooldownEntry && cooldownEntry.remaining > 0) {
        continue
      }
      if (cooldownEntry) {
        cooldownEntry.remaining = wire.crossingCooldownSeconds
      } else {
        wire.crossingCooldowns.push({
          enemyId: enemy.id,
          remaining: wire.crossingCooldownSeconds,
        })
      }
      let crossingDamage = wire.damage
      if (wire.guillotine) {
        const tensionEntry = wire.tension.find((entry) => entry.enemyId === enemy.id)
        const nextValue = (tensionEntry?.value ?? 0) + 1
        if (nextValue >= wire.tensionCap) {
          crossingDamage = scaleDamageValues(wire.damage, wire.snapDamageMultiplier)
          if (tensionEntry) {
            tensionEntry.value = 0
          }
        } else if (tensionEntry) {
          tensionEntry.value = nextValue
        } else {
          wire.tension.push({ enemyId: enemy.id, value: nextValue })
        }
      }
      const chillStacks = wire.slowChillStacks
      const frostlineReady =
        (wire.frostedRemainingDuration ?? 0) > 0 &&
        (wire.frostedCrossingCooldownRemaining ?? 0) <= 0
      const crossingEventDamage = bloodwire
        ? addDamageValues(crossingDamage, { chaos: RAZORWIRE_BLOODWIRE_CHAOS_DAMAGE })
        : crossingDamage
      const frostlineDamage = frostlineReady
        ? addDamageValues(crossingEventDamage, {
            cold: sumDamageValues(crossingEventDamage) * FROSTLINE_DAMAGE_RATIO,
          })
        : crossingEventDamage
      if (frostlineReady) {
        wire.frostedRemainingDuration = 0
        wire.frostedCrossingCooldownRemaining = FROSTLINE_CROSSING_COOLDOWN_SECONDS
      }
      events.push({
        sourceId: state.player.id,
        sourceSkillId: RAZORWIRE_SKILL_ID,
        sourceTags: getSkillDefinition(RAZORWIRE_SKILL_ID).tags,
        targetId: enemy.id,
        damage: frostlineDamage,
        criticalStrike: wire.criticalStrike,
        frostApplication: {
          stacks: chillStacks + (frostlineReady ? 1 : 0),
          durationSeconds: wire.slowDurationSeconds,
        },
      })
      addEffect(
        state,
        allocator,
        RAZORWIRE_SKILL_ID,
        [{ x: enemy.x, y: enemy.y }],
        10,
        getSkillDefinition(RAZORWIRE_SKILL_ID).effectLifetime,
      )
    }
    wire.crossingCooldowns = wire.crossingCooldowns.filter(
      (entry) => livingIds.has(entry.enemyId) && entry.remaining > 0,
    )
    wire.enemySides = wire.enemySides.filter((entry) => livingIds.has(entry.enemyId))
    wire.tension = wire.tension.filter((entry) => livingIds.has(entry.enemyId))
    remaining.push(wire)
  }
  state.wires = remaining
  return events
}

function collectBloodRiteCast(
  state: GameState,
  skill: SkillState,
  allocator: EntityIdAllocator,
): DamageEvent[] {
  const definition = getSkillDefinition(BLOOD_RITE_SKILL_ID)
  const playerStats = getDerivedPlayerStats(state.player)
  const resonant = isSkillResonant(state, skill.skillId)
  const crimson = state.run.selectedUpgradeIds.includes('blood-rite-crimson-debt')
  const sanguine = state.run.selectedUpgradeIds.includes('blood-rite-sanguine-pact')
  const prismOffering = state.run.selectedUpgradeIds.includes('synergy-blood-rite-prism-halo')
  const prismHalo = state.player.prismHalo
  state.player.bloodRiteShieldRestored = 0

  const notionalSacrifice = Math.max(
    0,
    Math.min(
      state.player.hp * BLOOD_RITE_SACRIFICE_FRACTION,
      state.player.hp - BLOOD_RITE_MIN_HP_AFTER,
    ),
  )
  const sacrifice = resonant ? 0 : notionalSacrifice
  if (sacrifice > 0) {
    state.player.hp = Math.max(BLOOD_RITE_MIN_HP_AFTER, state.player.hp - sacrifice)
  }
  const damageIncreasePercent = getSkillDamageIncreasePercent(
    skill.skillId,
    skill.level,
    state.run.selectedUpgradeIds,
  )
  // Resonance forgoes the HP cost but still stores a larger debt: potency is
  // sized from the sacrifice the ritual would have demanded, then amplified.
  let potency = Math.min(
    BLOOD_RITE_MAX_POTENCY,
    BLOOD_RITE_BASE_POTENCY + notionalSacrifice * BLOOD_RITE_POTENCY_PER_SACRIFICED_HP,
  ) * (1 + damageIncreasePercent / 100)
  if (resonant) {
    potency *= BLOOD_RITE_RESONANCE_POTENCY_MULTIPLIER
  }
  const charges = crimson ? BLOOD_RITE_CRIMSON_CHARGES : 1
  const perChargePotency = crimson
    ? potency * BLOOD_RITE_CRIMSON_POTENCY_MULTIPLIER
    : potency
  state.player.bloodDebt = {
    charges,
    potency: perChargePotency,
    sacrificedHealth: sacrifice,
    remainingDuration: BLOOD_RITE_DEBT_DURATION_SECONDS,
    sanguinePact: sanguine,
  }
  if (prismOffering && prismHalo && prismHalo.remainingDuration > 0) {
    prismHalo.remainingDuration = extendDurationUpToMaximum(
      prismHalo.remainingDuration,
      BLOOD_RITE_PRISM_DURATION_BONUS_SECONDS,
      PRISM_HALO_SYNERGY_MAX_DURATION_SECONDS,
    )
  }

  const pulseRadius = calculateAreaValue(
    definition.radius ?? BLOOD_RITE_PULSE_RADIUS,
    playerStats.areaOfEffect,
  )
  const outgoingDamage = createPlayerDamageProfileFromStats(
    playerStats,
    getSkillDamage(definition, skill.level),
    {
      sourceTags: definition.tags,
      additionalIncreasedDamage: { global: damageIncreasePercent },
      attunementSourceAdditionalIncreasedDamage:
        getAttunementSourceAdditionalIncreasedDamage(state),
    },
  )
  const events: DamageEvent[] = []
  for (const enemy of findNearbyLivingEnemies(
    state,
    state.player.x,
    state.player.y,
    pulseRadius,
    new Set(),
  )) {
    events.push({
      sourceId: state.player.id,
      sourceSkillId: BLOOD_RITE_SKILL_ID,
      sourceTags: definition.tags,
      targetId: enemy.id,
      damage: outgoingDamage.damage,
      criticalStrike: outgoingDamage.criticalStrike,
    })
  }
  addEffect(
    state,
    allocator,
    skill.skillId,
    [{ x: state.player.x, y: state.player.y }],
    pulseRadius,
    definition.effectLifetime,
  )
  skill.cooldownRemaining = getSkillCooldown(state, skill, definition.cooldown)
  markSkillUsed(skill)
  return events
}

/** Consumes one Blood Debt charge to empower the skill that was just cast. */
function consumeBloodDebtForCast(
  state: GameState,
  castSkill: SkillState,
): DamageEvent[] {
  const debt = state.player.bloodDebt
  if (
    !debt ||
    debt.charges <= 0 ||
    castSkill.skillId === BLOOD_RITE_SKILL_ID ||
    castSkill.skillId === BASIC_ATTACK_SKILL_ID ||
    (state.player.bloodRiteTargetSkillId !== undefined &&
      state.player.bloodRiteTargetSkillId !== castSkill.skillId)
  ) {
    return []
  }
  const definition = getSkillDefinition(castSkill.skillId)
  const category = classifySkillEffect(definition)
  const potency = debt.potency
  const events: DamageEvent[] = []
  if (category === 'healing') {
    healPlayer(state, potency, 'Blood Debt', undefined, castSkill.skillId)
  } else if (category === 'shield') {
    grantMirrorWardShield(state, potency)
  } else if (category === 'damage') {
    const target = findNearestLivingTarget(state, SIGIL_OF_RUIN_MAX_RANGE)
    if (target) {
      events.push({
        sourceId: state.player.id,
        sourceSkillId: BLOOD_RITE_SKILL_ID,
        sourceLabel: 'Blood Debt',
        sourceTags: ['chaos'],
        targetId: target.id,
        damage: createDamageValues({ chaos: potency }),
      })
      if (debt.sanguinePact) {
        healPlayer(
          state,
          potency * BLOOD_RITE_SANGUINE_HEAL_RATIO,
          'Sanguine Pact',
          undefined,
          BLOOD_RITE_SKILL_ID,
        )
      }
    }
  } else {
    const newestTether = (state.player.soulTethers ?? [])
      .filter((tether) => tether.remainingDuration > 0)
      .at(-1)
    if (newestTether) {
      newestTether.remainingDuration = extendDurationUpToMaximum(
        newestTether.remainingDuration,
        BLOOD_RITE_UTILITY_DURATION_BONUS_SECONDS,
        SOUL_TETHER_SYNERGY_MAX_DURATION_SECONDS,
      )
    }
    const newestRelay = (state.relays ?? [])
      .filter((relay) => relay.remainingDuration > 0)
      .at(-1)
    if (newestRelay) {
      newestRelay.remainingDuration = extendDurationUpToMaximum(
        newestRelay.remainingDuration,
        BLOOD_RITE_UTILITY_DURATION_BONUS_SECONDS,
        STORM_RELAY_SYNERGY_MAX_DURATION_SECONDS,
      )
    }
    const newestWire = (state.wires ?? [])
      .filter((wire) => wire.remainingDuration > 0)
      .at(-1)
    if (newestWire) {
      newestWire.remainingDuration = extendDurationUpToMaximum(
        newestWire.remainingDuration,
        BLOOD_RITE_UTILITY_DURATION_BONUS_SECONDS,
        RAZORWIRE_SYNERGY_MAX_DURATION_SECONDS,
      )
    }
    const prismHalo = state.player.prismHalo
    if (prismHalo && prismHalo.remainingDuration > 0) {
      prismHalo.remainingDuration = extendDurationUpToMaximum(
        prismHalo.remainingDuration,
        BLOOD_RITE_UTILITY_DURATION_BONUS_SECONDS,
        PRISM_HALO_SYNERGY_MAX_DURATION_SECONDS,
      )
    }
  }
  debt.charges -= 1
  if (debt.charges <= 0) {
    state.player.bloodDebt = undefined
  }
  return events
}

/** Ticks Blood Debt expiry. */
export function updateBloodDebt(
  state: GameState,
  fixedStepSeconds: number,
): void {
  const debt = state.player.bloodDebt
  if (!debt) {
    return
  }
  debt.remainingDuration -= fixedStepSeconds
  if (debt.remainingDuration <= 0 || debt.charges <= 0) {
    state.player.bloodDebt = undefined
  }
}

const PRISM_ELEMENTS = ['fire', 'cold', 'lightning'] as const
type PrismElement = (typeof PRISM_ELEMENTS)[number]
type PrismBeamElement = PrismElement | 'all'

function getPrismStatusApplications(
  element: PrismElement,
): Pick<DamageEvent, 'frostApplication' | 'shockApplication' | 'burningApplication'> {
  if (element === 'cold') {
    return {
      frostApplication: {
        stacks: PRISM_HALO_CHILL_STACKS,
        durationSeconds: PRISM_HALO_CHILL_DURATION_SECONDS,
      },
    }
  }
  if (element === 'lightning') {
    return {
      shockApplication: {
        stacks: PRISM_HALO_SHOCK_STACKS,
        durationSeconds: PRISM_HALO_SHOCK_DURATION_SECONDS,
        threshold: 3,
        burstMultiplier: 1.5,
      },
    }
  }
  return {
    burningApplication: {
      durationSeconds: PRISM_HALO_BURNING_DURATION_SECONDS,
      fireDamageRatio: PRISM_HALO_BURNING_FIRE_DAMAGE_RATIO,
    },
  }
}

function updatePrismConvergence(
  state: GameState,
  target: Readonly<EnemyState | BossState>,
  element: PrismElement,
  primaryDamage: Readonly<DamageValues>,
  criticalStrike: DamageEvent['criticalStrike'],
): DamageEvent[] {
  if (!state.run.selectedUpgradeIds.includes('prism-halo-chromatic-convergence')) {
    return []
  }
  state.player.prismConvergence ??= []
  let mark = state.player.prismConvergence.find((entry) => entry.enemyId === target.id)
  if (!mark) {
    mark = {
      enemyId: target.id,
      fire: false,
      cold: false,
      lightning: false,
      remaining: PRISM_HALO_CONVERGENCE_WINDOW_SECONDS,
    }
    state.player.prismConvergence.push(mark)
  }
  mark[element] = true
  mark.remaining = PRISM_HALO_CONVERGENCE_WINDOW_SECONDS
  if (!mark.fire || !mark.cold || !mark.lightning) {
    return []
  }
  mark.fire = false
  mark.cold = false
  mark.lightning = false
  // The Prism Burst recombines the shard's magnitude across all three elements.
  const perElement = (sumDamageValues(primaryDamage) / 3) *
    PRISM_HALO_CONVERGENCE_BURST_MULTIPLIER
  return [{
    sourceId: state.player.id,
    sourceSkillId: PRISM_HALO_SKILL_ID,
    sourceLabel: 'Prism Burst',
    sourceTags: ['fire', 'cold', 'lightning'],
    targetId: target.id,
    damage: createDamageValues({
      fire: perElement,
      cold: perElement,
      lightning: perElement,
    }),
    criticalStrike,
  }]
}

function firePrismShard(
  state: GameState,
  allocator: EntityIdAllocator,
  target: EnemyState | BossState,
  element: PrismElement,
  applyAttunement: boolean,
): DamageEvent[] {
  const definition = getSkillDefinition(PRISM_HALO_SKILL_ID)
  const skill = state.player.skills.find((candidate) => candidate.skillId === PRISM_HALO_SKILL_ID)
  const level = skill?.level ?? 1
  const playerStats = getDerivedPlayerStats(state.player)
  const magnitude = sumDamageValues(getSkillDamage(definition, level))
  const damageIncreasePercent = getSkillDamageIncreasePercent(
    PRISM_HALO_SKILL_ID,
    level,
    state.run.selectedUpgradeIds,
  )
  const profile = createPlayerDamageProfileFromStats(
    playerStats,
    { [element]: magnitude },
    {
      sourceTags: definition.tags,
      additionalIncreasedDamage: { global: damageIncreasePercent },
      attunementSourceAdditionalIncreasedDamage:
        getAttunementSourceAdditionalIncreasedDamage(state),
    },
  )
  const shardDamage = applyAttunement
    ? profile.damage
    : stripAttunementDamage(profile.damage, profile.attunementDamage)
  const effectiveness = state.player.prismHalo?.effectiveness ?? 1
  const effectiveShardDamage = scaleDamageValues(shardDamage, effectiveness)
  const statusApplications = getPrismStatusApplications(element)
  const events: DamageEvent[] = [{
    sourceId: state.player.id,
    sourceSkillId: PRISM_HALO_SKILL_ID,
    sourceTags: definition.tags,
    targetId: target.id,
    damage: effectiveShardDamage,
    criticalStrike: profile.criticalStrike,
    ...statusApplications,
  }]

  if (state.run.selectedUpgradeIds.includes('prism-halo-refraction')) {
    const splitDamage = scaleDamageValues(
      effectiveShardDamage,
      PRISM_HALO_REFRACTION_DAMAGE_MULTIPLIER,
    )
    const splits = findNearbyLivingEnemies(
      state,
      target.x,
      target.y,
      PRISM_HALO_REFRACTION_SPLIT_RADIUS,
      new Set([target.id]),
    ).slice(0, PRISM_HALO_REFRACTION_MAX_SPLITS)
    for (const enemy of splits) {
      events.push({
        sourceId: state.player.id,
        sourceSkillId: PRISM_HALO_SKILL_ID,
        sourceLabel: 'Refraction',
        sourceTags: definition.tags,
        targetId: enemy.id,
        damage: splitDamage,
        criticalStrike: profile.criticalStrike,
        ...statusApplications,
      })
      addEffect(
        state,
        allocator,
        PRISM_HALO_SKILL_ID,
        [
          { x: target.x, y: target.y },
          { x: enemy.x, y: enemy.y },
        ],
        5,
        definition.effectLifetime,
        'line',
      )
    }

  }

  events.push(
    ...updatePrismConvergence(
      state,
      target,
      element,
      effectiveShardDamage,
      profile.criticalStrike,
    ),
  )
  return events
}

function addPrismBeamEffect(
  state: GameState,
  allocator: EntityIdAllocator,
  target: Readonly<EnemyState | BossState>,
  beamElement: PrismBeamElement,
): void {
  const definition = getSkillDefinition(PRISM_HALO_SKILL_ID)
  state.effects.push({
    id: allocator.createEntityId(),
    skillId: PRISM_HALO_SKILL_ID,
    shape: 'line',
    prismBeamElement: beamElement,
    x: state.player.x,
    y: state.player.y,
    radius: 6,
    lifetime: definition.effectLifetime,
    remainingLifetime: definition.effectLifetime,
    points: [
      { x: state.player.x, y: state.player.y },
      { x: target.x, y: target.y },
    ],
  })
}

/** Ticks the Prism Halo: advances rotation and fires shards on the interval. */
export function updatePrismHalo(
  state: GameState,
  fixedStepSeconds: number,
  allocator: EntityIdAllocator,
): DamageEvent[] {
  const halo = state.player.prismHalo
  if (state.player.prismConvergence) {
    state.player.prismConvergence = state.player.prismConvergence.filter((mark) => {
      mark.remaining -= fixedStepSeconds
      return mark.remaining > 0
    })
  }
  if (!halo) {
    return []
  }
  halo.remainingDuration -= fixedStepSeconds
  halo.rotation += PRISM_HALO_ORBIT_ANGULAR_SPEED * fixedStepSeconds
  if (halo.remainingDuration <= 0) {
    state.player.prismHalo = undefined
    return []
  }
  halo.fireCooldownRemaining -= fixedStepSeconds
  if (halo.fireCooldownRemaining > 0) {
    return []
  }
  const definition = getSkillDefinition(PRISM_HALO_SKILL_ID)
  const target = findNearestLivingTarget(state, definition.maxRange ?? PRISM_HALO_RANGE)
  if (!target) {
    return []
  }
  halo.fireCooldownRemaining = PRISM_HALO_FIRE_INTERVAL_SECONDS
  const events: DamageEvent[] = []
  if (halo.firesAllElements) {
    for (let index = 0; index < PRISM_ELEMENTS.length; index += 1) {
      events.push(...firePrismShard(state, allocator, target, PRISM_ELEMENTS[index]!, index === 0))
    }
  } else {
    const element = PRISM_ELEMENTS[halo.nextElementIndex % PRISM_ELEMENTS.length]!
    halo.nextElementIndex = (halo.nextElementIndex + 1) % PRISM_ELEMENTS.length
    events.push(...firePrismShard(state, allocator, target, element, true))
  }
  if (
    state.run.selectedUpgradeIds.includes('synergy-storm-relay-prism-halo') &&
    state.relays
  ) {
    for (const relay of state.relays) {
      relay.spectrumForkPrimed = true
    }
  }
  addPrismBeamEffect(
    state,
    allocator,
    target,
    halo.firesAllElements
      ? 'all'
      : PRISM_ELEMENTS[(halo.nextElementIndex + PRISM_ELEMENTS.length - 1) %
        PRISM_ELEMENTS.length]!,
  )
  return events
}

function collectPrismHaloCast(
  state: GameState,
  skill: SkillState,
  allocator: EntityIdAllocator,
): DamageEvent[] {
  const definition = getSkillDefinition(PRISM_HALO_SKILL_ID)
  const resonant = isSkillResonant(state, skill.skillId)
  state.player.prismHalo = {
    ownerId: state.player.id,
    remainingDuration: PRISM_HALO_DURATION_SECONDS,
    fireCooldownRemaining: 0,
    nextElementIndex: 0,
    firesAllElements: resonant,
    rotation: 0,
  }
  addEffect(
    state,
    allocator,
    skill.skillId,
    [{ x: state.player.x, y: state.player.y }],
    PRISM_HALO_ORBIT_RADIUS,
    definition.effectLifetime,
  )
  skill.cooldownRemaining = getSkillCooldown(state, skill, definition.cooldown)
  markSkillUsed(skill)
  return []
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
    if (skill.skillId === CRITICAL_SPELLSTRIKE_SKILL_ID) {
      continue
    }
    if (skill.cooldownRemaining > 0) {
      continue
    }
    const castCountBefore = skill.castCount ?? 0
    const resonant = isSkillResonant(state, skill.skillId)
    if (skill.skillId === WHIRLWIND_SKILL_ID) {
      events.push(...collectWhirlwindDamage(state, skill, allocator))
    } else if (skill.skillId === CHAIN_LIGHTNING_SKILL_ID) {
      events.push(...collectChainLightningDamage(state, skill, allocator, random))
    } else if (skill.skillId === VITALITY_SKILL_ID) {
      events.push(...collectVitalityHealing(state, skill, allocator, random))
    } else if (skill.skillId === GLACIAL_ORB_SKILL_ID) {
      events.push(...collectGlacialOrbDamage(state, skill, allocator))
    } else if (skill.skillId === LANCERS_CHARGE_SKILL_ID) {
      events.push(...collectLancersChargeDamage(state, skill, allocator))
    } else if (skill.skillId === RALLYING_BANNER_SKILL_ID) {
      events.push(...collectRallyingBannerEffect(state, skill, allocator, random))
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
      events.push(...collectSoulTetherCast(state, skill, allocator, random))
    } else if (skill.skillId === SIGIL_OF_RUIN_SKILL_ID) {
      events.push(...collectSigilOfRuinCast(state, skill, allocator))
    } else if (skill.skillId === MIRRORCAST_SKILL_ID) {
      events.push(...castMirrorcast(state, skill, allocator))
    } else if (skill.skillId === RAZORWIRE_SKILL_ID) {
      events.push(...collectRazorwireCast(state, skill, allocator))
    } else if (skill.skillId === BLOOD_RITE_SKILL_ID) {
      events.push(...collectBloodRiteCast(state, skill, allocator))
    } else if (skill.skillId === PRISM_HALO_SKILL_ID) {
      events.push(...collectPrismHaloCast(state, skill, allocator))
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
    if ((skill.castCount ?? 0) > castCountBefore) {
      // Blood Debt and Mirrorcast react to any skill that actually cast this
      // tick, but never to Basic Attack (handled elsewhere) or their own casts.
      events.push(...consumeBloodDebtForCast(state, skill))
      captureMirrorcastIfArmed(state, skill)
      if (resonant) {
        applySkillResonanceEffect(state, skill.skillId)
        consumeSkillResonance(state, skill.skillId)
      }
    }
  }

  return events
}
