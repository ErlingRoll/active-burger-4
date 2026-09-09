/**
 * The inspector's tabs, named apart from the sheet that renders them.
 *
 * The toolbar builds its buttons from this list and the sheet renders whichever
 * one is open, so both need it; keeping it in the sheet's own module meant a
 * file that exported components and constants together, which costs fast
 * refresh on every edit to either.
 */
export const HUD_INSPECTOR_TABS = ['gear', 'stats', 'run'] as const

export type HudInspectorTab = typeof HUD_INSPECTOR_TABS[number]

export const HUD_INSPECTOR_TAB_LABELS: Readonly<Record<HudInspectorTab, string>> = {
  gear: 'Loadout',
  stats: 'Stats',
  run: 'Run',
}
