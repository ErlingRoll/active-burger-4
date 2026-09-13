import { describe, expect, it } from 'vitest'
import { FakeAudioContext } from './testing/FakeAudioContext'
import {
  arpeggio,
  createNoiseBuffer,
  layer,
  noise,
  semitones,
  SILENT_GAIN,
  tone,
  withIntensity,
  type RenderParams,
  type SynthTarget,
} from './SynthPrimitives'

const NEUTRAL: RenderParams = { gain: 1, pitch: 0, intensity: 0.5 }

function target(context = new FakeAudioContext(), startTime = 2): SynthTarget {
  return {
    context,
    destination: context.destination,
    startTime,
    noiseBuffer: createNoiseBuffer(context, 0.01),
  }
}

describe('semitones', () => {
  it('doubles per octave', () => {
    expect(semitones(220, 12)).toBeCloseTo(440)
    expect(semitones(440, -12)).toBeCloseTo(220)
    expect(semitones(440, 0)).toBe(440)
  })
})

describe('tone', () => {
  it('schedules the oscillator, the glide, and the envelope on the start time', () => {
    const context = new FakeAudioContext()
    const seconds = tone({
      wave: 'square',
      frequency: 200,
      endFrequency: 100,
      duration: 0.2,
      attack: 0.01,
      release: 0.1,
      gain: 0.5,
    })(target(context), NEUTRAL)

    const oscillator = context.oscillators[0]
    const gain = context.gains[0]
    expect(oscillator?.type).toBe('square')
    expect(oscillator?.startedAt).toBe(2)
    expect(oscillator?.frequency.events).toEqual([
      { method: 'setValueAtTime', value: 200, time: 2 },
      { method: 'exponentialRampToValueAtTime', value: 100, time: 2.2 },
    ])
    expect(gain?.gain.events).toEqual([
      { method: 'setValueAtTime', value: SILENT_GAIN, time: 2 },
      { method: 'linearRampToValueAtTime', value: 0.5, time: 2.01 },
      { method: 'setValueAtTime', value: 0.5, time: 2.2 },
      { method: 'exponentialRampToValueAtTime', value: SILENT_GAIN, time: expect.closeTo(2.3) },
    ])
    expect(oscillator?.stoppedAt).toBeCloseTo(2.31)
    expect(seconds).toBeCloseTo(0.3)
    expect(gain?.connections).toEqual([context.destination])
  })

  it('shifts the frequency by the pitch parameter and scales by the gain parameter', () => {
    const context = new FakeAudioContext()
    tone({ wave: 'sine', frequency: 440, duration: 0.1 })(
      target(context),
      { gain: 0.25, pitch: 12, intensity: 0 },
    )

    expect(context.oscillators[0]?.frequency.events[0]?.value).toBeCloseTo(880)
    expect(context.gains[0]?.gain.events[1]?.value).toBeCloseTo(0.25)
  })

  it('routes through a filter when one is specified', () => {
    const context = new FakeAudioContext()
    tone({
      wave: 'sawtooth',
      frequency: 100,
      duration: 0.1,
      filter: { type: 'lowpass', frequency: 800, endFrequency: 200, q: 2 },
    })(target(context), NEUTRAL)

    const filter = context.filters[0]
    expect(filter?.type).toBe('lowpass')
    expect(filter?.Q.value).toBe(2)
    expect(context.oscillators[0]?.connections).toEqual([filter])
    expect(filter?.connections).toEqual([context.gains[0]])
  })

  it('halves the level at zero intensity when asked to scale', () => {
    const context = new FakeAudioContext()
    tone({ wave: 'sine', frequency: 100, duration: 0.1, scaleWithIntensity: true })(
      target(context),
      { gain: 1, pitch: 0, intensity: 0 },
    )
    expect(context.gains[0]?.gain.events[1]?.value).toBeCloseTo(0.5)
  })

  it('disconnects its nodes once the oscillator ends', () => {
    const context = new FakeAudioContext()
    tone({ wave: 'sine', frequency: 100, duration: 0.1 })(target(context), NEUTRAL)

    context.oscillators[0]?.end()

    expect(context.oscillators[0]?.disconnected).toBe(true)
    expect(context.gains[0]?.disconnected).toBe(true)
  })
})

describe('noise', () => {
  it('loops the shared buffer and reports its length', () => {
    const context = new FakeAudioContext()
    const synthTarget = target(context)
    const seconds = noise({ duration: 0.3, release: 0.05, filter: { type: 'bandpass', frequency: 1_000 } })(
      synthTarget,
      NEUTRAL,
    )

    const source = context.bufferSources[0]
    expect(source?.buffer).toBe(synthTarget.noiseBuffer)
    expect(source?.loop).toBe(true)
    expect(source?.startedAt).toBe(2)
    expect(seconds).toBeCloseTo(0.35)
    expect(context.filters[0]?.type).toBe('bandpass')
  })
})

describe('layer and arpeggio', () => {
  it('lasts as long as the longest layer', () => {
    const seconds = layer(
      tone({ wave: 'sine', frequency: 100, duration: 0.1, release: 0.05 }),
      noise({ duration: 0.5, release: 0.05 }),
    )(target(), NEUTRAL)

    expect(seconds).toBeCloseTo(0.55)
  })

  it('spaces the notes of an arpeggio by the note length plus the gap', () => {
    const context = new FakeAudioContext()
    arpeggio({ wave: 'triangle', frequencies: [100, 200, 300], noteDuration: 0.1, gap: 0.02 })(
      target(context),
      NEUTRAL,
    )

    expect(context.oscillators.map((oscillator) => oscillator.startedAt)).toEqual([
      2,
      expect.closeTo(2.12),
      expect.closeTo(2.24),
    ])
  })

  it('picks the bigger rendering above the threshold', () => {
    const chosen = withIntensity(() => 1, () => 2, 0.7)
    expect(chosen(target(), { ...NEUTRAL, intensity: 0.5 })).toBe(1)
    expect(chosen(target(), { ...NEUTRAL, intensity: 0.9 })).toBe(2)
  })
})

describe('createNoiseBuffer', () => {
  it('fills one channel with values between -1 and 1', () => {
    const context = new FakeAudioContext()
    const buffer = createNoiseBuffer(context, 0.001)
    const data = buffer.getChannelData(0)
    expect(data.length).toBe(48)
    expect(Array.from(data).every((value) => value >= -1 && value <= 1)).toBe(true)
    expect(new Set(Array.from(data)).size).toBeGreaterThan(1)
  })
})
