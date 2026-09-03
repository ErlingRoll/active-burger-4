import { useEffect, useMemo, useState } from 'react'
import type { FishingService } from './FishingService'
import {
  DEFAULT_FISHING_BAIT_ID,
  DEFAULT_FISHING_SPOT_ID,
  FISHING_SPOTS,
} from './FishingContent'
import type { InventoryItemInstance, InventoryService } from '../inventory'
import { getInventoryItemDefinition } from '../inventory'

interface FishingScreenProps {
  fishingService: FishingService | null
  inventoryService: InventoryService | null
  configurationError: string | null
  onBack: () => void
}

function createAttemptId(): string {
  return crypto.randomUUID()
}

function formatSizePercentile(value: unknown): string {
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : 'Unknown'
}

function InventoryList({ items }: { items: readonly InventoryItemInstance[] }) {
  if (items.length === 0) {
    return <p className="fishing-muted">No inventory items yet. Catch your first fish below.</p>
  }
  return (
    <ul className="fishing-inventory-list">
      {items.map((item) => {
        const definition = getInventoryItemDefinition(item.definitionId)
        const rarity = item.metadata.rarity
        return (
          <li key={item.itemInstanceId}>
            <strong>{definition?.name ?? item.definitionId}</strong>
            <span>×{item.quantity}</span>
            {typeof rarity === 'string' ? <small>{rarity}</small> : null}
            {item.definitionId === 'river-minnow' ? (
              <small>Size {formatSizePercentile(item.metadata.sizePercentile)}</small>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

export function FishingScreen({
  fishingService,
  inventoryService,
  configurationError,
  onBack,
}: FishingScreenProps) {
  const [items, setItems] = useState<InventoryItemInstance[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    () => inventoryService ? 'loading' : 'error',
  )
  const [error, setError] = useState<string | null>(
    () => inventoryService ? configurationError : configurationError ?? 'Inventory is unavailable.',
  )
  const [fishing, setFishing] = useState(false)
  const [lastCatch, setLastCatch] = useState<{
    definitionId: string
    metadata: Record<string, unknown>
  } | null>(null)

  const spot = FISHING_SPOTS[DEFAULT_FISHING_SPOT_ID]
  const rods = useMemo(
    () => items.filter((item) => getInventoryItemDefinition(item.definitionId)?.category === 'rod'),
    [items],
  )

  useEffect(() => {
    if (!inventoryService) {
      return
    }
    let cancelled = false
    void inventoryService.loadInventory()
      .then((loadedItems) => {
        if (!cancelled) {
          setItems(loadedItems)
          setLoadState('ready')
          setError(null)
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setLoadState('error')
          setError(loadError instanceof Error ? loadError.message : 'Unable to load inventory.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [configurationError, inventoryService])

  const startFishing = async (): Promise<void> => {
    if (!fishingService || !inventoryService || fishing) {
      return
    }
    setFishing(true)
    setError(null)
    try {
      const result = await fishingService.startAttempt({
        attemptId: createAttemptId(),
        spotId: spot.id,
        baitDefinitionId: DEFAULT_FISHING_BAIT_ID,
        rodInstanceId: rods[0]?.itemInstanceId ?? null,
      })
      setLastCatch({
        definitionId: result.definitionId,
        metadata: result.metadata,
      })
      setItems(await inventoryService.loadInventory())
    } catch (fishingError: unknown) {
      setError(fishingError instanceof Error ? fishingError.message : 'Unable to complete fishing attempt.')
    } finally {
      setFishing(false)
    }
  }

  return (
    <section className="dashboard fishing-screen" aria-labelledby="fishing-title">
      <div className="dashboard-panel fishing-panel">
        <button className="secondary-action" type="button" onClick={onBack}>Back to dashboard</button>
        <p className="screen-kicker">Downtime activity</p>
        <h2 id="fishing-title">Fishing</h2>
        <p>Catch fish for future run meals, Champion recovery, and collection goals.</p>
        <section className="fishing-spot-card" aria-labelledby="fishing-spot-title">
          <p className="screen-kicker">Fishing spot</p>
          <h3 id="fishing-spot-title">{spot.name}</h3>
          <p>{spot.description}</p>
          <dl>
            <div><dt>Bait</dt><dd>Basic Bait (unlimited)</dd></div>
            <div><dt>Rod</dt><dd>{rods.length > 0 ? 'Best owned rod' : 'No rod equipped'}</dd></div>
          </dl>
          <button
            className="primary-action"
            type="button"
            onClick={() => { void startFishing() }}
            disabled={fishing || loadState !== 'ready' || fishingService === null}
          >
            {fishing ? 'Fishing…' : 'Cast line'}
          </button>
        </section>
        {error ? <p className="persistence-error" role="alert">{error}</p> : null}
        {lastCatch ? (
          <section className="fishing-catch-card" aria-live="polite">
            <p className="screen-kicker">Catch received</p>
            <h3>{getInventoryItemDefinition(lastCatch.definitionId)?.name ?? lastCatch.definitionId}</h3>
            <p>
              {typeof lastCatch.metadata.rarity === 'string'
                ? `${lastCatch.metadata.rarity} · `
                : ''}
              Size {formatSizePercentile(lastCatch.metadata.sizePercentile)}
            </p>
          </section>
        ) : null}
        <section className="fishing-inventory" aria-labelledby="fishing-inventory-title">
          <div>
            <p className="screen-kicker">Owned items</p>
            <h3 id="fishing-inventory-title">Inventory</h3>
          </div>
          {loadState === 'loading'
            ? <p className="fishing-muted">Loading inventory…</p>
            : <InventoryList items={items} />}
        </section>
      </div>
    </section>
  )
}
