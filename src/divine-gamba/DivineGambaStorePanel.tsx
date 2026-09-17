import { MaterialIcon } from '../inventory/MaterialIcon'
import { EssenceAmount } from '../ui/EssenceMark'
import {
  ALL_DIVINE_GAMBA_PART_DEFINITIONS,
  getDivineGambaPartDefinition,
  type DivineGambaPartDefinition,
} from './DivineGambaRegistry'
import { DIVINE_GAMBA_STORE_KICKER, DIVINE_GAMBA_STORE_LEDE, DIVINE_GAMBA_STORE_NAME } from './DivineGambaNaming'

interface DivineGambaStorePanelProps {
  ownedPartIds: ReadonlySet<string>
  enabledModifierIds: ReadonlySet<string>
  essenceBalance: number | null
  shardBalance: number
  busyPartId: string | null
  /** Buying and toggling are held while a drop is in flight. */
  locked: boolean
  onBuy: (definition: DivineGambaPartDefinition) => void
  onToggleModifier: (partId: string, enabled: boolean) => void
}

/**
 * The Shardwright's shelf.
 *
 * Two lists of the same row: parts, fitted for good, and modifiers, owned and
 * switched on before a drop. A row says what it does, what it costs in both
 * currencies, and what it needs first, and the button on it is the only
 * thing that changes between the three states a row can be in.
 */
export function DivineGambaStorePanel({
  ownedPartIds,
  enabledModifierIds,
  essenceBalance,
  shardBalance,
  busyPartId,
  locked,
  onBuy,
  onToggleModifier,
}: DivineGambaStorePanelProps) {
  const parts = ALL_DIVINE_GAMBA_PART_DEFINITIONS.filter((definition) => definition.kind === 'part')
  const modifiers = ALL_DIVINE_GAMBA_PART_DEFINITIONS.filter((definition) => definition.kind === 'modifier')

  const renderLine = (definition: DivineGambaPartDefinition) => {
    const owned = ownedPartIds.has(definition.id)
    const required = definition.requiresPartId === null ? null : getDivineGambaPartDefinition(definition.requiresPartId)
    const missingRequirement = definition.requiresPartId !== null && !ownedPartIds.has(definition.requiresPartId)
    const affordable = essenceBalance !== null &&
      essenceBalance >= definition.essenceCost && shardBalance >= definition.shardCost
    const busy = busyPartId === definition.id
    const enabled = enabledModifierIds.has(definition.id)
    return (
      <li className="divine-gamba-store-line" key={definition.id} data-owned={owned ? 'true' : 'false'}>
        <div className="divine-gamba-store-copy">
          <strong>{definition.name}</strong>
          <small>{definition.description}</small>
          {definition.pricePercent > 0 ? (
            <small className="divine-gamba-store-surcharge">+{definition.pricePercent}% on every ball while on</small>
          ) : null}
          {!owned && missingRequirement && required !== undefined ? (
            <small className="divine-gamba-store-requirement">Needs {required?.name ?? definition.requiresPartId}</small>
          ) : null}
        </div>
        {owned ? null : (
          <span className="divine-gamba-store-price">
            <EssenceAmount value={definition.essenceCost} />
            <span className="divine-gamba-store-shards" aria-label={`${definition.shardCost} rift shards`}>
              <MaterialIcon icon="rift-shard" />
              <strong aria-hidden="true">{definition.shardCost}</strong>
            </span>
          </span>
        )}
        {owned && definition.kind === 'modifier' ? (
          <label className="divine-gamba-toggle">
            <input
              type="checkbox"
              checked={enabled}
              disabled={locked}
              onChange={(event) => onToggleModifier(definition.id, event.target.checked)}
            />
            <span>{enabled ? 'On' : 'Off'}</span>
          </label>
        ) : owned ? (
          <span className="divine-gamba-store-installed">Fitted</span>
        ) : (
          <button
            className="secondary-action divine-gamba-store-action"
            type="button"
            disabled={locked || busy || busyPartId !== null || missingRequirement || !affordable}
            onClick={() => onBuy(definition)}
          >
            {busy ? 'Buying…' : 'Buy'}
          </button>
        )}
      </li>
    )
  }

  return (
    <section className="app-panel divine-gamba-store-panel" aria-labelledby="divine-gamba-store-title">
      <header className="app-panel-heading">
        <div>
          <p className="screen-kicker">{DIVINE_GAMBA_STORE_KICKER}</p>
          <h3 id="divine-gamba-store-title">{DIVINE_GAMBA_STORE_NAME}</h3>
        </div>
        <span className="app-panel-meta">Essence and rift shards</span>
      </header>
      <p className="divine-gamba-store-lede">{DIVINE_GAMBA_STORE_LEDE}</p>
      <h4 className="divine-gamba-store-group">Parts</h4>
      <ul className="divine-gamba-store-list">{parts.map(renderLine)}</ul>
      <h4 className="divine-gamba-store-group">Modifiers</h4>
      <ul className="divine-gamba-store-list">{modifiers.map(renderLine)}</ul>
    </section>
  )
}
