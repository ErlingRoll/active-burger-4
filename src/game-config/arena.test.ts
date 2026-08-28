import { describe, expect, it } from 'vitest'
import {
  ARENA_BOUNDS,
  clampPlayerPosition,
  constrainPlayerMovementDirection,
  getPlayerArenaBounds,
  projectPointToPlayerArena,
} from './arena'

describe('arena geometry', () => {
  it('uses a 3000 by 3000 rectangle centered at the origin', () => {
    expect(ARENA_BOUNDS).toEqual({
      minX: -1_500,
      maxX: 1_500,
      minY: -1_500,
      maxY: 1_500,
    })
  })

  it('keeps the player radius inside the wall', () => {
    expect(clampPlayerPosition(2_000, -2_000, 16)).toEqual({
      x: 1_484,
      y: -1_484,
    })
  })

  it('projects external targets to the nearest legal player position', () => {
    expect(projectPointToPlayerArena(2_000, 2_000, 16)).toEqual({
      x: 1_484,
      y: 1_484,
    })
  })

  it('slides along a wall and turns inward at a blocked corner', () => {
    const bounds = getPlayerArenaBounds(16)
    expect(constrainPlayerMovementDirection(
      bounds.maxX,
      0,
      16,
      1,
      1,
    )).toEqual({
      directionX: 0,
      directionY: 1,
    })
    expect(constrainPlayerMovementDirection(
      bounds.maxX,
      bounds.maxY,
      16,
      1,
      1,
    )).toMatchObject({
      directionX: expect.closeTo(-Math.SQRT1_2),
      directionY: expect.closeTo(-Math.SQRT1_2),
    })
  })
})
