import { getInventoryItemDefinition } from './ItemDefinitions'
import type { InventoryItemInstance } from './InventoryTypes'

/**
 * Interchangeable items counted once, rather than repeated slot by slot.
 *
 * The server grants a row per award, so ninety-six identical scraps arrived as
 * ninety-six rows and the bag drew ninety-six identical slots — seven screens
 * of one picture, with the two rods and the fish that a player actually came to
 * look at somewhere underneath. A definition marked `stackable` says its
 * instances are the same thing as each other, so they are one slot and a count.
 *
 * A fish is not stackable and is never merged: its size, its enchantment and
 * therefore its Essence live on the instance, so two Moon Carp are two things.
 * That is the same line the definitions draw for rarity, and drawing it once
 * here keeps the bag from having to know which fields vary.
 */
export function stackInventoryItems(
  items: readonly InventoryItemInstance[],
): InventoryItemInstance[] {
  const stacked: InventoryItemInstance[] = []
  const byDefinition = new Map<string, number>()
  for (const item of items) {
    if (!getInventoryItemDefinition(item.definitionId)?.stackable) {
      stacked.push(item)
      continue
    }
    const index = byDefinition.get(item.definitionId)
    const existing = index === undefined ? undefined : stacked[index]
    if (index === undefined || existing === undefined) {
      byDefinition.set(item.definitionId, stacked.length)
      stacked.push(item)
      continue
    }
    // The first instance represents the stack, so salvaging or spending it
    // takes the row the player has held longest rather than the newest one.
    stacked[index] = { ...existing, quantity: existing.quantity + item.quantity }
  }
  return stacked
}
