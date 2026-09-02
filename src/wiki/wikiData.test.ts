import { describe, expect, it } from 'vitest'
import { getFloorStatMultiplier } from '../content/dungeons/Dungeons'
import { ELITE_MODIFIER_DEFINITIONS } from '../content/enemies/EliteModifiers'
import { xpRequiredForNextLevel } from '../content/progression/XpBalance'
import {
  createFloorScalingChartPoints,
  createXpChartPoints,
  formatWikiPercentage,
  getEliteModifierWikiDescription,
  wikiAnchor,
  WIKI_SECTION_IDS,
} from './wikiData'

describe('wiki source-derived data', () => {
  it('uses the live XP and floor scaling helpers for graph values', () => {
    expect(createXpChartPoints()).toContainEqual({
      label: 'L30',
      value: xpRequiredForNextLevel(30),
    })
    expect(createXpChartPoints()).toHaveLength(6)
    expect(createXpChartPoints().at(-1)).toEqual({
      label: 'L50',
      value: xpRequiredForNextLevel(50),
    })
    expect(createFloorScalingChartPoints()).toContainEqual({
      label: 'F30',
      value: getFloorStatMultiplier(30),
    })
    expect(createFloorScalingChartPoints()).toHaveLength(6)
    expect(createFloorScalingChartPoints().at(-1)).toEqual({
      label: 'F50',
      value: getFloorStatMultiplier(50),
    })
  })

  it('keeps section and content anchors stable and unique', () => {
    expect(new Set(WIKI_SECTION_IDS).size).toBe(WIKI_SECTION_IDS.length)
    expect(wikiAnchor('skill', 'chain-lightning')).toBe('skill-chain-lightning')
  })

  it('formats fractional values as clean reader-facing percentages', () => {
    expect(formatWikiPercentage(0.07)).toBe('7%')
    expect(formatWikiPercentage(0.123456)).toBe('12.35%')
  })

  it('derives distinct elite-card descriptions from their authored mechanics', () => {
    const descriptions = Object.values(ELITE_MODIFIER_DEFINITIONS)
      .map(getEliteModifierWikiDescription)

    expect(new Set(descriptions).size).toBe(descriptions.length)
    expect(getEliteModifierWikiDescription(ELITE_MODIFIER_DEFINITIONS.poisoner))
      .toContain('3s of Chaos poison worth 30%')
    expect(getEliteModifierWikiDescription(ELITE_MODIFIER_DEFINITIONS.volatile))
      .toContain('120 units')
  })
})
