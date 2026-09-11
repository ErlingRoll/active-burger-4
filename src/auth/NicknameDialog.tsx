import { useId, useState, type FormEvent } from 'react'
import { validateNickname } from './NicknameService'

export interface NicknameDialogProps {
  title: string
  description: string
  inputLabel: string
  /** The draft the input opens with; the dialog owns it from there. */
  initialValue: string
  pendingNickname: string | null
  cancelLabel: string
  submitLabel: string
  onCancel: () => void
  /** Resolves once the request is accepted; a rejection is shown as the error. */
  onSubmit: (nickname: string) => Promise<void>
}

/**
 * The one form through which a nickname is requested.
 *
 * Both the settings menu's "Change nickname" and the prompt a new account
 * meets right after signing in render this, so the validation, the pending
 * notice, and the moderation wording cannot drift between the two.
 */
export function NicknameDialog({
  title,
  description,
  inputLabel,
  initialValue,
  pendingNickname,
  cancelLabel,
  submitLabel,
  onCancel,
  onSubmit,
}: NicknameDialogProps) {
  const [nickname, setNickname] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const titleId = useId()
  const descriptionId = useId()

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
      await onSubmit(nickname.trim())
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to submit nickname change.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="nickname-dialog-backdrop" role="presentation">
      <section
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="nickname-dialog"
        role="dialog"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !submitting) {
            onCancel()
          }
        }}
      >
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
        {pendingNickname ? <p className="nickname-pending">Pending review: {pendingNickname}</p> : null}
        <form onSubmit={(event) => { void submit(event) }}>
          <label htmlFor={`${titleId}-input`}>
            {inputLabel}
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
            <button disabled={submitting} type="button" onClick={onCancel}>
              {cancelLabel}
            </button>
            <button disabled={submitting} type="submit">
              {submitting ? 'Submitting...' : submitLabel}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
