// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderComponent, screen, waitFor, within } from '../testing/render'
import { DivineGambaScreen } from './DivineGambaScreen'
import { DIVINE_GAMBA_MACHINE, getDivineGambaStakePrice } from './DivineGambaRegistry'
import type {
  DivineGambaBeginResult,
  DivineGambaService,
  DivineGambaSettleResult,
} from './DivineGambaTypes'
import { simulatePlay } from './sim'

/**
 * A fake house: pays for a play the way the server does and settles it by
 * running the same simulation, so the numbers the screen shows at the end
 * are the ones the real house would send.
 */
function fakeService(options: { boxes?: string } = {}) {
  const plays = new Map<number, DivineGambaBeginResult>()
  let balance = 1000
  const service: DivineGambaService = {
    loadPendingPlays: vi.fn(async () => []),
    beginPlay: vi.fn(async (_operationId: string, ballCount: number, stake: number) => {
      const machine = {
        ...DIVINE_GAMBA_MACHINE,
        pockets: DIVINE_GAMBA_MACHINE.pockets.map((pocket) => ({ ...pocket })),
        boxRarityWeights: { ...DIVINE_GAMBA_MACHINE.boxRarityWeights },
      }
      if (options.boxes !== undefined) {
        // Every pocket drops a box of one rarity, so the reveal is exercised.
        machine.pockets = machine.pockets.map((pocket) => ({ ...pocket, boxChanceBasisPoints: 10000 }))
        machine.boxRarityWeights = { [options.boxes]: 1 }
      }
      const pricePerBall = getDivineGambaStakePrice(stake)
      balance -= pricePerBall * ballCount
      const play: DivineGambaBeginResult = {
        playId: plays.size + 1,
        seed: 305419896,
        simVersion: 1,
        stake,
        ballCount,
        stakePrice: pricePerBall,
        pricePerBall,
        machine,
        essenceSpent: pricePerBall * ballCount,
        essenceBalance: balance,
        wasProcessed: true,
      }
      plays.set(play.playId, play)
      return play
    }),
    settlePlay: vi.fn(async (playId: number): Promise<DivineGambaSettleResult> => {
      const play = plays.get(playId)
      if (play === undefined) {
        throw new Error('No such play.')
      }
      const outcome = simulatePlay({ seed: play.seed, machine: play.machine, ballCount: play.ballCount, stakePrice: play.stakePrice })
      balance += outcome.essenceWon
      return {
        playId,
        essenceSpent: play.essenceSpent,
        essenceWon: outcome.essenceWon,
        boxCount: outcome.boxCount,
        essenceBalance: balance,
        wasProcessed: true,
        balls: outcome.balls.map((ball) => ({
          ballIndex: ball.ballIndex,
          pocketIndex: ball.pocketIndex,
          landedTick: ball.landedTick,
          essenceWon: ball.essenceWon,
          boxRarity: ball.boxRarity,
          boxDefinitionId: ball.boxRarity === null ? null : `loot-box-${ball.boxRarity}`,
          boxInstanceId: ball.boxRarity === null ? null : `instance-${ball.ballIndex}`,
        })),
      }
    }),
  }
  return { service }
}

function renderScreen(overrides: Partial<Parameters<typeof DivineGambaScreen>[0]> = {}, options: { boxes?: string } = {}) {
  const fakes = fakeService(options)
  const onEssenceChanged = vi.fn()
  const result = renderComponent(
    <DivineGambaScreen
      divineGambaService={fakes.service}
      essenceBalance={1000}
      configurationError={null}
      onBack={vi.fn()}
      onEssenceChanged={onEssenceChanged}
      {...overrides}
    />,
  )
  return { ...result, ...fakes, onEssenceChanged }
}

beforeEach(() => {
  // No animation in a test: every ball lands the moment it is dropped.
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
  localStorage.clear()
})

describe('DivineGambaScreen', () => {
  it('explains itself when the machine is unavailable', () => {
    renderScreen({ divineGambaService: null, configurationError: 'Supabase is not configured.' })
    expect(screen.getByRole('alert')).toHaveTextContent('Supabase is not configured.')
  })

  it('will not drop what the player cannot pay for', async () => {
    renderScreen({ essenceBalance: 10 })
    const drop = await screen.findByRole('button', { name: 'Drop' })
    expect(drop).toBeDisabled()
  })

  it('shows the chance this drop profits, for the ball count chosen', async () => {
    const { user } = renderScreen()
    await screen.findByRole('button', { name: 'Drop' })
    expect(screen.getByText('This drop profits')).toBeInTheDocument()
    expect(screen.getByText(/over 5 balls/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'One ball fewer' }))
    expect(screen.getByText(/over 4 balls/)).toBeInTheDocument()
  })

  it('pays, drops, and shows the house\'s tally', async () => {
    const { user, service, onEssenceChanged } = renderScreen()
    const drop = await screen.findByRole('button', { name: 'Drop' })
    expect(drop).toBeEnabled()
    await user.click(drop)

    // A box that fell is opened before the tally settles: collect each one.
    await waitFor(() => {
      const collect = screen.queryByRole('button', { name: /Collect|Next box/ })
      const settled = screen.queryByText('Net')
      expect(collect !== null || settled !== null).toBe(true)
    })
    while (screen.queryByRole('button', { name: /Collect|Next box/ }) !== null) {
      await user.click(screen.getByRole('button', { name: /Collect|Next box/ }))
    }
    const tally = (await screen.findAllByRole('status')).find((element) => element.classList.contains('divine-gamba-tally'))
    expect(tally).toBeDefined()
    await waitFor(() => expect(within(tally as HTMLElement).getByText('Net')).toBeInTheDocument())
    expect(service.beginPlay).toHaveBeenCalledWith(expect.any(String), 5, 1)
    expect(service.settlePlay).toHaveBeenCalledWith(1)
    const settlement = await (service.settlePlay as ReturnType<typeof vi.fn>).mock.results[0]?.value as DivineGambaSettleResult
    expect(within(tally as HTMLElement).getByLabelText(`${settlement.essenceWon.toLocaleString()} Essence`)).toBeInTheDocument()
    expect(within(tally as HTMLElement).getByText('5 / 5')).toBeInTheDocument()
    expect(onEssenceChanged).toHaveBeenCalled()
  })

  it('drops at the stake chosen, and prices the drop by it', async () => {
    const { user, service } = renderScreen()
    await screen.findByRole('button', { name: 'Drop' })
    await user.click(screen.getByRole('button', { name: '×5' }))
    expect(screen.getByText('100 a ball')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Drop' }))
    await waitFor(() => expect(service.beginPlay).toHaveBeenCalledWith(expect.any(String), 5, 5))
  })

  it('opens a box that fell on a reel that stops on the rarity the ball rolled', async () => {
    // The jackpot machine with a forced rarity table: every box is rare.
    const { user, service } = renderScreen({}, { boxes: 'rare' })
    await user.click(await screen.findByRole('button', { name: 'Drop' }))
    const dialog = await screen.findByRole('dialog', { name: /Opening box/ })
    expect(within(dialog).getByText('Rare loot box')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /Collect|Next box/ }))
    while (screen.queryByRole('button', { name: /Collect|Next box/ }) !== null) {
      await user.click(screen.getByRole('button', { name: /Collect|Next box/ }))
    }
    await waitFor(() => expect(service.settlePlay).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByText('Net')).toBeInTheDocument())
  })
})
