import { useCallback, useEffect, useState } from 'react'
import type { InventoryItemInstance, InventoryService } from '../inventory'
import {
  buildInventoryCategoryFilters,
  filterInventoryItems,
  formatInventorySalvageReward,
  getInventoryEssenceTotal,
  getInventoryItemCategory,
  getInventoryItemDefinition,
  getInventoryItemEssence,
  getInventoryItemRarity,
  isSalvageableItem,
  selectCommonSalvage,
} from '../inventory'
import type { InventoryCategoryFilter } from '../inventory'
import { ArtifactEffectList } from '../inventory/ArtifactEffects'
import {
  formatArtifactHeadline,
  formatArtifactSummary,
  getArtifactSalvageScrap,
  readArtifactMetadata,
} from '../content/artifacts/Artifacts'
import { CraftingBench } from '../inventory/CraftingBench'
import { PaginatedInventoryGrid } from '../inventory/PaginatedInventoryGrid'
import { EssenceAmount } from '../ui/EssenceMark'
import { RARITY_VISUALS } from '../content/rarity/Rarity'
import {
  formatFishingBaitEffect,
  formatFishingFishDetail,
  formatFishingRodModifiers,
  getFishingEssenceValue,
  isEnchantedItemMetadata,
} from '../fishing'
import { ConfirmationDialog } from '../ui/ConfirmationDialog'
import { useToaster } from '../ui/ToasterContext'
import type { LootBoxService } from './LootBoxService'
import { LootBoxOpening } from './LootBoxOpening'
import { LootBoxShelf } from './LootBoxShelf'
import { stackInventoryItems } from '../inventory/InventoryStacks'
import { useStackedPanels } from '../ui/useStackedPanels'
import { stackLootBoxes } from './LootBoxStacks'
import { getRewardIcon } from './RewardIcon'
import { useLootBoxOpening } from './useLootBoxOpening'

