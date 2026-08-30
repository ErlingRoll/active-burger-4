import { describe, expect, it } from 'vitest'
import {
  assertValidContent,
  CURRENT_CONTENT,
  validateContent,
  type ContentCatalog,
} from './validation'
import { SYNERGY_UPGRADES } from './upgrades/Upgrades'

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

  it('ships a bounded unique synergy graph for all current skills', () => {
    const pairs = new Set<string>()
    const counts = new Map<string, number>()

    for (const synergy of SYNERGY_UPGRADES) {
      const pair = [...synergy.synergySkillIds].sort().join('|')
      expect(pairs.has(pair)).toBe(false)
      pairs.add(pair)
      for (const skillId of synergy.synergySkillIds) {
        counts.set(skillId, (counts.get(skillId) ?? 0) + 1)
      }
    }

    for (const skill of CURRENT_CONTENT.skills) {
      expect(counts.get(skill.id)).toBeGreaterThanOrEqual(2)
      expect(counts.get(skill.id)).toBeLessThanOrEqual(3)
    }
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
        },
      }),
    )

    expect(errors).toEqual(
      expect.arrayContaining([
        'spawnBalance.spawnEntries must contain at least one entry.',
        'spawnBalance.spawnRingInnerRadius must be non-negative; received -1.',
        'spawnBalance.spawnRingOuterRadius must be positive; received 0.',
        'upgradeChoicesPerLevel (2) cannot exceed the 1 unique upgrade definitions.',
        'upgradeChoicesPerLevel (2) exceeds the 0 upgrades eligible at player level 1.',
      ]),
    )
  })

  it('validates skill tuning and skill upgrade references', () => {
    const errors = validateContent(
      catalogWith({
        upgradeChoicesPerLevel: 1,
        skills: [
          {
            ...CURRENT_CONTENT.skills[0],
            kind: 'area',
            radius: 0,
          },
        ],
        upgrades: [
          {
            ...CURRENT_CONTENT.upgrades.find(
              (upgrade) => upgrade.skillAction === 'level',
            )!,
            skillId: 'missing-skill' as never,
          },
        ],
      }),
    )

    expect(errors).toEqual(
      expect.arrayContaining([
        'skills[0].radius must be positive; received 0.',
        'upgrades[0] must define a known skillId and skill action or effect.',
      ]),
    )
  })

  it('validates final-boss enrage tuning', () => {
    const inferno = CURRENT_CONTENT.bosses.find(
      (boss) => boss.id === 'inferno-warden',
    )
    if (!inferno || !inferno.enrage) {
      throw new Error('Expected Inferno Warden content')
    }
    const errors = validateContent(
      catalogWith({
        bosses: [{
          ...inferno,
          enrage: {
            ...inferno.enrage,
            movementSpeedPerSecond: -1,
            cooldownReductionPerSecond: 1,
          },
        }],
      }),
    )

    expect(errors).toEqual(
      expect.arrayContaining([
        'bosses[0].enrage.movementSpeedPerSecond must be non-negative; received -1.',
        'bosses[0].enrage.cooldownReductionPerSecond must be less than 1.',
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

  it('validates elite modifier tuning and spawn selection configuration', () => {
    const errors = validateContent(
      catalogWith({
        eliteModifiers: [
          {
            ...CURRENT_CONTENT.eliteModifiers[0],
            maxHpMultiplier: 0,
            markerColor: '',
          },
        ],
        spawnBalance: {
          ...CURRENT_CONTENT.spawnBalance,
          eliteChance: 1.5,
          eliteStartTimeSeconds: -1,
          eliteModifierWeights: { missing: 1 } as never,
        },
      }),
    )

    expect(errors).toEqual(
      expect.arrayContaining([
        'eliteModifiers[0].maxHpMultiplier must be positive; received 0.',
        'eliteModifiers[0].markerColor must be a non-empty string.',
        'spawnBalance.eliteChance must be at most 1.',
        'spawnBalance.eliteStartTimeSeconds must be non-negative; received -1.',
        'spawnBalance.eliteModifierWeights.missing references unknown elite modifier.',
      ]),
    )
  })

  it('validates shared rarity, equipment slots, and gear modifiers', () => {
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
                id: 'unknown' as never,
                tier: 9 as never,
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
        'items[0].modifiers[0].id is not supported; received "unknown".',
        'items[0].modifiers[0].tier is not supported; received "9".',
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
        'items[1].modifiers[0].sourceId must start with "item:iron-cleaver:"; received "upgrade:wrong-source".',
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

  it('validates weapon archetypes and archetype-restricted gear modifiers', () => {
    const errors = validateContent(
      catalogWith({
        items: [
          {
            ...CURRENT_CONTENT.items.find((item) => item.id === 'iron-cleaver')!,
            weaponArchetype: 'spear' as never,
          },
          {
            ...CURRENT_CONTENT.items.find((item) => item.id === 'watchers-helm')!,
            weaponArchetype: 'bow' as never,
          },
          {
            ...CURRENT_CONTENT.items.find((item) => item.id === 'iron-cleaver')!,
            modifiers: [{
              id: 'projectile-chains',
              tier: 4,
              value: 2,
              sourceId: 'item:iron-cleaver:projectile-chains',
            }],
          },
        ],
      }),
    )

    expect(errors).toEqual(
      expect.arrayContaining([
        'items[0].weaponArchetype is required for weapons and must be supported; received "spear".',
        'items[1].weaponArchetype is only supported on weapon items.',
        'items[2].modifiers[0].id is not available for slot weapon (sword).',
      ]),
    )
  })
})
