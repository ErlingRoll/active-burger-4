import { describe, expect, it } from 'vitest'
import { getLevelMaxHpBonus } from './LevelScaling'

describe('level maximum HP scaling', () => {
  it('starts with no bonus and accelerates slowly to the authored milestones', () => {
    expect(getLevelMaxHpBonus(1)).toBe(0)
    expect(getLevelMaxHpBonus(100)).toBe(1000)
    expect(getLevelMaxHpBonus(200)).toBe(2112)
  })
})
