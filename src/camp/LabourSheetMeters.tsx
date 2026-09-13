import {
  describeCampLabourWorking,
  formatCampLabourFigures,
  type CampLabourFigure,
  type CampLabourSheet,
} from '../content/camp/CampLabour'

/**
 * The sheet as four small meters: tempo, stamina, load and fit, each a label
 * and its figure over a bar filled across the range the formula can reach.
 * A row of Champions can be read against each other at a glance by the bars,
 * where a line of numbers has to be read one figure at a time; the figure
 * itself stands on the meter, so nothing is said twice. The working is on
 * the title, for anyone who wants to know where a figure came from.
 */

const METER_RANGES: Readonly<Record<CampLabourFigure['label'], { readonly min: number, readonly max: number }>> = {
  Tempo: { min: 1, max: 2 },
  Stamina: { min: 6, max: 12 },
  Load: { min: 1, max: 2 },
  Fit: { min: 1, max: 1.25 },
}

function meterValue(sheet: CampLabourSheet, label: CampLabourFigure['label']): number {
  switch (label) {
    case 'Tempo': return sheet.tempo
    case 'Stamina': return sheet.staminaHours
    case 'Load': return sheet.load
    case 'Fit': return sheet.fit
  }
}

export function LabourSheetMeters({ sheet }: { sheet: CampLabourSheet }) {
  return (
    <span className="camp-sheet-meters" title={describeCampLabourWorking(sheet)}>
      {formatCampLabourFigures(sheet).map((figure) => {
        const { min, max } = METER_RANGES[figure.label]
        const share = Math.max(0, Math.min(1, (meterValue(sheet, figure.label) - min) / (max - min)))
        return (
          <span key={figure.label} className="camp-sheet-meter" data-share={share >= 0.66 ? 'high' : share >= 0.33 ? 'mid' : 'low'}>
            <small>{figure.label}</small>{' '}
            <b>{figure.value}</b>{' '}
            <i aria-hidden="true" style={{ width: `${Math.round(8 + share * 92)}%` }} />
          </span>
        )
      })}
    </span>
  )
}
