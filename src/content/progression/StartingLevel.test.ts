import { describe, expect, it } from 'vitest'
import {
  getStartingLevelForRank,
  STARTING_LEVEL_MAX_RANK,
} from './StartingLevel'

describe('starting-level progression', () => {
  it('maps ranks one through three to starting levels two through four', () => {
    expect(getStartingLevelForRank(0)).toBe(1)
    expect(getStartingLevelForRank(1)).toBe(2)
    expect(getStartingLevelForRank(2)).toBe(3)
    expect(getStartingLevelForRank(STARTING_LEVEL_MAX_RANK)).toBe(4)
  })

  it('clamps invalid and out-of-range ranks', () => {
    expect(getStartingLevelForRank(-1)).toBe(1)
    expect(getStartingLevelForRank(4)).toBe(4)
    expect(getStartingLevelForRank(Number.NaN)).toBe(1)
  })
})
