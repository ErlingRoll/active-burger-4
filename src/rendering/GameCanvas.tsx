import { useEffect, useRef } from 'react'
import { PixiGame } from './PixiGame'

export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const pixiGame = new PixiGame()
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
