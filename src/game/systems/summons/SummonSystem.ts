import type { EntityIdAllocator } from '../../ids'
import type { DamageEvent, GameState } from '../../state/GameState'
import { createPlayerDamageEventFromStats } from '../../combat/DamageSources'
import { getDerivedPlayerStats } from '../../stats/DerivedStats'

const SKELETON_ATTACK_RANGE = 140
const SKELETON_DAMAGE = 6
const SKELETON_ATTACK_COOLDOWN = 1

export function spawnStarterSkeleton(
  state: GameState,
  allocator: EntityIdAllocator,
): void {
  state.summons.push({
    id: allocator.createEntityId(),
    ownerId: state.player.id,
    x: state.player.x - 28,
    y: state.player.y + 20,
    attackCooldownRemaining: 0,
  })
}

export function updateSummons(
  state: GameState,
  fixedStepSeconds: number,
): DamageEvent[] {
  const events: DamageEvent[] = []
  const playerStats = getDerivedPlayerStats(state.player)
  const targets = state.enemies
    .filter((enemy) => enemy.hp > 0)
    .sort((left, right) => left.id - right.id)
  for (const summon of state.summons) {
    summon.x = state.player.x - 28
    summon.y = state.player.y + 20
    summon.attackCooldownRemaining = Math.max(
      0,
      summon.attackCooldownRemaining - fixedStepSeconds,
    )
    if (summon.attackCooldownRemaining > 0) {
      continue
    }
    const target = targets
      .map((enemy) => ({
        enemy,
        distanceSquared: (enemy.x - summon.x) ** 2 + (enemy.y - summon.y) ** 2,
      }))
      .filter((candidate) => candidate.distanceSquared <= SKELETON_ATTACK_RANGE ** 2)
      .sort((left, right) =>
        left.distanceSquared - right.distanceSquared || left.enemy.id - right.enemy.id,
      )[0]?.enemy
    if (!target) {
      continue
    }
    summon.attackCooldownRemaining = SKELETON_ATTACK_COOLDOWN
    events.push(createPlayerDamageEventFromStats(
      playerStats,
      summon.id,
      target.id,
      undefined,
      { physical: SKELETON_DAMAGE },
    ))
  }
  return events
}