interface LootBoxScreenProps {
  inventoryService: InventoryService | null
  lootBoxService: LootBoxService | null
  configurationError: string | null
  onBack: () => void
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
  const artifact = readArtifactMetadata(item.definitionId, item.metadata)
  if (artifact) {
    return formatArtifactSummary(artifact)
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

const getItemEssence = (item: InventoryItemInstance): number | null =>
  getFishingEssenceValue(item.definitionId, item.metadata)

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
  const [pendingSalvage, setPendingSalvage] = useState<InventoryItemInstance | null>(null)
  const [salvagingItemInstanceId, setSalvagingItemInstanceId] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<InventoryCategoryFilter>('all')
  const [selectedItem, setSelectedItem] = useState<InventoryItemInstance | null>(null)
  const [pendingSweep, setPendingSweep] = useState<InventoryItemInstance[] | null>(null)
  const [sweptCount, setSweptCount] = useState<number | null>(null)
  /*
   * A phone shows one of the two panels at a time.
   *
   * Side by side they divide the width; stacked they divide a screenful of
   * height, and a shelf, an inspector, a reward list and a workbench do not fit
   * in half a phone each — they were drawn over one another. Picking an item
   * turns to the rail, because the answer to a tap on a slot is what is in it.
   */
  const stackedPanels = useStackedPanels()
  const [openPanel, setOpenPanel] = useState<'bag' | 'rail' | 'bench'>('bag')

  /** Re-reads the shelves, and drops a selection whose item is no longer on them. */
  const refresh = useCallback(async (): Promise<void> => {
    if (!inventoryService) {
      return
    }
    const loaded = await inventoryService.loadInventory()
    setItems(loaded)
    setSelectedItem((current) => current === null
      ? null
      : loaded.find((item) => item.itemInstanceId === current.itemInstanceId) ?? null)
    setLoadState('ready')
  }, [inventoryService])

  const reloadAfterOpening = useCallback((): void => {
    void refresh().catch((refreshError: unknown) => {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to reload the inventory.')
    })
  }, [refresh])

  const opening = useLootBoxOpening(lootBoxService, reloadAfterOpening)

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
  // Counted, not repeated: a hundred identical scraps are one slot with a
  // hundred on it, which is what leaves the shelf short enough to fit.
  const visibleItems = stackInventoryItems(filterInventoryItems(items, activeFilter))
  // Worth what is on the shelf being looked at, not what is in the bag: the
  // number has to answer the question the filter just asked.
  const visibleEssence = getInventoryEssenceTotal(visibleItems, getItemEssence)

  const commonSalvage = selectCommonSalvage(items)
  const commonSalvageEssence = getInventoryEssenceTotal(commonSalvage, getItemEssence)
  const busy = salvagingItemInstanceId !== null || sweptCount !== null

  const salvageItem = async (target: InventoryItemInstance): Promise<void> => {
    if (!inventoryService || busy) {
      return
    }
    const itemName = getInventoryItemName(target)
    setSalvagingItemInstanceId(target.itemInstanceId)
    setError(null)
    try {
      const result = await inventoryService.salvageItem(
        crypto.randomUUID(),
        target.itemInstanceId,
        1,
      )
      showLootToast({
        title: 'Item salvaged',
        itemName,
        icon: getRewardIcon(target.definitionId),
        reward: formatInventorySalvageReward(result),
      })
      await refresh()
    } catch (salvageError: unknown) {
      setError(salvageError instanceof Error ? salvageError.message : 'Unable to salvage item.')
    } finally {
      setSalvagingItemInstanceId(null)
    }
  }

  /**
   * Clears the common catch and gear in one action.
   *
   * Salvaging cost a hover, two clicks and a confirmation per item, against a
   * bag that fills a page a session with fish worth two Essence apiece. The
   * requests go one at a time because the service salvages one instance at a
   * time; a failure part-way through keeps what it earned and says how far it
   * got rather than pretending the whole sweep failed.
   */
  const sweepCommonSalvage = async (targets: readonly InventoryItemInstance[]): Promise<void> => {
    if (!inventoryService || busy) {
      return
    }
    setSweptCount(0)
    setError(null)
    let essenceAwarded = 0
    let salvaged = 0
    let failure: string | null = null
    for (const item of targets) {
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
        failure = sweepError instanceof Error ? sweepError.message : 'Unable to salvage item.'
        break
      }
    }
    if (salvaged > 0) {
      showLootToast({
        title: 'Common items salvaged',
        itemName: `${salvaged} common item${salvaged === 1 ? '' : 's'}`,
        icon: '✨',
        reward: `+${essenceAwarded} Essence`,
      })
    }
    if (failure !== null) {
      setError(
        salvaged === 0
          ? failure
          : `Salvaged ${salvaged} of ${targets.length} before stopping: ${failure}`,
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
  const selectedIsSalvageable = selectedItem !== null && isSalvageableItem(selectedItem)
  const selectedArtifact = selectedItem === null
    ? null
    : readArtifactMetadata(selectedItem.definitionId, selectedItem.metadata)
  const selectedEssence = selectedItem === null ? null : getItemEssence(selectedItem)

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
            {stackedPanels ? (
              <div className="inventory-panel-switch" role="tablist" aria-label="Stores panels">
                <button
                  type="button"
                  role="tab"
                  aria-selected={openPanel === 'bag'}
                  aria-controls="inventory-bag-panel"
                  onClick={() => { setOpenPanel('bag') }}
                >
                  Bag
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={openPanel === 'rail'}
                  aria-controls="inventory-rail-panel"
                  onClick={() => { setOpenPanel('rail') }}
                >
                  {selectedItem === null ? 'Rewards' : getInventoryItemName(selectedItem)}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={openPanel === 'bench'}
                  aria-controls="inventory-bench-panel"
                  onClick={() => { setOpenPanel('bench') }}
                >
                  Workbench
                </button>
              </div>
            ) : null}
            <section
              className="app-panel inventory-bag-panel"
              id="inventory-bag-panel"
              hidden={stackedPanels && openPanel !== 'bag'}
              aria-labelledby="inventory-items-title"
            >
              <header className="app-panel-heading">
                <div>
                  <p className="screen-kicker">Meta items</p>
                  <h3 id="inventory-items-title">Owned items</h3>
                </div>
                <span className="inventory-bag-meta">
                  <span className="app-panel-meta">
                    {visibleItems.length} {visibleItems.length === 1 ? 'kind' : 'kinds'}
                  </span>
                  <span className="inventory-bag-value">
                    <span className="inventory-bag-value-label">Worth</span>
                    <EssenceAmount value={visibleEssence} />
                  </span>
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
                    {commonSalvage.length > 0 ? (
                      <button
                        className="inventory-sweep-action"
                        type="button"
                        disabled={busy}
                        onClick={() => { setPendingSweep(commonSalvage) }}
                      >
                        {sweptCount === null
                          ? `Salvage ${commonSalvage.length} common`
                          : `Salvaging ${sweptCount} of ${commonSalvage.length}…`}
                      </button>
                    ) : null}
                  </div>
                  <PaginatedInventoryGrid
                    fitted
                    items={visibleItems}
                    label="Owned items"
                    getItemIcon={(item) => getRewardIcon(item.definitionId)}
                    getItemDetail={getInventoryItemDetail}
                    getItemEssence={getItemEssence}
                    onSelect={(item) => {
                      setSelectedItem(item)
                      if (item !== null) {
                        setOpenPanel('rail')
                      }
                    }}
                    salvagingItemInstanceId={salvagingItemInstanceId}
                  />
                </>
              )}
            </section>
            <section
              className="app-panel inventory-rail"
              id="inventory-rail-panel"
              hidden={stackedPanels && openPanel !== 'rail'}
              aria-labelledby={selectedItem === null ? 'loot-box-title' : 'inventory-inspector-title'}
            >
              {/* The inspector is absent rather than empty when nothing is
                  picked: a panel whose whole content is the words "Nothing
                  picked" is a heading with no information under it. */}
              {selectedItem === null ? null : (
                <>
                  <header className="app-panel-heading">
                    <div>
                      <p className="screen-kicker">Selected</p>
                      <h3 id="inventory-inspector-title">{getInventoryItemName(selectedItem)}</h3>
                    </div>
                    {selectedRarity === null ? null : (
                      <span className="inventory-rarity-mark" data-rarity={selectedRarity}>
                        {RARITY_VISUALS[selectedRarity].label}
                      </span>
                    )}
                  </header>
                  <div className="inventory-inspector-body">
                    <span
                      className="inventory-inspector-icon"
                      data-enchanted={isEnchantedItemMetadata(selectedItem.metadata) ? 'true' : undefined}
                      aria-hidden="true"
                    >
                      {getRewardIcon(selectedItem.definitionId)}
                    </span>
                    <div className="inventory-inspector-copy">
                      {/* An artifact's card goes under the band at the rail's
                          full width; the band keeps one line so the two do not
                          say the same thing twice. */}
                      <p className="inventory-inspector-detail">
                        {selectedArtifact
                          ? formatArtifactHeadline(selectedArtifact)
                          : getInventoryItemDetail(selectedItem)}
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
                          <dd>
                            {selectedArtifact ? (
                              `${getArtifactSalvageScrap(selectedArtifact.rarity)} scrap`
                            ) : (
                              <EssenceAmount
                                value={selectedEssence ?? getInventoryItemEssence(selectedItem)}
                              />
                            )}
                          </dd>
                        </div>
                      </dl>
                    </div>
                    {selectedIsSalvageable ? (
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
                  {selectedArtifact ? (
                    <div className="inventory-inspector-artifact">
                      <ArtifactEffectList metadata={selectedArtifact} />
                    </div>
                  ) : null}
                </>
              )}
              <section
                className="inventory-rewards"
                data-lead={selectedItem === null ? 'true' : undefined}
                aria-labelledby="loot-box-title"
              >
                <header className="inventory-rewards-heading">
                  {selectedItem === null ? <p className="screen-kicker">Rewards</p> : null}
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
                  <LootBoxShelf
                    stacks={boxStacks}
                    label="Unopened loot boxes"
                    opening={opening.isOpening}
                    onOpen={(stack) => {
                      if (stack.rarity === null) {
                        return
                      }
                      void opening.openBox({
                        boxInstanceId: stack.first.itemInstanceId,
                        boxName: stack.name,
                        rarity: stack.rarity,
                      })
                    }}
                  />
                )}
              </section>
              {/* The bench rides under the rewards where there is room for it,
                  and is a panel of its own where the panels have stacked: on a
                  phone the rail is holding an inspector and a reward list in
                  about three hundred pixels, and a fourth thing in the same
                  column was drawn over the third. */}
              {stackedPanels ? null : (
                <CraftingBench
                  items={items}
                  service={inventoryService}
                  busy={busy}
                  onCrafted={refresh}
                  onError={setError}
                />
              )}
            </section>
            {stackedPanels ? (
              <section
                className="app-panel inventory-bench-panel"
                id="inventory-bench-panel"
                hidden={openPanel !== 'bench'}
                aria-label="Workbench"
              >
                <CraftingBench
                  items={items}
                  service={inventoryService}
                  busy={busy}
                  onCrafted={refresh}
                  onError={setError}
                />
              </section>
            ) : null}
          </div>
        )}
      </div>
      <LootBoxOpening session={opening.session} onDismiss={opening.dismiss} />
      {pendingSalvage ? (
        <ConfirmationDialog
          title="Salvage item?"
          message={`Salvaging ${getInventoryItemName(pendingSalvage)} for Essence.`}
          confirmLabel="Salvage"
          onCancel={() => setPendingSalvage(null)}
          onConfirm={() => {
            const target = pendingSalvage
            setPendingSalvage(null)
            void salvageItem(target)
          }}
        />
      ) : null}
      {pendingSweep ? (
        <ConfirmationDialog
          title="Salvage every common item?"
          message={
            `${pendingSweep.length} common item${pendingSweep.length === 1 ? '' : 's'} ` +
            `will be salvaged for about ${commonSalvageEssence} Essence. Nothing rarer is touched.`
          }
          confirmLabel={`Salvage ${pendingSweep.length} item${pendingSweep.length === 1 ? '' : 's'}`}
          onCancel={() => setPendingSweep(null)}
          onConfirm={() => {
            const targets = pendingSweep
            setPendingSweep(null)
            void sweepCommonSalvage(targets)
          }}
        />
      ) : null}
    </section>
  )
}

export const LootBoxScreen = InventoryScreen
