import { describe, expect, it } from 'vitest'
import { SpatialHash } from './SpatialHash'

interface TestEntity {
  label: string
}

function entity(label: string): TestEntity {
  return { label }
}

describe('SpatialHash', () => {
  it('returns broad-phase candidates and does not duplicate entries spanning cells', () => {
    const hash = new SpatialHash<TestEntity>(10)
    hash.insert(2, 9, 0, 3, entity('spans-boundary'))
    hash.insert(1, 40, 0, 1, entity('outside'))

    expect(hash.queryRadius(12, 0, 0).map((value) => value.label)).toEqual([
      'spans-boundary',
    ])
  })

  it('handles positive and negative cell boundaries consistently', () => {
    const hash = new SpatialHash<TestEntity>(10)
    hash.insert(1, 10, 10, 0, entity('positive-boundary'))
    hash.insert(2, -10, -10, 0, entity('negative-boundary'))

    expect(hash.queryRadius(10, 10, 0).map((value) => value.label)).toEqual([
      'positive-boundary',
    ])
    expect(hash.queryRadius(-10, -10, 0).map((value) => value.label)).toEqual([
      'negative-boundary',
    ])
  })

  it('returns stable EntityId ordering regardless of insertion order', () => {
    const hash = new SpatialHash<TestEntity>(10)
    hash.insert(9, 0, 0, 0, entity('nine'))
    hash.insert(3, 0, 0, 0, entity('three'))
    hash.insert(7, 0, 0, 0, entity('seven'))

    expect(hash.queryRadius(0, 0, 1).map((value) => value.label)).toEqual([
      'three',
      'seven',
      'nine',
    ])
  })

  it('visits each unsorted candidate once without materializing a result array', () => {
    const hash = new SpatialHash<TestEntity>(10)
    hash.insert(2, 9, 0, 3, entity('spans-boundary'))
    hash.insert(1, 0, 0, 1, entity('nearby'))

    const labels: string[] = []
    hash.forEachRadiusUnsorted(12, 0, 0, (value) => {
      labels.push(value.label)
    })

    expect(labels).toHaveLength(1)
    expect(labels).toContain('spans-boundary')
  })

  it('replaces an existing id and clears all indexed cells', () => {
    const hash = new SpatialHash<TestEntity>(10)
    hash.insert(1, 0, 0, 12, entity('old'))
    hash.insert(1, 50, 50, 0, entity('new'))

    expect(hash.queryRadius(0, 0, 1)).toEqual([])
    expect(hash.queryRadius(50, 50, 1).map((value) => value.label)).toEqual([
      'new',
    ])

    hash.clear()
    expect(hash.cellCount).toBe(0)
    expect(hash.queryRadius(50, 50, 1)).toEqual([])
  })
})
