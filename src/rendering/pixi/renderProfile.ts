/**
 * How hard the canvas may push the machine it is on.
 *
 * A browser without a usable GPU still offers WebGL, drawn on the CPU by a
 * software renderer such as SwiftShader or llvmpipe. That renderer pays for
 * every pixel and every multisample, so a full-HD, antialiased arena that a
 * laptop GPU draws in a millisecond takes it a tenth of a second, and the run
 * plays at ten frames a second. The profile is what the renderer is created
 * with: the software case gives up multisampling and renders at a pixel budget
 * that is then scaled up to the host, which is a softer picture at a playable
 * rate. Every other machine keeps the picture it had.
 */

export interface RenderProfile {
  /** Whether the machine is drawing WebGL on its CPU. */
  readonly softwareRenderer: boolean
  /** Multisample antialiasing on the main render target. */
  readonly antialias: boolean
  /** Backing pixels per CSS pixel of the canvas. */
  readonly resolution: number
}

export interface WebGlProbe {
  /**
   * Whether a context was granted with `failIfMajorPerformanceCaveat`, which
   * a browser refuses when its only WebGL is a software fallback.
   */
  readonly contextWithoutCaveat: boolean
  /** The unmasked renderer string, when the browser exposes one. */
  readonly renderer: string | null
}

/** Renderer strings that name a CPU implementation of GL. */
const SOFTWARE_RENDERER_PATTERN =
  /swiftshader|llvmpipe|softpipe|software|mesa offscreen|basic render/i

/**
 * Pixels the software renderer is asked to fill per frame. A 1366x768 frame,
 * which is where a full-HD host lands after scaling, keeps the run above
 * thirty frames a second on the CPU renderers this was measured against.
 */
export const SOFTWARE_PIXEL_BUDGET = 1_050_000

/** The picture is never scaled below this; past it the arena reads as mush. */
export const MIN_SOFTWARE_RESOLUTION = 0.5

export function isSoftwareRenderer(probe: WebGlProbe): boolean {
  if (!probe.contextWithoutCaveat) {
    return true
  }
  return probe.renderer !== null && SOFTWARE_RENDERER_PATTERN.test(probe.renderer)
}

export function resolveRenderProfile(
  probe: WebGlProbe,
  hostWidth: number,
  hostHeight: number,
): RenderProfile {
  if (!isSoftwareRenderer(probe)) {
    return { softwareRenderer: false, antialias: true, resolution: 1 }
  }
  const hostPixels = Math.max(1, hostWidth) * Math.max(1, hostHeight)
  const resolution = Math.min(
    1,
    Math.max(MIN_SOFTWARE_RESOLUTION, Math.sqrt(SOFTWARE_PIXEL_BUDGET / hostPixels)),
  )
  return { softwareRenderer: true, antialias: false, resolution }
}

/**
 * Asks the browser what its WebGL is made of. A throwaway context is the only
 * way to find out before the real one is created, since the caveat and the
 * renderer string are both properties of a context.
 */
export function probeWebGl(): WebGlProbe {
  if (typeof document === 'undefined') {
    return { contextWithoutCaveat: true, renderer: null }
  }
  try {
    const canvas = document.createElement('canvas')
    const options: WebGLContextAttributes = { failIfMajorPerformanceCaveat: true }
    const context: WebGL2RenderingContext | WebGLRenderingContext | null =
      canvas.getContext('webgl2', options) ?? canvas.getContext('webgl', options)
    if (!context) {
      return { contextWithoutCaveat: false, renderer: null }
    }
    const debugInfo = context.getExtension('WEBGL_debug_renderer_info')
    const renderer: unknown = debugInfo
      ? context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : context.getParameter(context.RENDERER)
    context.getExtension('WEBGL_lose_context')?.loseContext()
    return {
      contextWithoutCaveat: true,
      renderer: typeof renderer === 'string' ? renderer : null,
    }
  } catch {
    return { contextWithoutCaveat: true, renderer: null }
  }
}

export function detectRenderProfile(hostWidth: number, hostHeight: number): RenderProfile {
  return resolveRenderProfile(probeWebGl(), hostWidth, hostHeight)
}
