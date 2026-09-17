import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  DivineGambaBeginResult,
  DivineGambaService,
  DivineGambaSettleResult,
} from './DivineGambaTypes'
import { simulatePlay, type DivineGambaPlayOutcome } from './sim'

export type DivineGambaPhase = 'charging' | 'dropping' | 'revealing' | 'settling' | 'settled' | 'failed'

/** A play the browser is animating: what was paid for, and where its balls go. */
export interface DivineGambaDrop {
  play: DivineGambaBeginResult
  outcome: DivineGambaPlayOutcome
  /** `performance.now()` when the first ball was released. */
  startedAt: number
}

export interface DivineGambaPlaySession {
  phase: DivineGambaPhase
  drop: DivineGambaDrop | null
  settlement: DivineGambaSettleResult | null
  /** Balls that have reached a pocket in the animation so far. */
  landedBalls: number
  error: string | null
}

export interface DivineGambaPlay {
  session: DivineGambaPlaySession | null
  /** True from the click until the drop is settled or has failed. */
  isBusy: boolean
  launch: (ballCount: number, stake: number) => Promise<void>
  /** The board reports how many balls have landed. */
  markLanded: (landedBalls: number) => void
  /** The board reports the last ball has landed, or the player skipped. */
  finishDrop: () => void
  /** The reveal reports every box has been opened. */
  finishReveal: () => void
  dismiss: () => void
  /** Settles plays paid for earlier and never paid out. */
  resumePending: () => Promise<DivineGambaSettleResult[]>
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

/**
 * The drop, from the click to the payout.
 *
 * Two things happen at once after the wallet is charged. The browser runs the
 * simulation itself and starts the balls falling; the house is asked to run
 * it too and pay. The player watches the local run, and the numbers on the
 * tally at the end are the house's. They agree, because the simulation is
 * deterministic, and if ever they did not the house's answer is shown and the
 * disagreement is logged.
 *
 * The operation id is kept until `begin` succeeds, so a retry after a dropped
 * connection replays the same play rather than paying for a second one.
 */
export function useDivineGambaPlay(
  service: DivineGambaService | null,
  onSettled: (settlement: DivineGambaSettleResult) => void,
): DivineGambaPlay {
  const [session, setSession] = useState<DivineGambaPlaySession | null>(null)
  const isMountedRef = useRef(true)
  const operationIdRef = useRef<string | null>(null)
  const finishedRef = useRef(false)
  const settlementRef = useRef<DivineGambaSettleResult | null>(null)
  const dropRef = useRef<DivineGambaDrop | null>(null)
  const onSettledRef = useRef(onSettled)

  useEffect(() => {
    onSettledRef.current = onSettled
  }, [onSettled])

  useEffect(() => {
    isMountedRef.current = true
    return () => { isMountedRef.current = false }
  }, [])

  const settleIfDone = useCallback((): void => {
    const settlement = settlementRef.current
    if (!finishedRef.current || settlement === null || !isMountedRef.current) {
      return
    }
    setSession((current) => {
      if (current === null || current.phase === 'settled' || current.phase === 'failed') {
        return current
      }
      if (current.drop !== null) {
        const local = current.drop.outcome.balls.map((ball) => ball.pocketIndex).join(',')
        const remote = settlement.balls.map((ball) => ball.pocketIndex).join(',')
        if (local !== remote) {
          console.error(`Divine Gamba play ${settlement.playId}: the browser and the house disagree on where the balls landed (${local} vs ${remote}). Showing the house's result.`)
        }
      }
      return { ...current, phase: 'settled', settlement, landedBalls: settlement.balls.length }
    })
    onSettledRef.current(settlement)
  }, [])

  const launch = useCallback(async (ballCount: number, stake: number): Promise<void> => {
    if (!service) {
      setSession({ phase: 'failed', drop: null, settlement: null, landedBalls: 0, error: 'The Divine Gamba is unavailable.' })
      return
    }
    finishedRef.current = false
    settlementRef.current = null
    dropRef.current = null
    setSession({ phase: 'charging', drop: null, settlement: null, landedBalls: 0, error: null })
    const operationId = operationIdRef.current ?? crypto.randomUUID()
    operationIdRef.current = operationId
    let play: DivineGambaBeginResult
    try {
      play = await service.beginPlay(operationId, ballCount, stake)
    } catch (beginError: unknown) {
      if (isMountedRef.current) {
        setSession({
          phase: 'failed',
          drop: null,
          settlement: null,
          landedBalls: 0,
          error: errorMessage(beginError, 'The machine would not take the Essence.'),
        })
      }
      return
    }
    // Paid. A retry from here is a new play.
    operationIdRef.current = null
    if (!isMountedRef.current) {
      return
    }
    const outcome = simulatePlay({
      seed: play.seed,
      machine: play.machine,
      ballCount: play.ballCount,
      stakePrice: play.stakePrice,
      recordFrames: true,
    })
    const drop: DivineGambaDrop = { play, outcome, startedAt: performance.now() }
    dropRef.current = drop
    setSession({
      phase: 'dropping',
      drop,
      settlement: null,
      landedBalls: 0,
      error: null,
    })
    try {
      const settlement = await service.settlePlay(play.playId)
      settlementRef.current = settlement
      if (isMountedRef.current) {
        setSession((current) => current === null ? current : { ...current, settlement })
      }
      settleIfDone()
    } catch (settleError: unknown) {
      if (isMountedRef.current) {
        setSession((current) => current === null ? current : {
          ...current,
          phase: 'failed',
          error: `${errorMessage(settleError, 'The house could not settle the play.')} The Essence is spent and the play is kept; it will be paid out on your next visit.`,
        })
      }
    }
  }, [service, settleIfDone])

  const markLanded = useCallback((landedBalls: number): void => {
    setSession((current) =>
      current === null || current.phase !== 'dropping' || current.landedBalls === landedBalls
        ? current
        : { ...current, landedBalls })
  }, [])

  const finishDrop = useCallback((): void => {
    // A box that fell is opened before the house's numbers are shown, so
    // the reveal is the last thing the player watches, not the tally.
    const revealing = (dropRef.current?.outcome.balls ?? []).some((ball) => ball.boxRarity !== null)
    setSession((current) => {
      if (current === null || current.phase !== 'dropping') {
        return current
      }
      return {
        ...current,
        phase: revealing ? 'revealing' : 'settling',
        landedBalls: current.drop?.outcome.balls.length ?? current.landedBalls,
      }
    })
    if (!revealing) {
      finishedRef.current = true
      settleIfDone()
    }
  }, [settleIfDone])

  const finishReveal = useCallback((): void => {
    finishedRef.current = true
    setSession((current) =>
      current === null || current.phase !== 'revealing' ? current : { ...current, phase: 'settling' })
    settleIfDone()
  }, [settleIfDone])

  const dismiss = useCallback((): void => {
    setSession((current) => current !== null && (current.phase === 'settled' || current.phase === 'failed') ? null : current)
  }, [])

  const resumePending = useCallback(async (): Promise<DivineGambaSettleResult[]> => {
    if (!service) {
      return []
    }
    const pending = await service.loadPendingPlays()
    const settled: DivineGambaSettleResult[] = []
    for (const play of pending) {
      settled.push(await service.settlePlay(play.playId))
    }
    return settled
  }, [service])

  return {
    session,
    isBusy: session !== null && (session.phase === 'charging' || session.phase === 'dropping' ||
      session.phase === 'revealing' || session.phase === 'settling'),
    launch,
    markLanded,
    finishDrop,
    finishReveal,
    dismiss,
    resumePending,
  }
}
