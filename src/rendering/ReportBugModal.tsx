import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react'
import type { BugReportDungeonContext, BugReportImage } from '../bug-report'

interface ReportBugModalProps {
  dungeon: BugReportDungeonContext
  onSubmit: (description: string, image?: BugReportImage) => Promise<void>
  onClose: () => void
}

function readImageFile(file: File): Promise<BugReportImage> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('Please choose an image file.'))
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Unable to read that image.'))
        return
      }
      resolve({
        dataUrl: reader.result,
        fileName: file.name || `clipboard-image.${file.type.split('/')[1] ?? 'png'}`,
        mediaType: file.type,
      })
    }
    reader.onerror = () => {
      reject(new Error('Unable to read that image.'))
    }
    reader.readAsDataURL(file)
  })
}

export function ReportBugModal({
  dungeon,
  onSubmit,
  onClose,
}: ReportBugModalProps) {
  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [description, setDescription] = useState('')
  const [image, setImage] = useState<BugReportImage | undefined>()
  const [imageError, setImageError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    descriptionRef.current?.focus()
  }, [])

  const selectImage = (file: File): void => {
    setImageError(null)
    void readImageFile(file)
      .then(setImage)
      .catch((error: unknown) => {
        setImage(undefined)
        setImageError(error instanceof Error ? error.message : 'Unable to read that image.')
      })
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    if (file) {
      selectImage(file)
    }
    event.target.value = ''
  }

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>): void => {
    const imageItem = Array.from(event.clipboardData.items)
      .find((item) => item.type.startsWith('image/'))
    const file = imageItem?.getAsFile()
    if (!file) {
      return
    }
    event.preventDefault()
    selectImage(file)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape' && !submitting) {
      event.preventDefault()
      onClose()
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (submitting || !description.trim()) {
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    void onSubmit(description, image)
      .catch((error: unknown) => {
        setSubmitError(error instanceof Error ? error.message : 'Unable to submit bug report.')
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  return (
    <div
      className="report-bug-backdrop"
      data-report-bug-dialog="true"
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
    >
      <section
        className="report-bug-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-bug-title"
      >
        <div className="report-bug-dialog-heading">
          <div>
            <p className="screen-kicker">Feedback</p>
            <h2 id="report-bug-title">Report bug</h2>
          </div>
          <button
            className="report-bug-close"
            type="button"
            aria-label="Close report bug dialog"
            onClick={onClose}
            disabled={submitting}
          >
            ×
          </button>
        </div>
        <p className="report-bug-instructions">
          Tell Erling what went wrong. You can paste an image directly with Ctrl + V.
        </p>
        <form onSubmit={handleSubmit}>
          <label className="report-bug-field">
            Description
            <textarea
              ref={descriptionRef}
              required
              rows={6}
              value={description}
              placeholder="What happened?"
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <div className="report-bug-field">
            <span>Picture <small>(optional)</small></span>
            <input
              ref={fileInputRef}
              className="report-bug-file-input"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
            />
            <button
              className="report-bug-upload"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
            >
              {image ? 'Replace picture' : 'Choose picture'}
            </button>
            {image ? (
              <div className="report-bug-preview">
                <img src={image.dataUrl} alt="Bug report attachment preview" />
                <div>
                  <span>{image.fileName}</span>
                  <button
                    className="report-bug-remove"
                    type="button"
                    onClick={() => { setImage(undefined) }}
                    disabled={submitting}
                  >
                    Remove picture
                  </button>
                </div>
              </div>
            ) : null}
            {imageError ? <small className="report-bug-error" role="alert">{imageError}</small> : null}
          </div>
          <p className="report-bug-context">
            Floor {dungeon.currentFloor} of {dungeon.maxFloor} · {dungeon.dungeonName}
          </p>
          {submitError ? <p className="report-bug-error" role="alert">{submitError}</p> : null}
          <div className="report-bug-actions">
            <button
              className="report-bug-cancel"
              type="button"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              className="report-bug-submit"
              type="submit"
              disabled={submitting || !description.trim()}
            >
              {submitting ? 'Submitting…' : 'Submit report'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
