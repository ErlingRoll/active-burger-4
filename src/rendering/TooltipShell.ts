export const TOOLTIP_SHELL_CLASS = 'app-tooltip'

export const TOOLTIP_VARIANT_CLASSES = [
  'keyword-tooltip',
  'skill-tooltip',
  'loadout-tooltip',
  'character-stat-tooltip',
  'gear-comparison',
  'character-class-card-tooltip',
  'abyss-entry-tooltip',
  'inventory-item-tooltip',
] as const

type TooltipCloser = () => boolean
const tooltipClosers = new Set<TooltipCloser>()
let escapeListenerAttached = false

function handleTooltipEscape(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !closeAllTooltips()) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
}

function attachEscapeListener(): void {
  if (escapeListenerAttached || typeof document === 'undefined') {
    return
  }
  document.addEventListener('keydown', handleTooltipEscape, true)
  escapeListenerAttached = true
}

function detachEscapeListener(): void {
  if (!escapeListenerAttached || typeof document === 'undefined') {
    return
  }
  document.removeEventListener('keydown', handleTooltipEscape, true)
  escapeListenerAttached = false
}

export function registerTooltipCloser(closer: TooltipCloser): () => void {
  tooltipClosers.add(closer)
  attachEscapeListener()
  return () => {
    tooltipClosers.delete(closer)
    if (tooltipClosers.size === 0) {
      detachEscapeListener()
    }
  }
}

export function closeAllTooltips(): boolean {
  let closed = false
  for (const closer of tooltipClosers) {
    closed = closer() || closed
  }
  return closed
}

export function tooltipClassName(variant: (typeof TOOLTIP_VARIANT_CLASSES)[number]): string {
  return `${TOOLTIP_SHELL_CLASS} ${variant}`
}
