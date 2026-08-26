import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  createGame,
  MAX_TIME_SCALE,
  MIN_TIME_SCALE,
  type Game,
  type GameUiSnapshot,
  type RunResultSnapshot,
} from '../game'
import { xpRequiredForNextLevel } from '../content/progression/XpBalance'
import type {
  UpgradeChoice,
  UpgradeId,
} from '../content/upgrades/Upgrades'
import { LevelUpOverlay } from './LevelUpOverlay'
import { PixiGame } from './PixiGame'

interface GameCanvasProps {
  onRunEnd: (result: RunResultSnapshot) => void
}

const UI_UPDATE_INTERVAL_MS = 100

function formatElapsedTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(totalSeconds / 60)
  const remainder = totalSeconds % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

export function GameCanvas({ onRunEnd }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Game | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [snapshot, setSnapshot] = useState<GameUiSnapshot | null>(null)
  const [levelUp, setLevelUp] = useState<{
    level: number
    choices: readonly UpgradeChoice[]
  } | null>(null)

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const game = createGame({ seed: 3 })
    const pixiGame = new PixiGame(game)
    let disposed = false
    let defeatNotified = false
    gameRef.current = game
    setGame(game)

    const publishSnapshot = (): void => {
      if (!disposed) {
        setSnapshot(game.getUiSnapshot())
      }
    }

    publishSnapshot()
    setLevelUp(null)

    // This deterministic setup is only for browser smoke tests and local
    // development; normal runs retain the standard combat-driven progression.
    if (
      import.meta.env.DEV &&
      new URLSearchParams(window.location.search).get('demo') === 'level-up'
    ) {
      game.spawnXpPickup({ x: 0, y: 0 }, xpRequiredForNextLevel(1))
    }

    const unsubscribe = game.subscribe(() => {
      if (disposed) {
        return
      }

      // Phase changes are published immediately so the level-up overlay never
      // waits for the throttled HUD interval.
      publishSnapshot()
      if (game.phase === 'level-up') {
        const uiSnapshot = game.getUiSnapshot()
        setLevelUp({
          level: uiSnapshot.level,
          choices: game.getPendingUpgradeChoices(),
        })
      } else {
        setLevelUp(null)
      }

      if (game.phase === 'defeat' && !defeatNotified) {
        defeatNotified = true
        onRunEnd(game.getRunResultSnapshot())
      }
    })

    const snapshotTimer = window.setInterval(
      publishSnapshot,
      UI_UPDATE_INTERVAL_MS,
    )

    void pixiGame.initialize(container).catch((error: unknown) => {
      if (!disposed) {
        console.error('Unable to initialize the Pixi renderer.', error)
      }
    })

    return () => {
      disposed = true
      window.clearInterval(snapshotTimer)
      unsubscribe()
      if (gameRef.current === game) {
        gameRef.current = null
      }
      setGame(null)
      pixiGame.destroy()
    }
  }, [onRunEnd])

  const selectUpgrade = (upgradeId: UpgradeId): void => {
    gameRef.current?.selectUpgrade(upgradeId)
  }

  const phase = snapshot?.phase ?? 'loading'

  return (
    <div
      className="game-canvas"
      data-game-phase={phase}
    >
      <div
        ref={containerRef}
        className="game-renderer"
        aria-label="Active Burger 4 game arena"
        role="img"
      />
      {snapshot ? <GameplayHud snapshot={snapshot} /> : null}
      {import.meta.env.DEV && snapshot && game ? (
        <DevelopmentMenu game={game} snapshot={snapshot} />
      ) : null}
      {levelUp ? (
        <LevelUpOverlay
          level={levelUp.level}
          choices={levelUp.choices}
          onSelect={selectUpgrade}
        />
      ) : null}
    </div>
  )
}

interface GameplayHudProps {
  snapshot: GameUiSnapshot
}

