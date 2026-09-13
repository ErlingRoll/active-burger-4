import type { ReactNode } from 'react'
import { HoverTooltip } from '../rendering/HoverTooltip'
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
 * The trigger is `HoverTooltip`'s: focusable, and a tap toggles it, since a
 * phone has no hover. The card itself takes no pointer events so a tap that
 * lands on it goes through to whatever is beneath, as the loot box card does.
 */
export function ResourceHover({ definitionId, quantity, className, children }: ResourceHoverProps) {
  const guide = getResourceGuide(definitionId)
  if (!guide) {
    return <span className={className}>{children}</span>
  }
  return (
    <HoverTooltip
      variant="resource-tooltip"
      className={className ? `resource-hover ${className}` : 'resource-hover'}
      card={(
        <>
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
        </>
      )}
    >
      {children}
    </HoverTooltip>
  )
}
