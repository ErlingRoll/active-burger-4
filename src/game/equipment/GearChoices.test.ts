import { describe, expect, it } from 'vitest'
import { getItemDefinition, INITIAL_ITEMS } from '../../content/gear/Items'
import { createGame } from '../Game'
import { Random } from '../random/Random'
import {
  getGearModifierCountForRarity,
} from '../../content/gear/ModifierPools'
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
  it('generates deterministic weighted, unique offers with rolled modifiers', () => {
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
    expect(
      firstChoices.every((choice) =>
        choice.type === 'gear'
          ? choice.modifiers.length === getGearModifierCountForRarity(choice.rarity) &&
            new Set(choice.modifiers.map((modifier) => modifier.id)).size === choice.modifiers.length
          : choice.upgradedModifiers.length > 0,
      ),
    ).toBe(true)
  })

  it('uses the exact gear rarity weights before choosing an item template', () => {
    const game = createGame({ seed: 403 })
    const highRoll = {
      next: () => 0.999,
      int: (min: number) => min,
      chance: () => false,
      pick: <T>(items: readonly T[]) => items[0] as T,
    }
    const choice = generateGearChoices(game.state, 1, highRoll)[0]
    expect(choice?.rarity).toBe('legendary')
  })

  it('rolls a set assignment independently for each generated item', () => {
    const game = createGame({ seed: 405 })
    const giantsRoll = {
      next: () => 0,
      int: (min: number) => min,
      chance: () => false,
      pick: <T>(items: readonly T[]) => items[0] as T,
    }
    const splinteringRoll = {
      next: () => 0,
      int: (min: number) => min,
      chance: () => false,
      pick: <T>(items: readonly T[]) => items[items.length - 1] as T,
    }

    expect(generateGearChoices(game.state, 1, giantsRoll)[0]).toMatchObject({
      type: 'gear',
      setId: 'giants',
    })
    expect(generateGearChoices(game.state, 1, splinteringRoll)[0]).toMatchObject({
      type: 'gear',
      setId: 'splintering',
    })
  })

  it('can surface every weapon archetype as a distinct gear template', () => {
    const game = createGame({ seed: 404 })
    const choices = generateGearChoices(
      game.state,
      INITIAL_ITEMS.length,
      new Random(404),
    )

    expect(
      new Set(
        choices
          .filter((choice) => choice.type === 'gear' && choice.slot === 'weapon')
          .map((choice) => choice.itemId),
      ),
    ).toEqual(new Set(['iron-cleaver', 'hunters-bow', 'starcall-wand']))
  })

  it('always offers Rangers at least one bow or wand gear template', () => {
    const allHaveRangedOption = Array.from({ length: 32 }, (_, seed) => {
      const game = createGame({ seed, playstyleId: 'ranger' })
      const choices = generateGearChoices(
        game.state,
        GEAR_CHOICES_PER_PICKUP,
        new Random(seed),
      )
      return choices.some((choice) => {
        if (choice.type !== 'gear') {
          return false
        }
        const definition = getItemDefinition(choice.itemId)
        return definition.slot === 'weapon' &&
          (definition.weaponArchetype === 'bow' || definition.weaponArchetype === 'wand')
      })
    })

    expect(allHaveRangedOption.every(Boolean)).toBe(true)
  })

  it('offers and applies a one-tier equipped-item modifier upgrade with a persistent roll', () => {
    const game = createGame({ seed: 401 })
    equipItem(game.state.player, 'iron-cleaver')
    const choices = generateGearChoices(game.state, 3, new Random(401))
    const upgrade = choices.find(
      (choice) => choice.type === 'upgrade-equipped-item',
    )
    expect(upgrade).toMatchObject({
      itemId: 'iron-cleaver',
      rarity: 'common',
      upgradedModifierId: 'melee-leech',
      fromTier: 4,
      toTier: 3,
    })

    if (!upgrade || upgrade.type !== 'upgrade-equipped-item') {
      throw new Error('Expected an equipped-item upgrade choice')
    }
    expect(upgrade.upgradedModifiers).toHaveLength(1)
    expect(upgrade.upgradedModifiers[0]).toMatchObject({
      id: 'melee-leech',
      tier: 3,
      value: 3,
    })
    expect(
      upgradeEquippedItem(
        game.state.player,
        upgrade.slot,
        upgrade.upgradedModifiers,
      ),
    ).toBe(true)
    const rolled = game.state.player.equipment?.weapon
    expect(rolled?.rarity).toBe('common')
    expect(rolled?.modifiers).toEqual(upgrade.upgradedModifiers)

    const before = createUiSnapshot(game.state)
    const after = createUiSnapshot(game.state)
    expect(after.equipment.weapon).toEqual(before.equipment.weapon)
  })

  it('offers upgrades only for equipped items with at least one modifier below Tier 1', () => {
    const game = createGame({ seed: 402 })
    equipItem(game.state.player, 'bastion-plate')
    expect(
      generateGearChoices(game.state, 3, new Random(402)).some(
        (choice) => choice.type === 'upgrade-equipped-item',
      ),
    ).toBe(true)
    const armor = game.state.player.equipment?.armor
    if (!armor?.modifiers) {
      throw new Error('Expected armor with rolled modifiers')
    }
    armor.modifiers = armor.modifiers.map((modifier) => ({
      ...modifier,
      tier: 1,
    }))
    expect(
      generateGearChoices(game.state, 3, new Random(402)).some(
        (choice) => choice.type === 'upgrade-equipped-item',
      ),
    ).toBe(false)
  })
})
