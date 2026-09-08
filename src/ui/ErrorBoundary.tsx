import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  /** Human-readable name of the region being guarded, used in the message. */
  label: string
  children: ReactNode
  /** Rendered instead of the default panel when recovery needs custom copy. */
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Catches render-time errors so one broken region cannot blank the whole app.
 *
 * The application ships no telemetry by design, so an uncaught render error was
 * previously invisible: the page went white and nothing was recorded anywhere.
 * This boundary keeps the surrounding UI usable, shows the player what failed,
 * and offers a retry that re-mounts the subtree without a full page reload.
 * The error is also logged to the console so it is recoverable from a bug
 * report attachment or a shared devtools session.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`Unhandled error in ${this.props.label}.`, error, info.componentStack)
  }

  private readonly reset = (): void => {
    this.setState({ error: null })
  }

  override render(): ReactNode {
    const { error } = this.state
    if (!error) {
      return this.props.children
    }
    if (this.props.fallback) {
      return this.props.fallback(error, this.reset)
    }
    return (
      <section className="error-boundary" role="alert">
        <div className="dashboard-panel">
          <p className="screen-kicker">Something went wrong</p>
          <h2>{this.props.label} could not be displayed</h2>
          <p>
            The rest of the game is unaffected. Try again, and report the problem
            from the account menu if it keeps happening.
          </p>
          <p className="error-boundary-detail">{error.message}</p>
          <button type="button" onClick={this.reset}>
            Try again
          </button>
        </div>
      </section>
    )
  }
}
