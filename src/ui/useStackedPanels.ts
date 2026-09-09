import { useEffect, useState } from 'react'

/**
 * Whether a screen's panels have stopped sitting side by side.
 *
 * `.app-screen-panels` lays its panels out with a 22rem track minimum, so a
 * viewport narrower than two of those plus the gap gets one column and the
 * panels stack. A screen that may not scroll cannot always afford that: the
 * refuge stores would be asking a phone to hold a shelf, an inspector, a reward
 * list and a workbench in one screenful, and what it did instead was draw them
 * over each other.
 *
 * The width lives here as well as in the stylesheet, which is the price of a
 * layout that changes what is rendered rather than only how it is drawn. It is
 * the one number, and it is named on both sides.
 */
const STACKED_PANELS = '(max-width: 47rem)'

export function useStackedPanels(): boolean {
  const [stacked, setStacked] = useState(() => matchStackedPanels())

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }
    const query = window.matchMedia(STACKED_PANELS)
    const update = (): void => { setStacked(query.matches) }
    update()
    query.addEventListener('change', update)
    return () => { query.removeEventListener('change', update) }
  }, [])

  return stacked
}

function matchStackedPanels(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia(STACKED_PANELS).matches
}
