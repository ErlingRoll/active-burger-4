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
import { ConfirmationDialog } from '../ui/ConfirmationDialog'
import { ReportBugModal } from './ReportBugModal'
import type { BugReportDungeonContext, BugReportImage } from '../bug-report'

interface PauseMenuProps {
  keybinds: GameKeybinds
  onKeybindsChange: (keybinds: GameKeybinds) => Promise<void>
  onResume: () => void
  onSaveAndQuit: () => Promise<void>
  onForfeit: () => void
  dungeon: BugReportDungeonContext
  onSubmitBugReport?: (description: string, image?: BugReportImage) => Promise<void>
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to save keybinds.'
}

export function PauseMenu({
  keybinds,
  onKeybindsChange,
  onResume,
  onSaveAndQuit,
  onForfeit,
  dungeon,
  onSubmitBugReport,
}: PauseMenuProps) {
  const resumeButtonRef = useRef<HTMLButtonElement>(null)
  const forfeitButtonRef = useRef<HTMLButtonElement>(null)
  const [listeningFor, setListeningFor] = useState<KeybindId | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const [reportBugOpen, setReportBugOpen] = useState(false)

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

  const openForfeitConfirmation = (): void => {
    if (saving) {
      return
    }
    setConfirmationOpen(true)
  }

  const cancelForfeit = (): void => {
    setConfirmationOpen(false)
    requestAnimationFrame(() => {
      forfeitButtonRef.current?.focus()
    })
  }

  const confirmForfeit = (): void => {
    onForfeit()
  }

  const handleSaveAndQuit = (): void => {
    if (saving) {
      return
    }
    setSaveError(null)
    setSaving(true)
    void onSaveAndQuit()
      .catch((saveFailure: unknown) => {
        setSaveError(getErrorMessage(saveFailure))
      })
      .finally(() => {
        setSaving(false)
      })
  }

  return (
    <section
      className="pause-menu"
      role="dialog"
      aria-modal="false"
      aria-labelledby="pause-menu-title"
    >
      <div className="pause-panel">
        <p className="screen-kicker">Run paused</p>
        <h2 id="pause-menu-title">Pause menu</h2>
        <p className="pause-instructions">
          Change a binding, then press the new key to use it immediately.
          Press Escape to cancel a rebind. Save &amp; quit resumes from the
          latest completed floor checkpoint, so choices and pickups acquired
          after that checkpoint will not be restored.
        </p>
        <button
          ref={resumeButtonRef}
          className="pause-resume-button"
          type="button"
          onClick={onResume}
          disabled={saving}
        >
          Resume run <span className="keybind-hint">Esc</span>
        </button>
        <button
          className="pause-save-button"
          type="button"
          onClick={handleSaveAndQuit}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save & quit'}
        </button>
        <button
          ref={forfeitButtonRef}
          className="pause-forfeit-button"
          type="button"
          onClick={openForfeitConfirmation}
          disabled={saving}
        >
          Forfeit
        </button>
        {onSubmitBugReport ? (
          <button
            className="pause-report-bug-button"
            type="button"
            onClick={() => { setReportBugOpen(true) }}
            disabled={saving}
          >
            Report a bug
          </button>
        ) : null}
        {saveError ? <p className="pause-save-error" role="alert">{saveError}</p> : null}
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
        {confirmationOpen ? (
          <ConfirmationDialog
            title="Forfeit run?"
            message="Are you sure you want to forfeit your current character and leave the dungeon?"
            confirmLabel="Forfeit"
            onConfirm={confirmForfeit}
            onCancel={cancelForfeit}
          />
        ) : null}
        {reportBugOpen && onSubmitBugReport ? (
          <ReportBugModal
            dungeon={dungeon}
            onClose={() => { setReportBugOpen(false) }}
            onSubmit={async (description, image) => {
              await onSubmitBugReport(description, image)
              setReportBugOpen(false)
            }}
          />
        ) : null}
      </div>
    </section>
  )
}
