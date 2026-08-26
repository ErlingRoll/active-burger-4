import { useEffect, useRef, useState } from 'react'
import {
  createGame,
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
      {snapshot ? <GameplayHud snapshot={snapshot} onEndRun={() => gameRef.current?.endRun()} /> : null}
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
  onEndRun: () => void
}

function GameplayHud({ snapshot, onEndRun }: GameplayHudProps) {
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
      <button
        className="end-run-button"
        type="button"
        onClick={onEndRun}
        disabled={snapshot.phase !== 'playing'}
      >
        End Run
      </button>
    </section>
  )
}
