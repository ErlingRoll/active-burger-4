/**
 * The one place that knows what a telegraphed area covers and where its exit
 * is.
 *
 * Three systems used to answer those questions separately: `BossSystem` when a
 * telegraph resolves, `DodgeSystem` when it decides to move, and
 * `BehaviorIntents` when it scores somewhere to stand. All three tested the
 * same two shapes by checking the skill id, and they did not agree. The Dodge
 * direction for a lane pointed away from the lane's midpoint, which for an
 * attack aimed at the player means fleeing straight down the lane; and one of
 * its two axes left enemy projectiles out of that branch, so a projectile dodge
 * mixed an origin on one axis with a different origin on the other.
 *
 * Counterplay only exists if the area the damage uses is the area the
 * autonomous player reads, and if "out" means out. So the geometry lives here,
 * once, keyed on the shape rather than on which attack cast it.
 */
import type { SkillEffectPoint, TelegraphState } from '../state/GameState'

export interface TelegraphVector {
  x: number
  y: number
}

function pointDistanceSquared(
  px: number,
  py: number,
  x: number,
  y: number,
): number {
  const dx = px - x
  const dy = py - y
  return dx * dx + dy * dy
}

interface NearestSegmentPoint {
  x: number
  y: number
  /** Unit vector along the segment, zero-length when the segment is a point. */
  directionX: number
  directionY: number
}

function nearestPointOnSegment(
  px: number,
  py: number,
  start: SkillEffectPoint,
  end: SkillEffectPoint,
): NearestSegmentPoint {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) {
    return { x: start.x, y: start.y, directionX: 0, directionY: 0 }
  }
  const projection = Math.max(
    0,
    Math.min(1, ((px - start.x) * dx + (py - start.y) * dy) / lengthSquared),
  )
  const length = Math.sqrt(lengthSquared)
  return {
    x: start.x + projection * dx,
    y: start.y + projection * dy,
    directionX: dx / length,
    directionY: dy / length,
  }
}

/** The line a `line` telegraph covers, or undefined when it has no extent. */
function getTelegraphSegment(
  telegraph: Readonly<TelegraphState>,
): { start: SkillEffectPoint; end: SkillEffectPoint } | undefined {
  const start = telegraph.points[0]
  const end = telegraph.points[telegraph.points.length - 1]
  return start && end ? { start, end } : undefined
}

/** Signed difference between two angles, wrapped to (-PI, PI]. */
function angleDifference(from: number, to: number): number {
  const difference = (to - from) % (Math.PI * 2)
  if (difference > Math.PI) {
    return difference - Math.PI * 2
  }
  if (difference <= -Math.PI) {
    return difference + Math.PI * 2
  }
  return difference
}

/**
 * Whether a circle of `padding` around `x, y` overlaps the telegraph.
 *
 * Padding is the tested entity's own radius: an attack lands when it touches
 * the player, not only when it covers the player's centre.
 */
export function isPointInTelegraph(
  telegraph: Readonly<TelegraphState>,
  x: number,
  y: number,
  padding = 0,
): boolean {
  switch (telegraph.shape) {
    case 'line': {
      const segment = getTelegraphSegment(telegraph)
      if (!segment) {
        return false
      }
      const nearest = nearestPointOnSegment(x, y, segment.start, segment.end)
      const reach = telegraph.radius + padding
      return pointDistanceSquared(x, y, nearest.x, nearest.y) <= reach * reach
    }
    case 'ring': {
      const distance = Math.hypot(x - telegraph.x, y - telegraph.y)
      const inner = telegraph.innerRadius ?? 0
      return distance + padding > inner && distance - padding < telegraph.radius
    }
    case 'cone': {
      const distance = Math.hypot(x - telegraph.x, y - telegraph.y)
      if (distance - padding > telegraph.radius) {
        return false
      }
      const arc = telegraph.arc ?? Math.PI * 2
      if (arc >= Math.PI * 2) {
        return true
      }
      // Padding widens the sector more the closer the point is to the apex,
      // because the same padding subtends a larger angle there.
      const angularPadding = distance <= 1e-6
        ? Math.PI
        : Math.min(Math.PI, Math.asin(Math.min(1, padding / distance)))
      const offset = Math.abs(
        angleDifference(telegraph.angle ?? 0, Math.atan2(y - telegraph.y, x - telegraph.x)),
      )
      return offset <= arc / 2 + angularPadding
    }
    default: {
      const reach = telegraph.radius + padding
      return pointDistanceSquared(x, y, telegraph.x, telegraph.y) <= reach * reach
    }
  }
}

