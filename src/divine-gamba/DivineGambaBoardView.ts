import { RARITY_VISUALS, isRarity } from '../content/rarity/Rarity'
import {
  buildMachine,
  pocketCentreX,
  TICKS_PER_SECOND,
  type DivineGambaMachine,
  type DivineGambaMachineConfig,
  type DivineGambaPlayOutcome,
} from './sim'

/**
 * The board, drawn.
 *
 * A thin Canvas 2D projection of the simulation's recorded frames: it owns no
 * physics and decides nothing. Balls are released one after another a short
 * gap apart and played back a little faster than real time, so twenty balls
 * are all in the air within a couple of seconds and the last has landed a
 * few seconds later. Colours come from the screen's custom properties, read
 * off the canvas element, so the board takes the accent of the place it is
 * in and no shade is written here.
 */
export interface DivineGambaBoardDrop {
  outcome: DivineGambaPlayOutcome
  startedAt: number
}

export interface DivineGambaBoardFrame {
  landed: number
  finished: boolean
}

const LAUNCH_GAP_MS = 110
const PLAYBACK_SPEED = 1.6
const FLASH_MS = 520
/** How deep a pocket slot is, in peg pitches: room for a label and three rows of balls. */
const SLOT_DEPTH = 1.6
/** Fallbacks for an environment without computed styles, such as a test. */
const FALLBACK = {
  accent: '#c4b5fd',
  accentRgb: '139 92 246',
  brightRgb: '196 181 253',
  essence: '#60a5fa',
  text: '#f8fafc',
  night: '#020617',
}

interface ScheduledBall {
  index: number
  frames: number[]
  startMs: number
  pocketIndex: number
  boxRarity: string | null
  landedAt: number | null
}

interface Palette {
  accent: string
  accentRgb: string
  brightRgb: string
  essence: string
  text: string
  night: string
  font: string
}

