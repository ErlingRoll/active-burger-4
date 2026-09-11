import { formatCampLabourSheet, type CampLabourSheet } from '../content/camp/CampLabour'

/**
 * The sheet as one line: "Tempo ×1.3 · Stamina 10h · Load ×1.1 · Fit ×1.05".
 *
 * Shown wherever a player chooses who works, so gear matters twice: once in
 * the run that won the Champion, and again here. The working is on the
 * title, for anyone who wants to know where a figure came from.
 */
export function LabourSheetLine({ sheet }: { sheet: CampLabourSheet }) {
  const { inputs } = sheet
  const working = [
    `Level ${inputs.level}, floor ${inputs.floor}: strength ×${sheet.strength}`,
    `Attack speed +${inputs.attackSpeedPercent}%`,
    `Max HP +${inputs.maxHpFlat}`,
    `Increased damage +${inputs.increasedDamagePercent}%`,
    `Critical chance ${inputs.critChancePercent}% → bonus ${Math.round(sheet.bonusChance * 100)}%`,
    `Set pieces ${inputs.setRarityWeight}, tagged skill levels ${inputs.tagLevelWeight}`,
    `Output ×${sheet.output}`,
  ].join('\n')
  return (
    <span className="camp-sheet-line" title={working}>
      {formatCampLabourSheet(sheet)}
    </span>
  )
}
