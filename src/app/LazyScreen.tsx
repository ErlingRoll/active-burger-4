import { Suspense, type ReactNode } from 'react'
import { ErrorBoundary } from '../ui/ErrorBoundary'

/** Shown while a screen's chunk is in flight. */
function ScreenFallback({ label }: { label: string }) {
  return (
    <section className="screen-loading" aria-busy="true" aria-live="polite">
      <div className="dashboard-panel">
        <p className="screen-kicker">Loading</p>
        <p>{label}</p>
      </div>
    </section>
  )
}

/**
 * Wraps a lazily loaded screen with its loading and failure states.
 *
 * The error boundary matters as much as the fallback: a chunk that fails to
 * fetch — an interrupted network, a stale hash after a deploy — otherwise
 * throws into an empty page with nothing to explain it.
 */
export function LazyScreen(
  { label, children }: { label: string; children: ReactNode },
) {
  return (
    <ErrorBoundary label={label}>
      <Suspense fallback={<ScreenFallback label={`${label} is loading…`} />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  )
}
