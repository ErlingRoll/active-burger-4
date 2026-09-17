import { getInventoryItemDefinition } from '../inventory/ItemDefinitions'
import { getLootBoxRules } from './LootBoxContents'
import { getAbyssLootBoxRarityLabel, isLootBoxRarity } from './LootBoxes'

/**
 * What a resource is, what it is for, and where it comes from.
 *
 * A material or a box turns up as an icon and a number in a lot of places: the
 * pay on a contract, the ledger on the Camp, a line in a toast. The icon says
 * which one it is and nothing else, and a player who has never crafted bait
 * has no way to learn that scrap is what the bench wants. Every resource
 * tooltip answers the same three questions in the same order, so the answer
 * is always in the same place whichever screen asked.
 *
 * The facts here mirror `docs/features/economy.md`: one primary source and the
 * sinks that exist, never a sink that is still planned.
 */
export interface ResourceGuideEntry {
  /** The resource's name, as the bag knows it. */
  name: string
  /** What the thing is, in a sentence. */
  what: string
  /** What spends it. */
  usedFor: string
  /** What pays it. */
  source: string
}

type ResourceGuideFacts = Omit<ResourceGuideEntry, 'name'>

const MATERIAL_GUIDE: Readonly<Record<string, ResourceGuideFacts>> = {
  scrap: {
    what: 'Buckles, bowstring and bent plate: what a loadout leaves behind when it comes out of the dark.',
    usedFor: 'Bait at the Tackle bench, and rerolling an artifact at the Forge.',
    source: 'Finishing a dungeon run pays it for the gear you end with. Salvaging an artifact or a duplicate box drop pays it too, and so do contracts.',
  },
  timber: {
    what: 'Felled at the edge of the firelight and stacked to season.',
    usedFor: 'Building and upgrading the Camp, and bait at the Tackle bench alongside scrap.',
    source: 'Champions working the Woodline at the Camp cut it while you are away. Contracts pay it too.',
  },
  stone: {
    what: 'Cut from the hillside behind the camp, still cold from the ground.',
    usedFor: 'Building and upgrading the Camp.',
    source: 'Champions working the Quarry at the Camp dig it while you are away. Contracts pay it too.',
  },
  'rift-shard': {
    what: 'A splinter of the Abyss, humming faintly. It never quite settles in the hand.',
    usedFor: 'Raising the Rift anchor at the Camp, and rerolling an artifact at the Forge.',
    source: 'Every Abyss floor you complete pays shards, deeper floors more. Contracts pay them too.',
  },
  roe: {
    what: 'Taken from a fish that will not be swimming again.',
    usedFor: 'Curing a meal fish at the Smokehouse.',
    source: 'Gutting a fish at the Smokehouse. Contracts pay it too.',
  },
}

function lootBoxGuide(definitionId: string): ResourceGuideFacts | null {
  const rarity = definitionId.replace('loot-box-', '')
  if (!definitionId.startsWith('loot-box-') || !isLootBoxRarity(rarity)) {
    return null
  }
  const rules = getLootBoxRules(rarity)
  const draws = rules.draws
  const drawsText = `${draws === 1 ? 'one draw' : `${draws} draws`} from the ${getAbyssLootBoxRarityLabel(rarity)} table, each rolled on its own`
  const guaranteedText = rules.guaranteedArtifacts === 0
    ? ''
    : `${rules.guaranteedArtifacts === 1 ? 'one artifact' : `${rules.guaranteedArtifacts} artifacts`}, ${rules.artifactRarityFloor ?? 'common'} or better, and then `
  return {
    what: `A sealed box holding ${guaranteedText}${drawsText}.`,
    usedFor: 'Opening, from the inventory, for bait, rods, artifacts and fish. A duplicate drop resolves into scrap.',
    source: 'Dungeon runs pay boxes up to Rare, every completed Abyss floor pays one, fishing lands one now and then, and contracts pay them.',
  }
}

/** The guide entry for a resource, or null for an item that is not one. */
export function getResourceGuide(definitionId: string): ResourceGuideEntry | null {
  const facts = MATERIAL_GUIDE[definitionId] ?? lootBoxGuide(definitionId)
  if (!facts) {
    return null
  }
  return {
    name: getInventoryItemDefinition(definitionId)?.name ?? definitionId,
    ...facts,
  }
}
