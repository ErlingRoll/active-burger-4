import { describe, expect, it } from 'vitest'
import type { Graphics } from 'pixi.js'
import {
  drawGround,
  drawGroundDressing,
  shadeForFloor,
  type GroundBounds,
} from './groundDressing'
import { DUNGEON_WORLD_THEME } from './worldTheme'

/**
 * The floor is drawn, not generated: the renderer is a projection of the
 * simulation and may not introduce values of its own. These record what the
 * drawing calls would be rather than rasterising anything, which is what lets
 * the determinism rule be asserted instead of trusted.
 */

interface Recording {
  calls: string[]
  view: Graphics
}

/**
 * A stand-in for `Graphics` that writes down every call instead of drawing it.
 * Each method returns the recorder so the chained call style still works.
 */
function recorder(): Recording {
  const calls: string[] = []
  const view: Record<string, unknown> = {}
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, property) {
      if (typeof property !== 'string') {
        return undefined
      }
      return (...args: unknown[]) => {
        calls.push(`${property}(${args.map((arg) => JSON.stringify(arg)).join(',')})`)
        return proxy
      }
    },
  }
  const proxy = new Proxy(view, handler)
  return { calls, view: proxy as unknown as Graphics }
}

const BOUNDS: GroundBounds = { minX: -800, maxX: 800, minY: -600, maxY: 600 }

function dressing(floor: number, bounds: GroundBounds = BOUNDS): string[] {
  const { calls, view } = recorder()
  drawGroundDressing(view, DUNGEON_WORLD_THEME, bounds, floor)
  return calls
}

describe('ground dressing', () => {
  it('draws the same floor identically every time', () => {
    expect(dressing(3)).toEqual(dressing(3))
  })

  it('draws a different room on a different floor', () => {
    expect(dressing(3)).not.toEqual(dressing(4))
  })

  it('places a decoration by its own coordinates, not by where the view starts', () => {
    // The camera pans, so the same patch of floor is drawn from many different
    // coverage rectangles. A decoration that moved with the rectangle would
    // slide across the ground as the player walked.
    const wide = dressing(5, { minX: -800, maxX: 800, minY: -600, maxY: 600 })
    const shifted = dressing(5, { minX: -400, maxX: 800, minY: -600, maxY: 600 })

    for (const call of shifted) {
      expect(wide).toContain(call)
    }
  })

  it('leaves some of the floor bare', () => {
    // Every cell decorated would be a texture rather than a room.
    const cells = dressing(7)

    expect(cells.length).toBeGreaterThan(0)
    expect(dressing(7, { minX: 0, maxX: 380, minY: 0, maxY: 380 }).length)
      .toBeLessThan(cells.length)
  })

  it('draws both grid weights so the floor has a scale', () => {
    const { calls, view } = recorder()

    drawGround(view, DUNGEON_WORLD_THEME, BOUNDS, 1)

    const widths = calls
      .filter((call) => call.startsWith('stroke('))
      .map((call) => JSON.parse(call.slice('stroke('.length, -1)) as { width: number })
      .map((stroke) => stroke.width)
    expect(new Set(widths)).toEqual(new Set([1, 2]))
  })
})

describe('floor shading', () => {
  it('leaves the first floor at its authored colour', () => {
    expect(shadeForFloor('#1d252d', 1)).toBe(0x1d_25_2d)
  })

  it('darkens as the run descends', () => {
    const first = shadeForFloor('#1d252d', 1)
    const deep = shadeForFloor('#1d252d', 25)

    expect(deep).toBeLessThan(first)
  })

  it('stops darkening past the deepest floor rather than going black', () => {
    expect(shadeForFloor('#1d252d', 60)).toBe(shadeForFloor('#1d252d', 31))
    expect(shadeForFloor('#1d252d', 60)).toBeGreaterThan(0)
  })
})
