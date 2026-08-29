import { describe, expect, it } from 'vitest'
import { formatCompactDamage, formatExperience } from './formatNumbers'

describe('formatExperience', () => {
  it('removes floating-point noise and decimals', () => {
    expect(formatExperience(45.099999999999994)).toBe('45')
    expect(formatExperience(45.9)).toBe('45')
    expect(formatExperience(67)).toBe('67')
  })

  describe('formatCompactDamage', () => {
    it('keeps damage below one thousand as whole numbers', () => {
      expect(formatCompactDamage(999.9)).toBe('999')
    })

    it('uses compact suffixes with at most one decimal place', () => {
      expect(formatCompactDamage(1_000)).toBe('1K')
      expect(formatCompactDamage(1_250)).toBe('1.3K')
      expect(formatCompactDamage(1_000_000)).toBe('1M')
      expect(formatCompactDamage(1_250_000)).toBe('1.3M')
      expect(formatCompactDamage(1_000_000_000)).toBe('1B')
      expect(formatCompactDamage(1_250_000_000)).toBe('1.3B')
    })

    it('handles non-finite and negative values safely', () => {
      expect(formatCompactDamage(-10)).toBe('0')
      expect(formatCompactDamage(Number.NaN)).toBe('0')
    })
  })
})
