import { useEffect, useRef, useState } from 'react'
import {
  createGame,
  type Game,
} from '../game'
import { xpRequiredForNextLevel } from '../content/progression/XpBalance'
import type {
  UpgradeChoice,
  UpgradeId,
} from '../content/upgrades/Upgrades'
import { LevelUpOverlay } from './LevelUpOverlay'
import { PixiGame } from './PixiGame'

export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Game | null>(null)
  const [levelUp, setLevelUp] = useState<{
    level: number
    choices: readonly UpgradeChoice[]
  } | null>(null)
  const [phase, setPhase] = useState('playing')

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const game = createGame({ seed: 3 })
    const pixiGame = new PixiGame(game)
    let disposed = false
    gameRef.current = game
    setLevelUp(null)
    setPhase(game.phase)

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

      setPhase(game.phase)
      if (game.phase === 'level-up') {
        setLevelUp({
          level: game.state.player.level,
          choices: game.getPendingUpgradeChoices(),
        })
      } else {
        setLevelUp(null)
      }
    })

    void pixiGame.initialize(container).catch((error: unknown) => {
      if (!disposed) {
        console.error('Unable to initialize the Pixi renderer.', error)
      }
    })

    return () => {
      disposed = true
      unsubscribe()
      if (gameRef.current === game) {
        gameRef.current = null
      }
      pixiGame.destroy()
    }
  }, [])

  const selectUpgrade = (upgradeId: UpgradeId): void => {
    gameRef.current?.selectUpgrade(upgradeId)
  }

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
