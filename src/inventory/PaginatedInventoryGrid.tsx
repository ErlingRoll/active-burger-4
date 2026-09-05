import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  closeAllTooltips,
  registerTooltipCloser,
  tooltipClassName,
} from '../rendering/TooltipShell'
import { isRarity } from '../content/rarity/Rarity'
import { getInventoryItemDefinition } from './ItemDefinitions'
import { markInventoryItemAsSeen, useSeenInventoryItemIds } from './InventoryItemSeen'
import { sortInventoryItems, type InventoryItemComparator } from './InventorySorting'
import type { InventoryItemInstance } from './InventoryTypes'

export const INVENTORY_GRID_COLUMNS = 12
export const INVENTORY_GRID_ROWS = 10
export const INVENTORY_PAGE_SIZE = INVENTORY_GRID_COLUMNS * INVENTORY_GRID_ROWS

interface PaginatedInventoryGridProps {
  items: readonly InventoryItemInstance[]
  label: string
  getItemIcon: (item: InventoryItemInstance) => ReactNode
  getItemDetail: (item: InventoryItemInstance) => string
  getItemEssence?: (item: InventoryItemInstance) => number | null
  precedingSortComparators?: readonly InventoryItemComparator[]
  onSalvage?: (item: InventoryItemInstance) => void
  salvagingItemInstanceId?: string | null
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
}: PaginatedInventoryGridProps) {
  const [pageIndex, setPageIndex] = useState(0)
  const [activeItemInstanceId, setActiveItemInstanceId] = useState<string | null>(null)
  const [selectedItemInstanceId, setSelectedItemInstanceId] = useState<string | null>(null)
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>({})
  const itemTooltipAnchorRef = useRef<HTMLLIElement>(null)
  const itemTooltipRef = useRef<HTMLDivElement>(null)
  const seenItemInstanceIds = useSeenInventoryItemIds()
  const sortedItems = sortInventoryItems(items, {
    getEssence: getItemEssence,
    precedingComparators: precedingSortComparators,
  })
  const pageCount = Math.max(1, Math.ceil(sortedItems.length / INVENTORY_PAGE_SIZE))
  const currentPageIndex = Math.min(pageIndex, pageCount - 1)
  const firstItemIndex = currentPageIndex * INVENTORY_PAGE_SIZE
  const pageItems = sortedItems.slice(firstItemIndex, firstItemIndex + INVENTORY_PAGE_SIZE)
  const activeItem = pageItems.find((item) => item.itemInstanceId === activeItemInstanceId) ?? null

  useEffect(() => registerTooltipCloser(() => {
    if (!activeItem) {
      return false
    }
    setActiveItemInstanceId(null)
    setSelectedItemInstanceId(null)
    return true
  }), [activeItem])

  useLayoutEffect(() => {
    const anchor = itemTooltipAnchorRef.current
    const tooltip = itemTooltipRef.current
    if (!activeItem || !anchor || !tooltip) {
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
  }, [activeItem])

  const showItemTooltip = (itemInstanceId: string): void => {
    markInventoryItemAsSeen(itemInstanceId)
    closeAllTooltips()
    setActiveItemInstanceId(itemInstanceId)
  }

  const closeItemTooltip = (): void => {
    setActiveItemInstanceId(null)
  }

  const selectItem = (itemInstanceId: string): void => {
    closeAllTooltips()
    if (selectedItemInstanceId === itemInstanceId) {
      setSelectedItemInstanceId(null)
      setActiveItemInstanceId(null)
      return
    }
    setSelectedItemInstanceId(itemInstanceId)
    setActiveItemInstanceId(itemInstanceId)
  }

  return (
    <div className="inventory-paged-grid">
      <ul className="inventory-item-grid" aria-label={label}>
        {Array.from({ length: INVENTORY_PAGE_SIZE }, (_, index) => {
          const item = pageItems[index]
          if (!item) {
            return <li className="inventory-item-card inventory-item-card-empty" key={index} aria-hidden="true" />
          }
          const definition = getInventoryItemDefinition(item.definitionId)
          const rarity = isRarity(item.metadata.rarity) ? item.metadata.rarity : null
          const itemName = definition?.name ?? item.definitionId
          const isActive = activeItem?.itemInstanceId === item.itemInstanceId
          const isUnseen = !seenItemInstanceIds.has(item.itemInstanceId)
          const tooltipId = `inventory-item-tooltip-${item.itemInstanceId}`
          return (
            <li
              className={`inventory-item-card category-${definition?.category ?? 'utility'}${isUnseen ? ' inventory-item-card-unseen' : ''}`}
              data-rarity={rarity ?? undefined}
              key={item.itemInstanceId}
              ref={isActive ? itemTooltipAnchorRef : undefined}
              tabIndex={0}
              aria-label={`${itemName}, ${getItemDetail(item)}, quantity ${item.quantity}`}
              aria-describedby={isActive ? tooltipId : undefined}
              onFocus={() => showItemTooltip(item.itemInstanceId)}
              onBlur={() => {
                if (selectedItemInstanceId !== item.itemInstanceId) {
                  closeItemTooltip()
                }
              }}
              onMouseEnter={() => showItemTooltip(item.itemInstanceId)}
              onMouseLeave={() => {
                if (selectedItemInstanceId !== item.itemInstanceId) {
                  closeItemTooltip()
                }
              }}
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
              <span className="inventory-item-quantity">×{item.quantity}</span>
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
      {activeItem ? createPortal(
        <div
          className={tooltipClassName('inventory-item-tooltip')}
          id={`inventory-item-tooltip-${activeItem.itemInstanceId}`}
          role="tooltip"
          ref={itemTooltipRef}
          style={tooltipStyle}
        >
          {getItemEssence ? (
            (() => {
              const essence = getItemEssence(activeItem)
              return essence === null ? null : (
                <span className="inventory-item-tooltip-essence">
                  <span>Essence</span>
                  <strong>{essence}</strong>
                </span>
              )
            })()
          ) : null}
          <strong>{getInventoryItemDefinition(activeItem.definitionId)?.name ?? activeItem.definitionId}</strong>
          <p>{getItemDetail(activeItem)}</p>
          <dl>
            <div>
              <dt>Quantity</dt>
              <dd>×{activeItem.quantity}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{activeItem.source.type.replace('-', ' ')}</dd>
            </div>
          </dl>
          {selectedItemInstanceId === activeItem.itemInstanceId &&
          onSalvage &&
          getInventoryItemDefinition(activeItem.definitionId)?.category === 'fish' ? (
            <div className="inventory-item-tooltip-actions">
              <button
                className="inventory-item-salvage"
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onSalvage(activeItem)
                }}
                disabled={salvagingItemInstanceId !== null}
              >
                {salvagingItemInstanceId === activeItem.itemInstanceId ? 'Salvaging…' : 'Salvage'}
              </button>
            </div>
          ) : null}
        </div>,
        document.body,
      ) : null}
    </div>
  )
}
