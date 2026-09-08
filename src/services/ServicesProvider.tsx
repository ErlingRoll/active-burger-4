import { useMemo, type ReactNode } from 'react'
import { createAppServices, type AppServices } from './AppServices'
import { ServicesContext } from './ServicesContext'

interface ServicesProviderProps {
  children: ReactNode
  /** Supplied by tests to substitute stubs for the real services. */
  services?: AppServices
}

export function ServicesProvider({ children, services }: ServicesProviderProps) {
  const value = useMemo(() => services ?? createAppServices(), [services])
  return <ServicesContext value={value}>{children}</ServicesContext>
}
