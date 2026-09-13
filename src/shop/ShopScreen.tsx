import { useCallback, useEffect, useMemo, useState } from 'react'
import { getInventoryItemDefinition } from '../inventory/ItemDefinitions'
import type { InventoryItemInstance, InventoryService } from '../inventory/InventoryTypes'
import { getRewardIcon } from '../loot/RewardIcon'
import { EssenceAmount } from '../ui/EssenceMark'
import { useToaster } from '../ui/ToasterContext'
import { useSeededLoad } from '../ui/useSeededLoad'
import type { ShopScreenData } from './loadShopScreen'
import { getRemainingStock } from './ShopTypes'
import type { ShopPriceBand, ShopService, ShopStockLine } from './ShopTypes'

/**
 * The consignment shop.
 *
 * Two halves of one trade. The shelf is what the shop is selling today, rolled
 * once per player per day so that visiting has a reason and stock has an end;
 * the ledger below it is everything in the bag the shop will buy, so a material
 * with nothing to spend it on still has a floor price.
 *
 * There is no player-to-player transfer here and there is not meant to be one
 * yet. See docs/features/marketplace.md for why this stage ships first.
 */
interface ShopScreenProps {
  shopService: ShopService | null
  inventoryService: InventoryService | null
  configurationError: string | null
  onBack: () => void
  /** Told when Essence changed, so the rest of the app can re-read the wallet. */
  onEssenceChanged: () => void
  /**
   * The first fetch, already done by the navigator while the previous screen
   * was still showing. With it the shop paints populated on its first frame;
   * without it the shop fetches for itself, as it did before.
   */
  initialData?: ShopScreenData
  /** Why that first fetch failed, when it did; shown instead of fetching again. */
  initialLoadError?: string | null
}

interface SellableLine {
  definitionId: string
  name: string
  quantity: number
  unitPrice: number
  /** The stack a sale spends from. Oldest first, matching the bag's order. */
  first: InventoryItemInstance
}

function itemName(definitionId: string): string {
  return getInventoryItemDefinition(definitionId)?.name ?? definitionId
}

/**
 * What the shop will buy, gathered per definition rather than per stack.
 *
 * A player with nine separate scrap stacks wants one line saying nine, not nine
 * lines saying one. The sale still names a stack, because that is what the
 * server consumes; this only decides which one and how many it is worth.
 */
function collectSellable(
  items: readonly InventoryItemInstance[],
  bands: readonly ShopPriceBand[],
): SellableLine[] {
  const pricesByDefinition = new Map(bands.map((band) => [band.definitionId, band.sellPrice]))
  const lines = new Map<string, SellableLine>()
  for (const item of items) {
    const unitPrice = pricesByDefinition.get(item.definitionId)
    if (unitPrice === undefined || item.quantity < 1 || item.bound) {
      continue
    }
    const existing = lines.get(item.definitionId)
    if (existing) {
      existing.quantity += item.quantity
      continue
    }
    lines.set(item.definitionId, {
      definitionId: item.definitionId,
      name: itemName(item.definitionId),
      quantity: item.quantity,
      unitPrice,
      first: item,
    })
  }
  return [...lines.values()].sort((left, right) => left.name.localeCompare(right.name))
}

