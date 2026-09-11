import { useMemo, useState } from 'react'
import { FishIcon } from '../fishing/FishIcon'
import {
  formatFishSizeKg,
  getChampionRevivalReductionSeconds,
  getFishDefinition,
} from '../fishing/FishingContent'
import {
  getInventoryItemDefinition,
  type InventoryItemInstance,
} from '../inventory'
import { formatRevivalReduction } from './ChampionExhaustion'

export const REVIVAL_FISH_DEFINITION_ID = 'revival-koi'

export type RevivalFishLoadState = 'loading' | 'ready' | 'error'

export interface ChampionRevivalControlProps {
  /** Namespaces the picker's ids, so two controls on one page never collide. */
  championId: string
  /** The whole fish inventory; the control picks out the Revival Koi itself. */
  fish: InventoryItemInstance[]
  fishLoadState: RevivalFishLoadState
  fishLoadError: string | null
  saving: boolean
  error: string | null
  onRevive: (fish: InventoryItemInstance) => void
}

/**
 * The Revive button and the Revival Koi picker it opens.
 *
 * One control serves both the champions page and the Abyss run setup, so an
 * exhausted Champion is revived the same way wherever the player meets it.
 * Render it as the header action of `ChampionDetails`, and key it by Champion
 * so the picker closes when the selection changes.
 */
export function ChampionRevivalControl({
  championId,
  fish,
  fishLoadState,
  fishLoadError,
  saving,
  error,
  onRevive,
}: ChampionRevivalControlProps) {
  const [open, setOpen] = useState(false)
  const revivalFish = useMemo(
    () => fish
      .filter((item) => item.definitionId === REVIVAL_FISH_DEFINITION_ID && item.quantity > 0)
      .sort((left, right) => {
        const reductionDifference =
          getChampionRevivalReductionSeconds(right.metadata) -
          getChampionRevivalReductionSeconds(left.metadata)
        return reductionDifference || left.itemInstanceId.localeCompare(right.itemInstanceId)
      }),
    [fish],
  )
  const pickerId = `champion-revival-picker-${championId}`
  return (
    <div className="champion-revival-control">
      <button
        className="champion-revive-trigger"
        type="button"
        aria-expanded={open}
        aria-controls={pickerId}
        onClick={() => setOpen((current) => !current)}
        disabled={saving}
      >
        {saving ? 'Reviving…' : 'Revive'}
      </button>
      {open ? (
        <div
          className="champion-revival-dropdown"
          id={pickerId}
          role="region"
          aria-label="Choose a Revival Koi"
        >
          <strong>Choose a Revival Koi</strong>
          {error ? <small role="alert">{error}</small> : null}
          {fishLoadState === 'loading' ? (
            <p>Loading Revival Koi…</p>
          ) : fishLoadState === 'error' ? (
            <small role="alert">{fishLoadError ?? 'Fish inventory is unavailable.'}</small>
          ) : revivalFish.length > 0 ? (
            <div className="champion-revival-list" aria-label="Available Revival Koi">
              {revivalFish.map((item) => {
                const definition = getFishDefinition(item.definitionId)
                const itemName = getInventoryItemDefinition(item.definitionId)?.name ?? item.definitionId
                const reduction = getChampionRevivalReductionSeconds(item.metadata)
                return (
                  <button
                    className="champion-revival-action champion-revival-option"
                    type="button"
                    key={item.itemInstanceId}
                    onClick={() => {
                      setOpen(false)
                      onRevive(item)
                    }}
                    disabled={saving}
                  >
                    <span>
                      {definition ? (
                        <FishIcon icon={definition.visual.icon} color={definition.visual.accent} />
                      ) : null}
                      {' '}{itemName}
                    </span>
                    <small>
                      {typeof item.metadata.rarity === 'string' ? item.metadata.rarity : 'unknown'} · size{' '}
                      {formatFishSizeKg(item.metadata.sizePercentile, definition?.weightRangeKg)}
                    </small>
                    <small>Revives by up to {formatRevivalReduction(reduction)}</small>
                  </button>
                )
              })}
            </div>
          ) : (
            <p>You are out of Revival Koi. Go fish</p>
          )}
        </div>
      ) : null}
    </div>
  )
}
