import { describe, expect, it } from 'vitest'
import { getItemDefinition, INITIAL_ITEMS } from '../../content/gear/Items'
import { createGame } from '../Game'
import { Random } from '../random/Random'
import {
  getGearModifierCountForRarity,
  createGearModifier,
} from '../../content/gear/ModifierPools'
import {
  generateGearChoices,
  GEAR_CHOICES_PER_PICKUP,
  type GearItemChoice,
} from './GearChoices'
import {
  equipItem,
  equipRolledItem,
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
    const gearChoices = firstChoices.filter((choice) => choice.type === 'gear')
    expect(new Set(gearChoices.map((choice) => choice.itemId)).size).toBe(gearChoices.length)
    expect(firstChoices.every((choice) =>
      choice.type === 'gear-rarity-floor' || 'rarity' in choice
    )).toBe(true)
    expect(
      firstChoices.every((choice) =>
        choice.type === 'gear'
          ? choice.modifiers.length === getGearModifierCountForRarity(choice.rarity) &&
            new Set(choice.modifiers.map((modifier) => modifier.id)).size === choice.modifiers.length
          : choice.type === 'upgrade-equipped-item'
            ? choice.upgradedModifiers.length > 0
            : true,
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
    expect(choice?.type === 'gear' ? choice.rarity : undefined).toBe('legendary')
  })

  it('weights empty equipment slots more heavily when choosing gear templates', () => {
    const game = createGame({ seed: 408 })
    for (const itemId of [
      'iron-cleaver',
      'bastion-plate',
      'swiftstride-boots',
      'duelists-band',
      'giants-amulet',
    ] as const) {
      equipItem(game.state.player, itemId)
    }
    Object.values(game.state.player.equipment ?? {}).forEach((item) => {
      item.modifiers = []
    })

    const choice = generateGearChoices(game.state, 1, {
      next: () => 0,
      int: () => 4,
      chance: () => false,
      pick: <T>(items: readonly T[]) => items[0] as T,
    })[0]

    expect(choice?.type === 'gear' ? choice.slot : undefined).toBe('helmet')
  })

  it('can offer one-time minimum-rarity blessings as gear improves', () => {
    const game = createGame({ seed: 406 })
    for (const itemId of [
      'iron-cleaver',
      'watchers-helm',
      'bastion-plate',
      'swiftstride-boots',
      'duelists-band',
      'giants-amulet',
    ] as const) {
      equipItem(game.state.player, itemId)
    }
    Object.values(game.state.player.equipment ?? {}).forEach((item) => {
      item.rarity = 'common'
    })
    const guaranteedBlessing = {
      next: () => 0,
      int: (min: number) => min,
      chance: () => true,
      pick: <T>(items: readonly T[]) => items[0] as T,
    }

    const commonBlessing = generateGearChoices(
      game.state,
      GEAR_CHOICES_PER_PICKUP,
      guaranteedBlessing,
    ).find((choice) => choice.type === 'gear-rarity-floor')
    expect(commonBlessing).toEqual({
      type: 'gear-rarity-floor',
      minimumRarity: 'uncommon',
    })

    const equippedItems = Object.values(game.state.player.equipment ?? {})
    const firstEquippedItem = equippedItems[0]
    if (!firstEquippedItem) {
      throw new Error('Expected equipped gear')
    }
    firstEquippedItem.rarity = 'uncommon'
    expect(
      generateGearChoices(game.state, GEAR_CHOICES_PER_PICKUP, guaranteedBlessing)
        .find((choice) => choice.type === 'gear-rarity-floor'),
    ).toEqual({
      type: 'gear-rarity-floor',
      minimumRarity: 'uncommon',
    })

    game.state.player.gearRarityFloor = 'uncommon'
    expect(
      generateGearChoices(game.state, GEAR_CHOICES_PER_PICKUP, guaranteedBlessing)
        .some((choice) => choice.type === 'gear-rarity-floor'),
    ).toBe(false)
    expect(
      generateGearChoices(game.state, GEAR_CHOICES_PER_PICKUP, guaranteedBlessing)
        .filter((choice) => choice.type === 'gear')
        .every((choice) => choice.rarity !== 'common'),
    ).toBe(true)

    equippedItems.forEach((item) => {
      item.rarity = 'uncommon'
    })
    firstEquippedItem.rarity = 'rare'
    const rareBlessing = generateGearChoices(
      game.state,
      GEAR_CHOICES_PER_PICKUP,
      guaranteedBlessing,
    ).find((choice) => choice.type === 'gear-rarity-floor')
    expect(rareBlessing).toEqual({
      type: 'gear-rarity-floor',
      minimumRarity: 'rare',
    })

    equippedItems.forEach((item) => {
      item.rarity = 'rare'
    })
    game.state.player.gearRarityFloor = 'rare'
    expect(
      generateGearChoices(game.state, GEAR_CHOICES_PER_PICKUP, guaranteedBlessing)
        .some((choice) => choice.type === 'gear-rarity-floor'),
    ).toBe(false)
  })

  it('places a blessing before an item upgrade when both are offered', () => {
    const game = createGame({ seed: 407 })
    for (const itemId of [
      'iron-cleaver',
      'watchers-helm',
      'bastion-plate',
      'swiftstride-boots',
      'duelists-band',
      'giants-amulet',
    ] as const) {
      equipItem(game.state.player, itemId)
    }
    Object.values(game.state.player.equipment ?? {}).forEach((item) => {
      item.rarity = 'common'
    })

    const specialChoices = generateGearChoices(game.state, GEAR_CHOICES_PER_PICKUP, {
      next: () => 0,
      int: (min: number) => min,
      chance: () => true,
      pick: <T>(items: readonly T[]) => items[0] as T,
    })

    expect(specialChoices[0]?.type).toBe('gear-rarity-floor')
    expect(specialChoices[1]?.type).toBe('upgrade-equipped-item')
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

    const giantsChoice = generateGearChoices(game.state, 1, giantsRoll)[0]
    const splinteringChoice = generateGearChoices(game.state, 1, splinteringRoll)[0]

    expect(giantsChoice).toMatchObject({
      type: 'gear',
      setId: 'giants',
    })
    expect(splinteringChoice).toMatchObject({
      type: 'gear',
      setId: 'splintering',
    })
    expect(giantsChoice?.type === 'gear' ? giantsChoice.itemId : undefined).toBe(
      splinteringChoice?.type === 'gear' ? splinteringChoice.itemId : undefined,
    )
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
          .filter((choice): choice is GearItemChoice =>
            choice.type === 'gear' && choice.slot === 'weapon'
          )
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
    expect(choices[0]).toBe(upgrade)
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
    equipRolledItem(
      game.state.player,
      'armor',
      'common',
      [createGearModifier('armor', 'max-hp', 4, 21)],
    )
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
