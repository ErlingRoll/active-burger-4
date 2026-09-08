// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useHudTooltips, type HudTooltips } from './useHudTooltips'
import { closeAllTooltips } from '../TooltipShell'
import { EquipmentSlot } from '../../content/gear/Items'

/**
 * The three HUD tooltips look independent but share a close timer and a single
 * "one open at a time" rule. These tests pin that coupling, which is the reason
 * the state lives in one hook rather than in each panel.
 */
function renderTooltips(): { current: HudTooltips } {
  const { result } = renderHook(() => useHudTooltips())
  return result
}

describe('useHudTooltips', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with every tooltip closed', () => {
    const tooltips = renderTooltips()

    expect(tooltips.current.skill.activeKey).toBeNull()
    expect(tooltips.current.loadout.activeKey).toBeNull()
    expect(tooltips.current.characterStat.activeKey).toBeNull()
  })

  it('closes a tooltip after the grace period, so the pointer can cross a gap', () => {
    const tooltips = renderTooltips()
    act(() => {
      tooltips.current.skill.setActiveKey('whirlwind')
    })
    expect(tooltips.current.skill.activeKey).toBe('whirlwind')

    act(() => {
      tooltips.current.scheduleClose(() => tooltips.current.skill.setActiveKey(null))
    })
    expect(tooltips.current.skill.activeKey).toBe('whirlwind')

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(tooltips.current.skill.activeKey).toBeNull()
  })

  it('cancels a pending close when the pointer returns', () => {
    const tooltips = renderTooltips()
    act(() => {
      tooltips.current.skill.setActiveKey('whirlwind')
      tooltips.current.scheduleClose(() => tooltips.current.skill.setActiveKey(null))
    })

    act(() => {
      tooltips.current.cancelClose()
      vi.advanceTimersByTime(500)
    })

    expect(tooltips.current.skill.activeKey).toBe('whirlwind')
  })

  it('lets a second tooltip cancel the first tooltip pending close', () => {
    const tooltips = renderTooltips()
    act(() => {
      tooltips.current.skill.setActiveKey('whirlwind')
      tooltips.current.scheduleClose(() => tooltips.current.skill.setActiveKey(null))
      // Moving onto the loadout schedules its own close, replacing the first
      // timer rather than racing it.
      tooltips.current.loadout.setActiveKey(EquipmentSlot.Weapon)
      tooltips.current.cancelClose()
    })

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(tooltips.current.skill.activeKey).toBe('whirlwind')
    expect(tooltips.current.loadout.activeKey).toBe(EquipmentSlot.Weapon)
  })

  it('closes every tooltip when the shared closer fires, and reports it handled', () => {
    const tooltips = renderTooltips()
    act(() => {
      tooltips.current.skill.setActiveKey('whirlwind')
      tooltips.current.loadout.setActiveKey(EquipmentSlot.Weapon)
      tooltips.current.characterStat.setActiveKey('resonance')
    })

    let handled = false
    act(() => {
      handled = closeAllTooltips()
    })

    expect(handled).toBe(true)
    expect(tooltips.current.skill.activeKey).toBeNull()
    expect(tooltips.current.loadout.activeKey).toBeNull()
    expect(tooltips.current.characterStat.activeKey).toBeNull()
  })

  it('reports the closer unhandled when nothing is open, so Escape can fall through', () => {
    renderTooltips()

    let handled = true
    act(() => {
      handled = closeAllTooltips()
    })

    expect(handled).toBe(false)
  })
})
