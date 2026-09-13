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
 * The voice is quiet and rounded: sine and triangle waves with soft attacks
 * and long tails, overlapping chords rather than sequenced notes, filtered air
 * and short transients rather than raw noise, and pitch that moves gently
 * across a note rather than chirping. A sawtooth appears only behind a
 * lowpass, for low weight. Nothing is louder than half of unity; the player
 * being hurt and a boss winding up sit on top, menus and rewards in the
 * middle, routine combat underneath, where the director also thins the herd.
 * `SoundCues.test.ts` keeps the palette to these rules.
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

/** The UI press: a sine that slides down a little, with a tick on top. */
function tap(hz: number, drop = 2, duration = 0.04, gain = 1): CueRenderer {
  return layer(
    tone({
      wave: 'sine',
      frequency: hz,
      endFrequency: semitones(hz, -drop),
      duration,
      attack: 0.004,
      release: 0.05,
      gain,
    }),
    tick(5000, 0.1 * gain, 0.012),
  )
}

/** A glassy note: a sine and a quieter octave above it, decaying together. */
function ping(hz: number, release = 0.35, gain = 1, delay = 0): CueRenderer {
  return layer(
    tone({ wave: 'sine', frequency: hz, duration: 0.04, attack: 0.01, release, gain, delay }),
    tone({
      wave: 'sine',
      frequency: hz * 2,
      duration: 0.03,
      attack: 0.008,
      release: release * 0.6,
      gain: gain * 0.35,
      delay,
    }),
  )
}

