import { describe, expect, it } from 'vitest'
import {
  EQUIPMENT_SLOTS,
  getItemDefinition,
  INITIAL_ITEMS,
  isItemId,
} from './Items'
import { STAT_KEYS } from '../stats/Stats'
import { ENEMY_DEFINITIONS } from '../enemies/Enemies'
import {
  GEAR_DROP_CHANCES,
  validateGearDropChances,
  validateGearPickupBalance,
  GEAR_PICKUP_BALANCE,
} from './GearDrops'

describe('initial gear content', () => {
  it('covers each equipment slot with stable IDs and diverse rarities', () => {
    expect(INITIAL_ITEMS).toHaveLength(EQUIPMENT_SLOTS.length)
    expect(new Set(INITIAL_ITEMS.map((item) => item.slot))).toEqual(
      new Set(EQUIPMENT_SLOTS),
    )
    expect(new Set(INITIAL_ITEMS.map((item) => item.rarity))).toEqual(
      new Set(['common', 'uncommon', 'rare', 'epic', 'legendary']),
    )
    expect(INITIAL_ITEMS.every((item) => isItemId(item.id))).toBe(true)
    expect(INITIAL_ITEMS.every((item) => item.modifiers.length > 0)).toBe(true)
    expect(
      INITIAL_ITEMS.every((item) =>
        item.modifiers.every((modifier) => STAT_KEYS.includes(modifier.stat)),
      ),
    ).toBe(true)
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
