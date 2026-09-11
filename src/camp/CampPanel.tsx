import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CharacterService, ChampionSnapshot } from '../characters/CharacterTypes'
import { formatChampionAvailability, isChampionExhausted } from '../characters/ChampionExhaustion'
import { CHARACTER_CLASS_DEFINITIONS } from '../content/classes/CharacterClasses'
import { previewCampProduction } from '../content/camp/CampAccrual'
import {
  CAMP_BUILDING_DEFINITIONS,
  getCampBuildingLevel,
  getNextCampBuildingLevel,
} from '../content/camp/CampBuildings'
import { ALL_CAMP_JOB_DEFINITIONS, getCampJobDefinition } from '../content/camp/CampJobs'
import { deriveCampLabourSheet } from '../content/camp/CampLabour'
import type { CampBuildingId, CampBuildingLevel, CampJobDefinition, CampJobId } from '../content/camp/CampTypes'
import { RARITY_VISUALS, isRarity } from '../content/rarity/Rarity'
import {
  formatArtifactSummary,
  getArtifactBaseByDefinitionId,
  readArtifactMetadata,
} from '../content/artifacts/Artifacts'
import {
  formatFishSizeKg,
  getFishDefinition,
  getFishingEnchantmentDefinition,
} from '../fishing/FishingContent'
import {
  countAffordableBatches,
  countHeldQuantity,
  getCraftingRecipeOutputName,
  getCraftingRecipesForBuilding,
  type CraftingRecipe,
} from '../inventory/CraftingRecipes'
import { getInventoryItemDefinition } from '../inventory/ItemDefinitions'
import type { InventoryItemInstance, InventoryService } from '../inventory/InventoryTypes'
import { getRewardIcon } from '../loot/RewardIcon'
import { useToaster } from '../ui/ToasterContext'
import { useNow } from '../ui/useNow'
import { LabourSheetLine } from './LabourSheetLine'
import { nextCureStep, roeForFish } from './Smokehouse'
import { REFORGE_COSTS } from './Forge'
import type { CampAssignment, CampPayment, CampService, CampState } from './CampTypes'

/**
 * The Camp, as a panel on the hub.
 *
 * One card per building. A job card shows the Champions working it and what
 * they have pending, with a picker that opens inside the card when a slot is
 * free; the picker is where the labour sheet earns its keep, because every
 * Champion shows the sheet it would work this job with. An exhausted Champion
 * is pickable, because exhaustion blocks the Abyss and not labour, and the
 * Rift anchor takes only exhausted Champions, because rest is all it gives.
 *
 * The workshops end the list: the tackle bench crafts bait from the Camp's
 * timber, the Smokehouse guts a fish for roe or cures a meal fish with it,
 * and the Forge rerolls an artifact for scrap and shards. Every card ends in
 * its next level's price against what the bag holds.
 * Pending units count up on the client from the server's clock, never from
 * the client's own, and every change is answered with the server's state.
 */

interface CampPanelProps {
  id?: string
  service: CampService | null
  configurationError: string | null
  characterService: CharacterService | null
  /** For what the bag holds against a price, the bench's crafts and the Smokehouse's fish. */
  inventoryService: InventoryService | null
  /** Shows the clock-skipping row. The header decides this: an administrator on a build with the tools on. */
  developmentToolsEnabled?: boolean
  onClose: () => void
}

/** The hours a tester skips at a time: a few units' worth, and a Storehouse's worth. */
const DEVELOPMENT_SKIPS = [1, 8] as const

/** How often the pending counts tick. A unit takes minutes, so seconds would be theatre. */
const CAMP_TICK_MS = 15_000

type FishAction = 'gut' | 'cure'

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function itemName(definitionId: string): string {
  return getInventoryItemDefinition(definitionId)?.name ?? definitionId
}

/** The server's now, carried forward on the client's clock since the state arrived. */
function serverNow(state: CampState, now: number): number {
  return Date.parse(state.serverTime) + Math.max(0, now - state.receivedAt)
}

function pendingFor(assignment: CampAssignment, state: CampState, now: number): number {
  return previewCampProduction({
    ratePerHour: assignment.ratePerHour,
    capHours: assignment.capHours,
    accruedFromMs: Date.parse(assignment.accruedFrom),
    nowMs: serverNow(state, now),
  })
}

function formatRate(unitsPerHour: number): string {
  return `${Number(unitsPerHour.toFixed(1))}/h`
}

function formatHours(hours: number): string {
  return `${Number(hours.toFixed(1))}h`
}

function buildingLevel(state: CampState, buildingId: CampBuildingId): number {
  return state.buildings.find((entry) => entry.buildingId === buildingId)?.level
    ?? CAMP_BUILDING_DEFINITIONS[buildingId].startingLevel
}

