import {
  BASIC_BOLT_SKILL_ID,
  CHAIN_LIGHTNING_SKILL_ID,
  getSkillDefinition,
  getSkillDamage,
  WHIRLWIND_SKILL_ID,
} from '../../../content/skills/Skills'
import type { EntityIdAllocator } from '../../ids'
import type {
  SkillState,
  DamageEvent,
  GameState,
  SkillEffectPoint,
  SkillEffectState,
} from '../../state/GameState'

function addEffect(
  state: GameState,
  allocator: EntityIdAllocator,
  skillId: string,
  points: readonly SkillEffectPoint[],
  radius: number,
  lifetime: number,
): void {
  const origin = points[0]
  if (!origin) {
    return
  }
  const effect: SkillEffectState = {
    id: allocator.createEntityId(),
    skillId,
    x: origin.x,
    y: origin.y,
    radius,
    remainingLifetime: lifetime,
    lifetime,
    points: points.map((point) => ({ x: point.x, y: point.y })),
  }
  state.effects.push(effect)
}

export function updateSkillCooldowns(
  state: GameState,
  fixedStepSeconds: number,
): void {
  for (const skill of state.player.skills) {
    if (skill.skillId === BASIC_BOLT_SKILL_ID) {
      continue
    }
    skill.cooldownRemaining = Math.max(
      0,
      skill.cooldownRemaining - fixedStepSeconds,
    )
  }
}

export function updateSkillEffects(
  state: GameState,
  fixedStepSeconds: number,
): void {
  for (const effect of state.effects) {
    effect.remainingLifetime -= fixedStepSeconds
  }
  state.effects = state.effects.filter((effect) => effect.remainingLifetime > 0)
}

function collectWhirlwindDamage(
  state: GameState,
  skill: SkillState,
  allocator: EntityIdAllocator,
): DamageEvent[] {
  const definition = getSkillDefinition(WHIRLWIND_SKILL_ID)
  const radius = definition.radius ?? 0
  const damage = getSkillDamage(definition, skill.level)
  const events: DamageEvent[] = []

  const enemies = [...state.enemies].sort((left, right) => left.id - right.id)
  for (const enemy of enemies) {
    if (enemy.hp <= 0) {
      continue
    }
    const distance = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y)
    if (distance > radius + enemy.radius) {
      continue
    }
    events.push({
      sourceId: state.player.id,
      sourceSkillId: skill.skillId,
      targetId: enemy.id,
      amount: damage,
      damageType: 'physical',
    })
  }

  if (events.length > 0) {
    addEffect(
      state,
      allocator,
      skill.skillId,
      [{ x: state.player.x, y: state.player.y }],
      radius,
      definition.effectLifetime,
    )
    skill.cooldownRemaining = definition.cooldown
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
    for (const enemy of state.enemies) {
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
    events.push({
      sourceId: state.player.id,
      sourceSkillId: skill.skillId,
      targetId: target.id,
      amount: damage,
      damageType: 'lightning',
    })
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
    skill.cooldownRemaining = definition.cooldown
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
    }
  }

  return events
}
