import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { isRarity, type Rarity } from '../content/rarity/Rarity'
import { getFishingEssenceValue, isEnchantedItemMetadata } from '../fishing/FishingContent'
import { getInventoryItemDefinition } from '../inventory/ItemDefinitions'
import { EssenceAmount } from '../ui/EssenceMark'
import { LootBoxIcon } from './LootBoxIcon'
import { getAbyssLootBoxRarityLabel } from './LootBoxes'
import type { LootBoxOpeningItem } from './LootBoxService'
import type { LootBoxOpeningSession } from './useLootBoxOpening'
import { getRewardIcon } from './RewardIcon'

interface LootBoxOpeningProps {
  session: LootBoxOpeningSession | null
  onDismiss: () => void
}

/** The rarity a revealed item should be ringed with. */
function getItemRarity(item: LootBoxOpeningItem, boxRarity: Rarity): Rarity {
  return isRarity(item.metadata.rarity) ? item.metadata.rarity : boxRarity
}

/**
 * The opening.
 *
 * A box used to be spent by a button that then showed a toast in the corner,
 * which is a receipt rather than a reward. This takes the screen: everything
 * else dims, the box charges in the middle of it, and what came out is placed
 * where the player is already looking. The charge is not decoration alone, it
 * is also the request finishing, so the wait and the ceremony are the same
 * moment rather than one after the other.
 *
 * Reduced motion is honoured by the hook, which drops the charge to nothing,
 * and by the stylesheet, which drops the movement and keeps the reveal.
 */
export function LootBoxOpening({ session, onDismiss }: LootBoxOpeningProps) {
  const dismissRef = useRef<HTMLButtonElement>(null)
  const isDismissable = session !== null && session.phase !== 'charging'

  useEffect(() => {
    if (!isDismissable) {
      return
    }
    dismissRef.current?.focus()
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onDismiss()
      }
    }
    document.addEventListener('keydown', handleKey, true)
    return () => { document.removeEventListener('keydown', handleKey, true) }
  }, [isDismissable, onDismiss])

  if (session === null) {
    return null
  }

  const items = session.result?.items ?? []

  return createPortal(
    <div
      className="loot-box-opening"
      data-rarity={session.rarity}
      data-phase={session.phase}
      role="dialog"
      aria-modal="true"
      aria-label={`Opening ${session.boxName}`}
    >
      <div className="loot-box-opening-stage">
        <div className="loot-box-opening-burst" aria-hidden="true" />
        <span className="loot-box-opening-box" aria-hidden="true">
          <LootBoxIcon rarity={session.rarity} opening={session.phase === 'revealing'} />
        </span>

        {session.phase === 'charging' ? (
          <p className="loot-box-opening-status" role="status">
            Opening the {getAbyssLootBoxRarityLabel(session.rarity).toLowerCase()} box…
          </p>
        ) : null}

        {session.phase === 'failed' ? (
          <>
            <p className="loot-box-opening-status" role="alert">
              {session.error ?? 'Unable to open loot box.'}
            </p>
            <button
              className="primary-action"
              type="button"
              ref={dismissRef}
              onClick={onDismiss}
            >
              Close
            </button>
          </>
        ) : null}

        {session.phase === 'revealing' ? (
          <>
            <p className="loot-box-opening-kicker">
              {getAbyssLootBoxRarityLabel(session.rarity)} box opened
            </p>
            <ul className="loot-box-opening-rewards">
              {items.map((item, index) => {
                const rarity = getItemRarity(item, session.rarity)
                const essence = getFishingEssenceValue(item.definitionId, item.metadata)
                return (
                  <li
                    className="loot-box-reward"
                    data-rarity={rarity}
                    data-enchanted={isEnchantedItemMetadata(item.metadata) ? 'true' : undefined}
                    key={item.itemInstanceId}
                    style={{ '--reveal-index': index } as CSSProperties}
                  >
                    <span className="loot-box-reward-icon" aria-hidden="true">
                      {getRewardIcon(item.definitionId)}
                    </span>
                    <strong>
                      {getInventoryItemDefinition(item.definitionId)?.name ?? item.definitionId}
                    </strong>
                    <span className="loot-box-reward-meta">
                      {item.quantity > 1 ? `×${item.quantity}` : null}
                      {essence === null ? null : <EssenceAmount value={essence} />}
                    </span>
                  </li>
                )
              })}
            </ul>
            <button
              className="primary-action loot-box-opening-collect"
              type="button"
              ref={dismissRef}
              onClick={onDismiss}
            >
              {items.length === 1 ? 'Take it' : 'Take all'}
            </button>
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
