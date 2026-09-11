import type { CampLabourSheet } from '../content/camp/CampLabour'

/**
 * The sheet as four small meters: tempo, stamina, load and fit, each filled
 * across the range the formula can reach. A row of Champions can be read
 * against each other at a glance this way, where a line of numbers has to
 * be read one figure at a time. The numbers still stand under the meters,
 * in `LabourSheetLine`; the meters are decoration for the eye and say
 * nothing a reader does not get from the line.
 */

interface MeterSpec {
  label: string
  value: number
  min: number
  max: number
}

function metersFor(sheet: CampLabourSheet): readonly MeterSpec[] {
  return [
    { label: 'Tempo', value: sheet.tempo, min: 1, max: 2 },
    { label: 'Stamina', value: sheet.staminaHours, min: 6, max: 12 },
    { label: 'Load', value: sheet.load, min: 1, max: 2 },
    { label: 'Fit', value: sheet.fit, min: 1, max: 1.25 },
  ]
}

export function LabourSheetMeters({ sheet }: { sheet: CampLabourSheet }) {
  return (
    <span className="camp-sheet-meters" aria-hidden="true">
      {metersFor(sheet).map((meter) => {
        const share = Math.max(0, Math.min(1, (meter.value - meter.min) / (meter.max - meter.min)))
        return (
          <span key={meter.label} className="camp-sheet-meter" data-share={share >= 0.66 ? 'high' : share >= 0.33 ? 'mid' : 'low'}>
            <small>{meter.label}</small>
            <i style={{ width: `${Math.round(8 + share * 92)}%` }} />
          </span>
        )
      })}
    </span>
  )
}
