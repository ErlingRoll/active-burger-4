import type { Graphics } from 'pixi.js'
import type { EnemyRenderShape } from '../../content/enemies/EnemyTypes'

/**
 * Enemy silhouettes.
 *
 * The graphics guidelines ask for strong silhouettes before fine detail, and
 * for distinct shape language between distinct things. The skills were built
 * that way; the enemies were not. Six enemy types shared four primitives —
 * circle, diamond, triangle, hexagon — so a Runner and a Flanker were both an
 * orange triangle at different sizes, and the roster read as coloured dots.
 *
 * Each enemy now has a shape that says what it does: the Runner is a dart, the
 * Brute is an armoured slab, the Archer is a drawn bow, the Splitter is a
 * cluster already coming apart, the Flanker is a barbed hook. They are
 * drawn from the enemy's radius so an elite's scale multiplier still works, and
 * they are built from the same fill and outline the definitions already carry.
 *
 * The four primitives remain, because they are still the right answer for
 * anything that has no identity of its own yet.
 */

interface SilhouetteColors {
  fill: string
  outline: string
}

/**
 * Which silhouettes have a front, and how far to turn them.
 *
 * A shape with a nose looked wrong sliding sideways: a dart crossed the arena
 * broadside and a hook leaned the same way whichever direction it came from.
 * The flat, directional shapes are turned to face where they are going; the
 * radial ones are not, because a slime rolling and a splitter spinning like a
 * wheel are both worse than either standing still.
 *
 * Every directional shape is drawn nose-up, so the offset is a quarter turn:
 * a facing of zero points along positive x, and adding it swings the nose from
 * up to right.
 */
const SHAPE_FACING_OFFSETS = {
  dart: Math.PI / 2,
  hook: Math.PI / 2,
  bow: Math.PI / 2,
  bulwark: Math.PI / 2,
  triangle: Math.PI / 2,
  slime: null,
  cluster: null,
  diamond: null,
  hexagon: null,
  circle: null,
} as const satisfies Record<EnemyRenderShape, number | null>

/**
 * The rotation to add to a facing angle for this shape, or null when the shape
 * has no front and should not be turned at all.
 */
export function getEnemyShapeFacingOffset(shape: EnemyRenderShape): number | null {
  return SHAPE_FACING_OFFSETS[shape] ?? null
}

function regularPolygon(radius: number, sides: number, spin: number): number[] {
  return Array.from({ length: sides }, (_, index) => {
    const angle = spin + (Math.PI * 2 * index) / sides
    return [Math.cos(angle) * radius, Math.sin(angle) * radius]
  }).flat()
}

/**
 * Draws `shape` into `body` at `radius`, fill and outline included.
 *
 * The interior detail is drawn after the outline so a shape reads as one
 * object with markings rather than as several stacked ones.
 */
