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
} from './game'
import {
  type SettingsPatch,
  type ActiveDungeonRun,
} from './persistence'
import { DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID } from './persistence'
import {
  getPlayerDisplayName,
  type AuthenticationState,
  type NicknameChangeRequest,
  type NicknameState,
  type SignInOptions,
  type SignUpResult,
} from './auth'
import {
  type MetaRunResultInput,
} from './meta'
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
  LazyChampionManagementScreen,
  LazyFishingScreen,
  LazyGameCanvas,
  LazyInventoryScreen,
  LazyMetaProgressionScreen,
  LazyNicknameModerationScreen,
  LazyRunSetupScreen,
  LazyWikiScreen,
} from './app/lazyScreens'
import { LazyScreen } from './app/LazyScreen'
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
  type CharacterBuildSnapshot,
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

function App() {
  const { showToast } = useToaster()
  const [screen, setScreen] = useState<AppScreen>(() =>
    typeof window === 'undefined' ? 'dashboard' : getScreenForPath(window.location.pathname),
  )
  const services = useServices()
  const {
    repository,
    authentication: authenticationService,
    nickname: nicknameService,
    meta: metaProgressionService,
    characters,
    essenceLeaderboard,
    dungeonRunPersistence,
    inventory,
    lootBoxes,
    fishing,
    hubPresence,
    bugReport,
  } = services
  const [authentication, setAuthentication] = useState<AuthenticationState>(() =>
    createInitialAuthenticationState(
      authenticationService.service,
      authenticationService.configurationError,
    ),
  )
  const [nickname, setNickname] = useState<NicknameState>({
    displayName: null,
    pendingNickname: null,
  })
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
    'idle' | 'saving' | 'saved' | 'error'
  >('idle')
  const [championSaveError, setChampionSaveError] = useState<string | null>(null)
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

  const navigateToScreen = useCallback((
    nextScreen: AppScreen,
    replace = false,
    path = APP_ROUTE_PATHS[nextScreen],
  ): void => {
    const nextPath = path
    if (typeof window !== 'undefined' && window.location.pathname !== nextPath) {
      const nextUrl = `${nextPath}${window.location.search}`
      if (replace) {
        window.history.replaceState(null, '', nextUrl)
      } else {
        window.history.pushState(null, '', nextUrl)
      }
    }
    setScreen(nextScreen)
  }, [])

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
      setScreen(nextScreen)
      if (nextScreen === 'run-setup') {
        setRunMode(getRunModeForPath(window.location.pathname))
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  useEffect(() => {
    if (
      activeRun !== null &&
      (screen === 'run-setup' || screen === 'meta-progression')
    ) {
      // Route guard: an active run must not leave the player stranded on a setup
      // screen. navigateToScreen also pushes browser history, so this is a sync
      // with an external system (the History API) and not derivable in render.
      // oxlint-disable-next-line react/set-state-in-effect
      navigateToScreen('dashboard', true)
    }
  }, [activeRun, navigateToScreen, screen])

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
      setNickname({ displayName: null, pendingNickname: null })
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
          setNickname(loadedNickname)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
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
      characterClassId: settings.selectedCharacterClassId,
      xpMultiplierLevel: metaProgression.snapshot?.xpMultiplierLevel ?? 0,
      startingLevel: metaProgression.snapshot?.startingLevel ?? 1,
      skillSlotCount: metaProgression.snapshot?.skillSlotCount ?? DEFAULT_SKILL_SLOT_COUNT,
      dungeonMaxFloorBonus: metaProgression.snapshot?.dungeonMaxFloorBonus ?? 0,
      rerollCount: metaProgression.snapshot?.wallet.rerollLevel ?? 0,
      banishCount: metaProgression.snapshot?.banishCount ?? 1,
      worldModifierIds: settings.selectedWorldModifierIds,
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
    }))
    showToast('Nickname submitted for moderator review.', 'info')
  }, [
    authentication.account,
    nicknameService.configurationError,
    nicknameService.service,
    showToast,
  ])

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
      })
      pendingChampionIdRef.current = null
      setChampionAvailability('available')
      setChampionSaveState('saved')
    } catch (error: unknown) {
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

  const returnToDashboard = useCallback((): void => {
    setResult(null)
    navigateToScreen('dashboard', true)
  }, [navigateToScreen])

  const openFishing = useCallback((): void => {
    navigateToScreen('fishing')
  }, [navigateToScreen])

  const openChampions = useCallback((): void => {
    navigateToScreen('champions')
  }, [navigateToScreen])

  const openInventory = useCallback((): void => {
    navigateToScreen('inventory')
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
    if (!authentication.account?.isAdmin) {
      return
    }
    if (!bugReport.service) {
      setAdminReports((current) => ({
        ...current,
        loadState: 'error',
        error: bugReport.configurationError ?? 'Bug reporting is unavailable.',
      }))
      return
    }
    setAdminReports((current) => ({ ...current, loadState: 'loading', error: null }))
    void Promise.all([
      bugReport.service.loadAll(),
      repository.getHiddenBugReportIds(authentication.account.id),
    ])
      .then(([reports, hiddenReportIds]) => {
        setAdminReports({
          loadState: 'ready',
          reports,
          hiddenReportIds: [...hiddenReportIds],
          error: null,
        })
      })
      .catch((error: unknown) => {
        setAdminReports((current) => ({
          ...current,
          loadState: 'error',
          error: errorMessage(error),
        }))
      })
  }, [
    authentication.account,
    bugReport.configurationError,
    bugReport.service,
    repository,
  ])

  useEffect(() => {
    if (screen === 'admin' && authentication.account?.isAdmin) {
      // Admin data is fetched on navigation to the admin screen. The fetch is
      // imperative and cannot be derived during render.
      // oxlint-disable-next-line react/set-state-in-effect
      refreshAdminReports()
    }
  }, [authentication.account, refreshAdminReports, screen])

  const refreshNicknameModeration = useCallback((): void => {
    if (!authentication.account?.isAdmin) {
      return
    }
    if (!nicknameService.service) {
      setNicknameModeration((current) => ({
        ...current,
        loadState: 'error',
        error: nicknameService.configurationError ?? 'Nickname moderation is unavailable.',
      }))
      return
    }
    setNicknameModeration((current) => ({ ...current, loadState: 'loading', error: null }))
    void nicknameService.service.loadPendingChanges()
      .then((requests) => {
        setNicknameModeration({ loadState: 'ready', requests, error: null })
      })
      .catch((error: unknown) => {
        setNicknameModeration((current) => ({
          ...current,
          loadState: 'error',
          error: errorMessage(error),
        }))
      })
  }, [
    authentication.account,
    nicknameService.configurationError,
    nicknameService.service,
  ])

  useEffect(() => {
    if (screen === 'nickname-moderation' && authentication.account?.isAdmin) {
      // Moderation data is fetched on navigation to the moderation screen. The
      // fetch is imperative and cannot be derived during render.
      // oxlint-disable-next-line react/set-state-in-effect
      refreshNicknameModeration()
    }
  }, [authentication.account, refreshNicknameModeration, screen])

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

  if (screen === 'wiki') {
    return (
      <main className="app-shell app-shell-document">
        <AppHeader
          authentication={authentication}
          nickname={nickname}
          onRequestNicknameChange={requestNicknameChange}
          onSignOut={signOut}
          onNavigateToDashboard={returnToDashboard}
          onOpenAdmin={openAdmin}
          onOpenNicknameModeration={openNicknameModeration}
          onOpenFishing={openFishing}
          onOpenChampions={openChampions}
          onOpenInventory={openInventory}
          inventoryService={inventory.service}
          bugReportDungeon={bugReportDungeon}
          onSubmitBugReport={(description, image) => submitBugReport(description, image, bugReportDungeon)}
        />
        <LazyScreen label="The wiki">
          <LazyWikiScreen
            appVersion={APP_VERSION}
            onReturnToApp={() => navigateToScreen('dashboard')}
          />
        </LazyScreen>
      </main>
    )
  }

  if (persistence.loadState === 'loading') {
    return (
      <main className="app-shell">
        <AppHeader
          authentication={authentication}
          nickname={nickname}
          onRequestNicknameChange={requestNicknameChange}
          onSignOut={signOut}
          onNavigateToDashboard={returnToDashboard}
          onOpenAdmin={openAdmin}
          onOpenNicknameModeration={openNicknameModeration}
          onOpenFishing={openFishing}
          onOpenChampions={openChampions}
          onOpenInventory={openInventory}
          inventoryService={inventory.service}
          bugReportDungeon={bugReportDungeon}
          onSubmitBugReport={(description, image) => submitBugReport(description, image, bugReportDungeon)}
        />
        <section className="dashboard" aria-labelledby="persistence-loading-title">
          <div className="dashboard-panel" role="status">
            <p className="screen-kicker">Local persistence</p>
            <h2 id="persistence-loading-title">Loading saved run settings…</h2>
            <p>Opening your local profile and saved run settings.</p>
          </div>
        </section>
      </main>
    )
  }

  if (persistence.loadState === 'error' || !settings || !profile || !runConfig) {
    return (
      <main className="app-shell">
        <AppHeader
          authentication={authentication}
          nickname={nickname}
          onRequestNicknameChange={requestNicknameChange}
          onSignOut={signOut}
          onNavigateToDashboard={returnToDashboard}
          onOpenAdmin={openAdmin}
          onOpenNicknameModeration={openNicknameModeration}
          onOpenFishing={openFishing}
          onOpenChampions={openChampions}
          onOpenInventory={openInventory}
          inventoryService={inventory.service}
          bugReportDungeon={bugReportDungeon}
          onSubmitBugReport={(description, image) => submitBugReport(description, image, bugReportDungeon)}
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
      </main>
    )
  }

  return (
    <main className={`app-shell${
      screen === 'gameplay'
        ? ' app-shell-gameplay'
        : screen === 'fishing'
          ? ' app-shell-fishing'
          : screen === 'dashboard'
            ? ' app-shell-hub'
            : ''
    }${DOCUMENT_SCREENS.has(screen) ? ' app-shell-document' : ''}`}>
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
          onOpenChampions={openChampions}
          onOpenInventory={openInventory}
          inventoryService={inventory.service}
          bugReportDungeon={bugReportDungeon}
          onSubmitBugReport={(description, image) => submitBugReport(description, image, bugReportDungeon)}
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
          leaderboardService={essenceLeaderboard.service}
          leaderboardConfigurationError={essenceLeaderboard.configurationError}
          activeRun={activeRun}
          runLoadState={runLoadState}
          runLoadError={runLoadError}
          onOpenMetaProgression={openMetaProgression}
          onOpenFishing={openFishing}
          onOpenChampions={openChampions}
          onOpenInventory={openInventory}
          onOpenAbyss={openAbyssSetup}
          championAvailability={championAvailability}
          onOpenRunSetup={openRunSetup}
          onContinueRun={continueRun}
          onForfeitRun={forfeitActiveRun}
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
      {(screen === 'dashboard' || screen === 'run-setup' || screen === 'meta-progression' || screen === 'fishing' || screen === 'champions' || screen === 'inventory') &&
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
        <LazyScreen label="Run preparation">
          <LazyRunSetupScreen
            settings={settings}
            writeError={writeError ?? runStartError}
            startState={runStartState}
            inventoryService={inventory.service}
            inventoryError={inventory.configurationError}
            characterService={characters.service}
            characterError={characters.configurationError}
            maximumDungeonFloor={metaProgression.snapshot?.dungeonMaxFloor ?? DEFAULT_DUNGEON_CONFIG.defaultMaxFloor}
            initialMode={runMode}
            onStart={startRun}
            onSelectCharacterClass={selectCharacterClass}
            onToggleWorldModifier={toggleWorldModifier}
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
        <LazyScreen label="The fishing pond">
          <LazyFishingScreen
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
      {screen === 'champions' && authentication.account ? (
        <LazyScreen label="Champions">
          <LazyChampionManagementScreen
            service={characters.service}
            inventoryService={inventory.service}
            inventoryError={inventory.configurationError}
            configurationError={characters.configurationError}
            onBack={returnToDashboard}
          />
        </LazyScreen>
      ) : null}
      {screen === 'inventory' && authentication.account ? (
        <LazyScreen label="The inventory">
          <LazyInventoryScreen
            inventoryService={inventory.service}
            lootBoxService={lootBoxes.service}
            configurationError={lootBoxes.configurationError ?? inventory.configurationError}
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
            keybinds={settings?.keybinds ?? DEFAULT_GAME_KEYBINDS}
            onKeybindsChange={updateKeybinds}
            reportBugRunId={activeRunSubmission?.runId}
            onSubmitBugReport={submitBugReport}
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
          onSaveChampion={saveChampion}
          onReturn={returnToDashboard}
          onRetryTerminalSave={retryTerminalSave}
          onRetryReward={() => {
            if (activeRunSubmission) {
              void submitRunReward(activeRunSubmission)
            }
          }}
        />
      ) : null}
    </main>
  )
}

export default App
