import { useEffect, useMemo, useState } from 'react'
import type { FishingService } from './FishingService'
import {
  DEFAULT_FISHING_BAIT_ID,
  DEFAULT_FISHING_SPOT_ID,
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

type FishingPhase = 'idle' | 'casting' | 'waiting' | 'catching'

const FISHING_PHASE_LABELS: Record<FishingPhase, string> = {
  idle: 'Ready to cast',
  casting: 'Casting line…',
  waiting: 'Watching the float…',
  catching: 'Catch on the line!',
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds)
  })
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
  const [fishingPhase, setFishingPhase] = useState<FishingPhase>('idle')
  const [selectedRodId, setSelectedRodId] = useState<string | null>(null)
  const [lastCatch, setLastCatch] = useState<{
    definitionId: string
    metadata: Record<string, unknown>
  } | null>(null)

  const rods = useMemo(
    () => items.filter((item) => getInventoryItemDefinition(item.definitionId)?.category === 'rod'),
    [items],
  )
  const selectedRod = selectedRodId
    ? rods.find((rod) => rod.itemInstanceId === selectedRodId)
    : undefined
  const fishCount = items.filter((item) => getInventoryItemDefinition(item.definitionId)?.category === 'fish').length
  const boxCount = items
    .filter((item) => getInventoryItemDefinition(item.definitionId)?.category === 'loot-box')
    .reduce((total, item) => total + item.quantity, 0)

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
    if (!fishingService || !inventoryService || fishingPhase !== 'idle') {
      return
    }
    setFishingPhase('casting')
    setError(null)
    try {
      await delay(400)
      setFishingPhase('waiting')
      await delay(800)
      const result = await fishingService.startAttempt({
        attemptId: createAttemptId(),
        spotId: DEFAULT_FISHING_SPOT_ID,
        baitDefinitionId: DEFAULT_FISHING_BAIT_ID,
        rodInstanceId: selectedRod?.itemInstanceId ?? null,
      })
      setFishingPhase('catching')
      setLastCatch({
        definitionId: result.definitionId,
        metadata: result.metadata,
      })
      setItems(await inventoryService.loadInventory())
      await delay(700)
    } catch (fishingError: unknown) {
      setError(fishingError instanceof Error ? fishingError.message : 'Unable to complete fishing attempt.')
    } finally {
      setFishingPhase('idle')
    }
  }

  return (
    <section className="dashboard fishing-screen" aria-labelledby="fishing-title">
      <div className="dashboard-panel fishing-panel">
        <section
          className={`fishing-pond-scene fishing-phase-${fishingPhase}`}
          aria-labelledby="fishing-pond-title"
        >
          <div className="pond-world" aria-hidden="true">
            <div className="pond-glow pond-glow-one" />
            <div className="pond-glow pond-glow-two" />
            <div className="pond-water">
              {Array.from({ length: 9 }, (_, index) => (
                <span className={`pond-fish pond-fish-${index + 1}`} key={index}>
                  <span className="pond-fish-body" />
                  <span className="pond-fish-tail" />
                </span>
              ))}
              <span className="pond-ripple pond-ripple-one" />
              <span className="pond-ripple pond-ripple-two" />
              <span className="pond-ripple pond-ripple-three" />
            </div>
            <div className="pond-shore pond-shore-top" />
            <div className="pond-shore pond-shore-bottom" />
            <div className="pond-angler pond-angler-you">
              <span className="pond-angler-chair" />
              <span className="pond-angler-body" />
              <span className="pond-angler-hat">▲</span>
              <strong>You</strong>
              <i className="pond-fishing-rod" />
            </div>
            {['Mira', 'Kato', 'Nell', 'Rin', 'Odo'].map((name, index) => (
              <div className={`pond-angler pond-angler-${index + 1}`} key={name}>
                <span className="pond-angler-chair" />
                <span className="pond-angler-body" />
                <span className="pond-angler-hat">▲</span>
                <strong>{name}</strong>
                <i className="pond-fishing-rod" />
              </div>
            ))}
            <div className="pond-lantern pond-lantern-one">✦</div>
            <div className="pond-lantern pond-lantern-two">✦</div>
          </div>
          <div className="fishing-hud">
            <div className="fishing-hud-topbar">
              <div className="pond-scene-header">
                <div>
                  <p className="screen-kicker">Downtime activity · Quiet River Bank</p>
                  <h2 id="fishing-title">Fishing · <span id="fishing-pond-title">Moonwater Pond</span></h2>
                </div>
                <span className="pond-scene-status">{FISHING_PHASE_LABELS[fishingPhase]}</span>
              </div>
              <button className="secondary-action" type="button" onClick={onBack}>Back to dashboard</button>
            </div>
            <p className="fishing-hud-description">Catch fish for future run meals, Champion recovery, and collection goals.</p>
            <div className="fishing-hud-bottom">
              <section className="fishing-inventory-summary" aria-label="Fishing inventory summary">
                <span><strong>{fishCount}</strong> fish available</span>
                <span><strong>{rods.length}</strong> rods owned</span>
                <span><strong>{boxCount}</strong> unopened boxes</span>
              </section>
              <div className="pond-scene-actions">
                <label className="pond-loadout-control">
                  <span>Rod</span>
                  <select
                    value={selectedRodId ?? ''}
                    onChange={(event) => setSelectedRodId(event.target.value || null)}
                    disabled={fishingPhase !== 'idle'}
                  >
                    <option value="">No rod</option>
                    {rods.map((rod) => (
                      <option value={rod.itemInstanceId} key={rod.itemInstanceId}>
                        {getInventoryItemDefinition(rod.definitionId)?.name ?? rod.definitionId}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="pond-bait-status">Basic bait is unlimited</span>
                <button
                  className="primary-action pond-cast-button"
                  type="button"
                  onClick={() => { void startFishing() }}
                  disabled={fishingPhase !== 'idle' || loadState !== 'ready' || fishingService === null}
                >
                  {FISHING_PHASE_LABELS[fishingPhase]}
                </button>
              </div>
            </div>
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
          </div>
        </section>
      </div>
    </section>
  )
}
