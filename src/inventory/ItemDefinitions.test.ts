import { describe, expect, it } from 'vitest'
import {
  ALL_INVENTORY_ITEM_DEFINITIONS,
  getInventoryItemDefinition,
} from './ItemDefinitions'
import { DEFAULT_FISHING_ROD } from '../fishing/FishingContent'

describe('inventory item definitions', () => {
  it('provides flavor text on every item definition', () => {
    expect(ALL_INVENTORY_ITEM_DEFINITIONS.every((item) => 'flavorText' in item)).toBe(true)
  })

  it('defines the default wooden rod as a common rod without modifiers', () => {
    expect(DEFAULT_FISHING_ROD).toMatchObject({
      id: 'starter-fishing-rod',
      name: 'Wooden rod',
      rarity: 'common',
      modifierIds: [],
      flavorText: "It's actually just a stick with some spare yarn attached to the end",
    })
    expect(getInventoryItemDefinition('starter-fishing-rod')).toMatchObject({
      name: 'Wooden rod',
      flavorText: "It's actually just a stick with some spare yarn attached to the end",
      category: 'rod',
    })
  })
})
