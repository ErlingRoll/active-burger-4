import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  FishingAttemptPreparation,
  FishingAttemptResult,
  FishingAnglerPresence,
  FishingService,
} from './FishingService'
import {
  DEFAULT_FISHING_BAIT_ID,
  DEFAULT_FISHING_ROD,
  FISHING_BAITS,
  formatFishingEnchantment,
  getFishingEssenceValue,
  formatFishingFishDetail,
  formatFishingBaitEffect,
  formatFishingRodModifiers,
  formatFishSizeKg,
  getFishDefinition,
  FISHING_MODES,
  isFishingMode,
  type FishingMode,
} from './FishingContent'
import type { InventoryItemInstance, InventoryService } from '../inventory'
import { getInventoryItemDefinition } from '../inventory'
import { PaginatedInventoryGrid } from '../inventory/PaginatedInventoryGrid'
import { RARITY_VISUALS, type Rarity } from '../content/rarity/Rarity'
import { ConfirmationDialog } from '../ui/ConfirmationDialog'
import { useToaster } from '../ui/ToasterContext'
import { getPlayerDisplayName } from '../auth'
import { FishIcon } from './FishIcon'

interface FishingScreenProps {
  fishingService: FishingService | null
  inventoryService: InventoryService | null
  configurationError: string | null
  activityPlayerId: string
  activityPlayerApprovedNickname: string | null
  activityPlayerProviderName: string | null
}

