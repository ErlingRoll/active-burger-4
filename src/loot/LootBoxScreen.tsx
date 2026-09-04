import { useEffect, useState } from 'react'
import type { InventoryItemInstance, InventoryService } from '../inventory'
import { getInventoryItemDefinition } from '../inventory'
import type { LootBoxService } from './LootBoxService'
import { getAbyssLootBoxRarityLabel } from './LootBoxes'

interface LootBoxScreenProps {
  inventoryService: InventoryService | null
  lootBoxService: LootBoxService | null
  configurationError: string | null
  onBack: () => void
}

export function LootBoxScreen({
  inventoryService,
  lootBoxService,
  configurationError,
  onBack,
}: LootBoxScreenProps) {
  const [boxes, setBoxes] = useState<InventoryItemInstance[]>([])
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

  const refresh = async (): Promise<void> => {
    if (!inventoryService) {
      return
    }
    const items = await inventoryService.loadInventory('loot-box')
    setBoxes(items)
    setLoadState('ready')
  }

  useEffect(() => {
    if (!inventoryService) {
      return
    }
    let cancelled = false
    void inventoryService.loadInventory('loot-box')
      .then((items) => {
        if (!cancelled) {
          setBoxes(items)
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

  return (
    <section className="dashboard loot-box-screen" aria-labelledby="loot-box-title">
      <div className="dashboard-panel loot-box-panel">
        <button className="secondary-action" type="button" onClick={onBack}>Back to dashboard</button>
        <p className="screen-kicker">Inventory</p>
        <h2 id="loot-box-title">Loot Boxes</h2>
        <p>Open boxes to receive a server-resolved reward from their rarity pool.</p>
        {error ? <p className="persistence-error" role="alert">{error}</p> : null}
        {lastOpening ? (
          <section className="loot-box-result" aria-live="polite">
            <p className="screen-kicker">{lastOpening.boxRarity} box opened</p>
            <strong>{getInventoryItemDefinition(lastOpening.definitionId)?.name ?? lastOpening.definitionId}</strong>
            <span>×{lastOpening.quantity}</span>
          </section>
        ) : null}
        {loadState === 'loading' ? (
          <p role="status">Loading loot boxes…</p>
        ) : boxes.length === 0 ? (
          <section className="champion-empty-state">
            <h3>No unopened boxes</h3>
            <p>Complete Abyss floors to earn loot boxes.</p>
          </section>
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
      </div>
    </section>
  )
}
