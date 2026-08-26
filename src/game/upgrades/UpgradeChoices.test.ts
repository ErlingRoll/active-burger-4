import { describe, expect, it } from 'vitest'
import { INITIAL_UPGRADES } from '../../content/upgrades/Upgrades'
import { Random } from '../random/Random'
import { createGame } from '../Game'
import { generateUpgradeChoices } from './UpgradeChoices'

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
    expect(choices.map((choice) => choice.upgradeId).sort()).toEqual(
      INITIAL_UPGRADES.map((upgrade) => upgrade.id).sort(),
    )
  })
})
