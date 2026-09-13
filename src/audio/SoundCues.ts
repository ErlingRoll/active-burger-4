import type { BossSkillId } from '../content/bosses/Bosses'
import type { Rarity } from '../content/rarity/Rarity'
import type { SkillId } from '../content/skills/Skills'
import type { HitVisualElement } from '../game/state/GameState'
import { CUE_PRIORITY, type SoundCueDefinition } from './SoundCueTypes'
import {
  arpeggio,
  layer,
  noise,
  tone,
  type CueRenderer,
} from './SynthPrimitives'

/**
 * Every sound effect in the game, synthesized.
 *
 * The palette is deliberately retro: square, triangle and sawtooth waves,
 * fast pitch sweeps and band-passed noise, most of it over in a tenth of a
 * second. It matches the drawn-by-code look of the world, and it means no
 * audio files have to be authored, downloaded, or kept in sync with the code.
 *
 * Levels follow the brief's mix order: the player being hurt sits on top,
 * then boss warnings and the menus, then the player's own defences, rewards,
 * and finally routine combat, which is also where the aggregation in the
 * director thins the herd.
 */

const { routine, reward, defensive, attention, danger } = CUE_PRIORITY

// Shared builders. Frequencies are hertz, durations seconds.

function blip(frequency: number, endFrequency: number, duration = 0.06, wave: OscillatorType = 'square'): CueRenderer {
  return tone({ wave, frequency, endFrequency, duration, attack: 0.003, release: 0.04 })
}

function twoTone(first: number, second: number, noteDuration = 0.07, wave: OscillatorType = 'square'): CueRenderer {
  return arpeggio({ wave, frequencies: [first, second], noteDuration, gap: 0.01, release: 0.06 })
}

function thump(frequency: number, endFrequency: number, duration: number, noiseCutoff = 1200): CueRenderer {
  return layer(
    tone({
      wave: 'square',
      frequency,
      endFrequency,
      duration,
      release: 0.06,
      filter: { type: 'lowpass', frequency: 900 },
    }),
    noise({
      duration: duration * 0.6,
      release: 0.05,
      gain: 0.5,
      filter: { type: 'lowpass', frequency: noiseCutoff, endFrequency: 200 },
    }),
  )
}

function shimmer(duration: number, delay = 0, gain = 0.25): CueRenderer {
  return noise({
    duration,
    delay,
    attack: 0.05,
    release: 0.2,
    gain,
    filter: { type: 'highpass', frequency: 5000 },
  })
}

// Skill cast families. Each family is one recipe, and each skill picks a base
// frequency inside it, so the casts share a character but stay tellable apart.

function swingCast(base: number): CueRenderer {
  return layer(
    noise({
      duration: 0.18,
      release: 0.08,
      filter: { type: 'bandpass', frequency: base, endFrequency: base * 3, q: 1.2 },
    }),
    tone({ wave: 'triangle', frequency: base / 2, endFrequency: base, duration: 0.15, gain: 0.4 }),
  )
}

function zapCast(base: number): CueRenderer {
  return layer(
    tone({ wave: 'square', frequency: base * 3, endFrequency: base, duration: 0.09, release: 0.05 }),
    noise({ duration: 0.06, gain: 0.5, filter: { type: 'highpass', frequency: 2500 } }),
  )
}

function warmCast(base: number): CueRenderer {
  return arpeggio({
    wave: 'triangle',
    frequencies: [base, base * 1.25, base * 1.5],
    noteDuration: 0.07,
    gap: 0.005,
    release: 0.1,
  })
}

function darkCast(base: number): CueRenderer {
  return layer(
    tone({
      wave: 'sawtooth',
      frequency: base,
      endFrequency: base / 2,
      duration: 0.28,
      release: 0.15,
      filter: { type: 'lowpass', frequency: base * 8, endFrequency: base * 2, q: 3 },
    }),
    tone({ wave: 'sine', frequency: base / 2, duration: 0.3, gain: 0.5 }),
  )
}

function fireCast(base: number): CueRenderer {
  return layer(
    noise({
      duration: 0.22,
      release: 0.1,
      gain: 0.8,
      filter: { type: 'bandpass', frequency: base * 4, q: 0.8 },
    }),
    tone({
      wave: 'sawtooth',
      frequency: base,
      endFrequency: base * 1.6,
      duration: 0.18,
      gain: 0.5,
      filter: { type: 'lowpass', frequency: 1500 },
    }),
  )
}

