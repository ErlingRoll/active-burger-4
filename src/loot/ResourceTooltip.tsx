import { useEffect, useId, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  closeAllTooltips,
  registerTooltipCloser,
  tooltipClassName,
} from '../rendering/TooltipShell'
import { useAnchoredTooltip } from '../rendering/useAnchoredTooltip'
import { getResourceGuide } from './ResourceGuide'
import { getRewardIcon } from './RewardIcon'

interface ResourceHoverProps {
  /** The material or box the children stand for. */
  definitionId: string
  /** How many of it, when the place it is shown deals in a quantity. */
  quantity?: number
  className?: string
  children: ReactNode
}

/**
 * Wraps an icon-and-number so hovering it explains the resource.
 *
 * The card answers the three questions every resource tooltip answers, from
 * `ResourceGuide`: what it is, what it is for, where it comes from. An item
 * the guide does not know renders its children untouched, so a list that
 * mixes resources with other rewards can wrap every line the same way.
 *
 * The trigger is focusable and a tap toggles it, since a phone has no hover;
 * the card itself takes no pointer events so a tap that lands on it goes
 * through to whatever is beneath, as the loot box card does.
 */
export function ResourceHover({ definitionId, quantity, className, children }: ResourceHoverProps) {
  const guide = getResourceGuide(definitionId)
  const tooltipId = useId()
  const [open, setOpen] = useState(false)
  const { anchorRef, tooltipRef, style } = useAnchoredTooltip<HTMLSpanElement>(open && guide !== null)

  useEffect(() => registerTooltipCloser(() => {
    if (!open) {
      return false
    }
    setOpen(false)
    return true
  }), [open])

  if (!guide) {
    return <span className={className}>{children}</span>
  }

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

  return (
    <span
      className={className ? `resource-hover ${className}` : 'resource-hover'}
      ref={anchorRef}
      tabIndex={0}
      data-resource={definitionId}
      aria-describedby={open ? tooltipId : undefined}
      onMouseEnter={show}
      onMouseLeave={() => setOpen(false)}
      onFocus={show}
      onBlur={() => setOpen(false)}
      onClick={toggle}
      onKeyDown={onKeyDown}
    >
      {children}
      {open ? createPortal(
        <div
          className={tooltipClassName('resource-tooltip')}
          id={tooltipId}
          role="tooltip"
          ref={tooltipRef}
          style={style}
        >
          <header className="resource-tooltip-heading">
            <span className="resource-tooltip-icon" aria-hidden="true">{getRewardIcon(definitionId)}</span>
            <strong>{guide.name}</strong>
            {quantity !== undefined ? <span className="resource-tooltip-quantity">×{quantity}</span> : null}
          </header>
          <dl className="resource-tooltip-facts">
            <dt>What</dt>
            <dd>{guide.what}</dd>
            <dt>Used for</dt>
            <dd>{guide.usedFor}</dd>
            <dt>From</dt>
            <dd>{guide.source}</dd>
          </dl>
        </div>,
        document.body,
      ) : null}
    </span>
  )
}
