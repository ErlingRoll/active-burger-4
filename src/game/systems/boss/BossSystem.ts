import {
  getBossDefinition,
  getBossSkillDefinition,
  isBossSkillId,
  INFERNO_WARDEN_ENRAGE_DEFINITION,
  type BossDefinitionId,
  type BossEnrageDefinition,
  type BossSkillDefinition,
  type BossSkillId,
} from '../../../content/bosses/Bosses'
import { createDamageValues } from '../../../content/stats/Damage'
import { getBossDamageMultiplier } from '../../../content/dungeons/Dungeons'
import { getPostSpawnSpeedMultiplier } from '../../../content/enemies/EnemyAcceleration'
import type { EntityIdAllocator } from '../../ids'
import { createBossDamageProfile } from '../../combat/DamageSources'
import { isPointInTelegraph } from '../../geometry/TelegraphGeometry'
import type {
  BossState,
  DamageEvent,
  GameState,
  SkillEffectPoint,
  TelegraphState,
} from '../../state/GameState'

export const INFERNO_WARDEN_ENRAGE_RATE_PER_SECOND = 0.01

export interface BossEnrageMultipliers {
  movementSpeedMultiplier: number
  damageMultiplier: number
  cooldownMultiplier: number
}

const NO_ENRAGE: BossEnrageMultipliers = {
  movementSpeedMultiplier: 1,
  damageMultiplier: 1,
  cooldownMultiplier: 1,
}

export function getInfernoWardenEnrageMultipliers(
  elapsedSeconds: number,
  enrage: BossEnrageDefinition = INFERNO_WARDEN_ENRAGE_DEFINITION,
): BossEnrageMultipliers {
  const multiplier = Math.pow(
    1 + enrage.movementSpeedPerSecond,
    Math.max(0, elapsedSeconds),
  )
  const cooldownMultiplier = Math.pow(
    1 - enrage.cooldownReductionPerSecond,
    Math.max(0, elapsedSeconds),
  )
  return {
    movementSpeedMultiplier: Math.min(
      enrage.maxMovementSpeedMultiplier,
      multiplier,
    ),
    damageMultiplier: Math.min(
      enrage.maxDamageMultiplier,
      Math.pow(
        1 + enrage.damagePerSecond,
        Math.max(0, elapsedSeconds),
      ),
    ),
    cooldownMultiplier: Math.max(
      enrage.minCooldownMultiplier,
      cooldownMultiplier,
    ),
  }
}

export const getBossEnrageMultipliers = getInfernoWardenEnrageMultipliers

/**
 * Enrage is a property of the boss definition rather than of one boss's name.
 * The Inferno Warden is still the only one that has it, but a second boss that
 * should grow over a long fight now only needs the field.
 */
function getBossEnrage(
  state: GameState,
  boss: BossState,
): BossEnrageMultipliers {
  const enrage = getBossDefinition(boss.bossDefinitionId).enrage
  if (!enrage) {
    return NO_ENRAGE
  }
  return getInfernoWardenEnrageMultipliers(
    state.time - (boss.spawnTime ?? state.time),
    enrage,
  )
}

