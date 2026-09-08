import { describe, expect, it } from 'vitest'
import {
  getEnemyStatusEffects,
  getStatusEffectSignature,
  getTelegraphName,
  getTelegraphRenderState,
  hasWorldSpaceEffectGeometry,
  isEnemyAbilityId,
  isLineTelegraphKind,
} from './renderState'
import type { Game } from '../../game/Game'
import type { TelegraphState } from '../../game/state/GameState'

function telegraph(overrides: Partial<TelegraphState> = {}): TelegraphState {
  return {
    id: 1,
    kind: 'enemy-projectile',
    skillId: 'archer-shot',
    x: 0,
    y: 0,
    points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    sourceKind: 'enemy',
    sourceId: 2,
    targetId: 3,
    ...overrides,
  } as TelegraphState
}

describe('hasWorldSpaceEffectGeometry', () => {
  it('is true when the effect has a path, a point of impact, or several', () => {
    expect(hasWorldSpaceEffectGeometry({
      points: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      impactPoint: undefined,
      impactPoints: undefined,
    })).toBe(true)
    expect(hasWorldSpaceEffectGeometry({
      points: [],
      impactPoint: { x: 4, y: 4 },
      impactPoints: undefined,
    })).toBe(true)
    expect(hasWorldSpaceEffectGeometry({
      points: [],
      impactPoint: undefined,
      impactPoints: [{ x: 1, y: 1 }],
    })).toBe(true)
  })

  it('is false for an effect drawn at its own origin only', () => {
    expect(hasWorldSpaceEffectGeometry({
      points: [{ x: 0, y: 0 }],
      impactPoint: undefined,
      impactPoints: [],
    })).toBe(false)
  })
})

describe('getEnemyStatusEffects', () => {
  it('returns nothing when no status is applied', () => {
    expect(getEnemyStatusEffects(0)).toEqual([])
  })

  it('lists every applied status in a stable order', () => {
    expect(getEnemyStatusEffects(1, 2, 3, 4, 5).map((status) => status.id))
      .toEqual(['poison', 'chill', 'freeze', 'shock', 'burning'])
  })

  it('omits a status whose stacks have expired', () => {
    expect(getEnemyStatusEffects(0, 1, 0, 0, 1).map((status) => status.id))
      .toEqual(['chill', 'burning'])
  })
})

describe('getStatusEffectSignature', () => {
  it('changes only when the badge set changes, so unchanged badges are not redrawn', () => {
    const before = getStatusEffectSignature(getEnemyStatusEffects(1, 1))
    expect(getStatusEffectSignature(getEnemyStatusEffects(4, 9))).toBe(before)
    expect(getStatusEffectSignature(getEnemyStatusEffects(1, 1, 1))).not.toBe(before)
  })
})

describe('telegraph naming', () => {
  it('recognises the enemy ability identifiers', () => {
    expect(isEnemyAbilityId('archer-shot')).toBe(true)
    expect(isEnemyAbilityId('brute-shockwave')).toBe(true)
    expect(isEnemyAbilityId('ground-slam')).toBe(false)
  })

  it('names the volatile elite explosion specifically', () => {
    expect(getTelegraphName(telegraph({ skillId: 'elite-volatile' }))).toBe('Volatile Explosion')
  })

  it('falls back to a generic name for an unknown source', () => {
    expect(getTelegraphName(telegraph({ skillId: 'mystery' as TelegraphState['skillId'] })))
      .toBe('Enemy attack')
  })

  it('identifies the telegraph kinds drawn as a line', () => {
    expect(isLineTelegraphKind(telegraph({ kind: 'charge' }))).toBe(true)
    expect(isLineTelegraphKind(telegraph({ kind: 'flame-line' }))).toBe(true)
    expect(isLineTelegraphKind(telegraph({ kind: 'enemy-projectile' }))).toBe(true)
    expect(isLineTelegraphKind(telegraph({ kind: 'fire-nova' }))).toBe(false)
  })
})

describe('getTelegraphRenderState', () => {
  const state = {
    player: { id: 3, x: 100, y: 50 },
    enemies: [{ id: 2, x: 10, y: 20, hp: 5 }],
    summons: [],
  } as unknown as Game['state']

  it('re-anchors a projectile warning to the live source and target', () => {
    const rendered = getTelegraphRenderState(state, telegraph())

    expect(rendered.x).toBe(10)
    expect(rendered.y).toBe(20)
    expect(rendered.points).toEqual([{ x: 10, y: 20 }, { x: 100, y: 50 }])
  })

  it('leaves the stored geometry alone for a non-projectile telegraph', () => {
    const original = telegraph({ kind: 'fire-nova' })

    expect(getTelegraphRenderState(state, original)).toBe(original)
  })

  it('leaves the stored geometry alone once the source is dead', () => {
    const deadSource = {
      ...state,
      enemies: [{ id: 2, x: 10, y: 20, hp: 0 }],
    } as unknown as Game['state']
    const original = telegraph()

    expect(getTelegraphRenderState(deadSource, original)).toBe(original)
  })
})
