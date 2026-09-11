import { useEffect, useMemo, useState } from 'react'
import { useNow } from '../ui/useNow'
import type { ReactNode } from 'react'
import { CHARACTER_CLASS_DEFINITIONS } from '../content/classes/CharacterClasses'
import { CHAMPION_SLOT_LIMIT } from '../content/progression/ChampionSlots'
import {
  getSkillDamage,
  getSkillDefinition,
  getSkillHealing,
  getSkillShieldAmount,
  type SkillDefinition,
} from '../content/skills/Skills'
import {
  EQUIPMENT_SLOTS,
  EquipmentSlot,
  getItemDefinition,
  getItemDisplayName,
} from '../content/gear/Items'
import {
  formatGearModifier,
  sortGearModifiers,
} from '../content/gear/ModifierPools'
import { RARITY_VISUALS } from '../content/rarity/Rarity'
import { getArtifactBaseDefinition } from '../content/artifacts/Artifacts'
import { getPreparationArtifacts } from '../game/RunModes'
import { ArtifactEffectList } from '../inventory/ArtifactEffects'
import { ArtifactIcon } from '../inventory/ArtifactIcon'
import { getGearSetDefinition } from '../game-config/gear-sets'
import type { EquippedItem } from '../game/equipment/EquipmentState'
import type { InventoryItemInstance, InventoryService } from '../inventory'
import { SkillIcon } from '../rendering/SkillIcon'
import { ConfirmationDialog } from '../ui/ConfirmationDialog'
import type { CharacterService, ChampionSnapshot } from './CharacterTypes'
import { formatChampionAvailability, isChampionExhausted } from './ChampionExhaustion'
import { ChampionRevivalControl, type RevivalFishLoadState } from './ChampionRevivalControl'
import {
  formatCampWork,
  getCampAssignment,
  type CampAssignment,
  type CampService,
  type CampState,
} from '../camp/CampTypes'
import { LabourSheetLine } from '../camp/LabourSheetLine'
import { CAMP_BUILDING_DEFINITIONS } from '../content/camp/CampBuildings'
import { ALL_CAMP_JOB_DEFINITIONS } from '../content/camp/CampJobs'
import { deriveCampLabourSheet } from '../content/camp/CampLabour'

interface ChampionManagementScreenProps {
  service: CharacterService | null
  inventoryService: InventoryService | null
  inventoryError: string | null
  /** What each Champion is worth at the Camp, and which of them are working there. */
  campService: CampService | null
  configurationError: string | null
  onBack: () => void
}

const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlot, string> = {
  [EquipmentSlot.Weapon]: 'Weapon',
  [EquipmentSlot.Helmet]: 'Helmet',
  [EquipmentSlot.Armor]: 'Armor',
  [EquipmentSlot.Boots]: 'Boots',
  [EquipmentSlot.Ring]: 'Ring',
  [EquipmentSlot.Amulet]: 'Amulet',
}

function formatValue(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(1).replace(/\.0$/, '')
}

function getSkillStats(definition: SkillDefinition, level: number): readonly {
  label: string
  value: string
}[] {
  const damage = Object.entries(getSkillDamage(definition, level))
    .filter(([, value]) => value !== undefined && value !== 0)
    .map(([type, value]) => `${formatValue(value ?? 0)} ${type}`)
  return [
    { label: 'Cooldown', value: `${formatValue(definition.cooldown)}s` },
    ...(damage.length > 0 ? [{ label: 'Base damage', value: damage.join(' · ') }] : []),
    ...(definition.baseHealing !== undefined
      ? [{ label: 'Healing', value: String(getSkillHealing(definition, level)) }]
      : []),
    ...(definition.shieldBaseAmount !== undefined
      ? [{ label: 'Shield', value: String(getSkillShieldAmount(definition, level)) }]
      : []),
    ...(definition.radius !== undefined
      ? [{ label: 'Radius', value: formatValue(definition.radius) }]
      : []),
    ...(definition.maxRange !== undefined
      ? [{ label: 'Range', value: formatValue(definition.maxRange) }]
      : []),
    ...(definition.maxTargets !== undefined
      ? [{ label: 'Targets', value: String(definition.maxTargets) }]
      : []),
  ]
}

