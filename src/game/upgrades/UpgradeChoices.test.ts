import { describe, expect, it } from 'vitest'
import { INITIAL_UPGRADES } from '../../content/upgrades/Upgrades'
import { Random } from '../random/Random'
import { createGame } from '../Game'
import { generateUpgradeChoices } from './UpgradeChoices'
import { applyUpgrade } from '../systems/upgrades/UpgradeSystem'

describe('upgrade choice generation', () => {
  it('generates the same three-choice order for the same seed', () => {
    const gameA = createGame({ seed: 123 })
    const gameB = createGame({ seed: 123 })

    const choicesA = generateUpgradeChoices(gameA.state, 3, gameA.random)
    const choicesB = generateUpgradeChoices(gameB.state, 3, gameB.random)

    expect(choicesA).toEqual(choicesB)
  })

  it('returns exactly three unique eligible upgrades', () => {
    const game = createGame({ seed: 456 })
    const choices = generateUpgradeChoices(game.state, 3, new Random(456))

    expect(choices).toHaveLength(3)
    expect(new Set(choices.map((choice) => choice.upgradeId)).size).toBe(3)
    expect(
      choices.every((choice) =>
        INITIAL_UPGRADES.some((upgrade) => upgrade.id === choice.upgradeId),
      ),
    ).toBe(true)
  })

  it('enables a skill rank choice after its unlock and never offers the unlock twice', () => {
    const game = createGame({ seed: 457 })
    applyUpgrade(game.state, 'whirlwind-unlock')
    game.state.player.skillSlotCount = 2
    const choices = generateUpgradeChoices(game.state, 5, new Random(1))
    const ids = choices.map((choice) => choice.upgradeId)

    expect(ids).toContain('whirlwind-level')
    expect(ids).not.toContain('whirlwind-unlock')
  })

  it('does not offer new skills when every skill slot is filled', () => {
    const game = createGame({ seed: 458 })
    game.state.player.skillSlotCount = game.state.player.skills.length

    const choices = generateUpgradeChoices(game.state, 3, new Random(2))

    expect(choices.map((choice) => choice.upgradeId)).not.toContain('chain-lightning-unlock')
    expect(choices.map((choice) => choice.upgradeId)).not.toContain('whirlwind-unlock')
  })

  it('includes a deterministic skill removal card when its chance succeeds', () => {
    const game = createGame({ seed: 459 })
    const rng = {
      next: () => 0.99,
      int: (min: number) => min,
      chance: () => true,
      pick: <T>(items: readonly T[]) => items[0] as T,
    }

    const choices = generateUpgradeChoices(game.state, 3, rng)
    const removal = choices.find((choice) => choice.upgradeId === 'remove-skill')

    expect(removal).toMatchObject({
      upgradeId: 'remove-skill',
      skillId: 'whirlwind',
      rarity: 'rare',
    })
  })
})
