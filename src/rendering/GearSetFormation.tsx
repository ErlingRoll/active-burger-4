import type { GearSetHudSnapshot } from '../game/ui/Snapshots'

export function GearSetFormation({
  set,
  equippedPieces = set.equippedPieces,
}: {
  set: GearSetHudSnapshot
  equippedPieces?: number
}) {
  return (
    <section className="gear-set-formation" aria-label={`${set.name} set bonuses`}>
      <div className="gear-set-formation-header">
        <strong>{set.name} Set</strong>
        <span>{equippedPieces}/{set.pieceCount}</span>
      </div>
      <ul>
        {set.bonuses.map((bonus) => (
          <li
            className={bonus.requiredPieces <= equippedPieces ? 'active' : undefined}
            key={`${set.setId}-${bonus.requiredPieces}`}
          >
            {bonus.requiredPieces}pc: {bonus.label}
          </li>
        ))}
      </ul>
    </section>
  )
}
