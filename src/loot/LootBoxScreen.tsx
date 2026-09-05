import { useEffect, useState } from 'react'
import type { InventoryItemInstance, InventoryService } from '../inventory'
import { getInventoryItemDefinition } from '../inventory'
import { PaginatedInventoryGrid } from '../inventory/PaginatedInventoryGrid'
import {
  formatFishingBaitEffect,
  formatFishingRodModifiers,
  getFishDefinition,
} from '../fishing'
import { ConfirmationDialog } from '../ui/ConfirmationDialog'
import type { LootBoxService } from './LootBoxService'
import { getAbyssLootBoxRarityLabel } from './LootBoxes'

interface LootBoxScreenProps {
  inventoryService: InventoryService | null
  lootBoxService: LootBoxService | null
  configurationError: string | null
  onBack: () => void
}

function getInventoryItemIcon(item: InventoryItemInstance): string {
  const definition = getInventoryItemDefinition(item.definitionId)
  return getFishDefinition(item.definitionId)?.visual.icon ??
    ({
      fish: '🐟',
      bait: '◉',
      rod: '🎣',
      'loot-box': '▣',
      artifact: '◇',
      material: '◆',
      utility: '✦',
    }[definition?.category ?? 'utility'] ?? '✦')
}

function getInventoryItemDetail(item: InventoryItemInstance): string {
  const definition = getInventoryItemDefinition(item.definitionId)
  if (definition?.unlimited) {
    return 'Unlimited'
  }
  if (definition?.category === 'bait') {
    return formatFishingBaitEffect(item.definitionId)
  }
  if (typeof item.metadata.rarity === 'string') {
    if (definition?.category === 'rod') {
      return `${item.metadata.rarity} · ${formatFishingRodModifiers(item.metadata)}`
    }
    return item.metadata.rarity
  }
  if (definition?.category === 'rod') {
    return formatFishingRodModifiers(item.metadata)
  }
  return definition?.category.replace('-', ' ') ?? 'item'
}

