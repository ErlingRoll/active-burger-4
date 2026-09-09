import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

/**
 * Steering by thumb.
 *
 * The arena had exactly one manual input, WASD, which a phone does not have.
 * Rather than spend a corner of a small screen on a permanent pad, the stick is
 * drawn where the finger lands and disappears when it lifts, so it costs the
 * layout nothing and works the same in portrait, in landscape and on a
 * desktop with a mouse.
 *
 * Dragging is a temporary takeover. The character otherwise plays itself
 * through a behaviour profile, so holding the screen steers and letting go
 * hands it back — unless the player has already chosen free movement, in which
 * case the stick is simply the input.
 */

const STICK_RADIUS_PX = 56
/** Below this the direction is noise rather than intent. */
const DEAD_ZONE_PX = 8

interface StickState {
  readonly pointerId: number
  readonly originX: number
  readonly originY: number
  readonly x: number
  readonly y: number
}

export interface TouchControlsProps {
  /** Called once when a drag begins, before the first direction. */
  onSteerStart: () => void
  /** A unit direction, or zero inside the dead zone. */
  onSteer: (directionX: number, directionY: number) => void
  /** Called when the drag ends, however it ends. */
  onSteerEnd: () => void
}

export function TouchControls({ onSteerStart, onSteer, onSteerEnd }: TouchControlsProps) {
  const [stick, setStick] = useState<StickState | null>(null)
  // The window listeners below are registered once per drag and would otherwise
  // close over the callbacks they saw when the drag began. Kept current in an
  // effect rather than during render, which is not a safe place to write a ref.
  const callbacks = useRef({ onSteerStart, onSteer, onSteerEnd })
  useEffect(() => {
    callbacks.current = { onSteerStart, onSteer, onSteerEnd }
  }, [onSteerStart, onSteer, onSteerEnd])

  // Move and release are tracked on the window rather than the surface: a
  // finger that slides over a HUD panel, or off the edge of the screen, is
  // still steering, and losing the pointer there would leave the character
  // walking into a wall.
  useEffect(() => {
    if (stick === null) {
      return
    }

    const publish = (x: number, y: number): void => {
      const offsetX = x - stick.originX
      const offsetY = y - stick.originY
      const distance = Math.hypot(offsetX, offsetY)
      if (distance < DEAD_ZONE_PX) {
        callbacks.current.onSteer(0, 0)
        return
      }
      callbacks.current.onSteer(offsetX / distance, offsetY / distance)
    }

    const handleMove = (event: PointerEvent): void => {
      if (event.pointerId !== stick.pointerId) {
        return
      }
      event.preventDefault()
      setStick((current) =>
        current === null
          ? current
          : { ...current, x: event.clientX, y: event.clientY },
      )
      publish(event.clientX, event.clientY)
    }

    const handleRelease = (event: PointerEvent): void => {
      if (event.pointerId !== stick.pointerId) {
        return
      }
      setStick(null)
      callbacks.current.onSteer(0, 0)
      callbacks.current.onSteerEnd()
    }

    window.addEventListener('pointermove', handleMove, { passive: false })
    window.addEventListener('pointerup', handleRelease)
    window.addEventListener('pointercancel', handleRelease)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleRelease)
      window.removeEventListener('pointercancel', handleRelease)
    }
  }, [stick])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (stick !== null || event.button !== 0) {
      return
    }
    event.preventDefault()
    setStick({
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      x: event.clientX,
      y: event.clientY,
    })
    callbacks.current.onSteerStart()
    callbacks.current.onSteer(0, 0)
  }

  const knob = (() => {
    if (stick === null) {
      return { x: 0, y: 0 }
    }
    const offsetX = stick.x - stick.originX
    const offsetY = stick.y - stick.originY
    const distance = Math.hypot(offsetX, offsetY)
    if (distance <= STICK_RADIUS_PX) {
      return { x: offsetX, y: offsetY }
    }
    return {
      x: (offsetX / distance) * STICK_RADIUS_PX,
      y: (offsetY / distance) * STICK_RADIUS_PX,
    }
  })()

  return (
    <div
      className="arena-steering"
      data-steering={stick === null ? 'idle' : 'active'}
      onPointerDown={handlePointerDown}
      onContextMenu={(event) => event.preventDefault()}
    >
      {stick === null ? null : (
        <div
          className="arena-stick"
          aria-hidden="true"
          style={{ left: `${stick.originX}px`, top: `${stick.originY}px` }}
        >
          <span
            className="arena-stick-knob"
            style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
          />
        </div>
      )}
    </div>
  )
}
