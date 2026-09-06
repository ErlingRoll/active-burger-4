import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  ALL_INVENTORY_ITEM_DEFINITIONS,
  getInventoryItemDefinition,
} from './ItemDefinitions'
import type { InventoryItemDefinition, InventoryService } from './InventoryTypes'
import { getFishDefinition, FishIcon } from '../fishing'
import { useToaster } from '../ui/ToasterContext'

interface DevelopmentInventoryMenuProps {
  inventoryService: InventoryService | null
}

const DEVELOPMENT_ITEM_DEFINITIONS = ALL_INVENTORY_ITEM_DEFINITIONS.filter((definition) =>
  (definition.category === 'fish' ||
    definition.category === 'bait' ||
    definition.category === 'loot-box') &&
  !definition.unlimited,
)

function getItemIcon(definition: InventoryItemDefinition): ReactNode {
  const fish = getFishDefinition(definition.id)
  if (fish) {
    return <FishIcon icon={fish.visual.icon} color={fish.visual.accent} />
  }
  return definition.category === 'bait' ? '◉' : '▣'
}

export function DevelopmentInventoryMenu({
  inventoryService,
}: DevelopmentInventoryMenuProps) {
  const { showLootToast, showToast } = useToaster()
  const [selectedDefinitionId, setSelectedDefinitionId] = useState(
    DEVELOPMENT_ITEM_DEFINITIONS[0]?.id ?? '',
  )
  const [quantity, setQuantity] = useState('1')
  const [granting, setGranting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectedDefinition = getInventoryItemDefinition(selectedDefinitionId)

  const grantItem = async (): Promise<void> => {
    if (!inventoryService || !selectedDefinition || granting) {
      return
    }
    const parsedQuantity = Number(quantity)
    if (!Number.isSafeInteger(parsedQuantity) || parsedQuantity < 1) {
      setError('Enter a positive whole-number quantity.')
      return
    }
    setGranting(true)
    setError(null)
    try {
      const [result] = await inventoryService.grantDevelopmentItems(
        crypto.randomUUID(),
        [{ definitionId: selectedDefinition.id, quantity: parsedQuantity }],
      )
      if (!result) {
        throw new Error('Inventory grant returned no item.')
      }
      showLootToast({
        title: 'Development item granted',
        itemName: selectedDefinition.name,
        icon: getItemIcon(selectedDefinition),
        accentColor: getFishDefinition(selectedDefinition.id)?.visual.accent ?? '#67e8f9',
        glowColor: getFishDefinition(selectedDefinition.id)?.visual.glow ?? '#0891b2',
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

  return (
    <details className="development-inventory-menu">
      <summary className="development-inventory-toggle">Development</summary>
      <div className="development-inventory-panel">
        <p className="development-inventory-kicker">Local development only</p>
        <label>
          Item
          <select
            value={selectedDefinitionId}
            onChange={(event) => { setSelectedDefinitionId(event.target.value) }}
            disabled={granting}
          >
            {DEVELOPMENT_ITEM_DEFINITIONS.map((definition) => (
              <option key={definition.id} value={definition.id}>
                {definition.name} · {definition.category}
              </option>
            ))}
          </select>
        </label>
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
          onClick={() => { void grantItem() }}
          disabled={granting || inventoryService === null || selectedDefinition === undefined}
        >
          {granting ? 'Granting…' : 'Grant item'}
        </button>
        {error ? <p className="development-inventory-error" role="alert">{error}</p> : null}
      </div>
    </details>
  )
}