function GameplayHud({ snapshot }: GameplayHudProps) {
  const hp = Math.max(0, Math.min(snapshot.hp, snapshot.maxHp))
  const xpPercent = snapshot.xpProgress * 100

  return (
    <section className="gameplay-hud" aria-labelledby="run-status-title">
      <h2 id="run-status-title" className="visually-hidden">
        Run status
      </h2>
      <dl className="hud-stats">
        <div className="hud-stat hud-health">
          <dt>HP</dt>
          <dd>
            <progress value={hp} max={snapshot.maxHp} aria-label="Player health" />
            <span>{Math.ceil(hp)} / {snapshot.maxHp}</span>
          </dd>
        </div>
        <div className="hud-stat">
          <dt>Level</dt>
          <dd>{snapshot.level}</dd>
        </div>
        <div className="hud-stat hud-xp">
          <dt>XP</dt>
          <dd>
            <progress value={xpPercent} max={100} aria-label="Experience progress" />
            <span>{snapshot.xp} / {snapshot.xpRequired}</span>
          </dd>
        </div>
        <div className="hud-stat">
          <dt>Time</dt>
          <dd>{formatElapsedTime(snapshot.elapsedTime)}</dd>
        </div>
        <div className="hud-stat">
          <dt>Kills</dt>
          <dd>{snapshot.killCount}</dd>
        </div>
      </dl>
    </section>
  )
}

interface DevelopmentMenuProps {
  game: Game
  snapshot: GameUiSnapshot
}

function DevelopmentMenu({ game, snapshot }: DevelopmentMenuProps) {
  const [open, setOpen] = useState(false)
  const [timeScaleInput, setTimeScaleInput] = useState(() =>
    game.timeScale.toString(),
  )
  const [timeScaleError, setTimeScaleError] = useState<string | null>(null)

  const handleTimeScaleChange = (
    event: ChangeEvent<HTMLInputElement>,
  ): void => {
    const input = event.target.value
    setTimeScaleInput(input)

    if (input.trim() === '') {
      setTimeScaleError('Enter a simulation speed.')
      return
    }

    const value = Number(input)
    if (!Number.isFinite(value)) {
      setTimeScaleError('Simulation speed must be a finite number.')
      return
    }

    const result = game.setTimeScale(value)
    if (!result.ok) {
      setTimeScaleError(result.error)
      return
    }

    setTimeScaleError(null)
  }

  return (
    <div className="development-controls">
      <button
        className="development-menu-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="development-menu"
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        Development Menu
      </button>
      {open ? (
        <section
          className="development-menu"
          id="development-menu"
          aria-labelledby="development-menu-title"
        >
          <p className="development-kicker">Development-only controls</p>
          <h2 id="development-menu-title">Development Menu</h2>
          <div className="time-scale-control">
            <label htmlFor="time-scale-input">Simulation speed</label>
            <div className="time-scale-input-row">
              <input
                id="time-scale-input"
                type="number"
                min={MIN_TIME_SCALE}
                max={MAX_TIME_SCALE}
                step={0.1}
                value={timeScaleInput}
                aria-invalid={timeScaleError !== null}
                aria-describedby={
                  timeScaleError ? 'time-scale-error' : 'time-scale-help'
                }
                onChange={handleTimeScaleChange}
              />
              <span aria-hidden="true">x</span>
            </div>
            {timeScaleError ? (
              <p className="input-error" id="time-scale-error" role="alert">
                {timeScaleError}
              </p>
            ) : (
              <p className="input-help" id="time-scale-help">
                Applied: {game.timeScale}x (range {MIN_TIME_SCALE}x–
                {MAX_TIME_SCALE}x)
              </p>
            )}
          </div>
          <button
            className="end-run-button"
            type="button"
            onClick={() => game.endRun()}
            disabled={snapshot.phase !== 'playing'}
          >
            End Run
          </button>
        </section>
      ) : null}
    </div>
  )
}