function iceCast(base: number): CueRenderer {
  return layer(
    tone({ wave: 'triangle', frequency: base, endFrequency: base * 2, duration: 0.14, release: 0.15 }),
    tone({ wave: 'sine', frequency: base * 3, duration: 0.1, delay: 0.04, gain: 0.4 }),
    noise({ duration: 0.08, gain: 0.35, filter: { type: 'highpass', frequency: 4000 } }),
  )
}

function cast(render: CueRenderer, gain = 0.45): SoundCueDefinition {
  return { priority: routine, gain, cooldownMs: 0, pitchJitter: 0.5, render }
}

function reveal(frequencies: readonly number[], noteDuration: number, wave: OscillatorType, extra?: CueRenderer): SoundCueDefinition {
  const notes = arpeggio({ wave, frequencies, noteDuration, gap: 0.01, release: 0.15 })
  return {
    priority: attention,
    gain: 0.6,
    cooldownMs: 200,
    render: extra ? layer(notes, extra) : notes,
  }
}

export const SOUND_CUES = {
  // Run and phase
  'run-start': {
    priority: attention, gain: 0.7, cooldownMs: 500,
    render: arpeggio({ wave: 'square', frequencies: [330, 440, 660], noteDuration: 0.09, gap: 0.01, release: 0.1 }),
  },
  victory: {
    priority: attention, gain: 0.8, cooldownMs: 1000,
    render: layer(
      arpeggio({ wave: 'square', frequencies: [392, 523, 659, 784], noteDuration: 0.14, gap: 0.02, release: 0.1 }),
      tone({ wave: 'square', frequency: 1046, duration: 0.6, delay: 0.64, release: 0.4, gain: 0.8 }),
      tone({ wave: 'triangle', frequency: 523, duration: 0.6, delay: 0.64, release: 0.4, gain: 0.5 }),
      shimmer(0.8, 0.6),
    ),
  },
  defeat: {
    priority: danger, gain: 0.8, cooldownMs: 1000,
    render: layer(
      tone({ wave: 'sawtooth', frequency: 300, endFrequency: 60, duration: 0.9, release: 0.3, filter: { type: 'lowpass', frequency: 2000, endFrequency: 300 } }),
      noise({ duration: 0.6, release: 0.3, gain: 0.4, filter: { type: 'lowpass', frequency: 600, endFrequency: 100 } }),
    ),
  },
  'floor-depart': {
    priority: attention, gain: 0.6, cooldownMs: 500,
    render: layer(
      noise({ duration: 0.5, release: 0.2, filter: { type: 'bandpass', frequency: 2000, endFrequency: 200, q: 1 } }),
      tone({ wave: 'triangle', frequency: 500, endFrequency: 150, duration: 0.5, release: 0.2, gain: 0.6 }),
    ),
  },
  'floor-arrive': {
    priority: attention, gain: 0.6, cooldownMs: 500,
    render: layer(
      tone({ wave: 'triangle', frequency: 200, endFrequency: 600, duration: 0.35, release: 0.2 }),
      noise({ duration: 0.3, release: 0.2, gain: 0.5, filter: { type: 'bandpass', frequency: 300, endFrequency: 3000, q: 1 } }),
    ),
  },
  pause: { priority: attention, gain: 0.5, cooldownMs: 100, render: twoTone(523, 392) },
  resume: { priority: attention, gain: 0.5, cooldownMs: 100, render: twoTone(392, 523) },
  'stairs-appear': {
    priority: reward, gain: 0.6, cooldownMs: 500,
    render: arpeggio({ wave: 'triangle', frequencies: [660, 880, 1320], noteDuration: 0.1, gap: 0.01, release: 0.2 }),
  },
  'stairs-reached': { priority: reward, gain: 0.5, cooldownMs: 300, render: twoTone(440, 660, 0.08) },

  // The player
  'hurt-physical': { priority: danger, gain: 0.8, cooldownMs: 0, render: thump(180, 60, 0.12) },
  'hurt-fire': {
    priority: danger, gain: 0.8, cooldownMs: 0,
    render: layer(
      tone({ wave: 'sawtooth', frequency: 300, endFrequency: 120, duration: 0.15, release: 0.08 }),
      noise({ duration: 0.15, release: 0.08, gain: 0.7, filter: { type: 'bandpass', frequency: 1200, q: 2 } }),
    ),
  },
  'hurt-cold': {
    priority: danger, gain: 0.8, cooldownMs: 0,
    render: layer(
      tone({ wave: 'triangle', frequency: 900, endFrequency: 400, duration: 0.15, release: 0.1 }),
      noise({ duration: 0.1, gain: 0.4, filter: { type: 'highpass', frequency: 3000 } }),
    ),
  },
  'hurt-lightning': {
    priority: danger, gain: 0.8, cooldownMs: 0,
    render: layer(
      tone({ wave: 'square', frequency: 1200, endFrequency: 90, duration: 0.1, release: 0.06 }),
      noise({ duration: 0.08, gain: 0.6, filter: { type: 'highpass', frequency: 2000 } }),
    ),
  },
  'hurt-chaos': {
    priority: danger, gain: 0.8, cooldownMs: 0,
    render: layer(
      tone({ wave: 'sawtooth', frequency: 200, endFrequency: 380, glide: 'linear', duration: 0.18, release: 0.1 }),
      tone({ wave: 'square', frequency: 205, endFrequency: 95, duration: 0.18, release: 0.1, gain: 0.6 }),
    ),
  },
  'hurt-poison': {
    priority: danger, gain: 0.7, cooldownMs: 0,
    render: layer(
      tone({ wave: 'triangle', frequency: 300, endFrequency: 180, duration: 0.15, release: 0.1 }),
      tone({ wave: 'triangle', frequency: 450, endFrequency: 220, duration: 0.12, delay: 0.05, release: 0.1, gain: 0.6 }),
    ),
  },
  'hurt-dot': {
    priority: defensive, gain: 0.35, cooldownMs: 0,
    render: tone({ wave: 'triangle', frequency: 220, endFrequency: 160, duration: 0.08, release: 0.06 }),
  },
  'danger-low-hp': {
    priority: danger, gain: 0.6, cooldownMs: 0,
    render: layer(
      tone({ wave: 'square', frequency: 110, duration: 0.1, release: 0.05, filter: { type: 'lowpass', frequency: 500 } }),
      tone({ wave: 'square', frequency: 110, duration: 0.1, delay: 0.16, release: 0.05, filter: { type: 'lowpass', frequency: 500 } }),
    ),
  },
  heal: {
    priority: defensive, gain: 0.55, cooldownMs: 0,
    render: arpeggio({ wave: 'triangle', frequencies: [523, 659, 784], noteDuration: 0.08, gap: 0.01, release: 0.12 }),
  },
  'heal-crit': {
    priority: defensive, gain: 0.65, cooldownMs: 0,
    render: layer(
      arpeggio({ wave: 'triangle', frequencies: [523, 659, 784, 1046], noteDuration: 0.08, gap: 0.01, release: 0.15 }),
      shimmer(0.4, 0.2),
    ),
  },
  'shield-gain': {
    priority: defensive, gain: 0.6, cooldownMs: 0,
    render: tone({
      wave: 'square', frequency: 200, endFrequency: 800, duration: 0.25, release: 0.15,
      filter: { type: 'lowpass', frequency: 400, endFrequency: 3000, q: 2 },
    }),
  },
  'shield-absorb': {
    priority: defensive, gain: 0.5, cooldownMs: 0,
    render: layer(
      tone({ wave: 'triangle', frequency: 1200, endFrequency: 900, duration: 0.06, release: 0.08 }),
      tone({ wave: 'sine', frequency: 1800, duration: 0.05, release: 0.1, gain: 0.5 }),
    ),
  },
  'shield-break': {
    priority: defensive, gain: 0.7, cooldownMs: 0,
    render: layer(
      noise({ duration: 0.2, release: 0.15, filter: { type: 'highpass', frequency: 3000 } }),
      tone({ wave: 'triangle', frequency: 1400, endFrequency: 200, duration: 0.25, release: 0.15 }),
    ),
  },

  // Basic attack and routine combat
  'attack-sword': {
    priority: routine, gain: 0.45, cooldownMs: 0, pitchJitter: 1,
    render: noise({ duration: 0.14, release: 0.06, filter: { type: 'lowpass', frequency: 4000, endFrequency: 400, q: 1 } }),
  },
  'attack-bow': {
    priority: routine, gain: 0.45, cooldownMs: 0, pitchJitter: 1,
    render: layer(
      tone({ wave: 'triangle', frequency: 440, endFrequency: 220, duration: 0.08, release: 0.06 }),
      noise({ duration: 0.03, gain: 0.5, filter: { type: 'highpass', frequency: 2000 } }),
    ),
  },
  'attack-wand': { priority: routine, gain: 0.4, cooldownMs: 0, pitchJitter: 1, render: blip(600, 1200) },
  'attack-staff': {
    priority: routine, gain: 0.45, cooldownMs: 0, pitchJitter: 1,
    render: layer(
      tone({ wave: 'sawtooth', frequency: 90, endFrequency: 60, duration: 0.15, release: 0.1, filter: { type: 'lowpass', frequency: 600 } }),
      noise({ duration: 0.12, release: 0.06, gain: 0.5, filter: { type: 'lowpass', frequency: 300 } }),
    ),
  },
  'hit-light': {
    priority: routine, gain: 0.4, cooldownMs: 0, pitchJitter: 1.5,
    render: layer(
      tone({ wave: 'square', frequency: 400, endFrequency: 120, duration: 0.05, release: 0.04 }),
      noise({ duration: 0.03, gain: 0.4 }),
    ),
  },
  'hit-medium': {
    priority: routine, gain: 0.5, cooldownMs: 0, pitchJitter: 1,
    render: layer(
      tone({ wave: 'square', frequency: 300, endFrequency: 80, duration: 0.08, release: 0.05, scaleWithIntensity: true }),
      noise({ duration: 0.05, gain: 0.5, filter: { type: 'lowpass', frequency: 1500 } }),
    ),
  },
  'hit-heavy': {
    priority: routine, gain: 0.65, cooldownMs: 0,
    render: layer(
      tone({ wave: 'square', frequency: 200, endFrequency: 50, duration: 0.14, release: 0.08, scaleWithIntensity: true }),
      noise({ duration: 0.1, release: 0.06, gain: 0.6, filter: { type: 'lowpass', frequency: 800 }, scaleWithIntensity: true }),
    ),
  },
  'hit-boss': {
    priority: routine, gain: 0.6, cooldownMs: 0,
    render: layer(
      thump(150, 40, 0.16, 500),
      tone({ wave: 'sine', frequency: 80, duration: 0.2, release: 0.1, gain: 0.6 }),
    ),
  },
  'crit-accent': {
    priority: reward, gain: 0.55, cooldownMs: 0,
    render: layer(
      blip(1200, 2400, 0.06),
      tone({ wave: 'square', frequency: 1600, duration: 0.05, delay: 0.04, release: 0.08, gain: 0.7 }),
    ),
  },
  'enemy-death': {
    priority: routine, gain: 0.55, cooldownMs: 0, pitchJitter: 2,
    render: layer(
      tone({ wave: 'square', frequency: 300, endFrequency: 50, duration: 0.14, release: 0.08 }),
      noise({ duration: 0.12, release: 0.06, gain: 0.5, filter: { type: 'bandpass', frequency: 600, endFrequency: 150, q: 0.8 } }),
    ),
  },
  'enemy-death-multi': {
    priority: routine, gain: 0.7, cooldownMs: 0,
    render: layer(
      tone({ wave: 'square', frequency: 320, endFrequency: 45, duration: 0.16, release: 0.1 }),
      tone({ wave: 'square', frequency: 280, endFrequency: 40, duration: 0.16, delay: 0.02, release: 0.1, gain: 0.8 }),
      tone({ wave: 'square', frequency: 360, endFrequency: 55, duration: 0.16, delay: 0.04, release: 0.1, gain: 0.8 }),
      noise({ duration: 0.2, release: 0.1, gain: 0.6, filter: { type: 'lowpass', frequency: 1000, endFrequency: 150 } }),
    ),
  },
  'elite-death': {
    priority: reward, gain: 0.65, cooldownMs: 0,
    render: layer(
      arpeggio({ wave: 'square', frequencies: [220, 330, 440, 660], noteDuration: 0.06, gap: 0.005, release: 0.12 }),
      noise({ duration: 0.15, release: 0.1, gain: 0.5, filter: { type: 'lowpass', frequency: 1200, endFrequency: 200 } }),
    ),
  },

  // Bosses and enemy abilities
  'boss-spawn': {
    priority: attention, gain: 0.7, cooldownMs: 0,
    render: layer(
      tone({ wave: 'sawtooth', frequency: 55, duration: 1, attack: 0.4, release: 0.4, filter: { type: 'lowpass', frequency: 300, endFrequency: 1200, q: 2 } }),
      noise({ duration: 0.9, attack: 0.3, release: 0.4, gain: 0.4, filter: { type: 'lowpass', frequency: 200 } }),
    ),
  },
  'boss-telegraph-slam': {
    priority: attention, gain: 0.6, cooldownMs: 0,
    render: layer(
      tone({ wave: 'square', frequency: 110, endFrequency: 220, glide: 'linear', duration: 0.35, release: 0.1, filter: { type: 'lowpass', frequency: 800 } }),
      noise({ duration: 0.3, release: 0.1, gain: 0.5, filter: { type: 'lowpass', frequency: 400 } }),
    ),
  },
  'boss-telegraph-charge': {
    priority: attention, gain: 0.6, cooldownMs: 0,
    render: tone({ wave: 'sawtooth', frequency: 200, endFrequency: 800, duration: 0.3, release: 0.1, filter: { type: 'lowpass', frequency: 2500 } }),
  },
  'boss-telegraph-nova': {
    priority: attention, gain: 0.6, cooldownMs: 0,
    render: layer(
      tone({ wave: 'triangle', frequency: 400, endFrequency: 1600, duration: 0.4, release: 0.15 }),
      tone({ wave: 'square', frequency: 800, endFrequency: 1600, duration: 0.3, delay: 0.1, release: 0.15, gain: 0.5 }),
    ),
  },
  'boss-telegraph-line': {
    priority: attention, gain: 0.6, cooldownMs: 0,
    render: layer(
      blip(600, 900, 0.1),
      tone({ wave: 'square', frequency: 700, endFrequency: 1000, duration: 0.1, delay: 0.12, release: 0.05 }),
      tone({ wave: 'square', frequency: 800, endFrequency: 1100, duration: 0.1, delay: 0.24, release: 0.05 }),
    ),
  },
  'boss-telegraph-meteor': {
    priority: attention, gain: 0.6, cooldownMs: 0,
    render: layer(
      noise({ duration: 0.5, release: 0.1, filter: { type: 'highpass', frequency: 3000, endFrequency: 500 } }),
      tone({ wave: 'triangle', frequency: 1800, endFrequency: 300, duration: 0.5, release: 0.1, gain: 0.6 }),
    ),
  },
  'boss-telegraph-generic': {
    priority: attention, gain: 0.55, cooldownMs: 0,
    render: layer(
      blip(500, 750, 0.15),
      tone({ wave: 'square', frequency: 500, endFrequency: 750, duration: 0.15, delay: 0.18, release: 0.06 }),
    ),
  },
  'boss-impact': {
    priority: attention, gain: 0.8, cooldownMs: 0,
    render: layer(
      noise({ duration: 0.35, release: 0.2, filter: { type: 'lowpass', frequency: 1200, endFrequency: 100 }, scaleWithIntensity: true }),
      tone({ wave: 'square', frequency: 120, endFrequency: 30, duration: 0.3, release: 0.2, scaleWithIntensity: true }),
      tone({ wave: 'sine', frequency: 50, duration: 0.35, release: 0.2, gain: 0.7 }),
    ),
  },
  'boss-death': {
    priority: attention, gain: 0.85, cooldownMs: 0,
    render: layer(
      tone({ wave: 'sawtooth', frequency: 220, endFrequency: 40, duration: 0.9, release: 0.4, filter: { type: 'lowpass', frequency: 2000, endFrequency: 200 } }),
      noise({ duration: 0.8, release: 0.4, gain: 0.5, filter: { type: 'lowpass', frequency: 800, endFrequency: 100 } }),
      arpeggio({ wave: 'square', frequencies: [220, 277, 330, 440], noteDuration: 0.15, gap: 0.02, release: 0.3, delay: 0.5, gain: 0.7 }),
    ),
  },
  'enemy-telegraph': {
    priority: defensive, gain: 0.4, cooldownMs: 0,
    render: layer(
      blip(900, 1100, 0.08),
      tone({ wave: 'square', frequency: 900, endFrequency: 1100, duration: 0.08, delay: 0.1, release: 0.04 }),
    ),
  },
  'enemy-impact': {
    priority: defensive, gain: 0.5, cooldownMs: 0,
    render: layer(
      tone({ wave: 'square', frequency: 250, endFrequency: 70, duration: 0.1, release: 0.06, scaleWithIntensity: true }),
      noise({ duration: 0.08, gain: 0.5, filter: { type: 'lowpass', frequency: 800 } }),
    ),
  },

  // Skill casts, by family
  'cast-basic-attack': cast(blip(600, 1200)),
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
    priority: routine, gain: 0.4, cooldownMs: 0, pitchJitter: 2,
    render: layer(
      blip(1800, 600, 0.04),
      noise({ duration: 0.03, gain: 0.5, filter: { type: 'highpass', frequency: 3000 } }),
    ),
  },
  'mine-detonate': {
    priority: reward, gain: 0.7, cooldownMs: 0,
    render: layer(
      noise({ duration: 0.3, release: 0.15, filter: { type: 'lowpass', frequency: 2000, endFrequency: 150 } }),
      tone({ wave: 'square', frequency: 120, endFrequency: 35, duration: 0.25, release: 0.15 }),
      tone({ wave: 'sine', frequency: 45, duration: 0.3, release: 0.15, gain: 0.7 }),
    ),
  },
  'orb-burst': {
    priority: reward, gain: 0.6, cooldownMs: 0,
    render: layer(
      tone({ wave: 'triangle', frequency: 1600, endFrequency: 400, duration: 0.2, release: 0.15 }),
      noise({ duration: 0.2, release: 0.1, gain: 0.6, filter: { type: 'highpass', frequency: 2500, endFrequency: 800 } }),
      tone({ wave: 'sine', frequency: 2400, duration: 0.08, delay: 0.02, release: 0.15, gain: 0.5 }),
    ),
  },
  'sigil-detonate': {
    priority: reward, gain: 0.7, cooldownMs: 0,
    render: layer(
      tone({ wave: 'sawtooth', frequency: 110, duration: 0.35, release: 0.2, filter: { type: 'lowpass', frequency: 1200, endFrequency: 300 } }),
      tone({ wave: 'sawtooth', frequency: 165, duration: 0.35, release: 0.2, gain: 0.7, filter: { type: 'lowpass', frequency: 1200, endFrequency: 300 } }),
      tone({ wave: 'sawtooth', frequency: 220, duration: 0.35, release: 0.2, gain: 0.5, filter: { type: 'lowpass', frequency: 1200, endFrequency: 300 } }),
      noise({ duration: 0.3, release: 0.15, gain: 0.5, filter: { type: 'lowpass', frequency: 900, endFrequency: 120 } }),
    ),
  },
  'tether-snap': {
    priority: reward, gain: 0.55, cooldownMs: 0,
    render: layer(
      tone({ wave: 'triangle', frequency: 900, endFrequency: 150, duration: 0.08, release: 0.1 }),
      noise({ duration: 0.05, gain: 0.5, filter: { type: 'bandpass', frequency: 1500, q: 1 } }),
    ),
  },
  summon: {
    priority: reward, gain: 0.55, cooldownMs: 0,
    render: layer(
      tone({ wave: 'triangle', frequency: 150, endFrequency: 600, duration: 0.25, release: 0.15, filter: { type: 'lowpass', frequency: 500, endFrequency: 3000 } }),
      tone({ wave: 'sine', frequency: 300, duration: 0.2, delay: 0.1, release: 0.15, gain: 0.5 }),
    ),
  },

  // Status effects
  'status-burn': {
    priority: routine, gain: 0.35, cooldownMs: 0, pitchJitter: 1,
    render: layer(
      noise({ duration: 0.12, release: 0.06, filter: { type: 'bandpass', frequency: 1500, q: 2 } }),
      tone({ wave: 'sawtooth', frequency: 200, endFrequency: 260, duration: 0.1, release: 0.06, gain: 0.3 }),
    ),
  },
  'status-chill': {
    priority: routine, gain: 0.35, cooldownMs: 0, pitchJitter: 1,
    render: layer(
      tone({ wave: 'triangle', frequency: 1400, endFrequency: 1000, duration: 0.1, release: 0.1 }),
      tone({ wave: 'sine', frequency: 2100, duration: 0.05, release: 0.1, gain: 0.5 }),
    ),
  },
  'status-freeze': {
    priority: reward, gain: 0.5, cooldownMs: 0,
    render: layer(
      tone({ wave: 'triangle', frequency: 600, endFrequency: 1800, duration: 0.12, release: 0.15 }),
      noise({ duration: 0.15, release: 0.1, gain: 0.5, filter: { type: 'highpass', frequency: 3500 } }),
      tone({ wave: 'sine', frequency: 2600, duration: 0.1, delay: 0.05, release: 0.2, gain: 0.5 }),
    ),
  },
  'status-shock': {
    priority: routine, gain: 0.35, cooldownMs: 0, pitchJitter: 1.5,
    render: layer(
      blip(2200, 900, 0.05),
      noise({ duration: 0.04, gain: 0.5, filter: { type: 'highpass', frequency: 3000 } }),
    ),
  },
  'status-poison': {
    priority: routine, gain: 0.35, cooldownMs: 0,
    render: layer(
      tone({ wave: 'triangle', frequency: 320, endFrequency: 220, duration: 0.08, release: 0.06 }),
      tone({ wave: 'sine', frequency: 480, endFrequency: 300, duration: 0.08, delay: 0.06, release: 0.06, gain: 0.6 }),
    ),
  },

  // Pickups and progression
  'pickup-xp': { priority: reward, gain: 0.4, cooldownMs: 0, render: tone({ wave: 'square', frequency: 880, endFrequency: 1320, duration: 0.05, attack: 0.003, release: 0.06 }) },
  'pickup-gear': {
    priority: reward, gain: 0.6, cooldownMs: 0,
    render: arpeggio({ wave: 'triangle', frequencies: [660, 880, 1320], noteDuration: 0.07, gap: 0.01, release: 0.15 }),
  },
  'pickup-potion': {
    priority: reward, gain: 0.55, cooldownMs: 0,
    render: layer(
      tone({ wave: 'sine', frequency: 300, endFrequency: 600, duration: 0.09, release: 0.08 }),
      tone({ wave: 'sine', frequency: 500, endFrequency: 900, duration: 0.09, delay: 0.07, release: 0.08 }),
    ),
  },
  'level-up': {
    priority: attention, gain: 0.75, cooldownMs: 500,
    render: layer(
      arpeggio({ wave: 'square', frequencies: [523, 659, 784, 1046], noteDuration: 0.1, gap: 0.01, release: 0.12 }),
      tone({ wave: 'triangle', frequency: 1046, duration: 0.3, delay: 0.44, release: 0.3, gain: 0.8 }),
      shimmer(0.5, 0.3),
    ),
  },
  'choice-open': {
    priority: attention, gain: 0.5, cooldownMs: 200,
    render: layer(
      tone({ wave: 'triangle', frequency: 400, endFrequency: 800, duration: 0.15, release: 0.1 }),
      tone({ wave: 'square', frequency: 800, duration: 0.08, delay: 0.12, release: 0.1, gain: 0.5 }),
    ),
  },
  'choice-select': { priority: attention, gain: 0.6, cooldownMs: 100, render: twoTone(660, 990) },
  'choice-reroll': {
    priority: attention, gain: 0.5, cooldownMs: 100,
    render: layer(
      noise({ duration: 0.15, release: 0.08, filter: { type: 'bandpass', frequency: 1500, endFrequency: 3000, q: 1 } }),
      tone({ wave: 'triangle', frequency: 500, endFrequency: 900, duration: 0.12, release: 0.08, gain: 0.7 }),
    ),
  },
  'choice-skip': { priority: attention, gain: 0.45, cooldownMs: 100, render: blip(500, 300, 0.1) },
  'choice-banish': {
    priority: attention, gain: 0.55, cooldownMs: 100,
    render: layer(
      tone({ wave: 'sawtooth', frequency: 400, endFrequency: 100, duration: 0.2, release: 0.1, filter: { type: 'lowpass', frequency: 1500, endFrequency: 300 } }),
      noise({ duration: 0.1, release: 0.08, gain: 0.5, filter: { type: 'lowpass', frequency: 1000 } }),
    ),
  },

  // Menus and the meta game
  'ui-press': { priority: attention, gain: 0.35, cooldownMs: 40, render: tone({ wave: 'square', frequency: 700, endFrequency: 900, duration: 0.03, attack: 0.002, release: 0.03 }) },
  'ui-confirm': { priority: attention, gain: 0.5, cooldownMs: 80, render: twoTone(600, 900, 0.05) },
  'ui-cancel': { priority: attention, gain: 0.45, cooldownMs: 80, render: twoTone(600, 400, 0.05) },
  'screen-transition': {
    priority: attention, gain: 0.4, cooldownMs: 150,
    render: layer(
      noise({ duration: 0.18, release: 0.1, filter: { type: 'bandpass', frequency: 800, endFrequency: 3000, q: 1 } }),
      tone({ wave: 'triangle', frequency: 300, endFrequency: 600, duration: 0.15, release: 0.1, gain: 0.5 }),
    ),
  },
  'toast-info': { priority: attention, gain: 0.45, cooldownMs: 150, render: twoTone(880, 1100, 0.07, 'triangle') },
  'toast-error': {
    priority: danger, gain: 0.55, cooldownMs: 150,
    render: layer(
      twoTone(300, 220, 0.1),
      noise({ duration: 0.08, gain: 0.4, filter: { type: 'lowpass', frequency: 800 } }),
    ),
  },
  'toast-loot': {
    priority: attention, gain: 0.55, cooldownMs: 150,
    render: arpeggio({ wave: 'triangle', frequencies: [784, 988, 1175], noteDuration: 0.06, gap: 0.01, release: 0.12 }),
  },
  'lootbox-charge': {
    priority: attention, gain: 0.5, cooldownMs: 300,
    render: layer(
      noise({ duration: 1.3, attack: 0.2, release: 0.2, filter: { type: 'bandpass', frequency: 200, endFrequency: 2500, q: 1.5 } }),
      tone({ wave: 'sawtooth', frequency: 60, endFrequency: 240, duration: 1.3, attack: 0.2, release: 0.2, gain: 0.4, filter: { type: 'lowpass', frequency: 400, endFrequency: 2000 } }),
    ),
  },
  'reveal-common': reveal([523], 0.18, 'triangle'),
  'reveal-uncommon': reveal([523, 659], 0.14, 'triangle'),
  'reveal-rare': reveal([523, 659, 784], 0.12, 'square'),
  'reveal-epic': reveal([523, 659, 784, 1046], 0.11, 'square', shimmer(0.5, 0.3)),
  'reveal-legendary': reveal(
    [523, 659, 784, 1046, 1318], 0.1, 'square',
    layer(
      tone({ wave: 'triangle', frequency: 1318, duration: 0.5, delay: 0.55, release: 0.4, gain: 0.8 }),
      shimmer(0.9, 0.3, 0.35),
    ),
  ),
  'fishing-cast': {
    priority: attention, gain: 0.5, cooldownMs: 200,
    render: layer(
      noise({ duration: 0.25, release: 0.1, filter: { type: 'bandpass', frequency: 600, endFrequency: 2500, q: 1 } }),
      tone({ wave: 'triangle', frequency: 300, endFrequency: 700, duration: 0.2, release: 0.1, gain: 0.5 }),
    ),
  },
  'fishing-bite': {
    priority: danger, gain: 0.6, cooldownMs: 200,
    render: arpeggio({ wave: 'square', frequencies: [900, 700, 900], noteDuration: 0.05, gap: 0.02, release: 0.05 }),
  },
  'fishing-catch': {
    priority: attention, gain: 0.65, cooldownMs: 300,
    render: layer(
      arpeggio({ wave: 'triangle', frequencies: [523, 659, 784, 1046], noteDuration: 0.08, gap: 0.01, release: 0.15 }),
      noise({ duration: 0.25, release: 0.15, gain: 0.5, filter: { type: 'bandpass', frequency: 1500, q: 0.7 } }),
    ),
  },
  'shop-buy': {
    priority: attention, gain: 0.55, cooldownMs: 150,
    render: layer(
      twoTone(988, 1318, 0.06, 'triangle'),
      noise({ duration: 0.04, gain: 0.4, filter: { type: 'highpass', frequency: 4000 } }),
    ),
  },
  'shop-sell': {
    priority: attention, gain: 0.55, cooldownMs: 150,
    render: layer(
      twoTone(1318, 988, 0.06, 'triangle'),
      noise({ duration: 0.04, gain: 0.4, filter: { type: 'highpass', frequency: 4000 } }),
    ),
  },
  'essence-spend': {
    priority: attention, gain: 0.5, cooldownMs: 150,
    render: layer(
      twoTone(880, 660, 0.06),
      noise({ duration: 0.05, gain: 0.4, filter: { type: 'highpass', frequency: 4000 } }),
    ),
  },
  'essence-unlock': {
    priority: attention, gain: 0.65, cooldownMs: 300,
    render: layer(
      arpeggio({ wave: 'square', frequencies: [440, 554, 659, 880], noteDuration: 0.09, gap: 0.01, release: 0.12 }),
      tone({ wave: 'triangle', frequency: 880, duration: 0.25, delay: 0.36, release: 0.3, gain: 0.7 }),
    ),
  },
  'purchase-fail': {
    priority: danger, gain: 0.55, cooldownMs: 150,
    render: arpeggio({ wave: 'square', frequencies: [250, 180], noteDuration: 0.12, gap: 0.01, release: 0.08, filter: { type: 'lowpass', frequency: 1200 } }),
  },
  mute: { priority: attention, gain: 0.4, cooldownMs: 100, render: blip(600, 300, 0.08) },
  unmute: { priority: attention, gain: 0.4, cooldownMs: 100, render: blip(300, 600, 0.08) },
  'volume-tick': { priority: attention, gain: 0.4, cooldownMs: 60, render: tone({ wave: 'square', frequency: 800, duration: 0.03, attack: 0.002, release: 0.02 }) },
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
