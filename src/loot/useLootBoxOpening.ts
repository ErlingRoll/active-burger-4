import { useCallback, useEffect, useRef, useState } from 'react'
import type { LootBoxOpeningResult, LootBoxService } from './LootBoxService'
import type { LootBoxRarity } from './LootBoxes'

export type LootBoxOpeningPhase = 'charging' | 'revealing' | 'failed'

export interface LootBoxOpeningSession {
  readonly boxName: string
  readonly rarity: LootBoxRarity
  readonly phase: LootBoxOpeningPhase
  readonly result: LootBoxOpeningResult | null
  readonly error: string | null
}

/**
 * How long the box is held shut after the server has already answered.
 *
 * The request usually returns in well under a second, and a reward that
 * appears the instant it is asked for is not a reward, it is a form
 * submission. The charge is a floor rather than a fixed length: a slow request
 * simply keeps charging, so the player never sees the animation finish and
 * then wait.
 */
const CHARGE_FLOOR_MS = 1500

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, milliseconds) })
}

export interface LootBoxOpeningRequest {
  boxInstanceId: string
  boxName: string
  rarity: LootBoxRarity
}

export interface LootBoxOpening {
  session: LootBoxOpeningSession | null
  /** True while a box is in flight, so every Open button can be held shut. */
  isOpening: boolean
  openBox: (request: LootBoxOpeningRequest) => Promise<void>
  dismiss: () => void
}

/**
 * The opening, from the click to the moment the player puts the loot away.
 *
 * Kept out of the screens because both the stores and the pond's drawer open
 * boxes, and an opening that behaved differently in the two places would be a
 * bug nobody would think to look for.
 */
export function useLootBoxOpening(
  lootBoxService: LootBoxService | null,
  onOpened: () => void | Promise<void>,
): LootBoxOpening {
  const [session, setSession] = useState<LootBoxOpeningSession | null>(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => { isMountedRef.current = false }
  }, [])

  const openBox = useCallback(async (request: LootBoxOpeningRequest): Promise<void> => {
    if (!lootBoxService) {
      setSession({
        boxName: request.boxName,
        rarity: request.rarity,
        phase: 'failed',
        result: null,
        error: 'Loot boxes are unavailable.',
      })
      return
    }
    setSession({
      boxName: request.boxName,
      rarity: request.rarity,
      phase: 'charging',
      result: null,
      error: null,
    })
    try {
      const [result] = await Promise.all([
        lootBoxService.openBox(crypto.randomUUID(), request.boxInstanceId),
        delay(prefersReducedMotion() ? 0 : CHARGE_FLOOR_MS),
      ])
      if (!isMountedRef.current) {
        return
      }
      setSession({
        boxName: request.boxName,
        rarity: request.rarity,
        phase: 'revealing',
        result,
        error: null,
      })
    } catch (openError: unknown) {
      if (!isMountedRef.current) {
        return
      }
      setSession({
        boxName: request.boxName,
        rarity: request.rarity,
        phase: 'failed',
        result: null,
        error: openError instanceof Error ? openError.message : 'Unable to open loot box.',
      })
    }
  }, [lootBoxService])

  const dismiss = useCallback((): void => {
    setSession(null)
    void onOpened()
  }, [onOpened])

  return {
    session,
    isOpening: session?.phase === 'charging',
    openBox,
    dismiss,
  }
}
