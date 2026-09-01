import { describe, expect, it } from 'vitest'
import {
  EQUIPMENT_SLOTS,
  getItemDefinition,
  INITIAL_ITEMS,
} from '../../content/gear/Items'
import {
  CHARACTER_CLASS_DEFINITIONS,
  CHARACTER_CLASS_IDS,
} from '../../game-config/classes'
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
import { GEAR_XP_BLESSING_CHANCE } from '../../game-config/gear'
import {
  equipItem,
  equipRolledItem,
  rollItemUpgradeModifiers,
  upgradeEquippedItem,
} from './EquipmentState'
import { Rarity } from '../../content/rarity/Rarity'
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
    expect(choice?.type === 'gear' ? choice.rarity : undefined).toBe(Rarity.Legendary)
  })

  it('weights each available equipment slot equally when choosing gear templates', () => {
    const game = createGame({ seed: 408 })
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
      item.modifiers = []
    })

    for (const [slotIndex, expectedSlot] of EQUIPMENT_SLOTS.entries()) {
      let slotRollPending = true
      const choice = generateGearChoices(game.state, 1, {
        next: () => 0,
        int: (min: number, _max: number) => {
          if (slotRollPending) {
            slotRollPending = false
            return slotIndex
          }
          return min
        },
        chance: () => false,
        pick: <T>(items: readonly T[]) => items[0] as T,
      })[0]

      expect(choice?.type === 'gear' ? choice.slot : undefined).toBe(expectedSlot)
    }
  })

  it('weights empty equipment slots twice as heavily as occupied slots', () => {
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

    const expectedSlots = [
      'weapon',
      'helmet',
      'helmet',
      'armor',
      'boots',
      'ring',
      'amulet',
    ] as const
    for (const [slotRoll, expectedSlot] of expectedSlots.entries()) {
      let slotRollPending = true
      const choice = generateGearChoices(game.state, 1, {
        next: () => 0,
        int: (min: number, _max: number) => {
          if (slotRollPending) {
            slotRollPending = false
            return slotRoll
          }
          return min
        },
        chance: () => false,
        pick: <T>(items: readonly T[]) => items[0] as T,
      })[0]

      expect(choice?.type === 'gear' ? choice.slot : undefined).toBe(expectedSlot)
    }
  })

  it('weights the starting weapon type twice as heavily as other weapon types', () => {
    for (const characterClassId of CHARACTER_CLASS_IDS) {
      const game = createGame({ seed: 408, characterClassId })
      const startingWeapon = getItemDefinition(
        CHARACTER_CLASS_DEFINITIONS[characterClassId].startingWeaponItemId,
      )
      const archetypes = Array.from({ length: 5 }, (_, weaponRoll) => {
        let slotRollPending = true
        let templateRollPending = true
        const choice = generateGearChoices(game.state, 1, {
          next: () => 0,
          int: (min: number, max: number) => {
            if (slotRollPending) {
              slotRollPending = false
              return 0
            }
            if (templateRollPending && max === 4) {
              templateRollPending = false
              return weaponRoll
            }
            return min
          },
          chance: () => false,
          pick: <T>(items: readonly T[]) => items[0] as T,
        })[0]
        if (choice?.type !== 'gear' || choice.slot !== 'weapon') {
          throw new Error('Expected a weapon gear choice')
        }
        return getItemDefinition(choice.itemId).weaponArchetype
      })

      expect(archetypes.filter((archetype) =>
        archetype === startingWeapon.weaponArchetype
      )).toHaveLength(2)
      expect(new Set(archetypes)).toEqual(new Set([
        'sword',
        'bow',
        'wand',
        'staff',
      ]))
    }
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
      item.rarity = Rarity.Common
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
      minimumRarity: Rarity.Uncommon,
    })

    const equippedItems = Object.values(game.state.player.equipment ?? {})
    const firstEquippedItem = equippedItems[0]
    if (!firstEquippedItem) {
      throw new Error('Expected equipped gear')
    }
    firstEquippedItem.rarity = Rarity.Uncommon
    expect(
      generateGearChoices(game.state, GEAR_CHOICES_PER_PICKUP, guaranteedBlessing)
        .find((choice) => choice.type === 'gear-rarity-floor'),
    ).toEqual({
      type: 'gear-rarity-floor',
      minimumRarity: Rarity.Uncommon,
    })

    game.state.player.gearRarityFloor = Rarity.Uncommon
    expect(
      generateGearChoices(game.state, GEAR_CHOICES_PER_PICKUP, guaranteedBlessing)
        .some((choice) => choice.type === 'gear-rarity-floor'),
    ).toBe(false)
    expect(
      generateGearChoices(game.state, GEAR_CHOICES_PER_PICKUP, guaranteedBlessing)
        .filter((choice) => choice.type === 'gear')
        .every((choice) => choice.rarity !== Rarity.Common),
    ).toBe(true)

    equippedItems.forEach((item) => {
      item.rarity = Rarity.Uncommon
    })
    firstEquippedItem.rarity = Rarity.Rare
    game.state.player.gearRarityFloor = Rarity.Common
    expect(
      generateGearChoices(game.state, GEAR_CHOICES_PER_PICKUP, guaranteedBlessing)
        .some((choice) => choice.type === 'gear-rarity-floor'),
    ).toBe(false)

    game.state.player.gearRarityFloor = Rarity.Uncommon
    const rareBlessing = generateGearChoices(
      game.state,
      GEAR_CHOICES_PER_PICKUP,
      guaranteedBlessing,
    ).find((choice) => choice.type === 'gear-rarity-floor')
    expect(rareBlessing).toEqual({
      type: 'gear-rarity-floor',
      minimumRarity: Rarity.Rare,
    })

    equippedItems.forEach((item) => {
      item.rarity = Rarity.Rare
    })
    game.state.player.gearRarityFloor = Rarity.Rare
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
      item.rarity = Rarity.Common
    })
    equipRolledItem(game.state.player, 'iron-cleaver', Rarity.Common, [
      createGearModifier('iron-cleaver', 'melee-leech', 4, 2),
    ])

    const specialChoices = generateGearChoices(game.state, GEAR_CHOICES_PER_PICKUP, {
      next: () => 0,
      int: (min: number) => min,
      chance: () => true,
      pick: <T>(items: readonly T[]) => items[0] as T,
    })

    expect(specialChoices[0]?.type).toBe('gear-rarity-floor')
    expect(specialChoices[1]?.type).toBe('upgrade-equipped-item')
  })

  it('offers the XP blessing again after an earlier offer is skipped', () => {
    const game = createGame({ seed: 409 })
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
      item.rarity = Rarity.Rare
    })
    const alwaysBlessing = {
      next: () => 0,
      int: (min: number) => min,
      chance: (probability: number) => probability === GEAR_XP_BLESSING_CHANCE,
      pick: <T>(items: readonly T[]) => items[0] as T,
    }

    const firstChoices = generateGearChoices(
      game.state,
      GEAR_CHOICES_PER_PICKUP,
      alwaysBlessing,
    )
    expect(firstChoices.some((choice) => choice.type === 'gear-xp-blessing')).toBe(true)
    expect(game.state.run.gearXpBlessingActive).toBe(false)

    // Skipping the flow does not mutate the blessing flag, so the next gear
    // flow gets the same independent 5% chance.
    const secondChoices = generateGearChoices(
      game.state,
      GEAR_CHOICES_PER_PICKUP,
      alwaysBlessing,
    )
    expect(secondChoices.some((choice) => choice.type === 'gear-xp-blessing')).toBe(true)

    game.state.run.gearXpBlessingActive = true
    expect(
      generateGearChoices(game.state, GEAR_CHOICES_PER_PICKUP, alwaysBlessing)
        .some((choice) => choice.type === 'gear-xp-blessing'),
    ).toBe(false)
  })

  it('rolls a set assignment independently for each generated item', () => {
    const game = createGame({ seed: 405 })
    const scholarRoll = {
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

    const scholarChoice = generateGearChoices(game.state, 1, scholarRoll)[0]
    const splinteringChoice = generateGearChoices(game.state, 1, splinteringRoll)[0]

    expect(scholarChoice).toMatchObject({
      type: 'gear',
      setId: 'scholar',
    })
    expect(splinteringChoice).toMatchObject({
      type: 'gear',
      setId: 'splintering',
    })
    expect(scholarChoice?.type === 'gear' ? scholarChoice.itemId : undefined).toBe(
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
    ).toEqual(new Set([
      'iron-cleaver',
      'hunters-bow',
      'starcall-wand',
      'ritual-staff',
    ]))
  })

  it('offers and applies a one-tier equipped-item modifier upgrade with a persistent roll', () => {
    const game = createGame({ seed: 401 })
    equipRolledItem(game.state.player, 'iron-cleaver', Rarity.Common, [
      createGearModifier('iron-cleaver', 'melee-leech', 4, 2),
    ])
    const choices = generateGearChoices(game.state, 3, new Random(401))
    const upgrade = choices.find(
      (choice) => choice.type === 'upgrade-equipped-item',
    )
    expect(choices[0]).toBe(upgrade)
    expect(upgrade).toMatchObject({
      itemId: 'iron-cleaver',
      rarity: Rarity.Common,
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
    expect(rolled?.rarity).toBe(Rarity.Common)
    expect(rolled?.modifiers).toEqual(upgrade.upgradedModifiers)

    const before = createUiSnapshot(game.state)
    const after = createUiSnapshot(game.state)
    expect(after.equipment.weapon).toEqual(before.equipment.weapon)
  })

  it('upgrades Chill on hit from two stacks to three stacks at Tier 1', () => {
    const upgrade = rollItemUpgradeModifiers(
      [createGearModifier('ring', 'frost-application', 2, 2)],
      {
        next: () => 0,
        int: (min: number) => min,
        chance: () => false,
        pick: <T>(items: readonly T[]) => items[0] as T,
      },
    )

    expect(upgrade).toMatchObject({
      upgradedModifierId: 'frost-application',
      fromTier: 2,
      toTier: 1,
      upgradedModifiers: [
        { id: 'frost-application', tier: 1, value: 3 },
      ],
    })
  })

  it('offers upgrades only for equipped items with at least one modifier below Tier 1', () => {
    const game = createGame({ seed: 402 })
    equipRolledItem(
      game.state.player,
      'armor',
      Rarity.Common,
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
