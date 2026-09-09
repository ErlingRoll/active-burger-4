import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { InventoryItemInstance, InventoryService } from '../inventory'
import { getInventoryItemDefinition } from '../inventory'
import { PaginatedInventoryGrid } from '../inventory/PaginatedInventoryGrid'
import { FittedList } from '../ui/FittedList'
import {
  formatFishingBaitEffect,
  formatFishingFishDetail,
  formatFishingRodModifiers,
  FishIcon,
  getFishingEssenceValue,
  getFishDefinition,
} from '../fishing'
import { ConfirmationDialog } from '../ui/ConfirmationDialog'
import { useToaster } from '../ui/ToasterContext'
import type { LootBoxService } from './LootBoxService'
import { getAbyssLootBoxRarityLabel } from './LootBoxes'

interface LootBoxScreenProps {
  inventoryService: InventoryService | null
  lootBoxService: LootBoxService | null
  configurationError: string | null
  onBack: () => void
}

function getInventoryItemIcon(item: InventoryItemInstance): ReactNode {
  return getRewardIcon(item.definitionId)
}

function getRewardIcon(definitionId: string): ReactNode {
  const definition = getInventoryItemDefinition(definitionId)
  const fish = getFishDefinition(definitionId)
  return fish ? <FishIcon icon={fish.visual.icon} color={fish.visual.accent} /> :
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
  if (definition?.category === 'fish') {
    return formatFishingFishDetail(item.definitionId, item.metadata)
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
  const { showLootToast } = useToaster()
  const [items, setItems] = useState<InventoryItemInstance[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    () => inventoryService ? 'loading' : 'error',
  )
  const [error, setError] = useState<string | null>(
    () => inventoryService ? configurationError : configurationError ?? 'Inventory is unavailable.',
  )
  const [opening, setOpening] = useState(false)
  const [pendingSalvage, setPendingSalvage] = useState<InventoryItemInstance | null>(null)
  const [salvagingItemInstanceId, setSalvagingItemInstanceId] = useState<string | null>(null)

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
  const countHeld = (held: InventoryItemInstance[]): number =>
    held.reduce((total, item) => total + item.quantity, 0)

  const openBox = async (box: InventoryItemInstance): Promise<void> => {
    if (!lootBoxService || !inventoryService || opening) {
      return
    }
    setOpening(true)
    setError(null)
    try {
      const result = await lootBoxService.openBox(crypto.randomUUID(), box.itemInstanceId)
      showLootToast({
        title: `${getAbyssLootBoxRarityLabel(result.boxRarity)} box opened`,
        itemName: getInventoryItemDefinition(result.definitionId)?.name ?? result.definitionId,
        icon: getRewardIcon(result.definitionId),
        accentColor: '#c084fc',
        glowColor: '#7c3aed',
        reward: `×${result.quantity}`,
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
      const fishDefinition = getFishDefinition(fish.definitionId)
      showLootToast({
        title: 'Fish salvaged',
        itemName,
        icon: fishDefinition ? (
          <FishIcon icon={fishDefinition.visual.icon} color={fishDefinition.visual.accent} />
        ) : '🐟',
        accentColor: fishDefinition?.visual.accent,
        glowColor: fishDefinition?.visual.glow,
        reward: `+${result.essenceAwarded} Essence`,
      })
      await refresh()
    } catch (salvageError: unknown) {
      setError(salvageError instanceof Error ? salvageError.message : 'Unable to salvage fish.')
    } finally {
      setSalvagingItemInstanceId(null)
    }
  }

  return (
    <section className="app-screen inventory-screen loot-box-screen" aria-labelledby="inventory-title">
      <div className="app-screen-frame loot-box-panel">
        <div className="app-screen-topbar">
          <button className="app-screen-back" type="button" onClick={onBack}>
            <span aria-hidden="true">←</span> Back to the refuge
          </button>
          <dl className="app-screen-stats">
            <div>
              <dt>Items held</dt>
              <dd>{countHeld(items)}</dd>
            </div>
            <div>
              <dt>Loot boxes</dt>
              <dd>{countHeld(boxes)}</dd>
            </div>
          </dl>
        </div>
        <header className="app-screen-title">
          <p className="screen-kicker">Refuge stores</p>
          <h2 id="inventory-title">Inventory</h2>
          <p className="app-screen-lede">View fish, bait, rods, loot boxes, and other meta items.</p>
        </header>
        {error ? <p className="persistence-error" role="alert">{error}</p> : null}
        {loadState === 'loading' ? (
          <p role="status">Loading loot boxes…</p>
        ) : (
          <div className="app-screen-panels">
            <section className="app-panel inventory-section" aria-labelledby="inventory-items-title">
              <header className="app-panel-heading">
                <div>
                  <p className="screen-kicker">Meta items</p>
                  <h3 id="inventory-items-title">Owned items</h3>
                </div>
                <span className="app-panel-meta">{items.length} kinds</span>
              </header>
              {items.length === 0 ? (
                <div className="app-empty-state">
                  <span className="app-empty-state-emblem" aria-hidden="true">▣</span>
                  <h3>Nothing stored yet</h3>
                  <p>Fish the Moonwater Pond or clear Abyss floors to fill these shelves.</p>
                </div>
              ) : (
                <PaginatedInventoryGrid
                  fitToContainer
                  items={items}
                  label="Owned items"
                  getItemIcon={getInventoryItemIcon}
                  getItemDetail={getInventoryItemDetail}
                  getItemEssence={(item) => getFishingEssenceValue(item.definitionId, item.metadata)}
                  onSalvage={(item) => setPendingSalvage(item)}
                  salvagingItemInstanceId={salvagingItemInstanceId}
                />
              )}
            </section>
            <section className="app-panel inventory-section" aria-labelledby="loot-box-title">
              <header className="app-panel-heading">
                <div>
                  <p className="screen-kicker">Rewards</p>
                  <h3 id="loot-box-title">Unopened loot boxes</h3>
                </div>
                {boxes.length > 0 ? <span className="app-panel-meta">{countHeld(boxes)} waiting</span> : null}
              </header>
              {boxes.length === 0 ? (
                <div className="app-empty-state">
                  <span className="app-empty-state-emblem" aria-hidden="true">◇</span>
                  <h3>No loot boxes</h3>
                  <p>Complete Abyss floors to earn them.</p>
                </div>
              ) : (
                <FittedList
                  className="loot-box-list"
                  items={boxes}
                  label="Unopened loot boxes"
                  getKey={(box) => box.itemInstanceId}
                  renderItem={(box) => (
                    <>
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
                    </>
                  )}
                />
              )}
            </section>
          </div>
        )}
      </div>
      {pendingSalvage ? (
        <ConfirmationDialog
          title="Salvage fish?"
          message={`Salvaging ${getInventoryItemDefinition(pendingSalvage.definitionId)?.name ?? pendingSalvage.definitionId} for Essence.`}
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
