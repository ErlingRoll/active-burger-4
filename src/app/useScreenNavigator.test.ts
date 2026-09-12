// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppScreen } from './routing'
import {
  useScreenNavigator,
  type ScreenNavigatorOptions,
  type ScreenRequest,
} from './useScreenNavigator'

/**
 * A loader the test resolves by hand, one promise per request, so each
 * timing rule can be proven without a clock or a network.
 */
function manualPrepare() {
  const pending: { request: ScreenRequest; resolve: (data: string | null) => void; reject: (error: Error) => void }[] = []
  const prepare = vi.fn((request: ScreenRequest) => new Promise<string | null>((resolve, reject) => {
    pending.push({ request, resolve, reject })
  }))
  return { prepare, pending }
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

function renderNavigator(overrides: Partial<ScreenNavigatorOptions<string>> = {}) {
  const { prepare, pending } = manualPrepare()
  const writeHistory = vi.fn()
  const result = renderHook(() => useScreenNavigator<string>({
    initialScreen: 'dashboard',
    prepare,
    writeHistory,
    ...overrides,
  }))
  return { ...result, prepare, pending, writeHistory }
}

describe('useScreenNavigator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('holds the committed screen while the destination loads, then commits with its data', async () => {
    const { result, pending } = renderNavigator()

    act(() => { result.current.navigate({ screen: 'shop' }) })

    expect(result.current.screen).toBe('dashboard')
    expect(result.current.pending).toBe('shop')

    pending[0]?.resolve('shop data')
    await flush()

    expect(result.current.screen).toBe('shop')
    expect(result.current.data).toBe('shop data')
    expect(result.current.loadError).toBeNull()
    expect(result.current.pending).toBeNull()
  })

  it('lets the latest request win over one still in flight', async () => {
    const { result, pending } = renderNavigator()

    act(() => { result.current.navigate({ screen: 'shop' }) })
    act(() => { result.current.navigate({ screen: 'fishing' }) })
    expect(result.current.pending).toBe('fishing')

    pending[0]?.resolve('shop data')
    await flush()
    expect(result.current.screen).toBe('dashboard')
    expect(result.current.pending).toBe('fishing')

    pending[1]?.resolve('pond data')
    await flush()
    expect(result.current.screen).toBe('fishing')
    expect(result.current.data).toBe('pond data')
  })

  it('ignores the same destination asked for twice while it is pending', () => {
    const { result, prepare } = renderNavigator()

    act(() => { result.current.navigate({ screen: 'shop' }) })
    act(() => { result.current.navigate({ screen: 'shop' }) })

    expect(prepare).toHaveBeenCalledTimes(1)
  })

  it('commits anyway once the timeout passes, without data', async () => {
    const { result } = renderNavigator({ timeoutMs: 500 })

    act(() => { result.current.navigate({ screen: 'shop' }) })
    await act(async () => { await vi.advanceTimersByTimeAsync(499) })
    expect(result.current.screen).toBe('dashboard')

    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(result.current.screen).toBe('shop')
    expect(result.current.data).toBeNull()
    expect(result.current.loadError).toBeNull()
  })

  it('commits with the error attached when the loader rejects', async () => {
    const { result, pending } = renderNavigator()

    act(() => { result.current.navigate({ screen: 'shop' }) })
    pending[0]?.reject(new Error('The shop is closed.'))
    await flush()

    expect(result.current.screen).toBe('shop')
    expect(result.current.data).toBeNull()
    expect(result.current.loadError).toBe('The shop is closed.')
  })

  it('writes history at commit and not before', async () => {
    const { result, pending, writeHistory } = renderNavigator()

    act(() => { result.current.navigate({ screen: 'shop' }) })
    expect(writeHistory).not.toHaveBeenCalled()

    pending[0]?.resolve(null)
    await flush()
    expect(writeHistory).toHaveBeenCalledWith('/shop', 'push')
  })

  it('replaces the entry when asked, and writes nothing for a popstate', async () => {
    const { result, pending, writeHistory } = renderNavigator()

    act(() => { result.current.navigate({ screen: 'shop', history: 'replace' }) })
    pending[0]?.resolve(null)
    await flush()
    expect(writeHistory).toHaveBeenLastCalledWith('/shop', 'replace')

    act(() => { result.current.navigate({ screen: 'fishing', history: 'none' }) })
    pending[1]?.resolve(null)
    await flush()
    expect(result.current.screen).toBe('fishing')
    expect(writeHistory).toHaveBeenCalledTimes(1)
  })

  it('carries a custom path to the address bar', async () => {
    const { result, pending, writeHistory } = renderNavigator()

    act(() => { result.current.navigate({ screen: 'run-setup', path: '/prepare/abyss' }) })
    pending[0]?.resolve(null)
    await flush()

    expect(writeHistory).toHaveBeenCalledWith('/prepare/abyss', 'push')
  })

  it('treats a request for the current screen as an address-bar sync only', () => {
    const { result, prepare, writeHistory } = renderNavigator()

    act(() => { result.current.navigate({ screen: 'dashboard', history: 'replace' }) })

    expect(prepare).not.toHaveBeenCalled()
    expect(result.current.pending).toBeNull()
    expect(writeHistory).toHaveBeenCalledWith('/', 'replace')
  })

  it('routes the swap through the commit callback with the request', async () => {
    const commits: AppScreen[] = []
    const commit = vi.fn((request: ScreenRequest, apply: () => void) => {
      commits.push(request.screen)
      apply()
    })
    const { result, pending } = renderNavigator({ commit })

    act(() => { result.current.navigate({ screen: 'shop' }) })
    pending[0]?.resolve('shop data')
    await flush()

    expect(commits).toEqual(['shop'])
    expect(result.current.screen).toBe('shop')
  })
})
