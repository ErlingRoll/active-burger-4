import type {
  AudioBufferLike,
  AudioContextLike,
  AudioNodeLike,
  AudioParamLike,
} from './AudioContextLike'

/**
 * The instruments every sound effect is built from.
 *
 * A cue is a `CueRenderer`: given a context, a node to play into, and a start
 * time, it schedules oscillators and noise and reports how long until it has
 * gone quiet. Nothing here is audible on its own; the player owns the
 * context, the volume, and the decision to play at all.
 */

export interface SynthTarget {
  context: AudioContextLike
  destination: AudioNodeLike
  startTime: number
  /** One second of white noise, shared by every noise burst on this context. */
  noiseBuffer: AudioBufferLike
}

export interface RenderParams {
  /** Multiplies every level in the cue; the cue's mix level times any per-play boost. */
  gain: number
  /** Shifts every frequency in the cue, in semitones. */
  pitch: number
  /** 0..1, how big the moment was; cues that scale with it get louder or longer. */
  intensity: number
}

export type CueRenderer = (target: SynthTarget, params: RenderParams) => number

/** Exponential ramps cannot reach zero, so silence is this instead. */
export const SILENT_GAIN = 0.0001

export function semitones(baseHz: number, offset: number): number {
  return baseHz * 2 ** (offset / 12)
}

export interface FilterSpec {
  type: BiquadFilterType
  frequency: number
  endFrequency?: number
  q?: number
}

export interface EnvelopeSpec {
  /** Seconds to reach the peak. */
  attack?: number
  /** Seconds from the peak down to the sustain level. */
  decay?: number
  /** Fraction of the peak held after the decay. */
  sustain?: number
  /** Seconds from the end of the note to silence. */
  release?: number
}

export interface ToneSpec extends EnvelopeSpec {
  wave: OscillatorType
  frequency: number
  /** Glides to this frequency across the note. */
  endFrequency?: number
  glide?: 'linear' | 'exponential'
  /** Seconds the note lasts before its release, attack and decay included. */
  duration: number
  gain?: number
  detune?: number
  filter?: FilterSpec
  /** Seconds after the cue start before this note begins. */
  delay?: number
  /** Halves the level at intensity 0 and leaves it alone at 1. */
  scaleWithIntensity?: boolean
}

export interface NoiseSpec {
  duration: number
  filter?: FilterSpec
  attack?: number
  release?: number
  gain?: number
  delay?: number
  playbackRate?: number
  endPlaybackRate?: number
  scaleWithIntensity?: boolean
}

export interface ArpeggioSpec {
  wave: OscillatorType
  frequencies: readonly number[]
  noteDuration: number
  gap?: number
  gain?: number
  attack?: number
  release?: number
  filter?: FilterSpec
  delay?: number
}

function intensityScale(params: RenderParams, enabled: boolean | undefined): number {
  return enabled ? 0.5 + 0.5 * Math.min(1, Math.max(0, params.intensity)) : 1
}

/**
 * Attack, decay, sustain, hold, release. Returns the time at which the
 * envelope has reached silence.
 */
function applyEnvelope(
  param: AudioParamLike,
  startTime: number,
  peak: number,
  duration: number,
  envelope: EnvelopeSpec,
): number {
  const attack = Math.max(0, envelope.attack ?? 0.005)
  const decay = Math.max(0, envelope.decay ?? 0)
  const sustain = Math.min(1, Math.max(0, envelope.sustain ?? 1))
  const release = Math.max(0.005, envelope.release ?? 0.05)
  const peakLevel = Math.max(SILENT_GAIN, peak)
  const sustainLevel = Math.max(SILENT_GAIN, peakLevel * sustain)
  const holdEnd = startTime + Math.max(duration, attack + decay)

  param.setValueAtTime(SILENT_GAIN, startTime)
  param.linearRampToValueAtTime(peakLevel, startTime + attack)
  if (decay > 0) {
    param.linearRampToValueAtTime(sustainLevel, startTime + attack + decay)
  } else if (sustainLevel !== peakLevel) {
    param.setValueAtTime(sustainLevel, startTime + attack)
  }
  param.setValueAtTime(sustainLevel, holdEnd)
  param.exponentialRampToValueAtTime(SILENT_GAIN, holdEnd + release)
  return holdEnd + release
}

function applyFilter(
  target: SynthTarget,
  spec: FilterSpec | undefined,
  startTime: number,
  endTime: number,
  pitch: number,
): { input: AudioNodeLike; output: AudioNodeLike; disconnect: () => void } | undefined {
  if (!spec) {
    return undefined
  }
  const filter = target.context.createBiquadFilter()
  filter.type = spec.type
  filter.frequency.setValueAtTime(Math.max(10, semitones(spec.frequency, pitch)), startTime)
  if (spec.endFrequency !== undefined) {
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(10, semitones(spec.endFrequency, pitch)),
      endTime,
    )
  }
  if (spec.q !== undefined) {
    filter.Q.setValueAtTime(spec.q, startTime)
  }
  return { input: filter, output: filter, disconnect: () => filter.disconnect() }
}

