import { useCallback, useEffect, useRef, useState } from 'react'
import { APP_ROUTE_PATHS, type AppScreen } from './routing'

/**
 * Held-page navigation.
 *
 * A navigation is a request, not a state change. The screen that is showing
 * stays committed — rendered, playing its music, wearing its background —
 * until the destination can paint completely: its chunk has arrived and its
 * first fetch has settled. Only then does the committed screen advance, and
 * the two are swapped in one commit so the picture, the playlist and the
 * address bar change together.
 *
 * Before this, `setScreen` ran on the click. The old screen unmounted at once,
 * a loading panel took its place while the chunk downloaded, and the real
 * screen then mounted empty and fetched. The player asked for one page and
 * watched three. See docs/decisions/0013-held-page-navigation.md.
 *
 * The hook owns the timing rules and nothing else. What "ready" means for a
 * screen is the caller's `prepare`; how the swap is drawn is the caller's
 * `commit`. Both are read through a ref so `navigate` keeps one identity for
 * the life of the component, which lets the popstate listener subscribe once.
 */

export type ScreenHistoryMode = 'push' | 'replace' | 'none'

export interface ScreenRequest {
  screen: AppScreen
  /** Where the address bar points once the screen commits. Defaults to the screen's route. */
  path?: string
  /**
   * `push` adds a history entry, `replace` rewrites the current one, and
   * `none` leaves history alone — the choice for a popstate, where the browser
   * has already moved.
   */
  history?: ScreenHistoryMode
}

export interface CommittedScreen<TData> {
  screen: AppScreen
  /** What the screen's loader produced, so it can paint populated on its first frame. */
  data: TData | null
  /** Why the loader failed, when it did. The screen shows it in place of fetching again. */
  loadError: string | null
}

export interface ScreenNavigatorOptions<TData> {
  initialScreen: AppScreen
  /**
   * Resolves once the destination can paint: chunk warmed, first fetch done.
   * Rejecting commits the screen anyway, with the reason attached.
   */
  prepare: (request: ScreenRequest) => Promise<TData | null>
  /** How long a page is held before it is committed regardless. */
  timeoutMs?: number
  /** Draws the swap. Must call `apply` exactly once, synchronously or inside a transition. */
  commit?: (request: ScreenRequest, apply: () => void) => void
  /** Writes the address bar. Replaceable so the hook can be tested without a window. */
  writeHistory?: (path: string, mode: Exclude<ScreenHistoryMode, 'none'>) => void
}

export interface ScreenNavigator<TData> {
  /** The committed screen: what renders, what plays, what the shell is dressed as. */
  screen: AppScreen
  data: TData | null
  loadError: string | null
  /** The screen that was asked for and is not ready yet, if any. */
  pending: AppScreen | null
  navigate: (request: ScreenRequest) => void
}

/**
 * Ten seconds is the point past which holding the page reads as a stuck page.
 * Committing then falls back to the screen's own loading states, which is
 * today's behaviour, reached only when the network is genuinely struggling.
 */
export const DEFAULT_NAVIGATION_TIMEOUT_MS = 10_000

function writeBrowserHistory(path: string, mode: 'push' | 'replace'): void {
  if (typeof window === 'undefined' || window.location.pathname === path) {
    return
  }
  const url = `${path}${window.location.search}`
  if (mode === 'replace') {
    window.history.replaceState(null, '', url)
  } else {
    window.history.pushState(null, '', url)
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to open that screen.'
}

interface PendingRequest {
  screen: AppScreen
  token: number
}

export function useScreenNavigator<TData>(
  options: ScreenNavigatorOptions<TData>,
): ScreenNavigator<TData> {
  const [committed, setCommitted] = useState<CommittedScreen<TData>>({
    screen: options.initialScreen,
    data: null,
    loadError: null,
  })
  const [pending, setPending] = useState<AppScreen | null>(null)
  const latestOptions = useRef(options)
  const committedScreen = useRef(options.initialScreen)
  const pendingRequest = useRef<PendingRequest | null>(null)
  const nextToken = useRef(0)

  useEffect(() => {
    latestOptions.current = options
  })

  const navigate = useCallback((request: ScreenRequest): void => {
    const {
      prepare,
      timeoutMs = DEFAULT_NAVIGATION_TIMEOUT_MS,
      commit = (_request, apply) => { apply() },
      writeHistory = writeBrowserHistory,
    } = latestOptions.current
    const mode = request.history ?? 'push'
    const path = request.path ?? APP_ROUTE_PATHS[request.screen]

    // Asking for the screen that is already showing is at most an address-bar
    // sync; there is nothing to load and nothing to dissolve between.
    if (pendingRequest.current === null && committedScreen.current === request.screen) {
      if (mode !== 'none') {
        writeHistory(path, mode)
      }
      return
    }
    // The same destination pressed twice is one request.
    if (pendingRequest.current?.screen === request.screen) {
      return
    }

    // Latest wins. A request that is still in flight is dropped here: its
    // token no longer matches, so whatever it resolves to is discarded.
    nextToken.current += 1
    const token = nextToken.current
    pendingRequest.current = { screen: request.screen, token }
    setPending(request.screen)

    let timer: ReturnType<typeof setTimeout> | undefined
    const settle = (data: TData | null, loadError: string | null): void => {
      clearTimeout(timer)
      if (pendingRequest.current?.token !== token) {
        return
      }
      pendingRequest.current = null
      committedScreen.current = request.screen
      // History is written at commit, not at request. Writing it on the click
      // is what made a superseded navigation impossible: the URL had already
      // moved to a page that never appeared.
      if (mode !== 'none') {
        writeHistory(path, mode)
      }
      commit(request, () => {
        setCommitted({ screen: request.screen, data, loadError })
        setPending(null)
      })
    }

    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => { resolve(null) }, timeoutMs)
    })
    void Promise.race([prepare(request), timeout]).then(
      (data) => { settle(data, null) },
      (error: unknown) => { settle(null, describeError(error)) },
    )
  }, [])

  return {
    screen: committed.screen,
    data: committed.data,
    loadError: committed.loadError,
    pending,
    navigate,
  }
}
