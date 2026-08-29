import { describe, expect, it } from 'vitest'
import { formatExperience } from './formatNumbers'

describe('formatExperience', () => {
  it('removes floating-point noise and decimals', () => {
    expect(formatExperience(45.099999999999994)).toBe('45')
    expect(formatExperience(45.9)).toBe('45')
    expect(formatExperience(67)).toBe('67')
  })
})
