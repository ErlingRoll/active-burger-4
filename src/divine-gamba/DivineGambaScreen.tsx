import { useCallback, useEffect, useMemo, useState } from 'react'
import { isRarity, RARITY_VISUALS } from '../content/rarity/Rarity'
import { LootBoxIcon } from '../loot/LootBoxIcon'
import { EssenceAmount, EssenceMark } from '../ui/EssenceMark'
import { useToaster } from '../ui/ToasterContext'
import { DivineGambaBoard } from './DivineGambaBoard'
import { DivineGambaCaseReveal } from './DivineGambaCaseReveal'
import { formatMultiplier } from './DivineGambaBoardView'
import {
  DIVINE_GAMBA_KICKER,
  DIVINE_GAMBA_LEDE,
  DIVINE_GAMBA_NAME,
} from './DivineGambaNaming'
import { measureDivineGambaOdds, measureProfitChance } from './DivineGambaOdds'
import {
  DIVINE_GAMBA_MACHINE,
  DIVINE_GAMBA_MAX_BALLS,
  DIVINE_GAMBA_STAKES,
  getDivineGambaStakePrice,
  isDivineGambaJackpot,
} from './DivineGambaRegistry'
import type { DivineGambaService, DivineGambaSettleResult } from './DivineGambaTypes'
import { BOX_RARITIES } from './sim'
import { useDivineGambaPlay } from './useDivineGambaPlay'

interface DivineGambaScreenProps {
  divineGambaService: DivineGambaService | null
  essenceBalance: number | null
  configurationError: string | null
  onBack: () => void
  /** Told when Essence changed, so the rest of the app can re-read the wallet. */
  onEssenceChanged: () => void
}

const BALL_COUNT_KEY = 'divine-gamba:ball-count'

function readStoredBallCount(): number {
  try {
    const raw = localStorage.getItem(BALL_COUNT_KEY)
    if (raw === null) {
      return 5
    }
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'number' && Number.isInteger(parsed) && parsed >= 1 && parsed <= DIVINE_GAMBA_MAX_BALLS
      ? parsed
      : 5
  } catch {
    return 5
  }
}

