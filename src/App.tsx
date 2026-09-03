import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { RunResultSnapshot, RunConfig, GameCheckpoint } from './game'
import {
  DEFAULT_DUNGEON_CONFIG,
  DEFAULT_DUNGEON_ID,
  DEFAULT_RUN_MODE_ID,
  EMPTY_RUN_PREPARATION_SNAPSHOT,
  createGameFromCheckpoint,
  createInitialGameCheckpoint,
  isRunPreparationSnapshot,
  isValidCheckpoint,
  type BehaviorProfileId,
} from './game'
import {
  createDexiePersistenceStore,
  createPersistenceRepository,
  type BasicProfileDto,
  type PersistenceRepository,
  type SettingsDto,
  type SettingsPatch,
  createDungeonRunPersistenceService,
  type ActiveDungeonRun,
} from './persistence'
import { DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID } from './persistence'
import {
  AuthPanel,
  AccountSettingsMenu,
  createAuthenticationService,
  createNicknameService,
  type AuthenticationState,
  type AuthenticationService,
  type NicknameChangeRequest,
  type NicknameService,
  type NicknameState,
  type SignInOptions,
  type SignUpResult,
} from './auth'
import {
  createMetaProgressionService,
  type MetaRunResultInput,
  type MetaProgressionService,
  type MetaProgressionSnapshot,
} from './meta'
import { MetaProgressionScreen } from './meta/MetaProgressionScreen'
import {
  createEssenceLeaderboardService,
  type EssenceLeaderboardService,
} from './leaderboard/EssenceLeaderboardService'
import { EssenceLeaderboard } from './leaderboard/EssenceLeaderboard'
import { GameCanvas } from './rendering/GameCanvas'
import { KeywordText } from './rendering/KeywordTooltip'
import { SkillIcon } from './rendering/SkillIcon'
import { WikiScreen } from './wiki/WikiScreen'
import { tooltipClassName } from './rendering/TooltipShell'
import {
  calculateWorldModifierRewardMultiplier,
  getWorldModifierDefinitions,
  normalizeWorldModifierIds,
  resolveWorldModifierEffects,
  WORLD_MODIFIER_DEFINITIONS,
  type WorldModifierId,
} from './content/modifiers/WorldModifiers'
import { SPAWN_BALANCE } from './content/spawning/SpawnBalance'
import { useToaster } from './ui/ToasterContext'
import { ConfirmationDialog } from './ui/ConfirmationDialog'
import { AdminReportsScreen } from './admin/AdminReportsScreen'
import { NicknameModerationScreen } from './admin/NicknameModerationScreen'
import {
  createBugReportService,
  type BugReportDungeonContext,
  type BugReportImage,
  type BugReportService,
  type BugReport,
  type BugReportFloorSnapshot,
} from './bug-report'
import {
  createFishingService,
  getFishMealLabel,
  resolveFishMeal,
  FishingScreen,
  type FishingService,
} from './fishing'
import {
  ChampionManagementScreen,
  createCharacterService,
  type CharacterService,
} from './characters'
import {
  createInventoryService,
  getInventoryItemDefinition,
  type InventoryItemInstance,
  type InventoryService,
} from './inventory'
import type { RunPreparationSnapshot } from './game'
import { formatCompactDamage, formatExperience } from './ui/formatNumbers'
import {
  ATTUNEMENT_DESCRIPTION,
  RESONANCE_DESCRIPTION,
} from './content/stats/Stats'
import type { GameKeybinds } from './input/Keybinds'
import { DEFAULT_GAME_KEYBINDS } from './input/Keybinds'
import {
  BASIC_ATTACK_SKILL_ID,
  getSkillDefinition,
} from './content/skills/Skills'
import { DEFAULT_SKILL_SLOT_COUNT } from './game-config/skills'
import {
  CHARACTER_CLASS_DEFINITIONS,
  type CharacterClassId,
} from './content/classes/CharacterClasses'
import {
  calculateEssenceReward,
  type EssenceRewardCalculation,
} from './meta/EssenceRewards'
import './App.css'

const APP_VERSION = import.meta.env.VITE_APP_VERSION
const RUN_GAME_VERSION = APP_VERSION ?? 'development'

type AppScreen =
  | 'dashboard'
  | 'run-setup'
  | 'meta-progression'
  | 'fishing'
  | 'champions'
  | 'gameplay'
  | 'results'
  | 'admin'
  | 'nickname-moderation'
  | 'wiki'
type PersistenceLoadState = 'loading' | 'ready' | 'error'

const APP_ROUTE_PATHS: Record<AppScreen, string> = {
  dashboard: '/',
  'run-setup': '/prepare',
  'meta-progression': '/store',
  fishing: '/fishing',
  champions: '/champions',
  gameplay: '/',
  results: '/',
  admin: '/admin',
  'nickname-moderation': '/admin/nicknames',
  wiki: '/wiki',
}

function getScreenForPath(pathname: string): AppScreen {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (normalizedPath === APP_ROUTE_PATHS['run-setup']) {
    return 'run-setup'
  }
  if (normalizedPath === APP_ROUTE_PATHS['meta-progression']) {
    return 'meta-progression'
  }
  if (normalizedPath === APP_ROUTE_PATHS.admin) {
    return 'admin'
  }
  if (normalizedPath === APP_ROUTE_PATHS['nickname-moderation']) {
    return 'nickname-moderation'
  }
  if (normalizedPath === APP_ROUTE_PATHS.wiki) {
    return 'wiki'
  }
  return 'dashboard'
}
interface PersistenceState {
  loadState: PersistenceLoadState
  settings: SettingsDto | null
  profile: BasicProfileDto | null
  error: string | null
}

