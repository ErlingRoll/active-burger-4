import { useEffect, useId, useState, type FormEvent } from 'react'
import { validateNickname } from './NicknameService'
import { AudioSettingsPanel } from '../audio'

interface AccountSettingsMenuProps {
  displayName: string | null
  pendingNickname: string | null
  onRequestNicknameChange: (nickname: string) => Promise<void>
}

export function AccountSettingsMenu({
  displayName,
  pendingNickname,
  onRequestNicknameChange,
}: AccountSettingsMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [nickname, setNickname] = useState(displayName ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!dialogOpen) {
      setNickname(pendingNickname ?? displayName ?? '')
      setError(null)
    }
  }, [dialogOpen, displayName, pendingNickname])

  const openNicknameDialog = (): void => {
    setMenuOpen(false)
    setDialogOpen(true)
  }

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const validationError = validateNickname(nickname)
    if (validationError) {
      setError(validationError)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onRequestNicknameChange(nickname.trim())
      setDialogOpen(false)
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to submit nickname change.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="account-settings">
        <button
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label="Account settings"
          className="account-settings-toggle"
          type="button"
          onClick={() => { setMenuOpen((open) => !open) }}
        >
          <SettingsIcon />
        </button>
        {menuOpen ? (
          <div className="account-settings-menu" role="menu">
            <AudioSettingsPanel />
            <button role="menuitem" type="button" onClick={openNicknameDialog}>
              Change nickname
            </button>
          </div>
        ) : null}
      </div>
      {dialogOpen ? (
        <div className="nickname-dialog-backdrop" role="presentation">
          <section
            aria-describedby={descriptionId}
            aria-labelledby={titleId}
            aria-modal="true"
            className="nickname-dialog"
            role="dialog"
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !submitting) {
                setDialogOpen(false)
              }
            }}
          >
            <h2 id={titleId}>Change nickname</h2>
            <p id={descriptionId}>
              Nicknames are reviewed before appearing publicly, so offensive or hateful names cannot be published.
            </p>
            {pendingNickname ? <p className="nickname-pending">Pending review: {pendingNickname}</p> : null}
            <form onSubmit={(event) => { void submit(event) }}>
              <label htmlFor={`${titleId}-input`}>
                New nickname
              </label>
              <input
                autoComplete="off"
                id={`${titleId}-input`}
                maxLength={24}
                minLength={3}
                required
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
              />
              {error ? <p className="nickname-error" role="alert">{error}</p> : null}
              <div className="nickname-dialog-actions">
                <button disabled={submitting} type="button" onClick={() => setDialogOpen(false)}>
                  Cancel
                </button>
                <button disabled={submitting} type="submit">
                  {submitting ? 'Submitting...' : 'Submit for review'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  )
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M19.14 12.94a7.43 7.43 0 0 0 .05-.94 7.43 7.43 0 0 0-.05-.94l2.03-1.58-1.92-3.32-2.39.96a7.1 7.1 0 0 0-1.63-.94l-.36-2.54h-3.84l-.36 2.54a7.1 7.1 0 0 0-1.63.94l-2.39-.96-1.92 3.32 2.03 1.58A7.43 7.43 0 0 0 4.81 12c0 .32.02.63.05.94l-2.03 1.58 1.92 3.32 2.39-.96c.5.39 1.05.71 1.63.94l.36 2.54h3.84l.36-2.54c.58-.23 1.13-.55 1.63-.94l2.39.96 1.92-3.32-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z" />
    </svg>
  )
}
