import type { ReactNode } from 'react'
import { HoverTooltip } from './HoverTooltip'

interface HintHoverProps {
  /** The one line the card says. Without one the children render plain, so a
   *  conditional hint keeps its layout. */
  hint?: string
  /** Classes for the trigger span. */
  className?: string
  /** `hover` when the trigger wraps a button that must keep its own tap. */
  mode?: 'toggle' | 'hover'
  children: ReactNode
}

/**
 * A one-line hint behind a thing, where a native `title` would once have
 * gone.
 *
 * The browser's own tooltip is unstyled, slow, and never appears on a phone,
 * so the project does not use it; `tests/nativeTooltips.test.ts` fails the
 * build on one. This is the drop-in for the plain cases, a sentence and no
 * more: a build stamp, a tier mark, a strapline under a door. Anything that
 * needs a heading, an icon or a list gets its own tooltip variant instead.
 */
export function HintHover({ hint, className, mode, children }: HintHoverProps) {
  if (hint === undefined) {
    return <span className={className}>{children}</span>
  }
  return (
    <HoverTooltip variant="hint-tooltip" mode={mode} className={className} card={hint}>
      {children}
    </HoverTooltip>
  )
}
