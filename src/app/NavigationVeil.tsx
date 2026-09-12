import type { AppScreen } from './routing'

/**
 * The cover over a page whose successor is still loading.
 *
 * The page itself is frozen by `inert` on the shell; this only makes the
 * freeze visible, and only once it has lasted 150 ms (a CSS delay), because a
 * warm chunk with cached data lands inside that and a veil that flashed on
 * every click would read as a page that stutters. It is purely decorative:
 * no role, nothing to focus, and the pointer passes through it to the inert
 * page beneath, where nothing answers.
 */
export function NavigationVeil({ pending }: { pending: AppScreen | null }) {
  if (pending === null) {
    return null
  }
  return <div className="navigation-veil" aria-hidden="true" data-destination={pending} />
}
