import { useEffect, useId, useRef } from 'react'

export interface ConfirmationDialogProps {
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  errorMessage?: string | null
  confirmDisabled?: boolean
  cancelDisabled?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmationDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  errorMessage = null,
  confirmDisabled = false,
  cancelDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const id = useId()
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const titleId = `${id}-title`
  const messageId = `${id}-message`

  useEffect(() => {
    cancelButtonRef.current?.focus()
  }, [])

  return (
    <div
      className="confirmation-dialog-backdrop"
      data-confirmation-dialog="true"
      role="presentation"
    >
      <section
        className="confirmation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            onCancel()
          }
        }}
      >
        <h2 id={titleId}>{title}</h2>
        <p id={messageId}>{message}</p>
        {errorMessage ? <p className="persistence-error" role="alert">{errorMessage}</p> : null}
        <div className="confirmation-dialog-actions">
          <button
            ref={cancelButtonRef}
            className="confirmation-dialog-cancel"
            type="button"
            onClick={onCancel}
            disabled={cancelDisabled}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            className="confirmation-dialog-confirm"
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