export function ShopScreen({
  shopService,
  inventoryService,
  configurationError,
  onBack,
  onEssenceChanged,
  initialData,
  initialLoadError = null,
}: ShopScreenProps) {
  const { showLootToast, showToast } = useToaster()
  const seeded = useSeededLoad(initialData !== undefined || initialLoadError !== null, shopService)
  const [bands, setBands] = useState<ShopPriceBand[]>(() => initialData?.bands ?? [])
  const [stock, setStock] = useState<ShopStockLine[]>(() => initialData?.stock ?? [])
  const [items, setItems] = useState<InventoryItemInstance[]>(() => initialData?.items ?? [])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    () => initialData
      ? 'ready'
      : initialLoadError !== null || !shopService ? 'error' : 'loading',
  )
  const [error, setError] = useState<string | null>(
    () => initialLoadError ??
      (shopService ? configurationError : configurationError ?? 'The shop is unavailable.'),
  )
  const [busyDefinitionId, setBusyDefinitionId] = useState<string | null>(null)

  const read = useCallback(async () => {
    if (!shopService) {
      return null
    }
    const [loadedBands, loadedStock, loadedItems] = await Promise.all([
      shopService.loadPriceBands(),
      shopService.loadStock(),
      inventoryService?.loadInventory() ?? Promise.resolve([]),
    ])
    return { loadedBands, loadedStock, loadedItems }
  }, [shopService, inventoryService])

  const refresh = useCallback(async (): Promise<void> => {
    const counter = await read()
    if (counter === null) {
      return
    }
    setBands(counter.loadedBands)
    setStock(counter.loadedStock)
    setItems(counter.loadedItems)
    setLoadState('ready')
  }, [read])

  useEffect(() => {
    if (!shopService || seeded) {
      return
    }
    let cancelled = false
    void read()
      .then((counter) => {
        if (cancelled || counter === null) {
          return
        }
        setBands(counter.loadedBands)
        setStock(counter.loadedStock)
        setItems(counter.loadedItems)
        setLoadState('ready')
        setError(null)
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setLoadState('error')
          setError(loadError instanceof Error ? loadError.message : 'Unable to open the shop.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [seeded, shopService, read])

  const sellable = useMemo(() => collectSellable(items, bands), [items, bands])
  const busy = busyDefinitionId !== null

  const sell = async (line: SellableLine): Promise<void> => {
    if (!shopService || busy) {
      return
    }
    setBusyDefinitionId(line.definitionId)
    setError(null)
    try {
      const result = await shopService.sellItem(
        crypto.randomUUID(),
        line.first.itemInstanceId,
        Math.min(line.first.quantity, line.quantity),
      )
      showLootToast({
        title: 'Sold to the shop',
        itemName: `${result.quantitySold} ${line.name}`,
        icon: getRewardIcon(line.definitionId),
        reward: `+${result.essenceAwarded} Essence`,
      })
      onEssenceChanged()
      await refresh()
    } catch (sellError: unknown) {
      setError(sellError instanceof Error ? sellError.message : 'Unable to sell that.')
    } finally {
      setBusyDefinitionId(null)
    }
  }

  const buy = async (line: ShopStockLine): Promise<void> => {
    if (!shopService || busy) {
      return
    }
    setBusyDefinitionId(line.definitionId)
    setError(null)
    try {
      const result = await shopService.buyItem(crypto.randomUUID(), line.definitionId, 1)
      showLootToast({
        title: 'Bought from the shop',
        itemName: itemName(line.definitionId),
        icon: getRewardIcon(line.definitionId),
        reward: `×${result.quantityBought}`,
      })
      onEssenceChanged()
      await refresh()
    } catch (buyError: unknown) {
      const message = buyError instanceof Error ? buyError.message : 'Unable to buy that.'
      showToast(message, 'error')
      setError(message)
    } finally {
      setBusyDefinitionId(null)
    }
  }

  return (
    <section className="app-screen shop-screen" aria-labelledby="shop-title">
      <div className="app-screen-frame">
        <div className="app-screen-topbar">
          <button className="app-screen-back" type="button" onClick={onBack}>
            <span aria-hidden="true">←</span> Back to the refuge
          </button>
        </div>
        <header className="app-screen-title">
          <p className="screen-kicker">Refuge stores</p>
          <h2 id="shop-title">The quartermaster</h2>
          <p className="app-screen-lede">
            A short shelf, restocked each day, and a standing offer on anything
            you would rather not carry.
          </p>
        </header>
        {error ? <p className="persistence-error" role="alert">{error}</p> : null}
        {loadState === 'loading' ? (
          <p role="status">Opening the shop…</p>
        ) : (
          <div className="app-screen-panels">
            <section className="app-panel shop-shelf-panel" aria-labelledby="shop-shelf-title">
              <header className="app-panel-heading">
                <div>
                  <p className="screen-kicker">On the shelf</p>
                  <h3 id="shop-shelf-title">Today's stock</h3>
                </div>
                <span className="app-panel-meta">Restocks daily</span>
              </header>
              {stock.length === 0 ? (
                <p className="shop-empty">
                  The quartermaster has nothing out today. Come back tomorrow.
                </p>
              ) : (
                <ul className="shop-line-list">
                  {stock.map((line) => {
                    const remaining = getRemainingStock(line)
                    return (
                      <li className="shop-line" key={line.definitionId}>
                        <span className="shop-line-icon" aria-hidden="true">
                          {getRewardIcon(line.definitionId)}
                        </span>
                        <div className="shop-line-copy">
                          <strong>{itemName(line.definitionId)}</strong>
                          <small>
                            {remaining === 0
                              ? 'Sold out for today'
                              : `${remaining} left today`}
                          </small>
                        </div>
                        <span className="shop-line-price">
                          <EssenceAmount value={line.unitPrice} />
                        </span>
                        <button
                          className="secondary-action shop-line-action"
                          type="button"
                          disabled={busy || remaining === 0}
                          onClick={() => { void buy(line) }}
                        >
                          {busyDefinitionId === line.definitionId ? 'Buying…' : 'Buy one'}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
            <section className="app-panel shop-offer-panel" aria-labelledby="shop-offer-title">
              <header className="app-panel-heading">
                <div>
                  <p className="screen-kicker">Standing offer</p>
                  <h3 id="shop-offer-title">What the shop will buy</h3>
                </div>
              </header>
              {sellable.length === 0 ? (
                <p className="shop-empty">
                  Nothing in the bag that the quartermaster deals in. Scrap comes
                  back from a finished dungeon.
                </p>
              ) : (
                <ul className="shop-line-list">
                  {sellable.map((line) => (
                    <li className="shop-line" key={line.definitionId}>
                      <span className="shop-line-icon" aria-hidden="true">
                        {getRewardIcon(line.definitionId)}
                      </span>
                      <div className="shop-line-copy">
                        <strong>{line.name}</strong>
                        <small>{line.quantity} held</small>
                      </div>
                      <span className="shop-line-price">
                        <EssenceAmount value={line.unitPrice} /> each
                      </span>
                      <button
                        className="secondary-action shop-line-action"
                        type="button"
                        disabled={busy}
                        onClick={() => { void sell(line) }}
                      >
                        {busyDefinitionId === line.definitionId ? 'Selling…' : 'Sell'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </section>
  )
}
