import { Children, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useFittedItemCount } from './useFittedItemCount'

/**
 * Lists that show the rows their container has room for and page the rest.
 *
 * The screens are screens rather than documents: a list of loot boxes, store
 * upgrades or character classes has no natural bound, and letting one grow
 * either stretched the page into a scroll or — once the shell was given a
 * definite height — pushed its own buttons out of reach behind the frame.
 *
 * The row count is measured rather than configured. Reading it from the box the
 * list was actually given is what lets one list serve a phone and a desktop
 * without a breakpoint deciding between them.
 *
 * Two shapes, because the screens have two: `FittedList` maps an array, and
 * `FittedRows` pages whatever children it is handed, which is what the older
 * screens need — their cards are written out one by one rather than mapped, and
 * each carries its own purchase or selection logic.
 */

interface PagerProps {
  label: string
  pageIndex: number
  pageCount: number
  onChange: (pageIndex: number) => void
}

function Pager({ label, pageIndex, pageCount, onChange }: PagerProps) {
  if (pageCount <= 1) {
    return null
  }
  return (
    <nav className="inventory-pagination" aria-label={`${label} pagination`}>
      <button
        className="secondary-action"
        type="button"
        onClick={() => { onChange(Math.max(0, pageIndex - 1)) }}
        disabled={pageIndex === 0}
      >
        Previous
      </button>
      <span>Page {pageIndex + 1} of {pageCount}</span>
      <button
        className="secondary-action"
        type="button"
        onClick={() => { onChange(Math.min(pageCount - 1, pageIndex + 1)) }}
        disabled={pageIndex === pageCount - 1}
      >
        Next
      </button>
    </nav>
  )
}

interface FittedListProps<TItem> {
  items: readonly TItem[]
  getKey: (item: TItem) => string
  renderItem: (item: TItem) => ReactNode
  /** Names the list for assistive technology, and its pager after it. */
  label: string
  className?: string
}

export function FittedList<TItem>({
  items,
  getKey,
  renderItem,
  label,
  className,
}: FittedListProps<TItem>) {
  const listRef = useRef<HTMLUListElement>(null)
  const rowsPerPage = useFittedItemCount(listRef)
  const [pageIndex, setPageIndex] = useState(0)

  const pageCount = Math.max(1, Math.ceil(items.length / rowsPerPage))
  const currentPageIndex = Math.min(pageIndex, pageCount - 1)
  const firstRowIndex = currentPageIndex * rowsPerPage

  return (
    <div className="fitted-list">
      <ul className={className} aria-label={label} ref={listRef}>
        {items.slice(firstRowIndex, firstRowIndex + rowsPerPage).map((item) => (
          <li key={getKey(item)}>{renderItem(item)}</li>
        ))}
      </ul>
      <Pager
        label={label}
        pageIndex={currentPageIndex}
        pageCount={pageCount}
        onChange={setPageIndex}
      />
    </div>
  )
}

interface FittedRowsProps {
  children: ReactNode
  label: string
  className?: string
}

export function FittedRows({ children, label, className }: FittedRowsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rowsPerPage = useFittedItemCount(containerRef)
  const [pageIndex, setPageIndex] = useState(0)

  // `toArray` drops nullish children and gives the survivors stable keys, which
  // matters here because these lists are written as a run of conditionals and
  // are full of holes whenever an upgrade is already maxed out.
  const rows = Children.toArray(children)
  const pageCount = Math.max(1, Math.ceil(rows.length / rowsPerPage))
  const currentPageIndex = Math.min(pageIndex, pageCount - 1)
  const firstRowIndex = currentPageIndex * rowsPerPage

  return (
    <div className="fitted-list">
      <div className={className} aria-label={label} ref={containerRef}>
        {rows.slice(firstRowIndex, firstRowIndex + rowsPerPage)}
      </div>
      <Pager
        label={label}
        pageIndex={currentPageIndex}
        pageCount={pageCount}
        onChange={setPageIndex}
      />
    </div>
  )
}
