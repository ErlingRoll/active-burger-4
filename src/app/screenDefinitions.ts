import type { AppServices } from '../services/AppServices'
import { loadCampScreen, type CampScreenData } from '../camp/loadCampScreen'
import { loadChampionsScreen, type ChampionsScreenData } from '../characters/loadChampionsScreen'
import { loadCollectionsScreen, type CollectionsScreenData } from '../collections/loadCollectionsScreen'
import { loadFishingScreen, type FishingScreenData } from '../fishing/loadFishingScreen'
import { loadInventoryScreen, type InventoryScreenData } from '../loot/loadInventoryScreen'
import { loadChronicleScreen, type ChronicleScreenData } from '../run-history/loadChronicleScreen'
import { loadShopScreen, type ShopScreenData } from '../shop/loadShopScreen'
import {
  AdminReportsScreenModule,
  CampScreenModule,
  ChampionManagementScreenModule,
  CollectionsScreenModule,
  FishingScreenModule,
  GameCanvasModule,
  InventoryScreenModule,
  MetaProgressionScreenModule,
  NicknameModerationScreenModule,
  RunChronicleScreenModule,
  RunSetupScreenModule,
  ShopScreenModule,
  WikiScreenModule,
} from './lazyScreens'
import type { AppScreen } from './routing'
import { loadRunSetupScreen, type RunSetupScreenData } from './screens/loadRunSetupScreen'

/**
 * The screen registry: what each destination is, and what it waits on.
 *
 * `chunk` is the screen's code, warmed before the screen is committed and
 * again on intent (a hover over its tile) so that it is usually already here
 * by the click. `load` is the screen's first fetch, run by the navigator in
 * parallel with the chunk while the previous page is still showing; its
 * result reaches the screen as `initialData`, so the screen paints populated
 * on its first frame instead of mounting empty and fetching.
 *
 * A screen with no `load` has no first fetch that blocks a complete paint
 * (the wiki), or is gated on state `App` holds itself (the Essence store and
 * the two admin dashboards, whose fetches App runs before it commits).
 */

export interface ScreenChunk {
  preload: () => Promise<void>
  isLoaded: () => boolean
}

export interface ScreenDefinition<TData> {
  /** How the screen is named in its loading and failure panels. */
  label: string
  chunk?: ScreenChunk
  /** Resolves `null` when the service the screen needs is not configured; the screen explains that itself. */
  load?: (services: AppServices) => Promise<TData | null>
}

/** The screens with a loader, and what it produces. */
export interface ScreenLoaderResults {
  shop: ShopScreenData
  inventory: InventoryScreenData
  champions: ChampionsScreenData
  'run-history': ChronicleScreenData
  fishing: FishingScreenData
  'run-setup': RunSetupScreenData
  camp: CampScreenData
  collections: CollectionsScreenData
}

export type LoadedScreen = keyof ScreenLoaderResults

/** A loader's result tagged with the screen it belongs to. */
export type LoadedScreenData = {
  [S in LoadedScreen]: { screen: S; data: ScreenLoaderResults[S] }
}[LoadedScreen]

type ScreenDefinitions = {
  [S in AppScreen]: ScreenDefinition<S extends LoadedScreen ? ScreenLoaderResults[S] : never>
}

export const SCREEN_DEFINITIONS: ScreenDefinitions = {
  dashboard: { label: 'The refuge' },
  results: { label: 'The run report' },
  gameplay: { label: 'The dungeon run', chunk: GameCanvasModule },
  wiki: { label: 'The wiki', chunk: WikiScreenModule },
  'meta-progression': { label: 'The essence store', chunk: MetaProgressionScreenModule },
  admin: { label: 'Bug reports', chunk: AdminReportsScreenModule },
  'nickname-moderation': { label: 'Nickname moderation', chunk: NicknameModerationScreenModule },
  shop: { label: 'The shop', chunk: ShopScreenModule, load: loadShopScreen },
  inventory: { label: 'The inventory', chunk: InventoryScreenModule, load: loadInventoryScreen },
  champions: { label: 'Champions', chunk: ChampionManagementScreenModule, load: loadChampionsScreen },
  'run-history': { label: 'The chronicle', chunk: RunChronicleScreenModule, load: loadChronicleScreen },
  fishing: { label: 'The fishing pond', chunk: FishingScreenModule, load: loadFishingScreen },
  'run-setup': { label: 'Run preparation', chunk: RunSetupScreenModule, load: loadRunSetupScreen },
  camp: { label: 'The Camp', chunk: CampScreenModule, load: loadCampScreen },
  collections: { label: 'The collections', chunk: CollectionsScreenModule, load: loadCollectionsScreen },
}

/**
 * The routes the hub sends players to most, warmed once the hub has painted
 * and the browser is idle, in that order.
 */
export const IDLE_PRELOAD_SCREENS: readonly AppScreen[] = ['run-setup', 'champions', 'inventory']

/** Starts a screen's chunk downloading. Cheap to call again; the import is cached. */
export function preloadScreen(screen: AppScreen): Promise<void> {
  return SCREEN_DEFINITIONS[screen].chunk?.preload() ?? Promise.resolve()
}

function tag<S extends LoadedScreen>(
  screen: S,
  data: ScreenLoaderResults[S] | null,
): LoadedScreenData | null {
  return data === null ? null : { screen, data } as LoadedScreenData
}

/** Runs a screen's first fetch. Resolves `null` for a screen without one. */
export async function loadScreenData(
  screen: AppScreen,
  services: AppServices,
): Promise<LoadedScreenData | null> {
  switch (screen) {
    case 'shop':
      return tag('shop', await loadShopScreen(services))
    case 'inventory':
      return tag('inventory', await loadInventoryScreen(services))
    case 'champions':
      return tag('champions', await loadChampionsScreen(services))
    case 'run-history':
      return tag('run-history', await loadChronicleScreen(services))
    case 'fishing':
      return tag('fishing', await loadFishingScreen(services))
    case 'run-setup':
      return tag('run-setup', await loadRunSetupScreen(services))
    case 'camp':
      return tag('camp', await loadCampScreen(services))
    case 'collections':
      return tag('collections', await loadCollectionsScreen(services))
    default:
      return null
  }
}
