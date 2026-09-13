import type { BossSkillId } from '../content/bosses/Bosses'
import type { Rarity } from '../content/rarity/Rarity'
import type { SkillId } from '../content/skills/Skills'
import type { HitVisualElement } from '../game/state/GameState'
import { CUE_PRIORITY, type SoundCueDefinition } from './SoundCueTypes'
import {
  layer,
  noise,
  semitones,
  tone,
  type CueRenderer,
  type FilterSpec,
} from './SynthPrimitives'

/**
 * Every sound effect in the game, synthesized.
 *
 * The voice is tactile: sine and triangle waves with a defined front edge
 * and a short decay, like something tapped or knocked. The workhorse is the
 * knock, a sine that starts high and drops to its body pitch in a few tens
 * of milliseconds with a soft click on the front. Motion is a figure of two
 * or three short notes rather than a sweep, a build-up is an accelerating
 * train of ticks, and noise exists only as a transient a few milliseconds
 * long. Nothing rings past a quarter of a second except a handful of
 * long-form moments (victory, defeat, a boss), and nothing is louder than
 * half of unity. `SoundCues.test.ts` keeps the palette to these rules.
 */

const { routine, reward, defensive, attention, danger } = CUE_PRIORITY

// Builders. Frequencies are hertz, durations seconds, gains relative to the
// cue's own mix level.

/** A very short highpassed transient: the "t" of a tap, glass, a spark. */
function tick(cutoffHz: number, gain = 0.12, duration = 0.02, delay = 0): CueRenderer {
  return noise({
    duration,
    delay,
    attack: 0.002,
    release: 0.02,
    gain,
    filter: { type: 'highpass', frequency: cutoffHz },
  })
}

/** The front edge of a knock or a thump: a dozen milliseconds of lowpassed noise. */
function click(gain = 0.2, delay = 0, cutoffHz = 2500, duration = 0.012): CueRenderer {
  return noise({
    duration,
    delay,
    attack: 0.002,
    release: 0.02,
    gain,
    filter: { type: 'lowpass', frequency: cutoffHz },
  })
}

/** The UI press: a sine that slides down a little, with a tick on top. */
function tap(hz: number, drop = 2, duration = 0.035, gain = 1): CueRenderer {
  return layer(
    tone({
      wave: 'sine',
      frequency: hz,
      endFrequency: semitones(hz, -drop),
      duration,
      attack: 0.003,
      release: 0.04,
      gain,
    }),
    tick(5000, 0.1 * gain, 0.012),
  )
}

interface KnockSpec {
  from?: number
  duration?: number
  release?: number
  click?: number
  gain?: number
  delay?: number
  wave?: 'sine' | 'triangle'
}

/** A "tock": a sine that drops onto its pitch in 25 ms, with a click in front. */
function knock(hz: number, spec: KnockSpec = {}): CueRenderer {
  const {
    from = hz * 2,
    duration = 0.05,
    release = 0.08,
    click: clickGain = 0.2,
    gain = 1,
    delay = 0,
    wave = 'sine',
  } = spec
  return layer(
    tone({
      wave,
      frequency: from,
      endFrequency: hz,
      duration: Math.min(0.025, duration),
      attack: 0.003,
      release: 0.001,
      sustain: 1,
      gain,
      delay,
    }),
    tone({
      wave,
      frequency: hz,
      duration,
      attack: 0.02,
      release,
      gain,
      delay: delay + 0.02,
    }),
    click(clickGain * gain, delay),
  )
}

/** A glassy note: a sine and a quieter octave above it, decaying together. */
function ping(hz: number, release = 0.14, gain = 1, delay = 0): CueRenderer {
  return layer(
    tone({ wave: 'sine', frequency: hz, duration: 0.03, attack: 0.006, release, gain, delay }),
    tone({
      wave: 'sine',
      frequency: hz * 2,
      duration: 0.02,
      attack: 0.005,
      release: Math.min(0.08, release),
      gain: gain * 0.35,
      delay,
    }),
  )
}

/** Knocks stacked into a chord, each a little after the last. */
function knockChord(hzs: readonly number[], release = 0.18, gain = 1, stagger = 0.03): CueRenderer {
  const perNote = gain / Math.sqrt(hzs.length)
  return layer(...hzs.map((hz, index) =>
    knock(hz, { release, gain: perNote, delay: index * stagger, click: index === 0 ? 0.2 : 0.08 }),
  ))
}

