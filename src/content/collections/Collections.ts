import { FISH_DEFINITIONS } from '../../fishing/FishingContent'
import { ALL_ARTIFACT_BASE_DEFINITIONS } from '../artifacts/Artifacts'
import { CHARACTER_CLASS_DEFINITIONS } from '../classes/CharacterClasses'
import type { Rarity } from '../rarity/Rarity'

/**
 * The collections: what a player has caught, found and cleared with.
 *
 * Each page lists the entries the content already has and reads their state
 * from what the server recorded. Nothing on a page is a stat, and nothing a
 * page earns stacks: reaching a milestone puts a display in the Trophy hall
 * and does nothing else, which is why a milestone is never claimed. The
 * hall and the page derive the same displays from the same state.
 */

export type CollectionPageId = 'fish' | 'artifacts' | 'champions'

export interface CollectionEntryDefinition {
  id: string
  name: string
}

export interface CollectionPageDefinition {
  id: CollectionPageId
  name: string
  description: string
  /** What one entry is, singular and plural: "species", "species". */
  unit: readonly [string, string]
  entries: readonly CollectionEntryDefinition[]
}

export interface CollectionMilestone {
  id: string
  pageId: CollectionPageId
  /** Entries that must be found on the page. */
  threshold: number
  /** The display's name in the Trophy hall. */
  name: string
  /** What stands on the shelf. */
  description: string
}

export interface FishCollectionEntry {
  definitionId: string
  catches: number
  bestRarity: Rarity | null
  /** The record size as the pond measures it, zero to one across the species' range. */
  recordSizePercentile: number | null
}

export interface ArtifactCollectionEntry {
  definitionId: string
  found: number
  bestRarity: Rarity | null
}

export interface ClassCollectionEntry {
  classId: string
  victories: number
  deepestAbyssFloor: number
}

export interface CollectionState {
  fish: readonly FishCollectionEntry[]
  artifacts: readonly ArtifactCollectionEntry[]
  classes: readonly ClassCollectionEntry[]
}

export const COLLECTION_PAGES: Readonly<Record<CollectionPageId, CollectionPageDefinition>> = {
  fish: {
    id: 'fish',
    name: 'Fish',
    description: 'Every species the pond has given up, with the best rarity and the record size of each.',
    unit: ['species', 'species'],
    entries: Object.values(FISH_DEFINITIONS).map((fish) => ({ id: fish.id, name: fish.name })),
  },
  artifacts: {
    id: 'artifacts',
    name: 'Artifacts',
    description: 'Every relic dredged up from the Rift, and the rarest of each that has been found.',
    unit: ['relic', 'relics'],
    entries: ALL_ARTIFACT_BASE_DEFINITIONS.map((base) => ({ id: base.definitionId, name: base.name })),
  },
  champions: {
    id: 'champions',
    name: 'Champions',
    description: 'Every class a dungeon has been won with, and how deep the Abyss each has been taken.',
    unit: ['class', 'classes'],
    entries: Object.values(CHARACTER_CLASS_DEFINITIONS).map((cls) => ({ id: cls.id, name: cls.name })),
  },
}

export const COLLECTION_PAGE_ORDER: readonly CollectionPageId[] = ['fish', 'artifacts', 'champions']

/**
 * The displays, in the order they stand in the hall. Thresholds are counts
 * of entries found rather than percentages, so a page that grows later does
 * not quietly take a display back.
 */
export const COLLECTION_MILESTONES: readonly CollectionMilestone[] = [
  { id: 'fish-first', pageId: 'fish', threshold: 1, name: 'First catch', description: 'A minnow in a jar on the sill.' },
  { id: 'fish-five', pageId: 'fish', threshold: 5, name: 'Half the pond', description: 'Five species mounted along the beam.' },
  { id: 'fish-all', pageId: 'fish', threshold: 10, name: 'The whole pond', description: 'Every fish the water holds, in a case of its own.' },
  { id: 'artifacts-first', pageId: 'artifacts', threshold: 1, name: 'A relic', description: 'One relic on a stand, humming faintly.' },
  { id: 'artifacts-three', pageId: 'artifacts', threshold: 3, name: 'A reliquary', description: 'Three relics under glass.' },
  { id: 'artifacts-all', pageId: 'artifacts', threshold: 5, name: 'The full reliquary', description: 'Every relic the Rift has given up.' },
  { id: 'champions-first', pageId: 'champions', threshold: 1, name: 'A victory', description: 'One banner hung from the rafters.' },
  { id: 'champions-four', pageId: 'champions', threshold: 4, name: 'Half the hall', description: 'Four banners, four classes that made it down.' },
  { id: 'champions-all', pageId: 'champions', threshold: 8, name: 'The full hall', description: 'A banner for every class.' },
]

/** How many of a page's entries the state has found. */
export function countCollectionFound(pageId: CollectionPageId, state: CollectionState): number {
  const known = new Set(COLLECTION_PAGES[pageId].entries.map((entry) => entry.id))
  switch (pageId) {
    case 'fish':
      return state.fish.filter((entry) => entry.catches > 0 && known.has(entry.definitionId)).length
    case 'artifacts':
      return state.artifacts.filter((entry) => entry.found > 0 && known.has(entry.definitionId)).length
    case 'champions':
      return state.classes.filter((entry) => entry.victories > 0 && known.has(entry.classId)).length
  }
}

export interface CollectionMilestoneProgress extends CollectionMilestone {
  found: number
  reached: boolean
}

/** Every milestone with whether the state has reached it. */
export function deriveCollectionMilestones(state: CollectionState): CollectionMilestoneProgress[] {
  const found = Object.fromEntries(
    COLLECTION_PAGE_ORDER.map((pageId) => [pageId, countCollectionFound(pageId, state)]),
  ) as Record<CollectionPageId, number>
  return COLLECTION_MILESTONES.map((milestone) => ({
    ...milestone,
    found: found[milestone.pageId],
    reached: found[milestone.pageId] >= milestone.threshold,
  }))
}

/** The displays the Trophy hall shows: the milestones reached. */
export function deriveCollectionDisplays(state: CollectionState): CollectionMilestoneProgress[] {
  return deriveCollectionMilestones(state).filter((milestone) => milestone.reached)
}

export const EMPTY_COLLECTION_STATE: CollectionState = { fish: [], artifacts: [], classes: [] }