export class DivineGambaBoardView {
  private readonly canvas: HTMLCanvasElement
  private readonly context: CanvasRenderingContext2D | null
  private machine: DivineGambaMachine | null = null
  private config: DivineGambaMachineConfig | null = null
  private balls: ScheduledBall[] = []
  private width = 0
  private height = 0
  private ratio = 1
  private palette: Palette

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.context = canvas.getContext('2d')
    this.palette = this.readPalette()
  }

  setMachine(config: DivineGambaMachineConfig): void {
    this.config = config
    this.machine = buildMachine(config)
    this.palette = this.readPalette()
  }

  /** Schedules a drop's balls, or clears the board when given null. */
  setDrop(drop: DivineGambaBoardDrop | null): void {
    if (drop === null) {
      this.balls = []
      return
    }
    const paid = drop.outcome.balls.filter((ball) => ball.parentIndex === null)
    const scheduled = new Map<number, ScheduledBall>()
    for (const [order, ball] of paid.entries()) {
      scheduled.set(ball.ballIndex, {
        index: ball.ballIndex,
        frames: ball.frames ?? [],
        startMs: drop.startedAt + order * LAUNCH_GAP_MS,
        pocketIndex: ball.pocketIndex,
        boxRarity: ball.boxRarity,
        landedAt: null,
      })
    }
    for (const ball of drop.outcome.balls) {
      if (ball.parentIndex === null) {
        continue
      }
      const parent = scheduled.get(ball.parentIndex)
      const frames = ball.frames ?? []
      // A child starts where and when its parent split: the tick whose
      // recorded position equals the child's first frame, exactly.
      let splitTick = 0
      if (parent !== undefined && frames.length >= 2) {
        for (let tick = 0; tick * 2 + 1 < parent.frames.length; tick += 1) {
          if (parent.frames[tick * 2] === frames[0] && parent.frames[tick * 2 + 1] === frames[1]) {
            splitTick = tick
            break
          }
        }
      }
      scheduled.set(ball.ballIndex, {
        index: ball.ballIndex,
        frames,
        startMs: (parent?.startMs ?? drop.startedAt) + splitTick / TICKS_PER_SECOND * 1000 / PLAYBACK_SPEED,
        pocketIndex: ball.pocketIndex,
        boxRarity: ball.boxRarity,
        landedAt: null,
      })
    }
    this.balls = [...scheduled.values()]
  }

  resize(width: number, height: number, ratio: number): void {
    this.width = width
    this.height = height
    this.ratio = ratio
    this.canvas.width = Math.max(1, Math.round(width * ratio))
    this.canvas.height = Math.max(1, Math.round(height * ratio))
  }

  /** Draws the board at `nowMs` and reports the animation's progress. */
  render(nowMs: number): DivineGambaBoardFrame {
    let landed = 0
    for (const ball of this.balls) {
      const tick = this.tickAt(ball, nowMs)
      if (tick >= ball.frames.length / 2 - 1 && ball.frames.length > 0) {
        if (ball.landedAt === null) {
          ball.landedAt = nowMs
        }
        landed += 1
      }
    }
    this.draw(nowMs)
    return { landed, finished: this.balls.length > 0 && landed === this.balls.length }
  }

  /** Lands everything at once, for a skipped or motion-reduced drop. */
  settleAll(nowMs: number): void {
    for (const ball of this.balls) {
      ball.landedAt = ball.landedAt ?? nowMs - FLASH_MS
      ball.startMs = Number.NEGATIVE_INFINITY
    }
    this.draw(nowMs)
  }

  private tickAt(ball: ScheduledBall, nowMs: number): number {
    if (ball.startMs === Number.NEGATIVE_INFINITY) {
      return Number.POSITIVE_INFINITY
    }
    return Math.max(0, (nowMs - ball.startMs) / 1000 * TICKS_PER_SECOND * PLAYBACK_SPEED)
  }

  private readPalette(): Palette {
    const fallback: Palette = { ...FALLBACK, font: 'sans-serif' }
    if (typeof getComputedStyle !== 'function') {
      return fallback
    }
    const style = getComputedStyle(this.canvas)
    const read = (name: string, otherwise: string): string => {
      const value = style.getPropertyValue(name).trim()
      return value.length > 0 ? value : otherwise
    }
    return {
      accent: read('--accent', FALLBACK.accent),
      accentRgb: read('--accent-rgb', FALLBACK.accentRgb),
      brightRgb: read('--accent-bright-rgb', FALLBACK.brightRgb),
      essence: read('--essence', FALLBACK.essence),
      text: read('--text-primary', FALLBACK.text),
      night: read('--scene-night', FALLBACK.night),
      font: style.fontFamily || 'sans-serif',
    }
  }

  private draw(nowMs: number): void {
    const context = this.context
    const machine = this.machine
    const config = this.config
    if (context === null || machine === null || config === null || this.width === 0 || this.height === 0) {
      return
    }
    const { accent, accentRgb, brightRgb, essence, text, night, font } = this.palette
    // The world spans a small margin above the release and below the slots.
    const margin = 0.3
    const worldHeight = machine.floorY + SLOT_DEPTH + margin * 2
    const scale = Math.min(this.width / (machine.halfWidth * 2 + 0.4), this.height / worldHeight)
    const originX = this.width / 2
    const originY = (this.height - worldHeight * scale) / 2 + margin * scale
    const toX = (x: number): number => originX + x * scale
    const toY = (y: number): number => originY + y * scale

    context.setTransform(this.ratio, 0, 0, this.ratio, 0, 0)
    context.clearRect(0, 0, this.width, this.height)

    // The cabinet: a night gradient with the accent washing down from the release.
    const wash = context.createLinearGradient(0, 0, 0, this.height)
    wash.addColorStop(0, `rgb(${accentRgb} / 0.18)`)
    wash.addColorStop(0.55, `rgb(${accentRgb} / 0.04)`)
    wash.addColorStop(1, 'rgb(0 0 0 / 0)')
    context.fillStyle = night
    context.fillRect(0, 0, this.width, this.height)
    context.fillStyle = wash
    context.fillRect(0, 0, this.width, this.height)

    // Walls.
    context.strokeStyle = `rgb(${accentRgb} / 0.45)`
    context.lineWidth = Math.max(1, scale * 0.06)
    for (const side of [-1, 1]) {
      context.beginPath()
      context.moveTo(toX(side * machine.halfWidth), toY(machine.releaseY - 0.2))
      context.lineTo(toX(side * machine.halfWidth), toY(machine.floorY + SLOT_DEPTH))
      context.stroke()
    }

    // Pockets: a slot each, lit when a ball lands. Labels are drawn last, on
    // top of whatever has settled in the slot.
    const pocketTop = toY(machine.floorY)
    const pocketBottom = toY(machine.floorY + SLOT_DEPTH)
    const pocketWidth = scale * 0.92
    for (let index = 0; index <= machine.rows; index += 1) {
      const pocket = config.pockets[index]
      const centreX = toX(pocketCentreX(machine.rows, index))
      const flash = this.pocketFlash(index, nowMs)
      const highest = pocket !== undefined && pocket.multiplierPercent >= 1000
      context.fillStyle = flash > 0
        ? `rgb(${brightRgb} / ${0.18 + 0.55 * flash})`
        : highest ? `rgb(${accentRgb} / 0.22)` : `rgb(${accentRgb} / 0.1)`
      context.strokeStyle = `rgb(${accentRgb} / ${highest ? 0.7 : 0.4})`
      context.lineWidth = Math.max(1, scale * 0.04)
      context.beginPath()
      context.rect(centreX - pocketWidth / 2, pocketTop, pocketWidth, pocketBottom - pocketTop)
      context.fill()
      context.stroke()
    }

    // Pegs: small facets, brighter towards the middle where most balls pass.
    for (const row of machine.pegRows) {
      for (const peg of row) {
        const radius = machine.pegRadius * scale
        const x = toX(peg.x)
        const y = toY(peg.y)
        context.fillStyle = `rgb(${brightRgb} / 0.75)`
        context.beginPath()
        context.moveTo(x, y - radius)
        context.lineTo(x + radius, y)
        context.lineTo(x, y + radius)
        context.lineTo(x - radius, y)
        context.closePath()
        context.fill()
      }
    }

    // Balls: faceted shards of Essence with a soft glow, drawn last.
    for (const ball of this.balls) {
      const tick = this.tickAt(ball, nowMs)
      if (tick <= 0 && ball.startMs > nowMs) {
        continue
      }
      const lastTick = ball.frames.length / 2 - 1
      const clamped = Math.min(tick, lastTick)
      const frame = Math.floor(clamped)
      const next = Math.min(frame + 1, lastTick)
      const blend = clamped - frame
      const x0 = ball.frames[frame * 2] ?? 0
      const y0 = ball.frames[frame * 2 + 1] ?? 0
      const x1 = ball.frames[next * 2] ?? x0
      const y1 = ball.frames[next * 2 + 1] ?? y0
      let x = toX(x0 + (x1 - x0) * blend)
      let y = toY(y0 + (y1 - y0) * blend)
      let radius = machine.ballRadius * scale
      if (ball.landedAt !== null) {
        // Stack in the slot beneath the label, three to a row from the
        // bottom up, so a pocket that has taken several balls shows it.
        const sink = Math.min(1, (nowMs - ball.landedAt) / 300)
        const order = this.landedBefore(ball)
        const column = order % 3
        const row = Math.min(2, Math.floor(order / 3))
        const restingY = machine.floorY + SLOT_DEPTH - 0.26 - row * 0.4
        x = toX(pocketCentreX(machine.rows, ball.pocketIndex) + (column - 1) * 0.3)
        y = toY(machine.floorY + 0.4 + (restingY - machine.floorY - 0.4) * sink)
        radius *= 0.68
      }
      const glow = ball.boxRarity !== null && isRarity(ball.boxRarity) && ball.landedAt !== null
        ? RARITY_VISUALS[ball.boxRarity].color
        : essence
      context.shadowColor = glow
      context.shadowBlur = radius * 1.6
      context.fillStyle = glow
      context.beginPath()
      context.moveTo(x, y - radius)
      context.lineTo(x + radius * 0.87, y - radius * 0.5)
      context.lineTo(x + radius * 0.87, y + radius * 0.5)
      context.lineTo(x, y + radius)
      context.lineTo(x - radius * 0.87, y + radius * 0.5)
      context.lineTo(x - radius * 0.87, y - radius * 0.5)
      context.closePath()
      context.fill()
      context.shadowBlur = 0
      context.fillStyle = 'rgb(255 255 255 / 0.55)'
      context.beginPath()
      context.moveTo(x - radius * 0.3, y - radius * 0.55)
      context.lineTo(x + radius * 0.15, y - radius * 0.7)
      context.lineTo(x - radius * 0.05, y - radius * 0.1)
      context.closePath()
      context.fill()
    }

    // Labels, on top: what each pocket pays, and a mark where a box can fall.
    for (let index = 0; index <= machine.rows; index += 1) {
      const pocket = config.pockets[index]
      if (pocket === undefined) {
        continue
      }
      const centreX = toX(pocketCentreX(machine.rows, index))
      const multiplier = pocket.multiplierPercent * config.multiplierScalePercent / 10000
      const labelY = pocketTop + (pocketBottom - pocketTop) * 0.15
      // Sized to the slot: a four-character label has to fit beside its neighbours.
      context.font = `800 ${Math.max(9, scale * (formatMultiplier(multiplier).length > 3 ? 0.24 : 0.3))}px ${font}`
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.lineWidth = Math.max(2, scale * 0.12)
      context.strokeStyle = night
      context.strokeText(formatMultiplier(multiplier), centreX, labelY)
      context.fillStyle = multiplier >= 1 ? text : accent
      context.fillText(formatMultiplier(multiplier), centreX, labelY)
      if (pocket.boxChanceBasisPoints > 0) {
        context.fillStyle = essence
        context.font = `${Math.max(8, scale * 0.2)}px ${font}`
        context.fillText('▣', centreX, pocketTop + (pocketBottom - pocketTop) * 0.36)
      }
    }
  }

  /** How many balls landed in this ball's pocket before it did. */
  private landedBefore(ball: ScheduledBall): number {
    let count = 0
    for (const other of this.balls) {
      if (other !== ball && other.pocketIndex === ball.pocketIndex && other.landedAt !== null &&
        ball.landedAt !== null && (other.landedAt < ball.landedAt || (other.landedAt === ball.landedAt && other.index < ball.index))) {
        count += 1
      }
    }
    return count
  }

  private pocketFlash(pocketIndex: number, nowMs: number): number {
    let strongest = 0
    for (const ball of this.balls) {
      if (ball.pocketIndex !== pocketIndex || ball.landedAt === null) {
        continue
      }
      const age = nowMs - ball.landedAt
      if (age >= 0 && age < FLASH_MS) {
        strongest = Math.max(strongest, 1 - age / FLASH_MS)
      }
    }
    return strongest
  }
}

export function formatMultiplier(multiplier: number): string {
  if (multiplier >= 10) {
    return `×${Math.round(multiplier)}`
  }
  return `×${multiplier.toFixed(multiplier >= 1 ? 1 : 2).replace(/\.?0+$/, '')}`
}
