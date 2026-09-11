import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { getInventoryItemDefinition } from '../inventory/ItemDefinitions'
import { EssenceAmount } from '../ui/EssenceMark'
import { LootBoxIcon } from './LootBoxIcon'
import { getAbyssLootBoxRarityLabel } from './LootBoxes'
import { collectRevealedRewards } from './LootBoxHaul'
import type { LootBoxOpeningSession } from './useLootBoxOpening'
import { getRewardIcon } from './RewardIcon'

interface LootBoxOpeningProps {
  session: LootBoxOpeningSession | null
  onDismiss: () => void
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
 * A batch charges once for all of its boxes, counting them off as they open,
 * and reveals the whole haul together.
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

  const rarityLabel = getAbyssLootBoxRarityLabel(session.rarity)
  const isBatch = session.boxCount > 1
  const openedCount = session.results.length
  const rewards = collectRevealedRewards(session.results, session.rarity)
  const rewardCount = rewards.reduce((total, reward) => total + reward.quantity, 0)
  const dialogLabel = isBatch
    ? `Opening ${session.boxCount} ${session.boxName}es`
    : `Opening ${session.boxName}`

  // Four cards land a beat apart; a batch's twenty share about a second, so
  // the haul is on the screen before the player starts to wonder.
  const revealStepMs = Math.min(130, Math.round(900 / Math.max(1, rewards.length)))
  const rewardList = rewards.length === 0 ? null : (
    <ul
      className="loot-box-opening-rewards"
      data-crowded={rewards.length > 16 ? 'dense' : rewards.length > 8 ? 'true' : undefined}
      style={{ '--reveal-step': `${revealStepMs}ms` } as CSSProperties}
    >
      {rewards.map((reward, index) => (
        <li
          className="loot-box-reward"
          data-rarity={reward.rarity}
          data-enchanted={reward.enchanted ? 'true' : undefined}
          key={reward.key}
          style={{ '--reveal-index': index } as CSSProperties}
        >
          <span className="loot-box-reward-icon" aria-hidden="true">
            {getRewardIcon(reward.definitionId)}
          </span>
          <strong>
            {getInventoryItemDefinition(reward.definitionId)?.name ?? reward.definitionId}
          </strong>
          <span className="loot-box-reward-meta">
            {reward.quantity > 1 ? `×${reward.quantity}` : null}
            {reward.essence === null ? null : <EssenceAmount value={reward.essence} />}
          </span>
        </li>
      ))}
    </ul>
  )

  return createPortal(
    <div
      className="loot-box-opening"
      data-rarity={session.rarity}
      data-phase={session.phase}
      role="dialog"
      aria-modal="true"
      aria-label={dialogLabel}
    >
      <div className="loot-box-opening-stage">
        <div className="loot-box-opening-burst" aria-hidden="true" />
        <span className="loot-box-opening-box" aria-hidden="true">
          <LootBoxIcon rarity={session.rarity} opening={session.phase === 'revealing'} />
        </span>

        {session.phase === 'charging' ? (
          <p className="loot-box-opening-status" role="status">
            {isBatch
              ? `Opening ${session.boxCount} ${rarityLabel.toLowerCase()} boxes… ${openedCount} of ${session.boxCount}`
              : `Opening the ${rarityLabel.toLowerCase()} box…`}
          </p>
        ) : null}

        {session.phase === 'failed' ? (
          <>
            <p className="loot-box-opening-status" role="alert">
              {session.error ?? 'Unable to open loot box.'}
            </p>
            {openedCount > 0 ? (
              <p className="loot-box-opening-kicker">
                {openedCount === 1 ? '1 box' : `${openedCount} boxes`} opened before it stopped
              </p>
            ) : null}
            {rewardList}
            <button
              className="primary-action"
              type="button"
              ref={dismissRef}
              onClick={onDismiss}
            >
              {openedCount > 0 ? 'Take what came out' : 'Close'}
            </button>
          </>
        ) : null}

        {session.phase === 'revealing' ? (
          <>
            <p className="loot-box-opening-kicker">
              {isBatch
                ? `${openedCount} ${rarityLabel.toLowerCase()} boxes opened`
                : `${rarityLabel} box opened`}
            </p>
            {rewardList}
            <button
              className="primary-action loot-box-opening-collect"
              type="button"
              ref={dismissRef}
              onClick={onDismiss}
            >
              {rewardCount === 1 ? 'Take it' : 'Take all'}
            </button>
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
