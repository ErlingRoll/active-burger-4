import {
  FLAME_LINE_SKILL_ID,
  FIRE_NOVA_SKILL_ID,
  getBossDefinition,
  getBossSkillDefinition,
  INFERNO_WARDEN_BOSS_ID,
  INFERNO_WARDEN_ENRAGE_DEFINITION,
  METEOR_ZONE_SKILL_ID,
  type BossDefinitionId,
  type BossEnrageDefinition,
} from '../../../content/bosses/Bosses'
import { createDamageValues } from '../../../content/stats/Damage'
import type { EntityIdAllocator } from '../../ids'
import { createBossDamageProfile } from '../../combat/DamageSources'
import type {
  BossState,
  DamageEvent,
  GameState,
  TelegraphState,
} from '../../state/GameState'

export const INFERNO_WARDEN_ENRAGE_RATE_PER_SECOND = 0.01

export interface BossEnrageMultipliers {
  movementSpeedMultiplier: number
  damageMultiplier: number
  cooldownMultiplier: number
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
    movementSpeedMultiplier: multiplier,
    damageMultiplier: Math.pow(
      1 + enrage.damagePerSecond,
      Math.max(0, elapsedSeconds),
    ),
    cooldownMultiplier,
  }
}

export const getBossEnrageMultipliers = getInfernoWardenEnrageMultipliers

function getBossEnrage(
  state: GameState,
  boss: BossState,
): BossEnrageMultipliers {
  if (boss.bossDefinitionId !== INFERNO_WARDEN_BOSS_ID) {
    return {
      movementSpeedMultiplier: 1,
      damageMultiplier: 1,
      cooldownMultiplier: 1,
    }
  }
  const definition = getBossDefinition(boss.bossDefinitionId)
  return getInfernoWardenEnrageMultipliers(
    state.time - (boss.spawnTime ?? state.time),
    definition.enrage,
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

function lineDistanceSquared(
  px: number,
  py: number,
  telegraph: TelegraphState,
): number {
  const start = telegraph.points[0]
  const end = telegraph.points[1]
  if (!start || !end) {
    return Number.POSITIVE_INFINITY
  }
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  const projection = lengthSquared === 0
    ? 0
    : Math.max(0, Math.min(1, ((px - start.x) * dx + (py - start.y) * dy) / lengthSquared))
  const nearestX = start.x + projection * dx
  const nearestY = start.y + projection * dy
  const offsetX = px - nearestX
  const offsetY = py - nearestY
  return offsetX * offsetX + offsetY * offsetY
}

function isLineTelegraph(telegraph: TelegraphState): boolean {
  return telegraph.kind === 'charge' || telegraph.kind === 'flame-line'
}

function telegraphKind(
  skillId: TelegraphState['skillId'],
): TelegraphState['kind'] {
  return skillId
}

function telegraphDamageType(
  skillId: TelegraphState['skillId'],
): 'physical' | 'fire' {
  return skillId === FIRE_NOVA_SKILL_ID ||
      skillId === FLAME_LINE_SKILL_ID ||
      skillId === METEOR_ZONE_SKILL_ID
    ? 'fire'
    : 'physical'
}

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
  const points = skillState.skillId === 'ground-slam' ||
    skillState.skillId === METEOR_ZONE_SKILL_ID
    ? [{ x: state.player.x, y: state.player.y }]
    : skillState.skillId === FIRE_NOVA_SKILL_ID
      ? [{ x: boss.x, y: boss.y }]
    : (() => {
        const dx = state.player.x - boss.x
        const dy = state.player.y - boss.y
        const length = Math.hypot(dx, dy)
        const range = definition.range ?? length
        const ratio = length === 0 ? 0 : Math.min(1, range / length)
        return [
          { x: boss.x, y: boss.y },
          { x: boss.x + dx * ratio, y: boss.y + dy * ratio },
        ]
      })()
  const origin = points[0]
  if (!origin) {
    return
  }
  const enrage = getBossEnrage(state, boss)
  const telegraph: TelegraphState = {
    id: allocator.createEntityId(),
    sourceId: boss.id,
    skillId: skillState.skillId,
    kind: telegraphKind(skillState.skillId),
    x: origin.x,
    y: origin.y,
    radius: definition.radius,
    remainingDuration: definition.telegraphDuration,
    duration: definition.telegraphDuration,
    points,
    ...(() => {
      const damage = createBossDamageProfile(
        boss,
        createDamageValues({
          [telegraphDamageType(skillState.skillId)]: definition.damage * enrage.damageMultiplier,
        }),
      )
      return {
        damage: damage.damage,
        criticalStrike: damage.criticalStrike,
      }
    })(),
  }
  state.telegraphs ??= []
  state.telegraphs.push(telegraph)
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
    boss.speed = definition.speed * enrage.movementSpeedMultiplier
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
    if (telegraph.remainingDuration > 0) {
      remaining.push(telegraph)
      continue
    }
    const sourceBoss = state.bosses?.find(
      (candidate) => candidate.id === telegraph.sourceId,
    )
    if (!sourceBoss || sourceBoss.hp <= 0) {
      continue
    }
    const playerDistanceSquared = isLineTelegraph(telegraph)
      ? lineDistanceSquared(state.player.x, state.player.y, telegraph)
      : (state.player.x - telegraph.x) ** 2 + (state.player.y - telegraph.y) ** 2
    const range = telegraph.radius + state.player.radius
    if (playerDistanceSquared <= range * range) {
      events.push({
        sourceId: telegraph.sourceId,
        targetId: state.player.id,
        damage: telegraph.damage,
        criticalStrike: telegraph.criticalStrike,
      })
    }
    if (telegraph.kind === 'charge') {
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
    definitionId: definition.id,
    bossDefinitionId: definition.id,
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
