import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  ALL_INVENTORY_ITEM_DEFINITIONS,
  getInventoryItemDefinition,
} from './ItemDefinitions'
import type {
  InventoryItemCategory,
  InventoryItemDefinition,
  InventoryItemGrant,
  InventoryService,
} from './InventoryTypes'
// Imported from the owning modules rather than the `../fishing` barrel: the
// barrel also re-exports FishingScreen, which imports this package's barrel
// back, and that pair formed the only true runtime import cycle in the repo.
import { getFishDefinition } from '../fishing/FishingContent'
import { FishIcon } from '../fishing/FishIcon'
import { lastElement } from '../shared'
import { RARITIES, RARITY_WEIGHTS, type Rarity } from '../content/rarity/Rarity'
import { getArtifactBaseByDefinitionId } from '../content/artifacts/Artifacts'
import { ArtifactIcon } from './ArtifactIcon'
import { useToaster } from '../ui/ToasterContext'

/**
 * The inventory section of the header's development tools. Rendered only for
 * an administrator on a build with the tools on; the server refuses the
 * grants without the admin role anyway.
 */
interface DevelopmentInventoryGrantsProps {
  inventoryService: InventoryService | null
}

/**
 * Rods are left out on purpose: a rod's modifiers are rolled when fishing
 * creates it, and a rod granted without them is not a rod the game knows.
 * Artifacts are in because the server rolls one on insert whatever asked for
 * it; a granted artifact is exactly the artifact a box would have given.
 */
const GRANTABLE_CATEGORIES: readonly InventoryItemCategory[] = [
  'fish',
  'bait',
  'loot-box',
  'artifact',
  'material',
]

const CATEGORY_LABELS: Record<InventoryItemCategory, string> = {
  fish: 'Fish',
  bait: 'Bait',
  rod: 'Rods',
  'loot-box': 'Loot boxes',
  artifact: 'Artifacts',
  material: 'Materials',
  utility: 'Utility',
}

const DEVELOPMENT_ITEM_DEFINITIONS = ALL_INVENTORY_ITEM_DEFINITIONS.filter((definition) =>
  GRANTABLE_CATEGORIES.includes(definition.category) && !definition.unlimited,
)

const DEVELOPMENT_ITEM_GROUPS = GRANTABLE_CATEGORIES
  .map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    definitions: DEVELOPMENT_ITEM_DEFINITIONS.filter((definition) => definition.category === category),
  }))
  .filter((group) => group.definitions.length > 0)

/**
 * The grants a tester reaches for most, one click each. Every id is checked
 * against the registry at render time, so a renamed item drops its button
 * rather than granting nothing.
 */
const QUICK_GRANTS: readonly {
  label: string
  definitionId: string
  quantity: number
  rarity?: Rarity
  sizePercentile?: number
}[] = [
  { label: 'Revival Koi, epic and large', definitionId: 'revival-koi', quantity: 1, rarity: 'epic', sizePercentile: 0.9 },
  { label: '100 scrap', definitionId: 'scrap', quantity: 100 },
  { label: '20 River Worms', definitionId: 'river-worm', quantity: 20 },
  { label: 'Rare loot box', definitionId: 'loot-box-rare', quantity: 1 },
  { label: 'Legendary Ember Reliquary', definitionId: 'artifact-ember-reliquary', quantity: 1, rarity: 'legendary' },
]

const RARITY_OPTIONS: readonly { value: Rarity | 'random'; label: string }[] = [
  { value: 'random', label: 'Random rarity' },
  ...RARITIES.map((rarity) => ({ value: rarity, label: rarity.charAt(0).toUpperCase() + rarity.slice(1) })),
]

function getItemIcon(definition: InventoryItemDefinition): ReactNode {
  const fish = getFishDefinition(definition.id)
  if (fish) {
    return <FishIcon icon={fish.visual.icon} color={fish.visual.accent} />
  }
  const artifact = getArtifactBaseByDefinitionId(definition.id)
  if (artifact) {
    return <ArtifactIcon icon={artifact.id} color={artifact.accent} />
  }
  return definition.category === 'bait' ? '◉' : definition.category === 'material' ? '⚙' : '▣'
}

function randomFishRarity(): Rarity {
  const totalWeight = RARITIES.reduce((total, rarity) => total + RARITY_WEIGHTS[rarity], 0)
  let remainingWeight = Math.random() * totalWeight
  for (const rarity of RARITIES) {
    remainingWeight -= RARITY_WEIGHTS[rarity]
    if (remainingWeight < 0) {
      return rarity
    }
  }
  return lastElement(RARITIES)
}

