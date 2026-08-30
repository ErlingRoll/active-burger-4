import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  FREE_MOVEMENT_TOGGLE_KEY,
  FREE_MOVEMENT_KEYS,
  formatKeybind,
  KEYBIND_DEFINITIONS,
  normalizeKey,
  type GameKeybinds,
  type KeybindId,
} from '../input/Keybinds'

interface PauseMenuProps {
  keybinds: GameKeybinds
  onKeybindsChange: (keybinds: GameKeybinds) => Promise<void>
  onResume: () => void
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to save keybinds.'
}

export function PauseMenu({
  keybinds,
  onKeybindsChange,
  onResume,
}: PauseMenuProps) {
  const resumeButtonRef = useRef<HTMLButtonElement>(null)
  const [listeningFor, setListeningFor] = useState<KeybindId | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    resumeButtonRef.current?.focus()
  }, [])

  const startListening = (id: KeybindId): void => {
    setError(null)
    setListeningFor(id)
  }

  const handleKeyCapture = (
    id: KeybindId,
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ): void => {
    if (listeningFor !== id) {
      return
    }
    event.preventDefault()
    event.stopPropagation()

    if (event.key === 'Escape') {
      setListeningFor(null)
      setError(null)
      return
    }

    const key = normalizeKey(event.key)
    if (!key) {
      setError('That key cannot be bound. Press a named key or printable character.')
      return
    }

    if (key === FREE_MOVEMENT_TOGGLE_KEY) {
      setError(`${formatKeybind(key)} is reserved for the Free movement toggle.`)
      return
    }

    if (
      (id === 'choiceLeft' || id === 'choiceMiddle' || id === 'choiceRight') &&
      FREE_MOVEMENT_KEYS.some((movementKey) => movementKey === key)
    ) {
      setError(`${formatKeybind(key)} is reserved for Free movement.`)
      return
    }

    const conflict = KEYBIND_DEFINITIONS.find((definition) =>
      definition.id !== id && keybinds[definition.id] === key,
    )
    if (conflict) {
      setError(`${formatKeybind(key)} is already bound to ${conflict.label}.`)
      return
    }

    const nextKeybinds = { ...keybinds, [id]: key }
    setListeningFor(null)
    setError(null)
    void onKeybindsChange(nextKeybinds).catch((saveError: unknown) => {
      setError(getErrorMessage(saveError))
    })
  }

  return (
    <section
      className="pause-menu"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-menu-title"
    >
      <div className="pause-panel">
        <p className="screen-kicker">Run paused</p>
        <h2 id="pause-menu-title">Pause menu</h2>
        <p className="pause-instructions">
          Change a binding, then press the new key to use it immediately.
          Press Escape to cancel a rebind.
        </p>
        <button
          ref={resumeButtonRef}
          className="pause-resume-button"
          type="button"
          onClick={onResume}
        >
          Resume run <span className="keybind-hint">Esc</span>
        </button>
        <fieldset className="pause-keybinds">
          <legend>Keybinds</legend>
          <div className="pause-keybind-list">
            {KEYBIND_DEFINITIONS.map((definition) => {
              const listening = listeningFor === definition.id
              return (
                <div className="pause-keybind-row" key={definition.id}>
                  <span className="pause-keybind-copy">
                    <strong>{definition.label}</strong>
                    <small>{definition.description}</small>
                  </span>
                  <button
                    className={`pause-keybind-button${listening ? ' listening' : ''}`}
                    type="button"
                    data-keybind-capture="true"
                    data-keybind-listening={listening ? 'true' : undefined}
                    aria-label={`Rebind ${definition.label}, current key ${formatKeybind(keybinds[definition.id])}`}
                    onClick={() => startListening(definition.id)}
                    onKeyDown={(event) => handleKeyCapture(definition.id, event)}
                    onBlur={() => {
                      if (listeningFor === definition.id) {
                        setListeningFor(null)
                      }
                    }}
                  >
                    {listening ? 'Press key…' : formatKeybind(keybinds[definition.id])}
                  </button>
                </div>
              )
            })}
          </div>
          {error ? <p className="pause-keybind-error" role="alert">{error}</p> : null}
        </fieldset>
      </div>
    </section>
  )
}
