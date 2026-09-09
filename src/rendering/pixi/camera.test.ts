import { describe, expect, it } from 'vitest'
import {
  cameraScaleFor,
  fittedCameraScale,
  MAX_CAMERA_SCALE,
  MIN_CAMERA_SCALE,
  MIN_FITTED_CAMERA_SCALE,
} from './camera'

/**
 * What a device is allowed to see.
 *
 * The complaint that produced this was concrete: on a phone the arena was so
 * far zoomed in that enemies arrived already on top of the player. The rules
 * worth holding are that a phone pulls back, that a desktop does not change,
 * and that neither of those is achieved by magnifying the art.
 */
describe('fitted camera scale', () => {
  it('leaves a desktop where it was', () => {
    expect(fittedCameraScale(1920, 1080)).toBe(MAX_CAMERA_SCALE)
  })

  it('leaves a laptop where it was', () => {
    expect(fittedCameraScale(1440, 900)).toBe(MAX_CAMERA_SCALE)
  })

  it('pulls back on a phone held upright', () => {
    expect(fittedCameraScale(412, 906)).toBeLessThan(MAX_CAMERA_SCALE)
  })

  it('pulls back on a phone held sideways, where height is the short side', () => {
    expect(fittedCameraScale(906, 412)).toBe(fittedCameraScale(412, 906))
  })

  it('shows a phone appreciably more of the floor than it used to', () => {
    // The old camera drew everything at 1:1, so the improvement is the ratio.
    const visibleWidthBefore = 412
    const visibleWidthNow = 412 / fittedCameraScale(412, 906)

    expect(visibleWidthNow / visibleWidthBefore).toBeGreaterThan(1.5)
  })

  it('never magnifies, however small the viewport', () => {
    for (const [width, height] of [[320, 480], [200, 200], [1, 1]] as const) {
      expect(fittedCameraScale(width, height)).toBeLessThanOrEqual(MAX_CAMERA_SCALE)
    }
  })

  it('stops pulling back before the silhouettes stop reading', () => {
    expect(fittedCameraScale(200, 200)).toBe(MIN_FITTED_CAMERA_SCALE)
  })

  it('falls back to 1:1 for a viewport that has not been measured yet', () => {
    expect(fittedCameraScale(0, 0)).toBe(MAX_CAMERA_SCALE)
    expect(fittedCameraScale(Number.NaN, 100)).toBe(MAX_CAMERA_SCALE)
  })
})

describe('camera scale with the player zoom applied', () => {
  it('is the fit when the player has not zoomed', () => {
    expect(cameraScaleFor(1920, 1080, 1)).toBe(fittedCameraScale(1920, 1080))
    expect(cameraScaleFor(412, 906, 1)).toBe(fittedCameraScale(412, 906))
  })

  it('lets a player zoom out further than the fit does on its own', () => {
    expect(cameraScaleFor(412, 906, 0.1)).toBe(MIN_CAMERA_SCALE)
  })

  it('still refuses to magnify past the authored size', () => {
    expect(cameraScaleFor(1920, 1080, 10)).toBe(MAX_CAMERA_SCALE)
  })
})
