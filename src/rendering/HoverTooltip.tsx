import { useEffect, useId, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  closeAllTooltips,
  registerTooltipCloser,
  tooltipClassName,
  type TooltipVariant,
} from './TooltipShell'
import { useAnchoredTooltip } from './useAnchoredTooltip'

interface HoverTooltipProps {
  /** The tooltip's variant class, which carries its size and layout. */
  variant: TooltipVariant
  /** What the card says. */
  card: ReactNode
  /** Classes for the trigger, the span the children sit in. */
  className?: string
  /**
   * How the trigger opens. `toggle`, the default, is a focusable trigger that
   * a hover, a focus or a tap opens, for a phone as much as a desktop.
   * `hover` opens on the pointer alone and takes no focus or click of its
   * own, for a trigger inside a button whose tap must still go to the button.
   */
  mode?: 'toggle' | 'hover'
  children: ReactNode
}

/**
 * Wraps a thing so hovering it shows a card explaining it.
 *
 * The one trigger every hover tooltip shares: the card is portalled into the
 * body and placed by `useAnchoredTooltip`, so a trigger inside an
 * `overflow: hidden` panel can still show it; it closes on Escape with every
 * other tooltip; and a tap toggles it, since a phone has no hover. Use it
 * rather than a native `title`, which is unstyled, slow and invisible on a
 * phone.
 */
export function HoverTooltip({ variant, card, className, mode = 'toggle', children }: HoverTooltipProps) {
  const tooltipId = useId()
  const [open, setOpen] = useState(false)
  const { anchorRef, tooltipRef, style } = useAnchoredTooltip<HTMLSpanElement>(open)

  useEffect(() => registerTooltipCloser(() => {
    if (!open) {
      return false
    }
    setOpen(false)
    return true
  }), [open])

  const show = (): void => {
    closeAllTooltips()
    setOpen(true)
  }

  const toggle = (event: ReactMouseEvent<HTMLSpanElement>): void => {
    event.preventDefault()
    event.stopPropagation()
    if (open) {
      setOpen(false)
    } else {
      show()
    }
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLSpanElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      event.stopPropagation()
      if (open) {
        setOpen(false)
      } else {
        show()
      }
    }
  }

  const toggles = mode === 'toggle'
  return (
    <span
      className={className}
      ref={anchorRef}
      tabIndex={toggles ? 0 : undefined}
      aria-describedby={open ? tooltipId : undefined}
      onMouseEnter={show}
      onMouseLeave={() => setOpen(false)}
      onFocus={toggles ? show : undefined}
      onBlur={toggles ? () => setOpen(false) : undefined}
      onClick={toggles ? toggle : undefined}
      onKeyDown={toggles ? onKeyDown : undefined}
    >
      {children}
      {open ? createPortal(
        <div
          className={tooltipClassName(variant)}
          id={tooltipId}
          role="tooltip"
          ref={tooltipRef}
          style={style}
        >
          {card}
        </div>,
        document.body,
      ) : null}
    </span>
  )
}
