import { createBrowserAudioContext, type AudioBufferLike, type AudioContextLike, type GainNodeLike } from './AudioContextLike'
import { clampAudioVolume, type AudioSettings } from './AudioSystem'
import type { SoundCueDefinition } from './SoundCueTypes'
import { createNoiseBuffer } from './SynthPrimitives'

/**
 * Plays synthesized cues through one Web Audio context.
 *
 * Every cue runs into a single master gain that follows the audio settings:
 * master volume times effects volume, and zero while muted. That gain is the
 * only thing standing between a cue and the speakers, so the sliders and the
 * mute button cannot be bypassed by any caller.
 */

export interface SettingsSource {
  getSettings(): AudioSettings
  subscribe(listener: () => void): () => void
}

export interface PlayOptions {
  /** Extra semitones on top of the cue's own jitter. */
  pitch?: number
  /** 0..1, how big the moment was. Defaults to 0.5. */
  intensity?: number
  /** Multiplies the cue's mix level for this play only. */
  gain?: number
}

export interface SoundEffectPlayer<Id extends string> {
  /** Starts a cue. False when it was dropped: muted, no context, on cooldown, or crowded out. */
  play(cueId: Id, options?: PlayOptions): boolean
  /**
   * Creates the context on first call and resumes it when the browser has
   * suspended it. Meant to be called from a user gesture; harmless otherwise.
   */
  unlock(): void
  /** True once the context exists and is running, i.e. play() can be heard. */
  readonly ready: boolean
  /** The gain currently applied to every effect. */
  readonly effectiveGain: number
  dispose(): void
}

export interface SoundEffectPlayerDependencies<Id extends string> {
  cues: Readonly<Record<Id, SoundCueDefinition>>
  settings: SettingsSource
  createContext?: () => AudioContextLike | null
  /** Milliseconds, for cooldowns; defaults to performance.now(). */
  now?: () => number
  /** Random 0..1, for pitch jitter; defaults to Math.random. */
  random?: () => number
  maxVoices?: number
}

export const DEFAULT_MAX_VOICES = 16
export const GAIN_RAMP_SECONDS = 0.03
const EVICTION_FADE_SECONDS = 0.005

interface Voice {
  cueId: string
  priority: number
  gain: GainNodeLike
  /** Milliseconds on the `now()` clock. */
  endsAt: number
}

export function getEffectsGain(settings: AudioSettings): number {
  return settings.muted
    ? 0
    : clampAudioVolume(settings.masterVolume * settings.effectsVolume)
}

function defaultNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

export function createSoundEffectPlayer<Id extends string>(
  deps: SoundEffectPlayerDependencies<Id>,
): SoundEffectPlayer<Id> {
  const createContext = deps.createContext ?? createBrowserAudioContext
  const now = deps.now ?? defaultNow
  const random = deps.random ?? Math.random
  const maxVoices = Math.max(1, deps.maxVoices ?? DEFAULT_MAX_VOICES)

  let context: AudioContextLike | null = null
  let masterGain: GainNodeLike | null = null
  let noiseBuffer: AudioBufferLike | null = null
  let effectiveGain = getEffectsGain(deps.settings.getSettings())
  let disposed = false
  const voices: Voice[] = []
  const lastPlayedAt = new Map<string, number>()

  const applySettings = (): void => {
    effectiveGain = getEffectsGain(deps.settings.getSettings())
    if (context && masterGain) {
      const time = context.currentTime
      masterGain.gain.cancelScheduledValues(time)
      masterGain.gain.setTargetAtTime(effectiveGain, time, GAIN_RAMP_SECONDS)
    }
  }
  const unsubscribe = deps.settings.subscribe(applySettings)

  const unlock = (): void => {
    if (disposed) {
      return
    }
    if (!context) {
      context = createContext()
      if (!context) {
        return
      }
      masterGain = context.createGain()
      masterGain.gain.value = effectiveGain
      masterGain.connect(context.destination)
      noiseBuffer = createNoiseBuffer(context)
    }
    if (context.state !== 'running' && context.state !== 'closed') {
      void context.resume().catch(() => undefined)
    }
  }

  const pruneVoices = (): void => {
    const time = now()
    for (let index = voices.length - 1; index >= 0; index -= 1) {
      const voice = voices[index]!
      if (voice.endsAt <= time) {
        voice.gain.disconnect()
        voices.splice(index, 1)
      }
    }
  }

  /** Frees a slot for a cue that outranks the quietest thing playing, or reports there is none. */
  const makeRoom = (priority: number): boolean => {
    pruneVoices()
    if (voices.length < maxVoices) {
      return true
    }
    let quietest = 0
    for (let index = 1; index < voices.length; index += 1) {
      if (voices[index]!.priority < voices[quietest]!.priority) {
        quietest = index
      }
    }
    const victim = voices[quietest]!
    if (victim.priority >= priority || !context) {
      return false
    }
    const time = context.currentTime
    victim.gain.gain.cancelScheduledValues(time)
    victim.gain.gain.setTargetAtTime(0, time, EVICTION_FADE_SECONDS)
    voices.splice(quietest, 1)
    return true
  }

  const play = (cueId: Id, options: PlayOptions = {}): boolean => {
    const cue = deps.cues[cueId]
    if (disposed || !cue || effectiveGain <= 0) {
      return false
    }
    unlock()
    if (!context || !masterGain || !noiseBuffer || context.state !== 'running') {
      return false
    }
    const time = now()
    const last = lastPlayedAt.get(cueId)
    if (last !== undefined && time - last < cue.cooldownMs) {
      return false
    }
    if (!makeRoom(cue.priority)) {
      return false
    }

    const voiceGain = context.createGain()
    voiceGain.gain.value = 1
    voiceGain.connect(masterGain)
    const jitter = cue.pitchJitter ? (random() * 2 - 1) * cue.pitchJitter : 0
    const seconds = cue.render(
      {
        context,
        destination: voiceGain,
        startTime: context.currentTime,
        noiseBuffer,
      },
      {
        gain: clampAudioVolume(cue.gain * (options.gain ?? 1)),
        pitch: (options.pitch ?? 0) + jitter,
        intensity: Math.min(1, Math.max(0, options.intensity ?? 0.5)),
      },
    )
    lastPlayedAt.set(cueId, time)
    voices.push({
      cueId,
      priority: cue.priority,
      gain: voiceGain,
      endsAt: time + Math.max(0, seconds) * 1000,
    })
    return true
  }

  const dispose = (): void => {
    disposed = true
    unsubscribe()
    for (const voice of voices) {
      voice.gain.disconnect()
    }
    voices.length = 0
    if (context) {
      void context.close().catch(() => undefined)
      context = null
      masterGain = null
      noiseBuffer = null
    }
  }

  return {
    play,
    unlock,
    dispose,
    get ready() {
      return context?.state === 'running'
    },
    get effectiveGain() {
      return effectiveGain
    },
  }
}
