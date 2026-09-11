import { describe, expect, it } from 'vitest'
import { getInventoryFavoriteScope, isInventoryItemFavorite } from './InventoryFavorites'
import type { InventoryItemInstance } from './InventoryTypes'

function item(definitionId: string, favorite = false): InventoryItemInstance {
  return {
    itemInstanceId: `instance-${definitionId}`,
    definitionId,
    quantity: 1,
    bound: false,
    favorite,
    metadata: {},
    source: { type: 'fishing', id: null },
    createdAt: '2026-09-13T00:00:00.000Z',
    updatedAt: '2026-09-13T00:00:00.000Z',
  }
}

describe('InventoryFavorites', () => {
  it('stars a stackable item by definition and anything else by instance', () => {
    expect(getInventoryFavoriteScope(item('scrap'))).toBe('definition')
    expect(getInventoryFavoriteScope(item('river-worm'))).toBe('definition')
    expect(getInventoryFavoriteScope(item('starter-fishing-rod'))).toBe('instance')
    expect(getInventoryFavoriteScope(item('river-minnow'))).toBe('instance')
  })

  it('reads a favorite from either the row or its definition', () => {
    expect(isInventoryItemFavorite(item('starter-fishing-rod', true), new Set())).toBe(true)
    expect(isInventoryItemFavorite(item('scrap'), new Set(['scrap']))).toBe(true)
    expect(isInventoryItemFavorite(item('scrap'), new Set(['timber']))).toBe(false)
  })
})
