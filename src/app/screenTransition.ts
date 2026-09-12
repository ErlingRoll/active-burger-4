import { flushSync } from 'react-dom'

/**
 * How the swap between two committed screens is drawn.
 *
 * The View Transitions API snapshots the page, applies the state change, and
 * animates between the old and new snapshots; the animation itself is CSS,
 * in `styles/screen-transitions.css`, keyed on the kind stamped onto the root
 * element here. Where the API is missing the swap is an instant cut, which is
 * what every navigation was before.
 *
 * `flushSync` matters: the transition captures the new state when the update
 * callback returns, so React's render has to be complete by then rather than
 * scheduled.
 */

export type ScreenTransitionKind =
  /** The ordinary cross-dissolve between two pages. */
  | 'dissolve'
  /** Entering the dungeon: down through black, then the floor is revealed. */
  | 'descend'

const TRANSITION_ATTRIBUTE = 'screenTransition'

export function commitScreenTransition(kind: ScreenTransitionKind, apply: () => void): void {
  if (typeof document === 'undefined' || typeof document.startViewTransition !== 'function') {
    apply()
    return
  }
  const root = document.documentElement
  root.dataset[TRANSITION_ATTRIBUTE] = kind
  const transition = document.startViewTransition(() => {
    flushSync(apply)
  })
  // `finished` rejects when the transition is skipped (another one started,
  // the tab was hidden); the attribute comes off either way.
  void transition.finished
    .catch(() => undefined)
    .then(() => {
      if (root.dataset[TRANSITION_ATTRIBUTE] === kind) {
        delete root.dataset[TRANSITION_ATTRIBUTE]
      }
    })
}
