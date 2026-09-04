import {
  RARITIES,
  Rarity,
  isRarity,
  type Rarity as RarityValue,
} from '../content/rarity/Rarity'

export type LootBoxRarity = RarityValue

export interface LootBoxDefinition {
  id: string
  rarity: LootBoxRarity
  name: string
}

export const LOOT_BOX_DEFINITIONS: Readonly<Record<LootBoxRarity, LootBoxDefinition>> = {
  [Rarity.Common]: { id: 'loot-box-common', rarity: Rarity.Common, name: 'Common Loot Box' },
  [Rarity.Uncommon]: { id: 'loot-box-uncommon', rarity: Rarity.Uncommon, name: 'Uncommon Loot Box' },
  [Rarity.Rare]: { id: 'loot-box-rare', rarity: Rarity.Rare, name: 'Rare Loot Box' },
  [Rarity.Epic]: { id: 'loot-box-epic', rarity: Rarity.Epic, name: 'Epic Loot Box' },
  [Rarity.Legendary]: { id: 'loot-box-legendary', rarity: Rarity.Legendary, name: 'Legendary Loot Box' },
}

export function isLootBoxRarity(value: unknown): value is LootBoxRarity {
  return isRarity(value)
}

export function getLootBoxDefinition(rarity: LootBoxRarity): LootBoxDefinition {
  return LOOT_BOX_DEFINITIONS[rarity]
}

export function resolveAbyssLootBoxRarity(
  seed: number,
  completedFloor: number,
  dangerScore: number,
): LootBoxRarity {
  if (!Number.isSafeInteger(seed) || !Number.isSafeInteger(completedFloor)) {
    throw new Error('Loot-box resolution requires integer seed and floor values.')
  }
  const floor = Math.max(1, Math.floor(completedFloor))
  const rarityFloor = Math.min(floor, 100)
  const danger = Math.max(0, Math.floor(dangerScore))
  const normalizedSeed = seed >>> 0
  const mixedSeed = (
    normalizedSeed +
    rarityFloor * 2654435761 +
    danger * 97
  ) >>> 0
  const roll = mixedSeed % 10000
  const progress = Math.min(1, floor / 100)
  const commonCutoff = Math.floor(8000 - progress * 5000)
  const uncommonCutoff = commonCutoff + Math.floor(1700 + progress * 1000)
  const rareCutoff = uncommonCutoff + Math.floor(300 + progress * 1200)
  const epicCutoff = rareCutoff + Math.floor(progress * 1500)
  if (roll < commonCutoff) return Rarity.Common
  if (roll < uncommonCutoff) return Rarity.Uncommon
  if (roll < rareCutoff) return Rarity.Rare
  if (roll < epicCutoff) return Rarity.Epic
  return Rarity.Legendary
}

export function getAbyssLootBoxRarityLabel(rarity: LootBoxRarity): string {
  return RARITIES.find((candidate) => candidate === rarity)!.replace(/^./, (letter) =>
    letter.toUpperCase(),
  )
}
