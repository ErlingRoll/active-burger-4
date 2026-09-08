// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { lazy } from 'react'
import { renderComponent, screen } from '../testing/render'
import { LazyScreen } from './LazyScreen'

describe('LazyScreen', () => {
  it('shows a loading state while the chunk is in flight, then the screen', async () => {
    let resolveChunk: (() => void) | undefined
    const chunk = new Promise<void>((resolve) => {
      resolveChunk = resolve
    })
    const Slow = lazy(async () => {
      await chunk
      return { default: () => <p>Loaded screen</p> }
    })

    renderComponent(
      <LazyScreen label="The wiki">
        <Slow />
      </LazyScreen>,
    )

    expect(screen.getByText('The wiki is loading…')).toBeInTheDocument()

    resolveChunk?.()

    expect(await screen.findByText('Loaded screen')).toBeInTheDocument()
  })

  it('reports a chunk that fails to load instead of blanking the page', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const Broken = lazy(() => Promise.reject(new Error('Failed to fetch chunk')))

    renderComponent(
      <LazyScreen label="The wiki">
        <Broken />
      </LazyScreen>,
    )

    expect(
      await screen.findByRole('heading', { name: 'The wiki could not be displayed' }),
    ).toBeInTheDocument()
    vi.restoreAllMocks()
  })
})
