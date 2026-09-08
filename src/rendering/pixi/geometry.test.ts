import { describe, expect, it } from 'vitest'
import { createPolygonPoints, createStarPoints } from './geometry'

function toPairs(flat: readonly number[]): [number, number][] {
  const pairs: [number, number][] = []
  for (let index = 0; index < flat.length; index += 2) {
    pairs.push([flat[index] ?? 0, flat[index + 1] ?? 0])
  }
  return pairs
}

function radius(point: readonly [number, number]): number {
  return Math.hypot(point[0], point[1])
}

describe('createPolygonPoints', () => {
  it('emits one x/y pair per side', () => {
    expect(createPolygonPoints(10, 6)).toHaveLength(12)
    expect(createPolygonPoints(10, 3)).toHaveLength(6)
  })

  it('places every vertex on the circle of the given radius', () => {
    for (const point of toPairs(createPolygonPoints(24, 7))) {
      expect(radius(point)).toBeCloseTo(24)
    }
  })

  it('starts at the given rotation', () => {
    const [first] = toPairs(createPolygonPoints(10, 4, Math.PI / 2))
    expect(first?.[0]).toBeCloseTo(0)
    expect(first?.[1]).toBeCloseTo(10)
  })

  it('spaces vertices evenly around the circle', () => {
    const angles = toPairs(createPolygonPoints(10, 4))
      .map((point) => Math.atan2(point[1], point[0]))
    expect((angles[1] ?? 0) - (angles[0] ?? 0)).toBeCloseTo(Math.PI / 2)
  })
})

describe('createStarPoints', () => {
  it('emits two vertices per point, alternating outer and inner radius', () => {
    const flat = createStarPoints(20, 5, 0.5)
    expect(flat).toHaveLength(20)

    const radii = toPairs(flat).map(radius)
    for (const [index, value] of radii.entries()) {
      expect(value).toBeCloseTo(index % 2 === 0 ? 20 : 10)
    }
  })

  it('makes spikes sharper as the inner ratio shrinks', () => {
    const blunt = toPairs(createStarPoints(20, 5, 0.8)).map(radius)
    const sharp = toPairs(createStarPoints(20, 5, 0.2)).map(radius)

    expect(sharp[1]).toBeLessThan(blunt[1] ?? 0)
  })
})
