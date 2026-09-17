import { useCallback, useEffect, useMemo, useState } from 'react'
import { isRarity, RARITY_VISUALS } from '../content/rarity/Rarity'
import type { InventoryService } from '../inventory/InventoryTypes'
import { MaterialIcon } from '../inventory/MaterialIcon'
import { LootBoxIcon } from '../loot/LootBoxIcon'
import { EssenceAmount } from '../ui/EssenceMark'
import { useToaster } from '../ui/ToasterContext'
import { DivineGambaBoard } from './DivineGambaBoard'
import { formatMultiplier } from './DivineGambaBoardView'
import {
  DIVINE_GAMBA_KICKER,
  DIVINE_GAMBA_LEDE,
  DIVINE_GAMBA_NAME,
} from './DivineGambaNaming'
import { measureDivineGambaOdds } from './DivineGambaOdds'
import {
  DIVINE_GAMBA_MAX_BALLS,
  getDivineGambaBallPrice,
  getDivineGambaPartDefinition,
  getDivineGambaStakePrice,
  resolveDivineGambaMachine,
  type DivineGambaPartDefinition,
} from './DivineGambaRegistry'
import { DivineGambaStorePanel } from './DivineGambaStorePanel'
import type { DivineGambaService, DivineGambaSettleResult } from './DivineGambaTypes'
import { BOX_RARITIES } from './sim'
import { useDivineGambaPlay } from './useDivineGambaPlay'

interface DivineGambaScreenProps {
  divineGambaService: DivineGambaService | null
  inventoryService: InventoryService | null
  essenceBalance: number | null
  configurationError: string | null
  onBack: () => void
  /** Told when Essence changed, so the rest of the app can re-read the wallet. */
  onEssenceChanged: () => void
}

const BALL_COUNT_KEY = 'divine-gamba:ball-count'
const MODIFIERS_KEY = 'divine-gamba:modifiers'

function readStored<TValue>(key: string, fallback: TValue, check: (value: unknown) => value is TValue): TValue {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) {
      return fallback
    }
    const parsed: unknown = JSON.parse(raw)
    return check(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

function store(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // A remembered preference is a convenience, not state.
  }
}

function isBallCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= DIVINE_GAMBA_MAX_BALLS
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
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
 * The board in the middle, the controls beneath it, the tally beside it, the
 * odds under that, and the Shardwright's shelf at the end. The odds shown
 * are measured from the same simulation the house runs, for the machine as
 * it is currently set, so what the legend says is what the pockets do.
 */
