import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { getPlayerDisplayName } from '../auth'
import { type ActiveDungeonRun } from '../persistence'
import { EssenceLeaderboard } from '../leaderboard/EssenceLeaderboard'
import type { EssenceLeaderboardService } from '../leaderboard/EssenceLeaderboardService'
import type { HubPresenceService, HubVisitor } from './HubPresenceService'
import { tooltipClassName } from '../rendering/TooltipShell'

interface AdventureHubSceneProps {
  accountId: string
  approvedNickname: string | null
  providerDisplayName: string | null
  email: string | null
  essenceBalance: number | null
  presenceService: HubPresenceService | null
  presenceConfigurationError: string | null
  leaderboardService: EssenceLeaderboardService | null
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
  onOpenAbyss: () => void
  onContinueRun: () => void
  onRequestForfeit: () => void
}

function getVisitorStyle(index: number, total: number, isCurrentPlayer: boolean): CSSProperties {
  if (isCurrentPlayer) {
    return {
      left: '50%',
      top: '72%',
      transform: 'translate(-50%, -50%) scale(1.08)',
    }
  }

  const remoteIndex = index - 1
  let ring = 0
  let positionInRing = remoteIndex
  let ringCapacity = 6
  while (positionInRing >= ringCapacity) {
    positionInRing -= ringCapacity
    ring += 1
    ringCapacity += 4
  }
  const angle = ((positionInRing / ringCapacity) * Math.PI * 2) + (Math.PI / 9)
  const radius = Math.min(40, 21 + ring * 7)
  const horizontalRadius = radius
  const verticalRadius = radius * 0.52
  const crowdScale = total > 24 ? 0.72 : total > 12 ? 0.84 : 1

  return {
    left: `${50 + Math.cos(angle) * horizontalRadius}%`,
    top: `${59 + Math.sin(angle) * verticalRadius}%`,
    transform: `translate(-50%, -50%) scale(${crowdScale})`,
  }
}

function HubVisitorFigure({
  visitor,
  index,
  total,
  currentPlayerId,
}: {
  visitor: HubVisitor
  index: number
  total: number
  currentPlayerId: string
}) {
  const isCurrentPlayer = visitor.playerId === currentPlayerId
  return (
    <li
      className={`hub-visitor${isCurrentPlayer ? ' hub-visitor-current' : ''}`}
      style={getVisitorStyle(index, total, isCurrentPlayer)}
      aria-label={isCurrentPlayer ? `${visitor.playerName}, you` : visitor.playerName}
    >
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
  onOpenAbyss,
  onContinueRun,
  onRequestForfeit,
}: AdventureHubSceneProps) {
  const playerName = getPlayerDisplayName({
    approvedNickname,
    providerDisplayName,
    email,
  })
  const [remoteVisitors, setRemoteVisitors] = useState<HubVisitor[]>([])
  const [presenceError, setPresenceError] = useState<string | null>(presenceConfigurationError)
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
    const self = { playerId: accountId, playerName }
    return [
      self,
      ...remoteVisitors
        .filter((visitor) => visitor.playerId !== accountId)
        .sort((left, right) => left.playerName.localeCompare(right.playerName)),
    ]
  }, [accountId, playerName, remoteVisitors])

  useEffect(() => {
    setPresenceError(presenceConfigurationError)
    setRemoteVisitors([])
    if (!presenceService) {
      return
    }
    let mounted = true
    const unsubscribe = presenceService.subscribeToVisitors(
      (activeVisitors) => {
        if (mounted) {
          setRemoteVisitors(activeVisitors)
          setPresenceError(null)
        }
      },
      (error) => {
        if (mounted) {
          setPresenceError(error.message)
        }
      },
    )
    void presenceService.trackVisitor({ playerId: accountId })
      .catch((error: unknown) => {
        if (mounted) {
          setPresenceError(error instanceof Error
            ? error.message
            : 'Adventure hub presence is unavailable.')
        }
      })
    return () => {
      mounted = false
      unsubscribe()
    }
  }, [accountId, presenceConfigurationError, presenceService])

  return (
    <section className="dashboard game-dashboard adventure-hub" aria-labelledby="game-dashboard-title">
      <div className="adventure-hub-scene">
        <div className="hub-dungeon-gate" aria-hidden="true">
          <span className="hub-dungeon-gate-glow" />
        </div>
        <div className="hub-ruin hub-ruin-left" aria-hidden="true" />
        <div className="hub-ruin hub-ruin-right" aria-hidden="true" />
        <div className="hub-banner hub-banner-left" aria-hidden="true" />
        <div className="hub-banner hub-banner-right" aria-hidden="true" />
        <div className="hub-torch hub-torch-left" aria-hidden="true"><i /></div>
        <div className="hub-torch hub-torch-right" aria-hidden="true"><i /></div>
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
        <ul className="hub-visitors" aria-label={`${visitors.length} adventurers at the hub`}>
          {visitors.map((visitor, index) => (
            <HubVisitorFigure
              key={visitor.playerId}
              visitor={visitor}
              index={index + 1}
              total={visitors.length}
              currentPlayerId={accountId}
            />
          ))}
        </ul>

        <header className="hub-heading">
          <p className="screen-kicker">The Emberwatch refuge</p>
          <h2 id="game-dashboard-title">Gather. Prepare. Descend.</h2>
          <p>The fire is lit and the dungeon gate is open. Choose your next expedition.</p>
        </header>

        <aside className="hub-status-panel">
          <p className="screen-kicker">Camp stores</p>
          <dl>
            <div>
              <dt>Essence</dt>
              <dd>{essenceBalance === null ? '—' : essenceBalance.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Gathered</dt>
              <dd>{visitors.length} {visitors.length === 1 ? 'adventurer' : 'adventurers'}</dd>
            </div>
          </dl>
          <button
            className="hub-station hub-store-station"
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
            <span aria-hidden="true">✦</span>
            <span><strong>Essence store</strong><small>Permanent power</small></span>
          </button>
        </aside>

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

        <aside className="hub-leaderboard-panel">
          <EssenceLeaderboard
            accountId={accountId}
            service={leaderboardService}
            configurationError={leaderboardConfigurationError}
          />
        </aside>
        {presenceError ? <p className="hub-presence-error" role="status">{presenceError}</p> : null}
      </div>
    </section>
  )
}
