import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { getPlayerDisplayName } from '../auth'
import { type ActiveDungeonRun } from '../persistence'
import { AbyssLeaderboard } from '../leaderboard/AbyssLeaderboard'
import type { AbyssLeaderboardService } from '../leaderboard/AbyssLeaderboardService'
import { useToaster } from '../ui/ToasterContext'
import {
  HUB_SIGNAL_IDS,
  clampToHubFloor,
  hubPositionFromPoint,
  HUB_SCENE_HORIZON_PERCENT,
  HUB_VISITOR_BOUNDS,
  type HubPresenceService,
  type HubPosition,
  type HubSignal,
  type HubSignalId,
  type HubVisitor,
} from './HubPresenceService'
import { tooltipClassName } from '../rendering/TooltipShell'
import { EssenceMark } from '../ui/EssenceMark'

const HUB_SIGNAL_DURATION_MS = 4_000
const HUB_SIGNAL_COOLDOWN_MS = 5_000
const HUB_MOVEMENT_SPEED = 22
const HUB_POSITION_UPDATE_INTERVAL_MS = 100
const HUB_POSITION_RETRY_DELAY_MS = 500
const HUB_MOVEMENT_KEYS = new Set(['w', 'a', 's', 'd'])

/**
 * How close to a tapped spot counts as standing on it, in scene per-cent.
 *
 * Wider than a frame's travel at the walking speed, so arriving ends the walk
 * instead of leaving the figure oscillating either side of the target.
 */
const HUB_ARRIVAL_DISTANCE = 0.75

/**
 * How far a finger may travel and still have meant a tap, in pixels.
 *
 * The camp is the top of a scrolling screen on a phone, so a swipe that begins
 * on it is a swipe and not a destination. Walking on release, and only when the
 * pointer stayed put, is what tells the two apart.
 */
const HUB_TAP_SLOP = 12

type HubMovementKey = 'w' | 'a' | 's' | 'd'

const HUB_SIGNAL_LABELS: Record<HubSignalId, string> = {
  wave: 'Wave',
  'praise-the-sun': 'Praise the sun!',
  'good-luck-below': 'Good luck below',
  'ready-to-descend': 'Ready to descend',
}

const HUB_SIGNAL_OPTIONS = HUB_SIGNAL_IDS.map((id) => ({
  id,
  label: HUB_SIGNAL_LABELS[id],
}))

function isHubMovementKey(value: string): value is HubMovementKey {
  return HUB_MOVEMENT_KEYS.has(value)
}

function isInteractiveElement(target: EventTarget | null): boolean {
  return target instanceof HTMLElement &&
    target.closest('input, select, textarea, [contenteditable="true"]') !== null
}

/**
 * A spot by the fire to arrive at.
 *
 * Derived from the walkable bounds rather than written out again, so a visitor
 * can never spawn somewhere they would not be allowed to walk.
 */
function createHubSpawnPosition(): HubPosition {
  const floorDepth = HUB_VISITOR_BOUNDS.maxY - HUB_VISITOR_BOUNDS.minY
  return {
    x: 44 + Math.random() * 13,
    y: HUB_VISITOR_BOUNDS.minY + floorDepth * (0.3 + Math.random() * 0.35),
  }
}

interface AdventureHubSceneProps {
  accountId: string
  approvedNickname: string | null
  providerDisplayName: string | null
  email: string | null
  essenceBalance: number | null
  presenceService: HubPresenceService | null
  presenceConfigurationError: string | null
  leaderboardService: AbyssLeaderboardService | null
  leaderboardConfigurationError: string | null
  activeRun: ActiveDungeonRun | null
  activeCharacterClassName: string | null
  runLoadState: 'loading' | 'ready' | 'error' | 'unavailable'
  runLoadError: string | null
  championAvailability: 'loading' | 'available' | 'none' | 'error'
  forfeiting: boolean
  forfeitError: string | null
  onOpenRunSetup: () => void
  onOpenMetaProgression: () => void
  onOpenFishing: () => void
  onOpenChampions: () => void
  onOpenInventory: () => void
  onOpenShop: () => void
  onOpenRunHistory: () => void
  onOpenAbyss: () => void
  onContinueRun: () => void
  onRequestForfeit: () => void
}

