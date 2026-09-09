import { useLayoutEffect, useState } from 'react'
import type { RefObject } from 'react'

/**
 * How many whole items fit in `containerRef`'s box.
 *
 * Rows times columns, because these containers are not all single-file: the
 * store lays its cards out in as many columns as the panel affords, and paging
 * a three-column grid one card at a time would leave two thirds of it empty.
 * The column count is read back from the resolved `grid-template-columns`, so
 * an `auto-fit` track list reports what it actually produced.
 *
 * Measuring the container is only safe because its height comes from its parent
 * rather than from its contents: the page size cannot feed back into the box
 * being measured, so this settles rather than oscillating.
 */
export function useFittedItemCount(containerRef: RefObject<HTMLElement | null>): number {
  const [itemCount, setItemCount] = useState(1)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (container === null) {
      return
    }

    const measure = (): void => {
      const firstRow = container.firstElementChild
      const available = container.clientHeight
      if (firstRow === null || available <= 0) {
        return
      }
      const style = window.getComputedStyle(container)
      const declaredGap = Number.parseFloat(style.rowGap)
      const rowGap = Number.isFinite(declaredGap) ? declaredGap : 0
      const rowHeight = firstRow.getBoundingClientRect().height
      if (rowHeight <= 0) {
        return
      }

      const tracks = style.gridTemplateColumns
      const columns = tracks === '' || tracks === 'none'
        ? 1
        : Math.max(1, tracks.split(/\s+/).filter((track) => track !== '').length)
      const rows = Math.max(1, Math.floor((available + rowGap) / (rowHeight + rowGap)))
      const fitted = rows * columns
      setItemCount((current) => (current === fitted ? current : fitted))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => { observer.disconnect() }
  })

  return itemCount
}
