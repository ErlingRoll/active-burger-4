import { describe, expect, it } from 'vitest'
import MIGRATION from '../../../supabase/migrations/20260912160000_add_artifacts.sql?raw'
// The roll functions were restated when Second wind became Bulwark, so the
// tier ranges and the pool are read from their latest definition.
import ROLL_MIGRATION from '../../../supabase/migrations/20260912200000_artifact_floor_shield.sql?raw'
// Potential came later, rolled by the trigger around the same roll.
import FORGE_MIGRATION from '../../../supabase/migrations/20260913200000_work_the_forge.sql?raw'
// The roll and the trigger were restated once more so a box could put a
// floor under an artifact's rarity and Potential.
import FLOOR_MIGRATION from '../../../supabase/migrations/20260917250000_legendary_boxes_worth_the_name.sql?raw'
import {
  ALL_ARTIFACT_BASE_DEFINITIONS,
  ARTIFACT_BASE_DEFINITIONS,
  ARTIFACT_MODIFIER_COUNTS,
  ARTIFACT_MODIFIER_DEFINITIONS,
  ARTIFACT_MODIFIER_IDS,
  ARTIFACT_POTENTIAL_DEFAULT,
  ARTIFACT_POTENTIAL_MAX,
  ARTIFACT_POTENTIAL_MIN,
  ARTIFACT_RARITY_WEIGHTS,
  ARTIFACT_SALVAGE_SCRAP,
  ARTIFACT_TIER_WEIGHTS,
  ARTIFACT_TIERS,
  describeArtifact,
  formatArtifactSummary,
  getArtifactPotential,
  isArtifactMetadata,
  readArtifactMetadata,
  rollArtifact,
  validateArtifactDefinitions,
  type ArtifactTierRanges,
} from './Artifacts'
import { Random } from '../../game/random/Random'
import { RARITIES, RARITY_ORDER, type Rarity } from '../rarity/Rarity'
import { ALL_INVENTORY_ITEM_DEFINITIONS } from '../../inventory/ItemDefinitions'

/**
 * The tier ranges as the migration declares them, keyed by effect id. The
 * SQL groups ids that share a ladder and falls back to a standard ladder for
 * everything it does not name, and this reads it the same way.
 */
function parseSqlTierRanges(): Map<string, ArtifactTierRanges> {
  const start = ROLL_MIGRATION.indexOf('returns integer[]')
  const end = ROLL_MIGRATION.indexOf('end;\n$$;', start)
  const body = ROLL_MIGRATION.slice(start, end)
  const ladder = /case p_tier\s+when 1 then array\[(\d+), (\d+)\]\s+when 2 then array\[(\d+), (\d+)\]\s+when 3 then array\[(\d+), (\d+)\]\s+when 4 then array\[(\d+), (\d+)\]\s+else array\[(\d+), (\d+)\]\s+end/g
  const named = /when p_effect_id in \(((?:'[a-z-]+'(?:, )?)+)\) then case p_tier/g
  const ranges = new Map<string, ArtifactTierRanges>()
  const ladders: ArtifactTierRanges[] = []
  for (const match of body.matchAll(ladder)) {
    const numbers = match.slice(1).map(Number)
    ladders.push({
      1: { min: numbers[0]!, max: numbers[1]! },
      2: { min: numbers[2]!, max: numbers[3]! },
      3: { min: numbers[4]!, max: numbers[5]! },
      4: { min: numbers[6]!, max: numbers[7]! },
      5: { min: numbers[8]!, max: numbers[9]! },
    })
  }
  const groups = [...body.matchAll(named)].map((match) =>
    [...match[1]!.matchAll(/'([a-z-]+)'/g)].map((id) => id[1]!),
  )
  // Every named group has its own ladder in order; the one ladder left over
  // is the `else` fallback.
  expect(ladders.length).toBe(groups.length + 1)
  groups.forEach((ids, index) => {
    for (const id of ids) {
      ranges.set(id, ladders[index]!)
    }
  })
  const fallback = ladders[ladders.length - 1]!
  for (const id of ARTIFACT_MODIFIER_IDS) {
    if (!ranges.has(id)) {
      ranges.set(id, fallback)
    }
  }
  return ranges
}

