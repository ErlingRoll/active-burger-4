import { describe, expect, it } from 'vitest'
import { calculateEssenceReward } from './EssenceRewards'

describe('calculateEssenceReward', () => {
  it('keeps level one at one essence and adds ten essence per later level', () => {
    expect(calculateEssenceReward(1, 0, 1)).toMatchObject({
      levelReward: 1,
      baseEssence: 1,
      projectedReward: 1,
    })
    expect(calculateEssenceReward(2, 0, 1).levelReward).toBe(11)
    expect(calculateEssenceReward(5, 0, 1).levelReward).toBe(41)
  })

  it('uses the increased level reward in the complete calculation', () => {
    expect(calculateEssenceReward(4, 25, 1.1).projectedReward).toBe(36)
  })
})
