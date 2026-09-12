import { createElement, use, type ComponentType } from 'react'

/**
 * Route-level code splitting.
 *
 * Everything used to live in one chunk, so a visitor downloaded the admin
 * tools, the wiki, the fishing pond, and the whole PixiJS renderer before the
 * sign-in form could paint. Each screen below is fetched when it is first
 * needed instead.
 *
 * "Needed" is deliberately earlier than "shown". A screen's chunk can be
 * warmed by `preload()` — on hover over its tile, on idle, or by the navigator
 * before it commits the screen — and once the module has arrived, rendering
 * the screen is synchronous: no Suspense boundary is crossed, so the page
 * that was showing is never replaced by a loading panel. Only a screen that
 * is rendered before its chunk has landed (the navigator's timeout path, or a
 * direct render in a test) suspends, and `LazyScreen` supplies the fallback
 * and the error boundary for that case.
 *
 * `React.lazy` would not do here: it starts its own import on first render
 * and suspends on the promise even when the module is already in the browser's
 * cache, which costs exactly the flash of fallback this file exists to avoid.
 */

export interface ScreenModule<TProps extends object> {
  /** The screen, ready to render. Suspends only if the chunk is still in flight. */
  Screen: ComponentType<TProps>
  /** Starts the chunk download if it has not started, and resolves when it lands. */
  preload: () => Promise<void>
  /** Whether rendering `Screen` would be synchronous right now. */
  isLoaded: () => boolean
}

/**
 * A thenable React's `use()` can read synchronously once it has settled.
 *
 * `use` looks for these fields before subscribing to the promise; setting them
 * ourselves means a chunk that arrived before the screen rendered is read
 * without suspending at all.
 */
interface TrackedPromise<T> extends Promise<T> {
  status?: 'pending' | 'fulfilled' | 'rejected'
  value?: T
  reason?: unknown
}

function defineScreenModule<TProps extends object>(
  load: () => Promise<Record<string, unknown>>,
  exportName: string,
): ScreenModule<TProps> {
  let resolved: ComponentType<TProps> | null = null
  let inFlight: TrackedPromise<ComponentType<TProps>> | null = null

  const start = (): TrackedPromise<ComponentType<TProps>> => {
    if (inFlight) {
      return inFlight
    }
    const promise: TrackedPromise<ComponentType<TProps>> = load().then(
      (module) => {
        const component = module[exportName] as ComponentType<TProps>
        resolved = component
        promise.status = 'fulfilled'
        promise.value = component
        return component
      },
      (error: unknown) => {
        // A failed fetch is not permanent: the next render or preload tries
        // again, which is what the error boundary's "Try again" relies on.
        inFlight = null
        promise.status = 'rejected'
        promise.reason = error
        throw error
      },
    )
    promise.status = 'pending'
    inFlight = promise
    return promise
  }

  function Screen(props: TProps) {
    // `use` reads the status fields set above and returns synchronously once
    // the chunk has landed; React's own typing of those fields is narrower
    // than a promise that carries all three, hence the cast.
    const Component = resolved ?? use(start() as Promise<ComponentType<TProps>>)
    return createElement(Component as ComponentType<object>, props)
  }

  return {
    Screen: Screen as ComponentType<TProps>,
    preload: () => start().then(() => undefined),
    isLoaded: () => resolved !== null,
  }
}

type PropsOf<TComponent> = TComponent extends ComponentType<infer TProps>
  ? TProps
  : never

export const GameCanvasModule = defineScreenModule<
  PropsOf<typeof import('../rendering/GameCanvas')['GameCanvas']>
>(() => import('../rendering/GameCanvas'), 'GameCanvas')

export const WikiScreenModule = defineScreenModule<
  PropsOf<typeof import('../wiki/WikiScreen')['WikiScreen']>
>(() => import('../wiki/WikiScreen'), 'WikiScreen')

export const MetaProgressionScreenModule = defineScreenModule<
  PropsOf<typeof import('../meta/MetaProgressionScreen')['MetaProgressionScreen']>
>(() => import('../meta/MetaProgressionScreen'), 'MetaProgressionScreen')

export const FishingScreenModule = defineScreenModule<
  PropsOf<typeof import('../fishing/FishingScreen')['FishingScreen']>
>(() => import('../fishing/FishingScreen'), 'FishingScreen')

export const CampScreenModule = defineScreenModule<
  PropsOf<typeof import('../camp/CampScreen')['CampScreen']>
>(() => import('../camp/CampScreen'), 'CampScreen')

export const CollectionsScreenModule = defineScreenModule<
  PropsOf<typeof import('../collections/CollectionsScreen')['CollectionsScreen']>
>(() => import('../collections/CollectionsScreen'), 'CollectionsScreen')

export const ChampionManagementScreenModule = defineScreenModule<
  PropsOf<typeof import('../characters/ChampionManagementScreen')['ChampionManagementScreen']>
>(() => import('../characters/ChampionManagementScreen'), 'ChampionManagementScreen')

export const InventoryScreenModule = defineScreenModule<
  PropsOf<typeof import('../loot/LootBoxScreen')['InventoryScreen']>
>(() => import('../loot/LootBoxScreen'), 'InventoryScreen')

export const ShopScreenModule = defineScreenModule<
  PropsOf<typeof import('../shop/ShopScreen')['ShopScreen']>
>(() => import('../shop/ShopScreen'), 'ShopScreen')

export const AdminReportsScreenModule = defineScreenModule<
  PropsOf<typeof import('../admin/AdminReportsScreen')['AdminReportsScreen']>
>(() => import('../admin/AdminReportsScreen'), 'AdminReportsScreen')

export const NicknameModerationScreenModule = defineScreenModule<
  PropsOf<typeof import('../admin/NicknameModerationScreen')['NicknameModerationScreen']>
>(() => import('../admin/NicknameModerationScreen'), 'NicknameModerationScreen')

export const RunSetupScreenModule = defineScreenModule<
  PropsOf<typeof import('./screens/RunSetupScreen')['RunSetupScreen']>
>(() => import('./screens/RunSetupScreen'), 'RunSetupScreen')

export const RunChronicleScreenModule = defineScreenModule<
  PropsOf<typeof import('../run-history/RunChronicleScreen')['RunChronicleScreen']>
>(() => import('../run-history/RunChronicleScreen'), 'RunChronicleScreen')

export const LazyGameCanvas = GameCanvasModule.Screen
export const LazyWikiScreen = WikiScreenModule.Screen
export const LazyMetaProgressionScreen = MetaProgressionScreenModule.Screen
export const LazyFishingScreen = FishingScreenModule.Screen
export const LazyCampScreen = CampScreenModule.Screen
export const LazyCollectionsScreen = CollectionsScreenModule.Screen
export const LazyChampionManagementScreen = ChampionManagementScreenModule.Screen
export const LazyInventoryScreen = InventoryScreenModule.Screen
export const LazyShopScreen = ShopScreenModule.Screen
export const LazyAdminReportsScreen = AdminReportsScreenModule.Screen
export const LazyNicknameModerationScreen = NicknameModerationScreenModule.Screen
export const LazyRunSetupScreen = RunSetupScreenModule.Screen
export const LazyRunChronicleScreen = RunChronicleScreenModule.Screen