/** Pings stacked into a chord, each a little after the last. */
function pingChord(hzs: readonly number[], release: number, gain = 1, stagger = 0.035): CueRenderer {
  const perNote = gain / Math.sqrt(hzs.length)
  return layer(...hzs.map((hz, index) => ping(hz, release, perNote, index * stagger)))
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

/** Notes that overlap and share a tail, rather than a sequence. */
function chord(hzs: readonly number[], spec: ChordSpec = {}): CueRenderer {
  const {
    wave = 'triangle',
    attack = 0.03,
    duration = 0.12,
    release = 0.4,
    stagger = 0.02,
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

interface SwellSpec {
  attack?: number
  release?: number
  gain?: number
  openFrom?: number
  openTo?: number
  delay?: number
}

/** A slow rise with a lowpass opening as it goes: a warning, a welcome. */
function swell(hz: number, endHz: number, duration: number, spec: SwellSpec = {}): CueRenderer {
  const { attack = 0.25, release = 0.3, gain = 1, openFrom = 400, openTo = 2400, delay = 0 } = spec
  return tone({
    wave: 'triangle',
    frequency: hz,
    endFrequency: endHz,
    duration,
    attack,
    release,
    gain,
    delay,
    filter: { type: 'lowpass', frequency: openFrom, endFrequency: openTo, q: 0.7 },
  })
}

interface ThumpSpec {
  hz?: number
  endHz?: number
  duration?: number
  click?: number
  scale?: boolean
  delay?: number
}

/** An impact: a low sine dropping in pitch, with a soft click at the front. */
function thump(gain = 1, spec: ThumpSpec = {}): CueRenderer {
  const { hz = 110, endHz = 55, duration = 0.14, click = 0.15, scale = true, delay = 0 } = spec
  return layer(
    tone({
      wave: 'sine',
      frequency: hz,
      endFrequency: endHz,
      duration,
      attack: 0.008,
      release: 0.12,
      gain,
      delay,
      scaleWithIntensity: scale,
    }),
    noise({
      duration: 0.03,
      delay,
      attack: 0.002,
      release: 0.03,
      gain: click * gain,
      filter: { type: 'lowpass', frequency: 1200 },
    }),
  )
}

/** Air moving: lowpassed noise sweeping between two cutoffs. */
function air(fromHz: number, toHz: number, duration: number, gain = 1, delay = 0): CueRenderer {
  return noise({
    duration,
    delay,
    attack: Math.min(0.08, duration * 0.3),
    release: Math.max(0.08, duration * 0.4),
    gain,
    filter: { type: 'lowpass', frequency: fromHz, endFrequency: toHz, q: 0.5 },
  })
}

/** Weight under a big impact. */
function sub(duration = 0.3, gain = 0.6, hz = 45, delay = 0): CueRenderer {
  return tone({ wave: 'sine', frequency: hz, duration, attack: 0.01, release: 0.2, gain, delay })
}

/** A soft crackle: bandpassed noise, for fire and burning. */
function crackle(centerHz: number, duration = 0.08, gain = 0.2, delay = 0): CueRenderer {
  return noise({
    duration,
    delay,
    attack: 0.005,
    release: 0.06,
    gain,
    filter: { type: 'bandpass', frequency: centerHz, q: 1.5 },
  })
}

/** A dark pad: a sawtooth kept well below its edge by a closing lowpass. */
function pad(hz: number, duration: number, gain = 1): CueRenderer {
  return tone({
    wave: 'sawtooth',
    frequency: hz,
    endFrequency: hz * 0.75,
    duration,
    attack: 0.05,
    release: 0.25,
    gain,
    filter: { type: 'lowpass', frequency: 900, endFrequency: 300, q: 1 },
  })
}

/** A quiet, very high breath of air behind a reward. */
function shimmer(duration: number, delay = 0, gain = 0.12): CueRenderer {
  return noise({
    duration,
    delay,
    attack: 0.1,
    release: 0.3,
    gain,
    filter: { type: 'highpass', frequency: 6000 },
  })
}

// Skill cast families. Each family is one recipe, and each skill picks a base
// frequency inside it, so the casts share a character but stay tellable apart.

function swingCast(base: number): CueRenderer {
  return layer(
    air(base, base * 3, 0.16, 0.9),
    tone({
      wave: 'sine',
      frequency: base / 2,
      endFrequency: base / 1.6,
      duration: 0.12,
      attack: 0.02,
      release: 0.1,
      gain: 0.35,
    }),
  )
}

function zapCast(base: number): CueRenderer {
  return layer(
    tone({ wave: 'sine', frequency: base * 2, endFrequency: base, duration: 0.07, attack: 0.006, release: 0.08 }),
    tick(3500, 0.1, 0.02),
  )
}

function warmCast(base: number): CueRenderer {
  return chord([base, base * 1.25, base * 1.5], { attack: 0.04, duration: 0.12, release: 0.35 })
}

function darkCast(base: number): CueRenderer {
  return layer(pad(base, 0.35, 0.6), sub(0.35, 0.4, base / 2))
}

function fireCast(base: number): CueRenderer {
  return layer(
    crackle(base * 4, 0.16, 0.7),
    tone({
      wave: 'sine',
      frequency: base,
      endFrequency: base * 1.5,
      duration: 0.16,
      attack: 0.02,
      release: 0.12,
      gain: 0.5,
    }),
  )
}

function iceCast(base: number): CueRenderer {
  return layer(ping(base, 0.3), tick(4500, 0.1, 0.02))
}

function cast(render: CueRenderer, gain = 0.24): SoundCueDefinition {
  return { priority: routine, gain, cooldownMs: 0, pitchJitter: 0.5, render }
}

function reveal(hzs: readonly number[], release: number, extra?: CueRenderer): SoundCueDefinition {
  const notes = pingChord(hzs, release)
  return {
    priority: attention,
    gain: 0.34,
    cooldownMs: 200,
    render: extra ? layer(notes, extra) : notes,
  }
}

const confirmPair = (): CueRenderer => layer(ping(660, 0.3), ping(990, 0.35, 0.9, 0.04))

export const SOUND_CUES = {
  // Run and phase
  'run-start': {
    priority: attention, gain: 0.4, cooldownMs: 500,
    render: layer(
      chord([262, 392, 523], { attack: 0.06, duration: 0.25, release: 0.5 }),
      ping(1046, 0.5, 0.5, 0.12),
    ),
  },
  victory: {
    priority: attention, gain: 0.5, cooldownMs: 1000,
    render: layer(
      chord([392, 494, 587, 784], { attack: 0.2, duration: 0.9, release: 0.6, stagger: 0.05 }),
      ping(1568, 0.8, 0.6, 0.6),
      shimmer(0.9, 0.5),
    ),
  },
  defeat: {
    priority: danger, gain: 0.5, cooldownMs: 1000,
    render: layer(
      tone({
        wave: 'triangle', frequency: 220, endFrequency: 110, duration: 1.2, attack: 0.05, release: 0.4,
        filter: { type: 'lowpass', frequency: 1800, endFrequency: 250, q: 0.7 },
      }),
      sub(1, 0.5, 40),
    ),
  },
  'floor-depart': {
    priority: attention, gain: 0.4, cooldownMs: 500,
    render: layer(
      air(2400, 300, 0.5, 0.9),
      tone({
        wave: 'triangle', frequency: 440, endFrequency: 220, duration: 0.5, attack: 0.03, release: 0.25, gain: 0.5,
        filter: { type: 'lowpass', frequency: 1500, endFrequency: 400 },
      }),
    ),
  },
  'floor-arrive': {
    priority: attention, gain: 0.4, cooldownMs: 500,
    render: layer(
      air(300, 2400, 0.4, 0.9),
      tone({ wave: 'triangle', frequency: 220, endFrequency: 440, duration: 0.4, attack: 0.03, release: 0.3, gain: 0.5 }),
    ),
  },
  pause: { priority: attention, gain: 0.3, cooldownMs: 100, render: layer(ping(660, 0.3), ping(494, 0.35, 1, 0.09)) },
  resume: { priority: attention, gain: 0.3, cooldownMs: 100, render: layer(ping(494, 0.3), ping(660, 0.35, 1, 0.09)) },
  'stairs-appear': { priority: reward, gain: 0.34, cooldownMs: 500, render: pingChord([660, 990, 1320], 0.5) },
  'stairs-reached': { priority: reward, gain: 0.3, cooldownMs: 300, render: ping(880, 0.4) },

  // The player
  'hurt-physical': {
    priority: danger, gain: 0.45, cooldownMs: 0,
    render: layer(thump(1, { scale: false }), tick(2500, 0.1, 0.02)),
  },
  'hurt-fire': {
    priority: danger, gain: 0.45, cooldownMs: 0,
    render: layer(thump(1, { scale: false }), crackle(900, 0.08, 0.25)),
  },
  'hurt-cold': {
    priority: danger, gain: 0.45, cooldownMs: 0,
    render: layer(thump(0.9, { scale: false }), tick(4000, 0.18, 0.03), ping(1760, 0.2, 0.3)),
  },
  'hurt-lightning': {
    priority: danger, gain: 0.45, cooldownMs: 0,
    render: layer(thump(0.9, { scale: false }), tick(3000, 0.22, 0.04)),
  },
  'hurt-chaos': {
    priority: danger, gain: 0.45, cooldownMs: 0,
    render: layer(
      thump(0.9, { scale: false }),
      tone({ wave: 'triangle', frequency: 200, duration: 0.14, attack: 0.01, release: 0.12, gain: 0.3, detune: -8 }),
      tone({ wave: 'triangle', frequency: 200, duration: 0.14, attack: 0.01, release: 0.12, gain: 0.3, detune: 8 }),
    ),
  },
  'hurt-poison': {
    priority: danger, gain: 0.42, cooldownMs: 0,
    render: layer(
      thump(0.8, { scale: false }),
      tone({ wave: 'triangle', frequency: 300, endFrequency: 260, duration: 0.12, attack: 0.02, release: 0.1, gain: 0.4 }),
    ),
  },
  'hurt-dot': {
    priority: defensive, gain: 0.2, cooldownMs: 0,
    render: tone({ wave: 'sine', frequency: 160, endFrequency: 120, duration: 0.06, attack: 0.006, release: 0.06 }),
  },
  'danger-low-hp': {
    priority: danger, gain: 0.35, cooldownMs: 0,
    render: layer(
      tone({ wave: 'sine', frequency: 70, duration: 0.1, attack: 0.01, release: 0.1 }),
      tone({ wave: 'sine', frequency: 70, duration: 0.1, attack: 0.01, release: 0.1, delay: 0.18, gain: 0.8 }),
    ),
  },
  heal: {
    priority: defensive, gain: 0.32, cooldownMs: 0,
    render: chord([523, 659], { attack: 0.04, duration: 0.15, release: 0.4 }),
  },
  'heal-crit': {
    priority: defensive, gain: 0.36, cooldownMs: 0,
    render: layer(
      chord([523, 659, 784], { attack: 0.04, duration: 0.18, release: 0.45 }),
      ping(1568, 0.5, 0.5, 0.1),
    ),
  },
  'shield-gain': {
    priority: defensive, gain: 0.32, cooldownMs: 0,
    render: layer(
      ping(660, 0.4),
      ping(990, 0.45, 0.8, 0.06),
      swell(330, 660, 0.25, { attack: 0.08, release: 0.25, gain: 0.4 }),
    ),
  },
  'shield-absorb': { priority: defensive, gain: 0.3, cooldownMs: 0, render: ping(1320, 0.18) },
  'shield-break': {
    priority: defensive, gain: 0.4, cooldownMs: 0,
    render: layer(
      tick(4000, 0.2, 0.04),
      tone({ wave: 'sine', frequency: 1320, endFrequency: 440, duration: 0.22, attack: 0.008, release: 0.2 }),
    ),
  },

  // Basic attack and routine combat
  'attack-sword': { priority: routine, gain: 0.25, cooldownMs: 0, pitchJitter: 1, render: air(900, 1800, 0.12) },
  'attack-bow': {
    priority: routine, gain: 0.25, cooldownMs: 0, pitchJitter: 1,
    render: layer(
      tone({ wave: 'sine', frequency: 330, endFrequency: 300, duration: 0.09, attack: 0.004, release: 0.08 }),
      tick(3000, 0.12, 0.015),
    ),
  },
  'attack-wand': { priority: routine, gain: 0.22, cooldownMs: 0, pitchJitter: 1, render: ping(880, 0.15) },
  'attack-staff': {
    priority: routine, gain: 0.25, cooldownMs: 0, pitchJitter: 1,
    render: tone({ wave: 'sine', frequency: 80, duration: 0.12, attack: 0.01, release: 0.12 }),
  },
  'hit-light': { priority: routine, gain: 0.18, cooldownMs: 0, pitchJitter: 1.5, render: thump(1, { hz: 120, endHz: 70, duration: 0.09 }) },
  'hit-medium': { priority: routine, gain: 0.24, cooldownMs: 0, pitchJitter: 1, render: thump(1, { duration: 0.11 }) },
  'hit-heavy': { priority: routine, gain: 0.32, cooldownMs: 0, render: thump(1, { hz: 100, endHz: 50, duration: 0.14, click: 0.2 }) },
  'hit-boss': {
    priority: routine, gain: 0.3, cooldownMs: 0,
    render: layer(thump(1, { hz: 90, endHz: 45, duration: 0.16 }), sub(0.25, 0.5)),
  },
  'crit-accent': { priority: reward, gain: 0.3, cooldownMs: 0, render: ping(1760, 0.2) },
  'enemy-death': {
    priority: routine, gain: 0.28, cooldownMs: 0, pitchJitter: 2,
    render: layer(
      thump(1, { hz: 130, endHz: 60, duration: 0.12, scale: false }),
      noise({ duration: 0.1, attack: 0.01, release: 0.1, gain: 0.25, filter: { type: 'lowpass', frequency: 900, endFrequency: 200 } }),
    ),
  },
  'enemy-death-multi': {
    priority: routine, gain: 0.36, cooldownMs: 0,
    render: layer(
      thump(1, { hz: 130, endHz: 55, duration: 0.14, scale: false }),
      thump(0.8, { hz: 115, endHz: 50, duration: 0.14, scale: false, delay: 0.02 }),
      thump(0.7, { hz: 145, endHz: 60, duration: 0.14, scale: false, delay: 0.04 }),
      noise({ duration: 0.18, attack: 0.01, release: 0.15, gain: 0.3, filter: { type: 'lowpass', frequency: 1000, endFrequency: 150 } }),
    ),
  },
  'elite-death': { priority: reward, gain: 0.34, cooldownMs: 0, render: pingChord([660, 990, 1320], 0.45) },

  // Bosses and enemy abilities
  'boss-spawn': {
    priority: attention, gain: 0.35, cooldownMs: 0,
    render: layer(
      tone({
        wave: 'sawtooth', frequency: 55, duration: 1.2, attack: 0.5, release: 0.5,
        filter: { type: 'lowpass', frequency: 200, endFrequency: 900, q: 1 },
      }),
      sub(1, 0.5, 40),
    ),
  },
  'boss-telegraph-slam': {
    priority: attention, gain: 0.4, cooldownMs: 0,
    render: swell(80, 160, 0.4, { attack: 0.15, openFrom: 200, openTo: 900 }),
  },
  'boss-telegraph-charge': {
    priority: attention, gain: 0.4, cooldownMs: 0,
    render: swell(220, 440, 0.35, { attack: 0.1, openFrom: 500, openTo: 2000 }),
  },
  'boss-telegraph-nova': {
    priority: attention, gain: 0.4, cooldownMs: 0,
    render: layer(
      swell(330, 660, 0.4, { attack: 0.12, openFrom: 600, openTo: 2500 }),
      ping(1320, 0.3, 0.5, 0.3),
    ),
  },
  'boss-telegraph-line': {
    priority: attention, gain: 0.4, cooldownMs: 0,
    render: layer(ping(660, 0.2), ping(784, 0.2, 1, 0.12), ping(880, 0.25, 1, 0.24)),
  },
  'boss-telegraph-meteor': {
    priority: attention, gain: 0.4, cooldownMs: 0,
    render: layer(
      tone({ wave: 'sine', frequency: 1200, endFrequency: 300, duration: 0.5, attack: 0.03, release: 0.15 }),
      air(3000, 400, 0.5, 0.8),
    ),
  },
  'boss-telegraph-generic': {
    priority: attention, gain: 0.36, cooldownMs: 0,
    render: layer(ping(523, 0.25), ping(659, 0.3, 1, 0.16)),
  },
  'boss-impact': {
    priority: attention, gain: 0.45, cooldownMs: 0,
    render: layer(
      sub(0.35, 0.8),
      thump(0.9, { hz: 100, endHz: 40, duration: 0.25, click: 0.2 }),
      noise({ duration: 0.3, attack: 0.005, release: 0.2, gain: 0.35, filter: { type: 'lowpass', frequency: 1000, endFrequency: 100 } }),
    ),
  },
  'boss-death': {
    priority: attention, gain: 0.5, cooldownMs: 0,
    render: layer(
      tone({
        wave: 'triangle', frequency: 220, endFrequency: 55, duration: 1, attack: 0.03, release: 0.4,
        filter: { type: 'lowpass', frequency: 1500, endFrequency: 200 },
      }),
      chord([262, 330, 392, 523], { attack: 0.15, duration: 0.5, release: 0.7, delay: 0.6, stagger: 0.05, gain: 0.7 }),
    ),
  },
  'enemy-telegraph': { priority: defensive, gain: 0.26, cooldownMs: 0, render: ping(784, 0.2) },
  'enemy-impact': { priority: defensive, gain: 0.3, cooldownMs: 0, render: thump(1, { duration: 0.12 }) },

  // Skill casts, by family
  'cast-basic-attack': cast(ping(880, 0.15)),
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
    render: tone({ wave: 'sine', frequency: 1500, endFrequency: 1200, duration: 0.04, attack: 0.004, release: 0.05 }),
  },
  'mine-detonate': {
    priority: reward, gain: 0.4, cooldownMs: 0,
    render: layer(
      sub(0.3, 0.8),
      thump(0.8, { hz: 110, endHz: 40, duration: 0.2, scale: false }),
      noise({ duration: 0.25, attack: 0.005, release: 0.15, gain: 0.3, filter: { type: 'lowpass', frequency: 1500, endFrequency: 120 } }),
    ),
  },
  'orb-burst': {
    priority: reward, gain: 0.34, cooldownMs: 0,
    render: layer(
      tick(3500, 0.22, 0.06),
      tone({ wave: 'sine', frequency: 1600, endFrequency: 800, duration: 0.18, attack: 0.005, release: 0.2, gain: 0.7 }),
      ping(2400, 0.25, 0.4, 0.02),
    ),
  },
  'sigil-detonate': {
    priority: reward, gain: 0.4, cooldownMs: 0,
    render: layer(
      chord([110, 165, 220], { attack: 0.02, duration: 0.3, release: 0.3, filter: { type: 'lowpass', frequency: 900, endFrequency: 250 } }),
      sub(0.35, 0.6),
    ),
  },
  'tether-snap': {
    priority: reward, gain: 0.3, cooldownMs: 0,
    render: layer(
      tone({ wave: 'sine', frequency: 880, endFrequency: 440, duration: 0.1, attack: 0.006, release: 0.15 }),
      tick(2500, 0.1, 0.015),
    ),
  },
  summon: {
    priority: reward, gain: 0.32, cooldownMs: 0,
    render: layer(
      swell(160, 480, 0.3, { attack: 0.08, release: 0.25, openFrom: 400, openTo: 2500 }),
      ping(960, 0.3, 0.4, 0.15),
    ),
  },

  // Status effects
  'status-burn': { priority: routine, gain: 0.2, cooldownMs: 0, pitchJitter: 1, render: crackle(1300, 0.08, 1) },
  'status-chill': { priority: routine, gain: 0.2, cooldownMs: 0, pitchJitter: 1, render: ping(1400, 0.15) },
  'status-freeze': { priority: reward, gain: 0.3, cooldownMs: 0, render: layer(ping(1800, 0.3), tick(5000, 0.18, 0.03)) },
  'status-shock': {
    priority: routine, gain: 0.2, cooldownMs: 0, pitchJitter: 1.5,
    render: layer(
      tone({ wave: 'sine', frequency: 1800, endFrequency: 1500, duration: 0.04, attack: 0.004, release: 0.05 }),
      tick(4000, 0.1, 0.012),
    ),
  },
  'status-poison': {
    priority: routine, gain: 0.2, cooldownMs: 0,
    render: tone({ wave: 'triangle', frequency: 330, endFrequency: 300, duration: 0.09, attack: 0.015, release: 0.1 }),
  },

  // Pickups and progression
  'pickup-xp': { priority: reward, gain: 0.26, cooldownMs: 0, render: ping(1046, 0.18) },
  'pickup-gear': { priority: reward, gain: 0.34, cooldownMs: 0, render: pingChord([880, 1320], 0.4) },
  'pickup-potion': {
    priority: reward, gain: 0.3, cooldownMs: 0,
    render: layer(
      tone({ wave: 'sine', frequency: 392, duration: 0.08, attack: 0.01, release: 0.15 }),
      tone({ wave: 'sine', frequency: 523, duration: 0.08, attack: 0.01, release: 0.2, delay: 0.08 }),
    ),
  },
  'level-up': {
    priority: attention, gain: 0.45, cooldownMs: 500,
    render: layer(
      chord([523, 659, 784], { attack: 0.05, duration: 0.35, release: 0.6, stagger: 0.04 }),
      ping(1568, 0.6, 0.6, 0.25),
      shimmer(0.6, 0.3, 0.1),
    ),
  },
  'choice-open': {
    priority: attention, gain: 0.3, cooldownMs: 200,
    render: layer(air(500, 2500, 0.25), ping(1046, 0.4, 0.7, 0.1)),
  },
  'choice-select': { priority: attention, gain: 0.34, cooldownMs: 100, render: confirmPair() },
  'choice-reroll': {
    priority: attention, gain: 0.3, cooldownMs: 100,
    render: layer(air(800, 2600, 0.2), ping(880, 0.3, 0.6, 0.08)),
  },
  'choice-skip': { priority: attention, gain: 0.26, cooldownMs: 100, render: tap(520, 4, 0.06) },
  'choice-banish': {
    priority: attention, gain: 0.32, cooldownMs: 100,
    render: tone({
      wave: 'triangle', frequency: 330, endFrequency: 165, duration: 0.25, attack: 0.02, release: 0.2,
      filter: { type: 'lowpass', frequency: 1500, endFrequency: 300 },
    }),
  },

  // Menus and the meta game
  'ui-press': { priority: attention, gain: 0.22, cooldownMs: 40, render: tap(720) },
  'ui-confirm': { priority: attention, gain: 0.28, cooldownMs: 80, render: confirmPair() },
  'ui-cancel': { priority: attention, gain: 0.26, cooldownMs: 80, render: layer(ping(660, 0.25), ping(550, 0.3, 0.9, 0.06)) },
  'screen-transition': { priority: attention, gain: 0.28, cooldownMs: 150, render: air(600, 2400, 0.35) },
  'toast-info': { priority: attention, gain: 0.26, cooldownMs: 150, render: ping(1046, 0.35) },
  'toast-error': {
    priority: danger, gain: 0.3, cooldownMs: 150,
    render: layer(
      tone({ wave: 'triangle', frequency: 330, duration: 0.1, attack: 0.01, release: 0.15 }),
      tone({ wave: 'triangle', frequency: 262, duration: 0.14, attack: 0.01, release: 0.25, delay: 0.1 }),
    ),
  },
  'toast-loot': { priority: attention, gain: 0.3, cooldownMs: 150, render: pingChord([784, 1175], 0.4) },
  'lootbox-charge': {
    priority: attention, gain: 0.3, cooldownMs: 300,
    render: layer(
      noise({ duration: 1.3, attack: 0.25, release: 0.25, filter: { type: 'lowpass', frequency: 200, endFrequency: 2200, q: 0.5 } }),
      tone({ wave: 'sine', frequency: 55, endFrequency: 110, duration: 1.3, attack: 0.3, release: 0.3, gain: 0.5 }),
    ),
  },
  'reveal-common': reveal([523], 0.5),
  'reveal-uncommon': reveal([523, 784], 0.6),
  'reveal-rare': reveal([523, 659, 784], 0.75),
  'reveal-epic': reveal([523, 659, 784, 1046], 0.9, shimmer(0.6, 0.3, 0.1)),
  'reveal-legendary': reveal(
    [523, 659, 784, 1046, 1318], 1.2,
    layer(ping(2093, 1, 0.5, 0.5), shimmer(1, 0.4)),
  ),
  'fishing-cast': {
    priority: attention, gain: 0.3, cooldownMs: 200,
    render: layer(
      air(500, 2500, 0.3),
      tone({ wave: 'sine', frequency: 330, endFrequency: 660, duration: 0.25, attack: 0.02, release: 0.15, gain: 0.4 }),
    ),
  },
  'fishing-bite': {
    priority: danger, gain: 0.36, cooldownMs: 200,
    render: layer(ping(880, 0.2), ping(660, 0.2, 1, 0.08), ping(880, 0.3, 1, 0.16)),
  },
  'fishing-catch': {
    priority: attention, gain: 0.36, cooldownMs: 300,
    render: layer(
      pingChord([523, 784, 1046], 0.6),
      noise({ duration: 0.25, attack: 0.02, release: 0.2, gain: 0.3, filter: { type: 'bandpass', frequency: 1200, q: 0.7 } }),
    ),
  },
  'shop-buy': {
    priority: attention, gain: 0.3, cooldownMs: 150,
    render: layer(ping(988, 0.3), ping(1318, 0.35, 0.9, 0.05), tick(5000, 0.1, 0.02)),
  },
  'shop-sell': {
    priority: attention, gain: 0.3, cooldownMs: 150,
    render: layer(ping(1318, 0.3), ping(988, 0.35, 0.9, 0.05), tick(5000, 0.1, 0.02)),
  },
  'essence-spend': {
    priority: attention, gain: 0.28, cooldownMs: 150,
    render: layer(ping(880, 0.3), ping(660, 0.3, 0.9, 0.06)),
  },
  'essence-unlock': {
    priority: attention, gain: 0.38, cooldownMs: 300,
    render: layer(
      chord([440, 554, 659, 880], { attack: 0.04, duration: 0.3, release: 0.6, stagger: 0.04 }),
      ping(1760, 0.6, 0.5, 0.3),
    ),
  },
  'purchase-fail': {
    priority: danger, gain: 0.3, cooldownMs: 150,
    render: layer(
      tone({ wave: 'triangle', frequency: 262, duration: 0.12, attack: 0.01, release: 0.15, filter: { type: 'lowpass', frequency: 1200 } }),
      tone({ wave: 'triangle', frequency: 220, duration: 0.16, attack: 0.01, release: 0.25, delay: 0.11, filter: { type: 'lowpass', frequency: 1200 } }),
    ),
  },
  mute: { priority: attention, gain: 0.24, cooldownMs: 100, render: tap(600, 5, 0.07) },
  unmute: {
    priority: attention, gain: 0.24, cooldownMs: 100,
    render: layer(
      tone({ wave: 'sine', frequency: 450, endFrequency: 600, duration: 0.07, attack: 0.004, release: 0.06 }),
      tick(5000, 0.1, 0.012),
    ),
  },
  'volume-tick': { priority: attention, gain: 0.24, cooldownMs: 60, render: tap(880, 1, 0.03) },
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
