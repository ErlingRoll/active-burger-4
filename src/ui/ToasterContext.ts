import { createContext, useContext } from 'react'

export type ToastKind = 'error' | 'info'

export interface ToasterContextValue {
  /** Show transient feedback in the shared top-right toast. Newlines are preserved. */
  showToast: (message: string, kind?: ToastKind) => void
}

export const ToasterContext = createContext<ToasterContextValue | null>(null)

/** Access the shared toast API from a component rendered below ToasterProvider. */
export function useToaster(): ToasterContextValue {
  const context = useContext(ToasterContext)
  if (context === null) {
    throw new Error('useToaster must be used within a ToasterProvider.')
  }
  return context
}
