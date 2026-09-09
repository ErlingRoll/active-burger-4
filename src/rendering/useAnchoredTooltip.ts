import { useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'

/**
 * Places a portalled tooltip beside the thing it describes.
 *
 * Tooltips are rendered into `document.body` so that a slot inside an
 * `overflow: hidden` panel can still show one, which means nothing positions
 * them for free. This puts the card above its anchor when there is room and
 * below it when there is not, and keeps it inside the viewport on both axes,
 * so a slot in the last column does not push its own description off-screen.
 *
 * Measuring happens in a layout effect, before paint, or the card would be
 * seen at the origin for a frame before jumping into place.
 */
export interface AnchoredTooltip<TAnchor extends HTMLElement> {
  anchorRef: RefObject<TAnchor | null>
  tooltipRef: RefObject<HTMLDivElement | null>
  style: CSSProperties
}

/** Clearance from the viewport edge, and from the anchor, in pixels. */
const VIEWPORT_MARGIN = 12
const ANCHOR_GAP = 10

export function useAnchoredTooltip<TAnchor extends HTMLElement>(
  isOpen: boolean,
): AnchoredTooltip<TAnchor> {
  const anchorRef = useRef<TAnchor | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const [style, setStyle] = useState<CSSProperties>({})

  useLayoutEffect(() => {
    const anchor = anchorRef.current
    const tooltip = tooltipRef.current
    if (!isOpen || !anchor || !tooltip) {
      return
    }

    const updatePosition = (): void => {
      const anchorBox = anchor.getBoundingClientRect()
      const tooltipBox = tooltip.getBoundingClientRect()
      const maxLeft = Math.max(
        VIEWPORT_MARGIN,
        window.innerWidth - VIEWPORT_MARGIN - tooltipBox.width,
      )
      const maxTop = Math.max(
        VIEWPORT_MARGIN,
        window.innerHeight - VIEWPORT_MARGIN - tooltipBox.height,
      )
      const left = Math.min(
        maxLeft,
        Math.max(
          VIEWPORT_MARGIN,
          anchorBox.left + anchorBox.width / 2 - tooltipBox.width / 2,
        ),
      )
      const top = anchorBox.top - tooltipBox.height - ANCHOR_GAP >= VIEWPORT_MARGIN
        ? anchorBox.top - tooltipBox.height - ANCHOR_GAP
        : Math.min(maxTop, anchorBox.bottom + ANCHOR_GAP)
      setStyle({ left: `${left}px`, top: `${top}px` })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isOpen])

  return { anchorRef, tooltipRef, style }
}
