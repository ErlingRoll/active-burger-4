import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  FishingAttemptPreparation,
  FishingAttemptResult,
  FishingService,
} from './FishingService'
import {
  DEFAULT_FISHING_BAIT_ID,
  FISHING_BAITS,
  getFishDefinition,
  FISHING_MODES,
  isFishingMode,
  type FishingMode,
} from './FishingContent'
import type { InventoryItemInstance, InventoryService } from '../inventory'
import { getInventoryItemDefinition } from '../inventory'
import { getCharacterClassDefinition, type CharacterClassId } from '../content/classes/CharacterClasses'

interface FishingScreenProps {
  fishingService: FishingService | null
  inventoryService: InventoryService | null
  configurationError: string | null
  activityPlayerId: string
  activityPlayerName: string
  characterClassId: CharacterClassId
  onBack: () => void
  onOpenInventory: () => void
}

function createAttemptId(): string {
  return crypto.randomUUID()
}

function formatSizePercentile(value: unknown): string {
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : 'Unknown'
}

type FishingPhase = 'idle' | 'casting' | 'waiting' | 'manual' | 'catching'
type RemoteAnglerPhase = 'casting' | 'waiting' | 'catching'

interface RemoteAngler {
  playerId: string
  playerName: string
  phase: RemoteAnglerPhase
  eventId: string
}

interface FishingActivityNotice {
  eventId: string
  message: string
}

const FISHING_PHASE_LABELS: Record<FishingPhase, string> = {
  idle: 'Ready to cast',
  casting: 'Casting line…',
  waiting: 'Watching the float…',
  manual: 'Reel in now',
  catching: 'Catch on the line!',
}

const SERVER_TIME_SAFETY_BUFFER_MS = 750
const NOT_READY_RETRY_DELAY_MS = 500
const MAX_NOT_READY_RETRIES = 90

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds)
  })
}

function clearTimer(timerRef: { current: number | null }): void {
  if (timerRef.current !== null) {
    window.clearTimeout(timerRef.current)
    timerRef.current = null
  }
}

function clearTimerMap(timerRef: { current: Map<string, number> }): void {
  for (const timer of timerRef.current.values()) {
    window.clearTimeout(timer)
  }
  timerRef.current.clear()
}

function getPondPerimeterPosition(playerId: string): { left: number; top: number } {
  let hash = 2166136261
  for (const character of playerId) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  const angle = ((hash >>> 0) % 360) * (Math.PI / 180)
  return {
    left: 50 + Math.cos(angle) * 38,
    top: 45 + Math.sin(angle) * 28,
  }
}

async function waitUntil(timestamp: number, safetyBufferMs = 0): Promise<void> {
  await delay(Math.max(0, timestamp - Date.now() + safetyBufferMs))
}

function isNotReadyError(error: unknown): boolean {
  if (error instanceof Error) {
    return /not ready to resolve/i.test(error.message)
  }
  if (typeof error !== 'object' || error === null) {
    return false
  }
  const message = (error as { message?: unknown }).message
  return typeof message === 'string' && /not ready to resolve/i.test(message)
}

