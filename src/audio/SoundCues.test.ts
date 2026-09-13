import { describe, expect, it } from 'vitest'
import { BOSS_SKILL_DEFINITIONS } from '../content/bosses/Bosses'
import { RARITIES } from '../content/rarity/Rarity'
import { SKILL_DEFINITIONS } from '../game-config/skills'
import {
  BOSS_TELEGRAPH_CUES,
  HURT_CUES,
  LOOT_REVEAL_CUES,
  SKILL_CAST_CUES,
  SOUND_CUE_IDS,
  SOUND_CUES,
} from './SoundCues'
import { createNoiseBuffer } from './SynthPrimitives'
import {
  FakeAudioContext,
  FakeBiquadFilterNode,
  FakeGainNode,
} from './testing/FakeAudioContext'

/** The gain node a source feeds, directly or through its filter. */
function voiceGainOf(source: { connections: readonly unknown[] }): FakeGainNode | undefined {
  const first = source.connections[0]
  if (first instanceof FakeGainNode) {
    return first
  }
  if (first instanceof FakeBiquadFilterNode) {
    const next = first.connections[0]
    return next instanceof FakeGainNode ? next : undefined
  }
  return undefined
}

function peakOf(gain: FakeGainNode | undefined): number {
  return Math.max(0, ...(gain?.gain.events.map((event) => event.value) ?? []).filter(Number.isFinite))
}

describe('sound cue registry', () => {
  it('has a cast cue for every skill', () => {
    for (const skillId of Object.keys(SKILL_DEFINITIONS)) {
      expect(SKILL_CAST_CUES).toHaveProperty(skillId)
    }
  })

  it('has a warning cue for every boss attack', () => {
    for (const skillId of Object.keys(BOSS_SKILL_DEFINITIONS)) {
      expect(BOSS_TELEGRAPH_CUES).toHaveProperty(skillId)
    }
  })

  it('has a reveal cue for every rarity and a hurt cue for every element', () => {
    for (const rarity of RARITIES) {
      expect(LOOT_REVEAL_CUES).toHaveProperty(rarity)
    }
    expect(Object.keys(HURT_CUES).sort()).toEqual(
      ['chaos', 'cold', 'fire', 'lightning', 'physical', 'poison'],
    )
  })

  it('points every table entry at a registered cue', () => {
    const tables = [SKILL_CAST_CUES, HURT_CUES, LOOT_REVEAL_CUES, BOSS_TELEGRAPH_CUES]
    for (const table of tables) {
      for (const cueId of Object.values(table)) {
        expect(SOUND_CUES).toHaveProperty(cueId)
      }
    }
  })

  /*
   * The voice is quiet and rounded, and this is what keeps it so: a square
   * wave or an unfiltered sawtooth would read as an arcade cabinet, a loud
   * noise burst as a crackle, and a cue above half of unity as a shout.
   */
  it.each(SOUND_CUE_IDS)('keeps %s in the clean palette', (cueId) => {
    const context = new FakeAudioContext()
    const cue = SOUND_CUES[cueId]
    expect(cue.gain).toBeLessThanOrEqual(0.5)

    cue.render(
      {
        context,
        destination: context.destination,
        startTime: 1,
        noiseBuffer: createNoiseBuffer(context, 0.01),
      },
      { gain: cue.gain, pitch: 0, intensity: 1 },
    )

    for (const oscillator of context.oscillators) {
      expect(oscillator.type).not.toBe('square')
      if (oscillator.type === 'sawtooth') {
        const filter = oscillator.connections[0]
        expect(filter).toBeInstanceOf(FakeBiquadFilterNode)
        if (filter instanceof FakeBiquadFilterNode) {
          expect(filter.type).toBe('lowpass')
          for (const event of filter.frequency.events) {
            expect(event.value).toBeLessThanOrEqual(1500)
          }
        }
      }
    }
    for (const source of context.bufferSources) {
      expect(source.connections[0]).toBeInstanceOf(FakeBiquadFilterNode)
      expect(peakOf(voiceGainOf(source))).toBeLessThanOrEqual(0.4)
    }
  })

  it.each(SOUND_CUE_IDS)('renders %s on a context without throwing, briefly, and no louder than unity', (cueId) => {
    const context = new FakeAudioContext()
    const cue = SOUND_CUES[cueId]
    expect(cue.gain).toBeGreaterThan(0)
    expect(cue.gain).toBeLessThanOrEqual(1)
    expect(cue.cooldownMs).toBeGreaterThanOrEqual(0)

    const seconds = cue.render(
      {
        context,
        destination: context.destination,
        startTime: 1,
        noiseBuffer: createNoiseBuffer(context, 0.01),
      },
      { gain: cue.gain, pitch: 0, intensity: 1 },
    )

    expect(seconds).toBeGreaterThan(0)
    expect(seconds).toBeLessThanOrEqual(2.5)
    expect(context.nodeCount).toBeGreaterThan(0)
    for (const gain of context.gains) {
      for (const event of gain.gain.events) {
        expect(event.value).toBeLessThanOrEqual(1)
      }
    }
    for (const oscillator of context.oscillators) {
      expect(oscillator.startedAt).toBeGreaterThanOrEqual(1)
      expect(oscillator.stoppedAt).toBeGreaterThan(oscillator.startedAt ?? 0)
    }
  })
})
