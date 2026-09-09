import type { ReactNode } from 'react'
import { FishIcon } from '../fishing/FishIcon'
import { getFishDefinition } from '../fishing/FishingContent'
import { getInventoryItemDefinition } from '../inventory/ItemDefinitions'
import { LootBoxIcon } from './LootBoxIcon'
import { isLootBoxRarity } from './LootBoxes'

/**
 * The mark for anything that can come out of a box or sit in a slot.
 *
 * This lived twice, once on the stores screen and once on the pond, and the
 * two had already drifted: only one of them knew that a loot box is drawn
 * rather than typeset. Modules are imported directly rather than through the
 * feature barrels, because both of those feature barrels reach back here.
 */
export function getRewardIcon(definitionId: string): ReactNode {
  const fish = getFishDefinition(definitionId)
  if (fish) {
    return <FishIcon icon={fish.visual.icon} color={fish.visual.accent} />
  }

  const definition = getInventoryItemDefinition(definitionId)
  if (definition?.category === 'loot-box') {
    const rarity = definitionId.replace('loot-box-', '')
    if (isLootBoxRarity(rarity)) {
      return <LootBoxIcon rarity={rarity} />
    }
  }

  return {
    fish: '🐟',
    bait: '◉',
    rod: '🎣',
    'loot-box': '▣',
    artifact: '◇',
    material: '◆',
    utility: '✦',
  }[definition?.category ?? 'utility'] ?? '✦'
}
