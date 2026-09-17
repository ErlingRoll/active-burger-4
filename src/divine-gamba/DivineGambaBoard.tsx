import { useEffect, useRef } from 'react'
import { playSound } from '../audio/SoundEffects'
import type { SoundCueId } from '../audio/SoundCues'
import {
  DivineGambaBoardView,
  type DivineGambaBoardDrop,
  type DivineGambaBoardSound,
} from './DivineGambaBoardView'
import type { DivineGambaMachineConfig } from './sim'

interface DivineGambaBoardProps {
  machine: DivineGambaMachineConfig
  drop: DivineGambaBoardDrop | null
  /** Play no animation: every ball is shown landed at once. */
  reducedMotion: boolean
  /** Whether the player asked to skip to the end. */
  skipped: boolean
  onLanded: (landedBalls: number) => void
  onFinished: () => void
}

const BOARD_CUES: Readonly<Record<DivineGambaBoardSound, SoundCueId>> = {
  peg: 'gamba-peg',
  land: 'gamba-land',
  'land-good': 'gamba-land-good',
  jackpot: 'gamba-jackpot',
}

/** How long the board keeps drawing after the last ball lands, so it can sink and its pocket flash. */
const SETTLE_MS = 500

function playBoardSound(sound: DivineGambaBoardSound): void {
  playSound(BOARD_CUES[sound])
}

/**
 * The canvas the board is drawn on.
 *
 * Owns the render loop and nothing else: the view draws, the hook decides.
 * The loop runs only while a drop is in flight, and a resize re-fits the
 * board to whatever the panel gives it.
 */
export function DivineGambaBoard({
  machine,
  drop,
  reducedMotion,
  skipped,
  onLanded,
  onFinished,
}: DivineGambaBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<DivineGambaBoardView | null>(null)
  const onLandedRef = useRef(onLanded)
  const onFinishedRef = useRef(onFinished)

  useEffect(() => {
    onLandedRef.current = onLanded
    onFinishedRef.current = onFinished
  }, [onLanded, onFinished])

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) {
      return
    }
    const view = new DivineGambaBoardView(canvas, playBoardSound)
    viewRef.current = view
    const fit = (): void => {
      const parent = canvas.parentElement
      const width = parent?.clientWidth ?? canvas.clientWidth
      const height = parent?.clientHeight ?? canvas.clientHeight
      view.resize(width, height, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1)
      view.render(performance.now())
    }
    fit()
    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined' && canvas.parentElement !== null) {
      observer = new ResizeObserver(fit)
      observer.observe(canvas.parentElement)
    }
    return () => {
      observer?.disconnect()
      viewRef.current = null
    }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (view === null) {
      return
    }
    view.setMachine(machine)
    view.render(performance.now())
  }, [machine])

  useEffect(() => {
    const view = viewRef.current
    if (view === null) {
      return
    }
    view.setDrop(drop)
    if (drop === null) {
      view.render(performance.now())
      return
    }
    if (reducedMotion || skipped) {
      view.settleAll(performance.now())
      onLandedRef.current(drop.outcome.balls.length)
      onFinishedRef.current()
      return
    }
    let frame = 0
    let lastLanded = -1
    const step = (): void => {
      const now = performance.now()
      const result = view.render(now)
      if (result.landed !== lastLanded) {
        lastLanded = result.landed
        onLandedRef.current(result.landed)
      }
      if (result.finished) {
        // Let the last ball sink and the last pocket flash before handing
        // over: keep drawing for half a second after the last landing.
        const finishedAt = now
        const settle = (): void => {
          const settleNow = performance.now()
          view.render(settleNow)
          if (settleNow - finishedAt < SETTLE_MS) {
            frame = requestAnimationFrame(settle)
            return
          }
          onFinishedRef.current()
        }
        frame = requestAnimationFrame(settle)
        return
      }
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => { cancelAnimationFrame(frame) }
  }, [drop, reducedMotion, skipped])

  return (
    <canvas
      ref={canvasRef}
      className="divine-gamba-canvas"
      role="img"
      aria-label={drop === null ? 'The Divine Gamba board, waiting for a drop' : 'Balls dropping through the Divine Gamba'}
    />
  )
}
