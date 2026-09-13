import { formatCampLabourSheet, type CampLabourSheet } from '../content/camp/CampLabour'
import { LabourSheetHover } from './LabourSheetHover'

/**
 * The sheet as one line: "Tempo ×1.3 · Stamina 10h · Load ×1.1 · Fit ×1.05".
 *
 * The Champions page lists a Champion's sheet per job this way, one line
 * each, so gear can be weighed for the Camp as well as the run. Hovering
 * the line shows the working. The Camp's own cards use `LabourSheetMeters`,
 * which shows the same figures with a bar under each.
 */
export function LabourSheetLine({ sheet }: { sheet: CampLabourSheet }) {
  return (
    <LabourSheetHover sheet={sheet} className="camp-sheet-line">
      {formatCampLabourSheet(sheet)}
    </LabourSheetHover>
  )
}