describe('artifact definitions', () => {
  it('are internally sound', () => {
    expect(validateArtifactDefinitions()).toEqual([])
  })

  it('every base has an inventory definition and every artifact definition has a base', () => {
    const inventoryArtifacts = ALL_INVENTORY_ITEM_DEFINITIONS
      .filter((definition) => definition.category === 'artifact')
      .map((definition) => definition.id)
      .sort()
    const bases = ALL_ARTIFACT_BASE_DEFINITIONS.map((base) => base.definitionId).sort()
    expect(inventoryArtifacts).toEqual(bases)
    for (const definition of ALL_INVENTORY_ITEM_DEFINITIONS) {
      if (definition.category !== 'artifact') {
        continue
      }
      expect(definition.stackable).toBe(false)
      expect(definition.tradeable).toBe(true)
      expect(definition.bindOnEquip).toBe(false)
      expect(definition.salvageEssence).toBe(0)
    }
  })

  it('names the five bases the plan asked for', () => {
    expect(ALL_ARTIFACT_BASE_DEFINITIONS.map((base) => base.name)).toEqual([
      "Cartographer's Compass",
      'Ember Reliquary',
      'Echoing Tuning Fork',
      "Wayfarer's Anklet",
      "Glutton's Kettle",
    ])
  })

  it('keeps the Compass modest: five to ten percent across its tiers', () => {
    const tiers = ARTIFACT_BASE_DEFINITIONS['cartographers-compass'].implicit.tiers
    expect(tiers[5].min).toBe(5)
    expect(tiers[1].max).toBe(10)
  })
})

describe('artifact rolls', () => {
  const SAMPLE = 40_000

  it('rolls from a floor upward, keeping the weights above it in proportion', () => {
    const random = new Random(11)
    const counts: Record<Rarity, number> = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 }
    for (let i = 0; i < SAMPLE; i += 1) {
      counts[rollArtifact('ember-reliquary', random, { rarityFloor: 'epic' }).rarity] += 1
    }
    expect(counts.common + counts.uncommon + counts.rare).toBe(0)
    // Ten to two: legendary one time in six.
    expect(counts.legendary / SAMPLE).toBeGreaterThan(0.15)
    expect(counts.legendary / SAMPLE).toBeLessThan(0.185)
  })

  it('makes an artifact with at least the Potential the box asks for', () => {
    const random = new Random(12)
    let lowest = Infinity
    for (let i = 0; i < 2_000; i += 1) {
      lowest = Math.min(lowest, getArtifactPotential(rollArtifact('gluttons-kettle', random, { potentialMin: 70 })))
    }
    expect(lowest).toBeGreaterThanOrEqual(70)
    // A hint above the ceiling is clamped rather than rolled past it.
    expect(getArtifactPotential(rollArtifact('gluttons-kettle', random, { potentialMin: 500 }))).toBe(ARTIFACT_POTENTIAL_MAX)
  })

  it('follow the rarity table, with a legendary one in fifty', () => {
    const random = new Random(7)
    const counts = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 }
    for (let index = 0; index < SAMPLE; index += 1) {
      counts[rollArtifact('ember-reliquary', random).rarity] += 1
    }
    for (const rarity of RARITIES) {
      const expected = ARTIFACT_RARITY_WEIGHTS[rarity] / 100
      const observed = counts[rarity] / SAMPLE
      expect(Math.abs(observed - expected)).toBeLessThan(0.006)
    }
  })

  it('give one modifier per rarity rank, all distinct, all inside their tier range', () => {
    const random = new Random(11)
    for (let index = 0; index < 5_000; index += 1) {
      const artifact = rollArtifact('wayfarers-anklet', random)
      expect(artifact.modifiers).toHaveLength(ARTIFACT_MODIFIER_COUNTS[artifact.rarity])
      expect(artifact.modifiers).toHaveLength(RARITY_ORDER[artifact.rarity] + 1)
      expect(new Set(artifact.modifiers.map((modifier) => modifier.id)).size)
        .toBe(artifact.modifiers.length)
      expect(artifact.implicit.id).toBe('momentum')
      const implicitRange = ARTIFACT_BASE_DEFINITIONS['wayfarers-anklet'].implicit.tiers[artifact.implicit.tier]
      expect(artifact.implicit.value).toBeGreaterThanOrEqual(implicitRange.min)
      expect(artifact.implicit.value).toBeLessThanOrEqual(implicitRange.max)
      for (const modifier of artifact.modifiers) {
        const range = ARTIFACT_MODIFIER_DEFINITIONS[modifier.id].tiers[modifier.tier]
        expect(modifier.value).toBeGreaterThanOrEqual(range.min)
        expect(modifier.value).toBeLessThanOrEqual(range.max)
      }
      expect(isArtifactMetadata(artifact)).toBe(true)
    }
  })

  it('give every artifact Potential inside its bounds', () => {
    const random = new Random(31)
    let lowest = Number.POSITIVE_INFINITY
    let highest = 0
    for (let index = 0; index < 5_000; index += 1) {
      const potential = getArtifactPotential(rollArtifact('ember-reliquary', random))
      lowest = Math.min(lowest, potential)
      highest = Math.max(highest, potential)
    }
    expect(lowest).toBe(ARTIFACT_POTENTIAL_MIN)
    expect(highest).toBe(ARTIFACT_POTENTIAL_MAX)
  })

  it('make tier one the rare roll', () => {
    const random = new Random(23)
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (let index = 0; index < SAMPLE; index += 1) {
      counts[rollArtifact('gluttons-kettle', random).implicit.tier] += 1
    }
    for (const tier of ARTIFACT_TIERS) {
      const expected = ARTIFACT_TIER_WEIGHTS[tier] / 100
      // Four standard errors at this sample size, so a seed that happens to
      // land three out does not fail the build; a wrong table lands far wider.
      const tolerance = 4 * Math.sqrt((expected * (1 - expected)) / SAMPLE)
      expect(Math.abs(counts[tier] / SAMPLE - expected)).toBeLessThan(tolerance)
    }
  })

  it('describe the implicit first and every modifier with its value in place', () => {
    const artifact = rollArtifact('echoing-tuning-fork', new Random(3))
    const lines = describeArtifact(artifact)
    expect(lines[0]).toMatchObject({ kind: 'implicit', id: 'skill-echo' })
    expect(lines[0]!.text).toContain(`${artifact.implicit.value}% effectiveness`)
    expect(lines).toHaveLength(1 + artifact.modifiers.length)
    for (const line of lines) {
      expect(line.text).not.toContain('#')
    }
    expect(formatArtifactSummary(artifact)).toContain('modifier')
  })
})