interface ChordSpec {
  wave?: 'sine' | 'triangle'
  attack?: number
  duration?: number
  release?: number
  stagger?: number
  gain?: number
  delay?: number
  filter?: FilterSpec
}

/** Notes that overlap and share a short tail. */
function chord(hzs: readonly number[], spec: ChordSpec = {}): CueRenderer {
  const {
    wave = 'triangle',
    attack = 0.015,
    duration = 0.06,
    release = 0.18,
    stagger = 0.012,
    gain = 1,
    delay = 0,
    filter,
  } = spec
  const perNote = gain / Math.sqrt(hzs.length)
  return layer(
    ...hzs.map((hz, index) =>
      tone({
        wave,
        frequency: hz,
        duration,
        attack,
        release,
        gain: perNote,
        delay: delay + index * stagger,
        filter,
      }),
    ),
  )
}

interface FigureSpec {
  noteDuration?: number
  gap?: number
  release?: number
  wave?: 'sine' | 'triangle'
  gain?: number
  delay?: number
}

/** A run of short notes with tight decays: a step up, a step down, a flick. */
function figure(hzs: readonly number[], spec: FigureSpec = {}): CueRenderer {
  const { noteDuration = 0.045, gap = 0.035, release = 0.07, wave = 'sine', gain = 1, delay = 0 } = spec
  return layer(
    ...hzs.map((hz, index) =>
      tone({
        wave,
        frequency: hz,
        duration: noteDuration,
        attack: 0.004,
        release,
        gain,
        delay: delay + index * (noteDuration + gap),
      }),
    ),
  )
}

/** Short ticks that bunch up as they go: a charge, a warning that is nearly due. */
function pulseTrain(hz: number, endHz: number, count: number, spanSeconds: number, gain = 1): CueRenderer {
  const pulses = Math.max(2, count)
  return layer(
    ...Array.from({ length: pulses }, (_, index) => {
      const progress = index / (pulses - 1)
      return tone({
        wave: 'sine',
        frequency: hz + (endHz - hz) * progress,
        duration: 0.03,
        attack: 0.003,
        release: 0.05,
        gain: gain * (0.7 + 0.3 * progress),
        delay: spanSeconds * Math.sqrt(progress),
      })
    }),
  )
}

interface ThumpSpec {
  hz?: number
  endHz?: number
  duration?: number
  click?: number
  scale?: boolean
  delay?: number
}

/** An impact: a low sine dropping onto its pitch in 40 ms, with a click in front. */
function thump(gain = 1, spec: ThumpSpec = {}): CueRenderer {
  const { hz = 110, endHz = 55, duration = 0.09, click: clickGain = 0.25, scale = true, delay = 0 } = spec
  return layer(
    tone({
      wave: 'sine',
      frequency: hz,
      endFrequency: endHz,
      duration: 0.04,
      attack: 0.003,
      release: 0.001,
      gain,
      delay,
      scaleWithIntensity: scale,
    }),
    tone({
      wave: 'sine',
      frequency: endHz,
      duration,
      attack: 0.03,
      release: 0.06,
      gain,
      delay: delay + 0.03,
      scaleWithIntensity: scale,
    }),
    click(clickGain * gain, delay, 2500),
  )
}

/** Weight under a big impact. */
function sub(duration = 0.15, gain = 0.6, hz = 45, delay = 0): CueRenderer {
  return tone({ wave: 'sine', frequency: hz, duration, attack: 0.005, release: 0.1, gain, delay })
}

/** A soft crackle: bandpassed noise, for fire and burning, never past 45 ms. */
function crackle(centerHz: number, gain = 0.2, delay = 0): CueRenderer {
  return noise({
    duration: 0.045,
    delay,
    attack: 0.003,
    release: 0.02,
    gain,
    filter: { type: 'bandpass', frequency: centerHz, q: 1.5 },
  })
}

/** A dark pad: a sawtooth kept well below its edge by a closing lowpass. */
function pad(hz: number, duration = 0.18, gain = 1, attack = 0.02, release = 0.08): CueRenderer {
  return tone({
    wave: 'sawtooth',
    frequency: hz,
    endFrequency: hz * 0.75,
    duration,
    attack,
    release,
    gain,
    filter: { type: 'lowpass', frequency: 900, endFrequency: 300, q: 1 },
  })
}

// Skill cast families. Each family is one recipe, and each skill picks a base
// frequency inside it, so the casts share a character but stay tellable apart.

