import { describe, expect, it } from 'vitest'
import {
  closeAllTooltips,
  registerTooltipCloser,
  TOOLTIP_SHELL_CLASS,
  TOOLTIP_VARIANT_CLASSES,
  tooltipClassName,
} from './TooltipShell'

describe('tooltip shell contract', () => {
  it('gives every tooltip variant the shared application shell class', () => {
    expect(TOOLTIP_VARIANT_CLASSES.length).toBeGreaterThan(0)
    expect(TOOLTIP_VARIANT_CLASSES.every((variant) =>
      tooltipClassName(variant).split(' ').includes(TOOLTIP_SHELL_CLASS)
    )).toBe(true)
  })

  it('closes every registered tooltip through one Escape coordinator', () => {
    let firstOpen = true
    let secondOpen = true
    const unregisterFirst = registerTooltipCloser(() => {
      if (!firstOpen) {
        return false
      }
      firstOpen = false
      return true
    })
    const unregisterSecond = registerTooltipCloser(() => {
      if (!secondOpen) {
        return false
      }
      secondOpen = false
      return true
    })

    expect(closeAllTooltips()).toBe(true)
    expect(firstOpen).toBe(false)
    expect(secondOpen).toBe(false)
    expect(closeAllTooltips()).toBe(false)

    unregisterFirst()
    unregisterSecond()
  })
})