export function InventoryScreen({
  inventoryService,
  lootBoxService,
  configurationError,
  onBack,
}: LootBoxScreenProps) {
  const [items, setItems] = useState<InventoryItemInstance[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    () => inventoryService ? 'loading' : 'error',
  )
  const [error, setError] = useState<string | null>(
    () => inventoryService ? configurationError : configurationError ?? 'Inventory is unavailable.',
  )
  const [opening, setOpening] = useState(false)
  const [lastOpening, setLastOpening] = useState<{
    definitionId: string
    quantity: number
    boxRarity: string
  } | null>(null)
  const [pendingSalvage, setPendingSalvage] = useState<InventoryItemInstance | null>(null)
  const [salvagingItemInstanceId, setSalvagingItemInstanceId] = useState<string | null>(null)
  const [lastSalvage, setLastSalvage] = useState<{
    itemName: string
    essenceAwarded: number
  } | null>(null)

  const refresh = async (): Promise<void> => {
    if (!inventoryService) {
      return
    }
    setItems(await inventoryService.loadInventory())
    setLoadState('ready')
  }

  useEffect(() => {
    if (!inventoryService) {
      return
    }
    let cancelled = false
    void inventoryService.loadInventory()
      .then((loadedItems) => {
        if (!cancelled) {
          setItems(loadedItems)
          setLoadState('ready')
          setError(null)
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setLoadState('error')
          setError(loadError instanceof Error ? loadError.message : 'Unable to load loot boxes.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [inventoryService])

  const boxes = items.filter((item) =>
    getInventoryItemDefinition(item.definitionId)?.category === 'loot-box',
  )

  const openBox = async (box: InventoryItemInstance): Promise<void> => {
    if (!lootBoxService || !inventoryService || opening) {
      return
    }
    setOpening(true)
    setError(null)
    try {
      const result = await lootBoxService.openBox(crypto.randomUUID(), box.itemInstanceId)
      setLastOpening({
        definitionId: result.definitionId,
        quantity: result.quantity,
        boxRarity: getAbyssLootBoxRarityLabel(result.boxRarity),
      })
      await refresh()
    } catch (openError: unknown) {
      setError(openError instanceof Error ? openError.message : 'Unable to open loot box.')
    } finally {
      setOpening(false)
    }
  }

  const salvageFish = async (fish: InventoryItemInstance): Promise<void> => {
    if (!inventoryService || salvagingItemInstanceId) {
      return
    }
    const itemName = getInventoryItemDefinition(fish.definitionId)?.name ?? fish.definitionId
    setSalvagingItemInstanceId(fish.itemInstanceId)
    setError(null)
    try {
      const result = await inventoryService.salvageItem(
        crypto.randomUUID(),
        fish.itemInstanceId,
        1,
      )
      setLastSalvage({ itemName, essenceAwarded: result.essenceAwarded })
      await refresh()
    } catch (salvageError: unknown) {
      setError(salvageError instanceof Error ? salvageError.message : 'Unable to salvage fish.')
    } finally {
      setSalvagingItemInstanceId(null)
    }
  }

  return (
    <section className="dashboard inventory-screen loot-box-screen" aria-labelledby="loot-box-title">
      <div className="dashboard-panel loot-box-panel">
        <button className="secondary-action" type="button" onClick={onBack}>Back to dashboard</button>
        <p className="screen-kicker">Inventory</p>
        <h2 id="loot-box-title">Inventory</h2>
        <p>View fish, bait, rods, loot boxes, and other meta items.</p>
        {error ? <p className="persistence-error" role="alert">{error}</p> : null}
        {lastOpening ? (
          <section className="loot-box-result" aria-live="polite">
            <p className="screen-kicker">{lastOpening.boxRarity} box opened</p>
            <strong>{getInventoryItemDefinition(lastOpening.definitionId)?.name ?? lastOpening.definitionId}</strong>
            <span>×{lastOpening.quantity}</span>
          </section>
        ) : null}
        {lastSalvage ? (
          <section className="loot-box-result inventory-salvage-result" aria-live="polite">
            <p className="screen-kicker">Fish salvaged</p>
            <strong>{lastSalvage.itemName}</strong>
            <span>+{lastSalvage.essenceAwarded} Essence</span>
          </section>
        ) : null}
        {loadState === 'loading' ? (
          <p role="status">Loading loot boxes…</p>
        ) : (
          <>
            <section className="inventory-section" aria-labelledby="inventory-items-title">
              <p className="screen-kicker">Meta items</p>
              <h3 id="inventory-items-title">Owned items</h3>
              {items.length === 0 ? (
                <p className="champion-empty-state">No meta items yet.</p>
              ) : (
                <PaginatedInventoryGrid
                  items={items}
                  label="Owned items"
                  getItemIcon={getInventoryItemIcon}
                  getItemDetail={getInventoryItemDetail}
                  getItemActions={(item) => getInventoryItemDefinition(item.definitionId)?.category === 'fish' ? (
                    <button
                      className="inventory-item-salvage"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        setPendingSalvage(item)
                      }}
                      disabled={salvagingItemInstanceId !== null}
                    >
                      {salvagingItemInstanceId === item.itemInstanceId ? 'Salvaging…' : 'Salvage'}
                    </button>
                  ) : null}
                />
              )}
            </section>
            <section className="inventory-section" aria-labelledby="loot-box-title">
              <p className="screen-kicker">Rewards</p>
              <h3 id="loot-box-title">Unopened loot boxes</h3>
              {boxes.length === 0 ? (
                <p className="fishing-muted">Complete Abyss floors to earn loot boxes.</p>
              ) : (
                <ul className="loot-box-list">
                  {boxes.map((box) => (
                    <li key={box.itemInstanceId}>
                      <div>
                        <strong>{getInventoryItemDefinition(box.definitionId)?.name ?? box.definitionId}</strong>
                        <span>×{box.quantity}</span>
                      </div>
                      <button
                        className="primary-action"
                        type="button"
                        onClick={() => { void openBox(box) }}
                        disabled={opening}
                      >
                        {opening ? 'Opening…' : 'Open one'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
      {pendingSalvage ? (
        <ConfirmationDialog
          title="Salvage fish?"
          message={`Salvaging ${getInventoryItemDefinition(pendingSalvage.definitionId)?.name ?? pendingSalvage.definitionId} consumes one fish and awards server-calculated Essence.`}
          confirmLabel="Salvage fish"
          onCancel={() => setPendingSalvage(null)}
          onConfirm={() => {
            const fish = pendingSalvage
            setPendingSalvage(null)
            void salvageFish(fish)
          }}
        />
      ) : null}
    </section>
  )
}

export const LootBoxScreen = InventoryScreen
