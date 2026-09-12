import { useCallback, useState } from 'react'
import { APP_ROUTE_PATHS, getScreenForPath, type AppScreen } from '../routing'

/**
 * Which screen is showing, and how to move between them.
 *
 * Routing is the History API and one piece of state: the path is read once
 * on mount, pushed or replaced on every navigation, and read again on
 * `popstate` by the app shell, which owns that listener because a back
 * button into the run setup also restores the run mode.
 */
export function useAppNavigation() {
  const [screen, setScreen] = useState<AppScreen>(() =>
    typeof window === 'undefined' ? 'dashboard' : getScreenForPath(window.location.pathname),
  )

  const navigateToScreen = useCallback((
    nextScreen: AppScreen,
    replace = false,
    path = APP_ROUTE_PATHS[nextScreen],
  ): void => {
    const nextPath = path
    if (typeof window !== 'undefined' && window.location.pathname !== nextPath) {
      const nextUrl = `${nextPath}${window.location.search}`
      if (replace) {
        window.history.replaceState(null, '', nextUrl)
      } else {
        window.history.pushState(null, '', nextUrl)
      }
    }
    setScreen(nextScreen)
  }, [])

  return { screen, setScreen, navigateToScreen }
}
