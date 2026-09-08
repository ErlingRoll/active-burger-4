// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { ErrorBoundary } from './ErrorBoundary'

function Boom({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Renderer exploded')
  }
  return <p>Rendered fine</p>
}

function Recoverable() {
  const [shouldThrow, setShouldThrow] = useState(true)
  return (
    <>
      <button type="button" onClick={() => setShouldThrow(false)}>
        Repair
      </button>
      <ErrorBoundary label="The dungeon run">
        <Boom shouldThrow={shouldThrow} />
      </ErrorBoundary>
    </>
  )
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders its children when nothing throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary label="The dungeon run">
        <Boom shouldThrow={false} />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Rendered fine')).toBeInTheDocument()
  })

  it('shows a labelled fallback with the error message instead of unmounting the page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary label="The dungeon run">
        <Boom shouldThrow />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'The dungeon run could not be displayed' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Renderer exploded')).toBeInTheDocument()
  })

  it('logs the failure so it survives into a bug report', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary label="The dungeon run">
        <Boom shouldThrow />
      </ErrorBoundary>,
    )

    expect(consoleError).toHaveBeenCalledWith(
      'Unhandled error in The dungeon run.',
      expect.any(Error),
      expect.anything(),
    )
  })

  it('re-mounts the subtree when the player retries after the cause is gone', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()
    render(<Recoverable />)

    expect(screen.getByRole('alert')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Repair' }))
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(screen.getByText('Rendered fine')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('uses a custom fallback when one is supplied', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary
        label="The dungeon run"
        fallback={(error) => <p>Custom: {error.message}</p>}
      >
        <Boom shouldThrow />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Custom: Renderer exploded')).toBeInTheDocument()
  })
})
