import { RARITY_ORDER } from '../content/rarity/Rarity'
import { getInventoryItemRarity } from '../inventory/InventoryRarity'
import { getInventoryItemDefinition } from '../inventory/ItemDefinitions'
import type { InventoryItemInstance } from '../inventory/InventoryTypes'
import { isLootBoxRarity, type LootBoxRarity } from './LootBoxes'

/**
 * A shelf of identical boxes, counted rather than repeated.
 *
 * The rewards list rendered one row per item instance, so four identical
 * legendary boxes were four rows carrying four identical buttons, and the list
 * paged at eight boxes while the heading above it said eight were waiting.
 * Boxes of one kind are interchangeable, so they are one row and a count.
 */
export interface LootBoxStack {
  readonly definitionId: string
  readonly name: string
  readonly quantity: number
  readonly rarity: LootBoxRarity | null
  readonly first: InventoryItemInstance
}

function getBoxRarity(box: InventoryItemInstance): LootBoxRarity | null {
  const rarity = getInventoryItemRarity(box)
  return rarity !== null && isLootBoxRarity(rarity) ? rarity : null
}

export function stackLootBoxes(boxes: readonly InventoryItemInstance[]): LootBoxStack[] {
  const stacks = new Map<string, LootBoxStack>()
  for (const box of boxes) {
    const existing = stacks.get(box.definitionId)
    if (existing) {
      stacks.set(box.definitionId, { ...existing, quantity: existing.quantity + box.quantity })
      continue
    }
    stacks.set(box.definitionId, {
      definitionId: box.definitionId,
      name: getInventoryItemDefinition(box.definitionId)?.name ?? box.definitionId,
      quantity: box.quantity,
      rarity: getBoxRarity(box),
      first: box,
    })
  }
  // Best first: the box a player came to open is the one they should not have
  // to look for.
  return [...stacks.values()].sort((left, right) =>
    (right.rarity === null ? -1 : RARITY_ORDER[right.rarity]) -
      (left.rarity === null ? -1 : RARITY_ORDER[left.rarity]) ||
    left.name.localeCompare(right.name),
  )
}