/** What a level is for, in the words the row uses. */
function describeLevel(level: CampBuildingLevel): string {
  switch (level.buildingId) {
    case 'storehouse':
      return `Holds ${formatHours(level.accrualCapHours ?? 0)} of work`
    case 'tackle-bench':
      return 'Crafts bait from timber and scrap'
    case 'smokehouse':
      return 'Guts and cures fish'
    case 'forge':
      return level.level === 1 ? 'Reforges artifacts' : `+${level.level === 2 ? 25 : 50}% scrap from run salvage`
    default:
      return `×${level.rateMultiplier} rate · ${level.jobSlots} ${level.jobSlots === 1 ? 'slot' : 'slots'}`
  }
}

/** "48 Timber · 48 Stone", each figure marked when the bag is short of it. */
function CampCost({ cost, held }: { cost: Readonly<Record<string, number>>, held: readonly InventoryItemInstance[] }) {
  return (
    <span className="camp-cost">
      {Object.entries(cost).map(([definitionId, quantity]) => (
        <span key={definitionId} data-short={countHeldQuantity(held, definitionId) < quantity ? 'true' : undefined}>
          {quantity} {itemName(definitionId)}
        </span>
      ))}
    </span>
  )
}

function canAfford(cost: Readonly<Record<string, number>>, held: readonly InventoryItemInstance[]): boolean {
  return Object.entries(cost).every(([definitionId, quantity]) => countHeldQuantity(held, definitionId) >= quantity)
}

interface CampUpgradeRowProps {
  buildingId: CampBuildingId
  level: number
  held: readonly InventoryItemInstance[]
  busy: boolean
  onUpgrade: () => void
}

function CampUpgradeRow({ buildingId, level, held, busy, onUpgrade }: CampUpgradeRowProps) {
  const next = getNextCampBuildingLevel(buildingId, level)
  const name = CAMP_BUILDING_DEFINITIONS[buildingId].name
  // A building at its top has nothing to sell; the card already says its level.
  if (!next) {
    return null
  }
  const building = level === 0
  return (
    <div className="camp-upgrade-row">
      <span className="camp-upgrade-copy">
        <strong>{building ? `Build the ${name.toLowerCase()}` : `${name} ${next.level}`} · {describeLevel(next)}</strong>
        <CampCost cost={next.cost} held={held} />
      </span>
      <button
        className="camp-upgrade-action"
        type="button"
        onClick={onUpgrade}
        disabled={busy || !canAfford(next.cost, held)}
        aria-label={`${building ? 'Build' : 'Upgrade'} the ${name.toLowerCase()}`}
      >
        {building ? 'Build' : 'Upgrade'}
      </button>
    </div>
  )
}

interface CampWorkerProps {
  job: CampJobDefinition
  assignment: CampAssignment
  champion: ChampionSnapshot | undefined
  pending: number
  busy: boolean
  onRecall: () => void
}

function CampWorker({ job, assignment, champion, pending, busy, onRecall }: CampWorkerProps) {
  const unit = job.effect === 'exhaustion-relief'
    ? 'min of rest'
    : itemName(job.outputDefinitionId ?? '').toLowerCase()
  return (
    <li className="camp-worker">
      <span className="camp-worker-copy">
        <strong>{champion?.name ?? 'A Champion'}</strong>
        <LabourSheetLine sheet={assignment.sheet} />
      </span>
      <span className="camp-worker-pending" aria-label={`${pending} ${unit} pending`}>
        <strong>{pending}</strong>
        <small>{formatRate(assignment.ratePerHour)} · {formatHours(assignment.capHours)} cap</small>
      </span>
      <button className="camp-recall-action" type="button" onClick={onRecall} disabled={busy}>
        Bring back
      </button>
    </li>
  )
}

interface CampPickerProps {
  job: CampJobDefinition
  champions: readonly ChampionSnapshot[]
  state: CampState
  now: number
  busy: boolean
  onPick: (championId: string) => void
  onCancel: () => void
}

