import type { BehaviorProfileId, GameUiSnapshot } from '../../game'
import {
  BEHAVIOR_PROFILE_DEFINITIONS,
  BEHAVIOR_PROFILE_ORDER,
} from '../../content/behaviors/BehaviorProfiles'
import {
  formatKeybind,
  type GameKeybinds,
} from '../../input/Keybinds'
import { GEAR_XP_BLESSING_MULTIPLIER } from '../../game-config/gear'

const PROFILE_KEYBIND_IDS = {
  aggressive: 'behaviorAggressive',
  balanced: 'behaviorBalanced',
  cautious: 'behaviorCautious',
} as const




/**
 * The status panels drawn alongside the gameplay HUD.
 *
 * Each reads only the UI snapshot (and, for the behaviour panel, the keybinds),
 * so they render from a snapshot taken from a real game in tests without a
 * running simulation behind them.
 */

export function DungeonStats({ snapshot }: { snapshot: GameUiSnapshot }) {
  return (
    <section
      className="dungeon-stats dungeon-stats-top"
      aria-labelledby="dungeon-stats-title"
    >
      <h3 id="dungeon-stats-title">Dungeon stats</h3>
      <dl className="dungeon-stats-list">
        <div className="dungeon-stat">
          <dt>Floor</dt>
          <dd>{snapshot.floor}</dd>
        </div>
        <div className="dungeon-stat">
          <dt>Essence</dt>
          <dd aria-label="Estimated Essence">{snapshot.estimatedEssence}</dd>
        </div>
        <div className="dungeon-stat">
          <dt>Kills</dt>
          <dd>{snapshot.killCount}</dd>
        </div>
        <div className="dungeon-stat">
          <dt>Gear blessing</dt>
          <dd>{snapshot.gearXpBlessingActive ? `${GEAR_XP_BLESSING_MULTIPLIER}x XP` : 'Inactive'}</dd>
        </div>
      </dl>
    </section>
  )
}

export function FloorHud({ snapshot }: { snapshot: GameUiSnapshot }) {
  return (
    <section
      className="floor-hud floor-hud-top"
      aria-label="Floor status"
    >
      <div className="projection-heading">
        <strong>Floor {snapshot.floor}</strong>
        <span>{Math.ceil(snapshot.floorProgress * 100)}%</span>
      </div>
      <progress
        value={snapshot.floorProgress * 100}
        max={100}
        aria-label={`Floor ${snapshot.floor} progress`}
      />
      <span>
        {Math.floor(snapshot.floorElapsedTime)}s /{' '}
        {snapshot.floorDurationSeconds}s
      </span>
    </section>
  )
}

export function BehaviorHud({
  snapshot,
  keybinds,
  onSelectProfile,
  onToggleFreeMovement,
}: {
  snapshot: GameUiSnapshot
  keybinds: GameKeybinds
  onSelectProfile: (profileId: BehaviorProfileId) => void
  onToggleFreeMovement: () => void
}) {
  return (
    <section className="behavior-hud behavior-hud-bottom" aria-labelledby="behavior-hud-title">
      <h3 id="behavior-hud-title" className="visually-hidden">
        Behavior
      </h3>
      <p className="behavior-hud-heading">Movement behavior</p>
      <div className="behavior-hud-profile-list">
        {BEHAVIOR_PROFILE_ORDER.map((profileId) => {
          const profile = BEHAVIOR_PROFILE_DEFINITIONS[profileId]
          const selected = !snapshot.behavior.freeMode &&
            snapshot.behavior.profileId === profile.id
          const keybind = keybinds[PROFILE_KEYBIND_IDS[profile.id]]
          return (
            <button
              className={`behavior-hud-profile${selected ? ' selected' : ''}`}
              type="button"
              aria-pressed={selected}
              aria-label={`${profile.name}: ${profile.description}. Shortcut ${formatKeybind(keybind)}`}
              title={profile.description}
              key={profile.id}
              onClick={() => onSelectProfile(profile.id)}
            >
              <span className="behavior-hud-profile-name">{profile.name}</span>
              <span className="keybind-hint">{formatKeybind(keybind)}</span>
            </button>
          )
        })}
        <button
          className={`behavior-hud-profile${snapshot.behavior.freeMode ? ' selected' : ''}`}
          type="button"
          aria-pressed={snapshot.behavior.freeMode}
          aria-label={`Free movement: control the character with WASD. Shortcut F. ${snapshot.behavior.freeMode ? 'Active' : 'Select'}`}
          title="Control the character directly with WASD. Automatic Dodge is disabled."
          onClick={onToggleFreeMovement}
        >
          <span className="behavior-hud-profile-name">Free</span>
          <span className="keybind-hint">F</span>
        </button>
      </div>
      <p className="behavior-hud-current-intent">
        {snapshot.behavior.freeMode
          ? <>WASD movement · Intent: <strong>{snapshot.behavior.activeIntent?.label ?? 'No active intent'}</strong></>
          : <>Intent: <strong>{snapshot.behavior.activeIntent?.label ?? 'No active intent'}</strong></>}
      </p>
    </section>
  )
}
