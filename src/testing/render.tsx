import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement, ReactNode } from 'react'
import { ToasterProvider } from '../ui/Toaster'

/**
 * Renders a component inside the providers `main.tsx` mounts in production.
 *
 * Components reach for the shared toaster through context, so rendering one
 * bare throws or silently diverges from how it behaves in the app. Going
 * through this helper keeps component specs honest about that wiring.
 *
 * Requires a DOM: put `// @vitest-environment jsdom` at the top of the spec.
 */
export interface RenderComponentResult extends RenderResult {
  user: ReturnType<typeof userEvent.setup>
}

// Fast refresh never applies to a test-only helper module, so defining a
// component beside the exported helpers is harmless here.
// oxlint-disable-next-line react/only-export-components
function AppProviders({ children }: { children: ReactNode }) {
  return <ToasterProvider>{children}</ToasterProvider>
}

export function renderComponent(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
): RenderComponentResult {
  const user = userEvent.setup()
  return { user, ...render(ui, { wrapper: AppProviders, ...options }) }
}

export { screen, waitFor, within } from '@testing-library/react'
