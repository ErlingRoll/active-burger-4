/**
 * The inspector's tabs, named apart from the sheet that renders them.
 *
 * The toolbar builds its buttons from this list and the sheet renders whichever
 * one is open, so both need it; keeping it in the sheet's own module meant a
 * file that exported components and constants together, which costs fast
 * refresh on every edit to either.
 */
export const HUD_INSPECTOR_TABS = ['gear', 'stats', 'run', 'build'] as const

export type HudInspectorTab = typeof HUD_INSPECTOR_TABS[number]

export const HUD_INSPECTOR_TAB_LABELS: Readonly<Record<HudInspectorTab, string>> = {
  gear: 'Loadout',
  stats: 'Stats',
  run: 'Run',
  build: 'Build',
}

/**
 * The build planner is the one tab a wide screen keeps: the rails show the
 * other three, but a planner is edited, not read, so it opens as a sheet on
 * every screen. The stylesheet reads this from `data-tab` on the toolbar
 * button and the inspector.
 */
export const HUD_INSPECTOR_SHEET_ONLY_TABS: readonly HudInspectorTab[] = ['build']
