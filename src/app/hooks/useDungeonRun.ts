import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { GameCheckpoint, RunConfig, RunResultSnapshot } from '../../game'
import {
  DEFAULT_DUNGEON_CONFIG,
  DEFAULT_DUNGEON_ID,
  DEFAULT_RUN_MODE_ID,
  EMPTY_RUN_PREPARATION_SNAPSHOT,
  createGameFromCheckpoint,
  createInitialGameCheckpoint,
  isRunPreparationSnapshot,
  type RunModeId,
} from '../../game'
import type { AuthenticationState } from '../../auth'
import {
  isChampionRosterFullError,
  type CharacterBuildSnapshot,
  type ChampionSnapshot,
} from '../../characters'
import type { CharacterService } from '../../characters/CharacterTypes'
import type { MetaProgressionService, MetaRunResultInput } from '../../meta'
import {
  DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID,
  type ActiveDungeonRun,
  type BasicProfileDto,
  type DungeonRunPersistenceService,
  type SettingsDto,
} from '../../persistence'
import type { ServiceHandle } from '../../services'
import type { ToastKind } from '../../ui/ToasterContext'
import { DEFAULT_SKILL_SLOT_COUNT } from '../../game-config/skills'
import {
  DEFAULT_CHAMPION_NAME,
  RUN_GAME_VERSION,
  type MetaProgressionState,
  type RunLoadState,
  type RunRewardState,
  type RunWriteState,
  type StartRunOptions,
} from '../appState'
import { RUN_SETUP_ABYSS_PATH, getRunModeForPath, type AppScreen } from '../routing'
import {
  createRunSeed,
  errorMessage,
  isMaxFloorContractUnlocked,
  parseGameCheckpoint,
} from '../runFormatting'

export type ChampionAvailability = 'loading' | 'available' | 'none' | 'error'

export type ChampionSaveState = 'idle' | 'saving' | 'saved' | 'error' | 'roster-full' | 'discarded'

interface DungeonRunInputs {
  account: AuthenticationState['account']
  dungeonRunPersistence: ServiceHandle<DungeonRunPersistenceService>
  characters: ServiceHandle<CharacterService>
  metaProgressionService: ServiceHandle<MetaProgressionService>
  settings: SettingsDto | null
  profile: BasicProfileDto | null
  metaProgression: MetaProgressionState
  setMetaProgression: Dispatch<SetStateAction<MetaProgressionState>>
  navigateToScreen: (screen: AppScreen, replace?: boolean, path?: string) => void
  showToast: (message: string, kind?: ToastKind) => void
  /** Clears the settings write error a fresh run start supersedes. */
  setWriteError: (error: string | null) => void
}

const IDLE_RUN_REWARD: RunRewardState = {
  status: 'idle',
  essenceAwarded: null,
  scrapAwarded: null,
  error: null,
}

/**
 * The run, from the refuge to the results and back.
 *
 * Everything a run touches between screens: the durable active run and
 * whether it could be recovered, the configuration the next run starts
 * from, the checkpoints on the way down, the terminal save, the Essence and
 * the Champion a victory pays, and the refusals that keep a second run from
 * starting over the first. The screens are handed callbacks; the state that
 * makes them agree with each other lives here.
 */
