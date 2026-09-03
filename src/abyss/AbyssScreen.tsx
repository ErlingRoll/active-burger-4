import { useEffect, useState } from 'react'
import type { CharacterService, ChampionSnapshot } from '../characters'
import { CHARACTER_CLASS_DEFINITIONS } from '../content/classes/CharacterClasses'

interface AbyssScreenProps {
  service: CharacterService | null
  configurationError: string | null
  onBack: () => void
  onStart: (champion: ChampionSnapshot) => Promise<void>
}

function isAvailable(champion: ChampionSnapshot): boolean {
  return champion.exhaustionUntil === null ||
    Date.parse(champion.exhaustionUntil) <= Date.now()
}

export function AbyssScreen({
  service,
  configurationError,
  onBack,
  onStart,
}: AbyssScreenProps) {
  const [champions, setChampions] = useState<ChampionSnapshot[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    () => service ? 'loading' : 'error',
  )
  const [error, setError] = useState<string | null>(
    () => service ? configurationError : configurationError ?? 'Champion storage is unavailable.',
  )
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    if (!service) {
      return
    }
    let cancelled = false
    void service.loadCharacters()
      .then((collection) => {
        if (!cancelled) {
          const available = collection.champions.filter(isAvailable)
          setChampions(available)
          setSelectedId(available[0]?.championId ?? null)
          setLoadState('ready')
          setError(null)
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setLoadState('error')
          setError(loadError instanceof Error ? loadError.message : 'Unable to load Champions.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [service])

  const selected = champions.find((champion) => champion.championId === selectedId) ?? null

  const start = async (): Promise<void> => {
    if (!selected || starting) {
      return
    }
    setStarting(true)
    setError(null)
    try {
      await onStart(selected)
    } catch (startError: unknown) {
      setError(startError instanceof Error ? startError.message : 'Unable to start the Abyss.')
      setStarting(false)
    }
  }

  return (
    <section className="dashboard abyss-screen" aria-labelledby="abyss-title">
      <div className="dashboard-panel abyss-panel">
        <button className="secondary-action" type="button" onClick={onBack}>Back to dashboard</button>
        <p className="screen-kicker">Endless challenge</p>
        <h2 id="abyss-title">Infinite Abyss</h2>
        <p>
          Choose one completed Champion. The Abyss starts at floor 1 with enemies
          dealing and taking ten times the normal baseline.
        </p>
        {error ? <p className="persistence-error" role="alert">{error}</p> : null}
        {loadState === 'loading' ? (
          <p role="status">Loading available Champions…</p>
        ) : champions.length === 0 ? (
          <section className="champion-empty-state">
            <h3>No available Champions</h3>
            <p>Complete a dungeon and save the victorious build as a Champion first.</p>
          </section>
        ) : (
          <>
            <div className="abyss-champion-list">
              {champions.map((champion) => (
                <button
                  className={`champion-list-item${champion.championId === selectedId ? ' selected' : ''}`}
                  type="button"
                  aria-pressed={champion.championId === selectedId}
                  key={champion.championId}
                  onClick={() => setSelectedId(champion.championId)}
                >
                  <strong>{champion.name}</strong>
                  <span>{CHARACTER_CLASS_DEFINITIONS[champion.build.classId].name}</span>
                  <small>{champion.build.skills.length} skills preserved</small>
                </button>
              ))}
            </div>
            <div className="abyss-entry-card">
              <strong>Entry rules</strong>
              <ul>
                <li>One Champion replaces the active character.</li>
                <li>No normal level-up or gear choices.</li>
                <li>One persistent enemy modifier is chosen after each floor.</li>
                <li>The selected Champion will receive Abyss exhaustion when committed.</li>
              </ul>
            </div>
            <button
              className="primary-action"
              type="button"
              onClick={() => { void start() }}
              disabled={!selected || starting}
            >
              {starting ? 'Starting Abyss…' : 'Enter Infinite Abyss'}
            </button>
          </>
        )}
      </div>
    </section>
  )
}
