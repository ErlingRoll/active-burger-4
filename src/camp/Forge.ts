import type { Rarity } from '../content/rarity/Rarity'

/**
 * What the Forge charges and pays, mirrored from the server so the panel can
 * say what a reforge costs before it is asked for. `reforge_artifact` and
 * `camp_forge_salvage_multiplier` decide for themselves.
 */

export interface ReforgeCost {
  scrap: number
  riftShards: number
}

/** Scrap and shards to reroll an artifact, by its rarity. */
export const REFORGE_COSTS: Readonly<Record<Rarity, ReforgeCost>> = {
  common: { scrap: 20, riftShards: 1 },
  uncommon: { scrap: 30, riftShards: 2 },
  rare: { scrap: 45, riftShards: 3 },
  epic: { scrap: 70, riftShards: 5 },
  legendary: { scrap: 100, riftShards: 8 },
}

/** How much more scrap a finished loadout leaves behind at each Forge level. */
export function forgeSalvageMultiplier(forgeLevel: number): number {
  if (forgeLevel >= 3) {
    return 1.5
  }
  return forgeLevel === 2 ? 1.25 : 1
}
