// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { useNow } from './useNow'

function Clock({ intervalMs }: { intervalMs?: number }) {
  const now = useNow(intervalMs)
  return <output>{now}</output>
}

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the same timestamp for every render between ticks', () => {
    vi.setSystemTime(new Date('2026-09-08T12:00:00.000Z'))
    const { getByRole, rerender } = render(<Clock />)
    const initial = getByRole('status').textContent

    vi.setSystemTime(new Date('2026-09-08T12:00:30.000Z'))
    rerender(<Clock />)

    expect(getByRole('status').textContent).toBe(initial)
  })

  it('advances once the interval elapses', () => {
    vi.setSystemTime(new Date('2026-09-08T12:00:00.000Z'))
    const { getByRole } = render(<Clock intervalMs={1_000} />)
    const initial = Number(getByRole('status').textContent)

    act(() => {
      vi.setSystemTime(new Date('2026-09-08T12:00:05.000Z'))
      vi.advanceTimersByTime(1_000)
    })

    expect(Number(getByRole('status').textContent)).toBeGreaterThan(initial)
  })

  it('clears its interval on unmount', () => {
    const clearInterval = vi.spyOn(window, 'clearInterval')
    const { unmount } = render(<Clock />)

    unmount()

    expect(clearInterval).toHaveBeenCalled()
  })
})
