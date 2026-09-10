import { describe, expect, it } from 'vitest'
import {
  findNearestEnemy,
  getTargetPriorityScore,
  selectPrimaryTarget,
} from './Targeting'
import { TARGET_PRIORITY_ORDER } from '../../content/behaviors/TargetPriorities'
import type { BossState, EnemyState } from '../state/GameState'

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

  it('includes living bosses even when no ordinary enemies are present', () => {
    const result = findNearestEnemy(
      { originX: 0, originY: 0, maxRange: 50 },
      {
        enemies: [],
        bosses: [{
          ...enemy(7, 20),
          definitionId: 'stone-golem',
          bossDefinitionId: 'stone-golem',
          skills: [],
          nextSkillIndex: 0,
        }],
      },
    )

    expect(result?.id).toBe(7)
  })

  it('can exclude the most recent target from deterministic retargeting', () => {
    const result = findNearestEnemy(
      { originX: 0, originY: 0, maxRange: 50, excludeTargetId: 4 },
      { enemies: [enemy(9, 20), enemy(4, -20)] },
    )

    expect(result?.id).toBe(9)
  })
})

/** Every candidate is reachable; the priority decides which one is chosen. */
const IN_REACH = { originX: 0, originY: 0, getEngagementRange: () => 1_000 }

function elite(id: number, x: number, modifierCount: number): EnemyState {
  return {
    ...enemy(id, x),
    eliteModifiers: ['hasted', 'giant', 'armored'].slice(0, modifierCount) as never,
  }
}

function archer(id: number, x: number): EnemyState {
  return { ...enemy(id, x), definitionId: 'archer' }
}

function boss(id: number, x: number): BossState {
  return {
    ...enemy(id, x),
    definitionId: 'stone-golem',
    bossDefinitionId: 'stone-golem',
    skills: [],
    nextSkillIndex: 0,
  }
}

describe('selectPrimaryTarget', () => {
  it('reproduces nearest-first selection under the default priority', () => {
    expect(selectPrimaryTarget(
      { enemies: [enemy(3, 30), enemy(2, 10), enemy(4, 5, 0)] },
      IN_REACH,
    )?.id).toBe(2)
    // The same EntityId tie-break the nearest-enemy query has always used.
    expect(selectPrimaryTarget({ enemies: [enemy(9, 20), enemy(4, -20)] }, IN_REACH)?.id)
      .toBe(4)
  })

  it('ignores anything out of the weapon’s reach', () => {
    const result = selectPrimaryTarget(
      { enemies: [enemy(2, 10), enemy(3, 400)] },
      { ...IN_REACH, getEngagementRange: () => 100 },
    )

    expect(result?.id).toBe(2)
    expect(selectPrimaryTarget(
      { enemies: [enemy(3, 400)] },
      { ...IN_REACH, getEngagementRange: () => 100 },
    )).toBeUndefined()
  })

  it('scores every candidate at exactly zero under the default priority', () => {
    /*
     * A candidate with no maximum health is the case that would expose a
     * multiply-by-zero: `0 * NaN` is `NaN`, and one `NaN` in the accumulator
     * would make the comparison stop working for everyone.
     */
    const broken = { ...enemy(5, 10), maxHp: 0 }

    expect(getTargetPriorityScore(broken, 10, IN_REACH)).toBe(0)
    expect(selectPrimaryTarget({ enemies: [broken, enemy(6, 40)] }, IN_REACH)?.id).toBe(5)
  })

  it('finishes the most wounded enemy in reach', () => {
    const result = selectPrimaryTarget(
      { enemies: [enemy(2, 10), enemy(3, 40, 2)] },
      { ...IN_REACH, priorityId: 'wounded' },
    )

    expect(result?.id).toBe(3)
  })

  it('takes the boss first, then elites by how many modifiers they carry', () => {
    const state = { enemies: [enemy(2, 10), elite(3, 40, 1), elite(4, 60, 3)] }

    expect(selectPrimaryTarget(state, { ...IN_REACH, priorityId: 'elites' })?.id).toBe(4)
    expect(selectPrimaryTarget(
      { ...state, bosses: [boss(5, 300)] },
      { ...IN_REACH, priorityId: 'elites' },
    )?.id).toBe(5)
  })

  it('takes the enemy that fights from a distance', () => {
    const result = selectPrimaryTarget(
      { enemies: [enemy(2, 10), archer(3, 60)] },
      { ...IN_REACH, priorityId: 'ranged' },
    )

    expect(result?.id).toBe(3)
  })

  it('still prefers the closer of two equals, so a priority never crosses the arena', () => {
    const far = { ...enemy(3, 900), hp: 2 }
    const near = { ...enemy(2, 10), hp: 4 }

    expect(selectPrimaryTarget(
      { enemies: [near, far] },
      { ...IN_REACH, priorityId: 'wounded' },
    )?.id).toBe(2)
  })

  it.each(TARGET_PRIORITY_ORDER)('chooses deterministically under %s', (priorityId) => {
    const candidates = [enemy(2, 10), enemy(3, 40, 2), elite(4, 60, 2), archer(5, 80)]
    const options = { ...IN_REACH, priorityId }

    const chosen = selectPrimaryTarget({ enemies: candidates }, options)?.id
    const reversed = selectPrimaryTarget({ enemies: [...candidates].reverse() }, options)?.id
    const split = selectPrimaryTarget(
      { enemies: candidates, bosses: [boss(6, 500)] },
      options,
    )?.id

    expect(reversed).toBe(chosen)
    // A boss beyond everyone else changes the answer only where it should.
    expect(split).toBe(priorityId === 'elites' ? 6 : chosen)
  })
})
