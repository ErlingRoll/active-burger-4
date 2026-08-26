import { describe, expect, it } from 'vitest'
import { createGame } from '../Game'
import { Random } from '../random/Random'
import {
  generateGearChoices,
  GEAR_CHOICES_PER_PICKUP,
} from './GearChoices'
import {
  equipItem,
  upgradeEquippedItem,
} from './EquipmentState'
import { createUiSnapshot } from '../ui/Snapshots'

describe('gear choices', () => {
  it('generates deterministic weighted, unique offers', () => {
    const first = createGame({ seed: 400 })
    const second = createGame({ seed: 400 })
    const firstChoices = generateGearChoices(
      first.state,
      GEAR_CHOICES_PER_PICKUP,
      new Random(400),
    )
    const secondChoices = generateGearChoices(
      second.state,
      GEAR_CHOICES_PER_PICKUP,
      new Random(400),
    )

    expect(firstChoices).toEqual(secondChoices)
    expect(new Set(firstChoices.map((choice) => choice.itemId)).size).toBe(3)
    expect(firstChoices.every((choice) => choice.rarity)).toBe(true)
  })

  it('uses rarity weights before choosing an item in that rarity', () => {
    const game = createGame({ seed: 403 })
    const highRoll = {
      next: () => 0.999,
      int: () => 0,
      chance: () => false,
      pick: <T>(items: readonly T[]) => items[0] as T,
    }
    const choice = generateGearChoices(game.state, 1, highRoll)[0]
    expect(choice?.rarity).toBe('legendary')
  })

  it('offers and applies an equipped-item upgrade with a persistent roll', () => {
    const game = createGame({ seed: 401 })
    equipItem(game.state.player, 'iron-cleaver')
    const choices = generateGearChoices(game.state, 3, new Random(401))
    const upgrade = choices.find(
      (choice) => choice.type === 'upgrade-equipped-item',
    )
    expect(upgrade).toMatchObject({
      itemId: 'iron-cleaver',
      fromRarity: 'common',
      upgradedRarity: 'uncommon',
      rarity: 'rare',
    })

    if (!upgrade || upgrade.type !== 'upgrade-equipped-item') {
      throw new Error('Expected an equipped-item upgrade choice')
    }
    expect(upgrade.upgradedModifiers[0]?.value).toBeGreaterThan(3)
    expect(
      upgradeEquippedItem(
        game.state.player,
        upgrade.slot,
        upgrade.upgradedModifiers,
      ),
    ).toBe(true)
    const rolled = game.state.player.equipment?.weapon
    expect(rolled?.rarity).toBe('uncommon')
    expect(rolled?.modifiers).toEqual(upgrade.upgradedModifiers)

    const before = createUiSnapshot(game.state)
    const after = createUiSnapshot(game.state)
    expect(after.equipment.weapon).toEqual(before.equipment.weapon)
  })

  it('caps upgrades at rare-to-epic and excludes epic or legendary equipment', () => {
    const game = createGame({ seed: 402 })
    equipItem(game.state.player, 'bastion-plate')
    const rare = game.state.player.equipment?.armor
    if (!rare) {
      throw new Error('Expected armor')
    }
    rare.rarity = 'rare'
    expect(
      generateGearChoices(game.state, 3, new Random(402)).some(
        (choice) => choice.type === 'upgrade-equipped-item',
      ),
    ).toBe(true)
    rare.rarity = 'epic'
    expect(
      generateGearChoices(game.state, 3, new Random(402)).some(
        (choice) => choice.type === 'upgrade-equipped-item',
      ),
    ).toBe(false)
  })
})
