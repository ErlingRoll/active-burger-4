import { useCallback, useEffect, useRef, type MutableRefObject } from 'react'
import { APP_ROUTE_PATHS, getScreenForPath, type AppScreen } from '../routing'
import { preloadScreen, type LoadedScreenData } from '../screenDefinitions'
import { commitScreenTransition } from '../screenTransition'
import { useScreenNavigator, type ScreenNavigator, type ScreenRequest } from '../useScreenNavigator'

/**
 * Which screen is showing, and how to move between them.
 *
 * A navigation is a request, not a state change: the navigator holds the
 * committed screen until the destination's chunk has arrived and its first
 * fetch has settled, then commits screen, history, music and shell class
 * together (ADR 0013). The path is read once on mount, written when a
 * request commits, and read again on `popstate` by the app shell, which owns
 * that listener because a back button into the run setup also restores the
 * run mode.
 *
 * What a destination waits on is decided by the domains: the store's snapshot
 * lives in `useMetaProgression`, the dashboards' data in `useAdminModeration`,
 * and those hooks need the screen from here. So the preparation cannot be
 * passed in when this hook is called; the shell hands it over afterwards
 * through `useScreenPreparation`, and it is read when a navigation starts,
 * never before.
 */

/** Resolves once a destination can paint: chunk warmed, first fetch done. */
export type PrepareScreen = (request: ScreenRequest) => Promise<LoadedScreenData | null>

export interface AppNavigation {
  /** The committed screen: what renders, what plays, what the shell is dressed as. */
  screen: AppScreen
  navigateToScreen: (screen: AppScreen, replace?: boolean, path?: string) => void
  navigator: ScreenNavigator<LoadedScreenData>
  /** The navigator's preparation, written by `useScreenPreparation`. */
  prepareRef: MutableRefObject<PrepareScreen>
}

/**
 * How a committed screen is drawn in: a cross-dissolve everywhere, except
 * into the dungeon, which is a threshold rather than a menu and goes down
 * through black.
 */
function commitNavigation(request: ScreenRequest, apply: () => void): void {
  commitScreenTransition(request.screen === 'gameplay' ? 'descend' : 'dissolve', apply)
}

/** Until the shell has said what a destination waits on, a navigation waits on the chunk alone. */
function prepareChunkOnly(request: ScreenRequest): Promise<LoadedScreenData | null> {
  return preloadScreen(request.screen).then(() => null)
}

export function useAppNavigation(): AppNavigation {
  const prepareRef = useRef<PrepareScreen>(prepareChunkOnly)
  const navigator = useScreenNavigator<LoadedScreenData>({
    initialScreen: typeof window === 'undefined'
      ? 'dashboard'
      : getScreenForPath(window.location.pathname),
    prepare: (request) => prepareRef.current(request),
    commit: commitNavigation,
  })
  const { screen, navigate } = navigator

  const navigateToScreen = useCallback((
    nextScreen: AppScreen,
    replace = false,
    path = APP_ROUTE_PATHS[nextScreen],
  ): void => {
    navigate({ screen: nextScreen, path, history: replace ? 'replace' : 'push' })
  }, [navigate])

  return { screen, navigateToScreen, navigator, prepareRef }
}

/**
 * Hands the navigator what a destination waits on. An effect rather than an
 * argument because the domains that own the data are composed after the
 * navigation hook; a navigation only ever starts from an event or an effect,
 * by which time the latest preparation is in place.
 */
export function useScreenPreparation(navigation: AppNavigation, prepare: PrepareScreen): void {
  const { prepareRef } = navigation
  useEffect(() => {
    prepareRef.current = prepare
  }, [prepare, prepareRef])
}
