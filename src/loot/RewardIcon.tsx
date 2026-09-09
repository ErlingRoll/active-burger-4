import type { ReactNode } from 'react'
import { BaitIcon } from '../fishing/BaitIcon'
import { FishIcon } from '../fishing/FishIcon'
import { getFishDefinition, getFishingBaitDefinition, getFishingRodVisual } from '../fishing/FishingContent'
import { RodIcon } from '../fishing/RodIcon'
import { getInventoryItemDefinition } from '../inventory/ItemDefinitions'
import { MaterialIcon } from '../inventory/MaterialIcon'
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

  const bait = getFishingBaitDefinition(definitionId)
  if (bait) {
    return <BaitIcon icon={bait.visual.icon} color={bait.visual.accent} />
  }

  const rod = getFishingRodVisual(definitionId)
  if (rod) {
    return <RodIcon icon={rod.icon} color={rod.accent} />
  }

  const definition = getInventoryItemDefinition(definitionId)
  if (definitionId === 'scrap') {
    return <MaterialIcon icon="scrap" color="var(--color-stone-300)" />
  }
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