export function FishingScreen({
  fishingService,
  inventoryService,
  configurationError,
  activityPlayerId,
  activityPlayerName,
  characterClassId,
  onBack,
  onOpenInventory,
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
  const [remoteAnglers, setRemoteAnglers] = useState<RemoteAngler[]>([])
  const [activityNotice, setActivityNotice] = useState<FishingActivityNotice | null>(null)
  const [activityError, setActivityError] = useState<string | null>(null)
  const phaseRef = useRef<FishingPhase>('idle')
  const pendingAttemptRef = useRef<FishingAttemptPreparation | null>(null)
  const pityTimerRef = useRef<number | null>(null)
  const remoteAnimationTimersRef = useRef(new Map<string, number>())
  const activityNoticeTimerRef = useRef<number | null>(null)
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
  const characterClass = getCharacterClassDefinition(characterClassId)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearTimer(pityTimerRef)
      clearTimerMap(remoteAnimationTimersRef)
      clearTimer(activityNoticeTimerRef)
    }
  }, [])

  useEffect(() => {
    if (!fishingService) {
      return
    }
    return fishingService.subscribeToActivity(
      (event) => {
        if (event.playerId === activityPlayerId) {
          return
        }
        const phase: RemoteAnglerPhase = event.kind === 'cast' ? 'casting' : 'catching'
        setRemoteAnglers((current) => [
          ...current.filter((angler) => angler.playerId !== event.playerId),
          { playerId: event.playerId, playerName: event.playerName, phase, eventId: event.eventId },
        ])
        const message = event.kind === 'cast'
          ? `${event.playerName} cast a line.`
          : `${event.playerName} caught a ${getInventoryItemDefinition(event.fishDefinitionId ?? '')?.name ?? 'fish'} (${event.rarity ?? 'common'}).`
        setActivityNotice({ eventId: event.eventId, message })
        if (activityNoticeTimerRef.current !== null) {
          window.clearTimeout(activityNoticeTimerRef.current)
        }
        activityNoticeTimerRef.current = window.setTimeout(() => {
          activityNoticeTimerRef.current = null
          if (!mountedRef.current) {
            return
          }
          setActivityNotice((current) => current?.eventId === event.eventId ? null : current)
        }, 5000)
        const previousTimer = remoteAnimationTimersRef.current.get(event.playerId)
        if (previousTimer !== undefined) {
          window.clearTimeout(previousTimer)
        }
        const timer = window.setTimeout(() => {
          remoteAnimationTimersRef.current.delete(event.playerId)
          if (!mountedRef.current) {
            return
          }
          setRemoteAnglers((current) => current.map((angler) =>
            angler.playerId === event.playerId && angler.eventId === event.eventId
              ? { ...angler, phase: 'waiting' }
              : angler,
          ))
        }, event.kind === 'cast' ? 1400 : 2400)
        remoteAnimationTimersRef.current.set(event.playerId, timer)
      },
      (activitySubscriptionError) => {
        if (mountedRef.current) {
          setActivityError(activitySubscriptionError.message)
        }
      },
    )
  }, [activityPlayerId, fishingService])

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
      await waitUntil(preparation.resolveAtClientTime, SERVER_TIME_SAFETY_BUFFER_MS)
      if (!mountedRef.current || pendingAttemptRef.current?.attemptId !== attemptId) {
        return
      }
      let result: FishingAttemptResult
      for (let retry = 0; ; retry += 1) {
        try {
          result = await fishingService.resolveAttempt({
            attemptId,
            manualSuccess,
          })
          break
        } catch (resolveError: unknown) {
          if (!isNotReadyError(resolveError) || retry >= MAX_NOT_READY_RETRIES) {
            throw resolveError
          }
          await delay(Math.max(
            NOT_READY_RETRY_DELAY_MS,
            preparation.resolveAtClientTime - Date.now() + SERVER_TIME_SAFETY_BUFFER_MS,
          ))
        }
      }
      if (!mountedRef.current) {
        return
      }
      setLastCatch({
        definitionId: result.definitionId,
        metadata: result.metadata,
      })
      void fishingService.publishActivity({
        eventId: `${attemptId}:catch`,
        attemptId,
        playerId: activityPlayerId,
        playerName: activityPlayerName,
        kind: 'catch',
        fishDefinitionId: result.definitionId,
        rarity: result.metadata.rarity,
        occurredAt: new Date().toISOString(),
      }).catch((activityBroadcastError: unknown) => {
        if (mountedRef.current) {
          setActivityError(activityBroadcastError instanceof Error
            ? activityBroadcastError.message
            : 'Shared pond activity is unavailable.')
        }
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
      await delay(850)
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
      void fishingService.publishActivity({
        eventId: `${preparation.attemptId}:cast`,
        attemptId: preparation.attemptId,
        playerId: activityPlayerId,
        playerName: activityPlayerName,
        kind: 'cast',
        occurredAt: new Date().toISOString(),
      }).catch((activityBroadcastError: unknown) => {
        if (mountedRef.current) {
          setActivityError(activityBroadcastError instanceof Error
            ? activityBroadcastError.message
            : 'Shared pond activity is unavailable.')
        }
      })
      await waitUntil(preparation.resolveAtClientTime, SERVER_TIME_SAFETY_BUFFER_MS)
      if (!mountedRef.current || pendingAttemptRef.current?.attemptId !== preparation.attemptId) {
        return
      }
      if (preparation.mode === 'manual') {
        setPhase('manual')
        pityTimerRef.current = window.setTimeout(() => {
          void resolveFishingAttempt(preparation.attemptId, false, preparation)
        }, Math.max(
          0,
          preparation.pityAtClientTime - Date.now() + SERVER_TIME_SAFETY_BUFFER_MS,
        ))
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
              <span className="pond-angler-avatar" title={characterClass.name}>
                {characterClass.visual.icon}
              </span>
              <span className="pond-angler-hat">▲</span>
              <strong>You · {characterClass.name}</strong>
              <i className="pond-fishing-rod">
                <i className="pond-cast-line" aria-hidden="true" />
              </i>
            </div>
            {remoteAnglers.map((angler) => {
              const position = getPondPerimeterPosition(angler.playerId)
              return (
                <div
                  className={`pond-angler pond-angler-remote remote-angler-${angler.phase}`}
                  key={angler.playerId}
                  style={{ left: `${position.left}%`, top: `${position.top}%` }}
                  aria-label={`${angler.playerName} is ${angler.phase === 'catching' ? 'landing a fish' : 'fishing'}`}
                >
                  <span className="pond-angler-chair" />
                  <span className="pond-angler-body" />
                  <span className="pond-angler-hat">▲</span>
                  <strong>{angler.playerName}</strong>
                  <i className="pond-fishing-rod" />
                  {angler.phase === 'catching' ? <span className="pond-catch-burst" aria-hidden="true">✦</span> : null}
                </div>
              )
            })}
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
              <div className="fishing-topbar-actions">
                <button className="secondary-action" type="button" onClick={onOpenInventory}>Inventory</button>
                <button className="secondary-action" type="button" onClick={onBack}>Back to dashboard</button>
              </div>
            </div>
            {activityNotice ? (
              <p className="fishing-activity-notice" role="status" aria-live="polite">
                <span aria-hidden="true">◉</span> {activityNotice.message}
              </p>
            ) : null}
            {activityError ? <p className="fishing-activity-error" role="status">{activityError}</p> : null}
            <div className="fishing-hud-bottom">
              <div className="pond-scene-actions">
                <div className="pond-loadout-controls">
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
                </div>
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
                  {fishingPhase === 'manual'
                    ? 'Reel in'
                    : fishingPhase === 'idle'
                      ? 'Cast'
                      : FISHING_PHASE_LABELS[fishingPhase]}
                </button>
              </div>
            </div>
            {error ? <p className="persistence-error" role="alert">{error}</p> : null}
            {lastCatch ? (
              <section
                className="fishing-catch-card"
                aria-live="polite"
                style={{
                  borderColor: getFishDefinition(lastCatch.definitionId)?.visual.accent ?? '#fbbf24',
                  boxShadow: `0 0 26px ${getFishDefinition(lastCatch.definitionId)?.visual.glow ?? '#d97706'}66`,
                }}
              >
                <p className="screen-kicker">Catch received</p>
                <div className="fishing-catch-heading">
                  <span className="fishing-catch-icon" aria-hidden="true">
                    {getFishDefinition(lastCatch.definitionId)?.visual.icon ?? '🐟'}
                  </span>
                  <div>
                    <h3>{getInventoryItemDefinition(lastCatch.definitionId)?.name ?? lastCatch.definitionId}</h3>
                    <p className="fishing-catch-effect">
                      {getFishDefinition(lastCatch.definitionId)?.effect.description ?? 'A mysterious pond catch'}
                    </p>
                  </div>
                </div>
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
