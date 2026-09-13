import { describe, expect, it } from 'vitest'
import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from './AudioSystem'
import { createSoundEffectPlayer, getEffectsGain, type SettingsSource } from './SoundEffectPlayer'
import type { SoundCueDefinition } from './SoundCueTypes'
import { tone } from './SynthPrimitives'
import { FakeAudioContext } from './testing/FakeAudioContext'

function settingsSource(initial: Partial<AudioSettings> = {}): SettingsSource & {
  update(patch: Partial<AudioSettings>): void
} {
  let settings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS, ...initial }
  const listeners = new Set<() => void>()
  return {
    getSettings: () => settings,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    update(patch) {
      settings = { ...settings, ...patch }
      for (const listener of listeners) {
        listener()
      }
    },
  }
}

const CUES = {
  blip: {
    priority: 0,
    gain: 0.5,
    cooldownMs: 100,
    render: tone({ wave: 'square', frequency: 440, duration: 0.05, release: 0.05 }),
  },
  alarm: {
    priority: 4,
    gain: 1,
    cooldownMs: 0,
    render: tone({ wave: 'sawtooth', frequency: 220, duration: 1, release: 0.1 }),
  },
  jittery: {
    priority: 1,
    gain: 1,
    cooldownMs: 0,
    pitchJitter: 2,
    render: tone({ wave: 'sine', frequency: 440, duration: 0.1 }),
  },
} satisfies Record<string, SoundCueDefinition>

function player(
  overrides: Partial<Parameters<typeof createSoundEffectPlayer<keyof typeof CUES>>[0]> = {},
) {
  const context = new FakeAudioContext()
  const settings = settingsSource()
  let time = 0
  const instance = createSoundEffectPlayer({
    cues: CUES,
    settings,
    createContext: () => context,
    now: () => time,
    random: () => 0.5,
    ...overrides,
  })
  return { instance, context, settings, advance: (ms: number) => { time += ms } }
}

describe('effects gain', () => {
  it('is master times effects, and zero while muted', () => {
    expect(getEffectsGain({ ...DEFAULT_AUDIO_SETTINGS, masterVolume: 0.5, effectsVolume: 0.5 }))
      .toBe(0.25)
    expect(getEffectsGain({ ...DEFAULT_AUDIO_SETTINGS, muted: true })).toBe(0)
    expect(getEffectsGain({ ...DEFAULT_AUDIO_SETTINGS, effectsVolume: 0 })).toBe(0)
    expect(getEffectsGain({ ...DEFAULT_AUDIO_SETTINGS, masterVolume: 0 })).toBe(0)
  })
})

describe('sound effect player', () => {
  it('plays nothing and does not throw without an audio context', () => {
    const { instance } = player({ createContext: () => null })

    expect(instance.play('blip')).toBe(false)
    expect(instance.ready).toBe(false)
  })

  it('builds the master gain from the settings and routes every cue through it', () => {
    const { instance, context } = player({
      settings: settingsSource({ masterVolume: 0.5, effectsVolume: 0.4 }),
    })

    expect(instance.play('blip')).toBe(true)

    const master = context.gains[0]
    expect(master?.gain.value).toBeCloseTo(0.2)
    expect(master?.connections).toEqual([context.destination])
    const voice = context.gains[1]
    expect(voice?.connections).toEqual([master])
    expect(instance.ready).toBe(true)
  })

  it('follows the sliders and the mute toggle while running', () => {
    const { instance, context, settings } = player()
    instance.play('blip')
    const master = context.gains[0]!

    settings.update({ effectsVolume: 0.25 })
    expect(master.gain.events.at(-1)).toMatchObject({ method: 'setTargetAtTime', value: 0.25 })
    expect(instance.effectiveGain).toBe(0.25)

    settings.update({ muted: true })
    expect(master.gain.events.at(-1)).toMatchObject({ method: 'setTargetAtTime', value: 0 })
    expect(instance.effectiveGain).toBe(0)

    settings.update({ muted: false, masterVolume: 0.5 })
    expect(master.gain.events.at(-1)).toMatchObject({ method: 'setTargetAtTime', value: 0.125 })
  })

  it('creates no nodes at all while muted or at zero effects volume', () => {
    const muted = player({ settings: settingsSource({ muted: true }) })
    expect(muted.instance.play('alarm')).toBe(false)
    expect(muted.context.nodeCount).toBe(0)

    const silent = player({ settings: settingsSource({ effectsVolume: 0 }) })
    expect(silent.instance.play('alarm')).toBe(false)
    expect(silent.context.nodeCount).toBe(0)
  })

  it('drops a cue that is still on its cooldown', () => {
    const { instance, advance } = player()

    expect(instance.play('blip')).toBe(true)
    expect(instance.play('blip')).toBe(false)
    advance(99)
    expect(instance.play('blip')).toBe(false)
    advance(1)
    expect(instance.play('blip')).toBe(true)
  })

  it('drops a cue while the context is suspended and plays once it has resumed', async () => {
    const context = new FakeAudioContext('suspended')
    const { instance } = player({ createContext: () => context })

    // play() asks for the resume itself, but the answer arrives later.
    expect(instance.play('blip')).toBe(false)
    expect(context.resumeCalls).toBe(1)
    expect(context.nodeCount).toBe(1) // only the master gain
    expect(instance.ready).toBe(false)

    await Promise.resolve()

    expect(instance.ready).toBe(true)
    expect(instance.play('blip')).toBe(true)
    instance.unlock()
    expect(context.resumeCalls).toBe(1)
  })

  it('caps polyphony, crowding out only lower-priority voices', () => {
    const { instance, context } = player({ maxVoices: 2 })

    expect(instance.play('jittery')).toBe(true)
    expect(instance.play('jittery')).toBe(true)
    // Two priority-1 voices are playing; a routine blip cannot displace them.
    expect(instance.play('blip')).toBe(false)
    // The alarm outranks them and takes a slot.
    expect(instance.play('alarm')).toBe(true)
    const evicted = context.gains[1]
    expect(evicted?.gain.events.at(-1)).toMatchObject({ method: 'setTargetAtTime', value: 0 })
  })

  it('frees slots once voices have finished', () => {
    const { instance, advance } = player({ maxVoices: 1 })

    expect(instance.play('jittery')).toBe(true)
    expect(instance.play('jittery')).toBe(false)
    advance(200)
    expect(instance.play('jittery')).toBe(true)
  })

  it('applies the cue mix level, the per-play gain, and pitch jitter', () => {
    const { instance, context } = player({ random: () => 1 })

    instance.play('jittery', { gain: 0.5, pitch: 12 })

    const oscillator = context.oscillators[0]
    // 440 Hz, up an octave, plus the full +2 semitone jitter.
    expect(oscillator?.frequency.events[0]?.value).toBeCloseTo(440 * 2 ** (14 / 12))
    const voiceEnvelope = context.gains[1]?.gain.events
    expect(context.gains[2]?.gain.events[1]?.value).toBeCloseTo(0.5)
    expect(voiceEnvelope).toEqual([])
  })

  it('closes the context and stops playing once disposed', () => {
    const { instance, context } = player()
    instance.play('blip')

    instance.dispose()

    expect(context.closeCalls).toBe(1)
    expect(instance.play('alarm')).toBe(false)
  })
})