export function drawEnemySilhouette(
  body: Graphics,
  shape: EnemyRenderShape,
  radius: number,
  colors: SilhouetteColors,
): void {
  const outline = { color: colors.outline, width: 2 } as const

  switch (shape) {
    case 'slime': {
      // A settled drop: heavy and wide at the base, domed on top, with the
      // surface tension showing as a highlight rather than as a rim.
      body
        .moveTo(-radius, radius * 0.62)
        .bezierCurveTo(-radius * 1.05, -radius * 0.5, -radius * 0.5, -radius, 0, -radius)
        .bezierCurveTo(radius * 0.5, -radius, radius * 1.05, -radius * 0.5, radius, radius * 0.62)
        .bezierCurveTo(radius * 0.6, radius, -radius * 0.6, radius, -radius, radius * 0.62)
        .closePath()
        .fill(colors.fill)
        .stroke(outline)
        .ellipse(-radius * 0.3, -radius * 0.34, radius * 0.26, radius * 0.18)
        .fill({ color: colors.outline, alpha: 0.55 })
      return
    }
    case 'dart': {
      // A runner: a narrow head with the fins swept back behind it.
      body
        .poly([
          0, -radius,
          radius * 0.62, radius * 0.42,
          0, radius * 0.08,
          -radius * 0.62, radius * 0.42,
        ])
        .fill(colors.fill)
        .stroke(outline)
        .poly([0, -radius * 0.42, radius * 0.2, radius * 0.1, -radius * 0.2, radius * 0.1])
        .fill({ color: colors.outline, alpha: 0.45 })
      return
    }
    case 'bulwark': {
      // A brute: a wide plate with shoulders and a stud at the centre of it.
      body
        .poly([
          -radius * 0.55, -radius * 0.85,
          radius * 0.55, -radius * 0.85,
          radius, -radius * 0.1,
          radius * 0.62, radius * 0.9,
          -radius * 0.62, radius * 0.9,
          -radius, -radius * 0.1,
        ])
        .fill(colors.fill)
        .stroke(outline)
        .moveTo(-radius * 0.62, -radius * 0.12)
        .lineTo(radius * 0.62, -radius * 0.12)
        .stroke({ color: colors.outline, width: 2, alpha: 0.6 })
        .circle(0, radius * 0.28, radius * 0.22)
        .fill({ color: colors.outline, alpha: 0.55 })
      return
    }
    case 'bow': {
      // An archer: the stave, the string, and the arrow already on it.
      body
        .poly([
          0, -radius,
          radius * 0.78, -radius * 0.34,
          radius * 0.5, radius * 0.86,
          -radius * 0.5, radius * 0.86,
          -radius * 0.78, -radius * 0.34,
        ])
        .fill(colors.fill)
        .stroke(outline)
        .moveTo(-radius * 0.66, -radius * 0.28)
        .bezierCurveTo(0, radius * 0.5, 0, radius * 0.5, radius * 0.66, -radius * 0.28)
        .stroke({ color: colors.outline, width: 2, alpha: 0.75 })
        .moveTo(0, -radius * 0.72)
        .lineTo(0, radius * 0.24)
        .stroke({ color: colors.outline, width: 2, alpha: 0.75 })
      return
    }
    case 'cluster': {
      // A splitter: three lobes with the seams between them already showing.
      for (let index = 0; index < 3; index += 1) {
        const angle = -Math.PI / 2 + (Math.PI * 2 * index) / 3
        body
          .circle(Math.cos(angle) * radius * 0.42, Math.sin(angle) * radius * 0.42, radius * 0.58)
          .fill(colors.fill)
      }
      for (let index = 0; index < 3; index += 1) {
        const angle = -Math.PI / 2 + (Math.PI * 2 * index) / 3
        body
          .circle(Math.cos(angle) * radius * 0.42, Math.sin(angle) * radius * 0.42, radius * 0.58)
          .stroke({ ...outline, alpha: 0.85 })
      }
      return
    }
    case 'hook': {
      /*
       * A flanker: a barbed hook, point leading with two barbs swept back
       * and hollowed at the rear. It used to lean permanently to one side to
       * fake a sense of coming from an angle, back when nothing rotated —
       * that bakes in a heading of its own, so a real rotation on top of it
       * only ever cancelled out or compounded, and it read as sideways
       * whichever way it actually moved. Symmetric about the nose instead,
       * the same way the dart is, so turning it is what shows its heading.
       */
      body
        .moveTo(0, -radius)
        .bezierCurveTo(radius * 0.75, -radius * 0.45, radius * 0.62, radius * 0.35, radius * 0.22, radius * 0.78)
        .quadraticCurveTo(0, radius * 0.42, -radius * 0.22, radius * 0.78)
        .bezierCurveTo(-radius * 0.62, radius * 0.35, -radius * 0.75, -radius * 0.45, 0, -radius)
        .closePath()
        .fill(colors.fill)
        .stroke(outline)
        .moveTo(0, -radius * 0.6)
        .lineTo(0, radius * 0.35)
        .stroke({ color: colors.outline, width: 1.5, alpha: 0.5 })
      return
    }
    case 'diamond': {
      body.poly([0, -radius, radius, 0, 0, radius, -radius, 0]).fill(colors.fill).stroke(outline)
      return
    }
    case 'triangle': {
      body.poly([0, -radius, radius, radius, -radius, radius]).fill(colors.fill).stroke(outline)
      return
    }
    case 'hexagon': {
      body.poly(regularPolygon(radius, 6, -Math.PI / 2)).fill(colors.fill).stroke(outline)
      return
    }
    default: {
      body.circle(0, 0, radius).fill(colors.fill).stroke(outline)
    }
  }
}
