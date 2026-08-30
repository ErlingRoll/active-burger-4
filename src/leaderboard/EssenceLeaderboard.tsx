import { useCallback, useEffect, useState } from 'react'
import type {
  EssenceLeaderboardEntry,
  EssenceLeaderboardService,
} from './EssenceLeaderboardService'

const LEADERBOARD_REFRESH_INTERVAL_MS = 30_000

interface EssenceLeaderboardProps {
  accountId: string
  service: EssenceLeaderboardService | null
  configurationError: string | null
}

type LeaderboardLoadState = 'loading' | 'ready' | 'error' | 'unavailable'

function leaderboardErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'object' && error !== null &&
    'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return 'Unable to load the Essence leaderboard.'
}

export function EssenceLeaderboard({
  accountId,
  service,
  configurationError,
}: EssenceLeaderboardProps) {
  const [entries, setEntries] = useState<EssenceLeaderboardEntry[]>([])
  const [loadState, setLoadState] = useState<LeaderboardLoadState>(
    service ? 'loading' : 'unavailable',
  )
  const [error, setError] = useState<string | null>(configurationError)

  const loadLeaderboard = useCallback(async (): Promise<void> => {
    if (!service) {
      setLoadState('unavailable')
      setError(configurationError ?? 'Leaderboard is unavailable.')
      return
    }
    try {
      const nextEntries = await service.load()
      setEntries(nextEntries)
      setLoadState('ready')
      setError(null)
    } catch (loadError: unknown) {
      setLoadState('error')
      setError(leaderboardErrorMessage(loadError))
    }
  }, [configurationError, service])

  useEffect(() => {
    let cancelled = false
    const refresh = (): void => {
      if (!cancelled) {
        void loadLeaderboard()
      }
    }
    refresh()
    const intervalId = window.setInterval(refresh, LEADERBOARD_REFRESH_INTERVAL_MS)
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', refresh)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', refresh)
    }
  }, [accountId, loadLeaderboard])

  return (
    <section className="essence-leaderboard" aria-labelledby="essence-leaderboard-title">
      <div className="essence-leaderboard-heading">
        <div>
          <p className="screen-kicker">Global rankings</p>
          <h3 id="essence-leaderboard-title">Essence leaderboard</h3>
        </div>
        <span>Top 10 players</span>
      </div>
      {loadState === 'loading' && entries.length === 0 ? (
        <p className="essence-leaderboard-message" role="status">Loading rankings…</p>
      ) : null}
      {error && entries.length === 0 ? (
        <p className="essence-leaderboard-message" role="alert">{error}</p>
      ) : null}
      {loadState === 'ready' && entries.length === 0 ? (
        <p className="essence-leaderboard-message">No Essence earned yet.</p>
      ) : null}
      {entries.length > 0 ? (
        <ol className="essence-leaderboard-list">
          {entries.map((entry) => (
            <li
              className={entry.profileId === accountId
                ? 'essence-leaderboard-row essence-leaderboard-row-current'
                : 'essence-leaderboard-row'}
              key={entry.profileId}
            >
              <span className="essence-leaderboard-rank">#{entry.rank}</span>
              <span className="essence-leaderboard-player">
                {entry.displayName}
                {entry.profileId === accountId ? (
                  <small aria-label="Your ranking">You</small>
                ) : null}
              </span>
              <strong>{entry.essence.toLocaleString()}</strong>
            </li>
          ))}
        </ol>
      ) : null}
      {error && entries.length > 0 ? (
        <p className="essence-leaderboard-refresh-error" role="status">
          Rankings could not be refreshed. Showing the last available results.
        </p>
      ) : null}
    </section>
  )
}
