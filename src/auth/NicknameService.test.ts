import { describe, expect, it } from 'vitest'
import { validateNickname } from './NicknameService'

describe('nickname validation', () => {
  it('accepts a bounded, readable nickname', () => {
    expect(validateNickname('  Burger-Knight_4  ')).toBeNull()
  })

  it('rejects unsupported characters and invalid lengths', () => {
    expect(validateNickname('ab')).not.toBeNull()
    expect(validateNickname('burger!')).not.toBeNull()
    expect(validateNickname('a'.repeat(25))).not.toBeNull()
  })
})