function getVisitorStyle(visitor: HubVisitor, total: number, isCurrentPlayer: boolean): CSSProperties {
  const crowdScale = total > 24 ? 0.72 : total > 12 ? 0.84 : 1
  const position = clampToHubFloor(visitor.position)

  return {
    left: `${position.x}%`,
    top: `${position.y}%`,
    transform: `translate(-50%, -50%) scale(${isCurrentPlayer ? crowdScale * 1.08 : crowdScale})`,
  }
}

function HubVisitorFigure({
  visitor,
  total,
  currentPlayerId,
  signalId,
  elementRef,
}: {
  visitor: HubVisitor
  total: number
  currentPlayerId: string
  signalId?: HubSignalId
  elementRef?: RefObject<HTMLLIElement | null>
}) {
  const isCurrentPlayer = visitor.playerId === currentPlayerId
  return (
    <li
      ref={elementRef}
      className={`hub-visitor${isCurrentPlayer ? ' hub-visitor-current' : ''}`}
      style={getVisitorStyle(visitor, total, isCurrentPlayer)}
      aria-label={isCurrentPlayer ? `${visitor.playerName}, you` : visitor.playerName}
    >
      {signalId ? (
        <span className="hub-visitor-signal" aria-live="polite">
          {HUB_SIGNAL_LABELS[signalId]}
        </span>
      ) : null}
      <span className="hub-visitor-glow" aria-hidden="true" />
      <span className="hub-visitor-body" aria-hidden="true" />
      <span className="hub-visitor-head" aria-hidden="true" />
      <strong>{isCurrentPlayer ? 'You' : visitor.playerName}</strong>
    </li>
  )
}

