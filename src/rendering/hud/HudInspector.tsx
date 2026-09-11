import { useEffect, useRef } from 'react'
import type { GameUiSnapshot } from '../../game'
import { CharacterStatsPanel, LoadoutPanel } from './EquippedLoadout'
import { getAbyssFloorRiftShards, getAbyssRiftShardsBanked } from '../../loot/LootBoxes'
import { MaterialIcon } from '../../inventory/MaterialIcon'
import { CloseIcon } from './HudIcons'
import {
  HUD_INSPECTOR_TABS,
  HUD_INSPECTOR_TAB_LABELS,
  type HudInspectorTab,
} from './HudInspectorTabs'
import type { HudTooltips } from './useHudTooltips'

/**
 * The reference half of the HUD, behind a door.
 *
 * The loadout, the stat sheet and the run totals are consulted between
 * decisions rather than between frames, so they are not worth a permanent
 * quarter of the arena — least of all on a phone, where the arena is the whole
 * screen. They live here instead: one sheet, three tabs, opened from the
 * toolbar and closed with Escape or the toolbar button that opened it.
 *
 * The sheet is `min(30rem, 100%)` wide rather than two layouts behind a
 * breakpoint: on a desktop it is a panel down the right-hand edge, and on a
 * phone the same rule makes it the whole screen.
 */

export interface HudInspectorProps {
  snapshot: GameUiSnapshot
  tooltips: HudTooltips
  tab: HudInspectorTab
  onTabChange: (tab: HudInspectorTab) => void
  onClose: () => void
}

export function HudInspector({
  snapshot,
  tooltips,
  tab,
  onTabChange,
  onClose,
}: HudInspectorProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  // Opening the sheet moves focus into it, so a keyboard or a screen reader
  // lands on the thing that just appeared rather than staying behind it.
  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  return (
    <aside
      className="hud-inspector"
      role="dialog"
      aria-label="Run details"
      aria-modal="false"
    >
      <header className="hud-inspector-bar">
        <div className="hud-inspector-tabs" role="tablist" aria-label="Run details">
          {HUD_INSPECTOR_TABS.map((candidate) => (
            <button
              className={`hud-inspector-tab${candidate === tab ? ' selected' : ''}`}
              type="button"
              role="tab"
              id={`hud-inspector-tab-${candidate}`}
              aria-selected={candidate === tab}
              aria-controls={`hud-inspector-panel-${candidate}`}
              key={candidate}
              onClick={() => onTabChange(candidate)}
            >
              {HUD_INSPECTOR_TAB_LABELS[candidate]}
            </button>
          ))}
        </div>
        <button
          className="hud-inspector-close"
          type="button"
          ref={closeRef}
          aria-label={`Close ${HUD_INSPECTOR_TAB_LABELS[tab].toLowerCase()} details`}
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </header>
      <div
        className="hud-inspector-body"
        role="tabpanel"
        id={`hud-inspector-panel-${tab}`}
        aria-labelledby={`hud-inspector-tab-${tab}`}
      >
        {tab === 'gear' ? <LoadoutPanel snapshot={snapshot} tooltips={tooltips} /> : null}
        {tab === 'stats' ? <CharacterStatsPanel snapshot={snapshot} tooltips={tooltips} /> : null}
        {tab === 'run' ? <RunStatsPanel snapshot={snapshot} /> : null}
      </div>
    </aside>
  )
}

/**
 * The run totals. Reference rather than status: none of it changes what the
 * player does in the next second, which is why it is behind the same door.
 */
export function RunStatsPanel({ snapshot }: { snapshot: GameUiSnapshot }) {
  return (
    <section className="dungeon-stats hud-panel" aria-labelledby="dungeon-stats-title">
      <h3 id="dungeon-stats-title" className="hud-panel-heading">Dungeon stats</h3>
      <dl className="dungeon-stats-list">
        {/* The Abyss pays no Essence; it pays rift shards a floor. What is
            banked so far is the number, and the floor in play says what it
            adds, so the push-or-stop trade reads in shards as it does in boxes. */}
        {snapshot.modeId === 'infinite-abyss' ? (
          <div className="dungeon-stat">
            <dt>Rift shards</dt>
            <dd aria-label="Rift shards banked">
              <MaterialIcon icon="rift-shard" color="var(--color-violet-300)" />
              {getAbyssRiftShardsBanked(snapshot.floor - 1)}
              <span className="dungeon-stat-note">
                +{getAbyssFloorRiftShards(snapshot.floor)} for this floor
              </span>
            </dd>
          </div>
        ) : (
          <div className="dungeon-stat">
            <dt>Essence</dt>
            <dd aria-label="Estimated Essence">{snapshot.estimatedEssence}</dd>
          </div>
        )}
        <div className="dungeon-stat">
          <dt>Kills</dt>
          <dd>{snapshot.killCount}</dd>
        </div>
      </dl>
    </section>
  )
}