/**
 * A unit vector out of the telegraph from `x, y`, or undefined when the point
 * is already clear of it.
 *
 * The direction is the shape's actual counterplay, not a uniform "run away":
 * a ring is escaped by closing on its centre, a lane by stepping off it
 * sideways, a cone by rounding its edge.
 */
export function getTelegraphEscapeVector(
  telegraph: Readonly<TelegraphState>,
  x: number,
  y: number,
  padding = 0,
): TelegraphVector | undefined {
  if (!isPointInTelegraph(telegraph, x, y, padding)) {
    return undefined
  }
  switch (telegraph.shape) {
    case 'line': {
      const segment = getTelegraphSegment(telegraph)
      if (!segment) {
        return undefined
      }
      const nearest = nearestPointOnSegment(x, y, segment.start, segment.end)
      const offsetX = x - nearest.x
      const offsetY = y - nearest.y
      const offsetLength = Math.hypot(offsetX, offsetY)
      if (offsetLength > 1e-6) {
        return { x: offsetX / offsetLength, y: offsetY / offsetLength }
      }
      // Standing exactly on the lane: leave along whichever normal the stable
      // entity id picks, so an unlucky alignment still produces a sidestep
      // rather than no movement at all.
      const sign = telegraph.id % 2 === 0 ? 1 : -1
      if (nearest.directionX === 0 && nearest.directionY === 0) {
        return { x: sign, y: 0 }
      }
      return {
        x: -nearest.directionY * sign,
        y: nearest.directionX * sign,
      }
    }
    case 'ring': {
      const offsetX = x - telegraph.x
      const offsetY = y - telegraph.y
      const distance = Math.hypot(offsetX, offsetY)
      if (distance <= 1e-6) {
        return undefined
      }
      const inner = telegraph.innerRadius ?? 0
      // Whichever edge of the band is nearer. A band wider than the distance
      // left to its outer edge is still escaped inward, because the safe centre
      // does not move while the outer edge may be off the arena.
      const inwardCost = distance - inner
      const outwardCost = telegraph.radius - distance
      const inward = inwardCost <= outwardCost
      const sign = inward ? -1 : 1
      return { x: (offsetX / distance) * sign, y: (offsetY / distance) * sign }
    }
    case 'cone': {
      const offsetX = x - telegraph.x
      const offsetY = y - telegraph.y
      const distance = Math.hypot(offsetX, offsetY)
      const arc = telegraph.arc ?? Math.PI * 2
      if (arc >= Math.PI * 2 || distance <= 1e-6) {
        // A full sweep, or standing on the apex: nothing to round, so back out.
        return distance <= 1e-6
          ? { x: telegraph.id % 2 === 0 ? 1 : -1, y: 0 }
          : { x: offsetX / distance, y: offsetY / distance }
      }
      const offset = angleDifference(
        telegraph.angle ?? 0,
        Math.atan2(offsetY, offsetX),
      )
      // Whichever way out is shorter: around the nearer edge of the sector, or
      // straight out past its reach. Rounding a wide sector from far out is a
      // long way, and near the apex leaving by the reach is barely a step.
      const aroundCost = distance * Math.max(0, arc / 2 - Math.abs(offset))
      const outwardCost = telegraph.radius - distance
      if (outwardCost <= aroundCost) {
        return { x: offsetX / distance, y: offsetY / distance }
      }
      const sign = offset >= 0 ? 1 : -1
      return {
        x: -(offsetY / distance) * sign,
        y: (offsetX / distance) * sign,
      }
    }
    default: {
      const offsetX = x - telegraph.x
      const offsetY = y - telegraph.y
      const distance = Math.hypot(offsetX, offsetY)
      if (distance <= 1e-6) {
        return { x: telegraph.id % 2 === 0 ? 1 : -1, y: 0 }
      }
      return { x: offsetX / distance, y: offsetY / distance }
    }
  }
}
