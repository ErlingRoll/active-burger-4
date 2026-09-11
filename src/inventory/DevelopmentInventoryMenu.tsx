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
import { APP_ENVIRONMENT } from '../shared/environment'
import { RARITIES, RARITY_WEIGHTS, type Rarity } from '../content/rarity/Rarity'
import { useToaster } from '../ui/ToasterContext'

interface DevelopmentInventoryMenuProps {
  inventoryService: InventoryService | null
  /**
   * The server refuses development grants without the admin role, so the
   * menu says how to get it rather than failing on the first click.
   */
  isAdmin: boolean
}

/**
 * Rods are left out on purpose: a rod's modifiers are rolled when fishing
 * creates it, and a rod granted without them is not a rod the game knows.
 */
const GRANTABLE_CATEGORIES: readonly InventoryItemCategory[] = [
  'fish',
  'bait',
  'loot-box',
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
]

const FISH_RARITY_OPTIONS: readonly { value: Rarity | 'random'; label: string }[] = [
  { value: 'random', label: 'Random rarity' },
  ...RARITIES.map((rarity) => ({ value: rarity, label: rarity.charAt(0).toUpperCase() + rarity.slice(1) })),
]

function getItemIcon(definition: InventoryItemDefinition): ReactNode {
  const fish = getFishDefinition(definition.id)
  if (fish) {
    return <FishIcon icon={fish.visual.icon} color={fish.visual.accent} />
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
  return {
    definitionId: definition.id,
    quantity,
    ...(fish ? {
      metadata: {
        speciesId: fish.id,
        rarity: options.rarity && options.rarity !== 'random' ? options.rarity : randomFishRarity(),
        sizePercentile: options.sizePercentile ?? 0.1 + Math.random() * 0.89,
      },
    } : {}),
  }
}

export function DevelopmentInventoryMenu({
  inventoryService,
  isAdmin,
}: DevelopmentInventoryMenuProps) {
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
    <details className="development-inventory-menu">
      <summary className="development-inventory-toggle">Dev tools</summary>
      <div className="development-inventory-panel">
        <p className="development-inventory-kicker">Development tools · {APP_ENVIRONMENT} backend</p>
        {!isAdmin ? (
          <div className="development-inventory-note">
            <p>
              Inventory grants need the <strong>admin</strong> role on this account; the
              server refuses them otherwise.
            </p>
            <p>
              In the Supabase dashboard for this backend, run the SQL below with your
              own email, then sign out and back in:
            </p>
            <pre>{`update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'
where email = 'you@example.com';`}</pre>
          </div>
        ) : (
          <>
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
            {selectedIsFish ? (
              <label>
                Rarity
                <select
                  value={fishRarity}
                  onChange={(event) => { setFishRarity(event.target.value as Rarity | 'random') }}
                  disabled={granting}
                >
                  {FISH_RARITY_OPTIONS.map((option) => (
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
          </>
        )}
        {error ? <p className="development-inventory-error" role="alert">{error}</p> : null}
      </div>
    </details>
  )
}