export function useDungeonRun({
  account,
  dungeonRunPersistence,
  characters,
  metaProgressionService,
  settings,
  profile,
  metaProgression,
  setMetaProgression,
  navigateToScreen,
  showToast,
  setWriteError,
}: DungeonRunInputs) {
  const [runId, setRunId] = useState(0)
  const [runSeed, setRunSeed] = useState(createRunSeed)
  const [runMode, setRunMode] = useState<RunModeId>(() =>
    typeof window === 'undefined' ? DEFAULT_RUN_MODE_ID : getRunModeForPath(window.location.pathname),
  )
  const [runChampion, setRunChampion] = useState<CharacterBuildSnapshot | null>(null)
  const [runChampionId, setRunChampionId] = useState<string | null>(null)
  const [activeRunSubmission, setActiveRunSubmission] = useState<MetaRunResultInput | null>(null)
  const [result, setResult] = useState<RunResultSnapshot | null>(null)
  const [runReward, setRunReward] = useState<RunRewardState>(IDLE_RUN_REWARD)
  const [activeRun, setActiveRun] = useState<ActiveDungeonRun | null>(null)
  const [championAvailability, setChampionAvailability] = useState<ChampionAvailability>(
    () => characters.service ? 'loading' : 'error',
  )
  const [runLoadState, setRunLoadState] = useState<RunLoadState>('loading')
  const [runLoadError, setRunLoadError] = useState<string | null>(null)
  const [runStartState, setRunStartState] = useState<RunWriteState>('idle')
  const [runStartError, setRunStartError] = useState<string | null>(null)
  const [resumeCheckpoint, setResumeCheckpoint] = useState<GameCheckpoint | null>(null)
  const [terminalCheckpoint, setTerminalCheckpoint] = useState<GameCheckpoint | null>(null)
  const [terminalSaveState, setTerminalSaveState] = useState<RunWriteState>('idle')
  const [terminalSaveError, setTerminalSaveError] = useState<string | null>(null)
  const [championSaveState, setChampionSaveState] = useState<ChampionSaveState>('idle')
  const [championSaveError, setChampionSaveError] = useState<string | null>(null)
  /*
   * The roster the results screen offers a choice from, loaded only when a win
   * arrives at a full one. It is the live list rather than anything remembered
   * from the run, because a Champion may have been archived on another device
   * while this one was in the dungeon.
   */
  const [championRoster, setChampionRoster] = useState<ChampionSnapshot[]>([])
  const pendingRunIdRef = useRef<string | null>(null)
  const pendingChampionIdRef = useRef<string | null>(null)

  useEffect(() => {
    const accountId = account?.id
    if (!accountId) {
      // Resets champion availability for the new account before the async load
      // below resolves, so the previous account's answer is never displayed.
      // oxlint-disable-next-line react/set-state-in-effect
      setChampionAvailability('none')
      return
    }
    if (!characters.service) {
      setChampionAvailability('error')
      return
    }
    let cancelled = false
    setChampionAvailability('loading')
    void characters.service.loadCharacters()
      .then((collection) => {
        if (!cancelled) {
          setChampionAvailability(collection.champions.length > 0 ? 'available' : 'none')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setChampionAvailability('error')
        }
      })
    return () => {
      cancelled = true
    }
  }, [account?.id, characters.service])

  useEffect(() => {
    const accountId = account?.id
    const service = dungeonRunPersistence.service
    if (!accountId) {
      // Clears the previous account's run before loading the new one; leaving it
      // in place would briefly attribute one account's run to another.
      // oxlint-disable-next-line react/set-state-in-effect
      setActiveRun(null)
      setChampionAvailability('none')
      setRunLoadState('ready')
      setRunLoadError(null)
      return
    }
    if (!service) {
      setActiveRun(null)
      setRunLoadState('unavailable')
      setRunLoadError(
        dungeonRunPersistence.configurationError ?? 'Dungeon run persistence is unavailable.',
      )
      return
    }

    let cancelled = false
    setRunLoadState('loading')
    setRunLoadError(null)
    void service.loadActiveRun()
      .then((loadedRun) => {
        if (!cancelled) {
          setActiveRun(loadedRun)
          setRunLoadState('ready')
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setActiveRun(null)
          setRunLoadState('error')
          setRunLoadError(errorMessage(error))
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    account?.id,
    dungeonRunPersistence.configurationError,
    dungeonRunPersistence.service,
  ])

  const runConfig = useMemo<RunConfig | null>(() => {
    if (!settings || !profile) {
      return null
    }
    const unlockedDungeonMaxFloorIds = DEFAULT_DUNGEON_CONFIG.maximumFloorContracts
      .filter((contract) =>
        isMaxFloorContractUnlocked(profile, contract.id, contract.requiredUnlockId),
      )
      .map((contract) => contract.requiredUnlockId)
    const selectedContractIsDefault =
      settings.selectedDungeonMaxFloorContractId === DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID
    return {
      seed: activeRun?.seed ?? runSeed,
      modeId: activeRun?.modeId ?? runMode,
      preparation: activeRun?.preparation ?? EMPTY_RUN_PREPARATION_SNAPSHOT,
      champion: runChampion ?? undefined,
      championId: runChampionId ?? undefined,
      behaviorProfileId: settings.selectedBehaviorProfileId,
      targetPriorityId: settings.selectedTargetPriorityId,
      characterClassId: settings.selectedCharacterClassId,
      xpMultiplierLevel: metaProgression.snapshot?.xpMultiplierLevel ?? 0,
      startingLevel: metaProgression.snapshot?.startingLevel ?? 1,
      skillSlotCount: metaProgression.snapshot?.skillSlotCount ?? DEFAULT_SKILL_SLOT_COUNT,
      dungeonMaxFloorBonus: metaProgression.snapshot?.dungeonMaxFloorBonus ?? 0,
      rerollCount: metaProgression.snapshot?.wallet.rerollLevel ?? 0,
      banishCount: metaProgression.snapshot?.banishCount ?? 1,
      /*
       * The Abyss takes none, and the preference is kept all the same: it is
       * the player's dungeon setting, waiting for their next dungeon run.
       */
      worldModifierIds: (activeRun?.modeId ?? runMode) === 'infinite-abyss'
        ? []
        : settings.selectedWorldModifierIds,
      ...(selectedContractIsDefault
        ? {}
        : {
            dungeonMaxFloorContractId: settings.selectedDungeonMaxFloorContractId,
            unlockedDungeonMaxFloorIds,
          }),
    }
  }, [activeRun, metaProgression.snapshot, profile, runChampion, runChampionId, runMode, runSeed, settings])

  const openMetaProgression = useCallback((): void => {
    if (!account || runLoadState !== 'ready') {
      return
    }
    if (activeRun !== null) {
      showToast('Finish or forfeit your current dungeon run before opening the store.', 'error')
      return
    }
    navigateToScreen('meta-progression')
  }, [account, activeRun, navigateToScreen, runLoadState, showToast])

  const openRunSetup = useCallback((): void => {
    if (!account || runLoadState !== 'ready') {
      return
    }
    if (activeRun !== null) {
      showToast('Continue or forfeit your current dungeon run before starting a new one.', 'error')
      return
    }
    setRunMode(DEFAULT_RUN_MODE_ID)
    setRunChampion(null)
    setRunChampionId(null)
    navigateToScreen('run-setup')
  }, [account, activeRun, navigateToScreen, runLoadState, showToast])

  const openAbyssSetup = useCallback((): void => {
    if (!account || runLoadState !== 'ready') {
      return
    }
    if (activeRun !== null) {
      showToast('Continue or forfeit your current dungeon run before entering the Abyss.', 'error')
      return
    }
    setRunMode('infinite-abyss')
    setRunChampion(null)
    setRunChampionId(null)
    navigateToScreen('run-setup', false, RUN_SETUP_ABYSS_PATH)
  }, [account, activeRun, navigateToScreen, runLoadState, showToast])

  const startRun = useCallback(async (
    options: StartRunOptions = {},
  ): Promise<void> => {
    const service = dungeonRunPersistence.service
    if (
      !account ||
      !service ||
      !runConfig ||
      runLoadState !== 'ready' ||
      activeRun !== null
    ) {
      showToast(
        activeRun
          ? 'Continue or forfeit your current dungeon run before starting a new one.'
          : 'Dungeon run persistence is unavailable.',
        'error',
      )
      return
    }
    const preparation = options.preparation ?? EMPTY_RUN_PREPARATION_SNAPSHOT
    if (!isRunPreparationSnapshot(preparation)) {
      showToast('The selected run meal is invalid.', 'error')
      return
    }
    if (options.modeId === 'infinite-abyss' && !options.champion) {
      showToast('Select an available Champion before entering the Abyss.', 'error')
      return
    }
    setRunStartState('saving')
    setRunStartError(null)
    setResult(null)
    setWriteError(null)
    setChampionSaveState('idle')
    setChampionSaveError(null)
    pendingChampionIdRef.current = null
    const seed = createRunSeed()
    const config: RunConfig = {
      ...runConfig,
      seed,
      modeId: options.modeId ?? runMode,
      preparation,
      champion: options.champion ?? runChampion ?? undefined,
      championId: options.championId ?? runChampionId ?? undefined,
      selectedDungeonMaxFloor: options.selectedDungeonMaxFloor,
      characterClassId: options.champion?.classId ?? runConfig.characterClassId,
    }
    const durableRunId = pendingRunIdRef.current ?? crypto.randomUUID()
    pendingRunIdRef.current = durableRunId
    try {
      const checkpoint = createInitialGameCheckpoint(config)
      const created = await service.createRun({
        runId: durableRunId,
        seed,
        contractId: config.dungeonMaxFloorContractId ?? DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID,
        worldModifierIds: config.worldModifierIds ?? [],
        maxFloor: checkpoint.gameState.run.dungeonMaxFloor ?? DEFAULT_DUNGEON_CONFIG.defaultMaxFloor,
        startedAt: new Date().toISOString(),
        dungeonId: checkpoint.gameState.run.dungeonId ?? DEFAULT_DUNGEON_ID,
        modeId: config.modeId ?? DEFAULT_RUN_MODE_ID,
        characterClassId: checkpoint.gameState.player.characterClassId ?? config.characterClassId ?? 'knight',
        gameVersion: RUN_GAME_VERSION,
        preparation: config.preparation ?? EMPTY_RUN_PREPARATION_SNAPSHOT,
        checkpoint,
      })
      const createdCheckpoint = parseGameCheckpoint(created.checkpoint.payload)
      pendingRunIdRef.current = null
      setRunMode(config.modeId ?? DEFAULT_RUN_MODE_ID)
      setRunChampion(config.champion ?? null)
      setRunChampionId(config.championId ?? null)
      setRunSeed(seed)
      setActiveRun(created)
      setResumeCheckpoint(null)
      setTerminalCheckpoint(null)
      setActiveRunSubmission({
        runId: created.runId,
        pendingResultId: created.runId,
        completedAt: '',
        level: createdCheckpoint.gameState.player.level,
        killCount: createdCheckpoint.gameState.run.killCount,
        outcome: 'defeat',
        worldModifierIds: createdCheckpoint.gameState.run.worldModifierIds ?? [],
      })
      setRunReward({ status: 'idle', essenceAwarded: null, scrapAwarded: null, error: null })
      setRunStartState('saved')
      setRunId((currentRunId) => currentRunId + 1)
      navigateToScreen('gameplay', true)
    } catch (error: unknown) {
      setRunStartState('error')
      setRunStartError(errorMessage(error))
    }
  }, [
    account,
    activeRun,
    dungeonRunPersistence.service,
    navigateToScreen,
    runChampion,
    runChampionId,
    runConfig,
    runLoadState,
    runMode,
    setWriteError,
    showToast,
  ])

  const continueRun = useCallback((): void => {
    if (!activeRun) {
      return
    }
    try {
      const checkpoint = parseGameCheckpoint(activeRun.checkpoint.payload)
      setResumeCheckpoint(checkpoint)
      setRunSeed(activeRun.seed)
      setRunMode(checkpoint.runConfig.modeId ?? DEFAULT_RUN_MODE_ID)
      setRunChampion(checkpoint.runConfig.champion ?? null)
      setRunChampionId(checkpoint.runConfig.championId ?? null)
      setActiveRunSubmission({
        runId: activeRun.runId,
        pendingResultId: activeRun.runId,
        completedAt: '',
        level: checkpoint.gameState.player.level,
        killCount: checkpoint.gameState.run.killCount,
        outcome: 'defeat',
        worldModifierIds: checkpoint.gameState.run.worldModifierIds ?? [],
      })
      setRunReward({ status: 'idle', essenceAwarded: null, scrapAwarded: null, error: null })
      setRunId((currentRunId) => currentRunId + 1)
      navigateToScreen('gameplay', true)
    } catch (error: unknown) {
      showToast(`Unable to restore the saved dungeon: ${errorMessage(error)}`, 'error')
    }
  }, [activeRun, navigateToScreen, showToast])

  const saveFloorCheckpoint = useCallback(async (checkpoint: GameCheckpoint): Promise<void> => {
    const service = dungeonRunPersistence.service
    const submission = activeRunSubmission
    if (!service || !submission) {
      throw new Error('Unable to identify the active dungeon run.')
    }
    const updated = await service.saveFloorCheckpoint({
      runId: submission.runId,
      floor: checkpoint.gameState.run.floor ?? 1,
      checkpoint,
    })
    setActiveRun(updated)
    if (updated.floorReward) {
      showToast(
        `Abyss floor ${updated.floorReward.completedFloor} reward: ${updated.floorReward.boxRarity} loot box.`,
        'info',
      )
    }
  }, [activeRunSubmission, dungeonRunPersistence.service, showToast])

  const saveAndQuitRun = useCallback(async (): Promise<void> => {
    const service = dungeonRunPersistence.service
    const submission = activeRunSubmission
    if (!service || !submission) {
      throw new Error('Unable to identify the active dungeon run.')
    }
    // Save & quit changes only the durable run status. The latest completed
    // floor checkpoint remains authoritative by design.
    await service.pauseRun(submission.runId)
    setActiveRun((current) => current ? { ...current, status: 'paused' } : current)
    setResumeCheckpoint(null)
    navigateToScreen('dashboard', true)
  }, [activeRunSubmission, dungeonRunPersistence.service, navigateToScreen])

  const submitRunReward = useCallback(async (submission: MetaRunResultInput): Promise<void> => {
    const service = metaProgressionService.service
    if (!service || !account) {
      setRunReward({
        status: 'unavailable',
        essenceAwarded: null,
        scrapAwarded: null,
        error: 'Sign in with progression available to earn Essence.',
      })
      return
    }
    setRunReward((current) => ({
      ...current,
      status: 'submitting',
      essenceAwarded: null,
      error: null,
    }))
    try {
      const reward = await service.submitRunResult(submission)
      const snapshot = await service.load()
      setMetaProgression((current) => ({
        ...current,
        loadState: 'ready',
        snapshot,
        error: null,
      }))
      setRunReward((current) => ({
        ...current,
        status: 'saved',
        essenceAwarded: reward.essenceAwarded,
        error: null,
      }))
    } catch (error: unknown) {
      setRunReward((current) => ({
        ...current,
        status: 'error',
        essenceAwarded: null,
        error: errorMessage(error),
      }))
    }
  }, [account, metaProgressionService.service, setMetaProgression])

  const saveChampion = useCallback(async (
    name = DEFAULT_CHAMPION_NAME,
    submissionOverride?: MetaRunResultInput,
    replacedChampionId?: string,
  ): Promise<void> => {
    const submission = submissionOverride ?? activeRunSubmission
    if (submission?.outcome !== 'victory') {
      return
    }
    if (!characters.service) {
      setChampionSaveState('error')
      setChampionSaveError(characters.configurationError ?? 'Champion storage is unavailable.')
      return
    }
    const trimmedName = name.trim()
    if (trimmedName.length < 1 || trimmedName.length > 32) {
      setChampionSaveState('error')
      setChampionSaveError('Champion names must be between 1 and 32 characters.')
      return
    }
    const championId = pendingChampionIdRef.current ?? crypto.randomUUID()
    pendingChampionIdRef.current = championId
    setChampionSaveState('saving')
    setChampionSaveError(null)
    try {
      await characters.service.createChampionFromRun({
        championId,
        sourceRunId: submission.runId,
        name: trimmedName,
        contentVersion: RUN_GAME_VERSION,
        ...(replacedChampionId ? { replacedChampionId } : {}),
      })
      pendingChampionIdRef.current = null
      setChampionAvailability('available')
      setChampionSaveState('saved')
    } catch (error: unknown) {
      /*
       * A full roster is a choice to put to the player, not a failure to report:
       * the build was earned, and something has to give way for it. The roster
       * is fetched here so the results screen can name what it is offering.
       */
      if (isChampionRosterFullError(error)) {
        try {
          const collection = await characters.service.loadCharacters()
          setChampionRoster(collection.champions)
          setChampionSaveState('roster-full')
          setChampionSaveError(null)
          return
        } catch {
          // Fall through: without the roster there is no choice to offer, so the
          // player is told the plain truth instead.
        }
      }
      setChampionSaveState('error')
      setChampionSaveError(errorMessage(error))
    }
  }, [
    activeRunSubmission,
    characters.configurationError,
    characters.service,
  ])

  const saveTerminalRun = useCallback(async (
    submission: MetaRunResultInput,
    checkpoint: GameCheckpoint,
  ): Promise<void> => {
    const service = dungeonRunPersistence.service
    if (!service) {
      setTerminalSaveState('unavailable')
      setTerminalSaveError('Dungeon run persistence is unavailable.')
      return
    }
    setTerminalSaveState('saving')
    setTerminalSaveError(null)
    try {
      const completed = await service.completeRun({
        runId: submission.runId,
        outcome: submission.outcome,
        completedAt: submission.completedAt,
        checkpoint,
        level: submission.level,
        killCount: submission.killCount,
        worldModifierIds: submission.worldModifierIds,
      })
      // Recorded before the Essence submission runs, which is why every later
      // update to this state carries the value forward instead of resetting it.
      setRunReward((current) => ({
        ...current,
        scrapAwarded: completed.reward.scrapAwarded,
      }))
      setActiveRun(null)
      setTerminalSaveState('saved')
      if (submission.outcome === 'victory') {
        await saveChampion(DEFAULT_CHAMPION_NAME, submission)
      }
      await submitRunReward(submission)
    } catch (error: unknown) {
      setTerminalSaveState('error')
      setTerminalSaveError(errorMessage(error))
    }
  }, [dungeonRunPersistence.service, saveChampion, submitRunReward])

  const handleRunEnd = useCallback((
    runResult: RunResultSnapshot,
    checkpoint: GameCheckpoint,
  ): void => {
    setResult(runResult)
    navigateToScreen('results', true)
    if (!activeRunSubmission) {
      setRunReward({
        status: 'error',
        essenceAwarded: null,
        scrapAwarded: null,
        error: 'Unable to identify this run for Essence rewards.',
      })
      return
    }
    const submission: MetaRunResultInput = {
      ...activeRunSubmission,
      completedAt: new Date().toISOString(),
      level: runResult.level,
      killCount: runResult.killCount,
      outcome: runResult.outcome === 'victory' ? 'victory' : 'defeat',
      worldModifierIds: runResult.worldModifierIds,
    }
    setActiveRunSubmission(submission)
    setTerminalCheckpoint(checkpoint)
    void saveTerminalRun(submission, checkpoint)
  }, [activeRunSubmission, navigateToScreen, saveTerminalRun])

  const retryTerminalSave = useCallback((): void => {
    if (activeRunSubmission && terminalCheckpoint) {
      void saveTerminalRun(activeRunSubmission, terminalCheckpoint)
    }
  }, [activeRunSubmission, saveTerminalRun, terminalCheckpoint])

  const retryRunReward = useCallback((): void => {
    if (activeRunSubmission) {
      void submitRunReward(activeRunSubmission)
    }
  }, [activeRunSubmission, submitRunReward])

  const forfeitActiveRun = useCallback(async (): Promise<void> => {
    const service = dungeonRunPersistence.service
    const currentRun = activeRun
    if (!service || !currentRun) {
      throw new Error('There is no active dungeon run to forfeit.')
    }
    const completed = await service.forfeitRun(currentRun.runId)
    const checkpoint = parseGameCheckpoint(completed.snapshot.payload)
    const forfeitedGame = createGameFromCheckpoint(checkpoint)
    const forfeitedResult = forfeitedGame.getRunResultSnapshot()
    const submission: MetaRunResultInput = {
      runId: currentRun.runId,
      pendingResultId: currentRun.runId,
      completedAt: new Date().toISOString(),
      level: forfeitedResult.level,
      killCount: forfeitedResult.killCount,
      outcome: 'defeat',
      worldModifierIds: forfeitedResult.worldModifierIds,
    }
    setActiveRun(null)
    setActiveRunSubmission(submission)
    setResult(forfeitedResult)
    setTerminalCheckpoint(checkpoint)
    setTerminalSaveState('saved')
    navigateToScreen('results', true)
    void submitRunReward(submission)
  }, [
    activeRun,
    dungeonRunPersistence.service,
    navigateToScreen,
    submitRunReward,
  ])

  /*
   * A victory keeps its hold on the artifacts it was played with until a
   * Champion takes them. Leaving the results without one, whichever way,
   * hands them back; the server also sweeps stale holds before the next
   * run, so a lost request here costs nothing but a delay.
   */
  const releaseUnclaimedArtifacts = useCallback((): void => {
    const service = dungeonRunPersistence.service
    const submission = activeRunSubmission
    if (!service || submission?.outcome !== 'victory' || championSaveState === 'saved') {
      return
    }
    void service.releaseRunArtifacts(submission.runId).catch(() => {
      // Swept up by the next run start.
    })
  }, [activeRunSubmission, championSaveState, dungeonRunPersistence.service])

  const returnToDashboard = useCallback((): void => {
    releaseUnclaimedArtifacts()
    setResult(null)
    navigateToScreen('dashboard', true)
  }, [navigateToScreen, releaseUnclaimedArtifacts])

  const replaceChampion = useCallback((replacedChampionId: string): Promise<void> =>
    saveChampion(DEFAULT_CHAMPION_NAME, undefined, replacedChampionId), [saveChampion])

  const discardChampion = useCallback((): void => {
    pendingChampionIdRef.current = null
    setChampionSaveState('discarded')
    setChampionSaveError(null)
    releaseUnclaimedArtifacts()
  }, [releaseUnclaimedArtifacts])

  /**
   * Back to the state before any account: a sign-out's reset. The result on
   * screen, the seed and the roster are left alone, exactly as before the
   * split; only what an account owned is cleared.
   */
  const resetDungeonRun = useCallback((): void => {
    pendingRunIdRef.current = null
    setActiveRun(null)
    setRunMode(DEFAULT_RUN_MODE_ID)
    setRunChampion(null)
    setRunChampionId(null)
    setRunLoadState('ready')
    setResumeCheckpoint(null)
    setTerminalCheckpoint(null)
    setRunStartState('idle')
    setRunStartError(null)
    setTerminalSaveState('idle')
    setTerminalSaveError(null)
    setChampionSaveState('idle')
    setChampionSaveError(null)
    pendingChampionIdRef.current = null
    setActiveRunSubmission(null)
  }, [])

  return {
    runId,
    runMode,
    setRunMode,
    runConfig,
    activeRun,
    activeRunSubmission,
    result,
    runReward,
    championAvailability,
    runLoadState,
    runLoadError,
    runStartState,
    runStartError,
    resumeCheckpoint,
    terminalSaveState,
    terminalSaveError,
    championSaveState,
    championSaveError,
    championRoster,
    openMetaProgression,
    openRunSetup,
    openAbyssSetup,
    startRun,
    continueRun,
    saveFloorCheckpoint,
    saveAndQuitRun,
    handleRunEnd,
    retryTerminalSave,
    retryRunReward,
    forfeitActiveRun,
    returnToDashboard,
    saveChampion,
    replaceChampion,
    discardChampion,
    resetDungeonRun,
  }
}
