import { describe, expect, it } from 'vitest'
import { placeFishingDropdownTooltip } from './FishingLoadoutTooltipPlacement'

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }
}

const viewport = { width: 1000, height: 800 }
const card = rect(0, 0, 200, 120)

describe('placeFishingDropdownTooltip', () => {
  it('sits to the right of an option when there is room', () => {
    expect(placeFishingDropdownTooltip(rect(100, 300, 180, 40), card, 'beside', viewport))
      .toEqual({ left: 290, top: 300 })
  })

  it('moves to the left of an option that sits against the right edge', () => {
    expect(placeFishingDropdownTooltip(rect(800, 300, 180, 40), card, 'beside', viewport))
      .toEqual({ left: 590, top: 300 })
  })

  it('falls back to above an option when neither side has room', () => {
    const phone = { width: 390, height: 844 }
    expect(placeFishingDropdownTooltip(rect(20, 500, 350, 40), card, 'beside', phone))
      .toEqual({ left: 95, top: 370 })
  })

  it('floats above a trigger, and below it only when the top is out of reach', () => {
    expect(placeFishingDropdownTooltip(rect(100, 600, 180, 40), card, 'above', viewport))
      .toEqual({ left: 90, top: 470 })
    expect(placeFishingDropdownTooltip(rect(100, 40, 180, 40), card, 'above', viewport))
      .toEqual({ left: 90, top: 90 })
  })

  it('keeps the card inside the viewport', () => {
    expect(placeFishingDropdownTooltip(rect(100, 760, 180, 40), card, 'beside', viewport))
      .toEqual({ left: 290, top: 668 })
  })
})
