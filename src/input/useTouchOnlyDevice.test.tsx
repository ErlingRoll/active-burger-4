// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTouchOnlyDevice } from './useTouchOnlyDevice'

/**
 * The answer decides whether free movement is offered at all, so the two
 * mistakes worth guarding are opposite: calling a desktop touch-only, which
 * would take a mode away from someone who can use it, and calling a phone
 * pointer-capable, which would offer a mode that strands the character.
 */

interface FakeQuery {
  matches: boolean
  listeners: Set<() => void>
}

function installMatchMedia(initial: Record<string, boolean>): Map<string, FakeQuery> {
  const queries = new Map<string, FakeQuery>()
  for (const [query, matches] of Object.entries(initial)) {
    queries.set(query, { matches, listeners: new Set() })
  }
  vi.stubGlobal('matchMedia', (query: string) => {
    const entry = queries.get(query) ?? { matches: false, listeners: new Set() }
    queries.set(query, entry)
    return {
      get matches() { return entry.matches },
      media: query,
      addEventListener: (_type: string, listener: () => void) => { entry.listeners.add(listener) },
      removeEventListener: (_type: string, listener: () => void) => { entry.listeners.delete(listener) },
    }
  })
  return queries
}

afterEach(() => { vi.unstubAllGlobals() })

describe('useTouchOnlyDevice', () => {
  it('is true for a device whose only pointer is a finger', () => {
    installMatchMedia({ '(any-pointer: coarse)': true, '(any-pointer: fine)': false })

    const { result } = renderHook(() => useTouchOnlyDevice())

    expect(result.current).toBe(true)
  })

  it('is false for a desktop', () => {
    installMatchMedia({ '(any-pointer: coarse)': false, '(any-pointer: fine)': true })

    const { result } = renderHook(() => useTouchOnlyDevice())

    expect(result.current).toBe(false)
  })

  it('is false for a touchscreen laptop, which has a keyboard as well', () => {
    installMatchMedia({ '(any-pointer: coarse)': true, '(any-pointer: fine)': true })

    const { result } = renderHook(() => useTouchOnlyDevice())

    expect(result.current).toBe(false)
  })

  it('notices a pointer being paired while the page is open', () => {
    const queries = installMatchMedia({
      '(any-pointer: coarse)': true,
      '(any-pointer: fine)': false,
    })

    const { result } = renderHook(() => useTouchOnlyDevice())
    expect(result.current).toBe(true)

    act(() => {
      const fine = queries.get('(any-pointer: fine)')
      if (fine === undefined) {
        throw new Error('The fine-pointer query was never asked for.')
      }
      fine.matches = true
      for (const listener of fine.listeners) {
        listener()
      }
    })

    expect(result.current).toBe(false)
  })

  it('assumes a pointer where the browser will not say', () => {
    // Offering a mode that cannot be used is the worse of the two mistakes
    // only on a device that really has no keys; guessing "touch-only" from an
    // absent API would take free movement away from every such browser.
    vi.stubGlobal('matchMedia', undefined)

    const { result } = renderHook(() => useTouchOnlyDevice())

    expect(result.current).toBe(false)
  })
})
