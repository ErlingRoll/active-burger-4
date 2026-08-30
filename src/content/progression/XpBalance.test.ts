import { describe, expect, it } from 'vitest'
import {
  XP_BALANCE,
  type XpBalance,
  levelForXp,
  xpRequiredForLevel,
  xpRequiredForNextLevel,
} from './XpBalance'

describe('XP balance', () => {
  it('uses a globally flatter, gently accelerating XP curve', () => {
    expect(XP_BALANCE.levelThresholds.slice(0, 6)).toEqual([
      0,
      12,
      26,
      42,
      61,
      83,
    ])
    expect(xpRequiredForLevel(1)).toBe(0)
    expect(xpRequiredForLevel(2)).toBe(12)
    expect(xpRequiredForNextLevel(2)).toBe(26)
    expect(xpRequiredForLevel(10)).toBe(210)
    expect(xpRequiredForLevel(30)).toBe(5_477)
    expect(xpRequiredForNextLevel(30)).toBe(6_365)
  })

  it('continues the same growth after a short authored threshold table', () => {
    const shortBalance: XpBalance = {
      ...XP_BALANCE,
      levelThresholds: [0, 12, 26],
    }

    expect(xpRequiredForLevel(4, shortBalance)).toBe(42)
    expect(xpRequiredForNextLevel(3, shortBalance)).toBe(42)
  })

  it('finds the highest reached level without dropping overflow XP', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(12)).toBe(2)
    expect(levelForXp(25)).toBe(2)
    expect(levelForXp(42)).toBe(4)
    expect(levelForXp(10_000)).toBeGreaterThan(10)
  })
})
