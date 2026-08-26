import { describe, expect, it } from 'vitest'
import { Random } from './Random'

describe('Random', () => {
  it('generates an identical sequence for the same seed', () => {
    const a = new Random(123)
    const b = new Random(123)

    const sequenceA = [a.next(), a.next(), a.next(), a.next(), a.next()]
    const sequenceB = [b.next(), b.next(), b.next(), b.next(), b.next()]

    expect(sequenceA).toEqual(sequenceB)
  })

  it('generates different sequences for different seeds', () => {
    const a = new Random(1)
    const b = new Random(2)

    expect(a.next()).not.toBe(b.next())
  })

  it('always returns a float in the [0, 1) range', () => {
    const random = new Random(42)

    for (let i = 0; i < 1000; i += 1) {
      const value = random.next()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('returns integers within the inclusive range', () => {
    const random = new Random(7)

    for (let i = 0; i < 500; i += 1) {
      const value = random.int(3, 5)
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(3)
      expect(value).toBeLessThanOrEqual(5)
    }
  })

  it('supports a single-value inclusive range', () => {
    const random = new Random(9)
    expect(random.int(4, 4)).toBe(4)
  })

  it('throws when the int range is inverted', () => {
    const random = new Random(1)
    expect(() => random.int(5, 1)).toThrow()
  })

  it('chance(0) is always false and chance(1) is always true', () => {
    const random = new Random(11)

    for (let i = 0; i < 100; i += 1) {
      expect(random.chance(0)).toBe(false)
    }

    for (let i = 0; i < 100; i += 1) {
      expect(random.chance(1)).toBe(true)
    }
  })

  it('picks only values that belong to the source array', () => {
    const random = new Random(2024)
    const items = ['a', 'b', 'c'] as const

    for (let i = 0; i < 100; i += 1) {
      expect(items).toContain(random.pick(items))
    }
  })

  it('throws when picking from an empty array', () => {
    const random = new Random(1)
    expect(() => random.pick([])).toThrow()
  })

  it('reproduces the identical pick/int/chance sequence for a repeated seed', () => {
    const run = (seed: number) => {
      const random = new Random(seed)
      return {
        ints: [random.int(0, 100), random.int(0, 100), random.int(0, 100)],
        chances: [random.chance(0.5), random.chance(0.5)],
        pick: random.pick(['fireball', 'chain_lightning', 'whirlwind']),
      }
    }

    expect(run(555)).toEqual(run(555))
  })
})
