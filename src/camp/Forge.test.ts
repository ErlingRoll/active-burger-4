import { describe, expect, it } from 'vitest'
import MIGRATION from '../../supabase/migrations/20260913200000_work_the_forge.sql?raw'
import {
  FORGE_BASE_FOCUS_BP,
  FORGE_BASE_SUCCESS_BP,
  FORGE_ESSENCE_CAP,
  FORGE_ESSENCE_HALF_POINT,
  FORGE_FEES,
  FORGE_FOCUS_BONUS_BP,
  FORGE_POTENTIAL_COST,
  FORGE_SETBACK_BP,
  FORGE_SUCCESS_BONUS_BP,
  clampForgeStake,
  describeForgeOutcomes,
  forgeOdds,
  isArtifactFinished,
  listForgeTargets,
} from './Forge'
import { ARTIFACT_MODIFIER_IDS, type ArtifactMetadata } from '../content/artifacts/Artifacts'
import { RARITIES } from '../content/rarity/Rarity'

const RELIQUARY: ArtifactMetadata = {
  baseId: 'ember-reliquary',
  rarity: 'rare',
  implicit: { id: 'corpse-detonation', tier: 3, value: 35 },
  modifiers: [
    { id: 'max-hp', tier: 4, value: 6 },
    { id: 'attack-speed', tier: 1, value: 14 },
    { id: 'crit-chance', tier: 3, value: 4 },
  ],
  potential: 42,
}

describe('forge odds', () => {
  it('start at the base with nothing staked and climb with diminishing returns', () => {
    expect(forgeOdds(0)).toEqual({ successBp: 3000, focusBp: 6000, setbackBp: 2000 })
    expect(forgeOdds(FORGE_ESSENCE_HALF_POINT)).toEqual({ successBp: 5250, focusBp: 7250, setbackBp: 2000 })
    expect(forgeOdds(FORGE_ESSENCE_CAP)).toEqual({ successBp: 6600, focusBp: 8000, setbackBp: 2000 })
    const first = forgeOdds(10_000).successBp - forgeOdds(0).successBp
    const later = forgeOdds(60_000).successBp - forgeOdds(50_000).successBp
    expect(later).toBeLessThan(first)
  })

  it('never reach certainty, and clamp the stake to the cap and to nought', () => {
    expect(FORGE_BASE_SUCCESS_BP + FORGE_SUCCESS_BONUS_BP).toBeLessThan(10_000)
    expect(FORGE_BASE_FOCUS_BP + FORGE_FOCUS_BONUS_BP).toBeLessThan(10_000)
    expect(forgeOdds(1_000_000)).toEqual(forgeOdds(FORGE_ESSENCE_CAP))
    expect(forgeOdds(-50)).toEqual(forgeOdds(0))
    expect(clampForgeStake(12.9)).toBe(12)
    expect(clampForgeStake(Number.NaN)).toBe(0)
  })

  it('splits one strike into four outcomes that sum to certainty', () => {
    const outcomes = describeForgeOutcomes(RELIQUARY, 'implicit', 25_000)
    expect(outcomes.target + outcomes.stray + outcomes.miss + outcomes.setback).toBe(10_000)
    expect(outcomes.target).toBeGreaterThan(outcomes.stray)
    expect(outcomes.setback).toBe(Math.round((10_000 - 5250) * 0.2))
  })

  it('folds a stray into the target when there is nowhere else to land', () => {
    const lone: ArtifactMetadata = {
      ...RELIQUARY,
      rarity: 'legendary',
      implicit: { id: 'corpse-detonation', tier: 2, value: 40 },
      modifiers: RELIQUARY.modifiers.map((modifier) => ({ ...modifier, tier: 1 })),
    }
    const outcomes = describeForgeOutcomes(lone, 'implicit', 0)
    expect(outcomes.stray).toBe(0)
    expect(outcomes.target).toBe(3000)
  })
})

describe('forge targets', () => {
  it('offers every line above tier one, then a promotion below legendary', () => {
    expect(listForgeTargets(RELIQUARY).map((option) => option.target)).toEqual([
      'implicit', 'modifier:max-hp', 'modifier:crit-chance', 'promote',
    ])
    const promotion = listForgeTargets(RELIQUARY).at(-1)
    expect(promotion?.label).toContain('epic')
    expect(listForgeTargets({ ...RELIQUARY, rarity: 'legendary' }).some((option) => option.target === 'promote')).toBe(false)
  })

  it('reads a finished artifact from its Potential, and an old one as unfinished', () => {
    expect(isArtifactFinished(RELIQUARY)).toBe(false)
    expect(isArtifactFinished({ ...RELIQUARY, potential: 0 })).toBe(true)
    const { potential: _potential, ...legacy } = RELIQUARY
    expect(isArtifactFinished(legacy)).toBe(false)
  })
})

describe('forge migration parity', () => {
  it('uses the same odds curve as the server', () => {
    const odds = MIGRATION.match(/\(3000 \+ \(4500 \* stake\.essence\) \/ \(stake\.essence \+ 25000\)\)::integer,\s+\(6000 \+ \(2500 \* stake\.essence\) \/ \(stake\.essence \+ 25000\)\)::integer,\s+2000/)
    expect(odds).not.toBeNull()
    expect([FORGE_BASE_SUCCESS_BP, FORGE_SUCCESS_BONUS_BP, FORGE_BASE_FOCUS_BP, FORGE_FOCUS_BONUS_BP, FORGE_SETBACK_BP, FORGE_ESSENCE_HALF_POINT])
      .toEqual([3000, 4500, 6000, 2500, 2000, 25000])
    expect(MIGRATION).toContain(`least(greatest(coalesce(p_essence, 0), 0), ${FORGE_ESSENCE_CAP})`)
  })

  it('charges the same fee per rarity', () => {
    for (const rarity of RARITIES) {
      const fee = FORGE_FEES[rarity]
      const json = `'{"stone": ${fee.stone}, "scrap": ${fee.scrap}, "rift-shard": ${fee.riftShards}}'::jsonb`
      expect(MIGRATION, rarity).toContain(json)
    }
  })

  it('spends Potential inside the same bounds', () => {
    const { landed, missed } = FORGE_POTENTIAL_COST
    expect(MIGRATION).toContain(`${landed.min} + public.artifact_hash_roll(v_seed, 'potential', ${landed.max - landed.min + 1})`)
    expect(MIGRATION).toContain(`${missed.min} + public.artifact_hash_roll(v_seed, 'potential', ${missed.max - missed.min + 1})`)
  })

  it('promotes from the same modifier pool in the same order', () => {
    const match = MIGRATION.match(/v_pool text\[\] := array\[([\s\S]*?)\];/)
    expect(match).not.toBeNull()
    const pool = [...match![1]!.matchAll(/'([a-z-]+)'/g)].map((entry) => entry[1])
    expect(pool).toEqual(ARTIFACT_MODIFIER_IDS)
  })
})
