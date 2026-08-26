import { useCallback, useState } from 'react'
import type { RunResultSnapshot } from './game'
import { GameCanvas } from './rendering/GameCanvas'
import './App.css'

type AppScreen = 'dashboard' | 'gameplay' | 'results'

function formatElapsedTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(totalSeconds / 60)
  const remainder = totalSeconds % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

function App() {
  const [screen, setScreen] = useState<AppScreen>('dashboard')
  const [runId, setRunId] = useState(0)
  const [result, setResult] = useState<RunResultSnapshot | null>(null)

  const startRun = (): void => {
    setResult(null)
    setRunId((currentRunId) => currentRunId + 1)
    setScreen('gameplay')
  }

  const handleRunEnd = useCallback((runResult: RunResultSnapshot): void => {
    setResult(runResult)
    setScreen('results')
  }, [])

  const returnToDashboard = (): void => {
    setResult(null)
    setScreen('dashboard')
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="app-kicker">Active Burger 4</p>
        <h1>Prototype Arena</h1>
      </header>
      {screen === 'dashboard' ? <Dashboard onStart={startRun} /> : null}
      {screen === 'gameplay' ? (
        <GameCanvas key={runId} onRunEnd={handleRunEnd} />
      ) : null}
      {screen === 'results' && result ? (
        <ResultsScreen result={result} onReturn={returnToDashboard} />
      ) : null}
    </main>
  )
}

interface DashboardProps {
  onStart: () => void
}

function Dashboard({ onStart }: DashboardProps) {
  return (
    <section className="dashboard" aria-labelledby="dashboard-title">
      <div className="dashboard-panel">
        <p className="screen-kicker">Run dashboard</p>
        <h2 id="dashboard-title">Ready for your next run?</h2>
        <p>
          Survive the arena while your hero automatically targets nearby
          enemies. Collect XP to level up and choose an upgrade between waves.
        </p>
        <ul className="control-list">
          <li><strong>Movement:</strong> choose an automatic behavior profile in-run.</li>
          <li><strong>Combat:</strong> attacks happen automatically.</li>
          <li><strong>Upgrade:</strong> choose one option whenever you level up.</li>
        </ul>
        <button className="primary-action" type="button" onClick={onStart}>
          Start Run
        </button>
      </div>
    </section>
  )
}

interface ResultsScreenProps {
  result: RunResultSnapshot
  onReturn: () => void
}

function ResultsScreen({ result, onReturn }: ResultsScreenProps) {
  return (
    <section className="results-screen" aria-labelledby="results-title">
      <div className="results-panel">
        <p className="screen-kicker">Run complete</p>
        <h2 id="results-title">Defeat</h2>
        <p className="results-summary">Your run has ended. Here are your results.</p>
        <dl className="results-stats">
          <div>
            <dt>Elapsed time</dt>
            <dd>{formatElapsedTime(result.elapsedTime)}</dd>
          </div>
          <div>
            <dt>Level</dt>
            <dd>{result.level}</dd>
          </div>
          <div>
            <dt>XP</dt>
            <dd>{result.xp}</dd>
          </div>
          <div>
            <dt>Kills</dt>
            <dd>{result.killCount}</dd>
          </div>
        </dl>
        <button className="primary-action" type="button" onClick={onReturn}>
          Return to Dashboard
        </button>
      </div>
    </section>
  )
}

export default App
