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
import { RARITIES, type Rarity } from '../content/rarity/Rarity'
import {
  getLootBoxArtifactRarityChances,
  getLootBoxDropPercent,
  getLootBoxDropTableForDisplay,
  getLootBoxItemCount,
  getLootBoxRules,
} from './LootBoxContents'
import { LootBoxIcon } from './LootBoxIcon'
import { getAbyssLootBoxRarityLabel, type LootBoxRarity } from './LootBoxes'
import { MAX_LOOT_BOXES_PER_OPENING, type LootBoxStack } from './LootBoxStacks'
import { getRewardIcon } from './RewardIcon'

interface LootBoxShelfProps {
  stacks: readonly LootBoxStack[]
  /** Names the list for assistive technology, and its pager after it. */
  label: string
  opening: boolean
  /** Open `count` boxes of the kind, never more than the stack holds. */
  onOpen: (stack: LootBoxStack, count: number) => void
}

/**
 * The reward shelf, with the odds a hover away.
 *
 * The contents of a box were knowable only by opening one, which is the sort
 * of thing that reads as a slot machine rather than as a game. The card names
 * every drop and its chance, taken from the table the server rolls against.
 *
 * Each row offers one box or a batch. A player back from a long session with
 * fourteen boxes should not have to press a button fourteen times and sit
 * through fourteen reveals, so the second button opens up to ten at once, and
 * says "Open all" when the stack has that few.
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
  onOpen: (stack: LootBoxStack, count: number) => void
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
  const batchCount = Math.min(stack.quantity, MAX_LOOT_BOXES_PER_OPENING)
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
        <span className="loot-box-row-title">
          <strong>{stack.name}</strong>
          <span className="loot-box-row-count">×{stack.quantity}</span>
        </span>
        <span className="loot-box-row-detail">
          {itemCount === 1 ? '1 item' : `${itemCount} items`} inside
        </span>
      </div>
      <div className="loot-box-actions">
        <button
          className="primary-action loot-box-open"
          type="button"
          aria-describedby={isActive ? `loot-box-tooltip-${stack.definitionId}` : undefined}
          onFocus={() => onShowCard(stack.definitionId)}
          onBlur={onHideCard}
          onClick={() => onOpen(stack, 1)}
          disabled={opening}
        >
          {opening ? 'Opening…' : 'Open one'}
        </button>
        {batchCount > 1 ? (
          <button
            className="secondary-action loot-box-open-batch"
            type="button"
            aria-describedby={isActive ? `loot-box-tooltip-${stack.definitionId}` : undefined}
            onFocus={() => onShowCard(stack.definitionId)}
            onBlur={onHideCard}
            onClick={() => onOpen(stack, batchCount)}
            disabled={opening}
          >
            {batchCount === stack.quantity ? 'Open all' : `Open ${batchCount}`}
          </button>
        ) : null}
      </div>
    </div>
  )
}

interface LootBoxCardProps {
  rarity: LootBoxRarity
  name: string
}

/** "epic (83%) or legendary (17%)": the rarities an artifact can come out at. */
function describeArtifactChances(chances: Readonly<Record<Rarity, number>>): string {
  return RARITIES
    .filter((rarity) => chances[rarity] > 0)
    .map((rarity) => `${rarity} (${Math.round(chances[rarity] * 100)}%)`)
    .join(' or ')
}

/**
 * What the box promises before the draws: the lines a player reads to know
 * why this box is better than the one below it. Empty for a box that
 * promises nothing beyond its table.
 */
function describeLootBoxPromises(rarity: LootBoxRarity): string[] {
  const rules = getLootBoxRules(rarity)
  const chances = getLootBoxArtifactRarityChances(rarity)
  const promises: string[] = []
  if (chances !== null && rules.guaranteedArtifacts > 0) {
    const potential = rules.artifactPotentialMin === null
      ? ''
      : `, with Potential of ${rules.artifactPotentialMin} or more`
    promises.push(
      `${rules.guaranteedArtifacts === 1 ? 'One artifact' : `${rules.guaranteedArtifacts} artifacts`} certain: ${describeArtifactChances(chances)}${potential}.`,
    )
  } else if (chances !== null && rules.artifactRarityFloor !== null) {
    promises.push(`Artifacts here roll ${describeArtifactChances(chances)}.`)
  }
  if (rules.fishEnchantmentChancePercent >= 100) {
    promises.push('Every meal fish comes enchanted.')
  } else if (rules.fishEnchantmentChancePercent > 0) {
    promises.push(`Meal fish come enchanted ${rules.fishEnchantmentChancePercent}% of the time.`)
  }
  return promises
}

/** The odds, written out. Shared by the hover card and the opening overlay. */
export function LootBoxCard({ rarity, name }: LootBoxCardProps) {
  const drops = getLootBoxDropTableForDisplay(rarity)
  const rules = getLootBoxRules(rarity)
  const promises = describeLootBoxPromises(rarity)
  const drawsLabel = rules.draws === 1 ? '1 draw' : `${rules.draws} draws`
  const countLabel = rules.guaranteedArtifacts === 0
    ? drawsLabel
    : `${rules.guaranteedArtifacts === 1 ? '1 artifact' : `${rules.guaranteedArtifacts} artifacts`} + ${drawsLabel}`
  return (
    <>
      <header className="loot-box-card-heading">
        <span className="loot-box-card-emblem" aria-hidden="true">
          <LootBoxIcon rarity={rarity} />
        </span>
        <div>
          <strong>{name}</strong>
          <span className="loot-box-card-rarity">
            {getAbyssLootBoxRarityLabel(rarity)} · {countLabel}
          </span>
        </div>
      </header>
      {promises.length > 0 ? (
        <p className="loot-box-card-promise">{promises.join(' ')}</p>
      ) : null}
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
                {drop.quantity > 1 ? (
                  <span className="loot-box-card-drop-quantity"> ×{drop.quantity}</span>
                ) : null}
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