export function tone(spec: ToneSpec): CueRenderer {
  return (target, params) => {
    const { context } = target
    const startTime = target.startTime + (spec.delay ?? 0)
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = spec.wave
    if (spec.detune) {
      oscillator.detune.setValueAtTime(spec.detune, startTime)
    }
    const startHz = Math.max(1, semitones(spec.frequency, params.pitch))
    oscillator.frequency.setValueAtTime(startHz, startTime)
    if (spec.endFrequency !== undefined) {
      const endHz = Math.max(1, semitones(spec.endFrequency, params.pitch))
      if (spec.glide === 'linear') {
        oscillator.frequency.linearRampToValueAtTime(endHz, startTime + spec.duration)
      } else {
        oscillator.frequency.exponentialRampToValueAtTime(endHz, startTime + spec.duration)
      }
    }
    const peak = (spec.gain ?? 1) * params.gain * intensityScale(params, spec.scaleWithIntensity)
    const endTime = applyEnvelope(gain.gain, startTime, peak, spec.duration, spec)
    const filter = applyFilter(target, spec.filter, startTime, endTime, params.pitch)

    if (filter) {
      oscillator.connect(filter.input)
      filter.output.connect(gain)
    } else {
      oscillator.connect(gain)
    }
    gain.connect(target.destination)
    oscillator.start(startTime)
    oscillator.stop(endTime + 0.01)
    oscillator.onended = () => {
      oscillator.disconnect()
      filter?.disconnect()
      gain.disconnect()
    }
    return endTime - target.startTime
  }
}

export function noise(spec: NoiseSpec): CueRenderer {
  return (target, params) => {
    const { context } = target
    const startTime = target.startTime + (spec.delay ?? 0)
    const source = context.createBufferSource()
    const gain = context.createGain()
    source.buffer = target.noiseBuffer
    source.loop = true
    source.playbackRate.setValueAtTime(spec.playbackRate ?? 1, startTime)
    if (spec.endPlaybackRate !== undefined) {
      source.playbackRate.exponentialRampToValueAtTime(
        Math.max(0.01, spec.endPlaybackRate),
        startTime + spec.duration,
      )
    }
    const peak = (spec.gain ?? 1) * params.gain * intensityScale(params, spec.scaleWithIntensity)
    const endTime = applyEnvelope(gain.gain, startTime, peak, spec.duration, {
      attack: spec.attack,
      release: spec.release,
    })
    const filter = applyFilter(target, spec.filter, startTime, endTime, params.pitch)

    if (filter) {
      source.connect(filter.input)
      filter.output.connect(gain)
    } else {
      source.connect(gain)
    }
    gain.connect(target.destination)
    source.start(startTime)
    source.stop(endTime + 0.01)
    source.onended = () => {
      source.disconnect()
      filter?.disconnect()
      gain.disconnect()
    }
    return endTime - target.startTime
  }
}

export function arpeggio(spec: ArpeggioSpec): CueRenderer {
  const step = spec.noteDuration + (spec.gap ?? 0)
  return layer(
    ...spec.frequencies.map((frequency, index) =>
      tone({
        wave: spec.wave,
        frequency,
        duration: spec.noteDuration,
        gain: spec.gain,
        attack: spec.attack,
        release: spec.release ?? 0.08,
        filter: spec.filter,
        delay: (spec.delay ?? 0) + index * step,
      }),
    ),
  )
}

/** Plays every renderer at once; the cue lasts as long as the longest. */
export function layer(...renderers: readonly CueRenderer[]): CueRenderer {
  return (target, params) =>
    renderers.reduce((longest, render) => Math.max(longest, render(target, params)), 0)
}

/** Picks the bigger rendering once the moment is big enough. */
export function withIntensity(
  low: CueRenderer,
  high: CueRenderer,
  threshold = 0.5,
): CueRenderer {
  return (target, params) =>
    (params.intensity >= threshold ? high : low)(target, params)
}

/**
 * White noise for the noise bursts. This is the one place the audio layer
 * draws random numbers; the simulation's seeded source is never involved.
 */
export function createNoiseBuffer(context: AudioContextLike, seconds = 1): AudioBufferLike {
  const length = Math.max(1, Math.ceil(seconds * context.sampleRate))
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let index = 0; index < length; index += 1) {
    data[index] = Math.random() * 2 - 1
  }
  return buffer
}