describe('artifact metadata guard', () => {
  const valid = rollArtifact('cartographers-compass', new Random(1))

  it('accepts a complete roll and reads it off the right definition', () => {
    expect(isArtifactMetadata(valid)).toBe(true)
    expect(readArtifactMetadata('artifact-cartographers-compass', { ...valid })).toEqual(valid)
    expect(readArtifactMetadata('artifact-ember-reliquary', { ...valid })).toBeNull()
    expect(readArtifactMetadata('river-minnow', { ...valid })).toBeNull()
  })

  it('reads a missing Potential as the default and rejects a broken one', () => {
    const { potential: _potential, ...legacy } = valid
    expect(isArtifactMetadata(legacy)).toBe(true)
    expect(getArtifactPotential(legacy)).toBe(ARTIFACT_POTENTIAL_DEFAULT)
    expect(isArtifactMetadata({ ...valid, potential: 0 })).toBe(true)
    expect(isArtifactMetadata({ ...valid, potential: -1 })).toBe(false)
    expect(isArtifactMetadata({ ...valid, potential: 12.5 })).toBe(false)
  })

  it('rejects the wrong implicit, a repeated modifier, or an unknown base', () => {
    expect(isArtifactMetadata({ ...valid, implicit: { ...valid.implicit, id: 'momentum' } })).toBe(false)
    expect(isArtifactMetadata({
      ...valid,
      modifiers: [valid.modifiers[0], valid.modifiers[0]],
    })).toBe(false)
    expect(isArtifactMetadata({ ...valid, baseId: 'sundial' })).toBe(false)
    expect(isArtifactMetadata({ ...valid, modifiers: 'none' })).toBe(false)
  })
})

