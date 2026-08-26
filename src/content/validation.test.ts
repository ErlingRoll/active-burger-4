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

  it('validates enemy behavior, split, render, and spawn timing configuration', () => {
    const splitter = CURRENT_CONTENT.enemies.find((enemy) => enemy.id === 'splitter')
    if (!splitter || splitter.behavior.kind !== 'split') {
      throw new Error('Expected splitter content')
    }
    const errors = validateContent(
      catalogWith({
        enemies: [
          {
            ...splitter,
            behavior: {
              kind: 'split',
              split: {
                ...splitter.behavior.split,
                childDefinitionId: 'missing-child',
                childCount: 0,
                spreadRadius: -1,
                childrenAwardXp: 'yes' as never,
              },
            },
            render: {
              ...splitter.render,
              shape: 'unknown' as never,
              scale: 0,
            },
          },
        ],
        spawnBalance: {
          ...CURRENT_CONTENT.spawnBalance,
          spawnEntries: [
            {
              ...CURRENT_CONTENT.spawnBalance.spawnEntries[0],
              startTimeSeconds: -1,
            },
          ],
        },
      }),
    )

    expect(errors).toEqual(
      expect.arrayContaining([
        'enemies[0].behavior.split.childDefinitionId must reference an enemy.',
        'enemies[0].behavior.split.childCount must be integer-positive; received 0.',
        'enemies[0].behavior.split.spreadRadius must be non-negative; received -1.',
        'enemies[0].behavior.split.childrenAwardXp must be a boolean.',
        'enemies[0].render.shape is not supported; received "unknown".',
        'enemies[0].render.scale must be positive; received 0.',
        'spawnBalance.spawnEntries[0].startTimeSeconds must be non-negative; received -1.',
      ]),
    )
  })

  it('validates shared rarity, equipment slots, and stat modifiers', () => {
    const errors = validateContent(
      catalogWith({
        items: [
          {
            id: 'test-item',
            name: 'Test Item',
            rarity: 'mythic' as never,
            slot: 'backpack' as never,
            modifiers: [
              {
                stat: 'unknown' as never,
                operation: 'divide' as never,
                value: Number.NaN,
                sourceId: '',
              },
            ],
          },
        ],
      }),
    )

    expect(errors).toEqual(
      expect.arrayContaining([
        'items[0].rarity is not supported; received "mythic".',
        'items[0].slot is not supported; received "backpack".',
        'items[0].modifiers[0].stat is not supported; received "unknown".',
        'items[0].modifiers[0].operation is not supported; received "divide".',
        'items[0].modifiers[0].value must be a finite number; received NaN.',
        'items[0].modifiers[0].sourceId must be a non-empty string.',
      ]),
    )
  })

  it('validates stable item IDs, non-empty modifiers, and item-owned sources', () => {
    const errors = validateContent(
      catalogWith({
        items: [
          {
            ...CURRENT_CONTENT.items[0],
            id: 'Iron Cleaver' as never,
            modifiers: [],
          },
          {
            ...CURRENT_CONTENT.items[1],
            id: CURRENT_CONTENT.items[0].id,
            modifiers: [
              {
                ...CURRENT_CONTENT.items[1].modifiers[0],
                sourceId: 'upgrade:wrong-source',
              },
            ],
          },
          {
            ...CURRENT_CONTENT.items[2],
            id: CURRENT_CONTENT.items[0].id,
          },
        ],
      }),
    )

    expect(errors).toEqual(
      expect.arrayContaining([
        'items[0].id must use lowercase ASCII letters, numbers, and hyphens; received "Iron Cleaver".',
        'items[0].modifiers must contain at least one modifier.',
        'items[1].modifiers[0].sourceId must be "item:iron-cleaver"; received "upgrade:wrong-source".',
        'items contains duplicate id "iron-cleaver".',
      ]),
    )
  })

  it('rejects malformed item modifier entries without throwing', () => {
    const errors = validateContent(
      catalogWith({
        items: [
          {
            ...CURRENT_CONTENT.items[0],
            modifiers: [null as never],
          },
        ],
      }),
    )

    expect(errors).toContain('items[0].modifiers[0] must define a modifier object.')
  })
})
