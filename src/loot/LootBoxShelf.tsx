import { useEffect, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { getInventoryItemDefinition } from '../inventory/ItemDefinitions'
import {
  closeAllTooltips,
  registerTooltipCloser,
  tooltipClassName,
} from '../rendering/TooltipShell'
import { useAnchoredTooltip } from '../rendering/useAnchoredTooltip'
import { FittedList } from '../ui/FittedList'
import {
  getLootBoxDropPercent,
  getLootBoxDropTableForDisplay,
  getLootBoxItemCount,
} from './LootBoxContents'
import { LootBoxIcon } from './LootBoxIcon'
import { getAbyssLootBoxRarityLabel, type LootBoxRarity } from './LootBoxes'
import type { LootBoxStack } from './LootBoxStacks'
import { getRewardIcon } from './RewardIcon'

interface LootBoxShelfProps {
  stacks: readonly LootBoxStack[]
  /** Names the list for assistive technology, and its pager after it. */
  label: string
  opening: boolean
  onOpen: (stack: LootBoxStack) => void
}

/**
 * The reward shelf, with the odds a hover away.
 *
 * The contents of a box were knowable only by opening one, which is the sort
 * of thing that reads as a slot machine rather than as a game. The card names
 * every drop and its chance, taken from the table the server rolls against.
 */
export function LootBoxShelf({ stacks, label, opening, onOpen }: LootBoxShelfProps) {
  const [activeDefinitionId, setActiveDefinitionId] = useState<string | null>(null)
  const activeStack = stacks.find((stack) => stack.definitionId === activeDefinitionId) ?? null
  const { anchorRef, tooltipRef, style } = useAnchoredTooltip<HTMLDivElement>(activeStack !== null)

  useEffect(() => registerTooltipCloser(() => {
    if (activeStack === null) {
      return false
    }
    setActiveDefinitionId(null)
    return true
  }), [activeStack])

  const showCard = (definitionId: string): void => {
    closeAllTooltips()
    setActiveDefinitionId(definitionId)
  }

  return (
    <>
      <FittedList
        className="loot-box-list"
        items={stacks}
        label={label}
        getKey={(stack) => stack.definitionId}
        renderItem={(stack) => (
          <LootBoxRow
            stack={stack}
            opening={opening}
            isActive={activeStack?.definitionId === stack.definitionId}
            anchorRef={anchorRef}
            onOpen={onOpen}
            onShowCard={showCard}
            onHideCard={() => setActiveDefinitionId(null)}
          />
        )}
      />
      {activeStack !== null && activeStack.rarity !== null ? createPortal(
        <div
          className={tooltipClassName('loot-box-tooltip')}
          id={`loot-box-tooltip-${activeStack.definitionId}`}
          data-rarity={activeStack.rarity}
          role="tooltip"
          ref={tooltipRef}
          style={style}
        >
          <LootBoxCard rarity={activeStack.rarity} name={activeStack.name} />
        </div>,
        document.body,
      ) : null}
    </>
  )
}

interface LootBoxRowProps {
  stack: LootBoxStack
  opening: boolean
  isActive: boolean
  anchorRef: RefObject<HTMLDivElement | null>
  onOpen: (stack: LootBoxStack) => void
  onShowCard: (definitionId: string) => void
  onHideCard: () => void
}

function LootBoxRow({
  stack,
  opening,
  isActive,
  anchorRef,
  onOpen,
  onShowCard,
  onHideCard,
}: LootBoxRowProps) {
  const itemCount = stack.rarity === null ? 1 : getLootBoxItemCount(stack.rarity)
  return (
    <div
      className="loot-box-row"
      data-rarity={stack.rarity ?? undefined}
      ref={isActive ? anchorRef : undefined}
      onMouseEnter={() => onShowCard(stack.definitionId)}
      onMouseLeave={onHideCard}
    >
      <span className="loot-box-row-emblem" aria-hidden="true">
        {stack.rarity === null ? '▣' : <LootBoxIcon rarity={stack.rarity} />}
      </span>
      <div className="loot-box-row-copy">
        <strong>{stack.name}</strong>
        <span className="loot-box-row-detail">
          {itemCount === 1 ? '1 item' : `${itemCount} items`} inside
        </span>
      </div>
      <span className="loot-box-row-count">×{stack.quantity}</span>
      <button
        className="primary-action loot-box-open"
        type="button"
        aria-describedby={isActive ? `loot-box-tooltip-${stack.definitionId}` : undefined}
        onFocus={() => onShowCard(stack.definitionId)}
        onBlur={onHideCard}
        onClick={() => onOpen(stack)}
        disabled={opening}
      >
        {opening ? 'Opening…' : 'Open one'}
      </button>
    </div>
  )
}

interface LootBoxCardProps {
  rarity: LootBoxRarity
  name: string
}

/** The odds, written out. Shared by the hover card and the opening overlay. */
export function LootBoxCard({ rarity, name }: LootBoxCardProps) {
  const drops = getLootBoxDropTableForDisplay(rarity)
  const itemCount = getLootBoxItemCount(rarity)
  return (
    <>
      <header className="loot-box-card-heading">
        <span className="loot-box-card-emblem" aria-hidden="true">
          <LootBoxIcon rarity={rarity} />
        </span>
        <div>
          <strong>{name}</strong>
          <span className="loot-box-card-rarity">
            {getAbyssLootBoxRarityLabel(rarity)} · {itemCount === 1 ? '1 draw' : `${itemCount} draws`}
          </span>
        </div>
      </header>
      <p className="loot-box-card-lede">
        Each draw is rolled separately, so a box can give the same thing twice.
      </p>
      <ul className="loot-box-card-drops">
        {drops.map((drop) => {
          const percent = getLootBoxDropPercent(drop)
          return (
            <li key={drop.definitionId}>
              <span className="loot-box-card-drop-icon" aria-hidden="true">
                {getRewardIcon(drop.definitionId)}
              </span>
              <span className="loot-box-card-drop-name">
                {getInventoryItemDefinition(drop.definitionId)?.name ?? drop.definitionId}
              </span>
              <span
                className="loot-box-card-drop-bar"
                aria-hidden="true"
                style={{ '--drop-share': `${percent}%` } as CSSProperties}
              />
              <span className="loot-box-card-drop-percent">{percent.toFixed(1)}%</span>
            </li>
          )
        })}
      </ul>
    </>
  )
}
