import type { Graphics } from 'pixi.js'
import type { BossRenderShape } from '../../content/bosses/Bosses'

/**
 * Boss silhouettes.
 *
 * Every boss was the same purple circle with a yellow crown, scaled by its
 * radius. The enemies already had shape language - the Runner is a dart, the
 * Brute a slab - and the bosses, the things a floor is remembered by, did not.
 *
 * Each shape says what the fight is. The Golem is a slab on legs, the Hound
 * leans forward at a run, the Monolith is a standing stone that barely moves,
 * the Maw is a ring of teeth around nothing. They are drawn from the boss's
 * radius and from the fill and outline its definition carries, so retuning a
 * boss's size or palette needs no change here.
 */

interface SilhouetteColors {
  fill: string
  outline: string
}

function polygon(radius: number, sides: number, spin: number): number[] {
  return Array.from({ length: sides }, (_, index) => {
    const angle = spin + (Math.PI * 2 * index) / sides
    return [Math.cos(angle) * radius, Math.sin(angle) * radius]
  }).flat()
}

/**
 * Draws `shape` into `body` at `radius`, fill and outline included.
 *
 * Interior markings come after the outline so a boss reads as one object with
 * detail rather than as a stack of shapes.
 */
export function drawBossSilhouette(
  body: Graphics,
  shape: BossRenderShape,
  radius: number,
  colors: SilhouetteColors,
): void {
  const outline = { color: colors.outline, width: 3 } as const

  switch (shape) {
    case 'golem': {
      // A slab with shoulders: heavy, square, and wider than it is tall.
      body
        .poly([
          -radius, -radius * 0.5,
          -radius * 0.62, -radius * 0.92,
          radius * 0.62, -radius * 0.92,
          radius, -radius * 0.5,
          radius * 0.82, radius * 0.95,
          -radius * 0.82, radius * 0.95,
        ])
        .fill(colors.fill)
        .stroke(outline)
        .rect(-radius * 0.46, -radius * 0.52, radius * 0.92, radius * 0.42)
        .stroke({ color: colors.outline, width: 2, alpha: 0.75 })
        .moveTo(-radius * 0.2, radius * 0.1)
        .lineTo(-radius * 0.2, radius * 0.95)
        .moveTo(radius * 0.2, radius * 0.1)
        .lineTo(radius * 0.2, radius * 0.95)
        .stroke({ color: colors.outline, width: 2, alpha: 0.6 })
      return
    }
    case 'colossus': {
      // Tall and faceted, like something cut out of a glacier.
      body
        .poly([
          0, -radius * 1.25,
          radius * 0.72, -radius * 0.3,
          radius * 0.5, radius * 0.95,
          -radius * 0.5, radius * 0.95,
          -radius * 0.72, -radius * 0.3,
        ])
        .fill(colors.fill)
        .stroke(outline)
        .moveTo(0, -radius * 1.25)
        .lineTo(0, radius * 0.95)
        .moveTo(-radius * 0.72, -radius * 0.3)
        .lineTo(radius * 0.72, -radius * 0.3)
        .stroke({ color: colors.outline, width: 2, alpha: 0.8 })
        .poly([
          0, -radius * 0.72,
          radius * 0.3, -radius * 0.2,
          0, radius * 0.3,
          -radius * 0.3, -radius * 0.2,
        ])
        .stroke({ color: colors.outline, width: 2, alpha: 0.55 })
      return
    }
    case 'beast': {
      // Low and leaning into its run, with the head out ahead of the body.
      body
        .poly([
          radius * 1.2, -radius * 0.12,
          radius * 0.5, -radius * 0.62,
          -radius * 0.3, -radius * 0.82,
          -radius * 1.1, -radius * 0.3,
          -radius * 0.85, radius * 0.6,
          radius * 0.2, radius * 0.82,
          radius * 0.85, radius * 0.45,
        ])
        .fill(colors.fill)
        .stroke(outline)
        // Mane spines along the back.
        .moveTo(-radius * 0.85, -radius * 0.55)
        .lineTo(-radius * 0.6, -radius * 1.05)
        .lineTo(-radius * 0.3, -radius * 0.8)
        .lineTo(-radius * 0.05, -radius * 1.15)
        .lineTo(radius * 0.22, -radius * 0.72)
        .stroke({ color: colors.outline, width: 2.5, alpha: 0.85 })
        .circle(radius * 0.72, -radius * 0.2, radius * 0.12)
        .fill(colors.outline)
      return
    }
    case 'herald': {
      // A hood tapering to nothing, crowned with spikes.
      body
        .moveTo(0, -radius * 1.15)
        .bezierCurveTo(
          radius * 0.95, -radius * 0.7,
          radius * 0.8, radius * 0.5,
          radius * 0.4, radius * 1,
        )
        .lineTo(-radius * 0.4, radius * 1)
        .bezierCurveTo(
          -radius * 0.8, radius * 0.5,
          -radius * 0.95, -radius * 0.7,
          0, -radius * 1.15,
        )
        .closePath()
        .fill(colors.fill)
        .stroke(outline)
      for (const offset of [-0.62, -0.3, 0, 0.3, 0.62]) {
        body
          .moveTo(radius * offset, -radius * (1.02 - Math.abs(offset) * 0.5))
          .lineTo(radius * offset * 1.18, -radius * (1.48 - Math.abs(offset) * 0.7))
      }
      body.stroke({ color: colors.outline, width: 2.5, alpha: 0.9 })
      body
        .poly([0, -radius * 0.3, radius * 0.26, 0, 0, radius * 0.3, -radius * 0.26, 0])
        .fill(colors.outline)
      return
    }
    case 'sentinel': {
      // A floating core inside tilted rings, an armillary rather than a body.
      body
        .poly(polygon(radius * 0.52, 6, Math.PI / 6))
        .fill(colors.fill)
        .stroke(outline)
      for (const squash of [0.32, 0.62]) {
        body
          .ellipse(0, 0, radius, radius * squash)
          .stroke({ color: colors.outline, width: 2.5, alpha: 0.85 })
      }
      body
        .ellipse(0, 0, radius * 0.42, radius)
        .stroke({ color: colors.outline, width: 2, alpha: 0.6 })
        .poly(polygon(radius * 0.24, 6, 0))
        .fill(colors.outline)
      return
    }
    case 'brood': {
      // A swollen abdomen carried on splayed legs.
      body
        .ellipse(0, radius * 0.12, radius * 0.82, radius)
        .fill(colors.fill)
        .stroke(outline)
      for (const side of [-1, 1]) {
        for (const lift of [0.15, 0.5, 0.85]) {
          body
            .moveTo(side * radius * 0.55, radius * (lift - 0.35))
            .lineTo(side * radius * 1.25, radius * (lift - 0.75))
            .lineTo(side * radius * 1.45, radius * (lift - 0.1))
        }
      }
      body.stroke({ color: colors.outline, width: 2.5, alpha: 0.85 })
      body
        .ellipse(0, -radius * 0.62, radius * 0.4, radius * 0.3)
        .fill(colors.outline)
        .moveTo(-radius * 0.45, radius * 0.3)
        .lineTo(radius * 0.45, radius * 0.3)
        .moveTo(-radius * 0.38, radius * 0.68)
        .lineTo(radius * 0.38, radius * 0.68)
        .stroke({ color: colors.outline, width: 2, alpha: 0.5 })
      return
    }
    case 'warlord': {
      // Armour: broad pauldrons over a narrow waist.
      body
        .poly([
          -radius * 1.12, -radius * 0.62,
          -radius * 0.45, -radius * 0.95,
          0, -radius * 1.1,
          radius * 0.45, -radius * 0.95,
          radius * 1.12, -radius * 0.62,
          radius * 0.6, -radius * 0.2,
          radius * 0.45, radius * 1,
          -radius * 0.45, radius * 1,
          -radius * 0.6, -radius * 0.2,
        ])
        .fill(colors.fill)
        .stroke(outline)
        .moveTo(0, -radius * 0.95)
        .lineTo(0, radius * 1)
        .stroke({ color: colors.outline, width: 2.5, alpha: 0.8 })
        .poly([
          0, -radius * 0.58,
          radius * 0.3, -radius * 0.12,
          0, radius * 0.38,
          -radius * 0.3, -radius * 0.12,
        ])
        .fill(colors.outline)
      return
    }
    case 'wraith': {
      // Two halves of the same figure, offset, as if one is a reflection.
      for (const [side, alpha] of [[-1, 1], [1, 0.58]] as const) {
        body
          .moveTo(side * radius * 0.08, -radius * 1.1)
          .bezierCurveTo(
            side * radius * 0.95, -radius * 0.5,
            side * radius * 0.62, radius * 0.55,
            side * radius * 0.2, radius * 1.05,
          )
          .lineTo(side * radius * 0.08, radius * 0.2)
          .closePath()
          .fill({ color: colors.fill, alpha })
          .stroke({ color: colors.outline, width: 2.5, alpha })
      }
      body
        .moveTo(0, -radius * 1.1)
        .lineTo(0, radius * 1.05)
        .stroke({ color: colors.outline, width: 2, alpha: 0.85 })
        .circle(0, -radius * 0.58, radius * 0.16)
        .fill(colors.outline)
      return
    }
    case 'monolith': {
      // A standing stone. Nothing about it suggests it will come to you.
      body
        .poly([
          -radius * 0.58, -radius * 1.3,
          radius * 0.58, -radius * 1.22,
          radius * 0.68, radius * 1.05,
          -radius * 0.68, radius * 1.05,
        ])
        .fill(colors.fill)
        .stroke(outline)
      for (const height of [-0.8, -0.35, 0.1, 0.55]) {
        body
          .moveTo(-radius * 0.6, radius * height)
          .lineTo(radius * 0.6, radius * height)
      }
      body.stroke({ color: colors.outline, width: 2, alpha: 0.55 })
      body
        .poly([
          0, -radius * 0.62,
          radius * 0.34, 0,
          0, radius * 0.62,
          -radius * 0.34, 0,
        ])
        .fill(colors.outline)
      return
    }
    case 'maw': {
      // A ring of teeth around an empty middle.
      body
        .circle(0, 0, radius)
        .fill({ color: colors.fill, alpha: 0.35 })
        .stroke(outline)
      const toothCount = 11
      for (let index = 0; index < toothCount; index += 1) {
        const angle = (Math.PI * 2 * index) / toothCount
        const next = angle + (Math.PI * 2) / toothCount
        body
          .poly([
            Math.cos(angle) * radius, Math.sin(angle) * radius,
            Math.cos(next) * radius, Math.sin(next) * radius,
            Math.cos((angle + next) / 2) * radius * 0.44,
            Math.sin((angle + next) / 2) * radius * 0.44,
          ])
          .fill(colors.fill)
          .stroke({ color: colors.outline, width: 1.5, alpha: 0.8 })
      }
      body
        .circle(0, 0, radius * 0.3)
        .fill('#0f0720')
        .stroke({ color: colors.outline, width: 2, alpha: 0.9 })
      return
    }
    default: {
      // The Warden: a crowned core wreathed in flame-tipped spikes.
      const spikeCount = 9
      const points: number[] = []
      for (let index = 0; index < spikeCount * 2; index += 1) {
        const angle = (Math.PI * index) / spikeCount - Math.PI / 2
        const length = index % 2 === 0 ? radius * 1.28 : radius * 0.78
        points.push(Math.cos(angle) * length, Math.sin(angle) * length)
      }
      body
        .poly(points)
        .fill({ color: colors.fill, alpha: 0.85 })
        .stroke({ color: colors.outline, width: 2.5 })
        .circle(0, 0, radius * 0.74)
        .fill(colors.fill)
        .stroke(outline)
        .poly(polygon(radius * 0.4, 3, -Math.PI / 2))
        .fill(colors.outline)
      return
    }
  }
}
