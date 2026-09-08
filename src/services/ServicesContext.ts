import { createContext, useContext } from 'react'
import type { AppServices } from './AppServices'

/**
 * Provides the constructed services to the screen tree.
 *
 * Screens previously received each service and its configuration error as
 * separate props, which is how `GameDashboard` came to take twenty-one of
 * them. Reading from context instead keeps a screen's props about the screen.
 */
export const ServicesContext = createContext<AppServices | null>(null)

export function useServices(): AppServices {
  const services = useContext(ServicesContext)
  if (!services) {
    throw new Error('useServices must be used inside a ServicesProvider.')
  }
  return services
}
