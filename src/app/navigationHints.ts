import type { AppScreen } from './routing'

/**
 * What a control that leads somewhere is told about the navigation it starts.
 *
 * Two things. Which screen is pending, so the tile or link that was pressed
 * can show as pressed until its screen arrives; and a way to warm a screen's
 * chunk on intent — a hover, a focus, a pointer going down — so that by the
 * click the code is usually already here and the navigation settles inside
 * the delay before the veil would show.
 */
export interface NavigationHints {
  /** The screen that was asked for and is still loading, if any. */
  pendingScreen: AppScreen | null
  /** Starts a screen's chunk downloading. Cheap to call again. */
  warmScreen: (screen: AppScreen) => void
}

export interface NavigationControlProps {
  'aria-busy'?: true
  'data-pending'?: 'true'
  onPointerEnter?: () => void
  onFocus?: () => void
  onPointerDown?: () => void
}

/**
 * The attributes and handlers for a control that opens `screen`. Spread onto
 * the button. Without hints (a test, or a screen that has none to give) it is
 * empty and the control behaves as it always did.
 */
export function navigationControlProps(
  hints: NavigationHints | undefined,
  screen: AppScreen,
): NavigationControlProps {
  if (!hints) {
    return {}
  }
  const warm = (): void => {
    hints.warmScreen(screen)
  }
  return {
    onPointerEnter: warm,
    onFocus: warm,
    onPointerDown: warm,
    ...(hints.pendingScreen === screen
      ? { 'aria-busy': true as const, 'data-pending': 'true' as const }
      : {}),
  }
}
