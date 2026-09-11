export type FishingTooltipPlacement = 'beside' | 'above'

const TOOLTIP_MARGIN_PX = 12
const TOOLTIP_GAP_PX = 10

/**
 * Where a loadout option's card goes.
 *
 * Beside an option in the open list — to its right, or its left when the list
 * sits against the right edge — so it never covers the other options. Above the
 * closed trigger, where the list would open, and below it only when there is no
 * room above. Clamped to the viewport in every case.
 */
export function placeFishingDropdownTooltip(
  anchor: DOMRect,
  tooltip: DOMRect,
  placement: FishingTooltipPlacement,
  viewport: { width: number; height: number },
): { left: number; top: number } {
  const clampTop = (top: number): number => Math.min(
    Math.max(TOOLTIP_MARGIN_PX, top),
    Math.max(TOOLTIP_MARGIN_PX, viewport.height - TOOLTIP_MARGIN_PX - tooltip.height),
  )
  const clampLeft = (left: number): number => Math.min(
    Math.max(TOOLTIP_MARGIN_PX, left),
    Math.max(TOOLTIP_MARGIN_PX, viewport.width - TOOLTIP_MARGIN_PX - tooltip.width),
  )
  if (placement === 'beside') {
    if (anchor.right + TOOLTIP_GAP_PX + tooltip.width + TOOLTIP_MARGIN_PX <= viewport.width) {
      return { left: anchor.right + TOOLTIP_GAP_PX, top: clampTop(anchor.top) }
    }
    if (anchor.left - TOOLTIP_GAP_PX - tooltip.width >= TOOLTIP_MARGIN_PX) {
      return { left: anchor.left - TOOLTIP_GAP_PX - tooltip.width, top: clampTop(anchor.top) }
    }
  }
  const left = clampLeft(anchor.left + anchor.width / 2 - tooltip.width / 2)
  const top = anchor.top - TOOLTIP_GAP_PX - tooltip.height >= TOOLTIP_MARGIN_PX
    ? anchor.top - TOOLTIP_GAP_PX - tooltip.height
    : anchor.bottom + TOOLTIP_GAP_PX
  return { left, top: clampTop(top) }
}
