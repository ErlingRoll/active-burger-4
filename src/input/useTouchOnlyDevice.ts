import { useEffect, useState } from 'react'

/**
 * Whether a finger is the only pointer this device has.
 *
 * Some controls only make sense where there is a keyboard and a mouse behind
 * them. Free movement is the clear case: it is steered with WASD, so choosing
 * it on a phone leaves the character standing still until a finger is held on
 * the screen, which reads as the game having stopped working. Touch players
 * steer by dragging the arena instead, and that is a temporary takeover rather
 * than a mode, so the mode does not need to be offered at all.
 *
 * This asks what the device has rather than how wide it is. A width would be
 * wrong twice over: a tablet in landscape is as wide as a laptop and still has
 * no keys, and a small window on a desktop has a keyboard the whole time. The
 * pointer queries are feature queries, not the width breakpoints the shell
 * rules out.
 *
 * Both queries are watched because the answer can change while the page is
 * open: a tablet gains a fine pointer the moment a mouse or a stylus is paired.
 */
const COARSE_POINTER = '(any-pointer: coarse)'
const FINE_POINTER = '(any-pointer: fine)'

function readTouchOnly(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia(COARSE_POINTER).matches &&
    !window.matchMedia(FINE_POINTER).matches
}

export function useTouchOnlyDevice(): boolean {
  const [touchOnly, setTouchOnly] = useState(readTouchOnly)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }
    const queries = [
      window.matchMedia(COARSE_POINTER),
      window.matchMedia(FINE_POINTER),
    ]
    const update = (): void => { setTouchOnly(readTouchOnly()) }
    update()
    for (const query of queries) {
      query.addEventListener('change', update)
    }
    return () => {
      for (const query of queries) {
        query.removeEventListener('change', update)
      }
    }
  }, [])

  return touchOnly
}
