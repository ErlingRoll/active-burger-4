import { describe, expect, it } from 'vitest'
import type { Graphics } from 'pixi.js'
import { ENEMY_DEFINITIONS } from '../../game-config/enemies'
import { drawEnemySilhouette } from './enemySilhouettes'
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