function swingCast(base: number): CueRenderer {
  return layer(figure([base, base * 1.5], { noteDuration: 0.035, gap: 0.02, release: 0.06 }), click(0.15))
}

function zapCast(base: number): CueRenderer {
  return layer(
    tone({ wave: 'sine', frequency: base * 2, endFrequency: base, duration: 0.05, attack: 0.003, release: 0.06 }),
    tick(3500, 0.1, 0.015),
  )
}

function warmCast(base: number): CueRenderer {
  return chord([base, base * 1.25, base * 1.5])
}

function darkCast(base: number): CueRenderer {
  return layer(pad(base, 0.18, 0.6), sub(0.15, 0.4, base / 2))
}

function fireCast(base: number): CueRenderer {
  return layer(
    crackle(base * 4, 0.7),
    tone({ wave: 'sine', frequency: base, endFrequency: base * 1.5, duration: 0.08, attack: 0.004, release: 0.08, gain: 0.5 }),
  )
}

function iceCast(base: number): CueRenderer {
  return layer(ping(base, 0.12), tick(4500, 0.1, 0.015))
}

function cast(render: CueRenderer, gain = 0.24): SoundCueDefinition {
  return { priority: routine, gain, cooldownMs: 0, pitchJitter: 0.5, render }
}

function reveal(hzs: readonly number[], release: number, extra?: CueRenderer): SoundCueDefinition {
  const notes = knockChord(hzs, release)
  return {
    priority: attention,
    gain: 0.34,
    cooldownMs: 200,
    render: extra ? layer(notes, extra) : notes,
  }
}

const confirmPair = (): CueRenderer => layer(knock(660), knock(990, { delay: 0.04, gain: 0.9 }))

