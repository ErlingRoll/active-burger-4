import { describe, expect, it } from 'vitest'
import { ALL_CONTRACT_DEFINITIONS } from '../content/contracts/Contracts'
import { getResourceGuide } from './ResourceGuide'

describe('getResourceGuide', () => {
  it('answers what, used for and from, for everything a contract can pay', () => {
    const paid = new Set(ALL_CONTRACT_DEFINITIONS.flatMap((definition) => definition.reward.map((line) => line.definitionId)))
    expect(paid.size).toBeGreaterThan(0)
    for (const definitionId of paid) {
      const guide = getResourceGuide(definitionId)
      expect(guide, definitionId).not.toBeNull()
      expect(guide?.name).not.toBe(definitionId)
      expect(guide?.what.length).toBeGreaterThan(0)
      expect(guide?.usedFor.length).toBeGreaterThan(0)
      expect(guide?.source.length).toBeGreaterThan(0)
    }
  })

  it('counts a box by its draws and names its table', () => {
    expect(getResourceGuide('loot-box-rare')).toMatchObject({
      name: 'Rare Loot Box',
      what: expect.stringContaining('2 draws from the Rare table'),
    })
    expect(getResourceGuide('loot-box-uncommon')?.what).toContain('one draw from the Uncommon table')
    expect(getResourceGuide('loot-box-legendary')?.what).toContain(
      'one artifact, epic or better, and then 3 draws from the Legendary table',
    )
  })

  it('knows nothing about an item that is not a resource', () => {
    expect(getResourceGuide('river-worm')).toBeNull()
    expect(getResourceGuide('loot-box-mythic')).toBeNull()
  })
})
