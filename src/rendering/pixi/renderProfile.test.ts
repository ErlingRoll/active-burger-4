import { describe, expect, it } from 'vitest'
import {
  MIN_SOFTWARE_RESOLUTION,
  SOFTWARE_PIXEL_BUDGET,
  isSoftwareRenderer,
  resolveRenderProfile,
} from './renderProfile'

const gpu = { contextWithoutCaveat: true, renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)' }
const swiftShader = {
  contextWithoutCaveat: true,
  renderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
}
const refused = { contextWithoutCaveat: false, renderer: null }

describe('software renderer detection', () => {
  it('trusts a GPU-backed context', () => {
    expect(isSoftwareRenderer(gpu)).toBe(false)
  })

  it('names the CPU fallbacks by their renderer string', () => {
    expect(isSoftwareRenderer(swiftShader)).toBe(true)
    expect(isSoftwareRenderer({ contextWithoutCaveat: true, renderer: 'llvmpipe (LLVM 15.0.7, 256 bits)' })).toBe(true)
    expect(isSoftwareRenderer({ contextWithoutCaveat: true, renderer: 'Microsoft Basic Render Driver' })).toBe(true)
  })

  it('treats a context the browser would only grant with a caveat as software', () => {
    expect(isSoftwareRenderer(refused)).toBe(true)
  })

  it('leaves an unknown renderer alone when the browser had no caveat', () => {
    expect(isSoftwareRenderer({ contextWithoutCaveat: true, renderer: null })).toBe(false)
  })
})

describe('render profile', () => {
  it('keeps the full picture on a GPU', () => {
    expect(resolveRenderProfile(gpu, 1920, 1080)).toEqual({
      softwareRenderer: false,
      antialias: true,
      resolution: 1,
    })
  })

  it('drops multisampling and scales a full-HD host to the pixel budget on a CPU renderer', () => {
    const profile = resolveRenderProfile(swiftShader, 1920, 1080)
    expect(profile.softwareRenderer).toBe(true)
    expect(profile.antialias).toBe(false)
    expect(profile.resolution).toBeLessThan(1)
    expect(profile.resolution).toBeGreaterThanOrEqual(MIN_SOFTWARE_RESOLUTION)
    const renderedPixels = 1920 * profile.resolution * (1080 * profile.resolution)
    expect(renderedPixels).toBeCloseTo(SOFTWARE_PIXEL_BUDGET, -3)
  })

  it('does not upscale a host that already fits the budget', () => {
    expect(resolveRenderProfile(swiftShader, 390, 844).resolution).toBe(1)
  })

  it('never scales below the floor, however large the host', () => {
    expect(resolveRenderProfile(refused, 5120, 2880).resolution).toBe(MIN_SOFTWARE_RESOLUTION)
  })
})