function storeBallCount(value: number): void {
  try {
    localStorage.setItem(BALL_COUNT_KEY, JSON.stringify(value))
  } catch {
    // A remembered preference is a convenience, not state.
  }
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function percent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`
}

/** A small chance, shown to the precision that still says something. */
function smallPercent(value: number): string {
  if (value <= 0) {
    return '—'
  }
  if (value < 0.0001) {
    return '<0.01%'
  }
  return percent(value, value < 0.01 ? 2 : 1)
}

/**
 * The measured landing shares, averaged with their mirror.
 *
 * The board is symmetric, so the true odds are; the measurement is a sample
 * and is not. Showing 0.4% on one jackpot and 0.8% on the other reads as a
 * rigged side rather than as noise.
 */
function mirrored(landing: readonly number[]): number[] {
  return landing.map((share, index) => (share + (landing[landing.length - 1 - index] ?? share)) / 2)
}

/**
 * The Divine Gamba.
 *
 * The board in the middle of the page, the controls and tally beneath it,
 * and the odds under that. The odds shown are measured from the same
 * simulation the house runs, so what the legend says is what the pockets
 * do, and the chance shown for this drop is the chance for the ball count
 * chosen.
 */
export function DivineGambaScreen({
  divineGambaService,
  essenceBalance,
  configurationError,
  onBack,
  onEssenceChanged,
}: DivineGambaScreenProps) {
  const { showLootToast, showToast } = useToaster()
  const [ballCount, setBallCount] = useState<number>(readStoredBallCount)
  const [stake, setStake] = useState(1)
  const error = divineGambaService ? configurationError : configurationError ?? `The ${DIVINE_GAMBA_NAME} is unavailable.`
  const [skipped, setSkipped] = useState(false)
  const reducedMotion = useMemo(() => prefersReducedMotion(), [])

  /**
   * What the drop came to, as a loot notice: the net Essence, in the
   * Essence blue when the drop paid and in red when it lost, then a notice
   * per box that fell.
   */
  const announceSettlement = useCallback((settlement: DivineGambaSettleResult): void => {
    const net = settlement.essenceWon - settlement.essenceSpent
    const tone = net < 0 ? 'var(--color-red-400)' : 'var(--essence)'
    const balls = settlement.balls.length
    showLootToast({
      title: net > 0 ? 'The drop paid out' : net < 0 ? 'The drop lost' : 'The drop broke even',
      itemName: `${net > 0 ? '+' : net < 0 ? '−' : ''}${Math.abs(net).toLocaleString()} Essence`,
      icon: <EssenceMark />,
      accentColor: tone,
      glowColor: tone,
      details: [`Paid ${settlement.essenceSpent.toLocaleString()}, won ${settlement.essenceWon.toLocaleString()} over ${balls} ${balls === 1 ? 'ball' : 'balls'}`],
    })
    for (const ball of settlement.balls) {
      if (ball.boxRarity !== null && isRarity(ball.boxRarity)) {
        showLootToast({
          title: 'A box fell out',
          itemName: `${ball.boxRarity.charAt(0).toUpperCase()}${ball.boxRarity.slice(1)} loot box`,
          icon: <LootBoxIcon rarity={ball.boxRarity} />,
          reward: '×1',
        })
      }
    }
    onEssenceChanged()
  }, [showLootToast, onEssenceChanged])

  const play = useDivineGambaPlay(divineGambaService, announceSettlement)
  const { resumePending } = play

  // Settle whatever was paid for earlier and never paid out. A settlement
  // that fails again is reported and left pending for the next visit; it is
  // not a reason to hide the machine, which can still be played.
  useEffect(() => {
    if (!divineGambaService) {
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const settled = await resumePending()
        if (cancelled) {
          return
        }
        for (const settlement of settled) {
          announceSettlement(settlement)
        }
      } catch (settleError: unknown) {
        if (!cancelled) {
          const message = settleError instanceof Error ? settleError.message : 'The house could not settle it.'
          showToast(`A drop from earlier is still waiting to be paid out: ${message} It will be tried again next visit.`, 'error')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [divineGambaService, resumePending, showToast, announceSettlement])

  const machine = DIVINE_GAMBA_MACHINE
  const stakePrice = getDivineGambaStakePrice(stake)
  const cost = stakePrice * ballCount
  const canAfford = essenceBalance !== null && essenceBalance >= cost
  const odds = useMemo(() => measureDivineGambaOdds(machine, stakePrice), [machine, stakePrice])
  const landing = useMemo(() => mirrored(odds.landing), [odds])
  const profitChance = useMemo(
    () => measureProfitChance(odds, ballCount, stakePrice),
    [odds, ballCount, stakePrice],
  )
  // A box's rarity is drawn from the weights once a box is due, so each
  // rarity's chance per ball is its share of the box chance; per drop, over
  // the balls paid for.
  const rarityOdds = useMemo(() => {
    const weights = BOX_RARITIES.map((rarity) => Math.max(0, machine.boxRarityWeights[rarity] ?? 0))
    const total = weights.reduce((sum, weight) => sum + weight, 0)
    return BOX_RARITIES.map((rarity, index) => {
      const perBall = total > 0 ? odds.boxChancePerBall * (weights[index] ?? 0) / total : 0
      return { rarity, perBall, perDrop: 1 - (1 - perBall) ** ballCount }
    })
  }, [machine, odds, ballCount])

  const session = play.session
  const drop = session?.drop ?? null
  // The board shows the machine the drop in flight was paid for.
  const boardConfig = drop?.play.machine ?? machine

  const changeBallCount = (next: number): void => {
    const clamped = Math.min(DIVINE_GAMBA_MAX_BALLS, Math.max(1, Math.round(next)))
    setBallCount(clamped)
    storeBallCount(clamped)
  }

  const launch = async (): Promise<void> => {
    if (play.isBusy || !canAfford) {
      return
    }
    setSkipped(false)
    await play.launch(ballCount, stake)
  }

  // The tally: predicted from the local run while balls are falling, the
  // house's numbers once it has settled.
  const settlement = session?.settlement ?? null
  const localBalls = session?.drop?.outcome.balls ?? []
  const landedLocal = localBalls.slice(0, session?.landedBalls ?? 0)
  const shownBalls = session?.phase === 'settled' && settlement !== null ? settlement.balls : landedLocal
  const wonSoFar = shownBalls.reduce((total, ball) => total + ball.essenceWon, 0)
  const boxesSoFar = shownBalls.filter((ball) => ball.boxRarity !== null).length
  const spent = session?.drop?.play.essenceSpent ?? 0
  const totalBalls = session?.drop?.outcome.balls.length ?? 0
  const revealBoxes = drop === null ? [] : drop.outcome.balls
    .filter((ball) => ball.boxRarity !== null)
    .map((ball) => ({ ballIndex: ball.ballIndex, rarity: ball.boxRarity ?? 'common' }))

  return (
    <section className="app-screen divine-gamba-screen" aria-labelledby="divine-gamba-title">
      {session?.phase === 'revealing' && drop !== null && revealBoxes.length > 0 ? (
        <DivineGambaCaseReveal
          boxes={revealBoxes}
          seed={drop.play.seed}
          weights={drop.play.machine.boxRarityWeights}
          reducedMotion={reducedMotion}
          onDone={play.finishReveal}
        />
      ) : null}
      <div className="app-screen-frame">
        <div className="app-screen-topbar">
          <button className="app-screen-back" type="button" onClick={onBack}>
            <span aria-hidden="true">←</span> Back to the refuge
          </button>
          <dl className="app-screen-stats">
            <div>
              <dt>Essence</dt>
              <dd><EssenceAmount value={essenceBalance} /></dd>
            </div>
          </dl>
        </div>
        <header className="app-screen-title">
          <p className="screen-kicker">{DIVINE_GAMBA_KICKER}</p>
          <h2 id="divine-gamba-title">{DIVINE_GAMBA_NAME}</h2>
          <p className="app-screen-lede">{DIVINE_GAMBA_LEDE}</p>
        </header>
        {error ? <p className="persistence-error" role="alert">{error}</p> : null}
        {divineGambaService !== null ? (
          <div className="app-screen-panels divine-gamba-panels">
            <section className="app-panel divine-gamba-board-panel" aria-labelledby="divine-gamba-board-title">
              <div className="divine-gamba-board">
                <DivineGambaBoard
                  machine={boardConfig}
                  drop={drop}
                  reducedMotion={reducedMotion}
                  skipped={skipped}
                  onLanded={play.markLanded}
                  onFinished={play.finishDrop}
                />
              </div>
              <div className="divine-gamba-controls">
                <div className="divine-gamba-count" role="group" aria-labelledby="divine-gamba-count-label">
                  <span id="divine-gamba-count-label" className="divine-gamba-control-label">Balls</span>
                  <button type="button" className="secondary-action" onClick={() => changeBallCount(ballCount - 1)} disabled={play.isBusy || ballCount <= 1} aria-label="One ball fewer">−</button>
                  <input
                    type="range"
                    min={1}
                    max={DIVINE_GAMBA_MAX_BALLS}
                    value={ballCount}
                    disabled={play.isBusy}
                    aria-label="Balls to drop"
                    aria-valuetext={`${ballCount} balls`}
                    onChange={(event) => changeBallCount(Number(event.target.value))}
                  />
                  <button type="button" className="secondary-action" onClick={() => changeBallCount(ballCount + 1)} disabled={play.isBusy || ballCount >= DIVINE_GAMBA_MAX_BALLS} aria-label="One ball more">+</button>
                  <strong className="divine-gamba-count-value">{ballCount}</strong>
                </div>
                <div className="divine-gamba-stakes" role="group" aria-label="Stake">
                  <span className="divine-gamba-control-label">Stake</span>
                  {DIVINE_GAMBA_STAKES.map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      className={`secondary-action divine-gamba-stake${stake === tier ? ' divine-gamba-stake-active' : ''}`}
                      disabled={play.isBusy}
                      aria-pressed={stake === tier}
                      onClick={() => setStake(tier)}
                    >
                      ×{tier}
                    </button>
                  ))}
                </div>
                <div className="divine-gamba-launch">
                  <span className="divine-gamba-cost">
                    <span className="divine-gamba-control-label">Cost</span>
                    <EssenceAmount value={cost} />
                    <small>{stakePrice} a ball</small>
                  </span>
                  {play.isBusy && session?.phase === 'dropping' ? (
                    <button type="button" className="secondary-action" onClick={() => setSkipped(true)}>Skip</button>
                  ) : null}
                  <button
                    type="button"
                    className="primary-action divine-gamba-launch-action"
                    disabled={play.isBusy || !canAfford || divineGambaService === null}
                    onClick={() => { void launch() }}
                  >
                    {session?.phase === 'charging' ? 'Paying…' : play.isBusy ? 'Dropping…' : 'GAMBA'}
                  </button>
                </div>
              </div>
              {session !== null ? (
                <div className="divine-gamba-tally" role="status" aria-live="polite">
                  {session.phase === 'failed' ? (
                    <p className="divine-gamba-tally-error">{session.error}</p>
                  ) : (
                    <>
                      <span><small>Balls</small><strong>{shownBalls.length} / {totalBalls}</strong></span>
                      <span><small>Paid</small><strong><EssenceAmount value={spent} /></strong></span>
                      <span><small>Won</small><strong><EssenceAmount value={wonSoFar} /></strong></span>
                      <span><small>Boxes</small><strong>{boxesSoFar}</strong></span>
                      {session.phase === 'settled' && settlement !== null ? (
                        <span className="divine-gamba-net" data-sign={settlement.essenceWon - settlement.essenceSpent >= 0 ? 'up' : 'down'}>
                          <small>Net</small>
                          <strong><EssenceAmount value={settlement.essenceWon - settlement.essenceSpent} signed /></strong>
                        </span>
                      ) : session.phase === 'settling' ? (
                        <span><small>House</small><strong>Settling…</strong></span>
                      ) : session.phase === 'revealing' ? (
                        <span><small>Boxes</small><strong>Opening…</strong></span>
                      ) : null}
                    </>
                  )}
                  {session.phase === 'settled' || session.phase === 'failed' ? (
                    <button type="button" className="secondary-action" onClick={play.dismiss}>Clear</button>
                  ) : null}
                </div>
              ) : null}
            </section>
            <section className="app-panel divine-gamba-odds-panel" aria-labelledby="divine-gamba-odds-title">
              {/* <header className="app-panel-heading">
                <div>
                  <p className="screen-kicker">The odds, as set</p>
                  <h3 id="divine-gamba-odds-title">What this machine does</h3>
                </div>
              </header>
              <dl className="divine-gamba-chances">
                <div>
                  <dt>This drop profits</dt>
                  <dd>{percent(profitChance, 0)} <small>of the time, over {ballCount} {ballCount === 1 ? 'ball' : 'balls'}</small></dd>
                </div>
                <div>
                  <dt>Returned per Essence</dt>
                  <dd>{percent(odds.returnToPlayer, 0)} <small>over many balls</small></dd>
                </div>
              </dl>
              <table className="divine-gamba-legend">
                <caption className="divine-gamba-legend-caption">Pockets, left to right</caption>
                <thead>
                  <tr>
                    <th scope="col">Pays</th>
                    <th scope="col">Lands</th>
                    <th scope="col">Box</th>
                  </tr>
                </thead>
                <tbody>
                  {machine.pockets.map((pocket, index) => {
                    const multiplier = pocket.multiplierPercent / 100
                    const boxChance = Math.min(1, pocket.boxChanceBasisPoints / 10000)
                    return (
                      <tr key={index} data-pays={multiplier >= 1 ? 'above' : 'below'} data-jackpot={isDivineGambaJackpot(machine, index) ? 'true' : undefined}>
                        <th scope="row">{formatMultiplier(multiplier)}</th>
                        <td>{percent(landing[index] ?? 0)}</td>
                        <td>{boxChance > 0 ? percent(boxChance, 0) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table> */}
              <table className="divine-gamba-legend divine-gamba-rarities">
                <caption className="divine-gamba-legend-caption">Loot boxes</caption>
                <thead>
                  <tr>
                    <th scope="col">Rarity</th>
                    <th scope="col">Per ball</th>
                    <th scope="col">This drop</th>
                  </tr>
                </thead>
                <tbody>
                  {rarityOdds.map(({ rarity, perBall, perDrop }) => (
                    <tr key={rarity}>
                      <th scope="row">
                        <span className="divine-gamba-rarity" style={{ color: isRarity(rarity) ? RARITY_VISUALS[rarity].color : undefined }}>
                          {isRarity(rarity) ? <LootBoxIcon rarity={rarity} /> : null}
                          {isRarity(rarity) ? RARITY_VISUALS[rarity].label : rarity}
                        </span>
                      </th>
                      <td>{smallPercent(perBall)}</td>
                      <td>{smallPercent(perDrop)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        ) : null}
      </div>
    </section>
  )
}