interface MetaProgressionState {
  loadState: 'idle' | 'loading' | 'ready' | 'error' | 'unavailable'
  snapshot: MetaProgressionSnapshot | null
  error: string | null
  purchaseState: 'idle' | 'purchasing'
  activePurchaseUnlockId: string | null
}

interface RunRewardState {
  status: 'idle' | 'submitting' | 'saved' | 'error' | 'unavailable'
  essenceAwarded: number | null
  error: string | null
}

type RunLoadState = 'loading' | 'ready' | 'error' | 'unavailable'
type RunWriteState = 'idle' | 'saving' | 'saved' | 'error' | 'unavailable'

const DEFAULT_CONTRACT = {
  id: DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID,
  maxFloor: DEFAULT_DUNGEON_CONFIG.defaultMaxFloor,
  label: `${DEFAULT_DUNGEON_CONFIG.defaultMaxFloor} floors · Default`,
} as const

const DUNGEON_MAX_FLOOR_CONTRACTS = [
  DEFAULT_CONTRACT,
  ...DEFAULT_DUNGEON_CONFIG.maximumFloorContracts.map((contract) => ({
    ...contract,
    label: `${contract.maxFloor} floors`,
  })),
]

function formatElapsedTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(totalSeconds / 60)
  const remainder = totalSeconds % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

interface EssenceReceipt extends EssenceRewardCalculation {
  modifiers: ReturnType<typeof getWorldModifierDefinitions>
}

function createEssenceReceipt(result: RunResultSnapshot): EssenceReceipt {
  const modifiers = getWorldModifierDefinitions(
    normalizeWorldModifierIds(result.worldModifierIds),
  )
  const modifierMultiplier = calculateWorldModifierRewardMultiplier(
    result.worldModifierIds,
  )
  const calculation = calculateEssenceReward(
    result.level,
    result.killCount,
    modifierMultiplier,
    result.outcome === 'victory',
  )
  return {
    ...calculation,
    modifiers,
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'object' && error !== null &&
    'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return 'Unable to access local persistence.'
}

function parseGameCheckpoint(value: unknown): GameCheckpoint {
  if (!isValidCheckpoint(value)) {
    throw new Error('The saved dungeon checkpoint is invalid or unsupported.')
  }
  return value
}

function createRunSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]
}

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

function isMaxFloorContractUnlocked(
  profile: BasicProfileDto,
  contractId: string,
  requiredUnlockId?: string,
): boolean {
  return contractId === DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID ||
    profile.unlockedDungeonMaxFloorIds.includes(contractId) ||
    (requiredUnlockId !== undefined &&
      profile.unlockedDungeonMaxFloorIds.includes(requiredUnlockId))
}

