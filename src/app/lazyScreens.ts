import { lazy, type ComponentType } from 'react'

/**
 * Route-level code splitting.
 *
 * Everything used to live in one chunk, so a visitor downloaded the admin
 * tools, the wiki, the fishing pond, and the whole PixiJS renderer before the
 * sign-in form could paint. Each screen below is fetched when it is first
 * shown instead.
 *
 * `lazy` needs a module with a default export, and these screens are named
 * exports, hence the small adapter below. Render each of these inside
 * `LazyScreen`, which supplies the loading state and the error boundary.
 */

function named<TProps>(
  load: () => Promise<Record<string, unknown>>,
  exportName: string,
): ComponentType<TProps> {
  return lazy(async () => {
    const module = await load()
    return { default: module[exportName] as ComponentType<TProps> }
  })
}

type PropsOf<TComponent> = TComponent extends ComponentType<infer TProps>
  ? TProps
  : never

export const LazyGameCanvas = named<
  PropsOf<typeof import('../rendering/GameCanvas')['GameCanvas']>
>(() => import('../rendering/GameCanvas'), 'GameCanvas')

export const LazyWikiScreen = named<
  PropsOf<typeof import('../wiki/WikiScreen')['WikiScreen']>
>(() => import('../wiki/WikiScreen'), 'WikiScreen')

export const LazyMetaProgressionScreen = named<
  PropsOf<typeof import('../meta/MetaProgressionScreen')['MetaProgressionScreen']>
>(() => import('../meta/MetaProgressionScreen'), 'MetaProgressionScreen')

export const LazyFishingScreen = named<
  PropsOf<typeof import('../fishing/FishingScreen')['FishingScreen']>
>(() => import('../fishing/FishingScreen'), 'FishingScreen')

export const LazyChampionManagementScreen = named<
  PropsOf<typeof import('../characters/ChampionManagementScreen')['ChampionManagementScreen']>
>(() => import('../characters/ChampionManagementScreen'), 'ChampionManagementScreen')

export const LazyInventoryScreen = named<
  PropsOf<typeof import('../loot/LootBoxScreen')['InventoryScreen']>
>(() => import('../loot/LootBoxScreen'), 'InventoryScreen')

export const LazyShopScreen = named<
  PropsOf<typeof import('../shop/ShopScreen')['ShopScreen']>
>(() => import('../shop/ShopScreen'), 'ShopScreen')

export const LazyAdminReportsScreen = named<
  PropsOf<typeof import('../admin/AdminReportsScreen')['AdminReportsScreen']>
>(() => import('../admin/AdminReportsScreen'), 'AdminReportsScreen')

export const LazyNicknameModerationScreen = named<
  PropsOf<typeof import('../admin/NicknameModerationScreen')['NicknameModerationScreen']>
>(() => import('../admin/NicknameModerationScreen'), 'NicknameModerationScreen')

export const LazyRunSetupScreen = named<
  PropsOf<typeof import('./screens/RunSetupScreen')['RunSetupScreen']>
>(() => import('./screens/RunSetupScreen'), 'RunSetupScreen')
