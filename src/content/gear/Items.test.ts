import { describe, expect, it } from 'vitest'
import {
  EQUIPMENT_SLOTS,
  getItemDefinition,
  INITIAL_ITEMS,
  isItemId,
  WEAPON_ARCHETYPES,
} from './Items'
import {
  formatGearModifier,
  GEAR_RARITY_MODIFIER_COUNTS,
  getGearModifierDefinition,
  getAvailableGearModifiersForItem,
  getAvailableGearModifiersForSlot,
  rollGearModifiersForItem,
  validateGearModifierDefinitions,
} from './ModifierPools'
import { ENEMY_DEFINITIONS } from '../enemies/Enemies'
import {
  GEAR_DROP_CHANCES,
  validateGearDropChances,
  validateGearPickupBalance,
  GEAR_PICKUP_BALANCE,
} from './GearDrops'

describe('initial gear content', () => {
  it('covers each equipment slot with stable IDs, default rarities, and valid authored rolls', () => {
    expect(new Set(INITIAL_ITEMS.map((item) => item.slot))).toEqual(
      new Set(EQUIPMENT_SLOTS),
    )
    expect(
      INITIAL_ITEMS.filter((item) => item.slot === 'weapon').map(
        (item) => item.weaponArchetype,
      ),
    ).toEqual(WEAPON_ARCHETYPES)
    expect(new Set(INITIAL_ITEMS.map((item) => item.rarity))).toEqual(
      new Set(['common', 'uncommon', 'rare', 'epic', 'legendary']),
    )
    expect(INITIAL_ITEMS.every((item) => isItemId(item.id))).toBe(true)
    expect(validateGearModifierDefinitions()).toEqual([])
    expect(
      INITIAL_ITEMS.every((item) =>
        item.modifiers.length === GEAR_RARITY_MODIFIER_COUNTS[item.rarity] &&
        new Set(item.modifiers.map((modifier) => modifier.id)).size === item.modifiers.length,
      ),
    ).toBe(true)
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
      getAvailableGearModifiersForItem(helmet).some(
        (modifier) => modifier.id === 'area-of-effect',
      ),
    ).toBe(true)
    expect(
      getAvailableGearModifiersForItem(helmet).some(
        (modifier) => modifier.id === 'projectile-chains',
      ),
    ).toBe(false)

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
      rollGearModifiersForItem(bow, 'common', scriptedChainRng),
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
      rollGearModifiersForItem(bow, 'common', scriptedBowRng),
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
      rollGearModifiersForItem(sword, 'legendary', scriptedSwordRng).every(
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
  })

  it('resolves definitions at the content-to-game boundary', () => {
    const definition = getItemDefinition('swiftstride-boots')

    expect(definition.slot).toBe('boots')
    expect(() => getItemDefinition('missing-item')).toThrow(
      'Unknown item definition: missing-item',
    )
  })

  it('defines the exact enemy gear-drop tiers', () => {
    expect(GEAR_DROP_CHANCES).toEqual({
      slime: 0.02,
      runner: 0.02,
      archer: 0.04,
      splitter: 0.04,
      brute: 0.06,
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
})
