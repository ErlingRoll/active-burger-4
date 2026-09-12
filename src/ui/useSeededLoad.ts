import { useState } from 'react'

const UNSEEDED = Symbol('unseeded')

/**
 * Whether a screen's first fetch was already done for it.
 *
 * The navigator runs a screen's loader while the previous page is still
 * showing and hands the result over as `initialData`, so the screen starts
 * ready and must not fetch again on mount. The screen's own fetch effect asks
 * this hook instead of a flag: it answers true for as long as the service the
 * data came from is the one in use, and false if the service is ever
 * replaced, at which point the effect fetches as it always did. Remembering
 * the service identity rather than flipping a flag inside the effect keeps
 * the answer stable across StrictMode's double-run of effects in development.
 */
export function useSeededLoad<TService>(seeded: boolean, service: TService): boolean {
  const [seededService] = useState<TService | typeof UNSEEDED>(() => seeded ? service : UNSEEDED)
  return seededService === service
}