function moveBossTowardPlayer(
  state: GameState,
  boss: BossState,
  fixedStepSeconds: number,
): void {
  const dx = state.player.x - boss.x
  const dy = state.player.y - boss.y
  const distance = Math.hypot(dx, dy)
  const stopDistance = state.player.radius + boss.radius
  if (distance <= stopDistance || distance === 0) {
    return
  }
  const amount = Math.min(boss.speed * fixedStepSeconds, distance - stopDistance)
  boss.x += (dx / distance) * amount
  boss.y += (dy / distance) * amount
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/** Where the boss is aiming: the direction from it to the player. */
function getAimAngle(state: GameState, boss: BossState): number {
  const dx = state.player.x - boss.x
  const dy = state.player.y - boss.y
  return dx === 0 && dy === 0 ? 0 : Math.atan2(dy, dx)
}

/**
 * How far short of the player a mark lands, as a fraction of its radius.
 *
 * A circle centred exactly on the player has no direction out of it: every way
 * is the same length, and the escape falls back to an arbitrary axis, which for
 * a pattern of several marks can be straight into the next one. Landing it a
 * little short of the player - between them and the caster - costs the player
 * a shorter step and, more importantly, makes that step a definite one: away
 * from what threw it.
 */
const MARK_LEAD_FRACTION = 0.35

/**
 * The anchors a skill's areas are centred on.
 *
 * Repeated marks land in a stable pattern rather than a random scatter: one on
 * the player and the rest ringed around, turned so the gap in the ring is the
 * direction the first one pushes them. A player who has not moved is caught by
 * the near mark and has somewhere to go; a random scatter would make the same
 * attack a coin flip instead.
 */
function getDiscAnchors(
  state: GameState,
  boss: BossState,
  definition: BossSkillDefinition,
): readonly SkillEffectPoint[] {
  if (definition.origin !== 'player') {
    return [{ x: boss.x, y: boss.y }]
  }
  const away = getAimAngle(state, boss)
  const lead = definition.radius * MARK_LEAD_FRACTION
  const centreX = state.player.x - Math.cos(away) * lead
  const centreY = state.player.y - Math.sin(away) * lead
  const count = Math.max(1, Math.floor(definition.count ?? 1))
  if (count === 1 || !definition.scatter) {
    return [{ x: centreX, y: centreY }]
  }
  const outerCount = count - 1
  const anchors: SkillEffectPoint[] = [{ x: centreX, y: centreY }]
  for (let index = 0; index < outerCount; index += 1) {
    // Half a step of rotation puts a gap on the escape line rather than a mark.
    const angle = away + Math.PI / outerCount + (Math.PI * 2 * index) / outerCount
    anchors.push({
      x: state.player.x + Math.cos(angle) * definition.scatter,
      y: state.player.y + Math.sin(angle) * definition.scatter,
    })
  }
  return anchors
}

/** The centre direction of each line or cone a skill casts. */
function getAimAngles(
  state: GameState,
  boss: BossState,
  definition: BossSkillDefinition,
): readonly number[] {
  const baseAngle = getAimAngle(state, boss)
  const count = Math.max(1, Math.floor(definition.count ?? 1))
  if (count === 1) {
    return [baseAngle]
  }
  const spread = toRadians(definition.spreadDegrees ?? 0)
  return Array.from(
    { length: count },
    (_, index) => baseAngle + (index - (count - 1) / 2) * spread,
  )
}

function createTelegraph(
  state: GameState,
  boss: BossState,
  allocator: EntityIdAllocator,
  skillId: BossSkillId,
  definition: BossSkillDefinition,
  x: number,
  y: number,
  angle: number,
  damageMultiplier: number,
): TelegraphState {
  const length = definition.range ?? definition.radius
  const points: readonly SkillEffectPoint[] = definition.shape === 'line'
    ? [
        { x, y },
        { x: x + Math.cos(angle) * length, y: y + Math.sin(angle) * length },
      ]
    : [{ x, y }]
  const damage = createBossDamageProfile(
    boss,
    createDamageValues({
      [definition.damageType]: definition.damage *
        damageMultiplier *
        getBossDamageMultiplier(
          state.run.floor ?? state.encounter?.floorNumber ?? 1,
        ),
    }),
  )
  return {
    id: allocator.createEntityId(),
    sourceId: boss.id,
    sourceKind: 'boss',
    skillId,
    shape: definition.shape,
    element: definition.damageType,
    x,
    y,
    radius: definition.radius,
    ...(definition.shape === 'ring' && definition.innerRadius !== undefined
      ? { innerRadius: definition.innerRadius }
      : {}),
    ...(definition.shape === 'cone'
      ? { angle, arc: toRadians(definition.arcDegrees ?? 360) }
      : {}),
    remainingDuration: definition.telegraphDuration,
    duration: definition.telegraphDuration,
    points,
    damage: damage.damage,
    criticalStrike: damage.criticalStrike,
    ...(damage.poisonApplication
      ? { poisonApplication: damage.poisonApplication }
      : {}),
    ...(definition.dash ? { dashesOnResolve: true } : {}),
  }
}

/**
 * Casts the boss's next ready skill, as whatever set of areas it declares.
 *
 * Which areas those are comes entirely from the definition: the shape, where it
 * is anchored, how many there are and how they are spread. Nothing here knows
 * the name of any attack, so a new one is a content change.
 */
function castNextSkill(
  state: GameState,
  boss: BossState,
  allocator: EntityIdAllocator,
): void {
  if (
    boss.skills.length === 0 ||
    (state.telegraphs ?? []).some((telegraph) => telegraph.sourceId === boss.id)
  ) {
    return
  }
  const skillState = boss.skills[boss.nextSkillIndex % boss.skills.length]
  if (!skillState || skillState.cooldownRemaining > 0) {
    return
  }
  const definition = getBossSkillDefinition(skillState.skillId)
  const enrage = getBossEnrage(state, boss)
  const telegraphs: TelegraphState[] = []
  if (definition.shape === 'disc' || definition.shape === 'ring') {
    for (const anchor of getDiscAnchors(state, boss, definition)) {
      telegraphs.push(createTelegraph(
        state,
        boss,
        allocator,
        skillState.skillId,
        definition,
        anchor.x,
        anchor.y,
        0,
        enrage.damageMultiplier,
      ))
    }
  } else {
    for (const angle of getAimAngles(state, boss, definition)) {
      telegraphs.push(createTelegraph(
        state,
        boss,
        allocator,
        skillState.skillId,
        definition,
        boss.x,
        boss.y,
        angle,
        enrage.damageMultiplier,
      ))
    }
  }
  if (telegraphs.length === 0) {
    return
  }
  state.telegraphs ??= []
  state.telegraphs.push(...telegraphs)
  skillState.cooldownRemaining = definition.cooldown * enrage.cooldownMultiplier
  boss.nextSkillIndex = (boss.nextSkillIndex + 1) % boss.skills.length
}

export function updateBosses(
  state: GameState,
  allocator: EntityIdAllocator,
  fixedStepSeconds: number,
): void {
  for (const boss of [...(state.bosses ?? [])].sort((left, right) => left.id - right.id)) {
    if (boss.hp <= 0) {
      continue
    }
    const definition = getBossDefinition(boss.bossDefinitionId)
    const enrage = getBossEnrage(state, boss)
    boss.speed = definition.speed *
      enrage.movementSpeedMultiplier *
      getPostSpawnSpeedMultiplier(state.time, boss.spawnTime)
    boss.contactDamage = definition.contactDamage * enrage.damageMultiplier
    moveBossTowardPlayer(state, boss, fixedStepSeconds)
    for (const skill of boss.skills) {
      skill.cooldownRemaining = Math.max(0, skill.cooldownRemaining - fixedStepSeconds)
    }
    castNextSkill(state, boss, allocator)
  }
  for (const telegraph of state.telegraphs ?? []) {
    telegraph.remainingDuration -= fixedStepSeconds
  }
}

export function resolveBossTelegraphs(state: GameState): DamageEvent[] {
  const events: DamageEvent[] = []
  const remaining: TelegraphState[] = []
  for (const telegraph of [...(state.telegraphs ?? [])].sort((left, right) => left.id - right.id)) {
    if (telegraph.sourceKind === 'enemy') {
      remaining.push(telegraph)
      continue
    }
    if (telegraph.remainingDuration > 0) {
      remaining.push(telegraph)
      continue
    }
    if (!isBossSkillId(telegraph.skillId)) {
      continue
    }
    const sourceBoss = state.bosses?.find(
      (candidate) => candidate.id === telegraph.sourceId,
    )
    if (!sourceBoss || sourceBoss.hp <= 0) {
      continue
    }
    if (isPointInTelegraph(telegraph, state.player.x, state.player.y, state.player.radius)) {
      events.push({
        sourceId: telegraph.sourceId,
        targetId: state.player.id,
        damage: telegraph.damage,
        criticalStrike: telegraph.criticalStrike,
        ...(telegraph.poisonApplication
          ? { poisonApplication: telegraph.poisonApplication }
          : {}),
        sourceLabel: `${getBossDefinition(sourceBoss.bossDefinitionId).name}: ${getBossSkillDefinition(telegraph.skillId).name}`,
      })
    }
    if (telegraph.dashesOnResolve) {
      const endpoint = telegraph.points[telegraph.points.length - 1]
      if (endpoint) {
        sourceBoss.x = endpoint.x
        sourceBoss.y = endpoint.y
      }
    }
  }
  state.telegraphs = remaining
  return events
}

export function cancelBossTelegraphs(
  state: GameState,
  bossIds: ReadonlySet<number>,
): void {
  if (bossIds.size === 0) {
    return
  }

  state.telegraphs = (state.telegraphs ?? []).filter(
    (telegraph) => !bossIds.has(telegraph.sourceId),
  )
}

export function createBossState(
  state: GameState,
  id: number,
  definitionId: BossDefinitionId,
  x: number,
  y: number,
): BossState {
  const definition = getBossDefinition(definitionId)
  return {
    id,
    definitionId: definitionId,
    bossDefinitionId: definitionId,
    spawnTime: state.time,
    x,
    y,
    radius: definition.radius,
    hp: definition.maxHp,
    maxHp: definition.maxHp,
    speed: definition.speed,
    contactDamage: definition.contactDamage,
    xpReward: definition.xpReward,
    targetId: state.player.id,
    skills: definition.skills.map((skillId) => ({
      skillId,
      cooldownRemaining: 0,
    })),
    nextSkillIndex: 0,
  }
}
