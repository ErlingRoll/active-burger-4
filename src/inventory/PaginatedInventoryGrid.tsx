import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  closeAllTooltips,
  registerTooltipCloser,
  tooltipClassName,
} from '../rendering/TooltipShell'
import { EssenceAmount } from '../ui/EssenceMark'
import { useFittedItemCount } from '../ui/useFittedItemCount'
import { RARITY_VISUALS } from '../content/rarity/Rarity'
import { getInventoryItemRarity } from './InventoryRarity'
import { getInventoryItemDefinition } from './ItemDefinitions'
import { markInventoryItemAsSeen, useSeenInventoryItemIds } from './InventoryItemSeen'
import { sortInventoryItems, type InventoryItemComparator } from './InventorySorting'
import type { InventoryItemInstance } from './InventoryTypes'

/**
 * The drawer's shelf is a fixed twelve-wide bag drawn over the pond.
 *
 * It floats above a scene rather than sitting in a panel, so nothing outside it
 * decides how big it is and there is no box to measure; the stores screen is
 * the opposite case and pages to the room it was given. See `fitted`.
 */
const DRAWER_GRID_COLUMNS = 12
const DRAWER_PAGE_SIZE = DRAWER_GRID_COLUMNS * 10

interface PaginatedInventoryGridProps {
  items: readonly InventoryItemInstance[]
  label: string
  getItemIcon: (item: InventoryItemInstance) => ReactNode
  getItemDetail: (item: InventoryItemInstance) => string
  getItemEssence?: (item: InventoryItemInstance) => number | null
  precedingSortComparators?: readonly InventoryItemComparator[]
  onSalvage?: (item: InventoryItemInstance) => void
  salvagingItemInstanceId?: string | null
  /**
   * Told which slot the player has picked, so a screen with room for a detail
   * panel can show the item there instead of inside a tooltip that disappears
   * the moment the pointer leaves it. `null` when the pick is cleared.
   */
  onSelect?: (item: InventoryItemInstance | null) => void
  /**
   * Whether hovering a slot floats its details over the grid. A caller that
   * shows the picked slot somewhere permanent turns this off: two copies of
   * the same facts is one too many, and the floating one lands on top of the
   * controls above the grid.
   */
  showTooltip?: boolean
  /**
   * Draw as many slots as the panel holds, at a readable size, and page the
   * rest.
   *
   * For the stores screen, which is a screen: the bag has to end where the
   * viewport does. Columns come from the stylesheet's `auto-fill` track list
   * and the row count is read back from the box the panel actually granted, so
   * one shelf serves a phone and a desktop without a breakpoint choosing
   * between them. A shelf with room to spare shows its slots and stops rather
   * than padding the panel out with empties.
   *
   * An earlier attempt at this measured a bag on a screen that was still a
   * document, so the box it read had no height of its own and the shelf latched
   * to a single row of forty-two pixel slots across nine pages. The screen has
   * a definite height now, which is what makes the measurement mean something.
   */
  fitted?: boolean
}