export function DivineGambaScreen({
  divineGambaService,
  inventoryService,
  essenceBalance,
  configurationError,
  onBack,
  onEssenceChanged,
}: DivineGambaScreenProps) {
  const { showLootToast, showToast } = useToaster()
  const [ownedPartIds, setOwnedPartIds] = useState<ReadonlySet<string>>(() => new Set())
  const [enabledModifierIds, setEnabledModifierIds] = useState<ReadonlySet<string>>(
    () => new Set(readStored(MODIFIERS_KEY, [], isStringArray)),
  )
  const [ballCount, setBallCount] = useState<number>(() => readStored(BALL_COUNT_KEY, 5, isBallCount))
  const [stake, setStake] = useState(1)
  const [shardBalance, setShardBalance] = useState(0)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    () => divineGambaService ? 'loading' : 'error',
  )
  const [error, setError] = useState<string | null>(
    () => divineGambaService ? configurationError : configurationError ?? `The ${DIVINE_GAMBA_NAME} is unavailable.`,
  )
  const [busyPartId, setBusyPartId] = useState<string | null>(null)
  const [skipped, setSkipped] = useState(false)
  const reducedMotion = useMemo(() => prefersReducedMotion(), [])

  const announceSettlement = useCallback((settlement: DivineGambaSettleResult): void => {
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

  /**
   * Counts the rift shards in the bag.
   *
   * A bag that cannot be read is not a reason to close the machine: the
   * count is only what the Shardwright shows beside its prices, so it is
   * left at zero and the player is told once.
   */
  const refreshShards = useCallback(async (): Promise<void> => {
    if (!inventoryService) {
      return
    }
    try {
      const items = await inventoryService.loadInventory()
      setShardBalance(items
        .filter((item) => item.definitionId === 'rift-shard')
        .reduce((total, item) => total + item.quantity, 0))
    } catch (shardError: unknown) {
      showToast(shardError instanceof Error ? shardError.message : 'Unable to count rift shards.', 'error')
    }
  }, [inventoryService, showToast])

  useEffect(() => {
    if (!divineGambaService) {
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const [owned] = await Promise.all([divineGambaService.loadOwnedParts(), refreshShards()])
        if (cancelled) {
          return
        }
        setOwnedPartIds(new Set(owned.map((part) => part.partId)))
        setLoadState('ready')
        setError(null)
        const settled = await resumePending()
        if (cancelled) {
          return
        }
        for (const settlement of settled) {
          showToast(`A drop from earlier paid out ${settlement.essenceWon} Essence.`)
          announceSettlement(settlement)
        }
      } catch (loadError: unknown) {
        if (!cancelled) {
          setLoadState('error')
          setError(loadError instanceof Error ? loadError.message : `Unable to open the ${DIVINE_GAMBA_NAME}.`)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [divineGambaService, refreshShards, resumePending, showToast, announceSettlement])

  const machine = useMemo(
    () => resolveDivineGambaMachine([...ownedPartIds], [...enabledModifierIds]),
    [ownedPartIds, enabledModifierIds],
  )
  const effectiveStake = machine.allowedStakes.includes(stake) ? stake : 1
  const stakePrice = getDivineGambaStakePrice(effectiveStake)
  const pricePerBall = getDivineGambaBallPrice(machine, effectiveStake)
  const cost = pricePerBall * ballCount
  const canAfford = essenceBalance !== null && essenceBalance >= cost
  const simMachine = useMemo(() => {
    const { allowedStakes: _stakes, ...config } = machine
    return config
  }, [machine])
  const odds = useMemo(() => measureDivineGambaOdds(simMachine, stakePrice), [simMachine, stakePrice])
  const landing = useMemo(() => mirrored(odds.landing), [odds])
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
  // The board shows the machine the drop in flight was paid for, so buying a
  // part mid-drop cannot move the pegs under the balls.
  const boardConfig = useMemo(() => {
    if (drop === null) {
      return simMachine
    }
    const { allowedStakes: _stakes, ...config } = drop.play.machine
    return config
  }, [drop, simMachine])

  const changeBallCount = (next: number): void => {
    const clamped = Math.min(DIVINE_GAMBA_MAX_BALLS, Math.max(1, Math.round(next)))
    setBallCount(clamped)
    store(BALL_COUNT_KEY, clamped)
  }

  const toggleModifier = (partId: string, enabled: boolean): void => {
    setEnabledModifierIds((current) => {
      const next = new Set(current)
      if (enabled) {
        next.add(partId)
      } else {
        next.delete(partId)
      }
      store(MODIFIERS_KEY, [...next])
      return next
    })
  }

  const launch = async (): Promise<void> => {
    if (play.isBusy || !canAfford) {
      return
    }
    setSkipped(false)
    await play.launch(ballCount, effectiveStake, [...enabledModifierIds].filter((id) => ownedPartIds.has(id)))
  }

  const buy = async (definition: DivineGambaPartDefinition): Promise<void> => {
    if (!divineGambaService || busyPartId !== null) {
      return
    }
    setBusyPartId(definition.id)
    try {
      const result = await divineGambaService.buyPart(crypto.randomUUID(), definition.id)
      setOwnedPartIds((current) => new Set([...current, result.partId]))
      showLootToast({
        title: 'Fitted to the machine',
        itemName: definition.name,
        icon: <span aria-hidden="true">◈</span>,
        reward: `−${result.essenceSpent} Essence, −${result.shardsSpent} shards`,
      })
      onEssenceChanged()
      await refreshShards()
    } catch (buyError: unknown) {
      showToast(buyError instanceof Error ? buyError.message : 'The Shardwright would not sell that.', 'error')
    } finally {
      setBusyPartId(null)
    }
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

  return (
    <section className="app-screen divine-gamba-screen" aria-labelledby="divine-gamba-title">
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
            <div>
              <dt>Rift shards</dt>
              <dd className="divine-gamba-shard-stat">
                <MaterialIcon icon="rift-shard" />
                <span>{shardBalance.toLocaleString()}</span>
              </dd>
            </div>
          </dl>
        </div>
        <header className="app-screen-title">
          <p className="screen-kicker">{DIVINE_GAMBA_KICKER}</p>
          <h2 id="divine-gamba-title">{DIVINE_GAMBA_NAME}</h2>
          <p className="app-screen-lede">{DIVINE_GAMBA_LEDE}</p>
        </header>
        {error ? <p className="persistence-error" role="alert">{error}</p> : null}
        {loadState === 'loading' ? (
          <p role="status">Lighting the machine…</p>
        ) : loadState === 'ready' ? (
          <div className="app-screen-panels divine-gamba-panels">
            <section className="app-panel divine-gamba-board-panel" aria-labelledby="divine-gamba-board-title">
              <header className="app-panel-heading">
                <div>
                  <p className="screen-kicker">The board</p>
                  <h3 id="divine-gamba-board-title">{machine.rows} rows, {machine.pockets.length} pockets</h3>
                </div>
                {session?.phase === 'dropping' ? (
                  <span className="app-panel-meta">{session.landedBalls} of {totalBalls} landed</span>
                ) : null}
              </header>
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
                  {[1, 2, 5].map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      className={`secondary-action divine-gamba-stake${effectiveStake === tier ? ' divine-gamba-stake-active' : ''}`}
                      disabled={play.isBusy || !machine.allowedStakes.includes(tier)}
                      aria-pressed={effectiveStake === tier}
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
                    <small>{pricePerBall} a ball</small>
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
                    {session?.phase === 'charging' ? 'Paying…' : play.isBusy ? 'Dropping…' : 'Drop'}
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
                      ) : null}
                    </>
                  )}
                  {session.phase === 'settled' || session.phase === 'failed' ? (
                    <button type="button" className="secondary-action" onClick={play.dismiss}>Clear</button>
                  ) : null}
                </div>
              ) : null}
            </section>
            <div className="divine-gamba-side">
            <section className="app-panel divine-gamba-odds-panel" aria-labelledby="divine-gamba-odds-title">
              <header className="app-panel-heading">
                <div>
                  <p className="screen-kicker">The odds, as set</p>
                  <h3 id="divine-gamba-odds-title">What this machine does</h3>
                </div>
              </header>
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
                    const multiplier = pocket.multiplierPercent * machine.multiplierScalePercent / 10000
                    const boxChance = Math.min(1, pocket.boxChanceBasisPoints * machine.boxChanceScalePercent / 1000000)
                    return (
                      <tr key={index} data-pays={multiplier >= 1 ? 'above' : 'below'}>
                        <th scope="row">{formatMultiplier(multiplier)}</th>
                        <td>{percent(landing[index] ?? 0)}</td>
                        <td>{boxChance > 0 ? percent(boxChance, 0) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
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
              {[...enabledModifierIds].filter((id) => ownedPartIds.has(id)).length > 0 ? (
                <p className="divine-gamba-odds-note">
                  On: {[...enabledModifierIds].filter((id) => ownedPartIds.has(id)).map((id) => getDivineGambaPartDefinition(id)?.name ?? id).join(', ')}.
                </p>
              ) : null}
            </section>
            <DivineGambaStorePanel
              ownedPartIds={ownedPartIds}
              enabledModifierIds={enabledModifierIds}
              essenceBalance={essenceBalance}
              shardBalance={shardBalance}
              busyPartId={busyPartId}
              locked={play.isBusy}
              onBuy={(definition) => { void buy(definition) }}
              onToggleModifier={toggleModifier}
            />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
