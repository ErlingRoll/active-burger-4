import { createContext, useContext } from 'react'

export type ToastKind = 'error' | 'info'

export interface ToasterContextValue {
  showToast: (message: string, kind?: ToastKind) => void
}

export const ToasterContext = createContext<ToasterContextValue | null>(null)

export function useToaster(): ToasterContextValue {
  const context = useContext(ToasterContext)
  if (context === null) {
    throw new Error('useToaster must be used within a ToasterProvider.')
  }
  return context
}
