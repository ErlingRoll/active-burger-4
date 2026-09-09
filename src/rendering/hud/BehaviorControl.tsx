import { useEffect, useRef, useState } from 'react'
import type { BehaviorProfileId, GameUiSnapshot } from '../../game'
import {
  BEHAVIOR_PROFILE_DEFINITIONS,
  BEHAVIOR_PROFILE_ORDER,
} from '../../content/behaviors/BehaviorProfiles'
import { formatKeybind, type GameKeybinds } from '../../input/Keybinds'
import { BehaviorIcon } from './HudIcons'

const PROFILE_KEYBIND_IDS = {
  aggressive: 'behaviorAggressive',
  balanced: 'behaviorBalanced',
  cautious: 'behaviorCautious',
} as const

/**
 * How the character is being played, as one button rather than four.
 *
 * The profile list was a permanent panel in the bottom-right corner, which is
 * the corner a phone has least of. Collapsing it to the active profile costs a
 * desktop player nothing: the profiles have keyboard shortcuts, and the
 * shortcut is the fast path. The menu is what makes the same control work
 * under a thumb.
 */
export interface BehaviorControlProps {
  snapshot: GameUiSnapshot
  keybinds: GameKeybinds
  onSelectProfile: (profileId: BehaviorProfileId) => void
  onToggleFreeMovement: () => void
}

export function BehaviorControl({
  snapshot,
  keybinds,
  onSelectProfile,
  onToggleFreeMovement,
}: BehaviorControlProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // A pointer down anywhere else dismisses the menu. Registered only while it
  // is open so the HUD is not listening to every tap during a run.
  useEffect(() => {
    if (!open) {
      return
    }
    const handlePointerDown = (event: PointerEvent): void => {
      if (
        event.target instanceof Node &&
        rootRef.current?.contains(event.target) === true
      ) {
        return
      }
      setOpen(false)
    }
    window.addEventListener('pointerdown', handlePointerDown)
    return () => { window.removeEventListener('pointerdown', handlePointerDown) }
  }, [open])

  const freeMode = snapshot.behavior.freeMode
  const activeProfile = BEHAVIOR_PROFILE_DEFINITIONS[snapshot.behavior.profileId]
  const activeLabel = freeMode ? 'Free' : activeProfile.name
  const intentLabel = snapshot.behavior.activeIntent?.label ?? 'No active intent'

  return (
    <div className="hud-behavior" ref={rootRef}>
      {open ? (
        <div className="hud-behavior-menu" role="menu" aria-label="Movement behavior">
          {BEHAVIOR_PROFILE_ORDER.map((profileId) => {
            const profile = BEHAVIOR_PROFILE_DEFINITIONS[profileId]
            const selected = !freeMode && snapshot.behavior.profileId === profile.id
            const keybind = keybinds[PROFILE_KEYBIND_IDS[profile.id]]
            return (
              <button
                className={`hud-behavior-option${selected ? ' selected' : ''}`}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                aria-label={`${profile.name}: ${profile.description}. Shortcut ${formatKeybind(keybind)}`}
                key={profile.id}
                onClick={() => {
                  onSelectProfile(profile.id)
                  setOpen(false)
                }}
              >
                <span className="hud-behavior-option-name">{profile.name}</span>
                <span className="keybind-hint">{formatKeybind(keybind)}</span>
              </button>
            )
          })}
          <button
            className={`hud-behavior-option${freeMode ? ' selected' : ''}`}
            type="button"
            role="menuitemradio"
            aria-checked={freeMode}
            aria-label={`Free movement: steer the character yourself. Shortcut F. ${freeMode ? 'Active' : 'Select'}`}
            onClick={() => {
              onToggleFreeMovement()
              setOpen(false)
            }}
          >
            <span className="hud-behavior-option-name">Free</span>
            <span className="keybind-hint">F</span>
          </button>
          <p className="hud-behavior-hint">
            {freeMode
              ? 'Drag the arena or use WASD. Automatic Dodge is off.'
              : 'The character plays itself with this profile.'}
          </p>
        </div>
      ) : null}
      <button
        className={`hud-behavior-toggle${open ? ' open' : ''}`}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Movement behavior: ${activeLabel}. Intent: ${intentLabel}. Change`}
        onClick={() => setOpen((current) => !current)}
      >
        <BehaviorIcon />
        <span className="hud-behavior-toggle-text">
          <span className="hud-behavior-toggle-name">{activeLabel}</span>
          <span className="hud-behavior-toggle-intent">{intentLabel}</span>
        </span>
      </button>
    </div>
  )
}
