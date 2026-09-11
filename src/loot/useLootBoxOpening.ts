import { useCallback, useEffect, useRef, useState } from 'react'
import type { LootBoxOpeningResult, LootBoxService } from './LootBoxService'
import type { LootBoxRarity } from './LootBoxes'

export type LootBoxOpeningPhase = 'charging' | 'revealing' | 'failed'

export interface LootBoxOpeningSession {
  readonly boxName: string
  readonly rarity: LootBoxRarity
  readonly phase: LootBoxOpeningPhase
  /** How many boxes the press asked for. One, or a batch of up to ten. */
  readonly boxCount: number
  /**
   * What has come out so far, one result per box in the order they opened.
   *
   * Kept even when the batch fails part way: a box the server has already
   * spent is spent, and the player should see what it gave rather than only
   * that the ninth one did not open.
   */
  readonly results: readonly LootBoxOpeningResult[]
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
  /**
   * The boxes to spend, one entry per box. An instance that holds several
   * boxes appears once per box, because the server takes one per call.
   */
  boxInstanceIds: readonly string[]
  boxName: string
  rarity: LootBoxRarity
}

export interface LootBoxOpening {
  session: LootBoxOpeningSession | null
  /** True while a box is in flight, so every Open button can be held shut. */
  isOpening: boolean
  openBoxes: (request: LootBoxOpeningRequest) => Promise<void>
  dismiss: () => void
}

/**
 * The opening, from the click to the moment the player puts the loot away.
 *
 * Kept out of the screens because both the stores and the pond's drawer open
 * boxes, and an opening that behaved differently in the two places would be a
 * bug nobody would think to look for.
 *
 * A batch opens one box at a time rather than all at once. Each call is its
 * own idempotent operation against the server, so nothing new has to be
 * deployed for a batch to work, and a batch that fails on its fourth box has
 * three boxes' worth of loot to show rather than a rolled-back nothing.
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

  const openBoxes = useCallback(async (request: LootBoxOpeningRequest): Promise<void> => {
    const boxCount = request.boxInstanceIds.length
    const base = { boxName: request.boxName, rarity: request.rarity, boxCount }
    if (!lootBoxService || boxCount === 0) {
      setSession({
        ...base,
        phase: 'failed',
        results: [],
        error: boxCount === 0 ? 'There is no box to open.' : 'Loot boxes are unavailable.',
      })
      return
    }
    setSession({ ...base, phase: 'charging', results: [], error: null })
    const results: LootBoxOpeningResult[] = []
    const charge = delay(prefersReducedMotion() ? 0 : CHARGE_FLOOR_MS)
    try {
      for (const boxInstanceId of request.boxInstanceIds) {
        const result = await lootBoxService.openBox(crypto.randomUUID(), boxInstanceId)
        results.push(result)
        if (!isMountedRef.current) {
          return
        }
        // The count ticks up on the charging screen, so a batch reads as
        // progress rather than as a long silence.
        setSession({ ...base, phase: 'charging', results: [...results], error: null })
      }
      await charge
      if (!isMountedRef.current) {
        return
      }
      setSession({ ...base, phase: 'revealing', results, error: null })
    } catch (openError: unknown) {
      if (!isMountedRef.current) {
        return
      }
      setSession({
        ...base,
        phase: 'failed',
        results,
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
    openBoxes,
    dismiss,
  }
}
