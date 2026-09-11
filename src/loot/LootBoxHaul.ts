import { readArtifactMetadata } from '../content/artifacts/Artifacts'
import { isRarity, type Rarity } from '../content/rarity/Rarity'
import { getFishingEssenceValue, isEnchantedItemMetadata } from '../fishing/FishingContent'
import type { LootBoxOpeningItem, LootBoxOpeningResult } from './LootBoxService'

/** The rarity a revealed item should be ringed with. */
function getItemRarity(item: LootBoxOpeningItem, boxRarity: Rarity): Rarity {
  return isRarity(item.metadata.rarity) ? item.metadata.rarity : boxRarity
}

/** One card on the reveal: a kind of thing, and how much of it came out. */
export interface RevealedReward {
  readonly key: string
  readonly definitionId: string
  readonly rarity: Rarity
  readonly enchanted: boolean
  readonly quantity: number
  readonly essence: number | null
}

/**
 * The haul, counted rather than listed.
 *
 * Ten legendary boxes give forty draws, and forty cards is a spreadsheet, not
 * a reward. Draws of the same kind and rarity share a card that carries their
 * count and the Essence they add up to. Artifacts stay one to a card: two
 * artifacts of one base can roll different modifiers, and a player wants to
 * see each one they were given.
 */
export function collectRevealedRewards(
  results: readonly LootBoxOpeningResult[],
  boxRarity: Rarity,
): RevealedReward[] {
  const rewards = new Map<string, RevealedReward>()
  for (const result of results) {
    for (const item of result.items) {
      const rarity = getItemRarity(item, boxRarity)
      const enchanted = isEnchantedItemMetadata(item.metadata)
      const essence = getFishingEssenceValue(item.definitionId, item.metadata)
      const isArtifact = readArtifactMetadata(item.definitionId, item.metadata) !== null
      const key = isArtifact
        ? `artifact:${item.itemInstanceId}`
        : `${item.definitionId}:${rarity}:${enchanted ? 'enchanted' : 'plain'}`
      const existing = rewards.get(key)
      if (existing === undefined) {
        rewards.set(key, {
          key,
          definitionId: item.definitionId,
          rarity,
          enchanted,
          quantity: item.quantity,
          essence,
        })
        continue
      }
      rewards.set(key, {
        ...existing,
        quantity: existing.quantity + item.quantity,
        essence: existing.essence === null && essence === null
          ? null
          : (existing.essence ?? 0) + (essence ?? 0),
      })
    }
  }
  return [...rewards.values()]
}
