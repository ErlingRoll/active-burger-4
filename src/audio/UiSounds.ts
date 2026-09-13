import { useEffect } from 'react'
import { playSound } from './SoundEffects'
import type { SoundCueId } from './SoundCues'

/**
 * Menu sounds.
 *
 * One delegated listener gives every button in the app a press sound. A
 * button whose moment already has a sound of its own (the level-up picks, the
 * pause menu's resume, the mute toggle) opts out with `data-sfx="none"`, and a
 * button can ask for the confirm or cancel variant with `data-sfx="confirm"`
 * or `data-sfx="cancel"`. Hover and focus stay silent on purpose.
 */

export type UiSoundVariant = 'press' | 'confirm' | 'cancel' | 'none'

const UI_VARIANT_CUES: Readonly<Record<Exclude<UiSoundVariant, 'none'>, SoundCueId>> = {
  press: 'ui-press',
  confirm: 'ui-confirm',
  cancel: 'ui-cancel',
}

const BUTTON_SELECTOR = 'button, [role="button"]'

function isUiSoundVariant(value: string | undefined): value is UiSoundVariant {
  return value === 'press' || value === 'confirm' || value === 'cancel' || value === 'none'
}

/** The cue a click on this element should play, if any. */
export function getUiSoundForClick(target: EventTarget | null): SoundCueId | undefined {
  if (!(target instanceof Element)) {
    return undefined
  }
  const button = target.closest(BUTTON_SELECTOR)
  if (!button) {
    return undefined
  }
  if (button instanceof HTMLButtonElement && button.disabled) {
    return undefined
  }
  if (button.getAttribute('aria-disabled') === 'true') {
    return undefined
  }
  const requested = button.getAttribute('data-sfx') ?? undefined
  const variant = isUiSoundVariant(requested) ? requested : 'press'
  return variant === 'none' ? undefined : UI_VARIANT_CUES[variant]
}

export function playUiSound(cueId: SoundCueId): void {
  playSound(cueId)
}

/** Mount once, near the root: every button press in the app gets its click. */
export function useUiButtonSounds(): void {
  useEffect(() => {
    const handleClick = (event: MouseEvent): void => {
      const cueId = getUiSoundForClick(event.target)
      if (cueId) {
        playSound(cueId)
      }
    }
    document.addEventListener('click', handleClick, true)
    return () => {
      document.removeEventListener('click', handleClick, true)
    }
  }, [])
}

let lastVolumeTickAt = 0
const VOLUME_TICK_INTERVAL_MS = 90

/** A short tick at the new level, so a slider can be set by ear. */
export function previewVolumeTick(now = performance.now()): void {
  if (now - lastVolumeTickAt < VOLUME_TICK_INTERVAL_MS) {
    return
  }
  lastVolumeTickAt = now
  playSound('volume-tick')
}