export const SOUND_CUES = {
  // Run and phase
  'run-start': {
    priority: attention, gain: 0.4, cooldownMs: 500,
    render: layer(
      figure([523, 659, 784]),
      chord([523, 784], { duration: 0.1, release: 0.25, delay: 0.24, gain: 0.7 }),
    ),
  },
  victory: {
    priority: attention, gain: 0.5, cooldownMs: 1000,
    render: layer(
      chord([392, 494, 587, 784], { attack: 0.02, duration: 0.35, release: 0.4, stagger: 0.03 }),
      knock(1568, { delay: 0.3, release: 0.25, gain: 0.6 }),
    ),
  },
  defeat: {
    priority: danger, gain: 0.5, cooldownMs: 1000,
    render: layer(
      tone({
        wave: 'triangle', frequency: 220, endFrequency: 110, duration: 0.5, attack: 0.01, release: 0.25,
        filter: { type: 'lowpass', frequency: 1800, endFrequency: 250, q: 0.7 },
      }),
      sub(0.4, 0.5, 40),
    ),
  },
  'floor-depart': { priority: attention, gain: 0.4, cooldownMs: 500, render: figure([784, 587, 392]) },
  'floor-arrive': { priority: attention, gain: 0.4, cooldownMs: 500, render: figure([392, 587, 784]) },
  pause: { priority: attention, gain: 0.3, cooldownMs: 100, render: layer(knock(660), knock(494, { delay: 0.07 })) },
  resume: { priority: attention, gain: 0.3, cooldownMs: 100, render: layer(knock(494), knock(660, { delay: 0.07 })) },
  'stairs-appear': { priority: reward, gain: 0.34, cooldownMs: 500, render: knockChord([660, 990, 1320]) },
  'stairs-reached': { priority: reward, gain: 0.3, cooldownMs: 300, render: knock(880) },

  // The player
  'hurt-physical': {
    priority: danger, gain: 0.45, cooldownMs: 0,
    render: layer(thump(1, { scale: false }), tick(2500, 0.1, 0.015)),
  },
  'hurt-fire': {
    priority: danger, gain: 0.45, cooldownMs: 0,
    render: layer(thump(1, { scale: false }), crackle(900, 0.25)),
  },
  'hurt-cold': {
    priority: danger, gain: 0.45, cooldownMs: 0,
    render: layer(thump(0.9, { scale: false }), tick(4000, 0.18, 0.02), ping(1760, 0.1, 0.3)),
  },
  'hurt-lightning': {
    priority: danger, gain: 0.45, cooldownMs: 0,
    render: layer(thump(0.9, { scale: false }), tick(3000, 0.22, 0.02)),
  },
  'hurt-chaos': {
    priority: danger, gain: 0.45, cooldownMs: 0,
    render: layer(
      thump(0.9, { scale: false }),
      tone({ wave: 'triangle', frequency: 200, duration: 0.08, attack: 0.004, release: 0.08, gain: 0.3, detune: -8 }),
      tone({ wave: 'triangle', frequency: 200, duration: 0.08, attack: 0.004, release: 0.08, gain: 0.3, detune: 8 }),
    ),
  },
  'hurt-poison': {
    priority: danger, gain: 0.42, cooldownMs: 0,
    render: layer(
      thump(0.8, { scale: false }),
      tone({ wave: 'triangle', frequency: 300, endFrequency: 260, duration: 0.07, attack: 0.005, release: 0.07, gain: 0.4 }),
    ),
  },
  'hurt-dot': {
    priority: defensive, gain: 0.2, cooldownMs: 0,
    render: tone({ wave: 'sine', frequency: 160, endFrequency: 120, duration: 0.04, attack: 0.003, release: 0.04 }),
  },
  'danger-low-hp': {
    priority: danger, gain: 0.35, cooldownMs: 0,
    render: layer(
      tone({ wave: 'sine', frequency: 70, duration: 0.08, attack: 0.005, release: 0.06 }),
      tone({ wave: 'sine', frequency: 70, duration: 0.08, attack: 0.005, release: 0.06, delay: 0.16, gain: 0.8 }),
    ),
  },
  heal: { priority: defensive, gain: 0.32, cooldownMs: 0, render: chord([523, 659], { release: 0.2 }) },
  'heal-crit': {
    priority: defensive, gain: 0.36, cooldownMs: 0,
    render: layer(chord([523, 659, 784], { release: 0.2 }), knock(1568, { delay: 0.06, gain: 0.5 })),
  },
  'shield-gain': {
    priority: defensive, gain: 0.32, cooldownMs: 0,
    render: layer(knock(660, { release: 0.12 }), knock(990, { delay: 0.05, gain: 0.8, release: 0.14 })),
  },
  'shield-absorb': { priority: defensive, gain: 0.3, cooldownMs: 0, render: ping(1320, 0.1) },
  'shield-break': {
    priority: defensive, gain: 0.4, cooldownMs: 0,
    render: layer(
      tick(4000, 0.2, 0.02),
      tone({ wave: 'sine', frequency: 1320, endFrequency: 440, duration: 0.12, attack: 0.004, release: 0.08 }),
    ),
  },

  // Basic attack and routine combat
  'attack-sword': {
    priority: routine, gain: 0.25, cooldownMs: 0, pitchJitter: 1,
    render: layer(figure([660, 440], { noteDuration: 0.03, gap: 0.01, release: 0.05 }), click(0.2)),
  },
  'attack-bow': {
    priority: routine, gain: 0.25, cooldownMs: 0, pitchJitter: 1,
    render: layer(
      tone({ wave: 'sine', frequency: 330, endFrequency: 300, duration: 0.06, attack: 0.003, release: 0.06 }),
      tick(3000, 0.12, 0.012),
    ),
  },
  'attack-wand': { priority: routine, gain: 0.22, cooldownMs: 0, pitchJitter: 1, render: knock(880, { release: 0.06 }) },
  'attack-staff': {
    priority: routine, gain: 0.25, cooldownMs: 0, pitchJitter: 1,
    render: layer(tone({ wave: 'sine', frequency: 80, duration: 0.08, attack: 0.004, release: 0.06 }), click(0.2)),
  },
  'hit-light': { priority: routine, gain: 0.18, cooldownMs: 0, pitchJitter: 1.5, render: thump(1, { hz: 120, endHz: 70, duration: 0.06 }) },
  'hit-medium': { priority: routine, gain: 0.24, cooldownMs: 0, pitchJitter: 1, render: thump(1, { duration: 0.08 }) },
  'hit-heavy': { priority: routine, gain: 0.32, cooldownMs: 0, render: thump(1, { hz: 100, endHz: 50, duration: 0.1, click: 0.3 }) },
  'hit-boss': {
    priority: routine, gain: 0.3, cooldownMs: 0,
    render: layer(thump(1, { hz: 90, endHz: 45, duration: 0.11 }), sub(0.12, 0.5)),
  },
  'crit-accent': { priority: reward, gain: 0.3, cooldownMs: 0, render: ping(1760, 0.12) },
  'enemy-death': {
    priority: routine, gain: 0.28, cooldownMs: 0, pitchJitter: 2,
    render: layer(thump(1, { hz: 130, endHz: 60, duration: 0.08, scale: false }), click(0.25, 0.01, 900, 0.04)),
  },
  'enemy-death-multi': {
    priority: routine, gain: 0.36, cooldownMs: 0,
    render: layer(
      thump(1, { hz: 130, endHz: 55, duration: 0.09, scale: false }),
      thump(0.8, { hz: 115, endHz: 50, duration: 0.09, scale: false, delay: 0.02 }),
      thump(0.7, { hz: 145, endHz: 60, duration: 0.09, scale: false, delay: 0.04 }),
      click(0.3, 0.01, 1000, 0.04),
    ),
  },
  'elite-death': { priority: reward, gain: 0.34, cooldownMs: 0, render: knockChord([660, 990, 1320]) },

  // Bosses and enemy abilities
  'boss-spawn': {
    priority: attention, gain: 0.35, cooldownMs: 0,
    render: layer(pad(55, 0.6, 1, 0.15, 0.15), sub(0.5, 0.5, 40)),
  },
  'boss-telegraph-slam': { priority: attention, gain: 0.4, cooldownMs: 0, render: pulseTrain(80, 160, 3, 0.3) },
  'boss-telegraph-charge': { priority: attention, gain: 0.4, cooldownMs: 0, render: pulseTrain(220, 440, 4, 0.3) },
  'boss-telegraph-nova': {
    priority: attention, gain: 0.4, cooldownMs: 0,
    render: layer(figure([330, 494, 660]), knock(1320, { delay: 0.24, gain: 0.5 })),
  },
  'boss-telegraph-line': {
    priority: attention, gain: 0.4, cooldownMs: 0,
    render: layer(knock(660), knock(784, { delay: 0.1 }), knock(880, { delay: 0.2 })),
  },
  'boss-telegraph-meteor': { priority: attention, gain: 0.4, cooldownMs: 0, render: figure([1200, 800, 400]) },
  'boss-telegraph-generic': {
    priority: attention, gain: 0.36, cooldownMs: 0,
    render: layer(knock(523), knock(659, { delay: 0.12 })),
  },
  'boss-impact': {
    priority: attention, gain: 0.45, cooldownMs: 0,
    render: layer(
      sub(0.2, 0.8),
      thump(0.9, { hz: 100, endHz: 40, duration: 0.14, click: 0.3 }),
      click(0.3, 0.005, 1000, 0.04),
    ),
  },
  'boss-death': {
    priority: attention, gain: 0.5, cooldownMs: 0,
    render: layer(
      tone({
        wave: 'triangle', frequency: 220, endFrequency: 55, duration: 0.5, attack: 0.01, release: 0.25,
        filter: { type: 'lowpass', frequency: 1500, endFrequency: 200 },
      }),
      chord([262, 330, 392, 523], { attack: 0.02, duration: 0.15, release: 0.25, delay: 0.35, stagger: 0.03, gain: 0.7 }),
    ),
  },
  'enemy-telegraph': { priority: defensive, gain: 0.26, cooldownMs: 0, render: knock(784, { release: 0.06 }) },
  'enemy-impact': { priority: defensive, gain: 0.3, cooldownMs: 0, render: thump(1, { duration: 0.08 }) },

  // Skill casts, by family
  'cast-basic-attack': cast(knock(880, { release: 0.06 })),
  'cast-whirlwind': cast(swingCast(500)),
  'cast-lancers-charge': cast(swingCast(300)),
  'cast-razorwire': cast(swingCast(1400)),
  'cast-chain-lightning': cast(zapCast(700)),
  'cast-storm-relay': cast(zapCast(500)),
  'cast-prism-halo': cast(zapCast(1000)),
  'cast-critical-spellstrike': cast(zapCast(1300)),
  'cast-vitality': cast(warmCast(523)),
  'cast-rallying-banner': cast(warmCast(392)),
  'cast-aegis-pulse': cast(warmCast(659)),
  'cast-blood-rite': cast(warmCast(294)),
  'cast-raise-skeleton': cast(darkCast(110)),
  'cast-soul-tether': cast(darkCast(165)),
  'cast-sigil-of-ruin': cast(darkCast(82)),
  'cast-gravity-well': cast(darkCast(65)),
  'cast-mirrorcast': cast(darkCast(220)),
  'cast-phantom-arsenal': cast(darkCast(139)),
  'cast-fiery-touch': cast(fireCast(220)),
  'cast-cinder-mine': cast(fireCast(150)),
  'cast-glacial-orb': cast(iceCast(800)),
  'cast-rift-javelin': cast(iceCast(1100)),

  // Skill results
  'chain-jump': {
    priority: routine, gain: 0.22, cooldownMs: 0, pitchJitter: 2,
    render: tone({ wave: 'sine', frequency: 1500, endFrequency: 1200, duration: 0.03, attack: 0.003, release: 0.04 }),
  },
  'mine-detonate': {
    priority: reward, gain: 0.4, cooldownMs: 0,
    render: layer(
      sub(0.18, 0.8),
      thump(0.8, { hz: 110, endHz: 40, duration: 0.12, scale: false, click: 0.3 }),
      click(0.3, 0.005, 1200, 0.04),
    ),
  },
  'orb-burst': {
    priority: reward, gain: 0.34, cooldownMs: 0,
    render: layer(
      tick(3500, 0.22, 0.02),
      tone({ wave: 'sine', frequency: 1600, endFrequency: 800, duration: 0.08, attack: 0.003, release: 0.08, gain: 0.7 }),
      ping(2400, 0.1, 0.4, 0.01),
    ),
  },
  'sigil-detonate': {
    priority: reward, gain: 0.4, cooldownMs: 0,
    render: layer(
      chord([110, 165, 220], { attack: 0.01, duration: 0.12, release: 0.15, filter: { type: 'lowpass', frequency: 900, endFrequency: 250 } }),
      sub(0.18, 0.6),
    ),
  },
  'tether-snap': {
    priority: reward, gain: 0.3, cooldownMs: 0,
    render: layer(
      tone({ wave: 'sine', frequency: 880, endFrequency: 440, duration: 0.06, attack: 0.003, release: 0.08 }),
      tick(2500, 0.1, 0.012),
    ),
  },
  summon: {
    priority: reward, gain: 0.32, cooldownMs: 0,
    render: layer(figure([160, 240, 480]), knock(960, { delay: 0.24, gain: 0.4 })),
  },

  // Status effects
  'status-burn': { priority: routine, gain: 0.2, cooldownMs: 0, pitchJitter: 1, render: crackle(1300, 1) },
  'status-chill': { priority: routine, gain: 0.2, cooldownMs: 0, pitchJitter: 1, render: ping(1400, 0.08) },
  'status-freeze': { priority: reward, gain: 0.3, cooldownMs: 0, render: layer(ping(1800, 0.14), tick(5000, 0.18, 0.02)) },
  'status-shock': {
    priority: routine, gain: 0.2, cooldownMs: 0, pitchJitter: 1.5,
    render: layer(
      tone({ wave: 'sine', frequency: 1800, endFrequency: 1500, duration: 0.03, attack: 0.003, release: 0.04 }),
      tick(4000, 0.1, 0.012),
    ),
  },
  'status-poison': {
    priority: routine, gain: 0.2, cooldownMs: 0,
    render: tone({ wave: 'triangle', frequency: 330, endFrequency: 300, duration: 0.06, attack: 0.005, release: 0.06 }),
  },

  // Pickups and progression
  'pickup-xp': { priority: reward, gain: 0.26, cooldownMs: 0, render: knock(1046, { duration: 0.04, release: 0.08, click: 0.12 }) },
  'pickup-gear': { priority: reward, gain: 0.34, cooldownMs: 0, render: knockChord([880, 1320]) },
  'pickup-potion': { priority: reward, gain: 0.3, cooldownMs: 0, render: figure([392, 523], { release: 0.1 }) },
  'level-up': {
    priority: attention, gain: 0.45, cooldownMs: 500,
    render: layer(
      figure([523, 659, 784]),
      chord([523, 659, 784], { duration: 0.3, release: 0.2, delay: 0.25, gain: 0.7 }),
      knock(1568, { delay: 0.5, release: 0.2, gain: 0.6 }),
    ),
  },
  'choice-open': {
    priority: attention, gain: 0.3, cooldownMs: 200,
    render: layer(figure([523, 1046], { release: 0.1 }), knock(1046, { delay: 0.16, gain: 0.5 })),
  },
  'choice-select': { priority: attention, gain: 0.34, cooldownMs: 100, render: confirmPair() },
  'choice-reroll': {
    priority: attention, gain: 0.3, cooldownMs: 100,
    render: figure([660, 880, 1100], { noteDuration: 0.03, gap: 0.02, release: 0.06 }),
  },
  'choice-skip': { priority: attention, gain: 0.26, cooldownMs: 100, render: tap(520, 4, 0.05) },
  'choice-banish': {
    priority: attention, gain: 0.32, cooldownMs: 100,
    render: tone({
      wave: 'triangle', frequency: 330, endFrequency: 165, duration: 0.15, attack: 0.005, release: 0.1,
      filter: { type: 'lowpass', frequency: 1500, endFrequency: 300 },
    }),
  },

  // Menus and the meta game
  'ui-press': { priority: attention, gain: 0.22, cooldownMs: 40, render: tap(720) },
  'ui-confirm': { priority: attention, gain: 0.28, cooldownMs: 80, render: confirmPair() },
  'ui-cancel': { priority: attention, gain: 0.26, cooldownMs: 80, render: layer(knock(660), knock(550, { delay: 0.05, gain: 0.9 })) },
  'screen-transition': {
    priority: attention, gain: 0.28, cooldownMs: 150,
    render: figure([880, 660], { noteDuration: 0.04, gap: 0.03, release: 0.07 }),
  },
  'toast-info': { priority: attention, gain: 0.26, cooldownMs: 150, render: knock(1046, { release: 0.14 }) },
  'toast-error': {
    priority: danger, gain: 0.3, cooldownMs: 150,
    render: layer(
      tone({ wave: 'triangle', frequency: 330, duration: 0.06, attack: 0.005, release: 0.08 }),
      tone({ wave: 'triangle', frequency: 262, duration: 0.08, attack: 0.005, release: 0.12, delay: 0.08 }),
    ),
  },
  'toast-loot': { priority: attention, gain: 0.3, cooldownMs: 150, render: knockChord([784, 1175]) },
  'lootbox-charge': { priority: attention, gain: 0.3, cooldownMs: 300, render: pulseTrain(220, 880, 12, 1.2) },
  'reveal-common': reveal([523], 0.18),
  'reveal-uncommon': reveal([523, 784], 0.2),
  'reveal-rare': reveal([523, 659, 784], 0.22),
  'reveal-epic': reveal([523, 659, 784, 1046], 0.26),
  'reveal-legendary': reveal([523, 659, 784, 1046, 1318], 0.3, ping(2093, 0.25, 0.5, 0.15)),
  'fishing-cast': {
    priority: attention, gain: 0.3, cooldownMs: 200,
    render: layer(figure([330, 494, 660]), click(0.15)),
  },
  'fishing-bite': {
    priority: danger, gain: 0.36, cooldownMs: 200,
    render: layer(knock(880), knock(660, { delay: 0.08 }), knock(880, { delay: 0.16 })),
  },
  'fishing-catch': {
    priority: attention, gain: 0.36, cooldownMs: 300,
    render: layer(
      knockChord([523, 784, 1046]),
      tone({ wave: 'sine', frequency: 300, endFrequency: 120, duration: 0.05, attack: 0.003, release: 0.06, gain: 0.6 }),
    ),
  },
  'shop-buy': {
    priority: attention, gain: 0.3, cooldownMs: 150,
    render: layer(knock(988), knock(1318, { delay: 0.05, gain: 0.9 }), tick(5000, 0.1, 0.015)),
  },
  'shop-sell': {
    priority: attention, gain: 0.3, cooldownMs: 150,
    render: layer(knock(1318), knock(988, { delay: 0.05, gain: 0.9 }), tick(5000, 0.1, 0.015)),
  },
  'essence-spend': {
    priority: attention, gain: 0.28, cooldownMs: 150,
    render: layer(knock(880), knock(660, { delay: 0.06, gain: 0.9 })),
  },
  'essence-unlock': {
    priority: attention, gain: 0.38, cooldownMs: 300,
    render: layer(
      figure([440, 554, 659]),
      chord([440, 659, 880], { duration: 0.12, release: 0.25, delay: 0.24, gain: 0.7 }),
    ),
  },
  'purchase-fail': {
    priority: danger, gain: 0.3, cooldownMs: 150,
    render: layer(
      tone({ wave: 'triangle', frequency: 262, duration: 0.07, attack: 0.005, release: 0.12, filter: { type: 'lowpass', frequency: 1200 } }),
      tone({ wave: 'triangle', frequency: 220, duration: 0.09, attack: 0.005, release: 0.18, delay: 0.09, filter: { type: 'lowpass', frequency: 1200 } }),
    ),
  },
  mute: { priority: attention, gain: 0.24, cooldownMs: 100, render: knock(400, { from: 600, release: 0.06 }) },
  unmute: { priority: attention, gain: 0.24, cooldownMs: 100, render: figure([450, 600], { noteDuration: 0.03, gap: 0.015, release: 0.05 }) },
  'volume-tick': { priority: attention, gain: 0.24, cooldownMs: 60, render: tap(880, 1, 0.025) },
} satisfies Record<string, SoundCueDefinition>

