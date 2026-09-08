import {
  type RunWriteState,
  type StartRunOptions,
} from '../appState'
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  DEFAULT_DUNGEON_CONFIG,
  type RunModeId,
} from '../../game'
import {
  type SettingsDto,
} from '../../persistence'
import { KeywordText } from '../../rendering/KeywordTooltip'
import { SkillIcon } from '../../rendering/SkillIcon'
import { tooltipClassName } from '../../rendering/TooltipShell'
import {
  getWorldModifierDefinitions,
  normalizeWorldModifierIds,
  resolveWorldModifierEffects,
  WORLD_MODIFIER_DEFINITIONS,
  type WorldModifierId,
} from '../../content/modifiers/WorldModifiers'
import { SPAWN_BALANCE } from '../../content/spawning/SpawnBalance'
import {
  errorMessage,
  formatChampionExhaustion,
  formatRevivalReduction,
  isChampionExhausted,
} from '../runFormatting'
import type { CharacterService } from '../../characters'
import type { InventoryService } from '../../inventory'
import {
  formatFishSizeKg,
  getChampionRevivalReductionSeconds,
  getFishMealEffectSummary,
  resolveFishMeal,
  FishIcon,
} from '../../fishing'
import { getFishDefinition } from '../../fishing/FishingContent'
import type { ChampionSnapshot } from '../../characters'
// Imported from the owning module, not the barrel: the barrel no longer
// re-exports screens so route chunks stay split.
import { ChampionDetails } from '../../characters/ChampionManagementScreen'
import {
  getInventoryItemDefinition,
  type InventoryItemInstance,
} from '../../inventory'
import {
  ATTUNEMENT_DESCRIPTION,
  RESONANCE_DESCRIPTION,
} from '../../content/stats/Stats'
import {
  BASIC_ATTACK_SKILL_ID,
  getSkillDefinition,
} from '../../content/skills/Skills'
import {
  CHARACTER_CLASS_DEFINITIONS,
  type CharacterClassId,
} from '../../content/classes/CharacterClasses'

export interface RunSetupScreenProps {
  settings: SettingsDto
  writeError: string | null
  startState: RunWriteState
  inventoryService: InventoryService | null
  inventoryError: string | null
  characterService: CharacterService | null
  characterError: string | null
  maximumDungeonFloor: number
  initialMode: RunModeId
  onStart: (options: StartRunOptions) => Promise<void>
  onSelectCharacterClass: (characterClassId: CharacterClassId) => void
  onToggleWorldModifier: (modifierId: WorldModifierId) => void
  onBack: () => void
}

