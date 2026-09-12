import {
  getFishingRodModifierDetails,
  type FishingRodModifierDetail,
} from '../fishing/FishingContent'
import { getInventoryItemDefinition } from './ItemDefinitions'
import type { InventoryItemDefinitionId } from './InventoryTypes'

/**
 * A rod's card: every rolled modifier on its own line with its tier, the way
 * an artifact's card reads. Shared by the bag's tooltip and the stores
 * inspector so a rod reads the same everywhere; the one-line summary stays
 * for the places that only have room for a line, such as a slot's caption.
 *
 * It wears the artifact card's classes on purpose: the two are the same shape
 * of thing, and a second set of rules for the same picture would drift.
 */
interface FishingRodModifierListProps {
  definitionId: InventoryItemDefinitionId
  metadata: Record<string, unknown>
  /** Whether to open with the rod's flavour line. */
  showFlavor?: boolean
}

function formatRodModifierLine(modifier: FishingRodModifierDetail): string {
  return modifier.value === null ? modifier.label : `+${modifier.value}% ${modifier.label}`
}

export function FishingRodModifierList({
  definitionId,
  metadata,
  showFlavor = false,
}: FishingRodModifierListProps) {
  const flavorText = getInventoryItemDefinition(definitionId)?.flavorText ?? null
  const modifiers = getFishingRodModifierDetails(metadata)
  return (
    <div className="artifact-effects rod-modifiers">
      {showFlavor && flavorText ? (
        <p className="artifact-effects-flavor">{flavorText}</p>
      ) : null}
      {modifiers.length === 0 ? (
        <p className="rod-modifiers-empty">No modifiers</p>
      ) : (
        <ul className="artifact-effects-list">
          {modifiers.map((modifier) => (
            <li
              key={modifier.id}
              className="artifact-effect"
              data-kind="modifier"
              data-tier={modifier.tier ?? undefined}
              title={modifier.description}
            >
              <span className="artifact-effect-text">{formatRodModifierLine(modifier)}</span>
              {modifier.tier === null ? null : (
                <span className="artifact-effect-tier" title={`Tier ${modifier.tier} of 5, tier 1 is best`}>
                  T{modifier.tier}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