export type SoundCueId = keyof typeof SOUND_CUES

export const SOUND_CUE_IDS = Object.keys(SOUND_CUES) as readonly SoundCueId[]

export const SKILL_CAST_CUES: Readonly<Record<SkillId, SoundCueId>> = {
  'basic-attack': 'cast-basic-attack',
  whirlwind: 'cast-whirlwind',
  'chain-lightning': 'cast-chain-lightning',
  vitality: 'cast-vitality',
  'raise-skeleton': 'cast-raise-skeleton',
  'fiery-touch': 'cast-fiery-touch',
  'glacial-orb': 'cast-glacial-orb',
  'lancers-charge': 'cast-lancers-charge',
  'rallying-banner': 'cast-rallying-banner',
  'gravity-well': 'cast-gravity-well',
  'aegis-pulse': 'cast-aegis-pulse',
  'rift-javelin': 'cast-rift-javelin',
  'cinder-mine': 'cast-cinder-mine',
  'storm-relay': 'cast-storm-relay',
  'soul-tether': 'cast-soul-tether',
  'phantom-arsenal': 'cast-phantom-arsenal',
  'sigil-of-ruin': 'cast-sigil-of-ruin',
  mirrorcast: 'cast-mirrorcast',
  'critical-spellstrike': 'cast-critical-spellstrike',
  razorwire: 'cast-razorwire',
  'blood-rite': 'cast-blood-rite',
  'prism-halo': 'cast-prism-halo',
}