describe('artifact migration parity', () => {
  it('rolls every effect inside the same tier ranges the client shows', () => {
    const sql = parseSqlTierRanges()
    for (const modifier of Object.values(ARTIFACT_MODIFIER_DEFINITIONS)) {
      expect(sql.get(modifier.id), modifier.id).toEqual(modifier.tiers)
    }
    for (const base of ALL_ARTIFACT_BASE_DEFINITIONS) {
      expect(sql.get(base.implicit.id), base.implicit.id).toEqual(base.implicit.tiers)
    }
  })

  it('draws modifiers from the same pool in the same order', () => {
    const match = ROLL_MIGRATION.match(/v_pool text\[\] := array\[([\s\S]*?)\];/)
    expect(match).not.toBeNull()
    const pool = [...match![1]!.matchAll(/'([a-z-]+)'/g)].map((entry) => entry[1])
    expect(pool).toEqual(ARTIFACT_MODIFIER_IDS)
  })

  it('cuts rarity and tier at the same points', () => {
    const rarityCutoffs = [...MIGRATION.matchAll(/when v_rarity_roll < (\d+) then/g)].map((m) => Number(m[1]))
    let running = 0
    const expectedRarity = RARITIES.slice(0, -1).map((rarity) => (running += ARTIFACT_RARITY_WEIGHTS[rarity]))
    expect(rarityCutoffs).toEqual(expectedRarity)

    const tierCutoffs = [...MIGRATION.matchAll(/when v_tier_roll < (\d+) then/g)].map((m) => Number(m[1]))
    running = 0
    const expectedTier = ARTIFACT_TIERS.slice(0, -1).map((tier) => (running += ARTIFACT_TIER_WEIGHTS[tier]))
    // The implicit and the modifiers each carry a copy of the ladder.
    expect(tierCutoffs).toEqual([...expectedTier, ...expectedTier])
  })

  it('rolls Potential inside the same bounds and backfills the same default', () => {
    expect(FORGE_MIGRATION).toContain(
      `'potential', ${ARTIFACT_POTENTIAL_MIN} + public.artifact_hash_roll(new.id, 'potential', ${ARTIFACT_POTENTIAL_MAX - ARTIFACT_POTENTIAL_MIN + 1})`,
    )
    expect(FORGE_MIGRATION).toContain(`'{"potential": ${ARTIFACT_POTENTIAL_DEFAULT}}'::jsonb`)
  })

  it('restates the rarity weights and the pool unchanged when it adds the floor', () => {
    const weights = FLOOR_MIGRATION.match(/v_rarity_weights integer\[\] := array\[([\d, ]+)\];/)
    expect(weights).not.toBeNull()
    expect(weights![1]!.split(',').map((weight) => Number(weight.trim())))
      .toEqual(RARITIES.map((rarity) => ARTIFACT_RARITY_WEIGHTS[rarity]))

    const pool = FLOOR_MIGRATION.match(/v_pool text\[\] := array\[([\s\S]*?)\];/)
    expect([...pool![1]!.matchAll(/'([a-z-]+)'/g)].map((entry) => entry[1])).toEqual(ARTIFACT_MODIFIER_IDS)

    const tierCutoffs = [...FLOOR_MIGRATION.matchAll(/when v_tier_roll < (\d+) then/g)].map((m) => Number(m[1]))
    let running = 0
    const expectedTier = ARTIFACT_TIERS.slice(0, -1).map((tier) => (running += ARTIFACT_TIER_WEIGHTS[tier]))
    expect(tierCutoffs).toEqual([...expectedTier, ...expectedTier])
  })

  it('rolls Potential from a floor the box may raise, clamped to the same bounds', () => {
    expect(FLOOR_MIGRATION).toContain(
      `v_potential_min := least(${ARTIFACT_POTENTIAL_MAX}, greatest(${ARTIFACT_POTENTIAL_MIN}, coalesce(`,
    )
    expect(FLOOR_MIGRATION).toContain(
      `'potential', v_potential_min + public.artifact_hash_roll(new.id, 'potential', ${ARTIFACT_POTENTIAL_MAX} - v_potential_min + 1)`,
    )
    // The hints never reach the stored metadata.
    expect(FLOOR_MIGRATION).toContain("v_metadata := v_metadata - 'rarityFloor';")
    expect(FLOOR_MIGRATION).toContain("new.metadata := new.metadata - 'potentialMin';")
  })

  it('pays the same scrap for salvage', () => {
    const start = MIGRATION.indexOf("v_definition.category = 'artifact'")
    const block = MIGRATION.slice(start, MIGRATION.indexOf('end;', start))
    for (const rarity of RARITIES) {
      const match = block.match(new RegExp(`when '${rarity}' then (\\d+)`))
      expect(Number(match?.[1]), rarity).toBe(ARTIFACT_SALVAGE_SCRAP[rarity])
    }
  })

})
