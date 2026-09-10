import { describe, expect, it } from 'vitest'
import { updateEnemyFacing, ENEMY_TURN_RATE } from './entityGraphics'

/**
 * Facing is derived from where a body actually went, because the simulation
 * stores no heading for an enemy. These pin the parts of that derivation a
 * screenshot cannot show: what a body does before it has moved, that it holds
 * its heading while standing still, and that it turns the short way round.
 */

const NORTH = -Math.PI / 2
const EAST = 0
const WEST = Math.PI

function view(): { facing?: number; lastX?: number; lastY?: number } {
  return {}
}

describe('updateEnemyFacing', () => {
  it('faces the fallback until it has moved', () => {
    const enemy = view()

    expect(updateEnemyFacing(enemy, 100, 100, NORTH, 1)).toBeCloseTo(NORTH)
  })

  it('takes its heading from the step it just took', () => {
    const enemy = view()
    updateEnemyFacing(enemy, 100, 100, NORTH, Number.POSITIVE_INFINITY)

    const facing = updateEnemyFacing(enemy, 110, 100, NORTH, Number.POSITIVE_INFINITY)

    expect(facing).toBeCloseTo(EAST)
  })

  it('holds its heading while standing still', () => {
    const enemy = view()
    updateEnemyFacing(enemy, 100, 100, NORTH, Number.POSITIVE_INFINITY)
    updateEnemyFacing(enemy, 110, 100, NORTH, Number.POSITIVE_INFINITY)

    // A frame the simulation did not tick in, and then a hair of rounding.
    expect(updateEnemyFacing(enemy, 110, 100, NORTH, Number.POSITIVE_INFINITY))
      .toBeCloseTo(EAST)
    expect(updateEnemyFacing(enemy, 110.01, 100, NORTH, Number.POSITIVE_INFINITY))
      .toBeCloseTo(EAST)
  })

  it('turns no further than the frame allows', () => {
    const enemy = view()
    updateEnemyFacing(enemy, 100, 100, EAST, Number.POSITIVE_INFINITY)
    updateEnemyFacing(enemy, 110, 100, EAST, Number.POSITIVE_INFINITY)

    const facing = updateEnemyFacing(enemy, 110, 110, EAST, 0.2)

    // A quarter turn was asked for and a fifth of a radian was given.
    expect(facing).toBeCloseTo(EAST + 0.2)
  })

  it('turns the short way round rather than the long way back', () => {
    const enemy = view()
    enemy.facing = WEST - 0.1
    enemy.lastX = 100
    enemy.lastY = 100

    // Crossing due west: the heading wraps from +pi to -pi, and a naive
    // difference would spin the body most of the way round the compass.
    const facing = updateEnemyFacing(enemy, 90, 99, EAST, 0.05)

    expect(facing).toBeGreaterThan(WEST - 0.1)
    expect(facing).toBeCloseTo(WEST - 0.05)
  })

  it('snaps when the frame length is zero, as the first paint has none', () => {
    const enemy = view()
    updateEnemyFacing(enemy, 100, 100, NORTH, 0)
    updateEnemyFacing(enemy, 100, 90, NORTH, 0)

    expect(enemy.facing).toBeCloseTo(NORTH)
  })

  it('turns fast enough to keep up with a runner', () => {
    /*
     * A runner crosses the arena at 187 units a second. At sixty frames a
     * second the turn rate has to cover a right angle in a few frames, or the
     * body points behind its own path for the whole crossing.
     */
    const framesForAQuarterTurn = (Math.PI / 2) / (ENEMY_TURN_RATE / 60)

    expect(framesForAQuarterTurn).toBeLessThan(10)
  })
})
