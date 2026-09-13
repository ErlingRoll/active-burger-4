import { audioSystem } from './AudioSystem'
import { SOUND_CUES, type SoundCueId } from './SoundCues'
import {
  createSoundEffectPlayer,
  type PlayOptions,
  type SoundEffectPlayer,
} from './SoundEffectPlayer'

/**
 * The one sound effect player the app uses, wired to the saved audio settings
 * so every cue follows the Effects and Master sliders and the mute toggle.
 *
 * Browsers only let audio start from a user gesture, so the context is
 * unlocked on the first pointer or key press, the same way the music resumes.
 * A finger grants the gesture on `pointerup` rather than `pointerdown`, so
 * both are listened to; the unlock is idempotent.
 */
export const soundEffects: SoundEffectPlayer<SoundCueId> = createSoundEffectPlayer({
  cues: SOUND_CUES,
  settings: audioSystem,
})

export function playSound(cueId: SoundCueId, options?: PlayOptions): boolean {
  return soundEffects.play(cueId, options)
}

if (typeof window !== 'undefined') {
  const unlock = (): void => {
    soundEffects.unlock()
  }
  for (const type of ['pointerdown', 'pointerup', 'keydown'] as const) {
    window.addEventListener(type, unlock, { passive: true })
  }
}
