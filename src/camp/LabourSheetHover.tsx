import type { ReactNode } from 'react'
import { describeCampLabourWorking, type CampLabourSheet } from '../content/camp/CampLabour'
import { HoverTooltip } from '../rendering/HoverTooltip'

interface LabourSheetHoverProps {
  sheet: CampLabourSheet
  /**
   * `hover` for a trigger inside a button, such as a picker option, whose tap
   * must still pick; `toggle` elsewhere, so a phone can tap for the working.
   */
  mode?: 'toggle' | 'hover'
  className?: string
  children: ReactNode
}

/**
 * Wraps a sheet, as meters or as a line, so hovering it shows the working:
 * every input the formula read and the output it made of them.
 */
export function LabourSheetHover({ sheet, mode, className, children }: LabourSheetHoverProps) {
  return (
    <HoverTooltip
      variant="labour-sheet-tooltip"
      mode={mode}
      className={className}
      card={(
        <>
          <strong className="labour-sheet-tooltip-heading">The working</strong>
          <dl className="labour-sheet-tooltip-rows">
            {describeCampLabourWorking(sheet).map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>{' '}
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    >
      {children}
    </HoverTooltip>
  )
}
