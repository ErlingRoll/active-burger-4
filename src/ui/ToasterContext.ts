import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'

export type ToastKind = 'error' | 'info'

export interface LootToastOptions {
  title: string
  itemName: string
  icon: ReactNode
  accentColor?: string
  glowColor?: string
  effect?: string
  reward?: string
  details?: readonly string[]
}

export interface ToasterContextValue {
  /** Show transient text feedback in the shared top-right toast. */
  showToast: (message: string, kind?: ToastKind) => void
  /** Show structured reward feedback in the shared top-right loot toast. */
  showLootToast: (options: LootToastOptions) => void
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
