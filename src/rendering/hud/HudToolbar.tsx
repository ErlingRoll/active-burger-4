import type { ComponentType } from 'react'
import {
  HUD_INSPECTOR_TAB_LABELS,
  HUD_INSPECTOR_TABS,
  type HudInspectorTab,
} from './HudInspectorTabs'
import { LoadoutIcon, PauseIcon, RunIcon, StatsIcon } from './HudIcons'

const TAB_ICONS: Readonly<Record<HudInspectorTab, ComponentType<{ className?: string }>>> = {
  gear: LoadoutIcon,
  stats: StatsIcon,
  run: RunIcon,
}

/**
 * The doors to everything the HUD does not keep on screen.
 *
 * Each button is a square big enough for a thumb and carries its label in
 * `aria-label` rather than beside the glyph, so the strip is the same width on
 * a desktop and a phone. Pause is here because a phone has no Escape key, and
 * a run that cannot be paused on the device most likely to be interrupted is
 * not a run anyone finishes.
 */
export interface HudToolbarProps {
  activeTab: HudInspectorTab | null
  onToggleTab: (tab: HudInspectorTab) => void
  onPause: () => void
}

export function HudToolbar({ activeTab, onToggleTab, onPause }: HudToolbarProps) {
  return (
    <div className="hud-toolbar" role="group" aria-label="Run controls">
      {HUD_INSPECTOR_TABS.map((tab) => {
        const Icon = TAB_ICONS[tab]
        const selected = activeTab === tab
        return (
          <button
            className={`hud-toolbar-button${selected ? ' selected' : ''}`}
            type="button"
            aria-pressed={selected}
            aria-label={`${HUD_INSPECTOR_TAB_LABELS[tab]} details`}
            title={HUD_INSPECTOR_TAB_LABELS[tab]}
            key={tab}
            onClick={() => onToggleTab(tab)}
          >
            <Icon />
          </button>
        )
      })}
      <button
        className="hud-toolbar-button hud-toolbar-pause"
        type="button"
        aria-label="Pause the run"
        title="Pause"
        onClick={onPause}
      >
        <PauseIcon />
      </button>
    </div>
  )
}
