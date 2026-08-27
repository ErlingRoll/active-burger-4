import { describe, expect, it } from 'vitest'
import {
  XP_BALANCE,
  type XpBalance,
  levelForXp,
  xpRequiredForLevel,
  xpRequiredForNextLevel,
} from './XpBalance'

describe('XP balance', () => {
  it('uses a gently accelerating XP curve', () => {
    expect(XP_BALANCE.levelThresholds.slice(0, 6)).toEqual([
      0,
      10,
      22,
      37,
      55,
      77,
    ])
    expect(xpRequiredForLevel(1)).toBe(0)
    expect(xpRequiredForLevel(2)).toBe(10)
    expect(xpRequiredForNextLevel(2)).toBe(22)
    expect(xpRequiredForLevel(10)).toBe(226)
  })

  it('continues the same growth after a short authored threshold table', () => {
    const shortBalance: XpBalance = {
      ...XP_BALANCE,
      levelThresholds: [0, 10, 22],
    }

    expect(xpRequiredForLevel(4, shortBalance)).toBe(37)
    expect(xpRequiredForNextLevel(3, shortBalance)).toBe(37)
  })

  it('finds the highest reached level without dropping overflow XP', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(10)).toBe(2)
    expect(levelForXp(26)).toBe(3)
    expect(levelForXp(45)).toBe(4)
    expect(levelForXp(10_000)).toBeGreaterThan(10)
  })
})
