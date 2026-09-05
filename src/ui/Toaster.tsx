import {
  useCallback,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import {
  ToasterContext,
  type LootToastOptions,
  type ToastKind,
} from './ToasterContext'

interface ToastBase {
  id: number
  kind: ToastKind
}

interface TextToast extends ToastBase {
  variant: 'text'
  message: string
}

interface LootToast extends ToastBase {
  variant: 'loot'
  loot: LootToastOptions
}

type Toast = TextToast | LootToast

interface ToastStyle extends CSSProperties {
  '--toast-accent'?: string
  '--toast-glow'?: string
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
    setToasts((current) => [...current, { id, kind, variant: 'text', message }])
    window.setTimeout(() => {
      dismissToast(id)
    }, 6000)
  }, [dismissToast])

  const showLootToast = useCallback((loot: LootToastOptions): void => {
    const id = nextToastId
    nextToastId += 1
    setToasts((current) => [...current, { id, kind: 'info', variant: 'loot', loot }])
    window.setTimeout(() => {
      dismissToast(id)
    }, 6000)
  }, [dismissToast])

  return (
    <ToasterContext.Provider value={{ showToast, showLootToast }}>
      {children}
      <div className="global-toaster" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div
            className={`global-toast global-toast-${toast.kind} global-toast-${toast.variant}`}
            key={toast.id}
            role="alert"
            style={toast.variant === 'loot'
              ? {
                  '--toast-accent': toast.loot.accentColor,
                  '--toast-glow': toast.loot.glowColor,
                } as ToastStyle
              : undefined}
          >
            {toast.variant === 'loot' ? (
              <div className="global-loot-toast-content">
                <span className="global-loot-toast-icon" aria-hidden="true">
                  {toast.loot.icon}
                </span>
                <div className="global-loot-toast-copy">
                  <span className="global-toast-kicker">{toast.loot.title}</span>
                  <strong>{toast.loot.itemName}</strong>
                  {toast.loot.effect ? (
                    <span className="global-loot-toast-effect">{toast.loot.effect}</span>
                  ) : null}
                  {toast.loot.reward ? (
                    <span className="global-loot-toast-reward">{toast.loot.reward}</span>
                  ) : null}
                  {toast.loot.details?.map((detail) => (
                    <span className="global-loot-toast-detail" key={detail}>{detail}</span>
                  ))}
                </div>
              </div>
            ) : (
              <span className="global-toast-message">{toast.message}</span>
            )}
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
