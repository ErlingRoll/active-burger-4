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
  /** Every instance of the kind, in inventory order, for a batch to spend. */
  readonly instances: readonly InventoryItemInstance[]
}

/**
 * How many boxes one press may open.
 *
 * Ten is enough that a player back from a long session is not pressing the
 * same button forty times, and few enough that the reveal is still a haul the
 * eye can take in rather than a spreadsheet of one.
 */
export const MAX_LOOT_BOXES_PER_OPENING = 10

/**
 * The instance IDs a batch of `count` boxes from the stack should spend, one
 * entry per box. The server opens one box per call and takes it from whichever
 * instance the call names, so an instance holding three boxes is named three
 * times.
 */
export function selectLootBoxesToOpen(stack: LootBoxStack, count: number): string[] {
  const wanted = Math.max(0, Math.min(count, MAX_LOOT_BOXES_PER_OPENING, stack.quantity))
  const ids: string[] = []
  for (const instance of stack.instances) {
    for (let unit = 0; unit < instance.quantity && ids.length < wanted; unit += 1) {
      ids.push(instance.itemInstanceId)
    }
    if (ids.length >= wanted) {
      break
    }
  }
  return ids
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
      stacks.set(box.definitionId, {
        ...existing,
        quantity: existing.quantity + box.quantity,
        instances: [...existing.instances, box],
      })
      continue
    }
    stacks.set(box.definitionId, {
      definitionId: box.definitionId,
      name: getInventoryItemDefinition(box.definitionId)?.name ?? box.definitionId,
      quantity: box.quantity,
      rarity: getBoxRarity(box),
      first: box,
      instances: [box],
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
