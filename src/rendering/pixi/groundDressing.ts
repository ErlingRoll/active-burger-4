import { Graphics } from 'pixi.js'
import type { WorldTheme } from './worldTheme'

/**
 * The floor the fight happens on.
 *
 * The arena used to be a flat fill under one 100-unit grid drawn at the same
 * weight everywhere, which reads as graph paper rather than as a room: no
 * depth, no scale, and floor 1 identical to floor 30. This draws the floor
 * instead — a two-weight grid so the eye has something to measure distance
 * against, and a scattering of flagstones, rubble, sigils and pillar bases so
 * the ground has features to move past.
 *
 * Nothing here is random. Every decoration is derived from the floor number and
 * its own cell coordinates through a hash, so the same floor draws the same
 * room on every machine and on every replay, which is what the renderer's
 * determinism rule asks for. It reads no simulation state beyond the floor
 * number and writes none.
 */

/** The spacing of the fine grid, and the unit the rest is measured in. */
export const MINOR_GRID_SIZE = 100
/** Every fifth line is drawn heavier, which is what gives the floor a scale. */
export const MAJOR_GRID_SIZE = 500
/** One decoration is considered per cell of this size. */
const DECORATION_CELL_SIZE = 380

/**
 * A 32-bit integer hash.
 *
 * Three inputs mixed by multiply-and-xor: the same triple always gives the same
 * number, and neighbouring cells give unrelated ones, which is what stops the
 * decorations falling into visible rows.
 */
function hashCell(floor: number, cellX: number, cellY: number): number {
  let hash = Math.imul(floor + 0x9e37, 0x85eb_ca6b)
  hash = Math.imul(hash ^ (cellX + 0x2f_ffff), 0xc2b2_ae35)
  hash = Math.imul(hash ^ (cellY + 0x1b_8731), 0x27d4_eb2f)
  hash ^= hash >>> 15
  return hash >>> 0
}

/** A stable value in [0, 1) from one slice of a cell's hash. */
function unitFromHash(hash: number, slice: number): number {
  return ((hash >>> (slice * 6)) & 0x3ff) / 0x400
}

export interface GroundBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/**
 * Deepens a colour with the floor.
 *
 * A run is a descent, so the ground darkens and the light cools as it goes
 * down. The shift is small on purpose: it should be felt over ten floors
 * rather than noticed between two, and it must not take a surface outside the
 * palette family its mode is documented with.
 */
export function shadeForFloor(color: string, floor: number, strength = 1): number {
  const value = Number.parseInt(color.slice(1), 16)
  const depth = Math.min(1, Math.max(0, (floor - 1) / 30)) * strength
  const scale = 1 - depth * 0.35
  const red = Math.round(((value >> 16) & 0xff) * scale)
  const green = Math.round(((value >> 8) & 0xff) * scale)
  // Blue holds up better than the other two, so the floor cools as it darkens.
  const blue = Math.round((value & 0xff) * (1 - depth * 0.18))
  return (red << 16) | (green << 8) | blue
}

/** Draws the ground fill and its two grids into `view`. */
export function drawGround(
  view: Graphics,
  theme: WorldTheme,
  bounds: GroundBounds,
  floor: number,
): void {
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  view.rect(bounds.minX, bounds.minY, width, height).fill(shadeForFloor(theme.ground, floor))

  const grid = shadeForFloor(theme.grid, floor, 0.6)
  for (const [size, alpha, lineWidth] of [
    [MINOR_GRID_SIZE, 0.3, 1],
    [MAJOR_GRID_SIZE, 0.55, 2],
  ] as const) {
    const startX = Math.floor(bounds.minX / size) * size
    const startY = Math.floor(bounds.minY / size) * size
    for (let x = startX; x <= bounds.maxX; x += size) {
      view.moveTo(x, bounds.minY).lineTo(x, bounds.maxY).stroke({ color: grid, width: lineWidth, alpha })
    }
    for (let y = startY; y <= bounds.maxY; y += size) {
      view.moveTo(bounds.minX, y).lineTo(bounds.maxX, y).stroke({ color: grid, width: lineWidth, alpha })
    }
  }
}

/**
 * Draws the floor's decorations into `view`.
 *
 * Four kinds, each with a silhouette of its own rather than four sizes of the
 * same blob: a cracked flagstone, a rubble cluster, a ward sigil and the base
 * of a broken pillar. Two cells in five are left empty so the floor has
 * breathing room, and everything is drawn dim enough to stay behind the fight.
 */
