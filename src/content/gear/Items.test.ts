import { describe, expect, it } from 'vitest'
import {
  ALL_ITEM_DEFINITIONS,
  EQUIPMENT_SLOTS,
  getItemDefinition,
  getItemDisplayName,
  INITIAL_ITEMS,
  isItemId,
  WEAPON_ARCHETYPES,
} from './Items'
import {
  formatGearModifier,
  getGearModifierDefinition,
  getAvailableGearModifiersForItem,
  getAvailableGearModifiersForSlot,
  rollGearModifiersForItem,
  validateGearModifierDefinitions,
} from './ModifierPools'
import { ENEMY_DEFINITIONS } from '../enemies/EnemyConfig'
import {
  GEAR_DROP_CHANCE_BALANCE,
  GEAR_DROP_CHANCES,
  GEAR_PICKUP_BALANCE,
} from './GearDropConfig'
import {
  getGearDropFloorMultiplier,
  getGearDropChance,
  validateGearDropChances,
  validateGearPickupBalance,
} from './GearDrops'
import { Rarity } from '../rarity/Rarity'
import {
  ALL_GEAR_SET_DEFINITIONS,
  getActiveGearSetBonuses,
  isGearSetId,
  normalizeGearSetId,
} from '../../game-config/gear-sets'

describe('initial gear content', () => {
  it('provides flavor text on every item definition', () => {
    expect(ALL_ITEM_DEFINITIONS.every((item) => 'flavorText' in item)).toBe(true)
  })

  it('covers each equipment slot with stable IDs and no authored base modifiers', () => {
    expect(new Set(INITIAL_ITEMS.map((item) => item.slot))).toEqual(
      new Set(EQUIPMENT_SLOTS),
    )
    expect(
      INITIAL_ITEMS.filter((item) => item.slot === 'weapon').map(
        (item) => item.weaponArchetype,
      ),
    ).toEqual(WEAPON_ARCHETYPES)
    expect(
      INITIAL_ITEMS.filter((item) => item.slot === 'weapon').map((item) => item.name),
    ).toEqual(['Cleaver', 'Bow', 'Wand', 'Staff'])
    expect(
      INITIAL_ITEMS.filter((item) => item.slot !== 'weapon').map((item) => item.name),
    ).toEqual(['Helmet', 'Armor', 'Boots', 'Ring', 'Amulet'])
    expect(new Set(INITIAL_ITEMS.map((item) => item.rarity))).toEqual(
      new Set([Rarity.Common]),
    )
    expect(INITIAL_ITEMS.every((item) => isItemId(item.id))).toBe(true)
    expect(validateGearModifierDefinitions()).toEqual([])
    expect(INITIAL_ITEMS.every((item) => item.modifiers.length === 0)).toBe(true)
    expect(
      INITIAL_ITEMS.every((item) =>
        item.modifiers.every((modifier) =>
          getAvailableGearModifiersForItem(item).some(
            (candidate) => candidate.id === modifier.id,
          ),
        ),
      ),
    ).toBe(true)
  })

  it('provides one generic droppable item for every equipment slot', () => {
    expect(INITIAL_ITEMS).toHaveLength(EQUIPMENT_SLOTS.length + 3)
    expect(INITIAL_ITEMS.filter((item) => !item.starterOnly)).toHaveLength(
      EQUIPMENT_SLOTS.length + 3,
    )
    expect(
      new Set(INITIAL_ITEMS.filter((item) => !item.starterOnly).map((item) => item.slot)),
    ).toEqual(new Set(EQUIPMENT_SLOTS))
    expect(
      INITIAL_ITEMS.filter((item) => !item.starterOnly).every((item) => item.setId === undefined),
    ).toBe(true)
    for (const set of ALL_GEAR_SET_DEFINITIONS) {
      expect(set.slots).toEqual(EQUIPMENT_SLOTS)
      expect(getActiveGearSetBonuses(set, 1)).toEqual([])
      expect(getActiveGearSetBonuses(set, 6)).toHaveLength(3)
    }
  })

  it("replaces Giant's with Scholar's and Giant's while preserving old set IDs", () => {
    expect(ALL_GEAR_SET_DEFINITIONS.map((set) => set.id)).toEqual([
      'scholar',
      'giant',
      'astral',
      'splintering',
    ])
    expect(isGearSetId('giants')).toBe(false)
    expect(normalizeGearSetId('giants')).toBe('giant')
  })

  it('combines a rolled set name with the generic gear type name', () => {
    expect(getItemDisplayName(getItemDefinition('boots'), 'splintering')).toBe(
      'Splintering Boots',
    )
  })

  it('defines bow Precision as an implicit modifier on starter and droppable bows', () => {
    expect(getItemDefinition('ranger-training-bow').implicitModifiers).toEqual([
      {
        id: 'bow-precision',
        label: 'Precision',
        description: '+100% Basic Attack damage against the primary target.',
      },
    ])
    expect(getItemDefinition('hunters-bow').implicitModifiers).toEqual([
      {
        id: 'bow-precision',
        label: 'Precision',
        description: '+100% Basic Attack damage against the primary target.',
      },
    ])
    expect(getItemDefinition('starcall-wand').implicitModifiers).toBeUndefined()
  })

  it('defines the required five resistance tiers and slot-restricted offensive pools', () => {
    expect(getGearModifierDefinition('elemental-resistance').tiers).toEqual({
      1: { min: 41, max: 50 },
      2: { min: 31, max: 40 },
      3: { min: 21, max: 30 },
      4: { min: 11, max: 20 },
      5: { min: 1, max: 10 },
    })
    expect(getGearModifierDefinition('projectile-chains').tiers).toEqual({
      1: { min: 4, max: 4 },
      2: { min: 3, max: 3 },
      3: { min: 3, max: 3 },
      4: { min: 2, max: 2 },
      5: { min: 2, max: 2 },
    })
    expect(getGearModifierDefinition('frost-application').tiers).toEqual({
      1: { min: 3, max: 3 },
      2: { min: 2, max: 2 },
      3: { min: 1, max: 1 },
      4: { min: 1, max: 1 },
      5: { min: 1, max: 1 },
    })
    expect(getGearModifierDefinition('max-summons').tiers).toEqual({
      1: { min: 1, max: 1 },
      2: { min: 1, max: 1 },
      3: { min: 1, max: 1 },
      4: { min: 2, max: 2 },
      5: { min: 3, max: 3 },
    })
    expect(
      getAvailableGearModifiersForItem(getItemDefinition('ritual-staff')).some(
        (modifier) => modifier.id === 'max-summons',
      ),
    ).toBe(true)
    expect(
      getAvailableGearModifiersForItem(getItemDefinition('starcall-wand')).some(
        (modifier) => modifier.id === 'max-summons',
      ),
    ).toBe(false)
    expect(
      getAvailableGearModifiersForSlot('weapon').some(
        (modifier) => modifier.id === 'crit-chance',
      ),
    ).toBe(true)
    expect(
      getAvailableGearModifiersForSlot('helmet').some(
        (modifier) => modifier.id === 'crit-chance',
      ),
    ).toBe(false)
    expect(
      getAvailableGearModifiersForSlot('boots').some(
        (modifier) => modifier.id === 'movement-speed',
      ),
    ).toBe(true)
    expect(
      getAvailableGearModifiersForSlot('ring').some(
        (modifier) => modifier.id === 'movement-speed',
      ),
    ).toBe(false)
    expect(
      getAvailableGearModifiersForSlot('amulet').some(
        (modifier) => modifier.id === 'movement-speed',
      ),
    ).toBe(false)
  })

  it('restricts projectile-only weapon modifiers by archetype and rolls them deterministically', () => {
    const sword = getItemDefinition('iron-cleaver')
    const bow = getItemDefinition('hunters-bow')
    const wand = getItemDefinition('starcall-wand')
    const helmet = getItemDefinition('watchers-helm')

    expect(
      getAvailableGearModifiersForItem(sword).some(
        (modifier) => modifier.id === 'increased-projectile-damage',
      ),
    ).toBe(false)
    expect(
      getAvailableGearModifiersForItem(sword).some(
        (modifier) => modifier.id === 'basic-attack-extra-projectiles',
      ),
    ).toBe(false)
    expect(
      getAvailableGearModifiersForItem(sword).some(
        (modifier) => modifier.id === 'projectile-chains',
      ),
    ).toBe(false)
    expect(
      getAvailableGearModifiersForItem(sword).some(
        (modifier) => modifier.id === 'melee-leech',
      ),
    ).toBe(true)
    expect(
      getAvailableGearModifiersForItem(sword).some(
        (modifier) => modifier.id === 'increased-area-damage',
      ),
    ).toBe(true)
    expect(
      getAvailableGearModifiersForItem(bow).some(
        (modifier) => modifier.id === 'increased-projectile-damage',
      ),
    ).toBe(true)
    expect(
      getAvailableGearModifiersForItem(bow).some(
        (modifier) => modifier.id === 'projectile-chains',
      ),
    ).toBe(true)
    expect(
      getAvailableGearModifiersForItem(wand).some(
        (modifier) => modifier.id === 'basic-attack-extra-projectiles',
      ),
    ).toBe(true)
    expect(
      getAvailableGearModifiersForItem(wand).some(
        (modifier) => modifier.id === 'projectile-chains',
      ),
    ).toBe(true)
    expect(
      getAvailableGearModifiersForItem(wand).some(
        (modifier) => modifier.id === 'melee-leech',
      ),
    ).toBe(false)
    expect(
      getAvailableGearModifiersForItem(helmet).some(
        (modifier) => modifier.id === 'area-of-effect',
      ),
    ).toBe(true)
    expect(
      getAvailableGearModifiersForItem(helmet).some(
        (modifier) => modifier.id === 'projectile-chains',
      ),
    ).toBe(false)

    const swordModifiers = getAvailableGearModifiersForItem(sword)
    const areaOfEffectIndex = swordModifiers.findIndex(
      (modifier) => modifier.id === 'area-of-effect',
    )
    if (areaOfEffectIndex < 0) {
      throw new Error('Expected sword modifier pool to include area of effect')
    }
    const areaOfEffectWeight = getGearModifierDefinition(
      'area-of-effect',
    ).weaponArchetypeRollWeights?.sword
    expect(areaOfEffectWeight).toBe(4)
    const weightedAreaOfEffectStart = swordModifiers
      .slice(0, areaOfEffectIndex)
      .reduce(
        (total, modifier) =>
          total + (modifier.weaponArchetypeRollWeights?.sword ?? 1),
        0,
      )
    const scriptedAreaOfEffectRng = {
      next: () => 0,
      chance: () => false,
      int: (min: number, max: number) => {
        const totalWeight = swordModifiers.reduce(
          (total, modifier) =>
            total + (modifier.weaponArchetypeRollWeights?.sword ?? 1),
          0,
        )
        return min === 0 && max === totalWeight - 1
          ? weightedAreaOfEffectStart
          : min
      },
      pick: <T>(items: readonly T[]) => items[0] as T,
    }
    expect(
      rollGearModifiersForItem(sword, Rarity.Common, scriptedAreaOfEffectRng),
    ).toEqual([
      expect.objectContaining({ id: 'area-of-effect' }),
    ])

    const bowModifiers = getAvailableGearModifiersForItem(bow)
    const forcedProjectileChainsIndex = bowModifiers.findIndex(
      (modifier) => modifier.id === 'projectile-chains',
    )
    if (forcedProjectileChainsIndex < 0) {
      throw new Error('Expected bow modifier pool to include projectile chains')
    }
    const scriptedChainRng = {
      next: () => 0,
      chance: () => false,
      int: (min: number, max: number) => {
        if (min === 0 && max === bowModifiers.length - 1) {
          return forcedProjectileChainsIndex
        }
        return min
      },
      pick: <T>(items: readonly T[]) => items[0] as T,
    }
    expect(
      rollGearModifiersForItem(bow, Rarity.Common, scriptedChainRng),
    ).toEqual([
      expect.objectContaining({ id: 'projectile-chains', value: 4 }),
    ])

    const forcedExtraProjectilesIndex = bowModifiers.findIndex(
      (modifier) => modifier.id === 'basic-attack-extra-projectiles',
    )
    if (forcedExtraProjectilesIndex < 0) {
      throw new Error('Expected bow modifier pool to include extra projectiles')
    }
    const scriptedBowRng = {
      next: () => 0,
      chance: () => false,
      int: (min: number, max: number) => {
        if (min === 0 && max === bowModifiers.length - 1) {
          return forcedExtraProjectilesIndex
        }
        return min
      },
      pick: <T>(items: readonly T[]) => items[0] as T,
    }
    expect(
      rollGearModifiersForItem(bow, Rarity.Common, scriptedBowRng),
    ).toEqual([
      expect.objectContaining({ id: 'basic-attack-extra-projectiles' }),
    ])

    const scriptedSwordRng = {
      next: () => 0,
      chance: () => false,
      int: (min: number) => min,
      pick: <T>(items: readonly T[]) => items[0] as T,
    }
    expect(
      rollGearModifiersForItem(sword, Rarity.Legendary, scriptedSwordRng).every(
        (modifier) =>
          modifier.id !== 'increased-projectile-damage' &&
          modifier.id !== 'basic-attack-extra-projectiles' &&
          modifier.id !== 'projectile-chains',
      ),
    ).toBe(true)
  })

  it('formats new Basic Attack and area modifiers for gear UI text', () => {
    expect(formatGearModifier({
      id: 'increased-projectile-damage',
      tier: 4,
      value: 14,
    })).toBe('T4 +14% Increased projectile damage')
    expect(formatGearModifier({
      id: 'increased-area-damage',
      tier: 4,
      value: 14,
    })).toBe('T4 +14% Increased area damage')
    expect(formatGearModifier({
      id: 'area-of-effect',
      tier: 2,
      value: 18,
    })).toBe('T2 +18% Area of effect')
    expect(formatGearModifier({
      id: 'basic-attack-extra-projectiles',
      tier: 4,
      value: 1,
    }, {
      includeTier: false,
    })).toBe('+1 extra Basic Attack projectile')
    expect(formatGearModifier({
      id: 'projectile-chains',
      tier: 5,
      value: 2,
    })).toBe('T5 +2 projectile chains')
    expect(formatGearModifier({
      id: 'max-summons',
      tier: 5,
      value: 3,
    })).toBe('T5 +3 maximum summons')
  })

  it('resolves definitions at the content-to-game boundary', () => {
    const definition = getItemDefinition('boots')

    expect(definition.slot).toBe('boots')
    expect(definition.name).toBe('Boots')
    expect(() => getItemDefinition('missing-item')).toThrow(
      'Unknown item definition: missing-item',
    )
  })

  it('defines the exact enemy gear-drop tiers', () => {
    expect(GEAR_DROP_CHANCES).toEqual({
      slime: 0.07,
      runner: 0.07,
      archer: 0.07,
      splitter: 0.07,
      brute: 0.07,
      flanker: 0.07,
    })
    expect(validateGearDropChances(GEAR_DROP_CHANCES)).toEqual([])
    expect(validateGearPickupBalance(GEAR_PICKUP_BALANCE)).toEqual([])
    expect(
      Object.fromEntries(
        Object.values(ENEMY_DEFINITIONS).map((enemy) => [
          enemy.id,
          enemy.gearDropChance,
        ]),
      ),
    ).toEqual(GEAR_DROP_CHANCES)
  })

  it('rejects invalid gear-drop probabilities and pickup tuning', () => {
    expect(validateGearDropChances({ slime: -0.1, brute: 1.1 })).toEqual([
      'gearDropChances.slime must be a finite number between 0 and 1.',
      'gearDropChances.brute must be a finite number between 0 and 1.',
    ])
    expect(validateGearPickupBalance({
      ...GEAR_PICKUP_BALANCE,
      radius: 0,
    })).toContain(
      'gearPickupBalance.radius must be a positive finite number.',
    )
  })

  it('normalizes per-enemy drop chances against increasing spawn pressure', () => {
    expect(getGearDropChance('slime', undefined, { timeSeconds: 600 }))
      .toBeCloseTo(0.07 / 6)
    expect(getGearDropChance('slime', undefined, {
      timeSeconds: 600,
      chanceMultiplier: 6,
    })).toBeCloseTo(0.07)
  })

  it('tapers gear drops continuously from floor 1 through floor 30', () => {
    expect(getGearDropFloorMultiplier()).toBe(1)
    expect(getGearDropFloorMultiplier(1)).toBe(1)
    expect(getGearDropFloorMultiplier(15)).toBeCloseTo(1 - 0.2 * 14 / 29)
    expect(getGearDropFloorMultiplier(30)).toBe(0.8)
    expect(getGearDropFloorMultiplier(60)).toBe(0.8)
    expect(getGearDropChance('slime', undefined, {
      floorNumber: GEAR_DROP_CHANCE_BALANCE.floorTaper.endFloor,
    })).toBeCloseTo(0.056)
  })
})
