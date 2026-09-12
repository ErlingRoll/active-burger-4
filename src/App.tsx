import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RunResultSnapshot, RunConfig, GameCheckpoint } from './game'
import {
  DEFAULT_DUNGEON_CONFIG,
  DEFAULT_DUNGEON_ID,
  DEFAULT_RUN_MODE_ID,
  EMPTY_RUN_PREPARATION_SNAPSHOT,
  createGameFromCheckpoint,
  createInitialGameCheckpoint,
  getDungeonDefinition,
  isRunPreparationSnapshot,
  type BehaviorProfileId,
  type RunModeId,
  type TargetPriorityId,
} from './game'
import {
  type SettingsPatch,
  type ActiveDungeonRun,
} from './persistence'
import { DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID } from './persistence'
import {
  getPlayerDisplayName,
  hasDismissedNicknamePrompt,
  NicknameDialog,
  rememberNicknamePromptDismissed,
  shouldPromptForNickname,
  type AuthenticationState,
  type NicknameChangeRequest,
  type NicknameState,
  type SignInOptions,
  type SignUpResult,
} from './auth'
import {
  type MetaRunResultInput,
} from './meta'
import { DEFAULT_ARTIFACT_SLOT_COUNT } from './meta/MetaProgressionService'
import {
  normalizeWorldModifierIds,
  type WorldModifierId,
} from './content/modifiers/WorldModifiers'
import { useToaster } from './ui/ToasterContext'
import { useServices } from './services'
import {
  APP_ROUTE_PATHS,
  DOCUMENT_SCREENS,
  getCanonicalPath,
  getMusicPlaylistId,
  getRunModeForPath,
  getScreenForPath,
  RUN_SETUP_ABYSS_PATH,
  type AppScreen,
} from './app/routing'
import {
  createRunSeed,
  DUNGEON_MAX_FLOOR_CONTRACTS,
  errorMessage,
  isMaxFloorContractUnlocked,
  parseGameCheckpoint,
} from './app/runFormatting'
import { AppHeader } from './app/screens/AppHeader'
import {
  LazyAdminReportsScreen,
  LazyCampScreen,
  LazyChampionManagementScreen,
  LazyFishingScreen,
  LazyGameCanvas,
  LazyInventoryScreen,
  LazyMetaProgressionScreen,
  LazyNicknameModerationScreen,
  LazyRunChronicleScreen,
  LazyRunSetupScreen,
  LazyShopScreen,
  LazyWikiScreen,
} from './app/lazyScreens'
import { LazyScreen } from './app/LazyScreen'
import { NavigationVeil } from './app/NavigationVeil'
import type { NavigationHints } from './app/navigationHints'
import {
  IDLE_PRELOAD_SCREENS,
  loadScreenData,
  preloadScreen,
  SCREEN_DEFINITIONS,
  type LoadedScreen,
  type LoadedScreenData,
  type ScreenLoaderResults,
} from './app/screenDefinitions'
import { commitScreenTransition } from './app/screenTransition'
import { useScreenNavigator, type ScreenRequest } from './app/useScreenNavigator'
import { AuthGateway } from './app/screens/AuthGateway'
import { GameDashboard } from './app/screens/GameDashboard'
import { ResultsScreen } from './app/screens/ResultsScreen'
import type { AuthenticationService } from './auth'
import type { MetaProgressionService } from './meta'
import {
  type BugReportDungeonContext,
  type BugReportImage,
  type BugReport,
  type BugReportFloorSnapshot,
} from './bug-report'
import {
} from './fishing'
import {
  isChampionRosterFullError,
  type CharacterBuildSnapshot,
  type ChampionSnapshot,
} from './characters'
import {
} from './loot'
import type { GameKeybinds } from './input/Keybinds'
import { DEFAULT_GAME_KEYBINDS } from './input/Keybinds'
import { DEFAULT_SKILL_SLOT_COUNT } from './game-config/skills'
import {
  type CharacterClassId,
} from './content/classes/CharacterClasses'
import { useMusicPlaylist } from './audio'
import './App.css'

import {
  APP_VERSION,
  DEVELOPMENT_TOOLS_ENABLED,
  DEFAULT_CHAMPION_NAME,
  RUN_GAME_VERSION,
  type MetaProgressionState,
  type PersistenceState,
  type RunLoadState,
  type RunRewardState,
  type RunWriteState,
  type StartRunOptions,
} from './app/appState'

function createInitialMetaProgressionState(
  service: MetaProgressionService | null,
  configurationError: string | null,
): MetaProgressionState {
  return service
    ? {
        loadState: 'idle',
        snapshot: null,
        error: null,
        purchaseState: 'idle',
        activePurchaseUnlockId: null,
      }
    : {
        loadState: 'unavailable',
        snapshot: null,
        error: configurationError ?? 'Meta progression is unavailable.',
        purchaseState: 'idle',
        activePurchaseUnlockId: null,
      }
}

/**
 * The signed-in account's nickname, plus what the app does about it.
 *
 * `loadedForAccountId` names the account the nickname was fetched for, so a
 * stale answer from the previous account is never mistaken for the current
 * one. `promptOpen` is decided once per load: a new account (see
 * `shouldPromptForNickname`) is asked to pick a nickname right after signing
 * in, on every sign-in method alike, unless it skipped the prompt on this
 * browser before.
 */
interface AccountNickname extends NicknameState {
  loadedForAccountId: string | null
  promptOpen: boolean
}

const EMPTY_ACCOUNT_NICKNAME: AccountNickname = {
  displayName: null,
  pendingNickname: null,
  hasRequestedNickname: false,
  loadedForAccountId: null,
  promptOpen: false,
}

function createInitialAuthenticationState(
  service: AuthenticationService | null,
  configurationError: string | null,
): AuthenticationState {
  return service
    ? { status: 'loading', account: null, error: null }
    : {
        status: 'unavailable',
        account: null,
        error: configurationError ?? 'Authentication is unavailable.',
      }
}

/**
 * How a committed screen is drawn in: a cross-dissolve everywhere, except
 * into the dungeon, which is a threshold rather than a menu and goes down
 * through black.
 */
function commitNavigation(request: ScreenRequest, apply: () => void): void {
  commitScreenTransition(request.screen === 'gameplay' ? 'descend' : 'dissolve', apply)
}

function warmScreen(screen: AppScreen): void {
  void preloadScreen(screen)
}

