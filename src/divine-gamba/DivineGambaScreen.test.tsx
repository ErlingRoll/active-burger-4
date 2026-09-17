// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderComponent, screen, waitFor, within } from '../testing/render'
import type { InventoryItemInstance, InventoryService } from '../inventory/InventoryTypes'
import { DivineGambaScreen } from './DivineGambaScreen'
import {
  getDivineGambaBallPrice,
  getDivineGambaStakePrice,
  resolveDivineGambaMachine,
} from './DivineGambaRegistry'
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
function fakeService(options: { owned?: string[], shards?: number, freeDrop?: boolean, boxes?: string } = {}) {
  const owned = new Set(options.owned ?? [])
  const plays = new Map<number, DivineGambaBeginResult>()
  let balance = 1000
  let freeSpent = false
  const service: DivineGambaService = {
    loadOwnedParts: vi.fn(async () => [...owned].map((partId) => ({ partId, acquiredAt: '2026-09-17T00:00:00Z' }))),
    loadPendingPlays: vi.fn(async () => []),
    loadFreeDropState: vi.fn(async () => ({
      available: (options.freeDrop ?? false) && !freeSpent,
      resetsAt: '2099-01-01T00:00:00+00:00',
      serverTime: '2026-09-17T11:00:00+00:00',
    })),
    beginPlay: vi.fn(async (_operationId: string, ballCount: number, stake: number, modifierIds: readonly string[], free = false) => {
      const machine = resolveDivineGambaMachine([...owned], [...modifierIds])
      if (options.boxes !== undefined) {
        // Every pocket drops a box of one rarity, so the reveal is exercised.
        machine.pockets = machine.pockets.map((pocket) => ({ ...pocket, boxChanceBasisPoints: 10000 }))
        machine.boxRarityWeights = { [options.boxes]: 1 }
      }
      const pricePerBall = free ? 0 : getDivineGambaBallPrice(machine, stake)
      if (free) {
        freeSpent = true
      }
      balance -= pricePerBall * ballCount
      const play: DivineGambaBeginResult = {
        playId: plays.size + 1,
        seed: 305419896,
        simVersion: 1,
        stake,
        ballCount,
        stakePrice: getDivineGambaStakePrice(stake),
        pricePerBall,
        modifierIds: [...modifierIds],
        machine,
        essenceSpent: pricePerBall * ballCount,
        essenceBalance: balance,
        free,
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
      const { allowedStakes: _stakes, ...machine } = play.machine
      const outcome = simulatePlay({ seed: play.seed, machine, ballCount: play.ballCount, stakePrice: play.stakePrice })
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
          parentIndex: ball.parentIndex,
          pocketIndex: ball.pocketIndex,
          landedTick: ball.landedTick,
          essenceWon: ball.essenceWon,
          boxRarity: ball.boxRarity,
          boxDefinitionId: ball.boxRarity === null ? null : `loot-box-${ball.boxRarity}`,
          boxInstanceId: ball.boxRarity === null ? null : `instance-${ball.ballIndex}`,
        })),
      }
    }),
    buyPart: vi.fn(async (_operationId: string, partId: string) => {
      owned.add(partId)
      return { partId, essenceSpent: 600, shardsSpent: 10, essenceBalance: 400, wasProcessed: true }
    }),
  }
  const inventory = {
    loadInventory: vi.fn(async () => [
      { itemInstanceId: 'shards', definitionId: 'rift-shard', quantity: options.shards ?? 0, bound: false },
    ] as unknown as InventoryItemInstance[]),
  } as unknown as InventoryService
  return { service, inventory }
}

function renderScreen(overrides: Partial<Parameters<typeof DivineGambaScreen>[0]> = {}, options: { owned?: string[], shards?: number, freeDrop?: boolean, boxes?: string } = {}) {
  const fakes = fakeService(options)
  const onEssenceChanged = vi.fn()
  const result = renderComponent(
    <DivineGambaScreen
      divineGambaService={fakes.service}
      inventoryService={fakes.inventory}
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

  it('offers the day\'s free drop as one house ball, and spends it', async () => {
    const { user, service } = renderScreen({ essenceBalance: 0 }, { freeDrop: true })
    const free = await screen.findByRole('button', { name: 'Free drop' })
    expect(free).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Drop' })).toBeDisabled()
    await user.click(free)
    await waitFor(() => expect(service.beginPlay).toHaveBeenCalledWith(expect.any(String), 1, 1, [], true))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Free drop' })).toBeDisabled())
    expect(screen.getByText(/Back in/)).toBeInTheDocument()
  })

  it('will not drop what the player cannot pay for', async () => {
    renderScreen({ essenceBalance: 10 })
    const drop = await screen.findByRole('button', { name: 'Drop' })
    expect(drop).toBeDisabled()
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
    expect(service.beginPlay).toHaveBeenCalledTimes(1)
    expect(service.settlePlay).toHaveBeenCalledWith(1)
    const settlement = await (service.settlePlay as ReturnType<typeof vi.fn>).mock.results[0]?.value as DivineGambaSettleResult
    expect(within(tally as HTMLElement).getByLabelText(`${settlement.essenceWon.toLocaleString()} Essence`)).toBeInTheDocument()
    expect(within(tally as HTMLElement).getByText('5 / 5')).toBeInTheDocument()
    expect(onEssenceChanged).toHaveBeenCalled()
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

  it('sends only the modifiers the player owns and has switched on', async () => {
    const { user, service } = renderScreen({}, { owned: ['steady-hand'] })
    const toggle = await screen.findByRole('checkbox')
    await user.click(toggle)
    await user.click(screen.getByRole('button', { name: 'Drop' }))
    await waitFor(() => expect(service.beginPlay).toHaveBeenCalledWith(expect.any(String), 5, 1, ['steady-hand'], false))
  })

  it('buys a part from the Shardwright and marks it fitted', async () => {
    const { user, service } = renderScreen({}, { shards: 50 })
    const line = (await screen.findByText('Brass rails')).closest('li')
    expect(line).not.toBeNull()
    const buy = within(line as HTMLElement).getByRole('button', { name: 'Buy' })
    await user.click(buy)
    await waitFor(() => expect(service.buyPart).toHaveBeenCalledWith(expect.any(String), 'brass-rails'))
    await waitFor(() => expect(within(line as HTMLElement).getByText('Fitted')).toBeInTheDocument())
  })

  it('keeps a part the player cannot afford in shards on the shelf but not for sale', async () => {
    renderScreen({}, { shards: 0 })
    const line = (await screen.findByText('Brass rails')).closest('li')
    expect(within(line as HTMLElement).getByRole('button', { name: 'Buy' })).toBeDisabled()
  })
})
