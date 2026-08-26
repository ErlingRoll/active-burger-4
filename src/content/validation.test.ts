import { describe, expect, it } from 'vitest'
import {
  assertValidContent,
  CURRENT_CONTENT,
  validateContent,
  type ContentCatalog,
} from './validation'

function catalogWith(
  overrides: Partial<ContentCatalog>,
): ContentCatalog {
  return { ...CURRENT_CONTENT, ...overrides }
}

describe('content validation', () => {
  it('accepts all current content definitions and balance configuration', () => {
    expect(validateContent(CURRENT_CONTENT)).toEqual([])
    expect(() => assertValidContent()).not.toThrow()
  })

  it('reports empty and duplicate IDs with their collection', () => {
    const errors = validateContent(
      catalogWith({
        enemies: [
          { ...CURRENT_CONTENT.enemies[0], id: '' },
          { ...CURRENT_CONTENT.enemies[0], id: 'slime' },
          { ...CURRENT_CONTENT.enemies[0], id: 'slime' },
        ],
      }),
    )

    expect(errors).toEqual(
      expect.arrayContaining([
        'enemies[0].id must be a non-empty string.',
        'enemies contains duplicate id "slime".',
      ]),
    )
  })

  it('reports invalid numeric balance values and XP thresholds', () => {
    const errors = validateContent(
      catalogWith({
        enemies: [{ ...CURRENT_CONTENT.enemies[0], maxHp: Number.NaN }],
        projectiles: [{ ...CURRENT_CONTENT.projectiles[0], lifetime: 0 }],
        xpBalance: {
          ...CURRENT_CONTENT.xpBalance,
          levelThresholds: [1, 1, -5],
          pickupRadius: -1,
        },
        spawnBalance: {
          ...CURRENT_CONTENT.spawnBalance,
          baseThreatPerSecond: Number.POSITIVE_INFINITY,
          maxActiveEnemies: 1.5,
        },
      }),
    )

    expect(errors).toEqual(
      expect.arrayContaining([
        'enemies[0].maxHp must be a finite number; received NaN.',
        'projectiles[0].lifetime must be positive; received 0.',
        'xpBalance.levelThresholds[1] must be greater than the previous threshold (1).',
        'xpBalance.levelThresholds[2] must be non-negative; received -5.',
        'xpBalance.pickupRadius must be positive; received -1.',
        'spawnBalance.baseThreatPerSecond must be a finite number; received Infinity.',
        'spawnBalance.maxActiveEnemies must be integer-positive; received 1.5.',
      ]),
    )
  })

  it('reports broken spawn references and spawn-ring bounds', () => {
    const errors = validateContent(
      catalogWith({
        spawnBalance: {
          ...CURRENT_CONTENT.spawnBalance,
          spawnRingInnerRadius: 20,
          spawnRingOuterRadius: 20,
          spawnEntries: [
            {
              ...CURRENT_CONTENT.spawnBalance.spawnEntries[0],
              definitionId: 'missing-enemy',
            },
          ],
        },
      }),
    )

    expect(errors).toEqual(
      expect.arrayContaining([
        'spawnBalance.spawnEntries[0].definitionId references unknown enemy "missing-enemy".',
        'spawnBalance.spawnRingOuterRadius must be greater than spawnRingInnerRadius.',
      ]),
    )
  })

  it('reports invalid spawn entries and an impossible eligible choice pool', () => {
    const errors = validateContent(
      catalogWith({
        upgradeChoicesPerLevel: 2,
        upgrades: [
          {
            ...CURRENT_CONTENT.upgrades[0],
            isEligible: () => false,
          },
        ],
        spawnBalance: {
          ...CURRENT_CONTENT.spawnBalance,
          spawnEntries: [],
          spawnRingInnerRadius: -1,
          spawnRingOuterRadius: 0,
          maxActiveEnemies: 0,
        },
      }),
    )

    expect(errors).toEqual(
      expect.arrayContaining([
        'spawnBalance.spawnEntries must contain at least one entry.',
        'spawnBalance.spawnRingInnerRadius must be non-negative; received -1.',
        'spawnBalance.spawnRingOuterRadius must be positive; received 0.',
        'spawnBalance.maxActiveEnemies must be integer-positive; received 0.',
        'upgradeChoicesPerLevel (2) cannot exceed the 1 unique upgrade definitions.',
        'upgradeChoicesPerLevel (2) exceeds the 0 upgrades eligible at player level 1.',
      ]),
    )
  })

  it('validates skill tuning and skill upgrade references', () => {
    const errors = validateContent(
      catalogWith({
        skills: [
          {
            ...CURRENT_CONTENT.skills[0],
            kind: 'area',
            radius: 0,
          },
        ],
        upgrades: [
          {
            ...CURRENT_CONTENT.upgrades[3],
            skillId: 'missing-skill',
          },
        ],
      }),
    )

    expect(errors).toEqual(
      expect.arrayContaining([
        'skills[0].radius must be positive; received 0.',
        'upgrades[0] must define a known skillId and skillAction.',
      ]),
    )
  })
})
