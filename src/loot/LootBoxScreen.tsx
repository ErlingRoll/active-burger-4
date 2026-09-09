import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { InventoryItemInstance, InventoryService } from '../inventory'
import {
  buildInventoryCategoryFilters,
  filterInventoryItems,
  getInventoryItemCategory,
  getInventoryItemDefinition,
  getInventoryItemRarity,
  selectCommonFish,
} from '../inventory'
import type { InventoryCategoryFilter } from '../inventory'
import { PaginatedInventoryGrid } from '../inventory/PaginatedInventoryGrid'
import { FittedList } from '../ui/FittedList'
import { EssenceAmount } from '../ui/EssenceMark'
import { RARITY_ORDER, RARITY_VISUALS } from '../content/rarity/Rarity'
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

/**
 * A shelf of identical boxes, counted rather than repeated.
 *
 * The rewards list rendered one row per item instance, so four identical
 * legendary boxes were four rows carrying four identical buttons, and the list
 * paged at eight boxes while the heading above it said eight were waiting.
 * Boxes of one kind are interchangeable, so they are one row and a count.
 */
interface LootBoxStack {
  readonly definitionId: string
  readonly name: string
  readonly quantity: number
  readonly rarityOrder: number
  readonly first: InventoryItemInstance
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

function getInventoryItemName(item: InventoryItemInstance): string {
  return getInventoryItemDefinition(item.definitionId)?.name ?? item.definitionId
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

function getSalvageEssence(item: InventoryItemInstance): number {
  return getFishingEssenceValue(item.definitionId, item.metadata) ??
    getInventoryItemDefinition(item.definitionId)?.salvageEssence ??
    0
}

function stackLootBoxes(boxes: readonly InventoryItemInstance[]): LootBoxStack[] {
  const stacks = new Map<string, LootBoxStack>()
  for (const box of boxes) {
    const existing = stacks.get(box.definitionId)
    if (existing) {
      stacks.set(box.definitionId, { ...existing, quantity: existing.quantity + box.quantity })
      continue
    }
    const rarity = getInventoryItemRarity(box)
    stacks.set(box.definitionId, {
      definitionId: box.definitionId,
      name: getInventoryItemName(box),
      quantity: box.quantity,
      rarityOrder: rarity === null ? -1 : RARITY_ORDER[rarity],
      first: box,
    })
  }
  return [...stacks.values()].sort((left, right) =>
    right.rarityOrder - left.rarityOrder || left.name.localeCompare(right.name),
  )
}

export function InventoryScreen({
  inventoryService,
  lootBoxService,
  configurationError,
  onBack,
}: LootBoxScreenProps) {
  const { showLootToast, showToast } = useToaster()
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
  const [categoryFilter, setCategoryFilter] = useState<InventoryCategoryFilter>('all')
  const [selectedItem, setSelectedItem] = useState<InventoryItemInstance | null>(null)
  const [pendingSweep, setPendingSweep] = useState<InventoryItemInstance[] | null>(null)
  const [sweptCount, setSweptCount] = useState<number | null>(null)

  /** Re-reads the shelves, and drops a selection whose item is no longer on them. */
  const refresh = async (): Promise<void> => {
    if (!inventoryService) {
      return
    }
    const loaded = await inventoryService.loadInventory()
    setItems(loaded)
    setSelectedItem((current) => current === null
      ? null
      : loaded.find((item) => item.itemInstanceId === current.itemInstanceId) ?? null)
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

  const boxes = items.filter((item) => getInventoryItemCategory(item) === 'loot-box')
  const boxStacks = stackLootBoxes(boxes)
  const countHeld = (held: readonly InventoryItemInstance[]): number =>
    held.reduce((total, item) => total + item.quantity, 0)

  const filters = buildInventoryCategoryFilters(items)
  // A chip disappears with the last item of its kind, so the filter it leaves
  // behind has to fall back rather than showing an empty shelf with no way off it.
  const activeFilter = filters.some((filter) => filter.id === categoryFilter)
    ? categoryFilter
    : 'all'
  const visibleItems = filterInventoryItems(items, activeFilter)

  const commonFish = selectCommonFish(items)
  const commonFishEssence = commonFish.reduce(
    (total, fish) => total + getSalvageEssence(fish) * fish.quantity,
    0,
  )
  const busy = salvagingItemInstanceId !== null || sweptCount !== null

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
    if (!inventoryService || busy) {
      return
    }
    const itemName = getInventoryItemName(fish)
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

  /**
   * Clears the common catch in one action.
   *
   * Salvaging cost a hover, two clicks and a confirmation per fish, against a
   * bag that fills a page a session with fish worth two Essence apiece. The
   * requests go one at a time because the service salvages one instance at a
   * time; a failure part-way through keeps what it earned and says how far it
   * got rather than pretending the whole sweep failed.
   */
  const sweepCommonFish = async (fish: readonly InventoryItemInstance[]): Promise<void> => {
    if (!inventoryService || busy) {
      return
    }
    setSweptCount(0)
    setError(null)
    let essenceAwarded = 0
    let salvaged = 0
    let failure: string | null = null
    for (const item of fish) {
      try {
        const result = await inventoryService.salvageItem(
          crypto.randomUUID(),
          item.itemInstanceId,
          item.quantity,
        )
        essenceAwarded += result.essenceAwarded
        salvaged += 1
        setSweptCount(salvaged)
      } catch (sweepError: unknown) {
        failure = sweepError instanceof Error ? sweepError.message : 'Unable to salvage fish.'
        break
      }
    }
    if (salvaged > 0) {
      showLootToast({
        title: 'Common catch salvaged',
        itemName: `${salvaged} common fish`,
        icon: '🐟',
        reward: `+${essenceAwarded} Essence`,
      })
    }
    if (failure !== null) {
      setError(
        salvaged === 0
          ? failure
          : `Salvaged ${salvaged} of ${fish.length} before stopping: ${failure}`,
      )
    }
    setSweptCount(null)
    try {
      await refresh()
    } catch (refreshError: unknown) {
      showToast(
        refreshError instanceof Error ? refreshError.message : 'Unable to reload the inventory.',
        'error',
      )
    }
  }

  const selectedRarity = selectedItem === null ? null : getInventoryItemRarity(selectedItem)
  const selectedIsFish = selectedItem !== null && getInventoryItemCategory(selectedItem) === 'fish'
  const selectedEssence = selectedItem === null
    ? null
    : getFishingEssenceValue(selectedItem.definitionId, selectedItem.metadata)

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
          <p className="app-screen-lede">Pick a slot to inspect it. Salvage what you do not need.</p>
        </header>
        {error ? <p className="persistence-error" role="alert">{error}</p> : null}
        {loadState === 'loading' ? (
          <p role="status">Loading inventory…</p>
        ) : (
          <div className="app-screen-panels">
            <section className="app-panel inventory-bag-panel" aria-labelledby="inventory-items-title">
              <header className="app-panel-heading">
                <div>
                  <p className="screen-kicker">Meta items</p>
                  <h3 id="inventory-items-title">Owned items</h3>
                </div>
                <span className="app-panel-meta">
                  {visibleItems.length} {visibleItems.length === 1 ? 'kind' : 'kinds'}
                </span>
              </header>
              {items.length === 0 ? (
                <div className="app-empty-state">
                  <span className="app-empty-state-emblem" aria-hidden="true">▣</span>
                  <h3>Nothing stored yet</h3>
                  <p>Fish the Moonwater Pond or clear Abyss floors to fill these shelves.</p>
                </div>
              ) : (
                <>
                  <div className="inventory-toolbar">
                    <div
                      className="inventory-filter-chips"
                      role="group"
                      aria-label="Filter items by category"
                    >
                      {filters.map((filter) => (
                        <button
                          className="inventory-filter-chip"
                          type="button"
                          key={filter.id}
                          aria-pressed={filter.id === activeFilter}
                          onClick={() => { setCategoryFilter(filter.id) }}
                        >
                          {filter.label}
                          <span className="inventory-filter-chip-count">{filter.count}</span>
                        </button>
                      ))}
                    </div>
                    {commonFish.length > 0 ? (
                      <button
                        className="inventory-sweep-action"
                        type="button"
                        disabled={busy}
                        onClick={() => { setPendingSweep(commonFish) }}
                      >
                        {sweptCount === null
                          ? `Salvage ${commonFish.length} common`
                          : `Salvaging ${sweptCount} of ${commonFish.length}…`}
                      </button>
                    ) : null}
                  </div>
                  <PaginatedInventoryGrid
                    fitToContainer
                    items={visibleItems}
                    label="Owned items"
                    getItemIcon={getInventoryItemIcon}
                    getItemDetail={getInventoryItemDetail}
                    getItemEssence={(item) => getFishingEssenceValue(item.definitionId, item.metadata)}
                    onSelect={setSelectedItem}
                    showTooltip={false}
                    salvagingItemInstanceId={salvagingItemInstanceId}
                  />
                </>
              )}
            </section>
            <section className="app-panel inventory-rail" aria-labelledby="inventory-inspector-title">
              <header className="app-panel-heading">
                <div>
                  <p className="screen-kicker">Selected</p>
                  <h3 id="inventory-inspector-title">
                    {selectedItem === null ? 'Nothing picked' : getInventoryItemName(selectedItem)}
                  </h3>
                </div>
                {selectedRarity === null ? null : (
                  <span className="inventory-rarity-mark" data-rarity={selectedRarity}>
                    {RARITY_VISUALS[selectedRarity].label}
                  </span>
                )}
              </header>
              {selectedItem === null ? (
                <p className="inventory-inspector-hint">
                  Pick a slot to read it here.
                </p>
              ) : (
                <div className="inventory-inspector-body">
                  <span className="inventory-inspector-icon" aria-hidden="true">
                    {getInventoryItemIcon(selectedItem)}
                  </span>
                  <div className="inventory-inspector-copy">
                    <p className="inventory-inspector-detail">
                      {getInventoryItemDetail(selectedItem)}
                    </p>
                    <dl className="inventory-inspector-facts">
                      <div>
                        <dt>Quantity</dt>
                        <dd>×{selectedItem.quantity}</dd>
                      </div>
                      <div>
                        <dt>Source</dt>
                        <dd>{selectedItem.source.type.replace('-', ' ')}</dd>
                      </div>
                      <div>
                        <dt>Salvage</dt>
                        <dd><EssenceAmount value={selectedEssence} /></dd>
                      </div>
                    </dl>
                  </div>
                  {selectedIsFish ? (
                    <button
                      className="primary-action inventory-inspector-salvage"
                      type="button"
                      disabled={busy}
                      onClick={() => { setPendingSalvage(selectedItem) }}
                    >
                      {salvagingItemInstanceId === selectedItem.itemInstanceId
                        ? 'Salvaging…'
                        : 'Salvage'}
                    </button>
                  ) : null}
                </div>
              )}
              <section className="inventory-rewards" aria-labelledby="loot-box-title">
                <header className="inventory-rewards-heading">
                  <h4 id="loot-box-title">Unopened loot boxes</h4>
                  {boxes.length > 0 ? (
                    <span className="app-panel-meta">{countHeld(boxes)} waiting</span>
                  ) : null}
                </header>
                {boxStacks.length === 0 ? (
                  <p className="inventory-inspector-hint">
                    No loot boxes. Complete Abyss floors to earn them.
                  </p>
                ) : (
                  <FittedList
                    className="loot-box-list"
                    items={boxStacks}
                    label="Unopened loot boxes"
                    getKey={(stack) => stack.definitionId}
                    renderItem={(stack) => (
                      <>
                        <div>
                          <strong>{stack.name}</strong>
                          <span>×{stack.quantity}</span>
                        </div>
                        <button
                          className="primary-action"
                          type="button"
                          onClick={() => { void openBox(stack.first) }}
                          disabled={opening}
                        >
                          {opening ? 'Opening…' : 'Open one'}
                        </button>
                      </>
                    )}
                  />
                )}
              </section>
            </section>
          </div>
        )}
      </div>
      {pendingSalvage ? (
        <ConfirmationDialog
          title="Salvage fish?"
          message={`Salvaging ${getInventoryItemName(pendingSalvage)} for Essence.`}
          confirmLabel="Salvage fish"
          onCancel={() => setPendingSalvage(null)}
          onConfirm={() => {
            const fish = pendingSalvage
            setPendingSalvage(null)
            void salvageFish(fish)
          }}
        />
      ) : null}
      {pendingSweep ? (
        <ConfirmationDialog
          title="Salvage every common fish?"
          message={
            `${pendingSweep.length} common fish will be salvaged for about ` +
            `${commonFishEssence} Essence. Nothing rarer is touched.`
          }
          confirmLabel={`Salvage ${pendingSweep.length} fish`}
          onCancel={() => setPendingSweep(null)}
          onConfirm={() => {
            const fish = pendingSweep
            setPendingSweep(null)
            void sweepCommonFish(fish)
          }}
        />
      ) : null}
    </section>
  )
}

export const LootBoxScreen = InventoryScreen