function App() {
  const { showToast } = useToaster()
  const services = useServices()
  const {
    repository,
    authentication: authenticationService,
    nickname: nicknameService,
    meta: metaProgressionService,
    characters,
    abyssLeaderboard,
    dungeonRunPersistence,
    inventory,
    lootBoxes,
    shop,
    fishing,
    hubPresence,
    bugReport,
    camp,
  } = services
  const [authentication, setAuthentication] = useState<AuthenticationState>(() =>
    createInitialAuthenticationState(
      authenticationService.service,
      authenticationService.configurationError,
    ),
  )
  const [nickname, setNickname] = useState<AccountNickname>(EMPTY_ACCOUNT_NICKNAME)
  const [metaProgression, setMetaProgression] = useState<MetaProgressionState>(() =>
    createInitialMetaProgressionState(
      metaProgressionService.service,
      metaProgressionService.configurationError,
    ),
  )
  const [runId, setRunId] = useState(0)
  const [runSeed, setRunSeed] = useState(createRunSeed)
  const [runMode, setRunMode] = useState<RunModeId>(() =>
    typeof window === 'undefined' ? DEFAULT_RUN_MODE_ID : getRunModeForPath(window.location.pathname),
  )
  const [runChampion, setRunChampion] = useState<CharacterBuildSnapshot | null>(null)
  const [runChampionId, setRunChampionId] = useState<string | null>(null)
  const [activeRunSubmission, setActiveRunSubmission] = useState<MetaRunResultInput | null>(null)
  const [result, setResult] = useState<RunResultSnapshot | null>(null)
  const [runReward, setRunReward] = useState<RunRewardState>({
    status: 'idle',
    essenceAwarded: null,
    scrapAwarded: null,
    error: null,
  })
  const [persistence, setPersistence] = useState<PersistenceState>({
    loadState: 'loading',
    settings: null,
    profile: null,
    error: null,
  })
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [metaLoadAttempt, setMetaLoadAttempt] = useState(0)
  const [metaLoadedAttempt, setMetaLoadedAttempt] = useState(0)
  const [writeError, setWriteError] = useState<string | null>(null)
  const [activeRun, setActiveRun] = useState<ActiveDungeonRun | null>(null)
  const [championAvailability, setChampionAvailability] = useState<
    'loading' | 'available' | 'none' | 'error'
  >(() => characters.service ? 'loading' : 'error')
  const [runLoadState, setRunLoadState] = useState<RunLoadState>('loading')
  const [runLoadError, setRunLoadError] = useState<string | null>(null)
  const [runStartState, setRunStartState] = useState<RunWriteState>('idle')
  const [runStartError, setRunStartError] = useState<string | null>(null)
  const [resumeCheckpoint, setResumeCheckpoint] = useState<GameCheckpoint | null>(null)
  const [terminalCheckpoint, setTerminalCheckpoint] = useState<GameCheckpoint | null>(null)
  const [terminalSaveState, setTerminalSaveState] = useState<RunWriteState>('idle')
  const [terminalSaveError, setTerminalSaveError] = useState<string | null>(null)
  const [championSaveState, setChampionSaveState] = useState<
    'idle' | 'saving' | 'saved' | 'error' | 'roster-full' | 'discarded'
  >('idle')
  const [championSaveError, setChampionSaveError] = useState<string | null>(null)
  /*
   * The roster the results screen offers a choice from, loaded only when a win
   * arrives at a full one. It is the live list rather than anything remembered
   * from the run, because a Champion may have been archived on another device
   * while this one was in the dungeon.
   */
  const [championRoster, setChampionRoster] = useState<ChampionSnapshot[]>([])
  const [adminReports, setAdminReports] = useState<{
    loadState: 'idle' | 'loading' | 'ready' | 'error'
    reports: BugReport[]
    hiddenReportIds: number[]
    error: string | null
  }>({ loadState: 'idle', reports: [], hiddenReportIds: [], error: null })
  const [nicknameModeration, setNicknameModeration] = useState<{
    loadState: 'idle' | 'loading' | 'ready' | 'error'
    requests: NicknameChangeRequest[]
    error: string | null
  }>({ loadState: 'idle', requests: [], error: null })
  const [showHiddenAdminReports, setShowHiddenAdminReports] = useState(false)
  const pendingRunIdRef = useRef<string | null>(null)
  const pendingChampionIdRef = useRef<string | null>(null)

  /*
   * The three screens whose first fetch is state App holds itself: the
   * Essence store and the two admin dashboards. Each of these settles that
   * state and never rejects, so a failure reaches the screen as its own error
   * panel, with its own Retry, rather than as a navigation error.
   */
  const loadAdminReports = useCallback(async (): Promise<void> => {
    const account = authentication.account
    if (!account?.isAdmin) {
      return
    }
    const service = bugReport.service
    if (!service) {
      setAdminReports((current) => ({
        ...current,
        loadState: 'error',
        error: bugReport.configurationError ?? 'Bug reporting is unavailable.',
      }))
      return
    }
    try {
      const [reports, hiddenReportIds] = await Promise.all([
        service.loadAll(),
        repository.getHiddenBugReportIds(account.id),
      ])
      setAdminReports({
        loadState: 'ready',
        reports,
        hiddenReportIds: [...hiddenReportIds],
        error: null,
      })
    } catch (error: unknown) {
      setAdminReports((current) => ({
        ...current,
        loadState: 'error',
        error: errorMessage(error),
      }))
    }
  }, [
    authentication.account,
    bugReport.configurationError,
    bugReport.service,
    repository,
  ])

  const loadNicknameModeration = useCallback(async (): Promise<void> => {
    if (!authentication.account?.isAdmin) {
      return
    }
    const service = nicknameService.service
    if (!service) {
      setNicknameModeration((current) => ({
        ...current,
        loadState: 'error',
        error: nicknameService.configurationError ?? 'Nickname moderation is unavailable.',
      }))
      return
    }
    try {
      const requests = await service.loadPendingChanges()
      setNicknameModeration({ loadState: 'ready', requests, error: null })
    } catch (error: unknown) {
      setNicknameModeration((current) => ({
        ...current,
        loadState: 'error',
        error: errorMessage(error),
      }))
    }
  }, [
    authentication.account,
    nicknameService.configurationError,
    nicknameService.service,
  ])

  const loadStoreSnapshot = useCallback(async (): Promise<void> => {
    const service = metaProgressionService.service
    if (!service || !authentication.account) {
      return
    }
    const requestedAttempt = metaLoadAttempt
    try {
      const snapshot = await service.load()
      setMetaProgression((current) => ({
        ...current,
        loadState: 'ready',
        snapshot,
        error: null,
        purchaseState: 'idle',
        activePurchaseUnlockId: null,
      }))
      setMetaLoadedAttempt(requestedAttempt)
    } catch (error: unknown) {
      setMetaProgression((current) => ({
        ...current,
        loadState: 'error',
        error: errorMessage(error),
      }))
    }
  }, [authentication.account, metaLoadAttempt, metaProgressionService.service])

  /*
   * What "ready to paint" means for a destination: its chunk has arrived and
   * its first fetch has settled, the two fetched in parallel. A screen whose
   * data App owns settles that state here; every other screen's loader hands
   * its result back to be rendered as `initialData`. A signed-out visitor
   * gets the chunk alone, since the screen will show the sign-in gate.
   */
  const prepareScreen = useCallback(async (
    request: ScreenRequest,
  ): Promise<LoadedScreenData | null> => {
    const load = request.screen === 'meta-progression'
      ? loadStoreSnapshot()
      : request.screen === 'admin'
        ? loadAdminReports()
        : request.screen === 'nickname-moderation'
          ? loadNicknameModeration()
          : authentication.account
            ? loadScreenData(request.screen, services)
            : Promise.resolve(null)
    const [, data] = await Promise.all([preloadScreen(request.screen), load])
    return data ?? null
  }, [
    authentication.account,
    loadAdminReports,
    loadNicknameModeration,
    loadStoreSnapshot,
    services,
  ])

  const navigator = useScreenNavigator<LoadedScreenData>({
    initialScreen: typeof window === 'undefined'
      ? 'dashboard'
      : getScreenForPath(window.location.pathname),
    prepare: prepareScreen,
    commit: commitNavigation,
  })
  const { screen, navigate } = navigator

  const navigateToScreen = useCallback((
    nextScreen: AppScreen,
    replace = false,
    path = APP_ROUTE_PATHS[nextScreen],
  ): void => {
    navigate({ screen: nextScreen, path, history: replace ? 'replace' : 'push' })
  }, [navigate])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const routePath = getCanonicalPath(window.location.pathname)
    if (window.location.pathname !== routePath) {
      window.history.replaceState(null, '', routePath)
    }
    const handlePopState = (): void => {
      const nextScreen = getScreenForPath(window.location.pathname)
      if (nextScreen === 'run-setup') {
        setRunMode(getRunModeForPath(window.location.pathname))
      }
      // The browser has already moved. The page is held until the destination
      // is ready, as on any other navigation, and history is left alone.
      navigate({ screen: nextScreen, history: 'none' })
    }
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [navigate])

  /*
   * Warming chunks before they are asked for. Bandwidth only: data is never
   * fetched ahead of a click.
   *
   * Once the hub has painted and the browser is idle, the routes it sends
   * players to most. And once the player is preparing a run, the renderer,
   * which is the largest chunk by far and is about to be needed.
   */
  useEffect(() => {
    if (screen !== 'dashboard' || !authentication.account?.id || typeof window === 'undefined') {
      return
    }
    const warm = (): void => {
      for (const idleScreen of IDLE_PRELOAD_SCREENS) {
        warmScreen(idleScreen)
      }
    }
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(warm)
      return () => {
        window.cancelIdleCallback(handle)
      }
    }
    const handle = window.setTimeout(warm, 1_000)
    return () => {
      window.clearTimeout(handle)
    }
  }, [authentication.account?.id, screen])

  useEffect(() => {
    if (screen === 'run-setup') {
      warmScreen('gameplay')
    }
  }, [screen])

  useEffect(() => {
    if (
      activeRun !== null &&
      navigator.pending === null &&
      (screen === 'run-setup' || screen === 'meta-progression')
    ) {
      // Route guard: an active run must not leave the player stranded on a setup
      // screen. It judges the settled state only: starting a run records the
      // active run and then asks for the dungeon, and while that request is
      // pending the committed screen is still the preparation screen, which
      // is not a player stranded but a player on the way down.
      // navigateToScreen also writes browser history, so this is a sync with an
      // external system (the History API) and not derivable in render.
      // oxlint-disable-next-line react/set-state-in-effect
      navigateToScreen('dashboard', true)
    }
  }, [activeRun, navigateToScreen, navigator.pending, screen])

  useEffect(() => {
    const service = authenticationService.service
    if (!service) {
      return
    }

    let cancelled = false
    const unsubscribe = service.subscribe((account) => {
      if (!cancelled) {
        setAuthentication({ status: 'ready', account, error: null })
      }
    })
    void service
      .getSession()
      .then((account) => {
        if (!cancelled) {
          setAuthentication({ status: 'ready', account, error: null })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setAuthentication({ status: 'error', account: null, error: errorMessage(error) })
        }
      })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [authenticationService])

  useEffect(() => {
    const accountId = authentication.account?.id
    const service = nicknameService.service
    if (!accountId) {
      // Signing out clears the cached nickname before any request is made, so the
      // stale name is never shown against the new (signed-out) account.
      // oxlint-disable-next-line react/set-state-in-effect
      setNickname(EMPTY_ACCOUNT_NICKNAME)
      return
    }
    if (!service) {
      setAuthentication((current) => ({
        ...current,
        error: nicknameService.configurationError ?? 'Nickname settings are unavailable.',
      }))
      return
    }

    let cancelled = false
    void service.loadOwnNickname(accountId)
      .then((loadedNickname) => {
        if (!cancelled) {
          setNickname({
            ...loadedNickname,
            loadedForAccountId: accountId,
            promptOpen: shouldPromptForNickname(loadedNickname) &&
              !hasDismissedNicknamePrompt(accountId),
          })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          // The load has settled, just without an answer: nothing to prompt for.
          setNickname({ ...EMPTY_ACCOUNT_NICKNAME, loadedForAccountId: accountId })
          setAuthentication((current) => ({
            ...current,
            error: `Unable to load nickname settings: ${errorMessage(error)}`,
          }))
        }
      })
    return () => {
      cancelled = true
    }
  }, [
    authentication.account?.id,
    nicknameService.configurationError,
    nicknameService.service,
  ])

  useEffect(() => {
    const accountId = authentication.account?.id
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
  }, [authentication.account?.id, characters.service])

  useEffect(() => {
    let cancelled = false
    void Promise.all([repository.getSettings(), repository.getBasicProfile()])
      .then(async ([loadedSettings, profile]) => {
        const selectedContract = DUNGEON_MAX_FLOOR_CONTRACTS.find(
          (contract) => contract.id === loadedSettings.selectedDungeonMaxFloorContractId,
        )
        const validContract = selectedContract !== undefined &&
          isMaxFloorContractUnlocked(profile, selectedContract.id, 'requiredUnlockId' in selectedContract
            ? selectedContract.requiredUnlockId
            : undefined)
        const settings = validContract
          ? loadedSettings
          : await repository.saveSettings({
              ...loadedSettings,
              selectedDungeonMaxFloorContractId: DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID,
            })
            if (!cancelled) {
              setPersistence({
                loadState: 'ready',
                settings,
                profile,
                error: null,
          })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setPersistence((current) => ({
            ...current,
            loadState: 'error',
            error: errorMessage(error),
          }))
        }
      })

    return () => {
      cancelled = true
    }
  }, [loadAttempt, repository])

  useEffect(() => {
    const accountId = authentication.account?.id
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
    authentication.account?.id,
    dungeonRunPersistence.configurationError,
    dungeonRunPersistence.service,
  ])

  const settings = persistence.settings
  const profile = persistence.profile
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
  const bugReportDungeon = useMemo<BugReportDungeonContext>(() => {
    const dungeonId = activeRun?.dungeonId ?? runConfig?.dungeonId ?? DEFAULT_DUNGEON_ID
    const dungeon = getDungeonDefinition(dungeonId)
    return {
      dungeonId,
      dungeonName: dungeon.name,
      currentFloor: activeRun?.currentFloor ?? 1,
      maxFloor: activeRun?.maxFloor ?? runConfig?.selectedDungeonMaxFloor ?? dungeon.defaultMaxFloor,
      characterClassId: activeRun?.characterClassId ?? runConfig?.characterClassId ?? 'knight',
      worldModifierIds: runConfig?.worldModifierIds ?? [],
      runId: activeRun?.runId,
    }
  }, [activeRun, runConfig])
  useMusicPlaylist(getMusicPlaylistId(screen, runConfig?.modeId ?? runMode))

  const persistSettings = useCallback(
    async (patch: SettingsPatch): Promise<void> => {
      try {
        const next = await repository.saveSettings(patch)
        setPersistence((current) => ({ ...current, settings: next }))
        setWriteError(null)
      } catch (error: unknown) {
        const message = errorMessage(error)
        setWriteError(message)
        throw error
      }
    },
    [repository],
  )

  const selectBehaviorProfile = useCallback(
    (profileId: BehaviorProfileId): void => {
      void persistSettings({ selectedBehaviorProfileId: profileId }).catch(() => {
        // persistSettings already exposes this error in the UI.
      })
    },
    [persistSettings],
  )

  /*
   * Changing the priority mid-run also changes what the next run starts with,
   * exactly as the behavior profile behaves. It is how the character fights,
   * not how it fought once.
   */
  const selectTargetPriority = useCallback(
    (priorityId: TargetPriorityId): void => {
      void persistSettings({ selectedTargetPriorityId: priorityId }).catch(() => {
        // persistSettings already exposes this error in the UI.
      })
    },
    [persistSettings],
  )

  const updateKeybinds = useCallback(
    async (keybinds: GameKeybinds): Promise<void> => {
      await persistSettings({ keybinds })
    },
    [persistSettings],
  )

  const submitBugReport = useCallback(async (
    description: string,
    image: BugReportImage | undefined,
    dungeon: BugReportDungeonContext,
  ): Promise<void> => {
    if (!authentication.account) {
      throw new Error('Sign in before submitting a bug report.')
    }
    if (!bugReport.service) {
      throw new Error(bugReport.configurationError ?? 'Bug reporting is unavailable.')
    }
    await bugReport.service.submit({
      userId: authentication.account.id,
      username: getPlayerDisplayName({
        approvedNickname: nickname.displayName,
        providerDisplayName: authentication.account.displayName,
        email: authentication.account.email,
      }),
      description,
      image,
      dungeon,
    })
    showToast(
      'Thank you for submitting a bug report! Erling will remember this during The Purge.',
      'info',
    )
  }, [
    authentication.account,
    bugReport.configurationError,
    bugReport.service,
    nickname.displayName,
    showToast,
  ])

  const requestNicknameChange = useCallback(async (requestedNickname: string): Promise<void> => {
    if (!authentication.account) {
      throw new Error('Sign in before changing your nickname.')
    }
    if (!nicknameService.service) {
      throw new Error(nicknameService.configurationError ?? 'Nickname settings are unavailable.')
    }
    await nicknameService.service.requestChange(requestedNickname)
    setNickname((current) => ({
      ...current,
      pendingNickname: requestedNickname,
      hasRequestedNickname: true,
      promptOpen: false,
    }))
    showToast('Nickname submitted for moderator review.', 'info')
  }, [
    authentication.account,
    nicknameService.configurationError,
    nicknameService.service,
    showToast,
  ])

  const dismissNicknamePrompt = useCallback((): void => {
    if (authentication.account) {
      rememberNicknamePromptDismissed(authentication.account.id)
    }
    setNickname((current) => ({ ...current, promptOpen: false }))
  }, [authentication.account])

  /*
   * Exposed on the shell for the tooling that signs in as the test account: it
   * can tell a prompt that is still to come from one that will not come.
   */
  const nicknamePromptStatus = !authentication.account
    ? 'closed'
    : nickname.loadedForAccountId !== authentication.account.id
      ? 'loading'
      : nickname.promptOpen
        ? 'open'
        : 'closed'

  const refreshMetaProgression = useCallback((): void => {
    setMetaProgression((current) => ({
      ...current,
      loadState: 'loading',
      error: null,
    }))
    setMetaLoadAttempt((attempt) => attempt + 1)
  }, [])

  const openMetaProgression = useCallback((): void => {
    if (!authentication.account || runLoadState !== 'ready') {
      return
    }
    if (activeRun !== null) {
      showToast('Finish or forfeit your current dungeon run before opening the store.', 'error')
      return
    }
    navigateToScreen('meta-progression')
  }, [activeRun, authentication.account, navigateToScreen, runLoadState, showToast])

  const openRunSetup = useCallback((): void => {
    if (!authentication.account || runLoadState !== 'ready') {
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
  }, [activeRun, authentication.account, navigateToScreen, runLoadState, showToast])

  const openAbyssSetup = useCallback((): void => {
    if (!authentication.account || runLoadState !== 'ready') {
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
  }, [activeRun, authentication.account, navigateToScreen, runLoadState, showToast])

  const closeRunSetup = useCallback((): void => {
    navigateToScreen('dashboard', true)
  }, [navigateToScreen])

  const closeMetaProgression = useCallback((): void => {
    navigateToScreen('dashboard', true)
  }, [navigateToScreen])

  const signIn = useCallback(
    async (
      email: string,
      password: string,
      options?: SignInOptions,
    ): Promise<boolean> => {
      const service = authenticationService.service
      if (!service) {
        setAuthentication({
          status: 'unavailable',
          account: null,
          error: authenticationService.configurationError ?? 'Authentication unavailable.',
        })
        return false
      }
      try {
        const account = await service.signInWithPassword(email, password, options)
        setAuthentication({ status: 'ready', account, error: null })
        setMetaLoadAttempt((attempt) => attempt + 1)
        return true
      } catch (error: unknown) {
        setAuthentication({ status: 'error', account: null, error: errorMessage(error) })
        return false
      }
    },
    [authenticationService],
  )

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      options?: SignInOptions,
    ): Promise<SignUpResult | null> => {
      const service = authenticationService.service
      if (!service) {
        setAuthentication({
          status: 'unavailable',
          account: null,
          error: authenticationService.configurationError ?? 'Authentication unavailable.',
        })
        return null
      }
      try {
        const result = await service.signUpWithPassword(email, password, options)
        if (result.account) {
          setAuthentication({ status: 'ready', account: result.account, error: null })
          setMetaLoadAttempt((attempt) => attempt + 1)
        } else {
          setAuthentication({ status: 'ready', account: null, error: null })
        }
        return result
      } catch (error: unknown) {
        setAuthentication({ status: 'error', account: null, error: errorMessage(error) })
        return null
      }
    },
    [authenticationService],
  )

  const signInWithDiscord = useCallback(
    async (options?: SignInOptions): Promise<boolean> => {
      const service = authenticationService.service
      if (!service) {
        setAuthentication({
          status: 'unavailable',
          account: null,
          error: authenticationService.configurationError ?? 'Authentication unavailable.',
        })
        return false
      }
      try {
        await service.signInWithDiscord(options)
        return true
      } catch (error: unknown) {
        setAuthentication({ status: 'error', account: null, error: errorMessage(error) })
        return false
      }
    },
    [authenticationService],
  )

  const signOut = useCallback(async (): Promise<boolean> => {
    const service = authenticationService.service
    if (!service) {
      setAuthentication({
        status: 'unavailable',
        account: null,
        error: authenticationService.configurationError ?? 'Authentication unavailable.',
      })
      return false
    }
    try {
      await service.signOut()
      setAuthentication({ status: 'ready', account: null, error: null })
      pendingRunIdRef.current = null
      setMetaProgression(createInitialMetaProgressionState(
        metaProgressionService.service,
        metaProgressionService.configurationError,
      ))
      setMetaLoadAttempt(0)
      setMetaLoadedAttempt(0)
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
      setAdminReports({
        loadState: 'idle',
        reports: [],
        hiddenReportIds: [],
        error: null,
      })
      setNicknameModeration({ loadState: 'idle', requests: [], error: null })
      setShowHiddenAdminReports(false)
      navigateToScreen('dashboard', true)
      return true
    } catch (error: unknown) {
      setAuthentication((current) => ({
        ...current,
        status: 'error',
        error: errorMessage(error),
      }))
      return false
    }
  }, [
    authenticationService,
    metaProgressionService.configurationError,
    metaProgressionService.service,
    navigateToScreen,
  ])

  const selectCharacterClass = useCallback(
    (characterClassId: CharacterClassId): void => {
      void persistSettings({ selectedCharacterClassId: characterClassId }).catch(() => {
        // persistSettings already exposes this error in the UI.
      })
    },
    [persistSettings],
  )

  const toggleWorldModifier = useCallback(
    (modifierId: WorldModifierId): void => {
      if (!settings) {
        return
      }
      const selected = settings.selectedWorldModifierIds.includes(modifierId)
      void persistSettings({
        selectedWorldModifierIds: normalizeWorldModifierIds(
          selected
            ? settings.selectedWorldModifierIds.filter((id) => id !== modifierId)
            : [...settings.selectedWorldModifierIds, modifierId],
        ),
      }).catch(() => {
        // persistSettings already exposes this error in the UI.
      })
    },
    [persistSettings, settings],
  )

  const startRun = useCallback(async (
    options: StartRunOptions = {},
  ): Promise<void> => {
    const service = dungeonRunPersistence.service
    if (
      !authentication.account ||
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
    activeRun,
    authentication.account,
    dungeonRunPersistence.service,
    navigateToScreen,
    runChampion,
    runChampionId,
    runConfig,
    runLoadState,
    runMode,
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
    if (!service || !authentication.account) {
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
  }, [authentication.account, metaProgressionService.service])

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

  const purchaseUnlock = useCallback(async (unlockId: string): Promise<void> => {
    if (activeRun !== null) {
      showToast('Finish or forfeit your current dungeon run before purchasing upgrades.', 'error')
      return
    }
    if (runLoadState !== 'ready') {
      showToast('Dungeon run status is still loading. Try again in a moment.', 'error')
      return
    }
    if (!metaProgressionService.service || !authentication.account) {
      return
    }
    const snapshot = metaProgression.snapshot
    if (!snapshot) {
      return
    }
    const definition = snapshot.definitions.find((candidate) => candidate.id === unlockId)
    if (!definition) {
      showToast(`Unknown unlock definition: ${unlockId}`, 'error')
      return
    }
    setMetaProgression((current) => ({
      ...current,
      purchaseState: 'purchasing',
      activePurchaseUnlockId: unlockId,
    }))
    try {
      const nextSnapshot = await metaProgressionService.service.purchaseUnlock(unlockId)
      setMetaProgression((current) => ({
        ...current,
        snapshot: nextSnapshot,
        purchaseState: 'idle',
        activePurchaseUnlockId: null,
      }))
    } catch (error: unknown) {
      setMetaProgression((current) => ({
        ...current,
        purchaseState: 'idle',
        activePurchaseUnlockId: null,
      }))
      showToast(`Unable to purchase upgrade: ${errorMessage(error)}`, 'error')
    }
  }, [
    activeRun,
    authentication.account,
    metaProgression.snapshot,
    metaProgressionService.service,
    runLoadState,
    showToast,
  ])

  const purchaseReroll = useCallback(async (): Promise<void> => {
    if (activeRun !== null) {
      showToast('Finish or forfeit your current dungeon run before purchasing rerolls.', 'error')
      return
    }
    if (runLoadState !== 'ready') {
      showToast('Dungeon run status is still loading. Try again in a moment.', 'error')
      return
    }
    if (!metaProgressionService.service || !authentication.account || !metaProgression.snapshot) {
      showToast('Meta progression is unavailable.', 'error')
      return
    }
    setMetaProgression((current) => ({
      ...current,
      purchaseState: 'purchasing',
      activePurchaseUnlockId: 'reroll',
    }))
    try {
      const nextSnapshot = await metaProgressionService.service.purchaseReroll()
      setMetaProgression((current) => ({
        ...current,
        snapshot: nextSnapshot,
        purchaseState: 'idle',
        activePurchaseUnlockId: null,
      }))
    } catch (error: unknown) {
      setMetaProgression((current) => ({
        ...current,
        purchaseState: 'idle',
        activePurchaseUnlockId: null,
      }))
      showToast(`Unable to purchase reroll: ${errorMessage(error)}`, 'error')
    }
  }, [
    activeRun,
    authentication.account,
    metaProgression.snapshot,
    metaProgressionService.service,
    runLoadState,
    showToast,
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

  const openFishing = useCallback((): void => {
    navigateToScreen('fishing')
  }, [navigateToScreen])

  const openCamp = useCallback((): void => {
    navigateToScreen('camp')
  }, [navigateToScreen])

  const openChampions = useCallback((): void => {
    navigateToScreen('champions')
  }, [navigateToScreen])

  const openInventory = useCallback((): void => {
    navigateToScreen('inventory')
  }, [navigateToScreen])

  const openShop = useCallback((): void => {
    navigateToScreen('shop')
  }, [navigateToScreen])

  const openRunHistory = useCallback((): void => {
    navigateToScreen('run-history')
  }, [navigateToScreen])

  const openAdmin = useCallback((): void => {
    if (!authentication.account?.isAdmin) {
      showToast('Administrator access is required.', 'error')
      return
    }
    navigateToScreen('admin')
  }, [authentication.account, navigateToScreen, showToast])

  const openNicknameModeration = useCallback((): void => {
    if (!authentication.account?.isAdmin) {
      showToast('Administrator access is required.', 'error')
      return
    }
    navigateToScreen('nickname-moderation')
  }, [authentication.account, navigateToScreen, showToast])

  const closeAdmin = useCallback((): void => {
    navigateToScreen('dashboard', true)
  }, [navigateToScreen])

  const refreshAdminReports = useCallback((): void => {
    setAdminReports((current) => ({ ...current, loadState: 'loading', error: null }))
    void loadAdminReports()
  }, [loadAdminReports])

  /*
   * A navigation fetches the dashboard's data before it commits. Arriving by
   * URL, or after a sign-out reset it, skips that, and the fetch happens here
   * instead: only while nothing has been fetched, so a navigation that has
   * already done the work is not repeated.
   */
  useEffect(() => {
    if (
      screen === 'admin' &&
      authentication.account?.isAdmin &&
      adminReports.loadState === 'idle'
    ) {
      // The fetch is imperative and cannot be derived during render.
      // oxlint-disable-next-line react/set-state-in-effect
      refreshAdminReports()
    }
  }, [adminReports.loadState, authentication.account, refreshAdminReports, screen])

  const refreshNicknameModeration = useCallback((): void => {
    setNicknameModeration((current) => ({ ...current, loadState: 'loading', error: null }))
    void loadNicknameModeration()
  }, [loadNicknameModeration])

  useEffect(() => {
    if (
      screen === 'nickname-moderation' &&
      authentication.account?.isAdmin &&
      nicknameModeration.loadState === 'idle'
    ) {
      // oxlint-disable-next-line react/set-state-in-effect
      refreshNicknameModeration()
    }
  }, [authentication.account, nicknameModeration.loadState, refreshNicknameModeration, screen])

  const toggleBugReportHidden = useCallback(async (
    reportId: number,
    hidden: boolean,
  ): Promise<void> => {
    const userId = authentication.account?.id
    if (!userId) {
      return
    }
    try {
      await repository.setBugReportHidden(userId, reportId, !hidden)
      setAdminReports((current) => ({
        ...current,
        hiddenReportIds: hidden
          ? current.hiddenReportIds.filter((id) => id !== reportId)
          : current.hiddenReportIds.includes(reportId)
            ? current.hiddenReportIds
            : [...current.hiddenReportIds, reportId],
      }))
    } catch (error: unknown) {
      showToast(`Unable to update bug report visibility: ${errorMessage(error)}`, 'error')
    }
  }, [authentication.account, repository, showToast])

  const softDeleteBugReport = useCallback(async (reportId: number): Promise<void> => {
    if (!authentication.account?.isAdmin) {
      showToast('Administrator access is required.', 'error')
      return
    }
    if (!bugReport.service) {
      showToast(
        `Unable to delete bug report: ${bugReport.configurationError ?? 'Bug reporting is unavailable.'}`,
        'error',
      )
      return
    }
    try {
      await bugReport.service.softDelete(reportId)
      setAdminReports((current) => ({
        ...current,
        reports: current.reports.filter((report) => report.id !== reportId),
        hiddenReportIds: current.hiddenReportIds.filter((id) => id !== reportId),
      }))
      showToast('Bug report deleted.', 'info')
    } catch (error: unknown) {
      showToast(`Unable to delete bug report: ${errorMessage(error)}`, 'error')
    }
  }, [
    authentication.account,
    bugReport.configurationError,
    bugReport.service,
    showToast,
  ])

  const loadBugReportFloorSnapshot = useCallback(async (
    snapshotId: number,
  ): Promise<BugReportFloorSnapshot> => {
    if (!authentication.account?.isAdmin) {
      throw new Error('Administrator access is required.')
    }
    if (!bugReport.service) {
      throw new Error(bugReport.configurationError ?? 'Bug reporting is unavailable.')
    }
    return bugReport.service.loadFloorSnapshot(snapshotId)
  }, [
    authentication.account,
    bugReport.configurationError,
    bugReport.service,
  ])

  const reviewNicknameChange = useCallback(async (
    requestId: number,
    approve: boolean,
  ): Promise<void> => {
    try {
      if (!authentication.account?.isAdmin) {
        throw new Error('Administrator access is required.')
      }
      if (!nicknameService.service) {
        throw new Error(nicknameService.configurationError ?? 'Nickname settings are unavailable.')
      }
      await nicknameService.service.reviewChange(requestId, approve)
      setNicknameModeration((current) => ({
        ...current,
        requests: current.requests.filter((request) => request.id !== requestId),
      }))
      showToast(approve ? 'Nickname approved.' : 'Nickname rejected.', 'info')
    } catch (error: unknown) {
      showToast(`Unable to review nickname: ${errorMessage(error)}`, 'error')
    }
  }, [
    authentication.account,
    nicknameService.configurationError,
    nicknameService.service,
    showToast,
  ])


  useEffect(() => {
    const service = metaProgressionService.service
    if (!authentication.account) {
      return
    }
    if (!service || screen === 'gameplay') {
      return
    }
    if (metaProgression.loadState === 'ready' && metaProgression.snapshot !== null && metaLoadAttempt === metaLoadedAttempt) {
      return
    }
    let cancelled = false
    const requestedAttempt = metaLoadAttempt
    void service.load()
      .then((snapshot) => {
        if (!cancelled) {
          setMetaProgression((current) => ({
            ...current,
            loadState: 'ready',
            snapshot,
            error: null,
            purchaseState: 'idle',
            activePurchaseUnlockId: null,
          }))
          setMetaLoadedAttempt(requestedAttempt)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMetaProgression((current) => ({
            ...current,
            loadState: 'error',
            error: errorMessage(error),
          }))
        }
      })
    return () => {
      cancelled = true
    }
  }, [
    authentication.account,
    metaLoadAttempt,
    metaLoadedAttempt,
    metaProgression.loadState,
    metaProgression.snapshot,
    metaProgressionService.service,
    screen,
  ])

  const navigationHints = useMemo<NavigationHints>(() => ({
    pendingScreen: navigator.pending,
    warmScreen,
  }), [navigator.pending])
  /*
   * While a destination loads, the page underneath is frozen: `inert` on the
   * shell takes the pointer and the keyboard away from it, and the veil makes
   * the freeze visible after 150 ms. The attribute is for the stylesheet and
   * for tooling that wants to know a navigation is in flight.
   */
  const shellPending = navigator.pending !== null
  const shellNavigation = shellPending ? 'pending' : 'settled'
  /** The committed screen's loader result, if it is the screen being rendered. */
  const loadedData = <S extends LoadedScreen>(target: S): ScreenLoaderResults[S] | undefined =>
    navigator.data?.screen === target
      ? (navigator.data.data as ScreenLoaderResults[S])
      : undefined

  if (screen === 'wiki') {
    return (
      <main
        className="app-shell app-shell-document"
        inert={shellPending}
        data-navigation={shellNavigation}
      >
        <AppHeader
          authentication={authentication}
          nickname={nickname}
          onRequestNicknameChange={requestNicknameChange}
          onSignOut={signOut}
          onNavigateToDashboard={returnToDashboard}
          onOpenAdmin={openAdmin}
          onOpenNicknameModeration={openNicknameModeration}
          onOpenFishing={openFishing}
          onOpenCamp={openCamp}
          onOpenChampions={openChampions}
          onOpenInventory={openInventory}
          onOpenShop={openShop}
          onOpenRunHistory={openRunHistory}
          inventoryService={inventory.service}
          characterService={characters.service}
          bugReportDungeon={bugReportDungeon}
          onSubmitBugReport={(description, image) => submitBugReport(description, image, bugReportDungeon)}
          navigation={navigationHints}
        />
        <LazyScreen label="The wiki">
          <LazyWikiScreen
            appVersion={APP_VERSION}
            onReturnToApp={() => navigateToScreen('dashboard')}
          />
        </LazyScreen>
        <NavigationVeil pending={navigator.pending} />
      </main>
    )
  }

  if (persistence.loadState === 'loading') {
    return (
      <main className="app-shell" inert={shellPending} data-navigation={shellNavigation}>
        <AppHeader
          authentication={authentication}
          nickname={nickname}
          onRequestNicknameChange={requestNicknameChange}
          onSignOut={signOut}
          onNavigateToDashboard={returnToDashboard}
          onOpenAdmin={openAdmin}
          onOpenNicknameModeration={openNicknameModeration}
          onOpenFishing={openFishing}
          onOpenCamp={openCamp}
          onOpenChampions={openChampions}
          onOpenInventory={openInventory}
          onOpenShop={openShop}
          onOpenRunHistory={openRunHistory}
          inventoryService={inventory.service}
          characterService={characters.service}
          bugReportDungeon={bugReportDungeon}
          onSubmitBugReport={(description, image) => submitBugReport(description, image, bugReportDungeon)}
          navigation={navigationHints}
        />
        <section className="dashboard" aria-labelledby="persistence-loading-title">
          <div className="dashboard-panel" role="status">
            <p className="screen-kicker">Local persistence</p>
            <h2 id="persistence-loading-title">Loading saved run settings…</h2>
            <p>Opening your local profile and saved run settings.</p>
          </div>
        </section>
        <NavigationVeil pending={navigator.pending} />
      </main>
    )
  }

  if (persistence.loadState === 'error' || !settings || !profile || !runConfig) {
    return (
      <main className="app-shell" inert={shellPending} data-navigation={shellNavigation}>
        <AppHeader
          authentication={authentication}
          nickname={nickname}
          onRequestNicknameChange={requestNicknameChange}
          onSignOut={signOut}
          onNavigateToDashboard={returnToDashboard}
          onOpenAdmin={openAdmin}
          onOpenNicknameModeration={openNicknameModeration}
          onOpenFishing={openFishing}
          onOpenCamp={openCamp}
          onOpenChampions={openChampions}
          onOpenInventory={openInventory}
          onOpenShop={openShop}
          onOpenRunHistory={openRunHistory}
          inventoryService={inventory.service}
          characterService={characters.service}
          bugReportDungeon={bugReportDungeon}
          onSubmitBugReport={(description, image) => submitBugReport(description, image, bugReportDungeon)}
          navigation={navigationHints}
        />
        <section className="dashboard" aria-labelledby="persistence-error-title">
          <div className="dashboard-panel" role="alert">
            <p className="screen-kicker">Local persistence error</p>
            <h2 id="persistence-error-title">Saved settings unavailable</h2>
            <p>{persistence.error ?? 'Unable to load local persistence.'}</p>
            <button
              className="primary-action"
              type="button"
              onClick={() => {
                setPersistence((current) => ({
                  ...current,
                  loadState: 'loading',
                  error: null,
                }))
                setLoadAttempt((attempt) => attempt + 1)
              }}
            >
              Retry
            </button>
          </div>
        </section>
        <NavigationVeil pending={navigator.pending} />
      </main>
    )
  }

  return (
    <main
      className={`app-shell${
        screen === 'gameplay'
          ? ' app-shell-gameplay'
          : screen === 'fishing'
            ? ' app-shell-fishing'
            : screen === 'camp'
              ? ' app-shell-camp'
              : screen === 'dashboard'
                ? ' app-shell-hub'
                : ''
      }${DOCUMENT_SCREENS.has(screen) ? ' app-shell-document' : ''}`}
      data-nickname-prompt={nicknamePromptStatus}
      data-navigation={shellNavigation}
      inert={shellPending}
    >
      {screen !== 'gameplay' && nickname.promptOpen && authentication.account ? (
        // A run in progress is not interrupted; the prompt waits for the
        // player to come back out of the dungeon.
        <NicknameDialog
          title="Choose a nickname"
          description="Pick the name other players will see. Nicknames are reviewed before appearing publicly, so offensive or hateful names cannot be published. You can change it later from account settings."
          inputLabel="Nickname"
          initialValue=""
          pendingNickname={null}
          cancelLabel="Skip for now"
          submitLabel="Submit for review"
          onCancel={dismissNicknamePrompt}
          onSubmit={requestNicknameChange}
        />
      ) : null}
      {screen !== 'gameplay' ? (
        <AppHeader
          authentication={authentication}
          nickname={nickname}
          onRequestNicknameChange={requestNicknameChange}
          onSignOut={signOut}
          onNavigateToDashboard={returnToDashboard}
          onOpenAdmin={openAdmin}
          onOpenNicknameModeration={openNicknameModeration}
          onOpenFishing={openFishing}
          onOpenCamp={openCamp}
          onOpenChampions={openChampions}
          onOpenInventory={openInventory}
          onOpenShop={openShop}
          onOpenRunHistory={openRunHistory}
          inventoryService={inventory.service}
          characterService={characters.service}
          bugReportDungeon={bugReportDungeon}
          onSubmitBugReport={(description, image) => submitBugReport(description, image, bugReportDungeon)}
          navigation={navigationHints}
        />
      ) : null}
      {screen === 'dashboard' && authentication.account ? (
        <GameDashboard
          accountId={authentication.account.id}
          approvedNickname={nickname.displayName}
          providerDisplayName={authentication.account.displayName}
          email={authentication.account.email}
          essenceBalance={metaProgression.snapshot?.wallet.essenceBalance ?? null}
          presenceService={hubPresence.service}
          presenceConfigurationError={hubPresence.configurationError}
          leaderboardService={abyssLeaderboard.service}
          leaderboardConfigurationError={abyssLeaderboard.configurationError}
          activeRun={activeRun}
          runLoadState={runLoadState}
          runLoadError={runLoadError}
          onOpenMetaProgression={openMetaProgression}
          onOpenFishing={openFishing}
          onOpenCamp={openCamp}
          onOpenChampions={openChampions}
          onOpenInventory={openInventory}
          onOpenShop={openShop}
          onOpenRunHistory={openRunHistory}
          onOpenAbyss={openAbyssSetup}
          championAvailability={championAvailability}
          onOpenRunSetup={openRunSetup}
          onContinueRun={continueRun}
          onForfeitRun={forfeitActiveRun}
          navigation={navigationHints}
        />
      ) : null}
      {screen === 'admin' && authentication.account?.isAdmin ? (
        <LazyScreen label="Bug reports">
          <LazyAdminReportsScreen
            reports={adminReports.reports}
            hiddenReportIds={new Set(adminReports.hiddenReportIds)}
            showHidden={showHiddenAdminReports}
            loadState={adminReports.loadState === 'idle' ? 'loading' : adminReports.loadState}
            error={adminReports.error}
            onBack={closeAdmin}
            onRefresh={refreshAdminReports}
            onToggleShowHidden={() => { setShowHiddenAdminReports((current) => !current) }}
            onToggleHide={(reportId, hidden) => { void toggleBugReportHidden(reportId, hidden) }}
            onDelete={(reportId) => { void softDeleteBugReport(reportId) }}
            onLoadFloorSnapshot={loadBugReportFloorSnapshot}
          />
        </LazyScreen>
      ) : null}
      {screen === 'nickname-moderation' && authentication.account?.isAdmin ? (
        <LazyScreen label="Nickname moderation">
          <LazyNicknameModerationScreen
            requests={nicknameModeration.requests}
            loadState={nicknameModeration.loadState === 'idle' ? 'loading' : nicknameModeration.loadState}
            error={nicknameModeration.error}
            onBack={closeAdmin}
            onRefresh={refreshNicknameModeration}
            onReview={(requestId, approve) => {
              void reviewNicknameChange(requestId, approve)
            }}
          />
        </LazyScreen>
      ) : null}
      {(screen === 'admin' || screen === 'nickname-moderation') &&
      (!authentication.account || !authentication.account.isAdmin) ? (
        <section className="dashboard" aria-labelledby="admin-access-title">
          <div className="dashboard-panel" role="alert">
            <p className="screen-kicker">Restricted route</p>
            <h2 id="admin-access-title">Administrator access required</h2>
            <p>Only administrator accounts can view moderation tools.</p>
            <button className="secondary-action" type="button" onClick={closeAdmin}>
              Back to dashboard
            </button>
          </div>
        </section>
      ) : null}
      {(screen === 'dashboard' || screen === 'run-setup' || screen === 'meta-progression' || screen === 'fishing' || screen === 'camp' || screen === 'champions' || screen === 'inventory' || screen === 'run-history') &&
      !authentication.account ? (
        <AuthGateway
          authentication={authentication}
          onSignIn={signIn}
          onSignUp={signUp}
          onSignInWithDiscord={signInWithDiscord}
          onSignOut={signOut}
        />
      ) : null}
      {screen === 'run-setup' && authentication.account ? (
        <LazyScreen label={SCREEN_DEFINITIONS['run-setup'].label}>
          <LazyRunSetupScreen
            initialData={loadedData('run-setup')}
            initialLoadError={navigator.loadError}
            settings={settings}
            writeError={writeError ?? runStartError}
            startState={runStartState}
            inventoryService={inventory.service}
            inventoryError={inventory.configurationError}
            characterService={characters.service}
            characterError={characters.configurationError}
            campService={camp.service}
            maximumDungeonFloor={metaProgression.snapshot?.dungeonMaxFloor ?? DEFAULT_DUNGEON_CONFIG.defaultMaxFloor}
            artifactSlotCount={metaProgression.snapshot?.artifactSlotCount ?? DEFAULT_ARTIFACT_SLOT_COUNT}
            initialMode={runMode}
            onStart={startRun}
            onSelectCharacterClass={selectCharacterClass}
            onToggleWorldModifier={toggleWorldModifier}
            onSelectTargetPriority={selectTargetPriority}
            onBack={closeRunSetup}
          />
        </LazyScreen>
      ) : null}
      {screen === 'meta-progression' && authentication.account ? (
        <LazyScreen label="The essence store">
          <LazyMetaProgressionScreen
            snapshot={metaProgression.snapshot}
            loadState={metaProgression.loadState}
            loadError={metaProgression.error}
            purchaseState={metaProgression.purchaseState}
            activePurchaseUnlockId={metaProgression.activePurchaseUnlockId}
            onBack={closeMetaProgression}
            onRefresh={refreshMetaProgression}
            onPurchaseUnlock={(unlockId) => { void purchaseUnlock(unlockId) }}
            onPurchaseReroll={() => { void purchaseReroll() }}
          />
        </LazyScreen>
      ) : null}
      {screen === 'fishing' && authentication.account ? (
        <LazyScreen label={SCREEN_DEFINITIONS.fishing.label}>
          <LazyFishingScreen
            initialData={loadedData('fishing')}
            initialLoadError={navigator.loadError}
            fishingService={fishing.service}
            inventoryService={inventory.service}
            lootBoxService={lootBoxes.service}
            configurationError={fishing.configurationError ?? inventory.configurationError}
            activityPlayerId={authentication.account.id}
            activityPlayerApprovedNickname={nickname.displayName}
            activityPlayerProviderName={authentication.account.displayName}
            activityPlayerEmail={authentication.account.email}
          />
        </LazyScreen>
      ) : null}
      {screen === 'camp' && authentication.account ? (
        <LazyScreen label={SCREEN_DEFINITIONS.camp.label}>
          <LazyCampScreen
            initialData={loadedData('camp')}
            initialLoadError={navigator.loadError}
            service={camp.service}
            configurationError={camp.configurationError}
            characterService={characters.service}
            inventoryService={inventory.service}
            developmentToolsEnabled={DEVELOPMENT_TOOLS_ENABLED && (authentication.account?.isAdmin ?? false)}
            onBack={returnToDashboard}
          />
        </LazyScreen>
      ) : null}
      {screen === 'champions' && authentication.account ? (
        <LazyScreen label={SCREEN_DEFINITIONS.champions.label}>
          <LazyChampionManagementScreen
            initialData={loadedData('champions')}
            initialLoadError={navigator.loadError}
            service={characters.service}
            inventoryService={inventory.service}
            inventoryError={inventory.configurationError}
            campService={camp.service}
            configurationError={characters.configurationError}
            onBack={returnToDashboard}
          />
        </LazyScreen>
      ) : null}
      {screen === 'inventory' && authentication.account ? (
        <LazyScreen label={SCREEN_DEFINITIONS.inventory.label}>
          <LazyInventoryScreen
            initialData={loadedData('inventory')}
            initialLoadError={navigator.loadError}
            inventoryService={inventory.service}
            lootBoxService={lootBoxes.service}
            configurationError={lootBoxes.configurationError ?? inventory.configurationError}
            onBack={returnToDashboard}
          />
        </LazyScreen>
      ) : null}
      {screen === 'shop' && authentication.account ? (
        <LazyScreen label={SCREEN_DEFINITIONS.shop.label}>
          <LazyShopScreen
            initialData={loadedData('shop')}
            initialLoadError={navigator.loadError}
            shopService={shop.service}
            inventoryService={inventory.service}
            configurationError={shop.configurationError ?? inventory.configurationError}
            onBack={returnToDashboard}
            onEssenceChanged={refreshMetaProgression}
          />
        </LazyScreen>
      ) : null}
      {screen === 'run-history' && authentication.account ? (
        <LazyScreen label={SCREEN_DEFINITIONS['run-history'].label}>
          <LazyRunChronicleScreen
            initialData={loadedData('run-history')}
            initialLoadError={navigator.loadError}
            service={dungeonRunPersistence.service}
            configurationError={dungeonRunPersistence.configurationError}
            onBack={returnToDashboard}
          />
        </LazyScreen>
      ) : null}
      {screen === 'gameplay' ? (
        <LazyScreen label="The dungeon run">
          <LazyGameCanvas
            key={runId}
            runConfig={runConfig}
            initialCheckpoint={resumeCheckpoint}
            onRunEnd={handleRunEnd}
            onFloorCheckpoint={saveFloorCheckpoint}
            onSaveAndQuit={saveAndQuitRun}
            onBehaviorProfileChange={selectBehaviorProfile}
            onTargetPriorityChange={selectTargetPriority}
            keybinds={settings?.keybinds ?? DEFAULT_GAME_KEYBINDS}
            onKeybindsChange={updateKeybinds}
            reportBugRunId={activeRunSubmission?.runId}
            onSubmitBugReport={submitBugReport}
            developmentToolsEnabled={DEVELOPMENT_TOOLS_ENABLED && (authentication.account?.isAdmin ?? false)}
          />
        </LazyScreen>
      ) : null}
      {screen === 'results' && result ? (
        <ResultsScreen
          result={result}
          runReward={runReward}
          terminalSaveState={terminalSaveState}
          terminalSaveError={terminalSaveError}
          championSaveState={championSaveState}
          championSaveError={championSaveError}
          championConfigurationError={characters.configurationError}
          championRoster={championRoster}
          onSaveChampion={saveChampion}
          onReplaceChampion={(replacedChampionId) =>
            saveChampion(DEFAULT_CHAMPION_NAME, undefined, replacedChampionId)}
          onDiscardChampion={() => {
            pendingChampionIdRef.current = null
            setChampionSaveState('discarded')
            setChampionSaveError(null)
            releaseUnclaimedArtifacts()
          }}
          onReturn={returnToDashboard}
          onRetryTerminalSave={retryTerminalSave}
          onRetryReward={() => {
            if (activeRunSubmission) {
              void submitRunReward(activeRunSubmission)
            }
          }}
        />
      ) : null}
      <NavigationVeil pending={navigator.pending} />
    </main>
  )
}

export default App
