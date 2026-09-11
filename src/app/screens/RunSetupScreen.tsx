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
/* Straight from content rather than through the game barrel: this screen is a
   lazily loaded route, and the barrel would pull the simulation into its
   chunk. */
import {
  TARGET_PRIORITY_DEFINITIONS,
  TARGET_PRIORITY_ORDER,
  type TargetPriorityId,
} from '../../content/behaviors/TargetPriorities'
import { SPAWN_BALANCE } from '../../content/spawning/SpawnBalance'
import { CHAMPION_SLOT_LIMIT } from '../../content/progression/ChampionSlots'
import {
  errorMessage,
  formatChampionExhaustion,
  isChampionExhausted,
} from '../runFormatting'
import type { CharacterService } from '../../characters'
import { getCampAssignment, type CampService, type CampState } from '../../camp/CampTypes'
import { CAMP_BUILDING_DEFINITIONS } from '../../content/camp/CampBuildings'
import { getCampJobDefinition } from '../../content/camp/CampJobs'
import type { InventoryService } from '../../inventory'
import {
  formatFishSizeKg,
  getFishMealEffectSummary,
  resolveFishMeal,
  FishIcon,
} from '../../fishing'
import { getFishDefinition } from '../../fishing/FishingContent'
import { getFishMealSlotCount, type FishMealOptions } from '../../fishing/FishMeals'
import {
  formatArtifactHeadline,
  getArtifactBaseDefinition,
  readArtifactMetadata,
  type ArtifactMetadata,
} from '../../content/artifacts/Artifacts'
import { ArtifactEffectList } from '../../inventory/ArtifactEffects'
import { ArtifactIcon } from '../../inventory/ArtifactIcon'
import { getPreparationArtifacts } from '../../game/RunModes'
import type { ChampionSnapshot } from '../../characters'
// Imported from the owning module, not the barrel: the barrel no longer
// re-exports screens so route chunks stay split.
import { ChampionDetails } from '../../characters/ChampionManagementScreen'
import { ChampionRevivalControl } from '../../characters/ChampionRevivalControl'
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
  /** Which Champions are working at the Camp; a working Champion cannot descend. */
  campService: CampService | null
  maximumDungeonFloor: number
  /** How many artifacts a dungeon run may take from the bag. */
  artifactSlotCount: number
  initialMode: RunModeId
  onStart: (options: StartRunOptions) => Promise<void>
  onSelectCharacterClass: (characterClassId: CharacterClassId) => void
  onToggleWorldModifier: (modifierId: WorldModifierId) => void
  onSelectTargetPriority: (priorityId: TargetPriorityId) => void
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
  campService,
  maximumDungeonFloor,
  artifactSlotCount,
  initialMode,
  onStart,
  onSelectCharacterClass,
  onToggleWorldModifier,
  onSelectTargetPriority,
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
  const [artifactItems, setArtifactItems] = useState<InventoryItemInstance[]>([])
  const [artifactLoadState, setArtifactLoadState] = useState<'loading' | 'ready' | 'error'>(
    () => inventoryService ? 'loading' : 'error',
  )
  const [selectedArtifactIds, setSelectedArtifactIds] = useState<(string | null)[]>([])
  const [activeArtifactSlotIndex, setActiveArtifactSlotIndex] = useState<number | null>(null)
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
  const [campState, setCampState] = useState<CampState | null>(null)
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
  /*
   * The bag's artifacts, for a dungeon run to pick from. An Abyss attempt
   * never reads them: the Champion brings its own.
   */
  useEffect(() => {
    if (!inventoryService || selectedMode === 'infinite-abyss') {
      return
    }
    let cancelled = false
    void inventoryService.loadInventory('artifact')
      .then((loadedItems) => {
        if (!cancelled) {
          setArtifactItems(loadedItems)
          setArtifactLoadState('ready')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setArtifactLoadState('error')
        }
      })
    return () => {
      cancelled = true
    }
  }, [inventoryService, selectedMode])
  useEffect(() => {
    if (selectedMode !== 'infinite-abyss') {
      return
    }
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [selectedMode])
  /*
   * The roster is loaded for both modes.
   *
   * The Abyss needs it to choose a Champion from. A dungeon run needs only its
   * size — a victory saves a Champion automatically, and at a full roster that
   * save turns into a choice about which build to lose, which is worth knowing
   * before the run rather than after it.
   */
  useEffect(() => {
    if (!characterService) {
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
  }, [characterService])
  /*
   * Who is at the Camp. A working Champion is shown and cannot be sent down;
   * the server refuses it too, so an unreachable Camp only costs the label.
   */
  useEffect(() => {
    if (!campService || selectedMode !== 'infinite-abyss') {
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
        // The lockout is the server's; the screen only loses its label.
      })
    return () => {
      cancelled = true
    }
  }, [campService, selectedMode])
  const workingAt = (championId: string): string | null => {
    const assignment = getCampAssignment(campState, championId)
    const job = assignment ? getCampJobDefinition(assignment.jobId) : undefined
    return job ? CAMP_BUILDING_DEFINITIONS[job.buildingId].name : null
  }
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
  const selectedChampion = champions.find((champion) =>
    champion.championId === selectedChampionId,
  )
  const readableArtifacts = useMemo(
    () => artifactItems.flatMap((item) => {
      const artifact = readArtifactMetadata(item.definitionId, item.metadata)
      return artifact ? [{ item, artifact }] : []
    }),
    [artifactItems],
  )
  const selectedArtifactSlots = useMemo(
    () => Array.from({ length: artifactSlotCount }, (_, index) =>
      readableArtifacts.find((entry) => entry.item.itemInstanceId === selectedArtifactIds[index]) ?? null,
    ),
    [artifactSlotCount, readableArtifacts, selectedArtifactIds],
  )
  const selectedArtifacts = useMemo(
    () => selectedArtifactSlots.filter((entry): entry is NonNullable<typeof entry> => entry !== null),
    [selectedArtifactSlots],
  )
  /*
   * The artifacts this run will be played with: the bag's picks for a dungeon
   * run, the Champion's own for the Abyss. The meal reads the Kettle off them.
   */
  const runArtifacts = useMemo<ArtifactMetadata[]>(
    () => selectedMode === 'infinite-abyss'
      ? getPreparationArtifacts(selectedChampion?.build.artifacts
        ? { version: 1, items: [], artifacts: selectedChampion.build.artifacts }
        : undefined)
      : selectedArtifacts.map((entry) => entry.artifact),
    [selectedArtifacts, selectedChampion, selectedMode],
  )
  const mealOptions = useMemo<FishMealOptions>(() => {
    const kettles = runArtifacts.filter((artifact) => artifact.implicit.id === 'hearty-meal')
    return {
      extraSlot: kettles.length > 0,
      bonusPercent: kettles.reduce((total, artifact) => total + artifact.implicit.value, 0),
    }
  }, [runArtifacts])
  const mealSlotCount = getFishMealSlotCount(mealOptions)
  const fishMeal = useMemo(
    () => resolveFishMeal(selectedFish.slice(0, mealSlotCount), mealOptions),
    [mealOptions, mealSlotCount, selectedFish],
  )
  const selectedChampionExhausted = selectedChampion
    ? isChampionExhausted(selectedChampion, currentTime)
    : false
  const selectedChampionWorking = selectedChampion
    ? workingAt(selectedChampion.championId) !== null
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
              {selectedMode === 'infinite-abyss'
                ? 'Pick the Champion who makes the descent.'
                : 'Shape your fighter before entering the dungeon.'}
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
                    preparation: {
                      ...fishMeal.preparation,
                      artifacts: selectedArtifacts.map((entry) => ({
                        itemInstanceId: entry.item.itemInstanceId,
                        definitionId: entry.item.definitionId,
                        quantity: 1,
                      })),
                    },
                    selectedDungeonMaxFloor,
                  })
            }}
            disabled={startState === 'saving' ||
              (selectedMode === 'infinite-abyss' &&
                (selectedChampion === undefined || selectedChampionExhausted || selectedChampionWorking))}
          >
            <span>{startState === 'saving' ? 'Saving…' : 'Start Run'}</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
        {writeError ? <p className="persistence-error" role="alert">{writeError}</p> : null}
        {/* A dungeon victory saves its build as a Champion on its own, so a full
            roster turns the win into a choice about what to lose. Said here,
            while there is still time to archive one. */}
        {selectedMode === 'dungeon' &&
          championLoadState === 'ready' &&
          champions.length >= CHAMPION_SLOT_LIMIT ? (
          <p className="run-roster-warning" role="status">
            Your Champion roster is full at {CHAMPION_SLOT_LIMIT}. Win this run and you will
            be asked which build to let go — this one, or one you already hold.
          </p>
        ) : null}
        {selectedMode === 'dungeon' ? (
          <div className="run-dashboard-section-heading">
            <p className="screen-kicker">Choose your fighter</p>
            <h3>Select your character</h3>
          </div>
        ) : null}
        {selectedMode === 'dungeon' ? (
        <fieldset className="dashboard-choice-group run-dashboard-choice-group">
          <legend>Character</legend>
          {/*
            * Every class is listed rather than paged. The screen is a document
            * now, so a card that does not fit is reached by scrolling to it —
            * where paging put it behind a Next button that nothing on the first
            * page pointed at.
            */}
          <div className="dashboard-choice-list run-class-list">
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
        {/*
          * Who the character attacks, chosen with the loadout.
          *
          * Dungeon runs only: a descent fights on a Champion's saved build,
          * and its priority came with it, so offering the choice here would
          * sell something that mode ignores. It is still changeable during a
          * run from the behavior control in the HUD.
          */}
        {selectedMode === 'dungeon' ? (
          <fieldset className="dashboard-choice-group run-dashboard-choice-group">
            <legend>Target priority</legend>
            <p>Which enemy the character attacks when several are in reach.</p>
            <div className="dashboard-choice-list">
              {TARGET_PRIORITY_ORDER.map((priorityId) => {
                const priority = TARGET_PRIORITY_DEFINITIONS[priorityId]
                const selected = settings.selectedTargetPriorityId === priority.id
                return (
                  <button
                    className={`dashboard-choice${selected ? ' selected' : ''}`}
                    type="button"
                    aria-pressed={selected}
                    key={priority.id}
                    onClick={() => onSelectTargetPriority(priority.id)}
                  >
                    <strong>{priority.name}</strong>
                    <span>{priority.description}</span>
                  </button>
                )
              })}
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
                     const working = workingAt(champion.championId)
                     const panelId = `abyss-champion-panel-${champion.championId}`
                     const triggerId = `abyss-champion-trigger-${champion.championId}`
                     return (
                       <article className={`run-abyss-champion-card${isSelected ? ' selected' : ''}`} key={champion.championId}>
                         <button
                           className={`game-mode-choice run-abyss-champion-trigger${isSelected ? ' selected' : ''}${isExhausted ? ' exhausted' : ''}${working ? ' working' : ''}`}
                           id={triggerId}
                           type="button"
                           aria-expanded={isSelected}
                           aria-controls={panelId}
                           aria-pressed={isSelected}
                           onClick={() => {
                             setSelectedChampionId(champion.championId)
                             setRevivalError(null)
                           }}
                         >
                           <span className="run-abyss-champion-trigger-copy">
                             <strong>{champion.name}</strong>
                             <span>{CHARACTER_CLASS_DEFINITIONS[champion.build.classId].name}</span>
                             <small>
                               {working
                                 ? `Working · ${working}. Bring it back from the Camp to descend.`
                                 : isExhausted
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
                                 <ChampionRevivalControl
                                   key={champion.championId}
                                   championId={champion.championId}
                                   fish={fishItems}
                                   fishLoadState={fishLoadState}
                                   fishLoadError={fishLoadError}
                                   saving={revivalState === 'saving'}
                                   error={revivalError}
                                   onRevive={(fish) => { void reviveChampion(fish) }}
                                 />
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
         {selectedMode === 'infinite-abyss' ? null : (
         <section className="run-dashboard-meal run-dashboard-artifacts" aria-labelledby="artifact-loadout-title">
           <div className="run-dashboard-section-heading">
             <p className="screen-kicker">Artifacts</p>
             <h3 id="artifact-loadout-title">
               {artifactSlotCount === 1 ? 'Carry one artifact' : `Carry up to ${artifactSlotCount === 2 ? 'two' : 'three'} artifacts`}
             </h3>
           </div>
           {artifactLoadState === 'loading' ? (
             <p className="fish-meal-muted">Loading artifacts…</p>
           ) : artifactLoadState === 'error' ? (
             <p className="fish-meal-muted">Artifacts are unavailable. You can still start without one.</p>
           ) : readableArtifacts.length === 0 ? (
             <p className="fish-meal-muted">No artifacts in the bag. Rare and better loot boxes can hold them.</p>
           ) : (
             <>
               <div className="fish-meal-slots artifact-loadout-slots" aria-label="Artifact slots">
               {selectedArtifactSlots.map((entry, index) => {
                 const base = entry ? getArtifactBaseDefinition(entry.artifact.baseId) : undefined
                 return (
                   <button
                     className={`fish-meal-slot artifact-loadout-slot${entry ? ' filled' : ''}`}
                     style={base ? { borderColor: base.accent } : undefined}
                     type="button"
                     aria-label={entry && base
                       ? `Artifact slot ${index + 1}: ${base.name}`
                       : `Artifact slot ${index + 1}: empty`}
                     onClick={() => setActiveArtifactSlotIndex(index)}
                     key={index}
                   >
                     <span className="fish-meal-slot-number">{index + 1}</span>
                     {entry && base ? (
                       <>
                         <span className="fish-meal-slot-icon" aria-hidden="true">
                           <ArtifactIcon icon={base.id} color={base.accent} />
                         </span>
                         <strong>{base.name}</strong>
                         <small>{entry.artifact.rarity} · {formatArtifactHeadline(entry.artifact)}</small>
                       </>
                     ) : (
                       <span className="fish-meal-slot-empty">Click to select</span>
                     )}
                   </button>
                 )
               })}
               </div>
               {activeArtifactSlotIndex !== null ? (
               <div className="fish-meal-picker artifact-loadout-picker" aria-label="Artifacts in the bag">
                 <strong>Select an artifact for slot {activeArtifactSlotIndex + 1}</strong>
                 <div className="fish-meal-picker-list">
                   {readableArtifacts
                     .filter((entry) =>
                       !selectedArtifactIds.filter((id): id is string => id !== null).includes(entry.item.itemInstanceId) ||
                       selectedArtifactIds[activeArtifactSlotIndex] === entry.item.itemInstanceId,
                     )
                     .map((entry) => {
                       const base = getArtifactBaseDefinition(entry.artifact.baseId)
                       return (
                         <button
                           className="fish-meal-picker-item artifact-loadout-picker-item"
                           style={base ? { borderColor: base.accent } : undefined}
                           type="button"
                           key={entry.item.itemInstanceId}
                           onClick={() => {
                             setSelectedArtifactIds((current) => {
                               const next = Array.from({ length: artifactSlotCount }, (_, index) => current[index] ?? null)
                               next[activeArtifactSlotIndex] = entry.item.itemInstanceId
                               return next
                             })
                             setActiveArtifactSlotIndex(null)
                           }}
                         >
                           <span className="fish-meal-picker-item-heading">
                             <span className="fish-meal-picker-item-icon" aria-hidden="true">
                               {base ? <ArtifactIcon icon={base.id} color={base.accent} /> : '◇'}
                             </span>
                             <span>{base?.name ?? entry.item.definitionId}</span>
                             <span className="inventory-rarity-mark" data-rarity={entry.artifact.rarity}>
                               {entry.artifact.rarity}
                             </span>
                           </span>
                           <ArtifactEffectList metadata={entry.artifact} />
                         </button>
                       )
                     })}
                   <button
                     className="fish-meal-picker-clear"
                     type="button"
                     onClick={() => {
                       setSelectedArtifactIds((current) =>
                         Array.from({ length: artifactSlotCount }, (_, index) =>
                           index === activeArtifactSlotIndex ? null : current[index] ?? null,
                         ),
                       )
                       setActiveArtifactSlotIndex(null)
                     }}
                   >
                     Clear this slot
                   </button>
                   <button
                     className="secondary-action"
                     type="button"
                     onClick={() => setActiveArtifactSlotIndex(null)}
                   >
                     Cancel
                   </button>
                 </div>
               </div>
               ) : null}
             </>
           )}
           <p className="fish-meal-footnote">
             Artifacts are held for the run. A victory locks them into the Champion it makes;
             a defeat puts them back in the bag.
           </p>
         </section>
         )}
         <section className="run-dashboard-meal" aria-labelledby="fish-meal-title">
           <div className="run-dashboard-section-heading">
             <p className="screen-kicker">Pre-run meal</p>
             <h3 id="fish-meal-title">Choose up to {mealSlotCount === 6 ? 'six' : 'five'} fish</h3>
           </div>
           <p className="fish-meal-summary">
             {getFishMealEffectSummary(fishMeal.effects)} · {Math.min(selectedFish.length, mealSlotCount)}/{mealSlotCount} selected
             {mealOptions.extraSlot ? ` · Kettle: +${mealOptions.bonusPercent}% and a sixth place` : ''}
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
               <div className="fish-meal-slots" aria-label="Fish meal slots" data-slot-count={mealSlotCount}>
               {Array.from({ length: mealSlotCount }, (_, index) => {
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
                             const next = Array.from({ length: mealSlotCount }, (_, index) => current[index] ?? null)
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
                         Array.from({ length: mealSlotCount }, (_, index) =>
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
         {/*
           The dungeon's conditions, and only the dungeon's. They are a trade of
           difficulty for a bigger Essence reward, and the Abyss pays no Essence
           — so offering them there sold a price with nothing on the other side
           of it. The choice itself is remembered either way; it is waiting for
           the next dungeon run.
         */}
         {selectedMode !== 'dungeon' ? null : (
         <>
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
        </>
        )}
      </div>
    </section>
  )
}
