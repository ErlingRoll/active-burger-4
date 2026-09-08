/**
 * Shape helpers for the renderer.
 *
 * The graphics guidelines call for distinct silhouettes per skill, which means
 * a lot of polygons and stars. Generating their points here keeps the drawing
 * code about the look of an effect rather than its trigonometry, and lets the
 * shapes be checked without a canvas.
 */

/** Points of a regular polygon centred on the origin, flattened to [x, y, ...]. */
export function createPolygonPoints(
  radius: number,
  sides: number,
  rotation = 0,
): number[] {
  return Array.from({ length: sides }, (_, index) => {
    const angle = rotation + (Math.PI * 2 * index) / sides
    return [Math.cos(angle) * radius, Math.sin(angle) * radius]
  }).flat()
}

/**
 * Points of a star centred on the origin, flattened to [x, y, ...].
 *
 * `innerRatio` is the inner radius as a fraction of `radius`; a smaller value
 * gives sharper spikes.
 */
export function createStarPoints(
  radius: number,
  points: number,
  innerRatio: number,
  rotation = 0,
): number[] {
  return Array.from({ length: points * 2 }, (_, index) => {
    const angle = rotation + (Math.PI * index) / points
    const pointRadius = index % 2 === 0 ? radius : radius * innerRatio
    return [Math.cos(angle) * pointRadius, Math.sin(angle) * pointRadius]
  }).flat()
}