function createDevelopmentGrant(
  definition: InventoryItemDefinition,
  quantity: number,
  options: { rarity?: Rarity | 'random'; sizePercentile?: number } = {},
): InventoryItemGrant {
  const fish = getFishDefinition(definition.id)
  if (fish) {
    return {
      definitionId: definition.id,
      quantity,
      metadata: {
        speciesId: fish.id,
        rarity: options.rarity && options.rarity !== 'random' ? options.rarity : randomFishRarity(),
        sizePercentile: options.sizePercentile ?? 0.1 + Math.random() * 0.89,
      },
    }
  }
  // An artifact rolls everything on the server. A rarity asked for here is
  // honoured there; left random, the server rolls that too.
  if (getArtifactBaseByDefinitionId(definition.id) && options.rarity && options.rarity !== 'random') {
    return { definitionId: definition.id, quantity, metadata: { rarity: options.rarity } }
  }
  return { definitionId: definition.id, quantity }
}

export function DevelopmentInventoryGrants({
  inventoryService,
}: DevelopmentInventoryGrantsProps) {
  const { showLootToast, showToast } = useToaster()
  const [selectedDefinitionId, setSelectedDefinitionId] = useState(
    DEVELOPMENT_ITEM_DEFINITIONS[0]?.id ?? '',
  )
  const [quantity, setQuantity] = useState('1')
  const [fishRarity, setFishRarity] = useState<Rarity | 'random'>('random')
  const [granting, setGranting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectedDefinition = getInventoryItemDefinition(selectedDefinitionId)
  const selectedIsFish = selectedDefinition !== undefined && getFishDefinition(selectedDefinition.id) !== undefined
  const selectedRollsRarity = selectedIsFish ||
    (selectedDefinition !== undefined && getArtifactBaseByDefinitionId(selectedDefinition.id) !== undefined)

  const grant = async (
    definition: InventoryItemDefinition,
    grantQuantity: number,
    options: { rarity?: Rarity | 'random'; sizePercentile?: number } = {},
  ): Promise<void> => {
    if (!inventoryService || granting) {
      return
    }
    setGranting(true)
    setError(null)
    try {
      const [result] = await inventoryService.grantDevelopmentItems(
        crypto.randomUUID(),
        [createDevelopmentGrant(definition, grantQuantity, options)],
      )
      if (!result) {
        throw new Error('Inventory grant returned no item.')
      }
      const fish = getFishDefinition(definition.id)
      showLootToast({
        title: 'Development item granted',
        itemName: definition.name,
        icon: getItemIcon(definition),
        accentColor: fish?.visual.accent ?? '#67e8f9',
        glowColor: fish?.visual.glow ?? '#0891b2',
        reward: `×${result.quantity}`,
        details: ['Added through the inventory grant pipeline'],
      })
    } catch (grantError: unknown) {
      const message = grantError instanceof Error ? grantError.message : 'Unable to grant inventory item.'
      setError(message)
      showToast(message, 'error')
    } finally {
      setGranting(false)
    }
  }

  const grantSelected = (): void => {
    if (!selectedDefinition) {
      return
    }
    const parsedQuantity = Number(quantity)
    if (!Number.isSafeInteger(parsedQuantity) || parsedQuantity < 1) {
      setError('Enter a positive whole-number quantity.')
      return
    }
    void grant(selectedDefinition, parsedQuantity, { rarity: fishRarity })
  }

  const busy = granting || inventoryService === null

  return (
    <div className="development-inventory-grants">
    <div className="development-inventory-quick" role="group" aria-label="Quick grants">
      {QUICK_GRANTS.map((quick) => {
        const definition = getInventoryItemDefinition(quick.definitionId)
        if (!definition) {
          return null
        }
        return (
          <button
            className="development-inventory-quick-grant"
            type="button"
            key={quick.definitionId}
            onClick={() => {
              void grant(definition, quick.quantity, {
                rarity: quick.rarity,
                sizePercentile: quick.sizePercentile,
              })
            }}
            disabled={busy}
          >
            {quick.label}
          </button>
        )
      })}
    </div>
    <label>
      Item
      <select
        value={selectedDefinitionId}
        onChange={(event) => { setSelectedDefinitionId(event.target.value) }}
        disabled={granting}
      >
        {DEVELOPMENT_ITEM_GROUPS.map((group) => (
          <optgroup label={group.label} key={group.category}>
            {group.definitions.map((definition) => (
              <option key={definition.id} value={definition.id}>
                {definition.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
    {selectedRollsRarity ? (
      <label>
        Rarity
        <select
          value={fishRarity}
          onChange={(event) => { setFishRarity(event.target.value as Rarity | 'random') }}
          disabled={granting}
        >
          {RARITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
    ) : null}
    <label>
      Quantity
      <input
        type="number"
        min="1"
        max="9999"
        step="1"
        value={quantity}
        onChange={(event) => { setQuantity(event.target.value) }}
        disabled={granting}
      />
    </label>
    <button
      className="development-inventory-grant"
      type="button"
      onClick={grantSelected}
      disabled={busy || selectedDefinition === undefined}
    >
      {granting ? 'Granting…' : 'Grant item'}
    </button>
    {error ? <p className="development-inventory-error" role="alert">{error}</p> : null}
    </div>
  )
}
