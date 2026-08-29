import {
  useCallback,
  useState,
  type ReactNode,
} from 'react'
import {
  ToasterContext,
  type ToastKind,
} from './ToasterContext'

interface Toast {
  id: number
  kind: ToastKind
  message: string
}

let nextToastId = 0

export function ToasterProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismissToast = useCallback((id: number): void => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback((message: string, kind: ToastKind = 'info'): void => {
    const id = nextToastId
    nextToastId += 1
    setToasts((current) => [...current, { id, kind, message }])
    window.setTimeout(() => {
      dismissToast(id)
    }, 6000)
  }, [dismissToast])

  return (
    <ToasterContext.Provider value={{ showToast }}>
      {children}
      <div className="global-toaster" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div className={`global-toast global-toast-${toast.kind}`} key={toast.id} role="alert">
            <span>{toast.message}</span>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => { dismissToast(toast.id) }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToasterContext.Provider>
  )
}
