import { describe, expect, it } from 'vitest'
import { findNearestEnemy } from './Targeting'
import type { EnemyState } from '../state/GameState'

function enemy(id: number, x: number, hp = 20): EnemyState {
  return {
    id,
    definitionId: 'slime',
    x,
    y: 0,
    radius: 18,
    hp,
    maxHp: 20,
    speed: 60,
    contactDamage: 5,
    xpReward: 5,
    targetId: 1,
  }
}

describe('findNearestEnemy', () => {
  it('selects the nearest living enemy within range', () => {
    const result = findNearestEnemy(
      { originX: 0, originY: 0, maxRange: 50 },
      { enemies: [enemy(3, 30), enemy(2, 10), enemy(4, 5, 0)] },
    )

    expect(result?.id).toBe(2)
  })

  it('uses EntityId as a deterministic tie-breaker instead of array order', () => {
    const result = findNearestEnemy(
      { originX: 0, originY: 0, maxRange: 50 },
      { enemies: [enemy(9, 20), enemy(4, -20)] },
    )

    expect(result?.id).toBe(4)
  })
})
