// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  isSalvageSweepRarity,
  persistSalvageSweepRarity,
  readSalvageSweepRarity,
} from './InventorySweepPreference'

describe('InventorySweepPreference', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('stops at common until the player says otherwise', () => {
    expect(readSalvageSweepRarity()).toBe('common')

    persistSalvageSweepRarity('rare')

    expect(readSalvageSweepRarity()).toBe('rare')
  })

  it('offers common, uncommon and rare, and nothing above', () => {
    expect(isSalvageSweepRarity('uncommon')).toBe(true)
    expect(isSalvageSweepRarity('epic')).toBe(false)
    expect(isSalvageSweepRarity('legendary')).toBe(false)
  })

  it('falls back to common when the stored value is not a ceiling on offer', () => {
    window.localStorage.setItem('active-burger-4:salvage-sweep-rarity', 'legendary')

    expect(readSalvageSweepRarity()).toBe('common')
  })
})