function ChampionSkillCard({
  skill,
}: {
  skill: ChampionSnapshot['build']['skills'][number]
}) {
  const definition = getSkillDefinition(skill.skillId)
  const tooltipId = `champion-skill-tooltip-${skill.skillId}`
  return (
    <li className="champion-skill-card">
      <div
        className="champion-inspectable"
        tabIndex={0}
        aria-label={`${definition.name}, level ${skill.level}. Inspect skill details.`}
        aria-describedby={tooltipId}
      >
        <span className="champion-skill-icon" aria-hidden="true">
          <SkillIcon skillId={skill.skillId} size={25} />
        </span>
        <span className="champion-skill-copy">
          <strong>{definition.name}</strong>
          <span>{definition.kind}</span>
        </span>
        <span className="champion-skill-level">Lv. {skill.level}</span>
        <span className="champion-inspect-hint" aria-hidden="true">Inspect</span>
        <div
          className="app-tooltip champion-inspect-tooltip champion-skill-tooltip"
          id={tooltipId}
          role="tooltip"
        >
          <header>
            <span className="champion-tooltip-kicker">Skill details</span>
            <strong>{definition.name}</strong>
            <span>Level {skill.level} · {definition.kind}</span>
          </header>
          <p>{definition.description}</p>
          <dl className="champion-tooltip-stats">
            {getSkillStats(definition, skill.level).map((stat) => (
              <div key={stat.label}>
                <dt>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
          <ul className="champion-skill-tags" aria-label={`${definition.name} tags`}>
            {definition.tags.map((tag) => <li key={tag}>{tag}</li>)}
          </ul>
        </div>
      </div>
    </li>
  )
}

function ChampionGearCard({
  slot,
  item,
}: {
  slot: EquipmentSlot
  item: EquippedItem | undefined
}) {
  const definition = item ? getItemDefinition(item.itemId) : null
  const rarity = definition ? item?.rarity ?? definition.rarity : null
  const modifiers = definition
    ? sortGearModifiers(item?.modifiers ?? definition.modifiers)
    : []
  const setId = item?.setId ?? definition?.setId
  const tooltipId = `champion-gear-tooltip-${slot}`
  const itemName = definition ? getItemDisplayName(definition, setId) : 'Empty slot'
  return (
    <li className={`champion-gear-card${rarity ? ` rarity-${rarity}` : ''}`}>
      <div
        className="champion-inspectable"
        tabIndex={0}
        aria-label={
          definition
            ? `${EQUIPMENT_SLOT_LABELS[slot]}: ${itemName}. Inspect item details.`
            : `${EQUIPMENT_SLOT_LABELS[slot]} slot empty.`
        }
        aria-describedby={definition ? tooltipId : undefined}
      >
        <span className="champion-gear-copy">
          <span>{EQUIPMENT_SLOT_LABELS[slot]}</span>
          <strong>{itemName}</strong>
        </span>
        {rarity ? (
          <span className="champion-gear-rarity" data-rarity={rarity}>
            {RARITY_VISUALS[rarity].label}
          </span>
        ) : (
          <span className="champion-gear-empty">Empty</span>
        )}
        {definition ? <span className="champion-inspect-hint" aria-hidden="true">Inspect</span> : null}
        {definition && rarity ? (
          <div
            className="app-tooltip champion-inspect-tooltip champion-gear-tooltip"
            id={tooltipId}
            role="tooltip"
          >
            <header>
              <span className="champion-tooltip-kicker">{EQUIPMENT_SLOT_LABELS[slot]}</span>
              <strong>{itemName}</strong>
              <span className="champion-tooltip-rarity" data-rarity={rarity}>
                {RARITY_VISUALS[rarity].icon} {RARITY_VISUALS[rarity].label}
              </span>
            </header>
            {definition.flavorText ? <p>{definition.flavorText}</p> : null}
            {setId ? (
              <p className="champion-tooltip-set">{getGearSetDefinition(setId).name} set piece</p>
            ) : null}
            {definition.implicitModifiers?.length ? (
              <section className="champion-tooltip-modifier-group">
                <h5>Implicit</h5>
                <ul>
                  {definition.implicitModifiers.map((modifier) => (
                    <li key={modifier.id}>
                      <strong>{modifier.label}</strong>
                      <span>{modifier.description}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <section className="champion-tooltip-modifier-group">
              <h5>Saved modifiers</h5>
              {modifiers.length > 0 ? (
                <ul>
                  {modifiers.map((modifier) => (
                    <li key={`${modifier.sourceId}-${modifier.id}`}>
                      {formatGearModifier(modifier)}
                    </li>
                  ))}
                </ul>
              ) : <p>No modifiers recorded.</p>}
            </section>
          </div>
        ) : null}
      </div>
    </li>
  )
}

/**
 * The labour sheet the Champion would work each job with.
 *
 * Gear matters twice: once in the run that won the Champion, and again every
 * time the player chooses who works. The fit differs per job, so each job
 * gets its line; the floor comes from the Camp so the preview is the sheet
 * the server would store.
 */
function ChampionLabourSheets({
  champion,
  sourceFloor,
}: {
  champion: ChampionSnapshot
  sourceFloor: number | null
}) {
  return (
    <section className="champion-build-section" aria-labelledby="champion-labour-title">
      <header className="champion-build-section-heading">
        <div>
          <span>What the Camp gets out of this build</span>
          <h4 id="champion-labour-title">Camp labour</h4>
        </div>
      </header>
      <dl className="champion-labour-sheets">
        {ALL_CAMP_JOB_DEFINITIONS.map((job) => (
          <div key={job.id}>
            <dt>{CAMP_BUILDING_DEFINITIONS[job.buildingId].name}</dt>
            <dd>
              <LabourSheetLine sheet={deriveCampLabourSheet({ build: champion.build, sourceFloor }, job)} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function ChampionDetails({
  champion,
  headerAction,
  camp,
}: {
  champion: ChampionSnapshot
  headerAction?: ReactNode
  /** Absent when the screen has no Camp to ask; the sheet is then left out rather than guessed. */
  camp?: { assignment: CampAssignment | undefined, sourceFloor: number | null }
}) {
  const classDefinition = CHARACTER_CLASS_DEFINITIONS[champion.build.classId]
  const now = useNow()
  const work = formatCampWork(camp?.assignment)
  return (
    <section className="champion-details" aria-labelledby="champion-details-title">
      <header className="champion-details-heading">
        <span className="champion-class-emblem" aria-hidden="true">
          {classDefinition.name.slice(0, 2)}
        </span>
        <div>
          <p className="screen-kicker">Immutable build snapshot</p>
          <h3 id="champion-details-title">{champion.name}</h3>
          <span>{classDefinition.name}</span>
        </div>
        <span className="champion-details-status">
          <span className={`champion-availability${isChampionExhausted(champion, now) ? ' exhausted' : ''}`}>
            {formatChampionAvailability(champion, now)}
          </span>
          {work ? <span className="champion-availability working">{work}</span> : null}
          {headerAction}
        </span>
      </header>
      <dl className="champion-overview-stats">
        <div>
          <dt>Level</dt>
          <dd>{champion.build.level ?? '—'}</dd>
        </div>
        <div>
          <dt>Build upgrades</dt>
          <dd>{champion.build.selectedUpgradeIds.length}</dd>
        </div>
      </dl>
      <section className="champion-build-section" aria-labelledby="champion-skills-title">
        <header className="champion-build-section-heading">
          <div>
            <span>Selected abilities</span>
            <h4 id="champion-skills-title">Skills</h4>
          </div>
          <small>Hover or focus to inspect</small>
        </header>
        <ul className="champion-skill-grid">
          {champion.build.skills.map((skill) => (
            <ChampionSkillCard key={skill.skillId} skill={skill} />
          ))}
        </ul>
      </section>
      {camp ? <ChampionLabourSheets champion={champion} sourceFloor={camp.sourceFloor} /> : null}
      <section className="champion-build-section" aria-labelledby="champion-gear-title">
        <header className="champion-build-section-heading">
          <div>
            <span>Preserved equipment</span>
            <h4 id="champion-gear-title">Loadout</h4>
          </div>
          <small>Hover or focus to inspect</small>
        </header>
        <ul className="champion-gear-grid">
          {EQUIPMENT_SLOTS.map((slot) => (
            <ChampionGearCard
              key={slot}
              slot={slot}
              item={champion.build.equipment[slot]}
            />
          ))}
        </ul>
      </section>
      {(() => {
        const artifacts = getPreparationArtifacts(champion.build.artifacts
          ? { version: 1, items: [], artifacts: champion.build.artifacts }
          : undefined)
        return artifacts.length === 0 ? null : (
          <section className="champion-build-section" aria-labelledby="champion-artifacts-title">
            <header className="champion-build-section-heading">
              <div>
                <span>Held artifacts</span>
                <h4 id="champion-artifacts-title">Artifacts</h4>
              </div>
              <small>Return to the bag when the Champion is archived</small>
            </header>
            <ul className="champion-artifact-list">
              {artifacts.map((artifact, index) => {
                const base = getArtifactBaseDefinition(artifact.baseId)
                return (
                  <li className="champion-artifact-card" key={`${artifact.baseId}-${index}`} data-rarity={artifact.rarity}>
                    <header className="champion-artifact-heading">
                      <span className="champion-artifact-icon" aria-hidden="true">
                        {base ? <ArtifactIcon icon={base.id} color={base.accent} /> : '◇'}
                      </span>
                      <strong>{base?.name ?? artifact.baseId}</strong>
                      <span className="champion-gear-rarity" data-rarity={artifact.rarity}>
                        {RARITY_VISUALS[artifact.rarity].label}
                      </span>
                    </header>
                    <ArtifactEffectList metadata={artifact} />
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })()}
      <footer className="champion-build-meta">
        <span><strong>Source run</strong>{champion.sourceRunId}</span>
        <span><strong>Content version</strong>{champion.contentVersion}</span>
      </footer>
    </section>
  )
}

export function ChampionManagementScreen({
  service,
  inventoryService,
  inventoryError,
  campService,
  configurationError,
  onBack,
}: ChampionManagementScreenProps) {
  const [champions, setChampions] = useState<ChampionSnapshot[]>([])
  const [selectedChampionId, setSelectedChampionId] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    () => service ? 'loading' : 'error',
  )
  const [error, setError] = useState<string | null>(
    () => service && inventoryService
      ? configurationError
      : configurationError ?? inventoryError ?? 'Champion storage is unavailable.',
  )
  const [renameValue, setRenameValue] = useState<string | null>(null)
  const [actionState, setActionState] = useState<'idle' | 'saving' | 'deleting'>('idle')
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null)
  const [fishItems, setFishItems] = useState<InventoryItemInstance[]>([])
  const [fishLoadState, setFishLoadState] = useState<RevivalFishLoadState>(
    () => inventoryService ? 'loading' : 'error',
  )
  const [fishLoadError, setFishLoadError] = useState<string | null>(inventoryError)
  const [revivalError, setRevivalError] = useState<string | null>(null)
  const [recovering, setRecovering] = useState(false)
  const [campState, setCampState] = useState<CampState | null>(null)
  const now = useNow(30_000)

  useEffect(() => {
    if (!service) {
      return
    }
    let cancelled = false
    void service.loadCharacters()
      .then((collection) => {
        if (!cancelled) {
          setChampions(collection.champions)
          setSelectedChampionId((current) =>
            collection.champions.some((champion) => champion.championId === current)
              ? current
              : collection.champions[0]?.championId ?? null,
          )
          setLoadState('ready')
          setError(null)
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setLoadState('error')
          setError(loadError instanceof Error ? loadError.message : 'Unable to load Champions.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [service])

  useEffect(() => {
    if (!inventoryService) {
      return
    }
    let cancelled = false
    void inventoryService.loadInventory('fish')
      .then((items) => {
        if (!cancelled) {
          setFishItems(items)
          setFishLoadState('ready')
          setFishLoadError(null)
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setFishLoadState('error')
          setFishLoadError(loadError instanceof Error ? loadError.message : 'Unable to load Revival Koi.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [inventoryService])

  useEffect(() => {
    if (!campService) {
      return
    }
    let cancelled = false
    void campService.loadState()
      .then((state) => {
        if (!cancelled) {
          setCampState(state)
        }
      })
      .catch(() => {
        // The page reads fine without the Camp; it only loses the labour lines.
      })
    return () => {
      cancelled = true
    }
  }, [campService])

  const selectedChampion = useMemo(
    () => champions.find((champion) => champion.championId === selectedChampionId) ?? null,
    [champions, selectedChampionId],
  )
  const currentRenameValue = selectedChampion
    ? renameValue ?? selectedChampion.name
    : ''

  const renameChampion = async (): Promise<void> => {
    if (!service || !selectedChampion) {
      return
    }
    setActionState('saving')
    setError(null)
    try {
      const renamed = await service.renameChampion(selectedChampion.championId, renameValue ?? selectedChampion.name)
      setChampions((current) => current.map((champion) =>
        champion.championId === renamed.championId ? renamed : champion,
      ))
      setActionState('idle')
    } catch (renameError: unknown) {
      setActionState('idle')
      setError(renameError instanceof Error ? renameError.message : 'Unable to rename Champion.')
    }
  }

  const deleteChampion = async (): Promise<void> => {
    if (!service || !deleteConfirmationId) {
      return
    }
    setActionState('deleting')
    setError(null)
    try {
      await service.archiveChampion(deleteConfirmationId)
      const remaining = champions.filter((champion) => champion.championId !== deleteConfirmationId)
      setChampions(remaining)
      setSelectedChampionId(remaining[0]?.championId ?? null)
      setRenameValue(null)
      setDeleteConfirmationId(null)
      setActionState('idle')
    } catch (deleteError: unknown) {
      setActionState('idle')
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete Champion.')
    }
  }

  const reviveChampion = async (fish: InventoryItemInstance): Promise<void> => {
    if (!service || !selectedChampion || recovering) {
      return
    }
    setRecovering(true)
    setRevivalError(null)
    try {
      const result = await service.reviveChampion(
        crypto.randomUUID(),
        selectedChampion.championId,
        fish.itemInstanceId,
      )
      setChampions((current) => current.map((champion) =>
        champion.championId === result.championId ? result : champion,
      ))
      setFishItems((current) => current.flatMap((item) => {
        if (item.itemInstanceId !== result.fishInstanceId) {
          return [item]
        }
        return item.quantity > 1 ? [{ ...item, quantity: item.quantity - 1 }] : []
      }))
    } catch (recoveryError: unknown) {
      setRevivalError(recoveryError instanceof Error ? recoveryError.message : 'Unable to use Revival Koi.')
    } finally {
      setRecovering(false)
    }
  }

  return (
    <section className="app-screen champion-management-screen" aria-labelledby="champion-management-title">
      <div className="app-screen-frame champion-management-panel">
        <div className="app-screen-topbar">
          <button className="app-screen-back" type="button" onClick={onBack}>
            <span aria-hidden="true">←</span> Back to the refuge
          </button>
          {champions.length > 0 ? (
            <dl className="app-screen-stats">
              <div>
                <dt>Saved</dt>
                <dd>{champions.length} / {CHAMPION_SLOT_LIMIT}</dd>
              </div>
              <div>
                <dt>Ready</dt>
                <dd>{champions.filter((champion) => !isChampionExhausted(champion, now)).length}</dd>
              </div>
            </dl>
          ) : null}
        </div>
        <header className="app-screen-title">
          <p className="screen-kicker">Future Abyss roster</p>
          <h2 id="champion-management-title">Champions</h2>
          <p className="app-screen-lede">
            View completed-run builds and preserve them for future Infinite Abyss attempts.
            You may keep {CHAMPION_SLOT_LIMIT}; a Champion resting off an Abyss attempt still
            holds its place. Winning a dungeon with the roster full asks you which build to
            let go.
          </p>
        </header>
        {error && !deleteConfirmationId ? <p className="persistence-error" role="alert">{error}</p> : null}
        {loadState === 'loading' ? (
          <p role="status">Loading Champions…</p>
        ) : champions.length === 0 ? (
          <section className="app-empty-state champion-empty-state">
            <span className="app-empty-state-emblem" aria-hidden="true">◆</span>
            <h3>No Champions yet</h3>
            <p>Complete a dungeon victory to create your first Champion.</p>
          </section>
        ) : (
          <div className="champion-management-layout">
            <div className="champion-list" aria-label="Saved Champions">
              {champions.map((champion) => (
                <button
                  className={`champion-list-item${champion.championId === selectedChampionId ? ' selected' : ''}`}
                  type="button"
                  aria-pressed={champion.championId === selectedChampionId}
                  key={champion.championId}
                  onClick={() => {
                    setSelectedChampionId(champion.championId)
                    setRenameValue(champion.name)
                  }}
                >
                  <strong>{champion.name}</strong>
                  <span>{CHARACTER_CLASS_DEFINITIONS[champion.build.classId].name}</span>
                  <small>{formatCampWork(getCampAssignment(campState, champion.championId)) ?? formatChampionAvailability(champion, now)}</small>
                </button>
              ))}
            </div>
            {selectedChampion ? (
              <div>
                <ChampionDetails
                  champion={selectedChampion}
                  camp={campState ? {
                    assignment: getCampAssignment(campState, selectedChampion.championId),
                    sourceFloor: campState.championFloors[selectedChampion.championId] ?? null,
                  } : undefined}
                  headerAction={isChampionExhausted(selectedChampion, now) ? (
                    <ChampionRevivalControl
                      key={selectedChampion.championId}
                      championId={selectedChampion.championId}
                      fish={fishItems}
                      fishLoadState={fishLoadState}
                      fishLoadError={fishLoadError}
                      saving={recovering}
                      error={revivalError}
                      onRevive={(fish) => { void reviveChampion(fish) }}
                    />
                  ) : undefined}
                />
                <section className="champion-management-actions" aria-label="Champion actions">
                  <label htmlFor="champion-management-name">Champion name</label>
                  <input
                    id="champion-management-name"
                    value={currentRenameValue}
                    maxLength={32}
                    onChange={(event) => setRenameValue(event.target.value)}
                    disabled={actionState !== 'idle'}
                  />
                  <button
                    className="primary-action"
                    type="button"
                    onClick={() => { void renameChampion() }}
                    disabled={actionState !== 'idle' || currentRenameValue.trim() === selectedChampion.name}
                  >
                    {actionState === 'saving' ? 'Renaming…' : 'Rename Champion'}
                  </button>
                  <button
                    className="champion-delete-action"
                    type="button"
                    onClick={() => setDeleteConfirmationId(selectedChampion.championId)}
                    disabled={actionState !== 'idle'}
                  >
                    Delete Champion
                  </button>
                </section>
              </div>
            ) : null}
          </div>
        )}
        {deleteConfirmationId ? (
          <ConfirmationDialog
            title="Delete this Champion?"
            message="The preserved build cannot be restored after deletion."
            confirmLabel={actionState === 'deleting' ? 'Deleting…' : 'Confirm delete'}
            confirmDisabled={actionState === 'deleting'}
            cancelDisabled={actionState === 'deleting'}
            errorMessage={error}
            onConfirm={() => { void deleteChampion() }}
            onCancel={() => setDeleteConfirmationId(null)}
          />
        ) : null}
      </div>
    </section>
  )
}
