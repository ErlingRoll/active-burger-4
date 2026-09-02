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
      16,
      34,
      54,
      76,
      101,
    ])
    expect(xpRequiredForLevel(1)).toBe(0)
    expect(xpRequiredForLevel(2)).toBe(16)
    expect(xpRequiredForNextLevel(2)).toBe(34)
    expect(xpRequiredForLevel(10)).toBe(236)
    expect(xpRequiredForLevel(30)).toBe(3_434)
    expect(xpRequiredForNextLevel(30)).toBe(3_862)
  })

  it('continues the same growth after a short authored threshold table', () => {
    const shortBalance: XpBalance = {
      ...XP_BALANCE,
      levelThresholds: [0, 16, 34],
    }

    expect(xpRequiredForLevel(4, shortBalance)).toBe(54)
    expect(xpRequiredForNextLevel(3, shortBalance)).toBe(54)
  })

  it('finds the highest reached level without dropping overflow XP', () => {
    expect(levelForXp(0)).toBe(1)
    expect(levelForXp(16)).toBe(2)
    expect(levelForXp(33)).toBe(2)
    expect(levelForXp(54)).toBe(4)
    expect(levelForXp(10_000)).toBeGreaterThan(10)
  })
})
