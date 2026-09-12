import { describe, expect, it } from 'vitest'
import {
  COLLECTION_MILESTONES,
  COLLECTION_PAGES,
  COLLECTION_PAGE_ORDER,
  EMPTY_COLLECTION_STATE,
  countCollectionFound,
  deriveCollectionDisplays,
  deriveCollectionMilestones,
  type CollectionState,
} from './Collections'

const SOME_OF_EACH: CollectionState = {
  fish: [
    { definitionId: 'river-minnow', catches: 3, bestRarity: 'uncommon', recordSizePercentile: 0.4 },
    { definitionId: 'lantern-pike', catches: 1, bestRarity: 'rare', recordSizePercentile: 0.9 },
    // A species the content no longer has is not a find.
    { definitionId: 'ghost-carp', catches: 1, bestRarity: 'common', recordSizePercentile: 0.1 },
  ],
  artifacts: [
    { definitionId: 'artifact-ember-reliquary', found: 2, bestRarity: 'epic' },
  ],
  classes: [
    { classId: 'knight', victories: 2, deepestAbyssFloor: 12 },
    // Deep in the Abyss but never a dungeon victory: not a class cleared with.
    { classId: 'ranger', victories: 0, deepestAbyssFloor: 30 },
  ],
}

describe('the collection pages', () => {
  it('lists every species, relic and class the content has', () => {
    expect(COLLECTION_PAGES.fish.entries.length).toBe(10)
    expect(COLLECTION_PAGES.artifacts.entries.length).toBe(5)
    expect(COLLECTION_PAGES.champions.entries.length).toBe(8)
    for (const pageId of COLLECTION_PAGE_ORDER) {
      const ids = new Set(COLLECTION_PAGES[pageId].entries.map((entry) => entry.id))
      expect(ids.size, pageId).toBe(COLLECTION_PAGES[pageId].entries.length)
    }
  })

  it('ends each page with a milestone for every entry, and never asks for more', () => {
    for (const pageId of COLLECTION_PAGE_ORDER) {
      const thresholds = COLLECTION_MILESTONES
        .filter((milestone) => milestone.pageId === pageId)
        .map((milestone) => milestone.threshold)
      expect(Math.max(...thresholds), pageId).toBe(COLLECTION_PAGES[pageId].entries.length)
      expect(thresholds).toEqual([...thresholds].sort((left, right) => left - right))
    }
  })

  it('gives every milestone a different id', () => {
    expect(new Set(COLLECTION_MILESTONES.map((milestone) => milestone.id)).size).toBe(COLLECTION_MILESTONES.length)
  })
})

describe('countCollectionFound', () => {
  it('counts only entries the content knows, and only those actually found', () => {
    expect(countCollectionFound('fish', SOME_OF_EACH)).toBe(2)
    expect(countCollectionFound('artifacts', SOME_OF_EACH)).toBe(1)
    expect(countCollectionFound('champions', SOME_OF_EACH)).toBe(1)
    for (const pageId of COLLECTION_PAGE_ORDER) {
      expect(countCollectionFound(pageId, EMPTY_COLLECTION_STATE)).toBe(0)
    }
  })
})

describe('deriveCollectionMilestones', () => {
  it('marks the milestones the state has reached, and carries the count', () => {
    const milestones = deriveCollectionMilestones(SOME_OF_EACH)
    const byId = Object.fromEntries(milestones.map((milestone) => [milestone.id, milestone]))
    expect(byId['fish-first']?.reached).toBe(true)
    expect(byId['fish-first']?.found).toBe(2)
    expect(byId['fish-five']?.reached).toBe(false)
    expect(byId['artifacts-first']?.reached).toBe(true)
    expect(byId['artifacts-three']?.reached).toBe(false)
    expect(byId['champions-first']?.reached).toBe(true)
    expect(byId['champions-four']?.reached).toBe(false)
  })

  it('shows nothing in the hall for an empty state and everything for a full one', () => {
    expect(deriveCollectionDisplays(EMPTY_COLLECTION_STATE)).toEqual([])
    const full: CollectionState = {
      fish: COLLECTION_PAGES.fish.entries.map((entry) => ({
        definitionId: entry.id, catches: 1, bestRarity: 'common', recordSizePercentile: 0.5,
      })),
      artifacts: COLLECTION_PAGES.artifacts.entries.map((entry) => ({
        definitionId: entry.id, found: 1, bestRarity: 'rare',
      })),
      classes: COLLECTION_PAGES.champions.entries.map((entry) => ({
        classId: entry.id, victories: 1, deepestAbyssFloor: 0,
      })),
    }
    expect(deriveCollectionDisplays(full).map((milestone) => milestone.id))
      .toEqual(COLLECTION_MILESTONES.map((milestone) => milestone.id))
  })
})
