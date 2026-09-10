import { useEffect, useRef, useState } from 'react'
import type { BehaviorProfileId, GameUiSnapshot, TargetPriorityId } from '../../game'
import {
  BEHAVIOR_PROFILE_DEFINITIONS,
  BEHAVIOR_PROFILE_ORDER,
} from '../../content/behaviors/BehaviorProfiles'
import {
  DEFAULT_TARGET_PRIORITY_ID,
  TARGET_PRIORITY_DEFINITIONS,
  TARGET_PRIORITY_ORDER,
} from '../../content/behaviors/TargetPriorities'
import { formatKeybind, type GameKeybinds } from '../../input/Keybinds'
import { useTouchOnlyDevice } from '../../input/useTouchOnlyDevice'
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
 *
 * It holds two questions rather than one: where the character stands, and who
 * it attacks. They are one control because the top bar has room for one — a
 * second toggle of this construction wraps the bar onto another row at phone
 * width — and because only one popover may be open for the run's own Escape
 * handler to reason about.
 */
export interface BehaviorControlProps {
  snapshot: GameUiSnapshot
  keybinds: GameKeybinds
  onSelectProfile: (profileId: BehaviorProfileId) => void
  onSelectTargetPriority: (priorityId: TargetPriorityId) => void
  onToggleFreeMovement: () => void
}

export function BehaviorControl({
  snapshot,
  keybinds,
  onSelectProfile,
  onSelectTargetPriority,
  onToggleFreeMovement,
}: BehaviorControlProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  /*
   * Free movement is steered with WASD, so on a device with no keyboard
   * choosing it strands the character. Touch players steer by dragging the
   * arena, which borrows the character for the length of the drag and hands it
   * back, so nothing is lost by leaving the mode out.
   */
  const touchOnly = useTouchOnlyDevice()

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
    // Escape closes the menu rather than reaching the run behind it and
    // pausing, which is what one key doing two jobs looked like from the
    // player's side.
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') {
        return
      }
      event.preventDefault()
      setOpen(false)
    }
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, [open])

  const freeMode = snapshot.behavior.freeMode
  const activeProfile = BEHAVIOR_PROFILE_DEFINITIONS[snapshot.behavior.profileId]
  const activeLabel = freeMode ? 'Free' : activeProfile.name
  /*
   * The second line says what the character is doing, which in free movement is
   * whatever the player is doing: the intent reads "Free movement" under a
   * heading that already says "Free", so the button spent both its lines on one
   * word. How to steer is the thing worth knowing there instead.
   */
  const intentLabel = freeMode
    ? touchOnly
      ? 'Drag to steer'
      : 'WASD to steer'
    : (snapshot.behavior.activeIntent?.label ?? 'No active intent')
  const activePriority = TARGET_PRIORITY_DEFINITIONS[snapshot.behavior.targetPriorityId]
  /*
   * The priority joins the first line only once it has been changed. A player
   * who never touches it keeps the button they already know, and the one who
   * did can see what they chose without the button growing a third line the
   * top bar has no room for.
   */
  const defaultPriority = activePriority.id === DEFAULT_TARGET_PRIORITY_ID
  const toggleName = defaultPriority
    ? activeLabel
    : `${activeLabel} · ${activePriority.shortLabel}`

  return (
    /*
     * The open state is published to the DOM as well as held in React: the
     * run's own Escape handler reads it to decide whether Escape is closing
     * this menu or pausing the run, and it runs before this component's
     * listener does.
     */
    <div
      className="hud-behavior"
      ref={rootRef}
      data-hud-popover={open ? 'open' : undefined}
    >
      {open ? (
        <div className="hud-behavior-menu" role="menu" aria-label="Fighting style">
          <p className="hud-behavior-menu-heading" aria-hidden="true">How I move</p>
          <div role="group" aria-label="How I move">
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
          {/*
            * Still offered while it is active, whatever the device: a run that
            * arrives in free movement needs a way out of it, and a profile is
            * the way out either way.
            */}
          {touchOnly && !freeMode ? null : (
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
              {touchOnly ? null : <span className="keybind-hint">F</span>}
            </button>
          )}
          <p className="hud-behavior-hint">
            {freeMode
              ? touchOnly
                ? 'Drag the arena to steer. Automatic Dodge is off.'
                : 'Drag the arena or use WASD. Automatic Dodge is off.'
              : touchOnly
                ? 'The character plays itself. Drag the arena to take over.'
                : 'The character plays itself with this profile.'}
          </p>
          </div>
          {/*
            * Offered in free movement too. Steering the character yourself
            * does not stop it attacking, so the priority is still in force.
            */}
          <p className="hud-behavior-menu-heading" aria-hidden="true">Who I hit</p>
          <div role="group" aria-label="Who I hit">
            {TARGET_PRIORITY_ORDER.map((priorityId) => {
              const priority = TARGET_PRIORITY_DEFINITIONS[priorityId]
              const selected = snapshot.behavior.targetPriorityId === priority.id
              return (
                <button
                  className={`hud-behavior-option${selected ? ' selected' : ''}`}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  aria-label={`${priority.name}: ${priority.description}`}
                  key={priority.id}
                  onClick={() => {
                    onSelectTargetPriority(priority.id)
                    setOpen(false)
                  }}
                >
                  <span className="hud-behavior-option-name">{priority.shortLabel}</span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
      <button
        className={`hud-behavior-toggle${open ? ' open' : ''}`}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Fighting style: ${activeLabel}, targeting ${
          activePriority.name
        }. ${freeMode ? 'Steering' : 'Intent'}: ${intentLabel}. Change`}
        onClick={() => setOpen((current) => !current)}
      >
        <BehaviorIcon />
        <span className="hud-behavior-toggle-text">
          <span className="hud-behavior-toggle-name">{toggleName}</span>
          <span className="hud-behavior-toggle-intent">{intentLabel}</span>
        </span>
      </button>
    </div>
  )
}
