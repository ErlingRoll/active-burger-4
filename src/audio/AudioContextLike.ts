/**
 * The slice of the Web Audio API the sound effects use, as structural types.
 *
 * A real `AudioContext` satisfies these as-is. Tests hand in a recording fake
 * instead, which jsdom (with no audio pipeline at all) could not otherwise
 * provide, and the engine never has to know the difference.
 */

export interface AudioParamLike {
  value: number
  setValueAtTime(value: number, startTime: number): unknown
  linearRampToValueAtTime(value: number, endTime: number): unknown
  exponentialRampToValueAtTime(value: number, endTime: number): unknown
  setTargetAtTime(target: number, startTime: number, timeConstant: number): unknown
  cancelScheduledValues(cancelTime: number): unknown
}

export interface AudioNodeLike {
  connect(destination: AudioNodeLike): unknown
  disconnect(): void
}

export interface GainNodeLike extends AudioNodeLike {
  readonly gain: AudioParamLike
}

/**
 * `never` for both the receiver and the event keeps this assignable from the
 * DOM's own handler type; the engine only ever assigns parameterless closures.
 */
export type EndedHandlerLike = (this: never, event: never) => unknown

export interface ScheduledSourceLike extends AudioNodeLike {
  start(when?: number): void
  stop(when?: number): void
  onended: EndedHandlerLike | null
}

export interface OscillatorNodeLike extends ScheduledSourceLike {
  type: OscillatorType
  readonly frequency: AudioParamLike
  readonly detune: AudioParamLike
}

export interface BiquadFilterNodeLike extends AudioNodeLike {
  type: BiquadFilterType
  readonly frequency: AudioParamLike
  readonly Q: AudioParamLike
}

export interface AudioBufferLike {
  readonly length: number
  getChannelData(channel: number): Float32Array
}

export interface AudioBufferSourceNodeLike extends ScheduledSourceLike {
  buffer: AudioBufferLike | null
  loop: boolean
  readonly playbackRate: AudioParamLike
}

export type AudioContextStateLike = 'suspended' | 'running' | 'closed' | 'interrupted'

export interface AudioContextLike {
  readonly currentTime: number
  readonly sampleRate: number
  readonly state: AudioContextStateLike
  readonly destination: AudioNodeLike
  resume(): Promise<void>
  close(): Promise<void>
  createGain(): GainNodeLike
  createOscillator(): OscillatorNodeLike
  createBiquadFilter(): BiquadFilterNodeLike
  createBuffer(numberOfChannels: number, length: number, sampleRate: number): AudioBufferLike
  createBufferSource(): AudioBufferSourceNodeLike
}

/** The browser's context, or null where the API is missing or refuses. */
export function createBrowserAudioContext(): AudioContextLike | null {
  if (typeof AudioContext === 'undefined') {
    return null
  }
  try {
    return new AudioContext()
  } catch {
    return null
  }
}
