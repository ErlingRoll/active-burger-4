/**
 * How far back the camera sits before the player's own zoom.
 *
 * The camera used to draw at 1:1 whatever it was given, so the arena's field of
 * view was an accident of the device: a 1080-tall desktop saw a room, and a
 * phone held upright saw about four hundred units of floor and met enemies that
 * were already on top of the player. Fitting to the shorter side of the
 * viewport gives every device a comparable slice of the world.
 *
 * Two bounds keep it honest. It never magnifies past 1:1, because the art is
 * authored at that size and enlarging it only narrows the view; and it stops
 * pulling back at a floor, because past that the silhouettes stop being
 * readable, which costs more than the extra floor is worth. A player who wants
 * more can still zoom out themselves.
 */

/** How much world the shorter side of the viewport should show. */
export const FITTED_VIEWPORT_WORLD_UNITS = 720

/** Never magnified: the entities are drawn at their authored size. */
export const MAX_CAMERA_SCALE = 1

/** The furthest the fit pulls back on its own, before manual zoom. */
export const MIN_FITTED_CAMERA_SCALE = 0.55

/** The furthest a player may zoom out by hand. */
export const MIN_CAMERA_SCALE = 1 / 3

export function fittedCameraScale(width: number, height: number): number {
  const shorterSide = Math.min(width, height)
  if (!Number.isFinite(shorterSide) || shorterSide <= 0) {
    return MAX_CAMERA_SCALE
  }
  return Math.min(
    MAX_CAMERA_SCALE,
    Math.max(
      MIN_FITTED_CAMERA_SCALE,
      shorterSide / FITTED_VIEWPORT_WORLD_UNITS,
    ),
  )
}

/** The fit, times whatever zoom the player has chosen, within the hard bounds. */
export function cameraScaleFor(
  width: number,
  height: number,
  zoom: number,
): number {
  return Math.min(
    MAX_CAMERA_SCALE,
    Math.max(MIN_CAMERA_SCALE, fittedCameraScale(width, height) * zoom),
  )
}
