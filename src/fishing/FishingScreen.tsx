import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  FishingAttemptPreparation,
  FishingService,
} from './FishingService'
import {
  DEFAULT_FISHING_BAIT_ID,
  FISHING_BAITS,
  FISHING_MODES,
  isFishingMode,
  type FishingMode,
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

type FishingPhase = 'idle' | 'casting' | 'waiting' | 'manual' | 'catching'

const FISHING_PHASE_LABELS: Record<FishingPhase, string> = {
  idle: 'Ready to cast',
  casting: 'Casting line…',
  waiting: 'Watching the float…',
  manual: 'Reel in now',
  catching: 'Catch on the line!',
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds)
  })
}

async function waitUntil(timestamp: string): Promise<void> {
  await delay(Math.max(0, Date.parse(timestamp) - Date.now()))
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
  const [selectedMode, setSelectedMode] = useState<FishingMode>('auto')
  const [selectedBaitId, setSelectedBaitId] = useState(DEFAULT_FISHING_BAIT_ID)
  const [selectedRodId, setSelectedRodId] = useState<string | null>(null)
  const [pendingAttempt, setPendingAttempt] = useState<FishingAttemptPreparation | null>(null)
  const [lastCatch, setLastCatch] = useState<{
    definitionId: string
    metadata: Record<string, unknown>
  } | null>(null)
  const phaseRef = useRef<FishingPhase>('idle')
  const pendingAttemptRef = useRef<FishingAttemptPreparation | null>(null)
  const pityTimerRef = useRef<number | null>(null)
  const mountedRef = useRef(true)

  const setPhase = (phase: FishingPhase) => {
    phaseRef.current = phase
    if (mountedRef.current) {
      setFishingPhase(phase)
    }
  }

  const rods = useMemo(
    () => items.filter((item) => getInventoryItemDefinition(item.definitionId)?.category === 'rod'),
    [items],
  )
  const baits = useMemo(
    () => items.filter((item) =>
      getInventoryItemDefinition(item.definitionId)?.category === 'bait' &&
      item.definitionId !== DEFAULT_FISHING_BAIT_ID,
    ),
    [items],
  )
  const effectiveSelectedBaitId = selectedBaitId === DEFAULT_FISHING_BAIT_ID ||
    baits.some((bait) => bait.itemInstanceId === selectedBaitId)
    ? selectedBaitId
    : DEFAULT_FISHING_BAIT_ID
  const selectedBait = baits.find((bait) => bait.itemInstanceId === effectiveSelectedBaitId)
  const effectiveSelectedRodId = selectedRodId &&
    rods.some((rod) => rod.itemInstanceId === selectedRodId)
    ? selectedRodId
    : null
  const selectedRod = effectiveSelectedRodId
    ? rods.find((rod) => rod.itemInstanceId === effectiveSelectedRodId)
    : undefined
  const fishCount = items.filter((item) => getInventoryItemDefinition(item.definitionId)?.category === 'fish').length
  const boxCount = items
    .filter((item) => getInventoryItemDefinition(item.definitionId)?.category === 'loot-box')
    .reduce((total, item) => total + item.quantity, 0)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (pityTimerRef.current !== null) {
        window.clearTimeout(pityTimerRef.current)
      }
    }
  }, [])

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

  const resolveFishingAttempt = async (
    attemptId: string,
    manualSuccess: boolean,
    preparation = pendingAttempt,
  ): Promise<void> => {
    if (!fishingService || !inventoryService || !preparation ||
      preparation.attemptId !== attemptId ||
      pendingAttemptRef.current?.attemptId !== attemptId ||
      (phaseRef.current !== 'waiting' && phaseRef.current !== 'manual')) {
      return
    }
    if (pityTimerRef.current !== null) {
      window.clearTimeout(pityTimerRef.current)
      pityTimerRef.current = null
    }
    setPhase('catching')
    try {
      const result = await fishingService.resolveAttempt({
        attemptId,
        manualSuccess,
      })
      if (!mountedRef.current) {
        return
      }
      setLastCatch({
        definitionId: result.definitionId,
        metadata: result.metadata,
      })
      const loadedItems = await inventoryService.loadInventory()
      if (!mountedRef.current) {
        return
      }
      setItems(loadedItems)
      await delay(700)
    } catch (fishingError: unknown) {
      if (mountedRef.current) {
        setError(fishingError instanceof Error ? fishingError.message : 'Unable to complete fishing attempt.')
      }
    } finally {
      if (pendingAttemptRef.current?.attemptId === attemptId) {
        pendingAttemptRef.current = null
        if (mountedRef.current) {
          setPendingAttempt(null)
          setPhase('idle')
        }
      }
    }
  }

  const startFishing = async (): Promise<void> => {
    if (!fishingService || !inventoryService || fishingPhase !== 'idle') {
      return
    }
    setPhase('casting')
    setError(null)
    try {
      await delay(400)
      if (!mountedRef.current) {
        return
      }
      const preparation = await fishingService.beginAttempt({
        attemptId: createAttemptId(),
        mode: selectedMode,
        baitDefinitionId: selectedBait?.definitionId ?? DEFAULT_FISHING_BAIT_ID,
        baitInstanceId: selectedBait?.itemInstanceId ?? null,
        rodInstanceId: selectedRod?.itemInstanceId ?? null,
      })
      if (!mountedRef.current) {
        return
      }
      pendingAttemptRef.current = preparation
      setPendingAttempt(preparation)
      setPhase('waiting')
      await waitUntil(preparation.resolveAt)
      if (!mountedRef.current || pendingAttemptRef.current?.attemptId !== preparation.attemptId) {
        return
      }
      if (preparation.mode === 'manual') {
        setPhase('manual')
        pityTimerRef.current = window.setTimeout(() => {
          void resolveFishingAttempt(preparation.attemptId, false, preparation)
        }, Math.max(0, Date.parse(preparation.pityAt) - Date.now()))
      } else {
        await resolveFishingAttempt(preparation.attemptId, false, preparation)
      }
    } catch (fishingError: unknown) {
      if (mountedRef.current) {
        setError(fishingError instanceof Error ? fishingError.message : 'Unable to complete fishing attempt.')
        pendingAttemptRef.current = null
        setPendingAttempt(null)
        setPhase('idle')
      }
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
                  <p className="screen-kicker">Downtime activity · Moonwater Pond</p>
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
                  <span>Mode</span>
                  <select
                    value={selectedMode}
                    onChange={(event) => {
                      if (isFishingMode(event.target.value)) {
                        setSelectedMode(event.target.value)
                      }
                    }}
                    disabled={fishingPhase !== 'idle'}
                  >
                    {Object.values(FISHING_MODES).map((mode) => (
                      <option value={mode.id} key={mode.id}>{mode.name}</option>
                    ))}
                  </select>
                </label>
                <label className="pond-loadout-control">
                  <span>Bait</span>
                  <select
                    value={effectiveSelectedBaitId}
                    onChange={(event) => setSelectedBaitId(event.target.value)}
                    disabled={fishingPhase !== 'idle'}
                  >
                    <option value={DEFAULT_FISHING_BAIT_ID}>
                      {FISHING_BAITS[DEFAULT_FISHING_BAIT_ID].name} · unlimited
                    </option>
                    {baits.map((bait) => (
                      <option value={bait.itemInstanceId} key={bait.itemInstanceId}>
                        {getInventoryItemDefinition(bait.definitionId)?.name ?? bait.definitionId} · {bait.quantity}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="pond-loadout-control">
                  <span>Rod</span>
                  <select
                    value={effectiveSelectedRodId ?? ''}
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
                <span className="pond-bait-status">
                  {selectedMode === 'manual'
                    ? FISHING_MODES.manual.description
                    : FISHING_MODES.auto.description}
                </span>
                <button
                  className="primary-action pond-cast-button"
                  type="button"
                  onClick={() => {
                    if (fishingPhase === 'manual' && pendingAttempt) {
                      void resolveFishingAttempt(pendingAttempt.attemptId, true)
                    } else {
                      void startFishing()
                    }
                  }}
                  disabled={
                    (fishingPhase !== 'idle' && fishingPhase !== 'manual') ||
                    loadState !== 'ready' ||
                    fishingService === null
                  }
                >
                  {fishingPhase === 'manual' ? 'Reel in' : FISHING_PHASE_LABELS[fishingPhase]}
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