export function AdventureHubScene({
  accountId,
  approvedNickname,
  providerDisplayName,
  email,
  essenceBalance,
  presenceService,
  presenceConfigurationError,
  leaderboardService,
  leaderboardConfigurationError,
  activeRun,
  activeCharacterClassName,
  runLoadState,
  runLoadError,
  championAvailability,
  forfeiting,
  forfeitError,
  onOpenRunSetup,
  onOpenMetaProgression,
  onOpenFishing,
  onOpenChampions,
  onOpenInventory,
  onOpenShop,
  onOpenRunHistory,
  onOpenAbyss,
  onContinueRun,
  onRequestForfeit,
}: AdventureHubSceneProps) {
  const { showToast } = useToaster()
  const playerName = getPlayerDisplayName({
    approvedNickname,
    providerDisplayName,
    email,
  })
  const [remoteVisitors, setRemoteVisitors] = useState<HubVisitor[]>([])
  const [presenceError, setPresenceError] = useState<string | null>(presenceConfigurationError)
  const [activeSignals, setActiveSignals] = useState<Partial<Record<string, HubSignalId>>>({})
  const [sendingSignalId, setSendingSignalId] = useState<HubSignalId | null>(null)
  const [signalCooldownUntil, setSignalCooldownUntil] = useState<number | null>(null)
  const [playerPosition, setPlayerPosition] = useState<HubPosition>(createHubSpawnPosition)
  const signalTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playerPositionRef = useRef<HubPosition>(playerPosition)
  const pendingPositionRef = useRef<HubPosition>(playerPosition)
  const remoteMovementPositions = useRef(new Map<string, HubPosition>())
  const currentVisitorElementRef = useRef<HTMLLIElement | null>(null)
  const floorElement = useRef<HTMLUListElement | null>(null)
  const walkTarget = useRef<HubPosition | null>(null)
  const pointerDownAt = useRef<{ x: number, y: number } | null>(null)
  const startWalking = useRef<() => void>(() => {})
  const movementUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const movementUpdateInFlight = useRef(false)
  const movementUpdateGeneration = useRef(0)
  const lastPositionUpdateAt = useRef(0)
  const hubActiveRef = useRef(false)
  const presenceAccountIdRef = useRef(accountId)
  const storeBlocked = activeRun !== null || runLoadState !== 'ready'
  const isAbyssRun = activeRun?.modeId === 'infinite-abyss'
  const abyssEntryMessage = championAvailability === 'none'
    ? 'Complete a dungeon run and save a Champion before entering the Abyss.'
    : championAvailability === 'loading'
      ? 'Checking for available Champions.'
      : championAvailability === 'error'
        ? 'Champion availability is currently unavailable.'
        : undefined
  const visitors = useMemo(() => {
    const self = { playerId: accountId, playerName, position: playerPosition }
    return [
      self,
      ...remoteVisitors
        .filter((visitor) => visitor.playerId !== accountId)
        .sort((left, right) => left.playerName.localeCompare(right.playerName)),
    ]
  }, [accountId, playerName, playerPosition, remoteVisitors])

  const clearSignalTimers = useCallback(() => {
    signalTimers.current.forEach((timer) => clearTimeout(timer))
    signalTimers.current.clear()
    if (cooldownTimer.current !== null) {
      clearTimeout(cooldownTimer.current)
      cooldownTimer.current = null
    }
  }, [])

  const showSignal = useCallback((signal: HubSignal) => {
    const existingTimer = signalTimers.current.get(signal.playerId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }
    setActiveSignals((currentSignals) => ({
      ...currentSignals,
      [signal.playerId]: signal.signalId,
    }))
    const timer = setTimeout(() => {
      setActiveSignals((currentSignals) => {
        if (currentSignals[signal.playerId] !== signal.signalId) {
          return currentSignals
        }
        const { [signal.playerId]: _, ...remainingSignals } = currentSignals
        return remainingSignals
      })
      signalTimers.current.delete(signal.playerId)
    }, HUB_SIGNAL_DURATION_MS)
    signalTimers.current.set(signal.playerId, timer)
  }, [])

  const cancelMovementUpdate = useCallback(() => {
    movementUpdateGeneration.current += 1
    if (movementUpdateTimer.current !== null) {
      clearTimeout(movementUpdateTimer.current)
      movementUpdateTimer.current = null
    }
  }, [])

  const queuePositionUpdate = useCallback((position: HubPosition) => {
    if (!presenceService) {
      return
    }
    pendingPositionRef.current = position
    const generation = movementUpdateGeneration.current

    const schedulePositionUpdate = (minimumDelay = 0): void => {
      if (
        !hubActiveRef.current ||
        generation !== movementUpdateGeneration.current ||
        movementUpdateTimer.current !== null ||
        movementUpdateInFlight.current
      ) {
        return
      }
      const elapsed = Date.now() - lastPositionUpdateAt.current
      const delay = Math.max(minimumDelay, HUB_POSITION_UPDATE_INTERVAL_MS - elapsed)
      movementUpdateTimer.current = setTimeout(() => {
        movementUpdateTimer.current = null
        if (
          !hubActiveRef.current ||
          generation !== movementUpdateGeneration.current ||
          movementUpdateInFlight.current
        ) {
          return
        }
        const positionToTrack = pendingPositionRef.current
        movementUpdateInFlight.current = true
        let failed = false
        void presenceService.sendMovement({
          playerId: accountId,
          position: positionToTrack,
        }).catch((error: unknown) => {
          failed = true
          if (hubActiveRef.current && generation === movementUpdateGeneration.current) {
            setPresenceError(error instanceof Error
              ? error.message
              : 'Adventure hub presence is unavailable.')
          }
        }).finally(() => {
          movementUpdateInFlight.current = false
          lastPositionUpdateAt.current = Date.now()
          if (!hubActiveRef.current || generation !== movementUpdateGeneration.current) {
            return
          }
          const pendingPosition = pendingPositionRef.current
          if (
            failed ||
            pendingPosition.x !== positionToTrack.x ||
            pendingPosition.y !== positionToTrack.y
          ) {
            schedulePositionUpdate(failed ? HUB_POSITION_RETRY_DELAY_MS : 0)
          }
        })
      }, delay)
    }

    schedulePositionUpdate()
  }, [accountId, presenceService])

  useLayoutEffect(() => {
    const visitorElement = currentVisitorElementRef.current
    if (visitorElement) {
      visitorElement.style.left = `${playerPositionRef.current.x}%`
      visitorElement.style.top = `${playerPositionRef.current.y}%`
    }
  })

  useEffect(() => {
    clearSignalTimers()
    cancelMovementUpdate()
    const spawnPosition = presenceAccountIdRef.current === accountId
      ? playerPositionRef.current
      : createHubSpawnPosition()
    presenceAccountIdRef.current = accountId
    playerPositionRef.current = spawnPosition
    pendingPositionRef.current = spawnPosition
    walkTarget.current = null
    remoteMovementPositions.current.clear()
    lastPositionUpdateAt.current = 0
    setPlayerPosition(spawnPosition)
    setPresenceError(presenceConfigurationError)
    setRemoteVisitors([])
    setActiveSignals({})
    setSendingSignalId(null)
    setSignalCooldownUntil(null)
    if (!presenceService) {
      return
    }
    let mounted = true
    hubActiveRef.current = true
    const unsubscribe = presenceService.subscribeToVisitors(
      (activeVisitors) => {
        if (mounted) {
          const activeVisitorIds = new Set(activeVisitors.map((visitor) => visitor.playerId))
          remoteMovementPositions.current.forEach((_position, playerId) => {
            if (!activeVisitorIds.has(playerId)) {
              remoteMovementPositions.current.delete(playerId)
            }
          })
          setRemoteVisitors((currentVisitors) => activeVisitors.map((visitor) => {
            const currentVisitor = currentVisitors.find(
              (candidate) => candidate.playerId === visitor.playerId,
            )
            return {
              ...visitor,
              position: remoteMovementPositions.current.get(visitor.playerId) ??
                currentVisitor?.position ??
                visitor.position,
            }
          }))
          setPresenceError(null)
        }
      },
      (error) => {
        if (mounted) {
          setPresenceError(error.message)
        }
      },
    )
    const unsubscribeFromSignals = presenceService.subscribeToSignals(
      (signal) => {
        if (mounted) {
          showSignal(signal)
        }
      },
      (error) => {
        if (mounted) {
          setPresenceError(error.message)
        }
      },
    )
    const unsubscribeFromMovements = presenceService.subscribeToMovements(
      (movement) => {
        if (mounted && movement.playerId !== accountId) {
          remoteMovementPositions.current.set(movement.playerId, movement.position)
          setRemoteVisitors((currentVisitors) => currentVisitors.map((visitor) => (
            visitor.playerId === movement.playerId
              ? { ...visitor, position: movement.position }
              : visitor
          )))
        }
      },
      (error) => {
        if (mounted) {
          setPresenceError(error.message)
        }
      },
    )
    const unsubscribeFromPositionRequests = presenceService.subscribeToPositionRequests(
      (request) => {
        if (mounted && request.playerId !== accountId) {
          void presenceService.sendMovement({
            playerId: accountId,
            position: playerPositionRef.current,
          }).catch((error: unknown) => {
            if (mounted) {
              setPresenceError(error instanceof Error
                ? error.message
                : 'Adventure hub presence is unavailable.')
            }
          })
        }
      },
      (error) => {
        if (mounted) {
          setPresenceError(error.message)
        }
      },
    )
    void presenceService.trackVisitor({ playerId: accountId, position: spawnPosition })
      .then(() => presenceService.sendMovement({ playerId: accountId, position: spawnPosition }))
      .then(() => presenceService.requestPositions({ playerId: accountId }))
      .catch((error: unknown) => {
        if (mounted) {
          setPresenceError(error instanceof Error
            ? error.message
            : 'Adventure hub presence is unavailable.')
        }
      })
    return () => {
      mounted = false
      hubActiveRef.current = false
      unsubscribeFromPositionRequests()
      unsubscribeFromMovements()
      unsubscribeFromSignals()
      unsubscribe()
      clearSignalTimers()
      cancelMovementUpdate()
    }
  }, [
    accountId,
    cancelMovementUpdate,
    clearSignalTimers,
    presenceConfigurationError,
    presenceService,
    queuePositionUpdate,
    showSignal,
  ])

  useEffect(() => {
    if (!presenceService) {
      return
    }
    const pressedKeys = new Set<HubMovementKey>()
    let animationFrame: number | null = null
    let previousFrameAt: number | null = null

    /*
     * Which way to walk this frame, as a unit vector and the travel left in it.
     *
     * Held keys and a tapped destination are the same walk from here down, which
     * is what lets a phone reach the floor at all. A key wins while it is down:
     * taking the walk off a tap is what a player pressing a key means by it.
     */
    const readHeading = (
      position: HubPosition,
    ): { x: number, y: number, remaining: number } | null => {
      const horizontal = (pressedKeys.has('d') ? 1 : 0) - (pressedKeys.has('a') ? 1 : 0)
      const vertical = (pressedKeys.has('s') ? 1 : 0) - (pressedKeys.has('w') ? 1 : 0)
      if (horizontal !== 0 || vertical !== 0) {
        walkTarget.current = null
        const magnitude = Math.hypot(horizontal, vertical)
        return {
          x: horizontal / magnitude,
          y: vertical / magnitude,
          remaining: Number.POSITIVE_INFINITY,
        }
      }
      const target = walkTarget.current
      if (target === null) {
        return null
      }
      const toX = target.x - position.x
      const toY = target.y - position.y
      const remaining = Math.hypot(toX, toY)
      if (remaining < HUB_ARRIVAL_DISTANCE) {
        walkTarget.current = null
        return null
      }
      return { x: toX / remaining, y: toY / remaining, remaining }
    }

    const move = (frameAt: number): void => {
      if (previousFrameAt === null) {
        previousFrameAt = frameAt
      }
      const elapsedSeconds = Math.min((frameAt - previousFrameAt) / 1_000, 0.1)
      previousFrameAt = frameAt
      const currentPosition = playerPositionRef.current
      const heading = readHeading(currentPosition)
      if (heading === null) {
        animationFrame = null
        previousFrameAt = null
        return
      }
      const distance = Math.min(HUB_MOVEMENT_SPEED * elapsedSeconds, heading.remaining)
      const nextPosition = clampToHubFloor({
        x: currentPosition.x + heading.x * distance,
        y: currentPosition.y + heading.y * distance,
      })
      if (nextPosition.x !== currentPosition.x || nextPosition.y !== currentPosition.y) {
        playerPositionRef.current = nextPosition
        const visitorElement = currentVisitorElementRef.current
        if (visitorElement) {
          visitorElement.style.left = `${nextPosition.x}%`
          visitorElement.style.top = `${nextPosition.y}%`
        }
        queuePositionUpdate(nextPosition)
      }
      animationFrame = requestAnimationFrame(move)
    }

    const startMoving = (): void => {
      if (animationFrame === null) {
        animationFrame = requestAnimationFrame(move)
      }
    }
    startWalking.current = startMoving

    const onKeyDown = (event: KeyboardEvent): void => {
      const key = event.key.toLowerCase()
      if (!isHubMovementKey(key) || isInteractiveElement(event.target)) {
        return
      }
      event.preventDefault()
      pressedKeys.add(key)
      startMoving()
    }

    const onKeyUp = (event: KeyboardEvent): void => {
      const key = event.key.toLowerCase()
      if (!isHubMovementKey(key)) {
        return
      }
      if (pressedKeys.delete(key)) {
        event.preventDefault()
      }
    }

    const stopMoving = (): void => {
      pressedKeys.clear()
      walkTarget.current = null
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame)
        animationFrame = null
      }
      previousFrameAt = null
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', stopMoving)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', stopMoving)
      startWalking.current = () => {}
      stopMoving()
    }
  }, [presenceService, queuePositionUpdate])

  const rememberPointer = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
    pointerDownAt.current = event.button === 0
      ? { x: event.clientX, y: event.clientY }
      : null
  }, [])

  /*
   * Walk to where the pointer was released.
   *
   * The spot is measured against the floor rather than against the camp around
   * it. They are the same box on a desktop and they are not on a phone, where
   * the floor stops short of the camp's bottom edge to leave the front row's
   * names somewhere to be drawn; reading the floor's own box is what keeps the
   * spot walked to under the finger that asked for it either way.
   */
  const walkToPointer = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
    const pressedAt = pointerDownAt.current
    pointerDownAt.current = null
    const floor = floorElement.current
    if (!presenceService || floor === null || pressedAt === null) {
      return
    }
    const travelled = Math.hypot(event.clientX - pressedAt.x, event.clientY - pressedAt.y)
    if (travelled > HUB_TAP_SLOP) {
      return
    }
    walkTarget.current = hubPositionFromPoint(floor.getBoundingClientRect(), event)
    startWalking.current()
  }, [presenceService])

  // Declared with useCallback so the impure `Date.now()` below is understood as
  // event-handler work rather than render work.
  const sendSignal = useCallback(async (signalId: HubSignalId): Promise<void> => {
    if (!presenceService) {
      showToast('Campfire signals are currently unavailable.', 'error')
      return
    }
    if (sendingSignalId !== null || signalCooldownUntil !== null) {
      return
    }
    setSendingSignalId(signalId)
    try {
      const signal = { playerId: accountId, signalId }
      await presenceService.sendSignal(signal)
      showSignal(signal)
      setSignalCooldownUntil(Date.now() + HUB_SIGNAL_COOLDOWN_MS)
      cooldownTimer.current = setTimeout(() => {
        setSignalCooldownUntil(null)
        cooldownTimer.current = null
      }, HUB_SIGNAL_COOLDOWN_MS)
    } catch {
      showToast('Unable to share your campfire signal. Please try again.', 'error')
    } finally {
      setSendingSignalId(null)
    }
  }, [
    accountId,
    presenceService,
    sendingSignalId,
    showSignal,
    showToast,
    signalCooldownUntil,
  ])

  return (
    <section
      className="dashboard game-dashboard adventure-hub"
      aria-labelledby="game-dashboard-title"
      // Read by the end-to-end suite to wait for durable run recovery to settle
      // before driving the dashboard. Without it every authenticated spec times
      // out waiting for a state the page never published.
      data-run-persistence-state={runLoadState}
    >
      <div
        className="adventure-hub-scene"
        // The floor line is owned by the presence module, because the ground the
        // stylesheet draws and the ground a visitor may walk on have to be the
        // same line. Handing it to CSS here keeps one number in one place.
        style={{ '--scene-horizon': `${HUB_SCENE_HORIZON_PERCENT}%` } as CSSProperties}
      >
        {/*
          The clearing. Nothing stands on the fire's axis: the archway that used
          to frame it shared the same centre line, so at narrower widths the
          bonfire ended up burning inside the doorway. The stones open toward
          the viewer instead, and the way down is cut into the floor beside the
          fire rather than raised behind it.

          It is one box because a phone has to be able to put it somewhere. On a
          desktop the camp is the whole scene with the HUD in its corners; on a
          narrow screen the corners are gone, and the camp takes the top of the
          screen with the dock scrolling below it instead of over it.
        */}
        <div
          className="hub-camp"
          onPointerDown={rememberPointer}
          onPointerUp={walkToPointer}
        >
          <div className="hub-sky" aria-hidden="true">
            <span className="hub-stars" />
            <span className="hub-moon" />
          </div>
          <div className="hub-stones" aria-hidden="true">
            <span className="hub-stone hub-stone-a" />
            <span className="hub-stone hub-stone-b" />
            <span className="hub-stone hub-stone-c" />
            <span className="hub-stone hub-stone-d" />
            <span className="hub-stone hub-stone-e" />
            <span className="hub-stone hub-stone-f" />
            <span className="hub-stone hub-stone-g" />
            <span className="hub-stone hub-stone-h" />
          </div>
          <div className="hub-descent" aria-hidden="true">
            <span className="hub-descent-mouth" />
            <span className="hub-descent-mist" />
          </div>
          <div className="hub-mist" aria-hidden="true" />
          <div className="hub-bonfire" aria-hidden="true">
            <span className="hub-fire-glow" />
            <span className="hub-fire-embers" />
            <span className="hub-flame hub-flame-left" />
            <span className="hub-flame hub-flame-center" />
            <span className="hub-flame hub-flame-right" />
            <span className="hub-fire-log hub-fire-log-left" />
            <span className="hub-fire-log hub-fire-log-right" />
            <span className="hub-firepit" />
          </div>
          <div className="hub-wisps" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <ul
            className="hub-visitors"
            ref={floorElement}
            aria-label={`${visitors.length} adventurers at the hub. Tap the camp to walk there, or use W, A, S, and D.`}
          >
            {visitors.map((visitor) => (
              <HubVisitorFigure
                key={visitor.playerId}
                visitor={visitor}
                total={visitors.length}
                currentPlayerId={accountId}
                signalId={activeSignals[visitor.playerId]}
                elementRef={visitor.playerId === accountId ? currentVisitorElementRef : undefined}
              />
            ))}
          </ul>

          {/*
            The light. Everything above is a prop with its own colour; these two
            layers are what makes the scene one place — the fire adds its warmth
            over whatever it reaches, and the night takes it back at the edges.
          */}
          <div className="hub-firelight" aria-hidden="true" />
          <div className="hub-nightfall" aria-hidden="true" />
        </div>

        <div className="hub-hud">
          <div className="hub-hud-column hub-hud-column-start">
            <header className="hub-heading">
              <p className="screen-kicker">The Emberwatch refuge</p>
              <h2 id="game-dashboard-title">Gather. Prepare. Descend.</h2>
              <p>The fire is lit and the dungeon gate is open. Choose your next expedition.</p>
            </header>

            <div className="hub-left-dock">
              <div className="hub-utility-stations" aria-label="Camp facilities">
                <button className="hub-station hub-station-inventory" type="button" onClick={onOpenInventory} disabled={runLoadState !== 'ready'}>
                  <span aria-hidden="true">▣</span>
                  <span><strong>Inventory</strong><small>Fish, gear, and loot</small></span>
                </button>
                <button className="hub-station hub-station-fishing" type="button" onClick={onOpenFishing} disabled={runLoadState !== 'ready'}>
                  <span aria-hidden="true">≈</span>
                  <span><strong>Moonwater Pond</strong><small>Go fishing</small></span>
                </button>
                <button className="hub-station hub-station-champions" type="button" onClick={onOpenChampions} disabled={runLoadState !== 'ready'}>
                  <span aria-hidden="true">◆</span>
                  <span><strong>Champions</strong><small>Saved builds</small></span>
                </button>
                <button className="hub-station hub-station-shop" type="button" onClick={onOpenShop} disabled={runLoadState !== 'ready'}>
                  <span aria-hidden="true">⇄</span>
                  <span><strong>Quartermaster</strong><small>Buy and sell supplies</small></span>
                </button>
                <button className="hub-station hub-station-chronicle" type="button" onClick={onOpenRunHistory} disabled={runLoadState !== 'ready'}>
                  <span aria-hidden="true">✦</span>
                  <span><strong>Chronicle</strong><small>Runs already ended</small></span>
                </button>
              </div>

              <section className="hub-expedition-panel" aria-labelledby="current-run-title">
                <p className="screen-kicker">Dungeon gate</p>
                <h3 id="current-run-title">{activeRun ? 'An expedition awaits' : 'Choose your descent'}</h3>
                {runLoadState === 'error' || runLoadState === 'unavailable' ? (
                  <p className="persistence-error" role="alert">
                    {runLoadError ?? 'Unable to load the current dungeon run.'}
                  </p>
                ) : null}
                {activeRun ? (
                  <>
                    <dl className="hub-run-details">
                      <div><dt>Expedition</dt><dd>{isAbyssRun ? 'Infinite Abyss' : 'Dungeon run'}</dd></div>
                      <div><dt>Floor</dt><dd>{isAbyssRun ? activeRun.currentFloor : `${activeRun.currentFloor} / ${activeRun.maxFloor}`}</dd></div>
                      <div><dt>Class</dt><dd>{activeCharacterClassName ?? activeRun.characterClassId}</dd></div>
                    </dl>
                    <button className="hub-expedition-action" type="button" onClick={onContinueRun}>
                      Resume {isAbyssRun ? 'abyss' : 'dungeon'} <span aria-hidden="true">→</span>
                    </button>
                    <button className="hub-forfeit-action" type="button" onClick={onRequestForfeit} disabled={forfeiting}>
                      {forfeiting ? 'Forfeiting…' : 'Forfeit run'}
                    </button>
                    {forfeitError ? <p className="persistence-error" role="alert">{forfeitError}</p> : null}
                    <p className="hub-restriction" id="store-blocked-help">
                      Finish or forfeit this run before using the Essence store.
                    </p>
                  </>
                ) : (
                  <div className="hub-expedition-actions">
                    <button className="hub-expedition-action" type="button" onClick={onOpenRunSetup}>
                      Begin dungeon run <span aria-hidden="true">→</span>
                    </button>
                    <div className="hub-abyss-action-wrapper">
                      <button
                        className="hub-abyss-action"
                        type="button"
                        onClick={onOpenAbyss}
                        disabled={runLoadState !== 'ready' || championAvailability !== 'available'}
                        aria-describedby={abyssEntryMessage ? 'abyss-entry-tooltip' : undefined}
                      >
                        Infinite Abyss <span aria-hidden="true">∞</span>
                      </button>
                      {abyssEntryMessage ? (
                        <span id="abyss-entry-tooltip" className={tooltipClassName('abyss-entry-tooltip')} role="tooltip">
                          {abyssEntryMessage}
                        </span>
                      ) : null}
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>

          <div className="hub-hud-column hub-hud-column-center">
            {presenceError ? <p className="hub-presence-error" role="status">{presenceError}</p> : null}
            <aside className="hub-social-panel" aria-labelledby="hub-social-title">
              <div className="hub-social-gathered">
                <p className="screen-kicker" id="hub-social-title">Gathered</p>
                <strong>{visitors.length} {visitors.length === 1 ? 'adventurer' : 'adventurers'}</strong>
              </div>
              <fieldset className="hub-signal-picker">
                <legend>Campfire signals</legend>
                <div className="hub-signal-options">
                  {HUB_SIGNAL_OPTIONS.map((signal) => (
                    <button
                      key={signal.id}
                      className="hub-signal-option"
                      type="button"
                      onClick={() => void sendSignal(signal.id)}
                      disabled={presenceService === null || sendingSignalId !== null || signalCooldownUntil !== null}
                    >
                      {sendingSignalId === signal.id ? 'Sharing...' : signal.label}
                    </button>
                  ))}
                </div>
                <p className="hub-signal-help" aria-live="polite">
                  {signalCooldownUntil !== null
                    ? 'The campfire is listening. Signals return shortly.'
                    : 'Share a friendly signal with everyone at the fire.'}
                </p>
              </fieldset>
            </aside>
          </div>

          <div className="hub-hud-column hub-hud-column-end">
            {/*
              One plate, not a card inside a card: the balance is the face of it
              and the store is a way out of its foot. The mark next to the
              amount is the currency's own, which is why the button no longer
              needs to repeat the word.
            */}
            <aside className="hub-status-panel">
              <div className="hub-essence-readout">
                <span className="hub-essence-mark" aria-hidden="true"><EssenceMark /></span>
                <dl>
                  <div>
                    <dt>Essence</dt>
                    <dd>{essenceBalance === null ? '—' : essenceBalance.toLocaleString()}</dd>
                  </div>
                </dl>
              </div>
              <button
                className="hub-store-station"
                type="button"
                onClick={onOpenMetaProgression}
                disabled={storeBlocked}
                title={storeBlocked
                  ? activeRun
                    ? 'Finish or forfeit your current dungeon run before opening the Essence store.'
                    : 'Checking the current dungeon run before opening the Essence store.'
                  : undefined}
                aria-describedby={activeRun ? 'store-blocked-help' : undefined}
              >
                <span><strong>Essence upgrades</strong><small>Permanent power</small></span>
                <span className="hub-store-station-arrow" aria-hidden="true">→</span>
              </button>
            </aside>

            <aside className="hub-leaderboard-panel">
              <AbyssLeaderboard
                accountId={accountId}
                service={leaderboardService}
                configurationError={leaderboardConfigurationError}
              />
            </aside>
          </div>
        </div>
      </div>
    </section>
  )
}