function createAttemptId(): string {
  return crypto.randomUUID()
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

function getInventoryItemIcon(item: InventoryItemInstance): ReactNode {
  const category = getInventoryItemDefinition(item.definitionId)?.category
  const fish = getFishDefinition(item.definitionId)
  return fish ? <FishIcon icon={fish.visual.icon} color={fish.visual.accent} /> :
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
  const category = definition?.category
  if (definition?.unlimited) {
    return 'Unlimited'
  }
  if (category === 'fish') {
    return formatFishingFishDetail(item.definitionId, item.metadata)
  }
  if (typeof item.metadata.rarity === 'string') {
    if (category === 'rod') {
      return `${item.metadata.rarity} · ${formatFishingRodModifiers(item.metadata)}`
    }
    return item.metadata.rarity
  }
  if (category === 'bait') {
    return formatFishingBaitEffect(item.definitionId)
  }
  if (category === 'rod') {
    return formatFishingRodModifiers(item.metadata)
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
const REMOTE_CATCH_DISPLAY_DURATION_MS = 2400
const ACTIVE_ANGLER_RECONCILIATION_INTERVAL_MS = 2000
const REMOTE_ANGLER_PRESENCE_GRACE_MS = 5000

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

function getPondPlayerPosition(playerId: string): { left: number; top: number } {
  let hash = 2166136261
  for (const character of playerId) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  const angleRandom = (hash >>> 0) / 0x100000000
  const radiusRandom = (Math.imul(hash, 1597334677) >>> 0) / 0x100000000
  const angle = angleRandom * Math.PI * 2
  const radius = Math.sqrt(radiusRandom)
  return {
    // Keep the sprite and its label within the pond's visible inner area.
    left: 50 + Math.cos(angle) * 26 * radius,
    top: 45 + Math.sin(angle) * 21 * radius,
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
        playerName: getPlayerDisplayName({ providerDisplayName: angler.playerName }),
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

function reconcileRemoteAnglersWithPresenceGrace(
  currentAnglers: RemoteAngler[],
  presentAnglers: FishingAnglerPresence[],
  activityPlayerId: string,
  missingSince: Map<string, number>,
  now: number,
  protectedPlayerIds = new Set<string>(),
): RemoteAngler[] {
  const presentPlayerIds = new Set(
    presentAnglers
      .filter((angler) => angler.playerId !== activityPlayerId)
      .map((angler) => angler.playerId),
  )
  for (const playerId of presentPlayerIds) {
    missingSince.delete(playerId)
  }
  const reconciledAnglers = reconcileRemoteAnglers(
    currentAnglers,
    presentAnglers,
    activityPlayerId,
    false,
  )
  return reconciledAnglers.filter((angler) => {
    if (presentPlayerIds.has(angler.playerId) || protectedPlayerIds.has(angler.playerId)) {
      missingSince.delete(angler.playerId)
      return true
    }
    const absentSince = missingSince.get(angler.playerId) ?? now
    missingSince.set(angler.playerId, absentSince)
    if (now - absentSince < REMOTE_ANGLER_PRESENCE_GRACE_MS) {
      return true
    }
    missingSince.delete(angler.playerId)
    return false
  })
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
        {showCastLine ? (
          <svg
            className="pond-cast-line"
            viewBox="0 0 160 80"
            role="presentation"
            aria-hidden="true"
          >
            <path
              className="pond-cast-line-path"
              pathLength="1"
              d="M 1 40 C 38 40, 82 43, 112 50 C 131 54, 146 59, 158 64"
            />
            <circle className="pond-cast-lure" cx="158" cy="64" r="4" />
            <circle className="pond-cast-splash" cx="158" cy="64" r="7" />
          </svg>
        ) : null}
      </i>
    </>
  )
}

interface FishingDropdownOption {
  value: string
  label: string
}

interface FishingDropdownProps {
  icon: string
  label: string
  value: string
  options: readonly FishingDropdownOption[]
  disabled: boolean
  onChange: (value: string) => void
}

function FishingDropdown({
  icon,
  label,
  value,
  options,
  disabled,
  onChange,
}: FishingDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const selectedOption = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    if (!isOpen) {
      return
    }
    const closeOnOutsidePointer = (event: PointerEvent): void => {
      if (event.target instanceof Node && !dropdownRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen])

  useEffect(() => {
    if (disabled) {
      setIsOpen(false)
    }
  }, [disabled])

  return (
    <div className="pond-loadout-control fishing-dropdown" ref={dropdownRef}>
      <span><span aria-hidden="true">{icon}</span> {label}</span>
      <div className="fishing-dropdown-anchor">
        <button
          className="fishing-dropdown-trigger"
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          disabled={disabled}
          onClick={() => setIsOpen((current) => !current)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              setIsOpen(true)
            }
          }}
        >
          <span>{selectedOption?.label ?? 'Select an option'}</span>
          <span className="fishing-dropdown-chevron" aria-hidden="true">⌄</span>
        </button>
        {isOpen ? (
          <div className="fishing-dropdown-menu" role="listbox" aria-label={label}>
            {options.map((option) => (
              <button
                className={`fishing-dropdown-option${
                  option.value === value ? ' selected' : ''
                }`}
                type="button"
                role="option"
                aria-selected={option.value === value}
                key={option.value}
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function FishingScreen({
  fishingService,
  inventoryService,
  configurationError,
  activityPlayerId,
  activityPlayerApprovedNickname,
  activityPlayerProviderName,
}: FishingScreenProps) {
  const { showLootToast } = useToaster()
  const activityPlayerName = getPlayerDisplayName({
    approvedNickname: activityPlayerApprovedNickname,
    providerDisplayName: activityPlayerProviderName,
  })
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
  const [pendingSalvage, setPendingSalvage] = useState<InventoryItemInstance | null>(null)
  const [salvagingItemInstanceId, setSalvagingItemInstanceId] = useState<string | null>(null)
  const [remoteAnglers, setRemoteAnglers] = useState<RemoteAngler[]>([])
  const [activityNotice, setActivityNotice] = useState<FishingActivityNotice | null>(null)
  const [activityError, setActivityError] = useState<string | null>(null)
  const phaseRef = useRef<FishingPhase>('idle')
  const pendingAttemptRef = useRef<FishingAttemptPreparation | null>(null)
  const pityTimerRef = useRef<number | null>(null)
  const remoteAnimationTimersRef = useRef(new Map<string, number>())
  const activityNoticeTimerRef = useRef<number | null>(null)
  const presenceClearTimerRef = useRef<number | null>(null)
  const remoteAnglerMissingSinceRef = useRef(new Map<string, number>())
  const remoteAnglerPresenceRef = useRef<FishingAnglerPresence[] | null>(null)
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
  const activityPlayerPosition = getPondPlayerPosition(activityPlayerId)
  const trackActivityPresence = useCallback((presence: FishingAnglerPresence): void => {
    if (!fishingService) {
      return
    }
    void fishingService.trackAngler(presence)
      .then(() => {
        if (mountedRef.current) {
          setActivityError(null)
        }
      })
      .catch((activityTrackError: unknown) => {
        if (mountedRef.current) {
          setActivityError(activityTrackError instanceof Error
            ? activityTrackError.message
            : 'Shared pond activity is unavailable.')
        }
      })
  }, [fishingService])

  useEffect(() => {
    mountedRef.current = true
    const remoteAnglerMissingSince = remoteAnglerMissingSinceRef.current
    return () => {
      mountedRef.current = false
      clearTimer(pityTimerRef)
      clearTimerMap(remoteAnimationTimersRef)
      clearTimer(activityNoticeTimerRef)
      clearTimer(presenceClearTimerRef)
      remoteAnglerMissingSince.clear()
      remoteAnglerPresenceRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!fishingService) {
      return
    }
    const unsubscribe = fishingService.subscribeToActivity(
      (event) => {
        if (event.playerId === activityPlayerId) {
          return
        }
        remoteAnglerMissingSinceRef.current.delete(event.playerId)
        const phase: RemoteAnglerPhase = event.kind === 'cast' ? 'casting' : 'catching'
        const catchInfo = event.kind === 'catch' && event.fishDefinitionId && event.rarity
          ? { definitionId: event.fishDefinitionId, rarity: event.rarity }
          : null
        const playerName = getPlayerDisplayName({ providerDisplayName: event.playerName })
        setRemoteAnglers((current) => [
          ...current.filter((angler) => angler.playerId !== event.playerId),
          {
            playerId: event.playerId,
            playerName,
            phase,
            eventId: event.eventId,
            catch: catchInfo,
          },
        ])
        const message = event.kind === 'cast'
          ? `${playerName} cast a line.`
          : `${playerName} caught a ${getInventoryItemDefinition(event.fishDefinitionId ?? '')?.name ?? 'fish'} (${event.rarity ?? 'common'}).`
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
        remoteAnglerPresenceRef.current = presentAnglers
        setRemoteAnglers((current) =>
          reconcileRemoteAnglersWithPresenceGrace(
            current,
            presentAnglers,
            activityPlayerId,
            remoteAnglerMissingSinceRef.current,
            Date.now(),
          ))
      },
    )
    trackActivityPresence({
      attemptId: `pond:${activityPlayerId}`,
      playerId: activityPlayerId,
      playerName: activityPlayerName,
      phase: 'idle',
    })
    return unsubscribe
  }, [activityPlayerId, activityPlayerName, fishingService, trackActivityPresence])

  useEffect(() => {
    if (!fishingService) {
      return
    }
    let cancelled = false
    const reconcileActiveAnglers = (): void => {
      void fishingService.loadActiveAnglers()
        .then((activeAnglers) => {
          if (!cancelled) {
            const presenceSnapshot = remoteAnglerPresenceRef.current
            const activePlayerIds = new Set(activeAnglers.map((angler) => angler.playerId))
            setRemoteAnglers((current) => {
              const reconciledAnglers = reconcileRemoteAnglers(
                current,
                activeAnglers,
                activityPlayerId,
                false,
              )
              return presenceSnapshot
                ? reconcileRemoteAnglersWithPresenceGrace(
                    reconciledAnglers,
                    presenceSnapshot,
                    activityPlayerId,
                    remoteAnglerMissingSinceRef.current,
                    Date.now(),
                    activePlayerIds,
                  )
                : reconciledAnglers
            })
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
      const fishDefinition = getFishDefinition(result.definitionId)
      const fishName = getInventoryItemDefinition(result.definitionId)?.name ?? result.definitionId
      const enchantment = formatFishingEnchantment(result.metadata)
      showLootToast({
        title: 'Catch received',
        itemName: fishName,
        icon: fishDefinition ? (
          <FishIcon icon={fishDefinition.visual.icon} color={fishDefinition.visual.accent} />
        ) : '🐟',
        accentColor: fishDefinition?.visual.accent,
        glowColor: fishDefinition?.visual.glow,
        effect: fishDefinition?.effect.description ?? 'A mysterious pond catch',
        details: [
          `${RARITY_VISUALS[result.metadata.rarity].label} · Size ${formatFishSizeKg(
            result.metadata.sizePercentile,
            fishDefinition?.weightRangeKg,
          )}`,
          ...(enchantment ? [`Enchanted · ${enchantment}`] : []),
        ],
      })
      trackActivityPresence({
        attemptId,
        playerId: activityPlayerId,
        playerName: activityPlayerName,
        phase: 'catching',
        fishDefinitionId: result.definitionId,
        rarity: result.metadata.rarity,
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
        trackActivityPresence({
          attemptId: `pond:${activityPlayerId}`,
          playerId: activityPlayerId,
          playerName: activityPlayerName,
          phase: 'idle',
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

  const salvageFish = async (fish: InventoryItemInstance): Promise<void> => {
    if (!inventoryService || salvagingItemInstanceId) {
      return
    }
    const itemName = getInventoryItemDefinition(fish.definitionId)?.name ?? fish.definitionId
    setSalvagingItemInstanceId(fish.itemInstanceId)
    setError(null)
    try {
      const result = await inventoryService.salvageItem(
        crypto.randomUUID(),
        fish.itemInstanceId,
        1,
      )
      const fishDefinition = getFishDefinition(fish.definitionId)
      showLootToast({
        title: 'Fish salvaged',
        itemName,
        icon: fishDefinition ? (
          <FishIcon icon={fishDefinition.visual.icon} color={fishDefinition.visual.accent} />
        ) : '🐟',
        accentColor: fishDefinition?.visual.accent,
        glowColor: fishDefinition?.visual.glow,
        reward: `+${result.essenceAwarded} Essence`,
      })
      setItems(await inventoryService.loadInventory())
    } catch (salvageError: unknown) {
      setError(salvageError instanceof Error ? salvageError.message : 'Unable to salvage fish.')
    } finally {
      setSalvagingItemInstanceId(null)
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
      trackActivityPresence({
        attemptId: preparation.attemptId,
        playerId: activityPlayerId,
        playerName: activityPlayerName,
        phase: 'waiting',
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
            <div
              className={`pond-angler pond-angler-you ${
                activityPlayerPosition.left > 50
                  ? 'pond-angler-facing-left'
                  : 'pond-angler-facing-right'
              }`}
              style={{
                left: `${activityPlayerPosition.left}%`,
                top: `${activityPlayerPosition.top}%`,
              }}
            >
              <PondAnglerSprite showCastLine />
              <strong>{activityPlayerName}</strong>
            </div>
            {remoteAnglers.map((angler) => {
              const position = getPondPlayerPosition(angler.playerId)
              const playerName = getPlayerDisplayName({ providerDisplayName: angler.playerName })
              const caughtFish = angler.catch ? getFishDefinition(angler.catch.definitionId) : undefined
              const catchRarityVisual = angler.catch ? RARITY_VISUALS[angler.catch.rarity] : undefined
              return (
                <div
                  className={`pond-angler pond-angler-remote remote-angler-${angler.phase} ${
                    position.left > 50 ? 'pond-angler-facing-left' : 'pond-angler-facing-right'
                  }`}
                  key={angler.playerId}
                  style={{ left: `${position.left}%`, top: `${position.top}%` }}
                  aria-label={`${playerName} is ${
                    angler.phase === 'catching'
                      ? 'landing a fish'
                      : angler.phase === 'idle'
                        ? 'at the pond'
                        : 'fishing'
                  }`}
                >
                  <PondAnglerSprite />
                  <strong>{playerName}</strong>
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
                      {caughtFish ? (
                        <FishIcon icon={caughtFish.visual.icon} color={caughtFish.visual.accent} />
                      ) : '🐟'}
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
                  <div className="pond-scene-subline">
                    <span><i className="pond-live-dot" aria-hidden="true" /> World pond</span>
                    <span>{remoteAnglers.length + 1} anglers online</span>
                  </div>
                </div>
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
                  <div className="fishing-inventory-header-actions">
                    <span className="fishing-inventory-count">
                      {items.length} {items.length === 1 ? 'item' : 'items'}
                    </span>
                    <button
                      className="secondary-action fishing-inventory-close"
                      type="button"
                      onClick={() => setIsInventoryOpen(false)}
                    >
                      Close
                    </button>
                  </div>
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
                    getItemEssence={(item) => getFishingEssenceValue(item.definitionId, item.metadata)}
                    onSalvage={(item) => setPendingSalvage(item)}
                    salvagingItemInstanceId={salvagingItemInstanceId}
                  />
                )}
              </section>
            ) : null}
            <div className="fishing-hud-bottom">
              <div className="pond-loadout-heading">
                <div>
                  <p className="screen-kicker">Fishing loadout</p>
                  <strong>Prepare your next cast</strong>
                </div>
                <span className="pond-loadout-state">
                  {fishingPhase === 'idle' ? 'Ready' : FISHING_PHASE_LABELS[fishingPhase]}
                </span>
              </div>
              <div className="pond-scene-actions">
                <div className="pond-loadout-controls">
                  <FishingDropdown
                    icon="◈"
                    label="Mode"
                    value={selectedMode}
                    options={Object.values(FISHING_MODES).map((mode) => ({
                      value: mode.id,
                      label: mode.name,
                    }))}
                    disabled={fishingPhase !== 'idle'}
                    onChange={(value) => {
                      if (isFishingMode(value)) {
                        setSelectedMode(value)
                      }
                    }}
                  />
                  <FishingDropdown
                    icon="⌁"
                    label="Rod"
                    value={effectiveSelectedRodId ?? ''}
                    options={[
                      { value: '', label: DEFAULT_FISHING_ROD.name },
                      ...rods.map((rod) => ({
                        value: rod.itemInstanceId,
                        label: getInventoryItemDefinition(rod.definitionId)?.name ?? rod.definitionId,
                      })),
                    ]}
                    disabled={fishingPhase !== 'idle'}
                    onChange={(value) => setSelectedRodId(value || null)}
                  />
                  <FishingDropdown
                    icon="●"
                    label="Bait"
                    value={effectiveSelectedBaitId}
                    options={[
                      {
                        value: DEFAULT_FISHING_BAIT_ID,
                        label: `${FISHING_BAITS[DEFAULT_FISHING_BAIT_ID].name} · ${formatFishingBaitEffect(DEFAULT_FISHING_BAIT_ID)}`,
                      },
                      ...baits.map((bait) => ({
                        value: bait.itemInstanceId,
                        label: `${getInventoryItemDefinition(bait.definitionId)?.name ?? bait.definitionId} · ${bait.quantity} · ${formatFishingBaitEffect(bait.definitionId)}`,
                      })),
                    ]}
                    disabled={fishingPhase !== 'idle'}
                    onChange={setSelectedBaitId}
                  />
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
          </div>
        </section>
      </div>
      {pendingSalvage ? (
        <ConfirmationDialog
          title="Salvage fish?"
          message={`Salvaging ${getInventoryItemDefinition(pendingSalvage.definitionId)?.name ?? pendingSalvage.definitionId} consumes one fish and awards server-calculated Essence.`}
          confirmLabel="Salvage fish"
          onCancel={() => setPendingSalvage(null)}
          onConfirm={() => {
            const fish = pendingSalvage
            setPendingSalvage(null)
            void salvageFish(fish)
          }}
        />
      ) : null}
    </section>
  )
}
