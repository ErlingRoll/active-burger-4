import type { CSSProperties } from 'react'
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
  /*
   * The shield is drawn on the health bar rather than on a row of its own.
   *
   * A row that comes and goes changed the height of the vitals panel, and the
   * top bar stretches every panel to the tallest of them, so the whole bar —
   * clock, controls and all — jumped by the height of a row each time a shield
   * was cast or expired. Reserving the row permanently was the other way out
   * and costs a fifth of the bar's height at all times to show nothing.
   *
   * It also reads better where it is: an absorb shield is health before your
   * health, so it belongs on the bar it is protecting, measured against the
   * same maximum.
   */
  const shieldShare = shield
    ? Math.min(1, shield.amount / Math.max(1, snapshot.maxHp))
    : 0

  return (
    <section className="hud-vitals hud-panel" aria-label="Player vitals">
      <div className="hud-vital hud-vital-health">
        <span className="hud-vital-label">HP</span>
        <span className="hud-vital-bar">
          <progress value={hp} max={snapshot.maxHp} aria-label="Player health" />
          {shield ? (
            <span
              className="hud-vital-shield-fill"
              style={{ '--shield-share': shieldShare } as CSSProperties}
              aria-hidden="true"
            />
          ) : null}
        </span>
        <span className="hud-vital-value">
          {Math.ceil(hp)} / {Math.ceil(snapshot.maxHp)}
          {/*
            * Always rendered, empty when there is no shield, because the
            * column is sized by its contents: letting the figure appear and
            * disappear shortened and lengthened the health bar beside it every
            * time a shield was cast. Whole seconds rather than tenths for the
            * same reason — a tenths counter changes width as it passes ten.
            */}
          <b className="hud-vital-shield-amount">
            {shield
              ? `+${Math.ceil(shield.amount)} · ${Math.ceil(shield.remainingSeconds)}s`
              : ''}
          </b>
        </span>
      </div>
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
