import { describe, expect, it } from 'vitest'
import type { Graphics } from 'pixi.js'
import { ENEMY_DEFINITIONS } from '../../game-config/enemies'
import { drawEnemySilhouette, getEnemyShapeFacingOffset } from './enemySilhouettes'
import type { EnemyRenderShape } from '../../content/enemies/EnemyTypes'

/**
 * The roster is meant to be told apart by shape before colour, so what is
 * asserted here is difference: two enemies must not draw the same outline, and
 * every authored shape must draw something more than the fallback circle.
 */

const AUTHORED_SHAPES: readonly EnemyRenderShape[] = [
  'slime', 'dart', 'bulwark', 'bow', 'cluster', 'hook',
]

function outlineOf(shape: EnemyRenderShape): string {
  const calls: string[] = []
  const proxy: Graphics = new Proxy({} as Record<string, unknown>, {
    get(_target, property) {
      if (typeof property !== 'string') {
        return undefined
      }
      return (...args: unknown[]) => {
        calls.push(`${property}(${args.map((arg) => JSON.stringify(arg)).join(',')})`)
        return proxy
      }
    },
  }) as unknown as Graphics
  drawEnemySilhouette(proxy, shape, 20, { fill: '#ff0000', outline: '#ffffff' })
  return calls.join('\n')
}

describe('enemy silhouettes', () => {
  it('draws every authored shape differently', () => {
    const drawn = AUTHORED_SHAPES.map(outlineOf)

    expect(new Set(drawn).size).toBe(AUTHORED_SHAPES.length)
  })

  it('gives every authored shape more than a single primitive', () => {
    // The rule the roster broke was "strong silhouettes before fine detail":
    // one circle call and nothing else is what a placeholder looks like.
    for (const shape of AUTHORED_SHAPES) {
      const calls = outlineOf(shape).split('\n')

      expect(calls.length, shape).toBeGreaterThan(2)
    }
  })

  it('still draws the primitives, which are the fallback for new content', () => {
    for (const shape of ['circle', 'diamond', 'triangle', 'hexagon'] as const) {
      expect(outlineOf(shape).length, shape).toBeGreaterThan(0)
    }
  })

  it('gives each enemy in the roster a silhouette of its own', () => {
    const shapes = Object.values(ENEMY_DEFINITIONS).map((enemy) => enemy.render.shape)

    expect(shapes.length).toBeGreaterThan(0)
    expect(new Set(shapes).size).toBe(shapes.length)
  })
})

describe('which silhouettes turn', () => {
  it('turns the shapes that have a nose and leaves the radial ones alone', () => {
    for (const shape of ['dart', 'hook', 'bow', 'bulwark', 'triangle'] as const) {
      expect(getEnemyShapeFacingOffset(shape), shape).toBe(Math.PI / 2)
    }
    for (const shape of ['slime', 'cluster', 'diamond', 'hexagon', 'circle'] as const) {
      expect(getEnemyShapeFacingOffset(shape), shape).toBeNull()
    }
  })

  it('offsets a nose-up shape onto the facing angle', () => {
    /*
     * A facing of zero points along positive x, and every directional shape is
     * drawn pointing up, so the offset has to be the quarter turn that takes
     * the nose from up to right. Getting the sign wrong is invisible in a test
     * that only checks the number is a quarter turn.
     */
    const offset = getEnemyShapeFacingOffset('dart')
    expect(offset).not.toBeNull()
    const nose = { x: 0, y: -1 }
    const angle = (offset ?? 0) + 0
    const turned = {
      x: nose.x * Math.cos(angle) - nose.y * Math.sin(angle),
      y: nose.x * Math.sin(angle) + nose.y * Math.cos(angle),
    }
    expect(turned.x).toBeCloseTo(1)
    expect(turned.y).toBeCloseTo(0)
  })

  it('covers every shape the roster uses', () => {
    for (const definition of Object.values(ENEMY_DEFINITIONS)) {
      expect(
        getEnemyShapeFacingOffset(definition.render.shape),
        definition.id,
      ).not.toBeUndefined()
    }
  })
})

interface RecordedPoint {
  x: number
  y: number
}

/**
 * The anchor and control points of a shape's main body, before its first
 * fill — the interior markings drawn afterward are decoration, not the
 * silhouette a rotation has to read correctly.
 */
function bodyOutlinePoints(shape: EnemyRenderShape, radius: number): RecordedPoint[] {
  const points: RecordedPoint[] = []
  let sawFill = false
  const record = (values: number[]): void => {
    if (sawFill) {
      return
    }
    for (let index = 0; index + 1 < values.length; index += 2) {
      points.push({ x: values[index] as number, y: values[index + 1] as number })
    }
  }
  const proxy: Graphics = new Proxy({} as Record<string, unknown>, {
    get(_target, property) {
      if (typeof property !== 'string') {
        return undefined
      }
      return (...args: unknown[]) => {
        if (property === 'fill') {
          sawFill = true
        } else if (property === 'poly' && Array.isArray(args[0])) {
          record(args[0] as number[])
        } else {
          record(args.filter((arg): arg is number => typeof arg === 'number'))
        }
        return proxy
      }
    },
  }) as unknown as Graphics
  drawEnemySilhouette(proxy, shape, radius, { fill: '#ff0000', outline: '#ffffff' })
  return points
}

describe('rotatable silhouettes are built to rotate', () => {
  it('mirrors every point of a directional body across its own nose, or a turn never reads correctly', () => {
    /*
     * A shape that turns has to be drawn pointing straight up and mirrored
     * left to right about that line — the same as an arrowhead. The flanker's
     * hook used to lean permanently to one side instead, a trick to fake a
     * sense of angle from back when nothing rotated. Once it did rotate, that
     * baked-in lean fought the real one and it read as sideways no matter
     * which way it actually moved. This is the check that would have caught
     * it before it shipped.
     */
    for (const shape of ['dart', 'hook', 'bow', 'bulwark', 'triangle'] as const) {
      const points = bodyOutlinePoints(shape, 20)
      expect(points.length, shape).toBeGreaterThan(2)

      const remaining = [...points]
      for (const point of points) {
        const mirrorIndex = remaining.findIndex((candidate) =>
          Math.abs(candidate.x + point.x) < 0.001 &&
          Math.abs(candidate.y - point.y) < 0.001,
        )
        expect(
          mirrorIndex,
          `${shape} has no mirror for (${point.x}, ${point.y})`,
        ).toBeGreaterThanOrEqual(0)
        remaining.splice(mirrorIndex, 1)
      }
    }
  })
})
