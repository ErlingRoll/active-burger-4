import {
  describeCampLabourWorking,
  formatCampLabourSheet,
  type CampLabourSheet,
} from '../content/camp/CampLabour'

/**
 * The sheet as one line: "Tempo ×1.3 · Stamina 10h · Load ×1.1 · Fit ×1.05".
 *
 * The Champions page lists a Champion's sheet per job this way, one line
 * each, so gear can be weighed for the Camp as well as the run. The working
 * is on the title, for anyone who wants to know where a figure came from.
 * The Camp's own cards use `LabourSheetMeters`, which shows the same
 * figures with a bar under each.
 */
export function LabourSheetLine({ sheet }: { sheet: CampLabourSheet }) {
  return (
    <span className="camp-sheet-line" title={describeCampLabourWorking(sheet)}>
      {formatCampLabourSheet(sheet)}
    </span>
  )
}
