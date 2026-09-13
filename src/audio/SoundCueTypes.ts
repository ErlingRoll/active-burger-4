import type { CueRenderer } from './SynthPrimitives'

/**
 * Who wins when too much happens at once, lowest to highest:
 * routine combat, rewards, the player's own defences, boss telegraphs and
 * menus, and finally the player being in danger.
 */
export type CuePriority = 0 | 1 | 2 | 3 | 4

export const CUE_PRIORITY = {
  routine: 0,
  reward: 1,
  defensive: 2,
  attention: 3,
  danger: 4,
} as const satisfies Record<string, CuePriority>

export interface SoundCueDefinition {
  priority: CuePriority
  /** Mix level, 0..1. */
  gain: number
  /** The same cue is not started again within this many milliseconds. */
  cooldownMs: number
  /** Random pitch offset of up to this many semitones either way, per play. */
  pitchJitter?: number
  render: CueRenderer
}
