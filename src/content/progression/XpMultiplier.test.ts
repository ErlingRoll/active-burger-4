import { describe, expect, it } from 'vitest'
import {
  XP_MULTIPLIER_MAX_LEVEL,
  getXpMultiplierForLevel,
} from './XpMultiplier'

describe('XP multiplier progression', () => {
  it('increases by five percent per level through level ten', () => {
    expect(getXpMultiplierForLevel(0)).toBe(1)
    expect(getXpMultiplierForLevel(1)).toBe(1.05)
    expect(getXpMultiplierForLevel(3)).toBe(1.15)
    expect(getXpMultiplierForLevel(XP_MULTIPLIER_MAX_LEVEL)).toBe(1.5)
  })

  it('clamps invalid and out-of-range levels', () => {
    expect(getXpMultiplierForLevel(-1)).toBe(1)
    expect(getXpMultiplierForLevel(11)).toBe(1.5)
    expect(getXpMultiplierForLevel(Number.NaN)).toBe(1)
  })
})
