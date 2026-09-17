import { describe, expect, it } from 'vitest'
import MIGRATION from '../../supabase/migrations/20260917250000_legendary_boxes_worth_the_name.sql?raw'
import { ALL_ARTIFACT_BASE_DEFINITIONS, ARTIFACT_POTENTIAL_MAX, ARTIFACT_POTENTIAL_MIN } from '../content/artifacts/Artifacts'
import { RARITIES, RARITY_ORDER, Rarity } from '../content/rarity/Rarity'
import { getFishDefinition } from '../fishing/FishingContent'
import { getInventoryItemDefinition } from '../inventory/ItemDefinitions'
import {
  LOOT_BOX_DROP_TABLES,
  LOOT_BOX_RULES,
  getLootBoxArtifactRarityChances,
  getLootBoxItemCount,
} from './LootBoxContents'

/*
 * The tables and rules are held against the migration in
 * `tests/lootBoxDropTables.test.ts`, which finds the newest migration that
 * defines them. What is checked here is the shape of the contents: what a
 * box is allowed to hold, and what each box promises over the one below.
 */

describe('loot box contents', () => {
  it('only names things that exist, and stacks only what stacks', () => {
    for (const rarity of RARITIES) {
      for (const entry of LOOT_BOX_DROP_TABLES[rarity]) {
        const definition = getInventoryItemDefinition(entry.definitionId)
        expect(definition, `${rarity}: ${entry.definitionId}`).toBeDefined()
        expect(entry.quantity).toBeGreaterThanOrEqual(1)
        if (entry.quantity > 1) {
          expect(definition?.stackable, `${rarity}: ${entry.definitionId}`).toBe(true)
          expect(definition?.maxStackSize ?? 0).toBeGreaterThanOrEqual(entry.quantity)
        }
      }
    }
    // The server stamps a species rarity for exactly the fish the tables can draw.
    const fishInTables = new Set(RARITIES.flatMap((rarity) =>
      LOOT_BOX_DROP_TABLES[rarity].map((entry) => entry.definitionId).filter((id) => getFishDefinition(id) !== undefined),
    ))
    const stamped = MIGRATION.match(/if v_result_definition_id in \(((?:'[a-z-]+'(?:, )?)+)\) then\n\s+-- A fish carries/)
    expect(stamped).not.toBeNull()
    expect(new Set([...stamped![1]!.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]))).toEqual(fishInTables)
    for (const fishId of fishInTables) {
      const fish = getFishDefinition(fishId)!
      expect(MIGRATION, fishId).toMatch(
        fish.rarity === Rarity.Legendary
          ? /else 'legendary'\n\s+end;/
          : new RegExp(`when '${fishId}' then '${fish.rarity}'`),
      )
    }
  })

  it('never drops an artifact below a rare box, and splits them evenly above it', () => {
    for (const rarity of [Rarity.Common, Rarity.Uncommon]) {
      expect(LOOT_BOX_DROP_TABLES[rarity].some((entry) => entry.definitionId.startsWith('artifact-'))).toBe(false)
      expect(LOOT_BOX_RULES[rarity].guaranteedArtifacts).toBe(0)
      expect(getLootBoxArtifactRarityChances(rarity)).toBeNull()
    }
    for (const rarity of [Rarity.Rare, Rarity.Epic, Rarity.Legendary]) {
      const bases = LOOT_BOX_DROP_TABLES[rarity].filter((entry) => entry.definitionId.startsWith('artifact-'))
      expect(bases).toHaveLength(ALL_ARTIFACT_BASE_DEFINITIONS.length)
      expect(new Set(bases.map((entry) => entry.weight)).size).toBe(1)
    }
  })

  it('gives a legendary box one artifact for certain, epic or better, and the best Potential', () => {
    const rules = LOOT_BOX_RULES.legendary
    expect(rules.guaranteedArtifacts).toBe(1)
    expect(rules.artifactRarityFloor).toBe(Rarity.Epic)
    expect(rules.artifactPotentialMin).toBeGreaterThan(ARTIFACT_POTENTIAL_MIN)
    expect(rules.artifactPotentialMin).toBeLessThanOrEqual(ARTIFACT_POTENTIAL_MAX)
    expect(rules.fishEnchantmentChancePercent).toBe(100)
    expect(getLootBoxItemCount(Rarity.Legendary)).toBe(4)

    const chances = getLootBoxArtifactRarityChances(Rarity.Legendary)!
    expect(chances.common + chances.uncommon + chances.rare).toBe(0)
    expect(chances.epic + chances.legendary).toBeCloseTo(1)
    expect(chances.legendary).toBeCloseTo(2 / 12)
  })

  it('raises each box a little over the one below it', () => {
    for (let index = 1; index < RARITIES.length; index += 1) {
      const below = LOOT_BOX_RULES[RARITIES[index - 1]!]
      const box = LOOT_BOX_RULES[RARITIES[index]!]
      expect(getLootBoxItemCount(RARITIES[index]!)).toBeGreaterThanOrEqual(getLootBoxItemCount(RARITIES[index - 1]!))
      expect(box.fishSizeFloor).toBeGreaterThan(below.fishSizeFloor)
      expect(box.fishEnchantmentChancePercent).toBeGreaterThanOrEqual(below.fishEnchantmentChancePercent)
      const floorBelow = below.artifactRarityFloor === null ? -1 : RARITY_ORDER[below.artifactRarityFloor]
      const floor = box.artifactRarityFloor === null ? -1 : RARITY_ORDER[box.artifactRarityFloor]
      expect(floor).toBeGreaterThanOrEqual(floorBelow)
    }
  })

})