function App() {
  const { showToast } = useToaster()
  const repository = useMemo<PersistenceRepository>(
    () => createPersistenceRepository(createDexiePersistenceStore()),
    [],
  )
  const [screen, setScreen] = useState<AppScreen>(() =>
    typeof window === 'undefined' ? 'dashboard' : getScreenForPath(window.location.pathname),
  )
  const authenticationService = useMemo(() => {
    try {
      return {
        service: createAuthenticationService({
          supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
          supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          redirectUrl: import.meta.env.VITE_AUTH_REDIRECT_URL,
        }),
        configurationError: null,
      }
    } catch (error: unknown) {
      return {
        service: null,
        configurationError: errorMessage(error),
      }
    }
  }, [])
  const metaProgressionService = useMemo(() => {
    try {
      return {
        service: createMetaProgressionService({
          supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
          supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        }, () => authenticationService.service?.getClient()),
        configurationError: null,
      }
    } catch (error: unknown) {
      return {
        service: null,
        configurationError: errorMessage(error),
      }
    }
  }, [authenticationService])
  const characters = useMemo<{ service: CharacterService | null; configurationError: string | null }>(() => {
    try {
      return {
        service: createCharacterService({
          supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
          supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        }, () => authenticationService.service?.getClient()),
        configurationError: null,
      }
    } catch (error: unknown) {
      return {
        service: null,
        configurationError: errorMessage(error),
      }
    }
  }, [authenticationService])
  const essenceLeaderboard = useMemo(() => {
    try {
      return {
        service: createEssenceLeaderboardService({
          supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
          supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        }, () => authenticationService.service?.getClient()),
        configurationError: null,
      }
    } catch (error: unknown) {
      return {
        service: null,
        configurationError: errorMessage(error),
      }
    }
  }, [authenticationService])
  const dungeonRunPersistence = useMemo(() => {
    try {
      return {
        service: createDungeonRunPersistenceService({
          supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
          supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        }, () => authenticationService.service?.getClient()),
        configurationError: null,
      }
    } catch (error: unknown) {
      return {
        service: null,
        configurationError: errorMessage(error),
      }
    }
  }, [authenticationService])
  const inventory = useMemo<{ service: InventoryService | null; configurationError: string | null }>(() => {
    try {
      return {
        service: createInventoryService({
          supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
          supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        }, () => authenticationService.service?.getClient()),
        configurationError: null,
      }
    } catch (error: unknown) {
      return {
        service: null,
        configurationError: errorMessage(error),
      }
    }
  }, [authenticationService])
  const fishing = useMemo<{ service: FishingService | null; configurationError: string | null }>(() => {
    try {
      return {
        service: createFishingService({
          supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
          supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        }, () => authenticationService.service?.getClient()),
        configurationError: null,
      }
    } catch (error: unknown) {
      return {
        service: null,
        configurationError: errorMessage(error),
      }
    }
  }, [authenticationService])
  const bugReport = useMemo<{ service: BugReportService | null; configurationError: string | null }>(() => {
    try {
      return {
        service: createBugReportService({
          supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
          supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        }, () => authenticationService.service?.getClient()),
        configurationError: null,
      }
    } catch (error: unknown) {
      return {
        service: null,
        configurationError: errorMessage(error),
      }
    }
  }, [authenticationService])
  const nicknameService = useMemo<{ service: NicknameService | null; configurationError: string | null }>(() => {
    try {
      return {
        service: createNicknameService({
          supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
          supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        }, () => authenticationService.service?.getClient()),
        configurationError: null,
      }
    } catch (error: unknown) {
      return {
        service: null,
        configurationError: errorMessage(error),
      }
    }
  }, [authenticationService])
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
  const [activeRunSubmission, setActiveRunSubmission] = useState<MetaRunResultInput | null>(null)
  const [result, setResult] = useState<RunResultSnapshot | null>(null)
  const [runReward, setRunReward] = useState<RunRewardState>({
    status: 'idle',
    essenceAwarded: null,
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

  const navigateToScreen = useCallback((nextScreen: AppScreen, replace = false): void => {
    const nextPath = APP_ROUTE_PATHS[nextScreen]
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
    const routePath = APP_ROUTE_PATHS[getScreenForPath(window.location.pathname)]
    if (window.location.pathname !== routePath) {
      window.history.replaceState(null, '', routePath)
    }
    const handlePopState = (): void => {
      setScreen(getScreenForPath(window.location.pathname))
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
      setActiveRun(null)
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
      modeId: DEFAULT_RUN_MODE_ID,
      preparation: activeRun?.preparation ?? EMPTY_RUN_PREPARATION_SNAPSHOT,
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
  }, [activeRun, metaProgression.snapshot, profile, runSeed, settings])

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
      username: nickname.displayName ??
        authentication.account.displayName ??
        'Anonymous player',
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
    navigateToScreen('run-setup')
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
    preparation: RunPreparationSnapshot = EMPTY_RUN_PREPARATION_SNAPSHOT,
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
    setRunStartState('saving')
    setRunStartError(null)
    setResult(null)
    setWriteError(null)
    if (!isRunPreparationSnapshot(preparation)) {
      showToast('The selected run meal is invalid.', 'error')
      return
    }
    const seed = createRunSeed()
    const config: RunConfig = { ...runConfig, seed, preparation }
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
      setRunReward({ status: 'idle', essenceAwarded: null, error: null })
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
    runConfig,
    runLoadState,
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
      setActiveRunSubmission({
        runId: activeRun.runId,
        pendingResultId: activeRun.runId,
        completedAt: '',
        level: checkpoint.gameState.player.level,
        killCount: checkpoint.gameState.run.killCount,
        outcome: 'defeat',
        worldModifierIds: checkpoint.gameState.run.worldModifierIds ?? [],
      })
      setRunReward({ status: 'idle', essenceAwarded: null, error: null })
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
  }, [activeRunSubmission, dungeonRunPersistence.service])

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
        error: 'Sign in with progression available to earn Essence.',
      })
      return
    }
    setRunReward({ status: 'submitting', essenceAwarded: null, error: null })
    try {
      const reward = await service.submitRunResult(submission)
      const snapshot = await service.load()
      setMetaProgression((current) => ({
        ...current,
        loadState: 'ready',
        snapshot,
        error: null,
      }))
      setRunReward({
        status: 'saved',
        essenceAwarded: reward.essenceAwarded,
        error: null,
      })
    } catch (error: unknown) {
      setRunReward({
        status: 'error',
        essenceAwarded: null,
        error: errorMessage(error),
      })
    }
  }, [authentication.account, metaProgressionService.service])

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
      await service.completeRun({
        runId: submission.runId,
        outcome: submission.outcome,
        completedAt: submission.completedAt,
        checkpoint,
        level: submission.level,
        killCount: submission.killCount,
        worldModifierIds: submission.worldModifierIds,
      })
      setActiveRun(null)
      setTerminalSaveState('saved')
      await submitRunReward(submission)
    } catch (error: unknown) {
      setTerminalSaveState('error')
      setTerminalSaveError(errorMessage(error))
    }
  }, [dungeonRunPersistence.service, submitRunReward])

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

  const saveChampion = useCallback(async (name: string): Promise<void> => {
    if (result?.outcome !== 'victory' || !activeRunSubmission) {
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
        sourceRunId: activeRunSubmission.runId,
        name: trimmedName,
        contentVersion: RUN_GAME_VERSION,
      })
      pendingChampionIdRef.current = null
      setChampionSaveState('saved')
    } catch (error: unknown) {
      setChampionSaveState('error')
      setChampionSaveError(errorMessage(error))
    }
  }, [
    activeRunSubmission,
    characters.configurationError,
    characters.service,
    result,
  ])

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
        />
        <WikiScreen
          appVersion={APP_VERSION}
          onReturnToApp={() => navigateToScreen('dashboard')}
        />
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
    <main className={`app-shell${screen === 'gameplay' ? ' app-shell-gameplay' : ''}`}>
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
        />
      ) : null}
      {screen === 'dashboard' && authentication.account ? (
        <GameDashboard
          accountId={authentication.account.id}
          essenceBalance={metaProgression.snapshot?.wallet.essenceBalance ?? null}
          leaderboardService={essenceLeaderboard.service}
          leaderboardConfigurationError={essenceLeaderboard.configurationError}
          activeRun={activeRun}
          runLoadState={runLoadState}
          runLoadError={runLoadError}
          onOpenMetaProgression={openMetaProgression}
          onOpenFishing={openFishing}
          onOpenChampions={openChampions}
          onOpenRunSetup={openRunSetup}
          onContinueRun={continueRun}
          onForfeitRun={forfeitActiveRun}
        />
      ) : null}
      {screen === 'admin' && authentication.account?.isAdmin ? (
        <AdminReportsScreen
          reports={adminReports.reports}
          hiddenReportIds={new Set(adminReports.hiddenReportIds)}
          showHidden={showHiddenAdminReports}
          loadState={adminReports.loadState === 'idle' ? 'loading' : adminReports.loadState}
          error={adminReports.error}
          onBack={closeAdmin}
          onRefresh={refreshAdminReports}
          onToggleShowHidden={() => { setShowHiddenAdminReports((current) => !current) }}
          onToggleHide={(reportId, hidden) => { void toggleBugReportHidden(reportId, hidden) }}
          onLoadFloorSnapshot={loadBugReportFloorSnapshot}
        />
      ) : null}
      {screen === 'nickname-moderation' && authentication.account?.isAdmin ? (
        <NicknameModerationScreen
          requests={nicknameModeration.requests}
          loadState={nicknameModeration.loadState === 'idle' ? 'loading' : nicknameModeration.loadState}
          error={nicknameModeration.error}
          onBack={closeAdmin}
          onRefresh={refreshNicknameModeration}
          onReview={(requestId, approve) => {
            void reviewNicknameChange(requestId, approve)
          }}
        />
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
      {(screen === 'dashboard' || screen === 'run-setup' || screen === 'meta-progression' || screen === 'fishing' || screen === 'champions') &&
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
        <RunSetupScreen
          settings={settings}
          writeError={writeError ?? runStartError}
          startState={runStartState}
          inventoryService={inventory.service}
          inventoryError={inventory.configurationError}
          onStart={startRun}
          onSelectCharacterClass={selectCharacterClass}
          onToggleWorldModifier={toggleWorldModifier}
          onBack={closeRunSetup}
        />
      ) : null}
      {screen === 'meta-progression' && authentication.account ? (
        <MetaProgressionScreen
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
      ) : null}
      {screen === 'fishing' && authentication.account ? (
        <FishingScreen
          fishingService={fishing.service}
          inventoryService={inventory.service}
          configurationError={fishing.configurationError ?? inventory.configurationError}
          onBack={returnToDashboard}
        />
      ) : null}
      {screen === 'champions' && authentication.account ? (
        <ChampionManagementScreen
          service={characters.service}
          configurationError={characters.configurationError}
          onBack={returnToDashboard}
        />
      ) : null}
      {screen === 'gameplay' ? (
        <GameCanvas
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

interface AppHeaderProps {
  authentication: AuthenticationState
  nickname: NicknameState
  onRequestNicknameChange: (nickname: string) => Promise<void>
  onSignOut: () => Promise<boolean>
  onNavigateToDashboard: () => void
  onOpenAdmin: () => void
  onOpenNicknameModeration: () => void
  onOpenFishing: () => void
  onOpenChampions: () => void
}

function AppHeader({
  authentication,
  nickname,
  onRequestNicknameChange,
  onSignOut,
  onNavigateToDashboard,
  onOpenAdmin,
  onOpenNicknameModeration,
  onOpenFishing,
  onOpenChampions,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <div>
        <p className="app-kicker">Active Burger 4</p>
        <a
          className="app-title-link"
          href="/"
          onClick={(event) => {
            event.preventDefault()
            onNavigateToDashboard()
          }}
        >
          <h1>Active Burger</h1>
        </a>
        <p className="app-version">Version: {APP_VERSION}</p>
      </div>
      <nav className="app-navigation" aria-label="Primary navigation">
        <a className="app-wiki-link" href="/wiki">Wiki</a>
        <button className="app-admin-link" type="button" onClick={onOpenFishing}>Fishing</button>
        <button className="app-admin-link" type="button" onClick={onOpenChampions}>Champions</button>
      </nav>
      {authentication.account ? (
        <div className="app-account">
          <span className="app-account-label">Signed in</span>
          <strong className="app-account-email">
            {nickname.displayName ??
              authentication.account.displayName ??
              'Anonymous player'}
          </strong>
          {authentication.error ? (
            <span className="app-account-error">{authentication.error}</span>
          ) : null}
          {authentication.account.isAdmin ? (
            <>
              <button className="app-admin-link" type="button" onClick={onOpenAdmin}>
                Bug reports
              </button>
              <button className="app-admin-link" type="button" onClick={onOpenNicknameModeration}>
                Nickname requests
              </button>
            </>
          ) : null}
          <AccountSettingsMenu
            displayName={nickname.displayName}
            pendingNickname={nickname.pendingNickname}
            onRequestNicknameChange={onRequestNicknameChange}
          />
          <button className="app-sign-out" type="button" onClick={() => { void onSignOut() }}>
            Sign out
          </button>
        </div>
      ) : null}
    </header>
  )
}

interface GameDashboardProps {
  accountId: string
  essenceBalance: number | null
  leaderboardService: EssenceLeaderboardService | null
  leaderboardConfigurationError: string | null
  activeRun: ActiveDungeonRun | null
  runLoadState: RunLoadState
  runLoadError: string | null
  onOpenRunSetup: () => void
  onOpenMetaProgression: () => void
  onOpenFishing: () => void
  onOpenChampions: () => void
  onContinueRun: () => void
  onForfeitRun: () => Promise<void>
}

function GameDashboard({
  accountId,
  essenceBalance,
  leaderboardService,
  leaderboardConfigurationError,
  activeRun,
  runLoadState,
  runLoadError,
  onOpenRunSetup,
  onOpenMetaProgression,
  onOpenFishing,
  onOpenChampions,
  onContinueRun,
  onForfeitRun,
}: GameDashboardProps) {
  const [forfeitConfirmationOpen, setForfeitConfirmationOpen] = useState(false)
  const [forfeiting, setForfeiting] = useState(false)
  const [forfeitError, setForfeitError] = useState<string | null>(null)
  const storeBlocked = activeRun !== null || runLoadState !== 'ready'
  const activeCharacterClass = activeRun
    ? Object.values(CHARACTER_CLASS_DEFINITIONS).find(
      (characterClass) => characterClass.id === activeRun.characterClassId,
    )
    : undefined

  const confirmForfeit = (): void => {
    if (forfeiting) {
      return
    }
    setForfeiting(true)
    setForfeitError(null)
    void onForfeitRun()
      .catch((error: unknown) => {
        setForfeitError(errorMessage(error))
      })
      .finally(() => {
        setForfeiting(false)
        setForfeitConfirmationOpen(false)
      })
  }

  return (
    <section
      className="dashboard game-dashboard"
      aria-labelledby="game-dashboard-title"
      data-run-persistence-state={runLoadState}
    >
      <div className="game-dashboard-layout">
        <div className="dashboard-panel game-dashboard-panel">
          <header className="game-dashboard-hero">
            <div className="game-dashboard-hero-copy">
              <h2 id="game-dashboard-title">The dungeon is waiting.</h2>
              <p>
                Prepare your fighter, choose your risk, and descend farther than your last run.
              </p>
            </div>
          </header>
          {runLoadState === 'error' || runLoadState === 'unavailable' ? (
            <p className="persistence-error" role="alert">
              {runLoadError ?? 'Unable to load the current dungeon run.'}
            </p>
          ) : null}

          <div className="game-dashboard-overview">
            <dl className="game-dashboard-stats">
              <div className="game-dashboard-stat game-dashboard-stat-essence">
                <dt>Essence</dt>
                <dd>{essenceBalance === null ? '—' : essenceBalance.toLocaleString()}</dd>
                <span>Glittering blue value</span>
              </div>
            </dl>
            <button
              className="game-dashboard-action game-dashboard-action-secondary"
              type="button"
              onClick={onOpenMetaProgression}
              disabled={storeBlocked}
              title={storeBlocked
                ? activeRun
                  ? 'Finish or forfeit your current dungeon run before opening the Essence store.'
                  : 'Checking the current dungeon run before opening the Essence store.'
                : undefined}
              aria-describedby={activeRun ? 'store-blocked-help' : undefined}
            >
              <span className="game-dashboard-action-icon" aria-hidden="true">✦</span>
              <span>
                <strong>Essence store</strong>
                <small>Turn Essence into permanent power.</small>
              </span>
              <span className="game-dashboard-action-arrow" aria-hidden="true">→</span>
            </button>
            <button
              className="game-dashboard-action game-dashboard-action-secondary"
              type="button"
              onClick={onOpenChampions}
              disabled={runLoadState !== 'ready'}
              title={runLoadState !== 'ready'
                ? 'Checking the current dungeon run before opening Champions.'
                : undefined}
            >
              <span className="game-dashboard-action-icon" aria-hidden="true">◆</span>
              <span>
                <strong>Champions</strong>
                <small>View completed builds for future Abyss attempts.</small>
              </span>
              <span className="game-dashboard-action-arrow" aria-hidden="true">→</span>
            </button>
            <button
              className="game-dashboard-action game-dashboard-action-secondary"
              type="button"
              onClick={onOpenFishing}
              disabled={runLoadState !== 'ready'}
              title={runLoadState !== 'ready'
                ? 'Checking the current dungeon run before opening fishing.'
                : undefined}
            >
              <span className="game-dashboard-action-icon" aria-hidden="true">≈</span>
              <span>
                <strong>Go fishing</strong>
                <small>Catch fish for future run meals and recovery.</small>
              </span>
              <span className="game-dashboard-action-arrow" aria-hidden="true">→</span>
            </button>
          </div>

          <section className="game-dashboard-actions" aria-labelledby="current-dungeon-title">
            <div className="game-dashboard-section-heading">
              <h3 id="current-dungeon-title">Current dungeon</h3>
            </div>
            <div className="game-dashboard-action-grid">
              {activeRun ? (
                <div className="current-dungeon-card">
                  <div className="current-dungeon-card-heading">
                    <span className="game-dashboard-action-icon" aria-hidden="true">↓</span>
                    <span>
                      <strong>Dungeon run in progress</strong>
                      <small>Continue your descent from the latest saved floor.</small>
                    </span>
                  </div>
                  <dl className="current-dungeon-details">
                    <div>
                      <dt>Floor</dt>
                      <dd>{activeRun.currentFloor} / {activeRun.maxFloor}</dd>
                    </div>
                    <div>
                      <dt>Class</dt>
                      <dd>{activeCharacterClass?.name ?? activeRun.characterClassId}</dd>
                    </div>
                  </dl>
                  <button
                    className="game-dashboard-action game-dashboard-action-primary current-dungeon-continue"
                    type="button"
                    onClick={onContinueRun}
                  >
                    <span>
                      <strong>Continue dungeon</strong>
                      <small>Restart from the saved floor checkpoint.</small>
                    </span>
                    <span className="game-dashboard-action-arrow" aria-hidden="true">→</span>
                  </button>
                  <button
                    className="current-dungeon-forfeit"
                    type="button"
                    onClick={() => setForfeitConfirmationOpen(true)}
                    disabled={forfeiting}
                  >
                    {forfeiting ? 'Forfeiting…' : 'Forfeit run'}
                  </button>
                  {forfeitError ? <p className="persistence-error" role="alert">{forfeitError}</p> : null}
                </div>
              ) : (
                <button
                  className="game-dashboard-action game-dashboard-action-primary"
                  type="button"
                  onClick={onOpenRunSetup}
                >
                  <span className="game-dashboard-action-icon" aria-hidden="true">↓</span>
                  <span>
                    <strong>Start a dungeon run</strong>
                    <small>Descend into the dungeon. Slay increasingly stronger monsters for valuable essence.</small>
                  </span>
                  <span className="game-dashboard-action-arrow" aria-hidden="true">→</span>
                </button>
              )}
            </div>
            {activeRun ? (
              <p className="current-dungeon-restriction" id="store-blocked-help">
                Finish or forfeit your current dungeon run before accessing the Essence store.
              </p>
            ) : null}
          </section>
        </div>
        <aside className="dashboard-panel game-dashboard-sidebar">
          <EssenceLeaderboard
            accountId={accountId}
            service={leaderboardService}
            configurationError={leaderboardConfigurationError}
          />
        </aside>
      </div>
      {forfeitConfirmationOpen ? (
        <ConfirmationDialog
          title="Forfeit dungeon run?"
          message="Are you sure you want to forfeit this run? It will end as a defeat and cannot be continued."
          confirmLabel="Forfeit run"
          onConfirm={confirmForfeit}
          onCancel={() => setForfeitConfirmationOpen(false)}
        />
      ) : null}
    </section>
  )
}

interface RunSetupScreenProps {
  settings: SettingsDto
  writeError: string | null
  startState: RunWriteState
  inventoryService: InventoryService | null
  inventoryError: string | null
  onStart: (preparation: RunPreparationSnapshot) => Promise<void>
  onSelectCharacterClass: (characterClassId: CharacterClassId) => void
  onToggleWorldModifier: (modifierId: WorldModifierId) => void
  onBack: () => void
}

function RunSetupScreen({
  settings,
  writeError,
  startState,
  inventoryService,
  inventoryError,
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
  const [selectedFishIds, setSelectedFishIds] = useState<string[]>([])
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
  const selectedFish = useMemo(
    () => fishItems.filter((item) => selectedFishIds.includes(item.itemInstanceId)),
    [fishItems, selectedFishIds],
  )
  const fishMeal = useMemo(() => resolveFishMeal(selectedFish), [selectedFish])
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
            <h2 id="dashboard-title">Prepare your descent</h2>
            <p>
              Shape your fighter before entering the dungeon.
            </p>
          </div>
        </div>
        <div className="run-dashboard-command">
          <div>
            <span className="run-dashboard-command-label">Run briefing</span>
            <strong>Dungeon run</strong>
            <span>Configure your character and risk level.</span>
          </div>
          <button
            className="primary-action run-dashboard-start"
            type="button"
            onClick={() => { void onStart(fishMeal.preparation) }}
            disabled={startState === 'saving'}
          >
            <span>{startState === 'saving' ? 'Saving…' : 'Start Run'}</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
        {writeError ? <p className="persistence-error" role="alert">{writeError}</p> : null}
        <section className="run-dashboard-meal" aria-labelledby="fish-meal-title">
          <div className="run-dashboard-section-heading">
            <p className="screen-kicker">Pre-run meal</p>
            <h3 id="fish-meal-title">Choose up to five fish</h3>
          </div>
          <p className="fish-meal-summary">
            {getFishMealLabel(fishMeal.movementSpeedPercent)} · {selectedFish.length}/{5} selected
          </p>
          {fishLoadState === 'loading' ? (
            <p className="fish-meal-muted">Loading fish inventory…</p>
          ) : fishLoadState === 'error' ? (
            <p className="persistence-error" role="alert">
              {fishLoadError ?? 'Fish inventory is unavailable. You can still start without a meal.'}
            </p>
          ) : fishItems.length === 0 ? (
            <p className="fish-meal-muted">No fish available. Visit Fishing to catch some.</p>
          ) : (
            <div className="fish-meal-list">
              {fishItems.map((fish) => {
                const selected = selectedFishIds.includes(fish.itemInstanceId)
                return (
                  <button
                    className={`fish-meal-item${selected ? ' selected' : ''}`}
                    type="button"
                    aria-pressed={selected}
                    key={fish.itemInstanceId}
                    onClick={() => {
                      setSelectedFishIds((current) => selected
                        ? current.filter((id) => id !== fish.itemInstanceId)
                        : current.length < 5
                          ? [...current, fish.itemInstanceId]
                          : current)
                    }}
                  >
                    <strong>{getInventoryItemDefinition(fish.definitionId)?.name ?? fish.definitionId}</strong>
                    <span>
                      {typeof fish.metadata.rarity === 'string' ? fish.metadata.rarity : 'unknown'} ·{' '}
                      size {typeof fish.metadata.sizePercentile === 'number'
                        ? `${Math.round(fish.metadata.sizePercentile * 100)}%`
                        : 'unknown'}
                    </span>
                    <small>{selected ? 'Selected' : 'Select fish'}</small>
                  </button>
                )
              })}
            </div>
          )}
          <p className="fish-meal-footnote">
            Selected fish are consumed when the run starts and cannot be used for recovery.
          </p>
        </section>
        <div className="run-dashboard-section-heading">
          <p className="screen-kicker">Choose your fighter</p>
          <h3>Select your character</h3>
        </div>
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
                        <small>Starting skill</small>
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
                        aria-label={`Base physical damage: ${characterClass.baseStats.attackDamage}`}
                      >
                        <small>Base physical damage</small>
                        <strong>{characterClass.baseStats.attackDamage}</strong>
                      </span>
                      <span
                        className="character-class-card-detail"
                        tabIndex={0}
                        aria-label={`Resonance: ${RESONANCE_DESCRIPTION}`}
                      >
                        <small><KeywordText text="Resonance" /></small>
                        <strong>{characterClass.baseStats.resonance} attacks</strong>
                      </span>
                      <span
                        className="character-class-card-detail"
                        tabIndex={0}
                        aria-label={`Attunement: ${ATTUNEMENT_DESCRIPTION}`}
                      >
                        <small><KeywordText text="Attunement" /></small>
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

interface AuthGatewayProps {
  authentication: AuthenticationState
  onSignIn: (
    email: string,
    password: string,
    options?: SignInOptions,
  ) => Promise<boolean>
  onSignUp: (
    email: string,
    password: string,
    options?: SignInOptions,
  ) => Promise<SignUpResult | null>
  onSignInWithDiscord: (options?: SignInOptions) => Promise<boolean>
  onSignOut: () => Promise<boolean>
}

function AuthGateway({
  authentication,
  onSignIn,
  onSignUp,
  onSignInWithDiscord,
  onSignOut,
}: AuthGatewayProps) {
  return (
    <section className="auth-gateway" aria-labelledby="auth-gateway-title">
      <div className="dashboard-panel">
        <p className="screen-kicker">Account access</p>
        <h2 id="auth-gateway-title">Sign in to continue</h2>
        <p>
          Prepare this device for account-backed progression before opening the run dashboard.
        </p>
        <AuthPanel
          authentication={authentication}
          onSignIn={onSignIn}
          onSignUp={onSignUp}
          onSignInWithDiscord={onSignInWithDiscord}
          onSignOut={onSignOut}
        />
      </div>
    </section>
  )
}

interface ResultsScreenProps {
  result: RunResultSnapshot
  runReward: RunRewardState
  terminalSaveState: RunWriteState
  terminalSaveError: string | null
  championSaveState: 'idle' | 'saving' | 'saved' | 'error'
  championSaveError: string | null
  championConfigurationError: string | null
  onSaveChampion: (name: string) => Promise<void>
  onReturn: () => void
  onRetryTerminalSave: () => void
  onRetryReward: () => void
}

function ResultsScreen({
  result,
  runReward,
  terminalSaveState,
  terminalSaveError,
  championSaveState,
  championSaveError,
  championConfigurationError,
  onSaveChampion,
  onReturn,
  onRetryTerminalSave,
  onRetryReward,
}: ResultsScreenProps) {
  const victory = result.outcome === 'victory'
  const essenceReceipt = createEssenceReceipt(result)
  const [championName, setChampionName] = useState('My Champion')
  return (
    <section
      className={`results-screen${victory ? ' victory-screen' : ''}`}
      aria-labelledby="results-title"
    >
      <div className="results-panel">
        <p className="screen-kicker">{victory ? 'Run victorious' : 'Run complete'}</p>
        <h2 id="results-title">{victory ? 'Victory' : 'Defeat'}</h2>
        <p className="results-summary" aria-live="polite">
          {victory
            ? `The final boss has fallen after ${result.killCount} kills. The depths are conquered.`
            : `Your run ended with ${result.killCount} enemies defeated.`}
        </p>
        <dl className="results-stats">
          <div><dt>Elapsed time</dt><dd>{formatElapsedTime(result.elapsedTime)}</dd></div>
          <div><dt>Level</dt><dd>{result.level}</dd></div>
          <div><dt>XP</dt><dd>{formatExperience(result.xp)}</dd></div>
          <div><dt>Kills</dt><dd>{result.killCount}</dd></div>
        </dl>
        <section className="skill-damage-results" aria-labelledby="skill-damage-results-title">
          <div className="skill-damage-results-heading">
            <p className="screen-kicker">Combat performance</p>
            <h3 id="skill-damage-results-title">Skill damage</h3>
          </div>
          {result.skillDamage.length > 0 ? (
            <ul>
              {result.skillDamage.map((skill) => (
                <li key={skill.skillId}>
                  <span className="results-skill-name">
                    <SkillIcon skillId={skill.skillId} size={18} />
                    {skill.name}
                  </span>
                  <strong>{formatCompactDamage(skill.damage)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="skill-damage-results-empty">No skill damage was recorded.</p>
          )}
        </section>
        <section className="skill-healing-results" aria-labelledby="skill-healing-results-title">
          <div className="skill-damage-results-heading">
            <p className="screen-kicker">Combat performance</p>
            <h3 id="skill-healing-results-title">Skill healing</h3>
          </div>
          {result.skillHealing.length > 0 ? (
            <ul>
              {result.skillHealing.map((skill) => (
                <li key={skill.skillId}>
                  <span className="results-skill-name">
                    <SkillIcon skillId={skill.skillId} size={18} />
                    {skill.name}
                  </span>
                  <strong>{formatCompactDamage(skill.healing)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="skill-damage-results-empty">No skill healing was recorded.</p>
          )}
        </section>
        {!victory && !result.forfeited ? (
          <section className="death-combat-log" aria-labelledby="death-combat-log-title">
            <div className="death-combat-log-heading">
              <p className="screen-kicker">Final 10 seconds</p>
              <h3 id="death-combat-log-title">Damage and healing log</h3>
            </div>
            {result.playerCombatLog.length > 0 ? (
              <ol>
                {result.playerCombatLog.map((entry, index) => (
                  <li className={`death-combat-log-entry ${entry.kind}`} key={`${entry.time}-${index}`}>
                    <span className="death-combat-log-time">
                      {Math.max(0, result.elapsedTime - entry.time).toFixed(1)}s ago
                    </span>
                    <span>
                      {entry.kind === 'damage'
                        ? `${Math.ceil(entry.amount)} ${entry.damageType ?? 'unknown'} damage`
                        : `Healed ${Math.ceil(entry.amount)}`}
                    </span>
                    <span>{entry.source}</span>
                    <strong>{Math.ceil(entry.resultingHp)} HP</strong>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="death-combat-log-empty">No damage or healing was recorded before defeat.</p>
            )}
          </section>
        ) : null}
        <section className="essence-receipt" aria-labelledby="essence-receipt-title">
          <div className="essence-receipt-heading">
            <p className="screen-kicker">Run reward</p>
            <h3 id="essence-receipt-title">Essence receipt</h3>
          </div>
          <dl className="essence-receipt-calculation">
            <div><dt>Level {result.level}</dt><dd>+{essenceReceipt.levelReward}</dd></div>
            <div>
              <dt>Kill bonus ({result.killCount} kills / 10)</dt>
              <dd>+{essenceReceipt.killReward}</dd>
            </div>
            <div className="essence-receipt-subtotal">
              <dt>Base Essence</dt><dd>{essenceReceipt.baseEssence}</dd>
            </div>
            {essenceReceipt.modifiers.length > 0
              ? essenceReceipt.modifiers.map((modifier) => (
                <div key={modifier.id}>
                  <dt>{modifier.name}</dt>
                  <dd>×{modifier.essenceRewardMultiplier.toFixed(2)}</dd>
                </div>
              ))
              : <div><dt>No world modifiers</dt><dd>×1.00</dd></div>}
            <div className="essence-receipt-subtotal">
              <dt>World modifier multiplier</dt>
              <dd>×{essenceReceipt.modifierMultiplier.toFixed(2)}</dd>
            </div>
            <div>
              <dt>Victory bonus</dt>
              <dd>×{essenceReceipt.victoryMultiplier.toFixed(2)}</dd>
            </div>
            <div className="essence-receipt-subtotal">
              <dt>Total multiplier</dt>
              <dd>×{(
                essenceReceipt.modifierMultiplier * essenceReceipt.victoryMultiplier
              ).toFixed(2)}</dd>
            </div>
            <div className="essence-receipt-total">
              <dt>Essence</dt>
              <dd>{essenceReceipt.projectedReward}</dd>
            </div>
          </dl>
        </section>
        {victory ? (
          <section className="champion-save-panel" aria-labelledby="champion-save-title">
            <div>
              <p className="screen-kicker">Preserve the build</p>
              <h3 id="champion-save-title">Save as Champion</h3>
            </div>
            <p>
              Save this completed build for a future Infinite Abyss attempt.
              Runtime HP, cooldowns, and positions are not copied.
            </p>
            <label htmlFor="champion-name">Champion name</label>
            <input
              id="champion-name"
              value={championName}
              maxLength={32}
              onChange={(event) => setChampionName(event.target.value)}
              disabled={championSaveState === 'saving' || championSaveState === 'saved'}
            />
            {championSaveError || championConfigurationError ? (
              <p className="persistence-error" role="alert">
                {championSaveError ?? championConfigurationError}
              </p>
            ) : null}
            {championSaveState === 'saved' ? (
              <p className="persistence-status" role="status">Champion saved.</p>
            ) : (
              <button
                className="secondary-action"
                type="button"
                onClick={() => { void onSaveChampion(championName) }}
                disabled={terminalSaveState !== 'saved' || championSaveState === 'saving'}
              >
                {championSaveState === 'saving' ? 'Saving Champion…' : 'Save Champion'}
              </button>
            )}
          </section>
        ) : null}
        {terminalSaveState === 'saving' ? (
          <p className="persistence-status" role="status">
            Saving the completed dungeon run…
          </p>
        ) : null}
        {terminalSaveState === 'error' || terminalSaveState === 'unavailable' ? (
          <>
            <p className="persistence-error" role="alert">
              {terminalSaveError ?? 'Unable to save the completed dungeon run.'}
            </p>
            <button className="secondary-action" type="button" onClick={onRetryTerminalSave}>
              Retry run save
            </button>
          </>
        ) : null}
        {runReward.status === 'error' || runReward.status === 'unavailable' ? (
          <p className="persistence-error" role="alert">{runReward.error}</p>
        ) : null}
        {runReward.status === 'error' ? (
          <button className="secondary-action" type="button" onClick={onRetryReward}>
            Retry Essence reward
          </button>
        ) : null}
        <button
          className="primary-action"
          type="button"
          onClick={onReturn}
          disabled={terminalSaveState !== 'saved'}
        >
          {terminalSaveState === 'saving' ? 'Saving run…' : 'Return to Dashboard'}
        </button>
      </div>
    </section>
  )
}

export default App
