import { useEffect, useRef } from 'react'
import {
  BEHAVIOR_PROFILE_DEFINITIONS,
  type BehaviorHudSnapshot,
  type BehaviorProfileId,
} from '../game'

interface BehaviorScreenProps {
  behavior: BehaviorHudSnapshot
  onSelectProfile: (profileId: BehaviorProfileId) => void
  onClose: () => void
}

const PROFILE_DEFINITIONS = Object.values(BEHAVIOR_PROFILE_DEFINITIONS)

export function BehaviorScreen({
  behavior,
  onSelectProfile,
  onClose,
}: BehaviorScreenProps) {
  const selectedProfileRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    selectedProfileRef.current?.focus()
  }, [])

  return (
    <section
      className="behavior-screen"
      role="dialog"
      aria-modal="true"
      aria-labelledby="behavior-screen-title"
    >
      <div className="behavior-panel">
        <div className="behavior-panel-heading">
          <div>
            <p className="screen-kicker">In-run settings</p>
            <h2 id="behavior-screen-title">Behavior</h2>
          </div>
          <button
            className="behavior-close"
            type="button"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <p className="behavior-instructions">
          Choose how your hero prioritizes future actions. The active profile
          changes immediately and does not alter the current run seed.
        </p>
        <div className="behavior-profile-list">
          {PROFILE_DEFINITIONS.map((profile) => {
            const selected = behavior.profileId === profile.id
            return (
              <button
                ref={selected ? selectedProfileRef : undefined}
                className={`behavior-profile${selected ? ' selected' : ''}`}
                data-profile-id={profile.id}
                type="button"
                aria-pressed={selected}
                key={profile.id}
                onClick={() => onSelectProfile(profile.id)}
              >
                <span className="behavior-profile-heading">
                  <strong>{profile.name}</strong>
                  <span>{selected ? 'Active' : 'Select'}</span>
                </span>
                <span>{profile.description}</span>
              </button>
            )
          })}
        </div>
        <p className="behavior-current-intent">
          Current intent:{' '}
          <strong>{behavior.activeIntent?.label ?? 'No active intent'}</strong>
        </p>
      </div>
    </section>
  )
}