export function PaginatedInventoryGrid({
  items,
  label,
  getItemIcon,
  getItemDetail,
  getItemEssence,
  precedingSortComparators,
  onSalvage,
  salvagingItemInstanceId = null,
  onSelect,
  showTooltip = true,
  fitted = false,
}: PaginatedInventoryGridProps) {
  const [pageIndex, setPageIndex] = useState(0)
  const [activeItemInstanceId, setActiveItemInstanceId] = useState<string | null>(null)
  const [selectedItemInstanceId, setSelectedItemInstanceId] = useState<string | null>(null)
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>({})
  const gridRef = useRef<HTMLUListElement>(null)
  const fittedSlotCount = useFittedItemCount(gridRef)
  const itemTooltipAnchorRef = useRef<HTMLLIElement>(null)
  const itemTooltipRef = useRef<HTMLDivElement>(null)
  const seenItemInstanceIds = useSeenInventoryItemIds()
  const sortedItems = sortInventoryItems(items, {
    getEssence: getItemEssence,
    precedingComparators: precedingSortComparators,
  })
  const pageSize = fitted ? fittedSlotCount : DRAWER_PAGE_SIZE
  const pageCount = Math.max(1, Math.ceil(sortedItems.length / pageSize))
  const currentPageIndex = Math.min(pageIndex, pageCount - 1)
  const firstItemIndex = currentPageIndex * pageSize
  const pageItems = sortedItems.slice(firstItemIndex, firstItemIndex + pageSize)
  const activeItem = pageItems.find((item) => item.itemInstanceId === activeItemInstanceId) ?? null
  const tooltipItem = showTooltip ? activeItem : null
  const tooltipRarity = tooltipItem === null ? null : getInventoryItemRarity(tooltipItem)
  const tooltipEssence = tooltipItem === null ? null : getItemEssence?.(tooltipItem) ?? null

  /*
   * The closer closes the tooltip, and only the tooltip.
   *
   * It used to clear the pick as well, and `showItemTooltip` calls
   * `closeAllTooltips` before opening its own — so moving the pointer from the
   * picked slot to its neighbour ran the closer and emptied the inspector. A
   * pick is made by clicking and is undone by clicking again; passing over a
   * slot on the way to somewhere else is not a decision about it.
   */
  useEffect(() => registerTooltipCloser(() => {
    if (activeItemInstanceId === null) {
      return false
    }
    setActiveItemInstanceId(null)
    return true
  }), [activeItemInstanceId])

  useLayoutEffect(() => {
    const anchor = itemTooltipAnchorRef.current
    const tooltip = itemTooltipRef.current
    if (!tooltipItem || !anchor || !tooltip) {
      return
    }

    const updatePosition = () => {
      const margin = 12
      const gap = 10
      const anchorBox = anchor.getBoundingClientRect()
      const tooltipBox = tooltip.getBoundingClientRect()
      const maxLeft = Math.max(margin, window.innerWidth - margin - tooltipBox.width)
      const maxTop = Math.max(margin, window.innerHeight - margin - tooltipBox.height)
      const left = Math.min(
        maxLeft,
        Math.max(margin, anchorBox.left + anchorBox.width / 2 - tooltipBox.width / 2),
      )
      const top = anchorBox.top - tooltipBox.height - gap >= margin
        ? anchorBox.top - tooltipBox.height - gap
        : Math.min(maxTop, anchorBox.bottom + gap)
      setTooltipStyle({ left: `${left}px`, top: `${top}px` })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [tooltipItem])

  const showItemTooltip = (itemInstanceId: string): void => {
    markInventoryItemAsSeen(itemInstanceId)
    closeAllTooltips()
    setActiveItemInstanceId(itemInstanceId)
  }

  const closeItemTooltip = (): void => {
    setActiveItemInstanceId(null)
  }

  const selectItem = (itemInstanceId: string): void => {
    if (selectedItemInstanceId === itemInstanceId) {
      setSelectedItemInstanceId(null)
      onSelect?.(null)
      return
    }
    setSelectedItemInstanceId(itemInstanceId)
    onSelect?.(pageItems.find((item) => item.itemInstanceId === itemInstanceId) ?? null)
  }

  return (
    <div className="inventory-paged-grid">
      <ul
        className={fitted ? 'inventory-item-grid inventory-item-grid-fitted' : 'inventory-item-grid'}
        aria-label={label}
        ref={gridRef}
        style={fitted ? undefined : { '--inventory-columns': DRAWER_GRID_COLUMNS } as CSSProperties}
      >
        {Array.from({ length: fitted ? pageItems.length : pageSize }, (_, index) => {
          const item = pageItems[index]
          if (!item) {
            return <li className="inventory-item-card inventory-item-card-empty" key={index} aria-hidden="true" />
          }
          const definition = getInventoryItemDefinition(item.definitionId)
          const rarity = getInventoryItemRarity(item)
          const itemName = definition?.name ?? item.definitionId
          const isActive = tooltipItem?.itemInstanceId === item.itemInstanceId
          const isUnseen = !seenItemInstanceIds.has(item.itemInstanceId)
          const tooltipId = `inventory-item-tooltip-${item.itemInstanceId}`
          return (
            <li
              className={`inventory-item-card category-${definition?.category ?? 'utility'}${isUnseen ? ' inventory-item-card-unseen' : ''}`}
              data-rarity={rarity ?? undefined}
              data-selected={selectedItemInstanceId === item.itemInstanceId ? 'true' : undefined}
              key={item.itemInstanceId}
              ref={isActive ? itemTooltipAnchorRef : undefined}
              tabIndex={0}
              aria-label={`${itemName}, ${getItemDetail(item)}, quantity ${item.quantity}`}
              aria-describedby={isActive ? tooltipId : undefined}
              onFocus={() => showItemTooltip(item.itemInstanceId)}
              onBlur={closeItemTooltip}
              onMouseEnter={() => showItemTooltip(item.itemInstanceId)}
              onMouseLeave={closeItemTooltip}
              onClick={() => selectItem(item.itemInstanceId)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') {
                  return
                }
                event.preventDefault()
                selectItem(item.itemInstanceId)
              }}
            >
              <span className="inventory-item-icon" aria-hidden="true">{getItemIcon(item)}</span>
              <strong>{itemName}</strong>
              <small>{getItemDetail(item)}</small>
              {item.quantity > 1 ? (
                <span className="inventory-item-quantity">×{item.quantity}</span>
              ) : null}
            </li>
          )
        })}
      </ul>
      {pageCount > 1 ? (
        <nav className="inventory-pagination" aria-label={`${label} pagination`}>
          <button
            className="secondary-action"
            type="button"
            onClick={() => {
              closeItemTooltip()
              setPageIndex(Math.max(0, currentPageIndex - 1))
            }}
            disabled={currentPageIndex === 0}
          >
            Previous
          </button>
          <span>Page {currentPageIndex + 1} of {pageCount}</span>
          <button
            className="secondary-action"
            type="button"
            onClick={() => {
              closeItemTooltip()
              setPageIndex(Math.min(pageCount - 1, currentPageIndex + 1))
            }}
            disabled={currentPageIndex === pageCount - 1}
          >
            Next
          </button>
        </nav>
      ) : null}
      {tooltipItem ? createPortal(
        <div
          className={tooltipClassName('inventory-item-tooltip')}
          id={`inventory-item-tooltip-${tooltipItem.itemInstanceId}`}
          data-rarity={tooltipRarity ?? undefined}
          role="tooltip"
          ref={itemTooltipRef}
          style={tooltipStyle}
        >
          <header className="inventory-item-tooltip-heading">
            <span className="inventory-item-tooltip-icon" aria-hidden="true">
              {getItemIcon(tooltipItem)}
            </span>
            <div>
              <strong>
                {getInventoryItemDefinition(tooltipItem.definitionId)?.name ?? tooltipItem.definitionId}
              </strong>
              {tooltipRarity === null ? null : (
                <span className="inventory-rarity-mark" data-rarity={tooltipRarity}>
                  {RARITY_VISUALS[tooltipRarity].label}
                </span>
              )}
            </div>
          </header>
          <p>{getItemDetail(tooltipItem)}</p>
          <dl>
            <div>
              <dt>Quantity</dt>
              <dd>×{tooltipItem.quantity}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{tooltipItem.source.type.replace('-', ' ')}</dd>
            </div>
            {tooltipEssence === null ? null : (
              <div>
                <dt>Salvage</dt>
                <dd><EssenceAmount value={tooltipEssence} /></dd>
              </div>
            )}
          </dl>
          {selectedItemInstanceId === tooltipItem.itemInstanceId &&
          onSalvage &&
          getInventoryItemDefinition(tooltipItem.definitionId)?.category === 'fish' ? (
            <div className="inventory-item-tooltip-actions">
              <button
                className="inventory-item-salvage"
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  closeAllTooltips()
                  onSalvage(tooltipItem)
                }}
                disabled={salvagingItemInstanceId !== null}
              >
                {salvagingItemInstanceId === tooltipItem.itemInstanceId ? 'Salvaging…' : 'Salvage'}
              </button>
            </div>
          ) : null}
        </div>,
        document.body,
      ) : null}
    </div>
  )
}
