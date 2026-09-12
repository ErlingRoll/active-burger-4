import { useEffect, useState } from 'react'
import {
  COLLECTION_PAGES,
  COLLECTION_PAGE_ORDER,
  countCollectionFound,
  deriveCollectionMilestones,
  type ArtifactCollectionEntry,
  type ClassCollectionEntry,
  type CollectionPageId,
  type CollectionState,
  type FishCollectionEntry,
} from '../content/collections/Collections'
import { RARITY_VISUALS } from '../content/rarity/Rarity'
import { formatFishSizeKg, getFishDefinition } from '../fishing/FishingContent'
import { getRewardIcon } from '../loot/RewardIcon'
import { CHARACTER_CLASS_DEFINITIONS, isCharacterClassId } from '../content/classes/CharacterClasses'
import { useSeededLoad } from '../ui/useSeededLoad'
import type { CollectionService } from './CollectionService'
import type { CollectionsScreenData } from './loadCollectionsScreen'

/**
 * The collections: a reference of what has been caught, found and cleared
 * with. A document screen like the codex, and read-only like it: every
 * figure here is the server's reading of its own records, and a page's
 * milestones are the displays the Trophy hall shows.
 */

interface CollectionsScreenProps {
  service: CollectionService | null
  configurationError: string | null
  onBack: () => void
  /**
   * The first fetch, already done by the navigator while the previous screen
   * was still showing. With it the cases open filled on the first frame;
   * without it the screen fetches for itself, as it did before.
   */
  initialData?: CollectionsScreenData
  /** Why that first fetch failed, when it did; shown instead of fetching again. */
  initialLoadError?: string | null
}

type LoadState = 'loading' | 'ready' | 'error'

function rarityLabel(rarity: FishCollectionEntry['bestRarity']): string {
  return rarity ? RARITY_VISUALS[rarity].label : 'Unplaced'
}

function FishEntry({ id, name, entry }: { id: string, name: string, entry: FishCollectionEntry | undefined }) {
  const fish = getFishDefinition(id)
  const found = entry !== undefined && entry.catches > 0
  return (
    <li className="collection-entry" data-found={found ? 'true' : 'false'} aria-label={`${name}: ${found ? 'found' : 'not yet found'}`}>
      <span className="collection-entry-icon" aria-hidden="true">{getRewardIcon(id)}</span>
      <span className="collection-entry-copy">
        <strong>{found ? name : '???'}</strong>
        {found && entry ? (
          <small>
            {entry.catches} {entry.catches === 1 ? 'catch' : 'catches'} · Best {rarityLabel(entry.bestRarity)}
            {entry.recordSizePercentile !== null ? ` · Record ${formatFishSizeKg(entry.recordSizePercentile, fish?.weightRangeKg)}` : ''}
          </small>
        ) : (
          <small>Not yet caught</small>
        )}
      </span>
    </li>
  )
}

function ArtifactEntry({ id, name, entry }: { id: string, name: string, entry: ArtifactCollectionEntry | undefined }) {
  const found = entry !== undefined && entry.found > 0
  return (
    <li className="collection-entry" data-found={found ? 'true' : 'false'} aria-label={`${name}: ${found ? 'found' : 'not yet found'}`}>
      <span className="collection-entry-icon" aria-hidden="true">{getRewardIcon(id)}</span>
      <span className="collection-entry-copy">
        <strong>{found ? name : '???'}</strong>
        {found && entry ? (
          <small>{entry.found} found · Best {rarityLabel(entry.bestRarity)}</small>
        ) : (
          <small>Not yet found</small>
        )}
      </span>
    </li>
  )
}

function ClassEntry({ id, name, entry }: { id: string, name: string, entry: ClassCollectionEntry | undefined }) {
  const cleared = entry !== undefined && entry.victories > 0
  const glyph = isCharacterClassId(id) ? CHARACTER_CLASS_DEFINITIONS[id].name.charAt(0) : '?'
  return (
    <li className="collection-entry" data-found={cleared ? 'true' : 'false'} aria-label={`${name}: ${cleared ? 'cleared with' : 'not yet cleared with'}`}>
      <span className="collection-entry-icon collection-class-mark" data-class={id} aria-hidden="true">{glyph}</span>
      <span className="collection-entry-copy">
        <strong>{name}</strong>
        {entry ? (
          <small>
            {entry.victories} {entry.victories === 1 ? 'victory' : 'victories'}
            {entry.deepestAbyssFloor > 0 ? ` · Abyss floor ${entry.deepestAbyssFloor}` : ''}
          </small>
        ) : (
          <small>No run yet</small>
        )}
      </span>
    </li>
  )
}

