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
function fakeService(options: { owned?: string[], shards?: number } = {}) {
  const owned = new Set(options.owned ?? [])
  const plays = new Map<number, DivineGambaBeginResult>()
  let balance = 1000
  const service: DivineGambaService = {
    loadOwnedParts: vi.fn(async () => [...owned].map((partId) => ({ partId, acquiredAt: '2026-09-17T00:00:00Z' }))),
    loadPendingPlays: vi.fn(async () => []),
    beginPlay: vi.fn(async (_operationId: string, ballCount: number, stake: number, modifierIds: readonly string[]) => {
      const machine = resolveDivineGambaMachine([...owned], [...modifierIds])
      const pricePerBall = getDivineGambaBallPrice(machine, stake)
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

function renderScreen(overrides: Partial<Parameters<typeof DivineGambaScreen>[0]> = {}, options: { owned?: string[], shards?: number } = {}) {
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

    const tally = await screen.findByRole('status')
    await waitFor(() => expect(within(tally).getByText('Net')).toBeInTheDocument())
    expect(service.beginPlay).toHaveBeenCalledTimes(1)
    expect(service.settlePlay).toHaveBeenCalledWith(1)
    const settlement = await (service.settlePlay as ReturnType<typeof vi.fn>).mock.results[0]?.value as DivineGambaSettleResult
    expect(within(tally).getByLabelText(`${settlement.essenceWon.toLocaleString()} Essence`)).toBeInTheDocument()
    expect(within(tally).getByText('5 / 5')).toBeInTheDocument()
    expect(onEssenceChanged).toHaveBeenCalled()
  })

  it('sends only the modifiers the player owns and has switched on', async () => {
    const { user, service } = renderScreen({}, { owned: ['steady-hand'] })
    const toggle = await screen.findByRole('checkbox')
    await user.click(toggle)
    await user.click(screen.getByRole('button', { name: 'Drop' }))
    await waitFor(() => expect(service.beginPlay).toHaveBeenCalledWith(expect.any(String), 5, 1, ['steady-hand']))
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