export const HURT_CUES: Readonly<Record<HitVisualElement, SoundCueId>> = {
  physical: 'hurt-physical',
  fire: 'hurt-fire',
  cold: 'hurt-cold',
  lightning: 'hurt-lightning',
  chaos: 'hurt-chaos',
  poison: 'hurt-poison',
}

export const LOOT_REVEAL_CUES: Readonly<Record<Rarity, SoundCueId>> = {
  common: 'reveal-common',
  uncommon: 'reveal-uncommon',
  rare: 'reveal-rare',
  epic: 'reveal-epic',
  legendary: 'reveal-legendary',
}

/** Each boss attack warns with the family its shape belongs to. */
export const BOSS_TELEGRAPH_CUES: Readonly<Record<BossSkillId, SoundCueId>> = {
  'ground-slam': 'boss-telegraph-slam',
  'grave-spikes': 'boss-telegraph-slam',
  'crushing-field': 'boss-telegraph-slam',
  'pillar-fall': 'boss-telegraph-slam',
  'void-collapse': 'boss-telegraph-slam',
  charge: 'boss-telegraph-charge',
  'ember-dash': 'boss-telegraph-charge',
  'phase-lance': 'boss-telegraph-charge',
  'frost-lance': 'boss-telegraph-charge',
  'arc-strike': 'boss-telegraph-charge',
  'devouring-maw': 'boss-telegraph-charge',
  'fire-nova': 'boss-telegraph-nova',
  'ash-plume': 'boss-telegraph-nova',
  'glacial-ring': 'boss-telegraph-nova',
  'static-ring': 'boss-telegraph-nova',
  'echo-ring': 'boss-telegraph-nova',
  'sundering-wail': 'boss-telegraph-nova',
  'spore-fall': 'boss-telegraph-nova',
  'storm-lattice': 'boss-telegraph-nova',
  'flame-line': 'boss-telegraph-line',
  'sundering-line': 'boss-telegraph-line',
  'stone-sweep': 'boss-telegraph-line',
  'rime-cone': 'boss-telegraph-line',
  cleave: 'boss-telegraph-line',
  'venom-spray': 'boss-telegraph-line',
  rift: 'boss-telegraph-line',
  'meteor-zone': 'boss-telegraph-meteor',
}