export function drawGroundDressing(
  view: Graphics,
  theme: WorldTheme,
  bounds: GroundBounds,
  floor: number,
): void {
  const stone = shadeForFloor(theme.grid, floor, 0.5)
  const accent = shadeForFloor(theme.boundaryMiddle, floor, 0.5)
  const startX = Math.floor(bounds.minX / DECORATION_CELL_SIZE)
  const startY = Math.floor(bounds.minY / DECORATION_CELL_SIZE)
  const endX = Math.ceil(bounds.maxX / DECORATION_CELL_SIZE)
  const endY = Math.ceil(bounds.maxY / DECORATION_CELL_SIZE)

  for (let cellX = startX; cellX <= endX; cellX += 1) {
    for (let cellY = startY; cellY <= endY; cellY += 1) {
      const hash = hashCell(floor, cellX, cellY)
      const kind = hash % 10
      if (kind >= 6) {
        continue
      }
      const centerX = (cellX + 0.2 + unitFromHash(hash, 1) * 0.6) * DECORATION_CELL_SIZE
      const centerY = (cellY + 0.2 + unitFromHash(hash, 2) * 0.6) * DECORATION_CELL_SIZE
      const spin = unitFromHash(hash, 3) * Math.PI * 2
      const size = 42 + unitFromHash(hash, 4) * 48

      if (kind <= 1) {
        drawFlagstone(view, centerX, centerY, size, spin, stone)
      } else if (kind <= 3) {
        drawRubble(view, centerX, centerY, size, spin, hash, stone)
      } else if (kind === 4) {
        drawSigil(view, centerX, centerY, size, spin, accent)
      } else {
        drawPillarBase(view, centerX, centerY, size, spin, stone, accent)
      }
    }
  }
}

function polygonPoints(
  centerX: number,
  centerY: number,
  radius: number,
  sides: number,
  spin: number,
  radiusAt?: (index: number) => number,
): number[] {
  const points: number[] = []
  for (let index = 0; index < sides; index += 1) {
    const angle = spin + (Math.PI * 2 * index) / sides
    const reach = radiusAt === undefined ? radius : radius * radiusAt(index)
    points.push(centerX + Math.cos(angle) * reach, centerY + Math.sin(angle) * reach)
  }
  return points
}

/** A flagstone: a wide slab with a crack across it. */
function drawFlagstone(
  view: Graphics,
  centerX: number,
  centerY: number,
  size: number,
  spin: number,
  color: number,
): void {
  view
    .poly(polygonPoints(centerX, centerY, size, 6, spin, (index) => (index % 2 === 0 ? 1 : 0.82)))
    .fill({ color, alpha: 0.2 })
    .poly(polygonPoints(centerX, centerY, size, 6, spin, (index) => (index % 2 === 0 ? 1 : 0.82)))
    .stroke({ color, width: 2, alpha: 0.36 })
    .moveTo(centerX - Math.cos(spin) * size * 0.7, centerY - Math.sin(spin) * size * 0.7)
    .lineTo(centerX + Math.cos(spin + 0.4) * size * 0.3, centerY + Math.sin(spin + 0.4) * size * 0.3)
    .lineTo(centerX + Math.cos(spin) * size * 0.75, centerY + Math.sin(spin) * size * 0.75)
    .stroke({ color, width: 2, alpha: 0.5 })
}

/** Rubble: a handful of chips, not one blob. */
function drawRubble(
  view: Graphics,
  centerX: number,
  centerY: number,
  size: number,
  spin: number,
  hash: number,
  color: number,
): void {
  for (let index = 0; index < 4; index += 1) {
    const angle = spin + (Math.PI * 2 * index) / 4 + unitFromHash(hash, index) * 0.8
    const distance = size * (0.25 + unitFromHash(hash, index + 1) * 0.6)
    const chip = size * (0.12 + unitFromHash(hash, index + 2) * 0.16)
    view
      .poly(
        polygonPoints(
          centerX + Math.cos(angle) * distance,
          centerY + Math.sin(angle) * distance,
          chip,
          5,
          angle,
          (corner) => (corner % 2 === 0 ? 1 : 0.7),
        ),
      )
      .fill({ color, alpha: 0.36 })
  }
}

/** A ward sigil worn into the floor: a broken ring around a star. */
function drawSigil(
  view: Graphics,
  centerX: number,
  centerY: number,
  size: number,
  spin: number,
  color: number,
): void {
  view.circle(centerX, centerY, size * 0.9).stroke({ color, width: 2, alpha: 0.32 })
  view
    .poly(polygonPoints(centerX, centerY, size * 0.62, 8, spin, (index) => (index % 2 === 0 ? 1 : 0.44)))
    .stroke({ color, width: 2, alpha: 0.4 })
  for (let index = 0; index < 4; index += 1) {
    const angle = spin + (Math.PI * 2 * index) / 4
    view
      .moveTo(centerX + Math.cos(angle) * size * 0.9, centerY + Math.sin(angle) * size * 0.9)
      .lineTo(centerX + Math.cos(angle) * size * 1.15, centerY + Math.sin(angle) * size * 1.15)
      .stroke({ color, width: 2, alpha: 0.36 })
  }
}

/** What is left of a pillar: a socket ring with a stump inside it. */
function drawPillarBase(
  view: Graphics,
  centerX: number,
  centerY: number,
  size: number,
  spin: number,
  stone: number,
  accent: number,
): void {
  view
    .poly(polygonPoints(centerX, centerY, size, 8, spin))
    .fill({ color: stone, alpha: 0.28 })
    .poly(polygonPoints(centerX, centerY, size, 8, spin))
    .stroke({ color: accent, width: 2, alpha: 0.4 })
    .poly(polygonPoints(centerX, centerY, size * 0.52, 8, spin + 0.4))
    .fill({ color: stone, alpha: 0.34 })
    .poly(polygonPoints(centerX, centerY, size * 0.52, 8, spin + 0.4))
    .stroke({ color: accent, width: 1, alpha: 0.4 })
}
