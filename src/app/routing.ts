import type { MusicPlaylistId } from '../audio'
import { DEFAULT_RUN_MODE_ID, type RunModeId } from '../game'

/**
 * The application's routing table.
 *
 * Routing is hand-rolled over the History API rather than delegated to a
 * router library. Keeping the path mapping in one module means the screen
 * union, the paths, and the music each screen plays cannot drift apart, and
 * lets the mapping be tested without mounting the app.
 */

export type AppScreen =
  | 'dashboard'
  | 'run-setup'
  | 'meta-progression'
  | 'fishing'
  | 'champions'
  | 'inventory'
  | 'gameplay'
  | 'results'
  | 'admin'
  | 'nickname-moderation'
  | 'wiki'

export const APP_ROUTE_PATHS: Record<AppScreen, string> = {
  dashboard: '/',
  'run-setup': '/prepare/dungeon',
  'meta-progression': '/store',
  fishing: '/fishing',
  champions: '/champions',
  inventory: '/inventory',
  gameplay: '/',
  results: '/',
  admin: '/admin',
  'nickname-moderation': '/admin/nicknames',
  wiki: '/wiki',
}

/**
 * The screens that are documents rather than screens.
 *
 * Everything else fits the viewport and never scrolls. These hold more than a
 * viewport by nature — the codex is a reference manual, the roster grows with
 * every victory, the store's upgrade list grows with every upgrade added, and
 * the moderation dashboards list whatever players have sent in — and shrinking
 * that to fit made them unreadable, so they scroll instead.
 * `app-shell-document` is what grants it.
 */
export const DOCUMENT_SCREENS: ReadonlySet<AppScreen> = new Set<AppScreen>([
  'wiki',
  'champions',
  'meta-progression',
  'admin',
  'nickname-moderation',
])

export const RUN_SETUP_ABYSS_PATH = '/prepare/abyss'
export const LEGACY_RUN_SETUP_PATH = '/prepare'

/**
 * Reverse lookup from path to screen.
 *
 * Derived from `APP_ROUTE_PATHS` rather than written out as a chain of
 * comparisons, which had silently omitted `/champions`: the screen had a path,
 * navigating to it set that URL, but reloading resolved back to the dashboard.
 *
 * Screens that share the root path are excluded. `gameplay` and `results` are
 * transient states rendered at `/`, and `/` must resolve to the dashboard.
 */
const SCREENS_BY_PATH: ReadonlyMap<string, AppScreen> = new Map(
  Object.entries(APP_ROUTE_PATHS)
    .filter(([, path]) => path !== APP_ROUTE_PATHS.dashboard)
    .map(([screen, path]) => [path, screen as AppScreen]),
)

function normalizePath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
}

export function getScreenForPath(pathname: string): AppScreen {
  const normalizedPath = normalizePath(pathname)
  if (
    normalizedPath === RUN_SETUP_ABYSS_PATH ||
    normalizedPath === LEGACY_RUN_SETUP_PATH
  ) {
    return 'run-setup'
  }
  return SCREENS_BY_PATH.get(normalizedPath) ?? 'dashboard'
}

export function getRunModeForPath(pathname: string): RunModeId {
  return normalizePath(pathname) === RUN_SETUP_ABYSS_PATH
    ? 'infinite-abyss'
    : DEFAULT_RUN_MODE_ID
}

export function getCanonicalPath(pathname: string): string {
  const normalizedPath = normalizePath(pathname)
  return normalizedPath === RUN_SETUP_ABYSS_PATH
    ? RUN_SETUP_ABYSS_PATH
    : APP_ROUTE_PATHS[getScreenForPath(pathname)]
}

export function getMusicPlaylistId(
  screen: AppScreen,
  runMode: RunModeId,
): MusicPlaylistId | null {
  if (screen === 'dashboard') {
    return 'dashboard'
  }
  if (screen === 'fishing') {
    return 'fishing'
  }
  if (screen === 'gameplay') {
    return runMode === 'infinite-abyss' ? 'abyss' : 'dungeon'
  }
  return null
}