function CollectionPage({ pageId, state }: { pageId: CollectionPageId, state: CollectionState }) {
  const page = COLLECTION_PAGES[pageId]
  const found = countCollectionFound(pageId, state)
  const milestones = deriveCollectionMilestones(state).filter((milestone) => milestone.pageId === pageId)
  const fishById = new Map(state.fish.map((entry) => [entry.definitionId, entry]))
  const artifactsById = new Map(state.artifacts.map((entry) => [entry.definitionId, entry]))
  const classesById = new Map(state.classes.map((entry) => [entry.classId, entry]))
  return (
    <section className="app-panel collection-page" aria-labelledby={`collection-${pageId}-title`} data-page={pageId}>
      <header className="app-panel-heading">
        <div>
          <p className="screen-kicker">{page.description}</p>
          <h3 id={`collection-${pageId}-title`}>{page.name}</h3>
        </div>
        <span className="app-panel-meta">
          {found} / {page.entries.length} {page.entries.length === 1 ? page.unit[0] : page.unit[1]}
        </span>
      </header>
      <ul className="collection-entries" aria-label={`${page.name} entries`}>
        {page.entries.map((entry) => {
          switch (pageId) {
            case 'fish':
              return <FishEntry key={entry.id} id={entry.id} name={entry.name} entry={fishById.get(entry.id)} />
            case 'artifacts':
              return <ArtifactEntry key={entry.id} id={entry.id} name={entry.name} entry={artifactsById.get(entry.id)} />
            case 'champions':
              return <ClassEntry key={entry.id} id={entry.id} name={entry.name} entry={classesById.get(entry.id)} />
          }
        })}
      </ul>
      <ol className="collection-milestones" aria-label={`${page.name} milestones`}>
        {milestones.map((milestone) => (
          <li key={milestone.id} data-reached={milestone.reached ? 'true' : 'false'}>
            <span className="collection-milestone-mark" aria-hidden="true">{milestone.reached ? '✓' : milestone.threshold}</span>
            <span className="collection-milestone-copy">
              <strong>{milestone.name}</strong>
              <small>{milestone.reached ? milestone.description : `${milestone.threshold} ${milestone.threshold === 1 ? page.unit[0] : page.unit[1]} for a display in the Trophy hall`}</small>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function CollectionsScreen({
  service,
  configurationError,
  onBack,
  initialData,
  initialLoadError = null,
}: CollectionsScreenProps) {
  const seeded = useSeededLoad(initialData !== undefined || initialLoadError !== null, service)
  const [state, setState] = useState<CollectionState | null>(() => initialData?.state ?? null)
  const [loadState, setLoadState] = useState<LoadState>(
    () => initialData
      ? 'ready'
      : initialLoadError !== null || !service ? 'error' : 'loading',
  )
  const [error, setError] = useState<string | null>(
    () => initialLoadError ??
      (service ? configurationError : configurationError ?? 'The collections are unavailable.'),
  )

  useEffect(() => {
    if (!service || seeded) {
      return
    }
    let cancelled = false
    void service.loadState()
      .then((loaded) => {
        if (cancelled) {
          return
        }
        setState(loaded)
        setLoadState('ready')
        setError(null)
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setLoadState('error')
          setError(loadError instanceof Error ? loadError.message : 'Unable to read the collections.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [seeded, service])

  return (
    <section className="app-screen collections-screen" aria-labelledby="collections-title">
      <div className="app-screen-topbar">
        <button className="app-screen-back" type="button" onClick={onBack}>
          ← Back to the refuge
        </button>
      </div>
      <div className="app-screen-title">
        <p className="screen-kicker">The cases in the hall</p>
        <h2 id="collections-title">Collections</h2>
        <p className="app-screen-lede">
          What has been caught, found and cleared with, read from the refuge's own records. A page's
          milestones earn a display in the Trophy hall at the Camp and nothing that stacks.
        </p>
      </div>
      {error ? <p className="persistence-error" role="alert">{error}</p> : null}
      <div className="app-screen-frame collections-frame">
        {loadState === 'loading' ? (
          <p role="status">Opening the cases…</p>
        ) : state ? (
          <div className="app-screen-panels collections-panels">
            {COLLECTION_PAGE_ORDER.map((pageId) => (
              <CollectionPage key={pageId} pageId={pageId} state={state} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
