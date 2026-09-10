import { describe, expect, it } from 'vitest'
import {
  getTelegraphEscapeVector,
  isPointInTelegraph,
} from './TelegraphGeometry'
import { createDamageValues } from '../../content/stats/Damage'
import type { TelegraphShape, TelegraphState } from '../state/GameState'

function telegraph(
  shape: TelegraphShape,
  overrides: Partial<TelegraphState> = {},
): TelegraphState {
  return {
    id: 2,
    sourceId: 1,
    sourceKind: 'boss',
    skillId: 'ground-slam',
    shape,
    x: 0,
    y: 0,
    radius: 100,
    remainingDuration: 0.5,
    duration: 1,
    points: [{ x: 0, y: 0 }],
    damage: createDamageValues({ physical: 1 }),
    ...overrides,
  }
}

describe('isPointInTelegraph', () => {
  it('covers a disc out to its radius, plus the tested radius', () => {
    const disc = telegraph('disc')

    expect(isPointInTelegraph(disc, 99, 0)).toBe(true)
    expect(isPointInTelegraph(disc, 101, 0)).toBe(false)
    expect(isPointInTelegraph(disc, 110, 0, 14)).toBe(true)
  })

  it('leaves the middle of a ring safe', () => {
    const ring = telegraph('ring', { radius: 300, innerRadius: 140 })

    expect(isPointInTelegraph(ring, 0, 0)).toBe(false)
    expect(isPointInTelegraph(ring, 120, 0)).toBe(false)
    expect(isPointInTelegraph(ring, 200, 0)).toBe(true)
    expect(isPointInTelegraph(ring, 320, 0)).toBe(false)
  })

  it('covers a lane by its half-width along the whole path', () => {
    const line = telegraph('line', {
      radius: 20,
      points: [{ x: 0, y: 0 }, { x: 400, y: 0 }],
    })

    expect(isPointInTelegraph(line, 200, 19)).toBe(true)
    expect(isPointInTelegraph(line, 200, 21)).toBe(false)
    // Past the end of the lane, not beside it.
    expect(isPointInTelegraph(line, 430, 0)).toBe(false)
  })

  it('covers only the sector of a cone, so its flank is safe', () => {
    const cone = telegraph('cone', {
      radius: 200,
      angle: 0,
      arc: Math.PI / 2,
    })

    expect(isPointInTelegraph(cone, 150, 0)).toBe(true)
    // Inside the reach but behind it.
    expect(isPointInTelegraph(cone, -150, 0)).toBe(false)
    // Inside the reach but past the sector edge: 60 degrees off a 45 degree arm.
    expect(isPointInTelegraph(cone, 100, 173)).toBe(false)
    // Within the reach and inside the arm.
    expect(isPointInTelegraph(cone, 141, 100)).toBe(true)
  })
})

describe('getTelegraphEscapeVector', () => {
  it('is undefined for a point already clear of the area', () => {
    expect(getTelegraphEscapeVector(telegraph('disc'), 300, 0)).toBeUndefined()
  })

  it('leaves a disc radially outward', () => {
    const escape = getTelegraphEscapeVector(telegraph('disc'), 30, 0)

    expect(escape?.x).toBeCloseTo(1)
    expect(escape?.y).toBeCloseTo(0)
  })

  it('leaves a lane sideways rather than along it', () => {
    // A lane aimed down +x at a player standing just off it: running "away from
    // the midpoint" would send the player down the lane, which is how the Dodge
    // used to handle a charge aimed at it.
    const line = telegraph('line', {
      radius: 30,
      points: [{ x: 0, y: 0 }, { x: 400, y: 0 }],
    })

    expect(getTelegraphEscapeVector(line, 200, 10)?.y).toBeCloseTo(1)
    expect(getTelegraphEscapeVector(line, 200, -10)?.y).toBeCloseTo(-1)
    // Near the start of the lane the two answers differ: away from the midpoint
    // runs back up the lane, which leaves the player in it.
    const nearStart = getTelegraphEscapeVector(line, 50, 10)
    expect(nearStart?.x).toBeCloseTo(0)
    expect(nearStart?.y).toBeCloseTo(1)
  })

  it('still sidesteps a lane it is standing exactly on', () => {
    const line = telegraph('line', {
      radius: 30,
      points: [{ x: 0, y: 0 }, { x: 400, y: 0 }],
    })
    const escape = getTelegraphEscapeVector(line, 200, 0)

    expect(escape?.x).toBeCloseTo(0)
    expect(Math.abs(escape?.y ?? 0)).toBeCloseTo(1)
  })

  it('leaves a ring inward when the safe middle is nearer', () => {
    const ring = telegraph('ring', { radius: 340, innerRadius: 150 })

    // Closing on the caster is the counterplay; running outward would be 170
    // units instead of 10.
    expect(getTelegraphEscapeVector(ring, 160, 0)?.x).toBeCloseTo(-1)
    expect(getTelegraphEscapeVector(ring, 330, 0)?.x).toBeCloseTo(1)
  })

  it('rounds a cone toward its nearer edge', () => {
    const cone = telegraph('cone', {
      radius: 300,
      angle: 0,
      arc: Math.PI / 2,
    })
    const below = getTelegraphEscapeVector(cone, 100, 20)
    const above = getTelegraphEscapeVector(cone, 100, -20)

    // Tangential, away from the centre line: the short way out of the sector.
    expect(below?.y).toBeGreaterThan(0.9)
    expect(above?.y).toBeLessThan(-0.9)
    expect(Math.abs(below?.x ?? 1)).toBeLessThan(0.25)
  })

  it('leaves a cone by its reach when that is the shorter way out', () => {
    // Near the far edge of a wide sector, rounding the arm is much further than
    // stepping past the reach.
    const wide = telegraph('cone', {
      radius: 260,
      angle: 0,
      arc: (150 * Math.PI) / 180,
    })
    const escape = getTelegraphEscapeVector(wide, 250, 0)

    expect(escape?.x).toBeCloseTo(1)
    expect(escape?.y).toBeCloseTo(0)
  })
})
