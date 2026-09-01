import { describe, expect, it } from 'vitest'
import {
  BEHAVIOR_PROFILE_DEFINITIONS,
  BEHAVIOR_PROFILE_ORDER,
  DEFAULT_BEHAVIOR_PROFILE_ID,
  getBehaviorProfileDefinition,
  isBehaviorProfileId,
} from './BehaviorProfiles'
import {
  CURRENT_CONTENT,
  validateContent,
  type ContentCatalog,
} from '../validation'

describe('behavior profile content', () => {
  it('has stable unique IDs and a balanced default', () => {
    const profiles = BEHAVIOR_PROFILE_ORDER.map((profileId) =>
      BEHAVIOR_PROFILE_DEFINITIONS[profileId],
    )
    expect(DEFAULT_BEHAVIOR_PROFILE_ID).toBe('balanced')
    expect(profiles.map((profile) => profile.id)).toEqual([
      'aggressive',
      'balanced',
      'cautious',
    ])
    expect(new Set(profiles.map((profile) => profile.id)).size).toBe(profiles.length)
    expect(profiles.every((profile) => profile.id === profile.id.toLowerCase())).toBe(true)
    expect(getBehaviorProfileDefinition(DEFAULT_BEHAVIOR_PROFILE_ID).name).toBe('Balanced')
  })

  it('recognizes only authored profile IDs', () => {
    expect(isBehaviorProfileId('cautious')).toBe(true)
    expect(isBehaviorProfileId('collector')).toBe(false)
    expect(isBehaviorProfileId('defensive')).toBe(false)
    expect(isBehaviorProfileId('not-a-profile')).toBe(false)
    expect(isBehaviorProfileId(undefined)).toBe(false)
  })

  it('defines distinct deterministic priorities and safety thresholds', () => {
    const profiles = BEHAVIOR_PROFILE_ORDER.map((profileId) =>
      BEHAVIOR_PROFILE_DEFINITIONS[profileId],
    )
    expect(profiles.map((profile) => profile.intentPriorities['combat-range'])).toEqual([
      800,
      650,
      600,
    ])
    expect(profiles.map((profile) => profile.intentPriorities.healing)).toEqual([
      700,
      750,
      850,
    ])
    expect(profiles.map((profile) => profile.thresholds.kiteThreatScore)).toEqual([
      1_000_000,
      4,
      1.5,
    ])
    expect(profiles.every((profile) => profile.intentPriorities.dodge === 1000)).toBe(true)
  })

  it('validates profile identity and descriptive content', () => {
    const catalog: ContentCatalog = {
      ...CURRENT_CONTENT,
      behaviorProfiles: [
        { ...CURRENT_CONTENT.behaviorProfiles[0], id: 'Not Stable' as never },
        { ...CURRENT_CONTENT.behaviorProfiles[1], name: '' },
      ],
    }
    expect(validateContent(catalog)).toEqual(expect.arrayContaining([
      'behaviorProfiles[0].id must use lowercase ASCII letters, numbers, and hyphens; received "Not Stable".',
      'behaviorProfiles[1].name must be a non-empty string.',
    ]))
  })
})