function CampPicker({ job, champions, state, now, busy, onPick, onCancel }: CampPickerProps) {
  const restOnly = job.effect === 'exhaustion-relief'
  const candidates = champions.filter((champion) =>
    !state.assignments.some((assignment) =>
      assignment.championId === champion.championId && assignment.jobId === job.id,
    ) && (!restOnly || isChampionExhausted(champion, now)),
  )
  return (
    <div className="camp-picker" role="group" aria-label={`Choose a Champion for ${job.name}`}>
      {candidates.length === 0 ? (
        <p className="camp-picker-empty">
          {restOnly
            ? 'No Champion is exhausted. The anchor has nothing to give a rested one.'
            : 'Every Champion on the roster is already here. Win a dungeon to save another.'}
        </p>
      ) : (
        <ul className="camp-picker-list">
          {candidates.map((champion) => {
            const elsewhere = state.assignments.find(
              (assignment) => assignment.championId === champion.championId,
            )
            const sheet = deriveCampLabourSheet({
              build: champion.build,
              sourceFloor: state.championFloors[champion.championId] ?? null,
            }, job)
            const status = elsewhere
              ? `Working · ${CAMP_BUILDING_DEFINITIONS[getCampJobDefinition(elsewhere.jobId)?.buildingId ?? 'woodline'].name}`
              : formatChampionAvailability(champion, now)
            return (
              <li key={champion.championId}>
                <button
                  className={`camp-picker-option${isChampionExhausted(champion, now) ? ' exhausted' : ''}`}
                  type="button"
                  onClick={() => onPick(champion.championId)}
                  disabled={busy}
                >
                  <span className="camp-picker-copy">
                    <strong>{champion.name}</strong>
                    <span>{CHARACTER_CLASS_DEFINITIONS[champion.build.classId].name} · {status}</span>
                    <LabourSheetLine sheet={sheet} />
                  </span>
                  <span className="camp-picker-send" aria-hidden="true">
                    {elsewhere ? 'Move here' : 'Send'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <button className="camp-picker-cancel" type="button" onClick={onCancel} disabled={busy}>
        Cancel
      </button>
    </div>
  )
}

interface CampRecipeProps {
  recipe: CraftingRecipe
  held: readonly InventoryItemInstance[]
  busy: boolean
  onCraft: () => void
}

function CampRecipe({ recipe, held, busy, onCraft }: CampRecipeProps) {
  const cost = Object.fromEntries(recipe.inputs.map((input) => [input.definitionId, input.quantity]))
  return (
    <li className="camp-recipe">
      <span className="camp-recipe-icon" aria-hidden="true">{getRewardIcon(recipe.outputDefinitionId)}</span>
      <span className="camp-recipe-copy">
        <strong>{recipe.name}</strong>
        <CampCost cost={cost} held={held} />
      </span>
      <button
        className="camp-upgrade-action"
        type="button"
        onClick={onCraft}
        disabled={busy || countAffordableBatches(held, recipe) < 1}
        aria-label={`${recipe.name}: make ${recipe.outputQuantity} ${getCraftingRecipeOutputName(recipe)}`}
      >
        Make ×{recipe.outputQuantity}
      </button>
    </li>
  )
}

interface FishPickerProps {
  action: FishAction
  fish: readonly InventoryItemInstance[]
  loading: boolean
  roeHeld: number
  busy: boolean
  onPick: (fish: InventoryItemInstance) => void
  onCancel: () => void
}

/** What one fish is worth to the Smokehouse, for the picker's row. */
function describeFishChoice(action: FishAction, fish: InventoryItemInstance, roeHeld: number): { label: string, disabled: boolean } {
  const definition = getFishDefinition(fish.definitionId)
  if (action === 'gut') {
    const rarity = isRarity(fish.metadata.rarity) ? fish.metadata.rarity : definition?.rarity
    return { label: `→ ${roeForFish(rarity, fish.metadata.sizePercentile)} roe`, disabled: false }
  }
  if (!definition?.effect.runMealEligible) {
    return { label: 'Not a meal fish', disabled: true }
  }
  const step = nextCureStep(fish.metadata)
  if (!step) {
    return { label: 'Cured as far as it goes', disabled: true }
  }
  const enchantment = getFishingEnchantmentDefinition(step.enchantmentId)
  return {
    label: `${step.roeCost} roe → ${enchantment?.name ?? step.enchantmentId} (+${enchantment?.effectBonusPercent ?? 0}%)`,
    disabled: roeHeld < step.roeCost,
  }
}

function FishPicker({ action, fish, loading, roeHeld, busy, onPick, onCancel }: FishPickerProps) {
  const title = action === 'gut' ? 'Choose a fish to gut' : 'Choose a fish to cure'
  return (
    <div className="camp-picker" role="group" aria-label={title}>
      {loading ? (
        <p className="camp-picker-empty">Looking through the creel…</p>
      ) : fish.length === 0 ? (
        <p className="camp-picker-empty">No fish in the bag. The pond is that way.</p>
      ) : (
        <ul className="camp-picker-list">
          {fish.map((item) => {
            const definition = getFishDefinition(item.definitionId)
            const rarity = isRarity(item.metadata.rarity) ? item.metadata.rarity : definition?.rarity
            const enchantment = getFishingEnchantmentDefinition(item.metadata.enchantmentId)
            const choice = describeFishChoice(action, item, roeHeld)
            return (
              <li key={item.itemInstanceId}>
                <button
                  className="camp-picker-option camp-fish-option"
                  type="button"
                  onClick={() => onPick(item)}
                  disabled={busy || choice.disabled}
                  aria-label={`${action === 'gut' ? 'Gut' : 'Cure'} ${definition?.name ?? item.definitionId}: ${choice.label}`}
                >
                  <span className="camp-recipe-icon" aria-hidden="true">{getRewardIcon(item.definitionId)}</span>
                  <span className="camp-picker-copy">
                    <strong>{definition?.name ?? item.definitionId}</strong>
                    <span>
                      {rarity ? RARITY_VISUALS[rarity].label : 'Unknown'} · {formatFishSizeKg(item.metadata.sizePercentile, definition?.weightRangeKg)}
                      {enchantment ? ` · ${enchantment.name}` : ''}
                    </span>
                  </span>
                  <span className="camp-picker-send" aria-hidden="true">{choice.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <button className="camp-picker-cancel" type="button" onClick={onCancel} disabled={busy}>
        Cancel
      </button>
    </div>
  )
}

interface ArtifactPickerProps {
  artifacts: readonly InventoryItemInstance[]
  loading: boolean
  held: readonly InventoryItemInstance[]
  busy: boolean
  onPick: (artifact: InventoryItemInstance) => void
  onCancel: () => void
}

function ArtifactPicker({ artifacts, loading, held, busy, onPick, onCancel }: ArtifactPickerProps) {
  return (
    <div className="camp-picker" role="group" aria-label="Choose an artifact to reforge">
      {loading ? (
        <p className="camp-picker-empty">Laying the relics out…</p>
      ) : artifacts.length === 0 ? (
        <p className="camp-picker-empty">No artifact in the bag. The rarer boxes hold them.</p>
      ) : (
        <ul className="camp-picker-list">
          {artifacts.map((item) => {
            const base = getArtifactBaseByDefinitionId(item.definitionId)
            const artifact = readArtifactMetadata(item.definitionId, item.metadata)
            const cost = artifact ? REFORGE_COSTS[artifact.rarity] : null
            const affordable = cost !== null &&
              countHeldQuantity(held, 'scrap') >= cost.scrap &&
              countHeldQuantity(held, 'rift-shard') >= cost.riftShards
            const price: Readonly<Record<string, number>> = cost ? { scrap: cost.scrap, 'rift-shard': cost.riftShards } : {}
            return (
              <li key={item.itemInstanceId}>
                <button
                  className="camp-picker-option camp-fish-option"
                  type="button"
                  onClick={() => onPick(item)}
                  disabled={busy || !artifact || !affordable}
                  aria-label={`Reforge ${base?.name ?? item.definitionId}${artifact ? `, ${RARITY_VISUALS[artifact.rarity].label}` : ''}`}
                >
                  <span className="camp-recipe-icon" aria-hidden="true">{getRewardIcon(item.definitionId)}</span>
                  <span className="camp-picker-copy">
                    <strong>{base?.name ?? item.definitionId}</strong>
                    <span>
                      {artifact
                        ? `${RARITY_VISUALS[artifact.rarity].label} · ${formatArtifactSummary(artifact)}`
                        : 'An artifact this build cannot read'}
                    </span>
                    {artifact ? <CampCost cost={price} held={held} /> : null}
                  </span>
                  <span className="camp-picker-send" aria-hidden="true">Reforge</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <button className="camp-picker-cancel" type="button" onClick={onCancel} disabled={busy}>
        Cancel
      </button>
    </div>
  )
}

export function CampPanel({
  id,
  service,
  configurationError,
  characterService,
  inventoryService,
  developmentToolsEnabled = false,
  onClose,
}: CampPanelProps) {
  const { showLootToast, showToast } = useToaster()
  const [state, setState] = useState<CampState | null>(null)
  const [champions, setChampions] = useState<ChampionSnapshot[]>([])
  const [materials, setMaterials] = useState<InventoryItemInstance[]>([])
  const [fish, setFish] = useState<InventoryItemInstance[]>([])
  const [fishLoading, setFishLoading] = useState(false)
  const [artifacts, setArtifacts] = useState<InventoryItemInstance[]>([])
  const [artifactsLoading, setArtifactsLoading] = useState(false)
  const [forgeOpen, setForgeOpen] = useState(false)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    () => service && characterService ? 'loading' : 'error',
  )
  const [error, setError] = useState<string | null>(
    () => service && characterService
      ? configurationError
      : configurationError ?? 'The Camp is unavailable.',
  )
  const [pickerJobId, setPickerJobId] = useState<CampJobId | null>(null)
  const [fishAction, setFishAction] = useState<FishAction | null>(null)
  const [busy, setBusy] = useState(false)
  const now = useNow(CAMP_TICK_MS)

  const refreshMaterials = useCallback(async (): Promise<void> => {
    if (!inventoryService) {
      return
    }
    try {
      setMaterials(await inventoryService.loadInventory('material'))
    } catch {
      // A price still shows; only the "held" mark goes stale.
    }
  }, [inventoryService])

  const refreshFish = useCallback(async (): Promise<void> => {
    if (!inventoryService) {
      return
    }
    setFishLoading(true)
    try {
      setFish(await inventoryService.loadInventory('fish'))
    } catch (loadError: unknown) {
      showToast(errorMessage(loadError, 'Unable to load the fish.'), 'error')
    } finally {
      setFishLoading(false)
    }
  }, [inventoryService, showToast])

  const refreshArtifacts = useCallback(async (): Promise<void> => {
    if (!inventoryService) {
      return
    }
    setArtifactsLoading(true)
    try {
      setArtifacts(await inventoryService.loadInventory('artifact'))
    } catch (loadError: unknown) {
      showToast(errorMessage(loadError, 'Unable to load the artifacts.'), 'error')
    } finally {
      setArtifactsLoading(false)
    }
  }, [inventoryService, showToast])

  useEffect(() => {
    if (!service || !characterService) {
      return
    }
    let cancelled = false
    void Promise.all([
      service.loadState(),
      characterService.loadCharacters(),
      inventoryService ? inventoryService.loadInventory('material') : Promise.resolve([]),
    ])
      .then(([campState, collection, held]) => {
        if (!cancelled) {
          setState(campState)
          setChampions(collection.champions.filter((champion) => !champion.archived))
          setMaterials(held)
          setLoadState('ready')
          setError(null)
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setLoadState('error')
          setError(errorMessage(loadError, 'Unable to load the Camp.'))
        }
      })
    return () => {
      cancelled = true
    }
  }, [service, characterService, inventoryService])

  const championsById = useMemo(
    () => new Map(champions.map((champion) => [champion.championId, champion])),
    [champions],
  )

  const announcePayments = useCallback((paid: readonly CampPayment[]): void => {
    const totals = new Map<string, { units: number, bonus: number }>()
    for (const payment of paid) {
      if (payment.effect === 'exhaustion-relief' || payment.definitionId === null) {
        const name = championsById.get(payment.championId)?.name ?? 'A Champion'
        showToast(`${name} rested ${payment.units + payment.bonusUnits} minutes off its exhaustion at the anchor.`)
        continue
      }
      const total = totals.get(payment.definitionId) ?? { units: 0, bonus: 0 }
      total.units += payment.units + payment.bonusUnits
      total.bonus += payment.bonusUnits
      totals.set(payment.definitionId, total)
    }
    for (const [definitionId, total] of totals) {
      showLootToast({
        title: 'Camp production claimed',
        itemName: itemName(definitionId),
        icon: getRewardIcon(definitionId),
        reward: `×${total.units}`,
        ...(total.bonus > 0 ? { details: [`${total.bonus} from a lucky haul`] } : {}),
      })
    }
  }, [championsById, showLootToast, showToast])

  /** Runs one change against the server and takes its answer as the truth. */
  const run = useCallback(async (
    action: () => Promise<CampState | null>,
    fallback: string,
  ): Promise<void> => {
    if (busy) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const next = await action()
      if (next) {
        setState(next)
      }
      await refreshMaterials()
    } catch (actionError: unknown) {
      const message = errorMessage(actionError, fallback)
      setError(message)
      showToast(message, 'error')
    } finally {
      setBusy(false)
    }
  }, [busy, refreshMaterials, showToast])

  const assign = (championId: string, jobId: CampJobId): void => {
    if (!service) {
      return
    }
    void run(async () => {
      const next = await service.assignChampion(crypto.randomUUID(), championId, jobId)
      setPickerJobId(null)
      return next
    }, 'Unable to send the Champion to work.')
  }

  /** Relief lands on the Champion's timer, which the roster has to re-read to show. */
  const reloadChampions = useCallback(async (): Promise<void> => {
    if (!characterService) {
      return
    }
    try {
      const collection = await characterService.loadCharacters()
      setChampions(collection.champions.filter((champion) => !champion.archived))
    } catch {
      // The panel keeps the roster it has; the next open reads it fresh.
    }
  }, [characterService])

  const recall = (championId: string): void => {
    if (!service) {
      return
    }
    void run(async () => {
      const result = await service.unassignChampion(crypto.randomUUID(), championId)
      if (result.wasProcessed) {
        announcePayments(result.paid)
        if (result.paid.some((payment) => payment.effect === 'exhaustion-relief')) {
          await reloadChampions()
        }
      }
      return result.state
    }, 'Unable to bring the Champion back.')
  }

  const claim = (): void => {
    if (!service) {
      return
    }
    void run(async () => {
      const result = await service.claimProduction(crypto.randomUUID())
      if (result.wasProcessed) {
        if (result.paid.length === 0) {
          showToast('Nothing to claim yet. The Camp is still working.')
        } else {
          announcePayments(result.paid)
          if (result.paid.some((payment) => payment.effect === 'exhaustion-relief')) {
            await reloadChampions()
          }
        }
      }
      return result.state
    }, 'Unable to claim Camp production.')
  }

  const upgrade = (buildingId: CampBuildingId): void => {
    if (!service) {
      return
    }
    void run(async () => {
      const result = await service.upgradeBuilding(crypto.randomUUID(), buildingId)
      if (result.wasProcessed) {
        const level = buildingLevel(result.state, buildingId)
        showToast(`${CAMP_BUILDING_DEFINITIONS[buildingId].name} ${level === 1 ? 'built' : `raised to level ${level}`}.`)
      }
      return result.state
    }, 'Unable to build that.')
  }

  const craft = (recipe: CraftingRecipe): void => {
    if (!inventoryService) {
      return
    }
    void run(async () => {
      const result = await inventoryService.craftItem(crypto.randomUUID(), recipe.id, 1)
      showLootToast({
        title: 'Crafted',
        itemName: getCraftingRecipeOutputName(recipe),
        icon: getRewardIcon(result.outputDefinitionId),
        reward: `×${result.outputQuantity}`,
      })
      return null
    }, 'Unable to craft that.')
  }

  const openFishPicker = (action: FishAction): void => {
    setFishAction(action)
    void refreshFish()
  }

  const gut = (item: InventoryItemInstance): void => {
    if (!service) {
      return
    }
    void run(async () => {
      const result = await service.gutFish(crypto.randomUUID(), item.itemInstanceId)
      if (result.wasProcessed) {
        showLootToast({
          title: 'Gutted',
          itemName: itemName('roe'),
          icon: getRewardIcon('roe'),
          reward: `×${result.roeGranted}`,
          details: [`from a ${itemName(result.definitionId)}`],
        })
      }
      setFishAction(null)
      return null
    }, 'Unable to gut that fish.')
  }

  const cure = (item: InventoryItemInstance): void => {
    if (!service) {
      return
    }
    void run(async () => {
      const result = await service.cureFish(crypto.randomUUID(), item.itemInstanceId)
      if (result.wasProcessed) {
        const enchantment = getFishingEnchantmentDefinition(result.enchantmentId)
        showLootToast({
          title: 'Cured',
          itemName: itemName(result.definitionId),
          icon: getRewardIcon(result.definitionId),
          effect: enchantment ? `${enchantment.name} · +${enchantment.effectBonusPercent}% meal effect` : result.enchantmentId,
          details: [`${result.roeSpent} roe`],
        })
      }
      setFishAction(null)
      return null
    }, 'Unable to cure that fish.')
  }

  const openForge = (): void => {
    setForgeOpen(true)
    void refreshArtifacts()
  }

  const reforge = (item: InventoryItemInstance): void => {
    if (!service) {
      return
    }
    void run(async () => {
      const result = await service.reforgeArtifact(crypto.randomUUID(), item.itemInstanceId)
      if (result.wasProcessed) {
        const artifact = readArtifactMetadata(result.definitionId, result.metadata)
        showLootToast({
          title: 'Reforged',
          itemName: getArtifactBaseByDefinitionId(result.definitionId)?.name ?? result.definitionId,
          icon: getRewardIcon(result.definitionId),
          ...(artifact ? { effect: formatArtifactSummary(artifact) } : {}),
          details: [`${result.scrapSpent} scrap · ${result.shardsSpent} rift shards`],
        })
      }
      setForgeOpen(false)
      return null
    }, 'Unable to reforge that artifact.')
  }

  const skipAhead = (hours: number): void => {
    if (!service) {
      return
    }
    void run(() => service.advanceClock(hours), 'Unable to advance the Camp clock.')
  }

  const storehouseLevel = state ? buildingLevel(state, 'storehouse') : 1
  const benchLevel = state ? buildingLevel(state, 'tackle-bench') : 0
  const smokehouseLevel = state ? buildingLevel(state, 'smokehouse') : 0
  const forgeLevel = state ? buildingLevel(state, 'forge') : 0
  const benchRecipes = getCraftingRecipesForBuilding('tackle-bench')
  const roeHeld = countHeldQuantity(materials, 'roe')
  const totalPending = state
    ? state.assignments
      .filter((assignment) => getCampJobDefinition(assignment.jobId)?.effect !== 'exhaustion-relief')
      .reduce((total, assignment) => total + pendingFor(assignment, state, now), 0)
    : 0

  return (
    <section id={id} className="hub-camp-panel" aria-labelledby="camp-panel-title">
      <header className="camp-panel-heading">
        <div>
          <p className="screen-kicker">The Camp</p>
          <h3 id="camp-panel-title">Send Champions to work</h3>
        </div>
        <button className="camp-panel-close" type="button" onClick={onClose} aria-label="Close the Camp">
          <span aria-hidden="true">×</span>
        </button>
      </header>
      {error ? <p className="persistence-error" role="alert">{error}</p> : null}
      {loadState === 'loading' ? (
        <p className="camp-panel-status" role="status">Walking out to the Camp…</p>
      ) : state ? (
        <>
          <div className="camp-panel-summary">
            <span>
              <strong>{CAMP_BUILDING_DEFINITIONS.storehouse.name} {storehouseLevel}</strong>
              <small>Holds {formatHours(state.storehouseCapHours)} of work while you are away</small>
            </span>
            <button
              className="camp-claim-action"
              type="button"
              onClick={claim}
              disabled={busy || state.assignments.length === 0}
            >
              Claim{totalPending > 0 ? ` ${totalPending}` : ''}
            </button>
          </div>
          <CampUpgradeRow
            buildingId="storehouse"
            level={storehouseLevel}
            held={materials}
            busy={busy}
            onUpgrade={() => upgrade('storehouse')}
          />
          {developmentToolsEnabled ? (
            <div className="camp-dev-row" role="group" aria-label="Development tools">
              <span>Dev · skip ahead</span>
              {DEVELOPMENT_SKIPS.map((hours) => (
                <button
                  key={hours}
                  type="button"
                  onClick={() => skipAhead(hours)}
                  disabled={busy || state.assignments.length === 0}
                >
                  +{hours}h
                </button>
              ))}
            </div>
          ) : null}
          <ul className="camp-jobs">
            {ALL_CAMP_JOB_DEFINITIONS.map((job) => {
              const building = CAMP_BUILDING_DEFINITIONS[job.buildingId]
              const level = buildingLevel(state, job.buildingId)
              const slots = getCampBuildingLevel(job.buildingId, level)?.jobSlots ?? 0
              const workers = state.assignments.filter((assignment) => assignment.jobId === job.id)
              const relief = job.effect === 'exhaustion-relief'
              const pickerOpen = pickerJobId === job.id
              const unbuilt = level === 0
              return (
                <li className="camp-job" key={job.id}>
                  <header className="camp-job-heading">
                    <span className="camp-job-icon" aria-hidden="true">
                      {getRewardIcon(job.outputDefinitionId ?? 'rift-shard')}
                    </span>
                    <span className="camp-job-copy">
                      <strong>{job.name}</strong>
                      <small>
                        {unbuilt
                          ? building.description
                          : relief
                            ? `${building.name} ${level} · ${job.baseRatePerHour} min of rest an hour a Champion · ${workers.length}/${slots} resting`
                            : `${building.name} ${level} · ${job.baseRatePerHour} ${itemName(job.outputDefinitionId ?? '').toLowerCase()} an hour a Champion · ${workers.length}/${slots} working`}
                      </small>
                    </span>
                  </header>
                  {workers.length > 0 ? (
                    <ul className="camp-workers">
                      {workers.map((assignment) => (
                        <CampWorker
                          key={assignment.championId}
                          job={job}
                          assignment={assignment}
                          champion={championsById.get(assignment.championId)}
                          pending={pendingFor(assignment, state, now)}
                          busy={busy}
                          onRecall={() => recall(assignment.championId)}
                        />
                      ))}
                    </ul>
                  ) : null}
                  {pickerOpen ? (
                    <CampPicker
                      job={job}
                      champions={champions}
                      state={state}
                      now={now}
                      busy={busy}
                      onPick={(championId) => assign(championId, job.id)}
                      onCancel={() => setPickerJobId(null)}
                    />
                  ) : workers.length < slots ? (
                    <button
                      className="camp-send-action"
                      type="button"
                      onClick={() => setPickerJobId(job.id)}
                      disabled={busy || champions.length === 0}
                    >
                      {champions.length === 0 ? 'No Champions to send yet' : 'Send a Champion'}
                    </button>
                  ) : null}
                  <CampUpgradeRow
                    buildingId={job.buildingId}
                    level={level}
                    held={materials}
                    busy={busy}
                    onUpgrade={() => upgrade(job.buildingId)}
                  />
                </li>
              )
            })}
            <li className="camp-job" key="tackle-bench">
              <header className="camp-job-heading">
                <span className="camp-job-icon" aria-hidden="true">{getRewardIcon('river-worm')}</span>
                <span className="camp-job-copy">
                  <strong>{CAMP_BUILDING_DEFINITIONS['tackle-bench'].name}</strong>
                  <small>
                    {benchLevel === 0
                      ? CAMP_BUILDING_DEFINITIONS['tackle-bench'].description
                      : 'Bait from the Camp’s timber and the dungeon’s scrap, cheaper in scrap than digging.'}
                  </small>
                </span>
              </header>
              {benchLevel > 0 ? (
                <ul className="camp-recipes">
                  {benchRecipes.map((recipe) => (
                    <CampRecipe
                      key={recipe.id}
                      recipe={recipe}
                      held={materials}
                      busy={busy || !inventoryService}
                      onCraft={() => craft(recipe)}
                    />
                  ))}
                </ul>
              ) : null}
              <CampUpgradeRow
                buildingId="tackle-bench"
                level={benchLevel}
                held={materials}
                busy={busy}
                onUpgrade={() => upgrade('tackle-bench')}
              />
            </li>
            <li className="camp-job" key="smokehouse">
              <header className="camp-job-heading">
                <span className="camp-job-icon" aria-hidden="true">{getRewardIcon('roe')}</span>
                <span className="camp-job-copy">
                  <strong>{CAMP_BUILDING_DEFINITIONS.smokehouse.name}</strong>
                  <small>
                    {smokehouseLevel === 0
                      ? CAMP_BUILDING_DEFINITIONS.smokehouse.description
                      : `Gut a fish for roe, or spend roe to cure a meal fish a tier. ${roeHeld} roe held.`}
                  </small>
                </span>
              </header>
              {smokehouseLevel > 0 ? (
                fishAction ? (
                  <FishPicker
                    action={fishAction}
                    fish={fish}
                    loading={fishLoading}
                    roeHeld={roeHeld}
                    busy={busy}
                    onPick={(item) => (fishAction === 'gut' ? gut(item) : cure(item))}
                    onCancel={() => setFishAction(null)}
                  />
                ) : (
                  <div className="camp-fish-actions">
                    <button
                      className="camp-send-action"
                      type="button"
                      onClick={() => openFishPicker('gut')}
                      disabled={busy || !inventoryService}
                    >
                      Gut a fish
                    </button>
                    <button
                      className="camp-send-action"
                      type="button"
                      onClick={() => openFishPicker('cure')}
                      disabled={busy || !inventoryService}
                    >
                      Cure a fish
                    </button>
                  </div>
                )
              ) : null}
              <CampUpgradeRow
                buildingId="smokehouse"
                level={smokehouseLevel}
                held={materials}
                busy={busy}
                onUpgrade={() => upgrade('smokehouse')}
              />
            </li>
            <li className="camp-job" key="forge">
              <header className="camp-job-heading">
                <span className="camp-job-icon" aria-hidden="true">{getRewardIcon('scrap')}</span>
                <span className="camp-job-copy">
                  <strong>{CAMP_BUILDING_DEFINITIONS.forge.name}{forgeLevel > 0 ? ` ${forgeLevel}` : ''}</strong>
                  <small>
                    {forgeLevel === 0
                      ? CAMP_BUILDING_DEFINITIONS.forge.description
                      : `Reroll an artifact for scrap and rift shards.${forgeLevel > 1 ? ` Finished runs leave ${forgeLevel === 2 ? 'a quarter' : 'half'} again as much scrap.` : ''}`}
                  </small>
                </span>
              </header>
              {forgeLevel > 0 ? (
                forgeOpen ? (
                  <ArtifactPicker
                    artifacts={artifacts}
                    loading={artifactsLoading}
                    held={materials}
                    busy={busy}
                    onPick={reforge}
                    onCancel={() => setForgeOpen(false)}
                  />
                ) : (
                  <button
                    className="camp-send-action"
                    type="button"
                    onClick={openForge}
                    disabled={busy || !inventoryService}
                  >
                    Reforge an artifact
                  </button>
                )
              ) : null}
              <CampUpgradeRow
                buildingId="forge"
                level={forgeLevel}
                held={materials}
                busy={busy}
                onUpgrade={() => upgrade('forge')}
              />
            </li>
          </ul>
        </>
      ) : null}
    </section>
  )
}
