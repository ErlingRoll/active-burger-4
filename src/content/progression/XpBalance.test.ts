import { describe, expect, it } from 'vitest'
import {
  XP_BALANCE,
  levelForXp,
  xpRequiredForLevel,
  xpRequiredForNextLevel,
} from './XpBalance'

describe('XP balance', () => {
  it('uses cumulative, data-driven early level thresholds', () => {
    expect(XP_BALANCE.levelThresholds.slice(0, 4)).toEqual([0, 10, 25, 45])
    expect(xpRequiredForLevel(1)).toBe(0)
    expect(xpRequiredForLevel(2)).toBe(10)
    expect(xpRequiredForNextLevel(2)).toBe(25)
  })

  it('finds the highest reached level without dropping overflow XP', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(10)).toBe(2)
    expect(levelForXp(26)).toBe(3)
    expect(levelForXp(45)).toBe(4)
    expect(levelForXp(10_000)).toBeGreaterThan(10)
  })
})
