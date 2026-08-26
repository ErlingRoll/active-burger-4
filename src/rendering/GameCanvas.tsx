import { useEffect, useRef } from 'react'
import { createGame } from '../game'
import { PixiGame } from './PixiGame'

export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const game = createGame({ seed: 3 })
    game.spawnSlime({ x: 320, y: 0 })
    const pixiGame = new PixiGame(game)
    let disposed = false

    void pixiGame.initialize(container).catch((error: unknown) => {
      if (!disposed) {
        console.error('Unable to initialize the Pixi renderer.', error)
      }
    })

    return () => {
      disposed = true
      pixiGame.destroy()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="game-canvas"
      aria-label="Active Burger 4 game arena"
      role="img"
    />
  )
}
