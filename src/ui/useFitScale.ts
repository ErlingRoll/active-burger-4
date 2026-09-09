import { useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

/**
 * Shrinks a panel until it fits the box it was given.
 *
 * `clamp()` sized in `vh` carries most of the work on the gameplay screens, but
 * it can only budget for a typical amount of content. A level-up whose three
 * cards all happen to carry long descriptions is taller than one whose cards do
 * not, and on a 360x640 phone the difference is the Skip button sitting below
 * the fold — unreachable, on a screen with no scrollbar by design.
 *
 * This measures the two heights and scales the panel down by whatever the
 * shortfall actually is, rather than by a number picked in advance. It never
 * scales up: a panel that already fits is left at its authored size.
 *
 * `zoom` rather than `transform: scale()` because zoom reflows: the panel keeps
 * its place in the centred grid and its hit areas stay where they are drawn,
 * where a transform would leave the layout believing the old size.
 */
export function useFitScale<TElement extends HTMLElement>(
  ref: RefObject<TElement | null>,
  /** Changing this remeasures — pass whatever decides the content. */
  contentKey: string,
): number {
  const [scale, setScale] = useState(1)
  const scaleRef = useRef(1)

  useLayoutEffect(() => {
    const element = ref.current
    const container = element?.parentElement
    if (!element || !container) {
      return
    }

    const measure = (): void => {
      // Natural size is only observable unscaled, so the panel is returned to
      // its authored size for the measurement and scaled again from the result.
      element.style.zoom = '1'
      const containerStyle = window.getComputedStyle(container)
      const available = container.clientHeight -
        Number.parseFloat(containerStyle.paddingTop) -
        Number.parseFloat(containerStyle.paddingBottom)
      const natural = element.scrollHeight
      const next = natural <= 0 || available <= 0
        ? 1
        : Math.min(1, available / natural)
      element.style.zoom = String(next)
      if (Math.abs(next - scaleRef.current) > 0.005) {
        scaleRef.current = next
        // oxlint-disable-next-line react/set-state-in-effect
        setScale(next)
      }
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => { observer.disconnect() }
  }, [ref, contentKey])

  return scale
}
