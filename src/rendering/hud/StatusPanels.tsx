import type { GameUiSnapshot } from '../../game'
import { formatExperience } from '../../ui/formatNumbers'

/**
 * The status the player reads without looking away from the fight.
 *
 * Everything here changes second to second and earns its place on the arena;
 * the loadout, the stat sheet and the run totals do not, and live in the HUD
 * inspector instead. Each panel reads only the UI snapshot, so a snapshot taken
 * from a real seeded game renders them in a test with no simulation running.
 */

export function VitalsPanel({ snapshot }: { snapshot: GameUiSnapshot }) {
  const hp = Math.max(0, Math.min(snapshot.hp, snapshot.maxHp))
  const shield = snapshot.shield

  return (
    <section className="hud-vitals hud-panel" aria-label="Player vitals">
      <div className="hud-vital hud-vital-health">
        <span className="hud-vital-label">HP</span>
        <progress value={hp} max={snapshot.maxHp} aria-label="Player health" />
        <span className="hud-vital-value">
          {Math.ceil(hp)} / {Math.ceil(snapshot.maxHp)}
        </span>
      </div>
      {shield ? (
        <div className="hud-vital hud-vital-shield">
          <span className="hud-vital-label">Shield</span>
          <progress
            value={shield.amount}
            max={shield.maxAmount}
            aria-label="Absorb shield"
          />
          <span className="hud-vital-value">
            {Math.ceil(shield.amount)} · {shield.remainingSeconds.toFixed(1)}s
          </span>
        </div>
      ) : null}
      <div className="hud-vital hud-vital-xp">
        <span className="hud-vital-label">
          Lv <b>{snapshot.level}</b>
        </span>
        <progress
          value={snapshot.xpProgress * 100}
          max={100}
          aria-label="Experience progress"
        />
        <span className="hud-vital-value">
          {formatExperience(snapshot.xp)} / {formatExperience(snapshot.xpRequired)}
        </span>
      </div>
    </section>
  )
}

export function FloorHud({ snapshot }: { snapshot: GameUiSnapshot }) {
  return (
    <section className="floor-hud hud-panel" aria-label="Floor status">
      <div className="projection-heading">
        <strong>Floor {snapshot.floor}</strong>
        <span>
          {Math.floor(snapshot.floorElapsedTime)}s / {snapshot.floorDurationSeconds}s
        </span>
      </div>
      <progress
        value={snapshot.floorProgress * 100}
        max={100}
        aria-label={`Floor ${snapshot.floor} progress`}
      />
    </section>
  )
}
