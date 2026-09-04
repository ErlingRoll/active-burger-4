import { useEffect, useMemo, useState } from 'react'
import { CHARACTER_CLASS_DEFINITIONS } from '../content/classes/CharacterClasses'
import { getSkillDefinition } from '../content/skills/Skills'
import { getItemDefinition } from '../content/gear/Items'
import type { InventoryItemInstance, InventoryService } from '../inventory'
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

function ChampionDetails({ champion }: { champion: ChampionSnapshot }) {
  const classDefinition = CHARACTER_CLASS_DEFINITIONS[champion.build.classId]
  const equippedItems = Object.entries(champion.build.equipment)
  return (
    <section className="champion-details" aria-labelledby="champion-details-title">
      <div className="champion-details-heading">
        <p className="screen-kicker">Immutable build snapshot</p>
        <h3 id="champion-details-title">{champion.name}</h3>
        <span>{classDefinition.name} · {formatExhaustion(champion.exhaustionUntil)}</span>
      </div>
      <dl className="champion-details-grid">
        <div>
          <dt>Class</dt>
          <dd>{classDefinition.name}</dd>
        </div>
        <div>
          <dt>Behavior</dt>
          <dd>{champion.build.behaviorProfileId}</dd>
        </div>
        <div>
          <dt>Source run</dt>
          <dd>{champion.sourceRunId}</dd>
        </div>
        <div>
          <dt>Content version</dt>
          <dd>{champion.contentVersion}</dd>
        </div>
      </dl>
      <div className="champion-detail-list">
        <h4>Skills</h4>
        <ul>
          {champion.build.skills.map((skill) => (
            <li key={skill.skillId}>
              <span>{getSkillDefinition(skill.skillId).name}</span>
              <strong>Level {skill.level}</strong>
            </li>
          ))}
        </ul>
      </div>
      <div className="champion-detail-list">
        <h4>Equipped gear</h4>
        {equippedItems.length > 0 ? (
          <ul>
            {equippedItems.map(([slot, item]) => (
              <li key={slot}>
                <span>{slot}</span>
                <strong>{getItemDefinition(item.itemId).name}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p>No additional gear recorded.</p>
        )}
      </div>
      <div className="champion-detail-list">
        <h4>Run upgrades</h4>
        <p>{champion.build.selectedUpgradeIds.length} upgrades preserved from the source run.</p>
      </div>
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