export function RunSetupScreen({
  settings,
  writeError,
  startState,
  inventoryService,
  inventoryError,
  characterService,
  characterError,
  maximumDungeonFloor,
  initialMode,
  onStart,
  onSelectCharacterClass,
  onToggleWorldModifier,
  onBack,
}: RunSetupScreenProps) {
  const [fishItems, setFishItems] = useState<InventoryItemInstance[]>([])
  const [fishLoadState, setFishLoadState] = useState<'loading' | 'ready' | 'error'>(
    () => inventoryService ? 'loading' : 'error',
  )
  const [fishLoadError, setFishLoadError] = useState<string | null>(
    () => inventoryService ? inventoryError : inventoryError ?? 'Inventory is unavailable.',
  )
  const [selectedFishIds, setSelectedFishIds] = useState<(string | null)[]>([])
  const [activeMealSlotIndex, setActiveMealSlotIndex] = useState<number | null>(null)
  const [selectedMode] = useState<RunModeId>(initialMode)
  const [selectedDungeonMaxFloor, setSelectedDungeonMaxFloor] = useState(maximumDungeonFloor)
  const [champions, setChampions] = useState<ChampionSnapshot[]>([])
  const [selectedChampionId, setSelectedChampionId] = useState<string | null>(null)
  const [championLoadState, setChampionLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    () => characterService ? 'idle' : 'error',
  )
  const [championLoadError, setChampionLoadError] = useState<string | null>(
    () => characterService ? characterError : characterError ?? 'Champion storage is unavailable.',
  )
  const [revivalState, setRevivalState] = useState<'idle' | 'saving'>('idle')
  const [revivalError, setRevivalError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(() => Date.now())
  useEffect(() => {
    if (!inventoryService) {
      return
    }
    let cancelled = false
    void inventoryService.loadInventory('fish')
      .then((loadedItems) => {
        if (!cancelled) {
          setFishItems(loadedItems)
          setFishLoadState('ready')
          setFishLoadError(null)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setFishLoadState('error')
          setFishLoadError(errorMessage(error))
        }
      })
    return () => {
      cancelled = true
    }
  }, [inventoryService])
  useEffect(() => {
    if (selectedMode !== 'infinite-abyss') {
      return
    }
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [selectedMode])
  useEffect(() => {
    if (selectedMode !== 'infinite-abyss' || !characterService) {
      return
    }
    let cancelled = false
    // Establishes the loading state for the champion fetch started below.
    // oxlint-disable-next-line react/set-state-in-effect
    setChampionLoadState('loading')
    void characterService.loadCharacters()
      .then((collection) => {
        if (!cancelled) {
          setChampions(collection.champions)
          setSelectedChampionId((current) =>
            collection.champions.some((champion) => champion.championId === current)
              ? current
              : collection.champions.find((champion) => !isChampionExhausted(champion))?.championId ??
                collection.champions[0]?.championId ?? null,
          )
          setChampionLoadState('ready')
          setChampionLoadError(null)
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setChampionLoadState('error')
          setChampionLoadError(errorMessage(loadError))
        }
      })
    return () => {
      cancelled = true
    }
  }, [characterService, selectedMode])
  const selectedFishSlots = useMemo(
    () => selectedFishIds
      .map((id) => fishItems.find((item) => item.itemInstanceId === id))
      .map((item) => item ?? null),
    [fishItems, selectedFishIds],
  )
  const selectedFish = useMemo(
    () => selectedFishSlots.filter((item): item is InventoryItemInstance => item !== null),
    [selectedFishSlots],
  )
  const eligibleFishItems = useMemo(
    () => fishItems.filter((fish) => getFishDefinition(fish.definitionId)?.effect.runMealEligible),
    [fishItems],
  )
  const revivalFishItems = useMemo(
    () => fishItems.filter((fish) => fish.definitionId === 'revival-koi' && fish.quantity > 0),
    [fishItems],
  )
  const sortedRevivalFishItems = useMemo(
    () => [...revivalFishItems].sort((left, right) => {
      const reductionDifference =
        getChampionRevivalReductionSeconds(right.metadata) -
        getChampionRevivalReductionSeconds(left.metadata)
      return reductionDifference || left.itemInstanceId.localeCompare(right.itemInstanceId)
    }),
    [revivalFishItems],
  )
  const [revivalPickerOpen, setRevivalPickerOpen] = useState(false)
  const fishMeal = useMemo(() => resolveFishMeal(selectedFish), [selectedFish])
  const selectedChampion = champions.find((champion) =>
    champion.championId === selectedChampionId,
  )
  const selectedChampionExhausted = selectedChampion
    ? isChampionExhausted(selectedChampion, currentTime)
    : false
  const reviveChampion = async (fish: InventoryItemInstance): Promise<void> => {
    if (!characterService || !selectedChampion || !selectedChampionExhausted || revivalState === 'saving') {
      return
    }
    setRevivalState('saving')
    setRevivalError(null)
    try {
      const result = await characterService.reviveChampion(
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
    } catch (error: unknown) {
      setRevivalError(errorMessage(error))
    } finally {
      setRevivalState('idle')
    }
  }
  const worldModifierEffects = resolveWorldModifierEffects(
    settings.selectedWorldModifierIds,
    SPAWN_BALANCE,
  )
  return (
    <section className="dashboard run-setup run-dashboard" aria-labelledby="dashboard-title">
      <div className="dashboard-panel run-dashboard-panel">
        <header className="run-setup-topbar">
          <button className="secondary-action run-setup-back" type="button" onClick={onBack}>
            <span aria-hidden="true">←</span>
            Back to dashboard
          </button>
        </header>
        <div className="run-dashboard-hero">
          <div>
            <h2 id="dashboard-title">{selectedMode === 'infinite-abyss' ? 'Infinite Abyss' : 'Dungeon run'}</h2>
            <p>
              Shape your fighter before entering the dungeon.
            </p>
          </div>
        </div>
        <div className="run-dashboard-command">
          <div>
            <span className="run-dashboard-command-label">Run briefing</span>
            <strong>{selectedMode === 'infinite-abyss' ? 'Infinite Abyss' : 'Dungeon run'}</strong>
            <span>{selectedMode === 'infinite-abyss'
              ? 'Push one completed Champion through endless floors.'
              : 'Configure your character and risk level.'}</span>
          </div>
          <button
            className="primary-action run-dashboard-start"
            type="button"
            onClick={() => {
              void onStart(selectedMode === 'infinite-abyss'
                ? {
                    modeId: selectedMode,
                    championId: selectedChampion?.championId,
                    champion: selectedChampion?.build,
                    preparation: fishMeal.preparation,
                  }
                : {
                    preparation: fishMeal.preparation,
                    selectedDungeonMaxFloor,
                  })
            }}
            disabled={startState === 'saving' ||
              (selectedMode === 'infinite-abyss' &&
                (selectedChampion === undefined || selectedChampionExhausted))}
          >
            <span>{startState === 'saving' ? 'Saving…' : 'Start Run'}</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
        {writeError ? <p className="persistence-error" role="alert">{writeError}</p> : null}
        {selectedMode === 'dungeon' ? (
          <div className="run-dashboard-section-heading">
            <p className="screen-kicker">Choose your fighter</p>
            <h3>Select your character</h3>
          </div>
        ) : null}
        {selectedMode === 'dungeon' ? (
        <fieldset className="dashboard-choice-group run-dashboard-choice-group">
          <legend>Character</legend>
          <div className="dashboard-choice-list">
            {Object.values(CHARACTER_CLASS_DEFINITIONS).map((characterClass) => {
              const selected = settings.selectedCharacterClassId === characterClass.id
              const startingSkillId = characterClass.startingSkillIds.find(
                (skillId) => skillId !== BASIC_ATTACK_SKILL_ID,
              ) ?? BASIC_ATTACK_SKILL_ID
              const startingSkill = getSkillDefinition(startingSkillId)
              const accentColor = `#${characterClass.visual.fillColor.toString(16).padStart(6, '0')}`
              const outlineColor = `#${characterClass.visual.outlineColor.toString(16).padStart(6, '0')}`
              return (
                <button
                  className={`dashboard-choice character-class-card${selected ? ' selected' : ''}`}
                  type="button"
                  aria-pressed={selected}
                  data-character-class={characterClass.id}
                  style={{
                    '--character-class-accent': accentColor,
                    '--character-class-outline': outlineColor,
                  } as CSSProperties}
                  key={characterClass.id}
                  onClick={() => onSelectCharacterClass(characterClass.id)}
                >
                  <span className="character-class-card-sheen" aria-hidden="true" />
                  <span className="character-class-card-header">
                    <span className="character-class-card-emblem" aria-hidden="true">
                      {characterClass.visual.icon}
                    </span>
                    <span className="character-class-card-title">
                      <small>Class</small>
                      <strong>{characterClass.name}</strong>
                    </span>
                  </span>
                  <span className="character-class-card-body">
                    <span className="character-class-card-section">
                      <small className="character-class-card-label"><KeywordText text="Affinities" /></small>
                      <span className="character-class-affinity-pills" aria-label={`${characterClass.skillAffinity.label} skill affinities`}>
                        {characterClass.skillAffinity.tags.map((tag) => (
                          <span className="character-class-affinity-pill" key={tag}>
                            {tag}
                          </span>
                        ))}
                      </span>
                    </span>
                    <span className="character-class-card-details">
                      <span
                        className="character-class-card-detail character-class-card-detail-skill"
                        tabIndex={0}
                        aria-label={`Starting skill: ${startingSkill.name}. ${startingSkill.description}`}
                        aria-describedby={`character-class-${characterClass.id}-starting-skill-tooltip`}
                      >
                        <small className="character-class-card-label">Starting skill</small>
                        <strong>
                          <SkillIcon skillId={startingSkill.id} size={18} />
                          {startingSkill.name}
                        </strong>
                        <span
                          className={tooltipClassName('character-class-card-tooltip')}
                          id={`character-class-${characterClass.id}-starting-skill-tooltip`}
                          role="tooltip"
                        >
                          <KeywordText text={startingSkill.description} />
                        </span>
                      </span>
                      <span
                        className="character-class-card-detail"
                        tabIndex={0}
                        aria-label={`Maximum health: ${characterClass.baseStats.maxHp}`}
                      >
                        <small className="character-class-card-label">Max HP</small>
                        <strong>{characterClass.baseStats.maxHp}</strong>
                      </span>
                      <span
                        className="character-class-card-detail"
                        tabIndex={0}
                        aria-label={`Base physical damage: ${characterClass.baseStats.attackDamage}`}
                      >
                        <small className="character-class-card-label">Phys. damage</small>
                        <strong>{characterClass.baseStats.attackDamage}</strong>
                      </span>
                      <span
                        className="character-class-card-detail"
                        tabIndex={0}
                        aria-label={`Movement speed: ${characterClass.baseStats.movementSpeed} units per second`}
                      >
                        <small className="character-class-card-label">Move speed</small>
                        <strong>{characterClass.baseStats.movementSpeed} units/s</strong>
                      </span>
                      <span
                        className="character-class-card-detail"
                        tabIndex={0}
                        aria-label={`Attack speed: ${characterClass.baseStats.attackSpeed} attacks per second`}
                      >
                        <small className="character-class-card-label">Atk speed</small>
                        <strong>{characterClass.baseStats.attackSpeed} atk/s</strong>
                      </span>
                      <span
                        className="character-class-card-detail"
                        tabIndex={0}
                        aria-label={`Resonance: ${RESONANCE_DESCRIPTION}`}
                      >
                        <small className="character-class-card-label character-class-card-label-keyword">
                          <KeywordText text="Resonance" />
                        </small>
                        <strong>{characterClass.baseStats.resonance} attacks</strong>
                      </span>
                      <span
                        className="character-class-card-detail"
                        tabIndex={0}
                        aria-label={`Attunement: ${ATTUNEMENT_DESCRIPTION}`}
                      >
                        <small className="character-class-card-label character-class-card-label-keyword">
                          <KeywordText text="Attunement" />
                        </small>
                        <strong>{characterClass.baseStats.attunement}%</strong>
                      </span>
                    </span>
                  </span>
                  <span className="character-class-card-flavor">{characterClass.description}</span>
                </button>
              )
            })}
          </div>
        </fieldset>
        ) : null}
        {selectedMode === 'dungeon' ? (
          <fieldset className="dashboard-choice-group run-dashboard-choice-group">
            <legend>Dungeon length</legend>
            <p>
              Choose between {DEFAULT_DUNGEON_CONFIG.defaultMaxFloor} floors and your highest
              unlocked floor in increments of 5.
            </p>
            <div className="dashboard-choice-list">
              {Array.from(
                { length: Math.floor((maximumDungeonFloor - DEFAULT_DUNGEON_CONFIG.defaultMaxFloor) / 5) + 1 },
                (_, index) => DEFAULT_DUNGEON_CONFIG.defaultMaxFloor + index * 5,
              ).map((maxFloor) => (
                <button
                  className={`dashboard-choice${selectedDungeonMaxFloor === maxFloor ? ' selected' : ''}`}
                  type="button"
                  aria-pressed={selectedDungeonMaxFloor === maxFloor}
                  key={maxFloor}
                  onClick={() => setSelectedDungeonMaxFloor(maxFloor)}
                >
                  <strong>{maxFloor} floors</strong>
                  <span>{maxFloor === maximumDungeonFloor ? 'Highest unlocked floor' : 'Set as run maximum'}</span>
                </button>
              ))}
            </div>
          </fieldset>
        ) : null}
         {selectedMode === 'infinite-abyss' ? (
           <section className="run-abyss-champion" aria-labelledby="abyss-champion-title">
             <div className="run-dashboard-section-heading">
               <p className="screen-kicker">Abyss character</p>
               <h3 id="abyss-champion-title">Choose your Champion</h3>
             </div>
             {championLoadState === 'loading' ? (
               <span>Loading available Champions…</span>
             ) : championLoadState === 'error' ? (
               <span className="persistence-error">{championLoadError}</span>
             ) : selectedChampion ? (
               <>
                 <div className="run-abyss-champion-list">
                   {champions.map((champion) => {
                     const isSelected = champion.championId === selectedChampionId
                     const isExhausted = isChampionExhausted(champion, currentTime)
                     const panelId = `abyss-champion-panel-${champion.championId}`
                     const triggerId = `abyss-champion-trigger-${champion.championId}`
                     return (
                       <article className={`run-abyss-champion-card${isSelected ? ' selected' : ''}`} key={champion.championId}>
                         <button
                           className={`game-mode-choice run-abyss-champion-trigger${isSelected ? ' selected' : ''}${isExhausted ? ' exhausted' : ''}`}
                           id={triggerId}
                           type="button"
                           aria-expanded={isSelected}
                           aria-controls={panelId}
                           aria-pressed={isSelected}
                           onClick={() => {
                             setSelectedChampionId(champion.championId)
                             setRevivalError(null)
                             setRevivalPickerOpen(false)
                           }}
                         >
                           <span className="run-abyss-champion-trigger-copy">
                             <strong>{champion.name}</strong>
                             <span>{CHARACTER_CLASS_DEFINITIONS[champion.build.classId].name}</span>
                             <small>
                               {isExhausted
                                 ? `Exhausted · ${formatChampionExhaustion(champion.exhaustionUntil, currentTime)}`
                                 : 'Available'}
                             </small>
                           </span>
                           <span className="run-abyss-champion-trigger-state" aria-hidden="true">
                             <span>{isSelected ? 'Selected for run' : 'Select Champion'}</span>
                             <span className="run-abyss-champion-chevron">{isSelected ? '▴' : '▾'}</span>
                           </span>
                         </button>
                         {isSelected ? (
                           <div
                             className="run-abyss-champion-panel"
                             id={panelId}
                             role="region"
                             aria-labelledby={triggerId}
                           >
                             <ChampionDetails
                               champion={champion}
                               headerAction={selectedChampionExhausted ? (
                                 <div className="champion-revival-control">
                                   <button
                                     className="champion-revive-trigger"
                                     type="button"
                                     aria-expanded={revivalPickerOpen}
                                     aria-controls={`run-abyss-revival-picker-${champion.championId}`}
                                     onClick={() => {
                                       setRevivalError(null)
                                       setRevivalPickerOpen((open) => !open)
                                     }}
                                     disabled={revivalState === 'saving'}
                                   >
                                     {revivalState === 'saving' ? 'Reviving…' : 'Revive'}
                                   </button>
                                   {revivalPickerOpen ? (
                                     <div
                                       className="run-abyss-revival-dropdown"
                                       id={`run-abyss-revival-picker-${champion.championId}`}
                                       role="region"
                                       aria-label="Choose a Revival Koi"
                                     >
                                       <strong>Choose a Revival Koi</strong>
                                       {revivalError ? <small role="alert">{revivalError}</small> : null}
                                       {fishLoadState === 'loading' ? (
                                         <p>Loading Revival Koi…</p>
                                       ) : fishLoadState === 'error' ? (
                                         <small role="alert">
                                           {fishLoadError ?? 'Fish inventory is unavailable.'}
                                         </small>
                                       ) : sortedRevivalFishItems.length > 0 ? (
                                         <div className="run-abyss-revival-list" aria-label="Available Revival Koi">
                                           {sortedRevivalFishItems.map((fish) => {
                                             const definition = getFishDefinition(fish.definitionId)
                                             const itemName = getInventoryItemDefinition(fish.definitionId)?.name ?? fish.definitionId
                                             const reduction = getChampionRevivalReductionSeconds(fish.metadata)
                                             return (
                                               <button
                                                 className="champion-revival-action run-abyss-revival-action"
                                                 type="button"
                                                 key={fish.itemInstanceId}
                                                 onClick={() => {
                                                   setRevivalPickerOpen(false)
                                                   void reviveChampion(fish)
                                                 }}
                                                 disabled={revivalState === 'saving'}
                                               >
                                                 <span>
                                                   {definition ? (
                                                     <FishIcon icon={definition.visual.icon} color={definition.visual.accent} />
                                                   ) : null}
                                                   {' '}{itemName}
                                                 </span>
                                                 <small>
                                                   {typeof fish.metadata.rarity === 'string' ? fish.metadata.rarity : 'unknown'} · size{' '}
                                                   {formatFishSizeKg(fish.metadata.sizePercentile, definition?.weightRangeKg)}
                                                 </small>
                                                 <small>Revives by up to {formatRevivalReduction(reduction)}</small>
                                               </button>
                                             )
                                           })}
                                         </div>
                                       ) : (
                                         <p>You are out of Revival Koi. Go fish</p>
                                       )}
                                     </div>
                                   ) : null}
                                 </div>
                               ) : undefined}
                             />
                           </div>
                         ) : null}
                       </article>
                     )
                   })}
                 </div>
               </>
             ) : (
               <span>Complete a dungeon and save a Champion before entering the Abyss.</span>
             )}
           </section>
         ) : null}
         <section className="run-dashboard-meal" aria-labelledby="fish-meal-title">
           <div className="run-dashboard-section-heading">
             <p className="screen-kicker">Pre-run meal</p>
             <h3 id="fish-meal-title">Choose up to five fish</h3>
           </div>
           <p className="fish-meal-summary">
             {getFishMealEffectSummary(fishMeal.effects)} · {selectedFish.length}/{5} selected
           </p>
           {fishLoadState === 'loading' ? (
             <p className="fish-meal-muted">Loading fish inventory…</p>
           ) : fishLoadState === 'error' ? (
             <p className="persistence-error" role="alert">
               {fishLoadError ?? 'Fish inventory is unavailable. You can still start without a meal.'}
             </p>
           ) : eligibleFishItems.length === 0 ? (
             <p className="fish-meal-muted">No fish available. Visit Fishing to catch some.</p>
           ) : (
             <>
               <div className="fish-meal-slots" aria-label="Five fish meal slots">
               {Array.from({ length: 5 }, (_, index) => {
                 const fish = selectedFishSlots[index]
                 const definition = fish ? getFishDefinition(fish.definitionId) : undefined
                 return (
                   <button
                     className={`fish-meal-slot${fish ? ' filled' : ''}${definition ? ` fish-${definition.id}` : ''}`}
                     style={definition ? {
                       borderColor: definition.visual.accent,
                       boxShadow: `0 0 18px ${definition.visual.glow}55`,
                     } : undefined}
                     type="button"
                     aria-label={fish
                       ? `Meal slot ${index + 1}: ${getInventoryItemDefinition(fish.definitionId)?.name ?? fish.definitionId}`
                       : `Meal slot ${index + 1}: empty`}
                     onClick={() => setActiveMealSlotIndex(index)}
                     key={index}
                   >
                     <span className="fish-meal-slot-number">{index + 1}</span>
                     {fish ? (
                       <>
                         <span className="fish-meal-slot-icon" aria-hidden="true">
                           {definition ? (
                             <FishIcon icon={definition.visual.icon} color={definition.visual.accent} />
                           ) : '🐟'}
                         </span>
                         <strong>{getInventoryItemDefinition(fish.definitionId)?.name ?? fish.definitionId}</strong>
                         <small>
                           {typeof fish.metadata.rarity === 'string' ? fish.metadata.rarity : 'unknown'} · size{' '}
                           {formatFishSizeKg(fish.metadata.sizePercentile, definition?.weightRangeKg)}
                         </small>
                       </>
                     ) : (
                       <span className="fish-meal-slot-empty">Click to select</span>
                     )}
                   </button>
                 )
               })}
               </div>
               {activeMealSlotIndex !== null ? (
               <div className="fish-meal-picker" aria-label="Eligible fish">
                 <strong>Select a fish for slot {activeMealSlotIndex + 1}</strong>
                 <div className="fish-meal-picker-list">
                   {eligibleFishItems
                     .filter((fish) =>
                       !selectedFishIds.filter((id): id is string => id !== null).includes(fish.itemInstanceId) ||
                       selectedFishIds[activeMealSlotIndex] === fish.itemInstanceId,
                     )
                     .map((fish) => (
                       <button
                         className={`fish-meal-picker-item${getFishDefinition(fish.definitionId) ? ` fish-${fish.definitionId}` : ''}`}
                         style={getFishDefinition(fish.definitionId) ? {
                       borderColor: getFishDefinition(fish.definitionId)?.visual.accent,
                       boxShadow: `0 0 16px ${getFishDefinition(fish.definitionId)?.visual.glow}44`,
                         } : undefined}
                         type="button"
                         key={fish.itemInstanceId}
                         onClick={() => {
                           setSelectedFishIds((current) => {
                             const next = Array.from({ length: 5 }, (_, index) => current[index] ?? null)
                             next[activeMealSlotIndex] = fish.itemInstanceId
                             return next
                           })
                           setActiveMealSlotIndex(null)
                         }}
                       >
                         <span className="fish-meal-picker-item-heading">
                           <span className="fish-meal-picker-item-icon" aria-hidden="true">
                             {getFishDefinition(fish.definitionId) ? (
                               <FishIcon
                                 icon={getFishDefinition(fish.definitionId)!.visual.icon}
                                 color={getFishDefinition(fish.definitionId)!.visual.accent}
                               />
                             ) : '🐟'}
                           </span>
                           <span>{getInventoryItemDefinition(fish.definitionId)?.name ?? fish.definitionId}</span>
                         </span>
                         <small>
                           {typeof fish.metadata.rarity === 'string' ? fish.metadata.rarity : 'unknown'} · size{' '}
                           {formatFishSizeKg(
                             fish.metadata.sizePercentile,
                             getFishDefinition(fish.definitionId)?.weightRangeKg,
                           )}
                         </small>
                         <em>{getFishDefinition(fish.definitionId)?.effect.description}</em>
                       </button>
                     ))}
                   <button
                     className="fish-meal-picker-clear"
                     type="button"
                     onClick={() => {
                       setSelectedFishIds((current) =>
                         Array.from({ length: 5 }, (_, index) =>
                           index === activeMealSlotIndex ? null : current[index] ?? null,
                         ),
                       )
                       setActiveMealSlotIndex(null)
                     }}
                   >
                     Clear this slot
                   </button>
                   <button
                     className="secondary-action"
                     type="button"
                     onClick={() => setActiveMealSlotIndex(null)}
                   >
                     Cancel
                   </button>
                 </div>
               </div>
               ) : null}
             </>
           )}
           <p className="fish-meal-footnote">
             Selected fish are consumed when the run starts. Revival Koi is reserved for Champion recovery.
           </p>
         </section>
         <div className="run-dashboard-section-heading run-dashboard-section-heading-risk">
          <p className="screen-kicker">Raise the heat</p>
          <h3>Pick your arena conditions</h3>
        </div>
        <fieldset className="dashboard-choice-group run-dashboard-choice-group">
          <legend>World modifiers</legend>
          <p className="world-modifier-summary">
            Difficulty {worldModifierEffects.difficulty} · Essence reward{' '}
            {worldModifierEffects.essenceRewardMultiplier.toFixed(2)}x
          </p>
          <div className="dashboard-choice-list">
            {getWorldModifierDefinitions(
              normalizeWorldModifierIds(Object.keys(WORLD_MODIFIER_DEFINITIONS)),
            ).map((modifier) => {
              const selected = settings.selectedWorldModifierIds.includes(modifier.id)
              return (
                <button
                  className={`dashboard-choice${selected ? ' selected' : ''}`}
                  type="button"
                  aria-pressed={selected}
                  key={modifier.id}
                  onClick={() => onToggleWorldModifier(modifier.id)}
                >
                  <strong>{modifier.name}</strong>
                  <span>Reward {modifier.essenceRewardMultiplier.toFixed(2)}x</span>
                  <span>{modifier.description}</span>
                </button>
              )
            })}
          </div>
        </fieldset>
      </div>
    </section>
  )
}
