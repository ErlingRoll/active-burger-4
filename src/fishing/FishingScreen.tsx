import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  FishingAttemptPreparation,
  FishingAttemptResult,
  FishingAnglerPresence,
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
import { PaginatedInventoryGrid } from '../inventory/PaginatedInventoryGrid'
import { RARITY_VISUALS, type Rarity } from '../content/rarity/Rarity'

interface FishingScreenProps {
  fishingService: FishingService | null
  inventoryService: InventoryService | null
  configurationError: string | null
  activityPlayerId: string
  activityPlayerName: string
}

function createAttemptId(): string {
  return crypto.randomUUID()
}

function formatSizePercentile(value: unknown): string {
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : 'Unknown'
}

type FishingPhase = 'idle' | 'casting' | 'waiting' | 'manual' | 'catching'
type RemoteAnglerPhase = 'idle' | 'casting' | 'waiting' | 'catching'

interface RemoteAngler {
  playerId: string
  playerName: string
  phase: RemoteAnglerPhase
  eventId: string
  catch: {
    definitionId: string
    rarity: Rarity
  } | null
}

interface FishingActivityNotice {
  eventId: string
  message: string
}

interface FishingCatchNotice {
  eventId: string
  definitionId: string
  metadata: Record<string, unknown>
  isDismissing: boolean
}

function getInventoryItemIcon(item: InventoryItemInstance): string {
  const category = getInventoryItemDefinition(item.definitionId)?.category
  return getFishDefinition(item.definitionId)?.visual.icon ??
    ({
      fish: '🐟',
      bait: '◉',
      rod: '🎣',
      'loot-box': '▣',
      artifact: '◇',
      material: '◆',
      utility: '✦',
    }[category ?? 'utility'] ?? '✦')
}

