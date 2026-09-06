import { useEffect, useMemo, useState } from 'react'
import { CHARACTER_CLASS_DEFINITIONS } from '../content/classes/CharacterClasses'
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
import { getGearSetDefinition } from '../game-config/gear-sets'
import type { EquippedItem } from '../game/equipment/EquipmentState'
import type { InventoryItemInstance, InventoryService } from '../inventory'
import { SkillIcon } from '../rendering/SkillIcon'
import type { CharacterService, ChampionSnapshot } from './CharacterTypes'

interface ChampionManagementScreenProps {
  service: CharacterService | null
  inventoryService: InventoryService | null
  inventoryError: string | null
  configurationError: string | null
  onBack: () => void
}

function formatExhaustion(exhaustionUntil: string | null): string {
  if (!exhaustionUntil) {
    return 'Available'
  }
  const remainingMilliseconds = Date.parse(exhaustionUntil) - Date.now()
  if (!Number.isFinite(remainingMilliseconds) || remainingMilliseconds <= 0) {
    return 'Available'
  }
  const remainingHours = Math.floor(remainingMilliseconds / 3_600_000)
  const remainingMinutes = Math.ceil((remainingMilliseconds % 3_600_000) / 60_000)
  return `${remainingHours}h ${remainingMinutes}m remaining`
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
        <span className="champion-gear-slot" aria-hidden="true">
          {EQUIPMENT_SLOT_LABELS[slot].slice(0, 3)}
        </span>
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

export function ChampionDetails({ champion }: { champion: ChampionSnapshot }) {
  const classDefinition = CHARACTER_CLASS_DEFINITIONS[champion.build.classId]
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
        <span className={`champion-availability${champion.exhaustionUntil ? ' exhausted' : ''}`}>
          {formatExhaustion(champion.exhaustionUntil)}
        </span>
      </header>
      <dl className="champion-overview-stats">
        <div>
          <dt>Behavior profile</dt>
          <dd>{champion.build.behaviorProfileId}</dd>
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
  const [revivalFish, setRevivalFish] = useState<InventoryItemInstance[]>([])
  const [recovering, setRecovering] = useState(false)

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
          setRevivalFish(items.filter((item) => item.definitionId === 'revival-koi'))
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load Revival Koi.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [inventoryService])

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

  const reviveChampion = async (): Promise<void> => {
    const fish = revivalFish[0]
    if (!service || !selectedChampion || !fish || recovering) {
      return
    }
    setRecovering(true)
    setError(null)
    try {
      const result = await service.reviveChampion(
        crypto.randomUUID(),
        selectedChampion.championId,
        fish.itemInstanceId,
      )
      setChampions((current) => current.map((champion) =>
        champion.championId === result.championId ? result : champion,
      ))
      setRevivalFish((current) => current.filter((item) => item.itemInstanceId !== result.fishInstanceId))
    } catch (recoveryError: unknown) {
      setError(recoveryError instanceof Error ? recoveryError.message : 'Unable to use Revival Koi.')
    } finally {
      setRecovering(false)
    }
  }

  return (
    <section className="dashboard champion-management-screen" aria-labelledby="champion-management-title">
      <div className="dashboard-panel champion-management-panel">
        <button className="secondary-action" type="button" onClick={onBack}>Back to dashboard</button>
        <p className="screen-kicker">Future Abyss roster</p>
        <h2 id="champion-management-title">Champions</h2>
        <p>View completed-run builds and preserve them for future Infinite Abyss attempts.</p>
        {error ? <p className="persistence-error" role="alert">{error}</p> : null}
        {loadState === 'loading' ? (
          <p role="status">Loading Champions…</p>
        ) : champions.length === 0 ? (
          <section className="champion-empty-state">
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
                  <small>{formatExhaustion(champion.exhaustionUntil)}</small>
                </button>
              ))}
            </div>
            {selectedChampion ? (
              <div>
                <ChampionDetails champion={selectedChampion} />
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
                  {selectedChampion.exhaustionUntil &&
                  Date.parse(selectedChampion.exhaustionUntil) > Date.now() ? (
                    <div className="champion-revival-panel">
                      <strong>Champion exhausted</strong>
                      <span>{formatExhaustion(selectedChampion.exhaustionUntil)}</span>
                      {revivalFish.length > 0 ? (
                        <>
                          <small>
                            Revival Koi available: {revivalFish.length}. The selected fish will
                            reduce the remaining timer based on its rarity and size.
                          </small>
                          <button
                            className="champion-revival-action"
                            type="button"
                            onClick={() => { void reviveChampion() }}
                            disabled={recovering || actionState !== 'idle'}
                          >
                            {recovering ? 'Using Revival Koi…' : 'Use Revival Koi'}
                          </button>
                        </>
                      ) : (
                        <small>Catch a Revival Koi to reduce this timer.</small>
                      )}
                    </div>
                  ) : null}
                </section>
              </div>
            ) : null}
          </div>
        )}
        {deleteConfirmationId ? (
          <div className="champion-delete-confirmation" role="alert">
            <strong>Delete this Champion?</strong>
            <span>The preserved build cannot be restored after deletion.</span>
            <div>
              <button
                className="champion-delete-action"
                type="button"
                onClick={() => { void deleteChampion() }}
                disabled={actionState === 'deleting'}
              >
                {actionState === 'deleting' ? 'Deleting…' : 'Confirm delete'}
              </button>
              <button
                className="secondary-action"
                type="button"
                onClick={() => setDeleteConfirmationId(null)}
                disabled={actionState === 'deleting'}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