function getInventoryItemDetail(item: InventoryItemInstance): string {
  const definition = getInventoryItemDefinition(item.definitionId)
  if (definition?.unlimited) {
    return 'Unlimited'
  }
  if (typeof item.metadata.rarity === 'string') {
    return item.metadata.rarity
  }
  return definition?.category.replace('-', ' ') ?? 'item'
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
const CATCH_NOTICE_DURATION_MS = 5000
const REMOTE_CATCH_DISPLAY_DURATION_MS = 2400
const ACTIVE_ANGLER_RECONCILIATION_INTERVAL_MS = 2000

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

function reconcileRemoteAnglers(
  currentAnglers: RemoteAngler[],
  presentAnglers: FishingAnglerPresence[],
  activityPlayerId: string,
  removeAbsentAnglers = true,
): RemoteAngler[] {
  const reconciledAnglers = presentAnglers
    .filter((angler) => angler.playerId !== activityPlayerId)
    .map((angler) => {
      const existing = currentAnglers.find((remoteAngler) => remoteAngler.playerId === angler.playerId)
      if (existing && existing.phase !== 'idle' && angler.phase !== 'idle') {
        return existing
      }
      return {
        playerId: angler.playerId,
        playerName: angler.playerName,
        phase: angler.phase,
        eventId: `${angler.attemptId}:presence`,
        catch: angler.phase === 'catching' && angler.fishDefinitionId && angler.rarity
          ? { definitionId: angler.fishDefinitionId, rarity: angler.rarity }
          : null,
      }
    })
  if (removeAbsentAnglers) {
    return reconciledAnglers
  }
  const reconciledPlayerIds = new Set(reconciledAnglers.map((angler) => angler.playerId))
  return [
    ...currentAnglers.filter((angler) => !reconciledPlayerIds.has(angler.playerId)),
    ...reconciledAnglers,
  ]
}

function PondAnglerSprite({ showCastLine = false }: { showCastLine?: boolean }) {
  return (
    <>
      <span className="pond-angler-halo" />
      <span className="pond-angler-chair" />
      <span className="pond-angler-body" />
      <span className="pond-angler-head" />
      <span className="pond-angler-hat">✦</span>
      <i className="pond-fishing-rod">
        {showCastLine ? <i className="pond-cast-line" aria-hidden="true" /> : null}
      </i>
    </>
  )
}

export function FishingScreen({
  fishingService,
  inventoryService,
  configurationError,
  activityPlayerId,
  activityPlayerName,
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
  const [isInventoryOpen, setIsInventoryOpen] = useState(false)
  const [lastCatch, setLastCatch] = useState<FishingCatchNotice | null>(null)
  const [remoteAnglers, setRemoteAnglers] = useState<RemoteAngler[]>([])
  const [activityNotice, setActivityNotice] = useState<FishingActivityNotice | null>(null)
  const [activityError, setActivityError] = useState<string | null>(null)
  const phaseRef = useRef<FishingPhase>('idle')
  const pendingAttemptRef = useRef<FishingAttemptPreparation | null>(null)
  const pityTimerRef = useRef<number | null>(null)
  const remoteAnimationTimersRef = useRef(new Map<string, number>())
  const activityNoticeTimerRef = useRef<number | null>(null)
  const catchNoticeTimerRef = useRef<number | null>(null)
  const presenceClearTimerRef = useRef<number | null>(null)
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
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearTimer(pityTimerRef)
      clearTimerMap(remoteAnimationTimersRef)
      clearTimer(activityNoticeTimerRef)
      clearTimer(catchNoticeTimerRef)
      clearTimer(presenceClearTimerRef)
    }
  }, [])

  useEffect(() => {
    if (!lastCatch) {
      return
    }
    const { eventId } = lastCatch
    catchNoticeTimerRef.current = window.setTimeout(() => {
      catchNoticeTimerRef.current = null
      if (!mountedRef.current) {
        return
      }
      setLastCatch((current) =>
        current?.eventId === eventId ? { ...current, isDismissing: true } : current)
    }, CATCH_NOTICE_DURATION_MS)
    return () => {
      clearTimer(catchNoticeTimerRef)
    }
  }, [lastCatch?.eventId])

  useEffect(() => {
    if (!fishingService) {
      return
    }
    const unsubscribe = fishingService.subscribeToActivity(
      (event) => {
        if (event.playerId === activityPlayerId) {
          return
        }
        const phase: RemoteAnglerPhase = event.kind === 'cast' ? 'casting' : 'catching'
        const catchInfo = event.kind === 'catch' && event.fishDefinitionId && event.rarity
          ? { definitionId: event.fishDefinitionId, rarity: event.rarity }
          : null
        setRemoteAnglers((current) => [
          ...current.filter((angler) => angler.playerId !== event.playerId),
          {
            playerId: event.playerId,
            playerName: event.playerName,
            phase,
            eventId: event.eventId,
            catch: catchInfo,
          },
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
              ? { ...angler, phase: event.kind === 'cast' ? 'waiting' : 'idle', catch: null }
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
      (presentAnglers) => {
        if (!mountedRef.current) {
          return
        }
        setRemoteAnglers((current) =>
          reconcileRemoteAnglers(current, presentAnglers, activityPlayerId))
      },
    )
    void fishingService.trackAngler({
      attemptId: `pond:${activityPlayerId}`,
      playerId: activityPlayerId,
      playerName: activityPlayerName,
      phase: 'idle',
    }).catch((activityTrackError: unknown) => {
      if (mountedRef.current) {
        setActivityError(activityTrackError instanceof Error
          ? activityTrackError.message
          : 'Shared pond activity is unavailable.')
      }
    })
    return unsubscribe
  }, [activityPlayerId, activityPlayerName, fishingService])

  useEffect(() => {
    if (!fishingService) {
      return
    }
    let cancelled = false
    const reconcileActiveAnglers = (): void => {
      void fishingService.loadActiveAnglers()
        .then((activeAnglers) => {
          if (!cancelled) {
            setRemoteAnglers((current) =>
              reconcileRemoteAnglers(current, activeAnglers, activityPlayerId, false))
          }
        })
        .catch((activityLoadError: unknown) => {
          if (!cancelled) {
            setActivityError(activityLoadError instanceof Error
              ? activityLoadError.message
              : 'Unable to load active fishers.')
          }
        })
    }
    reconcileActiveAnglers()
    const interval = window.setInterval(
      reconcileActiveAnglers,
      ACTIVE_ANGLER_RECONCILIATION_INTERVAL_MS,
    )
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
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
        eventId: attemptId,
        definitionId: result.definitionId,
        metadata: result.metadata,
        isDismissing: false,
      })
      void fishingService.trackAngler({
        attemptId,
        playerId: activityPlayerId,
        playerName: activityPlayerName,
        phase: 'catching',
        fishDefinitionId: result.definitionId,
        rarity: result.metadata.rarity,
      }).catch((activityBroadcastError: unknown) => {
        if (mountedRef.current) {
          setActivityError(activityBroadcastError instanceof Error
            ? activityBroadcastError.message
            : 'Shared pond activity is unavailable.')
        }
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
      presenceClearTimerRef.current = window.setTimeout(() => {
        presenceClearTimerRef.current = null
        if (pendingAttemptRef.current !== null) {
          return
        }
        void fishingService.trackAngler({
          attemptId: `pond:${activityPlayerId}`,
          playerId: activityPlayerId,
          playerName: activityPlayerName,
          phase: 'idle',
        }).catch((activityBroadcastError: unknown) => {
          if (mountedRef.current) {
            setActivityError(activityBroadcastError instanceof Error
              ? activityBroadcastError.message
              : 'Shared pond activity is unavailable.')
          }
        })
      }, REMOTE_CATCH_DISPLAY_DURATION_MS - 700)
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
      void fishingService.trackAngler({
        attemptId: preparation.attemptId,
        playerId: activityPlayerId,
        playerName: activityPlayerName,
        phase: 'waiting',
      }).catch((activityBroadcastError: unknown) => {
        if (mountedRef.current) {
          setActivityError(activityBroadcastError instanceof Error
            ? activityBroadcastError.message
            : 'Shared pond activity is unavailable.')
        }
      })
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
            <div className="pond-angler pond-angler-you pond-angler-facing-right">
              <PondAnglerSprite showCastLine />
              <strong>{activityPlayerName}</strong>
            </div>
            {remoteAnglers.map((angler) => {
              const position = getPondPerimeterPosition(angler.playerId)
              const caughtFish = angler.catch ? getFishDefinition(angler.catch.definitionId) : undefined
              const catchRarityVisual = angler.catch ? RARITY_VISUALS[angler.catch.rarity] : undefined
              return (
                <div
                  className={`pond-angler pond-angler-remote remote-angler-${angler.phase} ${
                    position.left > 50 ? 'pond-angler-facing-left' : 'pond-angler-facing-right'
                  }`}
                  key={angler.playerId}
                  style={{ left: `${position.left}%`, top: `${position.top}%` }}
                  aria-label={`${angler.playerName} is ${
                    angler.phase === 'catching'
                      ? 'landing a fish'
                      : angler.phase === 'idle'
                        ? 'at the pond'
                        : 'fishing'
                  }`}
                >
                  <PondAnglerSprite />
                  <strong>{angler.playerName}</strong>
                  {angler.phase === 'catching' && catchRarityVisual ? (
                    <span
                      className="pond-remote-catch-display"
                      style={{
                        color: catchRarityVisual.color,
                        borderColor: catchRarityVisual.color,
                        boxShadow: `0 0 0.45rem ${catchRarityVisual.color}, 0 0 1.35rem ${catchRarityVisual.color}`,
                      }}
                      title={caughtFish?.name ?? 'Fish caught'}
                    >
                      {caughtFish?.visual.icon ?? '🐟'}
                    </span>
                  ) : null}
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
                <button
                  className="primary-action fishing-inventory-toggle"
                  type="button"
                  aria-controls="fishing-inventory"
                  aria-expanded={isInventoryOpen}
                  onClick={() => setIsInventoryOpen((current) => !current)}
                >
                  <span aria-hidden="true">▣</span>
                  {isInventoryOpen ? 'Close inventory' : 'Inventory'}
                </button>
              </div>
            </div>
            {activityNotice ? (
              <p className="fishing-activity-notice" role="status" aria-live="polite">
                <span aria-hidden="true">◉</span> {activityNotice.message}
              </p>
            ) : null}
            {activityError ? <p className="fishing-activity-error" role="status">{activityError}</p> : null}
            {isInventoryOpen ? (
              <section
                className="fishing-inventory fishing-inventory-drawer"
                id="fishing-inventory"
                aria-labelledby="fishing-inventory-title"
              >
                <div className="fishing-inventory-header">
                  <div>
                    <p className="screen-kicker">Equipment and catches</p>
                    <h3 id="fishing-inventory-title">Inventory</h3>
                  </div>
                  <button
                    className="secondary-action fishing-inventory-close"
                    type="button"
                    onClick={() => setIsInventoryOpen(false)}
                  >
                    Close
                  </button>
                </div>
                {loadState === 'loading' ? (
                  <p role="status">Loading inventory…</p>
                ) : items.length === 0 ? (
                  <p className="fishing-muted">No items yet. Cast a line to get started.</p>
                ) : (
                  <PaginatedInventoryGrid
                    items={items}
                    label="Fishing inventory"
                    getItemIcon={getInventoryItemIcon}
                    getItemDetail={getInventoryItemDetail}
                  />
                )}
              </section>
            ) : null}
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
                className={`fishing-catch-card${
                  lastCatch.isDismissing ? ' fishing-catch-card-dismissing' : ''
                }`}
                aria-live="polite"
                onAnimationEnd={(event) => {
                  if (event.animationName !== 'fishing-catch-dismiss') {
                    return
                  }
                  setLastCatch((current) =>
                    current?.eventId === lastCatch.eventId ? null : current)
                }}
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
