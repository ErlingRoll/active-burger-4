import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RunResultSnapshot, RunConfig } from './game'
import {
  BEHAVIOR_PROFILE_DEFINITIONS,
  DEFAULT_DUNGEON_CONFIG,
  type BehaviorProfileId,
} from './game'
import {
  createDexiePersistenceStore,
  createPersistenceRepository,
  type BasicProfileDto,
  type PersistenceRepository,
  type SettingsDto,
  type SettingsPatch,
} from './persistence'
import { DEFAULT_DUNGEON_MAX_FLOOR_CONTRACT_ID } from './persistence'
import {
  AuthPanel,
  createAuthenticationService,
  type AuthenticationState,
  type AuthenticationService,
  type SignInOptions,
} from './auth'
import {
  createMetaProgressionService,
  getDungeonMaxFloorContractId,
  type MetaRunResultInput,
  type MetaProgressionService,
  type MetaProgressionSnapshot,
} from './meta'
import { MetaProgressionScreen } from './meta/MetaProgressionScreen'
import { GameCanvas } from './rendering/GameCanvas'
import {
  getWorldModifierDefinitions,
  normalizeWorldModifierIds,
  resolveWorldModifierEffects,
  WORLD_MODIFIER_DEFINITIONS,
  type WorldModifierId,
} from './content/modifiers/WorldModifiers'
import { SPAWN_BALANCE } from './content/spawning/SpawnBalance'
import {
  PLAYSTYLE_DEFINITIONS,
  type PlaystyleId,
} from './content/playstyles/Playstyles'
import './App.css'

type AppScreen = 'dashboard' | 'run-setup' | 'meta-progression' | 'gameplay' | 'results'
type PersistenceLoadState = 'loading' | 'ready' | 'error'
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
  purchaseState: 'idle' | 'purchasing' | 'saved' | 'error'
  purchaseError: string | null
  activePurchaseUnlockId: string | null
}

interface RunRewardState {
  status: 'idle' | 'submitting' | 'saved' | 'error' | 'unavailable'
  essenceAwarded: number | null
  error: string | null
}

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

interface EssenceReceipt {
  levelReward: number
  killReward: number
  victoryBonus: number
  baseEssence: number
  modifierMultiplier: number
  projectedReward: number
  modifiers: ReturnType<typeof getWorldModifierDefinitions>
}

function createEssenceReceipt(result: RunResultSnapshot): EssenceReceipt {
  const modifiers = getWorldModifierDefinitions(
    normalizeWorldModifierIds(result.worldModifierIds),
  )
  const levelReward = Math.max(1, result.level)
  const killReward = Math.floor(Math.max(0, result.killCount) / 10)
  const victoryBonus = result.outcome === 'victory' ? 20 : 0
  const baseEssence = levelReward + killReward + victoryBonus
  const modifierMultiplier = modifiers.reduce(
    (total, modifier) => total * modifier.essenceRewardMultiplier,
    1,
  )
  return {
    levelReward,
    killReward,
    victoryBonus,
    baseEssence,
    modifierMultiplier,
    projectedReward: Math.max(1, Math.floor(baseEssence * modifierMultiplier)),
    modifiers,
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to access local persistence.'
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
        purchaseError: null,
        activePurchaseUnlockId: null,
      }
    : {
        loadState: 'unavailable',
        snapshot: null,
        error: configurationError ?? 'Meta progression is unavailable.',
        purchaseState: 'idle',
        purchaseError: null,
        activePurchaseUnlockId: null,
      }
}

function getMaxFloorContractIdFromMetaDefinition(definition: MetaProgressionSnapshot['definitions'][number]): string | null {
  const contractId = getDungeonMaxFloorContractId(definition)
  return contractId
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
  const repository = useMemo<PersistenceRepository>(
    () => createPersistenceRepository(createDexiePersistenceStore()),
    [],
  )
  const [screen, setScreen] = useState<AppScreen>('dashboard')
  const authenticationService = useMemo(() => {
    try {
      return {
        service: createAuthenticationService({
          supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
          supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
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
  const [authentication, setAuthentication] = useState<AuthenticationState>(() =>
    createInitialAuthenticationState(
      authenticationService.service,
      authenticationService.configurationError,
    ),
  )
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
      seed: runSeed,
      behaviorProfileId: settings.selectedBehaviorProfileId,
      playstyleId: settings.selectedPlaystyleId,
      worldModifierIds: settings.selectedWorldModifierIds,
      ...(selectedContractIsDefault
        ? {}
        : {
            dungeonMaxFloorContractId: settings.selectedDungeonMaxFloorContractId,
            unlockedDungeonMaxFloorIds,
          }),
    }
  }, [profile, runSeed, settings])

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

  const refreshMetaProgression = useCallback((): void => {
    setMetaProgression((current) => ({
      ...current,
      loadState: 'loading',
      error: null,
    }))
    setMetaLoadAttempt((attempt) => attempt + 1)
  }, [])

  const openMetaProgression = useCallback((): void => {
    if (authentication.account) {
      setScreen('meta-progression')
    }
  }, [authentication.account])

  const openRunSetup = useCallback((): void => {
    if (authentication.account) {
      setScreen('run-setup')
    }
  }, [authentication.account])

  const closeRunSetup = useCallback((): void => {
    setScreen('dashboard')
  }, [])

  const closeMetaProgression = useCallback((): void => {
    setScreen('dashboard')
  }, [])

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
      setMetaProgression(createInitialMetaProgressionState(
        metaProgressionService.service,
        metaProgressionService.configurationError,
      ))
      setMetaLoadAttempt(0)
      setMetaLoadedAttempt(0)
      setScreen('dashboard')
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
  ])

  const selectDungeonMaxFloorContract = useCallback(
    (contractId: string): void => {
      if (!profile || !DUNGEON_MAX_FLOOR_CONTRACTS.some((contract) => contract.id === contractId)) {
        return
      }
      const contract = DUNGEON_MAX_FLOOR_CONTRACTS.find((candidate) => candidate.id === contractId)!
      if (!isMaxFloorContractUnlocked(
        profile,
        contract.id,
        'requiredUnlockId' in contract ? contract.requiredUnlockId : undefined,
      )) {
        return
      }
      void persistSettings({ selectedDungeonMaxFloorContractId: contractId }).catch(() => {
        // persistSettings already exposes this error in the UI.
      })
    },
    [persistSettings, profile],
  )

  const selectPlaystyle = useCallback(
    (playstyleId: PlaystyleId): void => {
      void persistSettings({ selectedPlaystyleId: playstyleId }).catch(() => {
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

  const startRun = useCallback((): void => {
    setResult(null)
    setWriteError(null)
    setRunSeed(createRunSeed())
    setActiveRunSubmission({
      runId: crypto.randomUUID(),
      pendingResultId: crypto.randomUUID(),
      completedAt: '',
      level: 1,
      killCount: 0,
      outcome: 'defeat',
      worldModifierIds: [],
    })
    setRunReward({ status: 'idle', essenceAwarded: null, error: null })
    setRunId((currentRunId) => currentRunId + 1)
    setScreen('gameplay')
  }, [])

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

  const handleRunEnd = useCallback((runResult: RunResultSnapshot): void => {
    setResult(runResult)
    setScreen('results')
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
    void submitRunReward(submission)
  }, [activeRunSubmission, submitRunReward])

  const purchaseUnlock = useCallback(async (unlockId: string): Promise<void> => {
    if (!metaProgressionService.service || !authentication.account) {
      return
    }
    const snapshot = metaProgression.snapshot
    if (!snapshot) {
      return
    }
    const definition = snapshot.definitions.find((candidate) => candidate.id === unlockId)
    if (!definition) {
      setMetaProgression((current) => ({
        ...current,
        purchaseState: 'error',
        purchaseError: `Unknown unlock definition: ${unlockId}`,
      }))
      return
    }
    const contractId = getMaxFloorContractIdFromMetaDefinition(definition)
    if (!contractId) {
      setMetaProgression((current) => ({
        ...current,
        purchaseState: 'error',
        purchaseError: `Unlock ${unlockId} does not map to a dungeon maximum-floor contract.`,
      }))
      return
    }
    setMetaProgression((current) => ({
      ...current,
      purchaseState: 'purchasing',
      purchaseError: null,
      activePurchaseUnlockId: unlockId,
    }))
    try {
      const nextSnapshot = await metaProgressionService.service.purchaseUnlock(unlockId)
      const nextProfile = await repository.unlockDungeonMaxFloor(contractId)
      setPersistence((current) => ({
        ...current,
        profile: nextProfile,
      }))
      setMetaProgression((current) => ({
        ...current,
        snapshot: nextSnapshot,
        purchaseState: 'saved',
        purchaseError: null,
        activePurchaseUnlockId: null,
      }))
    } catch (error: unknown) {
      setMetaProgression((current) => ({
        ...current,
        purchaseState: 'error',
        purchaseError: errorMessage(error),
        activePurchaseUnlockId: null,
      }))
    }
  }, [authentication.account, metaProgression.snapshot, metaProgressionService.service, repository])

  const returnToDashboard = useCallback((): void => {
    setResult(null)
    setScreen('dashboard')
  }, [])


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
            purchaseError: null,
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

  if (persistence.loadState === 'loading') {
    return (
      <main className="app-shell">
        <AppHeader authentication={authentication} onSignOut={signOut} />
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
        <AppHeader authentication={authentication} onSignOut={signOut} />
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
        <AppHeader authentication={authentication} onSignOut={signOut} />
      ) : null}
      {screen === 'dashboard' ? (
        authentication.account ? (
          <GameDashboard
            essenceBalance={metaProgression.snapshot?.wallet.essenceBalance ?? null}
            onOpenMetaProgression={openMetaProgression}
            onOpenRunSetup={openRunSetup}
          />
        ) : (
          <AuthGateway
            authentication={authentication}
            onSignIn={signIn}
            onSignInWithDiscord={signInWithDiscord}
            onSignOut={signOut}
          />
        )
      ) : null}
      {screen === 'run-setup' && authentication.account ? (
        <RunSetupScreen
          settings={settings}
          profile={profile}
          essenceBalance={metaProgression.snapshot?.wallet.essenceBalance ?? null}
          writeError={writeError}
          onStart={startRun}
          onSelectBehaviorProfile={selectBehaviorProfile}
          onSelectDungeonMaxFloorContract={selectDungeonMaxFloorContract}
          onSelectPlaystyle={selectPlaystyle}
          onToggleWorldModifier={toggleWorldModifier}
          onBack={closeRunSetup}
        />
      ) : null}
      {screen === 'meta-progression' && authentication.account ? (
        <MetaProgressionScreen
          snapshot={metaProgression.snapshot}
          profile={profile}
          loadState={metaProgression.loadState}
          loadError={metaProgression.error}
          purchaseState={metaProgression.purchaseState}
          purchaseError={metaProgression.purchaseError}
          activePurchaseUnlockId={metaProgression.activePurchaseUnlockId}
          onBack={closeMetaProgression}
          onRefresh={refreshMetaProgression}
          onPurchaseUnlock={(unlockId) => { void purchaseUnlock(unlockId) }}
        />
      ) : null}
      {screen === 'gameplay' ? (
        <GameCanvas
          key={runId}
          runConfig={runConfig}
          onRunEnd={handleRunEnd}
          onBehaviorProfileChange={selectBehaviorProfile}
        />
      ) : null}
      {screen === 'results' && result ? (
        <ResultsScreen
          result={result}
          runReward={runReward}
          onReturn={returnToDashboard}
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
  onSignOut: () => Promise<boolean>
}

function AppHeader({
  authentication,
  onSignOut,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <div>
        <p className="app-kicker">Active Burger 4</p>
        <h1>Active Burger</h1>
      </div>
      {authentication.account ? (
        <div className="app-account">
          <span className="app-account-label">Signed in</span>
          <strong className="app-account-email">
            {authentication.account.displayName ?? authentication.account.email ?? 'Account unavailable'}
          </strong>
          {authentication.error ? (
            <span className="app-account-error">{authentication.error}</span>
          ) : null}
          <button className="app-sign-out" type="button" onClick={() => { void onSignOut() }}>
            Sign out
          </button>
        </div>
      ) : null}
    </header>
  )
}

interface GameDashboardProps {
  essenceBalance: number | null
  onOpenRunSetup: () => void
  onOpenMetaProgression: () => void
}

function GameDashboard({
  essenceBalance,
  onOpenRunSetup,
  onOpenMetaProgression,
}: GameDashboardProps) {
  return (
    <section className="dashboard game-dashboard" aria-labelledby="game-dashboard-title">
      <div className="dashboard-panel game-dashboard-panel">
        <header className="game-dashboard-hero">
          <div className="game-dashboard-hero-copy">
            <p className="screen-kicker">Command deck</p>
            <h2 id="game-dashboard-title">The dungeon is waiting.</h2>
            <p>
              Prepare your fighter, choose your risk, and descend farther than your last run.
            </p>
          </div>
        </header>

        <div className="game-dashboard-overview">
          <dl className="game-dashboard-stats">
            <div className="game-dashboard-stat game-dashboard-stat-essence">
              <dt>Essence</dt>
              <dd>{essenceBalance === null ? '—' : essenceBalance.toLocaleString()}</dd>
              <span>Spend it on upgrades</span>
            </div>
          </dl>
          <button
            className="game-dashboard-action game-dashboard-action-secondary"
            type="button"
            onClick={onOpenMetaProgression}
          >
            <span className="game-dashboard-action-icon" aria-hidden="true">✦</span>
            <span>
              <strong>Essence store</strong>
              <small>Turn earned Essence into deeper dungeon access.</small>
            </span>
            <span className="game-dashboard-action-arrow" aria-hidden="true">→</span>
          </button>
        </div>

        <section className="game-dashboard-actions" aria-labelledby="dashboard-actions-title">
          <div className="game-dashboard-section-heading">
            <h3 id="dashboard-actions-title">Game modes</h3>
          </div>
          <div className="game-dashboard-action-grid">
            <button
              className="game-dashboard-action game-dashboard-action-primary"
              type="button"
              onClick={onOpenRunSetup}
            >
              <span className="game-dashboard-action-icon" aria-hidden="true">↓</span>
              <span>
                <strong>Prepare dungeon</strong>
                <small>Configure your fighter and descend into the dungeon.</small>
              </span>
              <span className="game-dashboard-action-arrow" aria-hidden="true">→</span>
            </button>
          </div>
        </section>

      </div>
    </section>
  )
}

interface RunSetupScreenProps {
  settings: SettingsDto
  profile: BasicProfileDto
  essenceBalance: number | null
  writeError: string | null
  onStart: () => void
  onSelectBehaviorProfile: (profileId: BehaviorProfileId) => void
  onSelectDungeonMaxFloorContract: (contractId: string) => void
  onSelectPlaystyle: (playstyleId: PlaystyleId) => void
  onToggleWorldModifier: (modifierId: WorldModifierId) => void
  onBack: () => void
}

function RunSetupScreen({
  settings,
  profile,
  essenceBalance,
  writeError,
  onStart,
  onSelectBehaviorProfile,
  onSelectDungeonMaxFloorContract,
  onSelectPlaystyle,
  onToggleWorldModifier,
  onBack,
}: RunSetupScreenProps) {
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
          <div className="run-setup-identity">
            <span className="run-setup-identity-label">Run setup</span>
            <strong>Configuration saves automatically</strong>
          </div>
        </header>
        <div className="run-dashboard-hero">
          <div>
            <p className="screen-kicker">Prepare your descent</p>
            <h2 id="dashboard-title">Build your next run.</h2>
            <p>
              Shape the fight before you enter. Every choice below changes how your
              hero survives, moves, and grows in the dungeon.
            </p>
          </div>
          <div className="run-dashboard-emblem" aria-hidden="true">
            <span>AB</span>
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className="run-dashboard-command">
          <div>
            <span className="run-dashboard-command-label">Run briefing</span>
            <strong>Arena run</strong>
            <span>Configure your fighter, maximum floor, and risk level.</span>
          </div>
          <button className="primary-action run-dashboard-start" type="button" onClick={onStart}>
            <span>Start Run</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
        <div className="run-dashboard-utility">
          <div className="essence-balance" aria-live="polite">
            <span className="essence-balance-label">Essence</span>
            <strong>{essenceBalance === null ? '—' : essenceBalance.toLocaleString()}</strong>
          </div>
        </div>
        {writeError ? <p className="persistence-error" role="alert">{writeError}</p> : null}
        <div className="run-dashboard-section-heading">
          <p className="screen-kicker">Set the pace</p>
          <h3>Choose how the run plays</h3>
        </div>
        <fieldset className="dashboard-choice-group run-dashboard-choice-group">
          <legend>Behavior profile</legend>
          <div className="dashboard-choice-list">
            {Object.values(BEHAVIOR_PROFILE_DEFINITIONS).map((profileDefinition) => (
              <button
                className={`dashboard-choice${
                  settings.selectedBehaviorProfileId === profileDefinition.id ? ' selected' : ''
                }`}
                type="button"
                aria-pressed={settings.selectedBehaviorProfileId === profileDefinition.id}
                key={profileDefinition.id}
                onClick={() => onSelectBehaviorProfile(profileDefinition.id)}
              >
                <strong>{profileDefinition.name}</strong>
                <span>{profileDefinition.description}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="dashboard-choice-group run-dashboard-choice-group">
          <legend>Character</legend>
          <div className="dashboard-choice-list">
            {Object.values(PLAYSTYLE_DEFINITIONS).map((playstyle) => {
              const selected = settings.selectedPlaystyleId === playstyle.id
              return (
                <button
                  className={`dashboard-choice${selected ? ' selected' : ''}`}
                  type="button"
                  aria-pressed={selected}
                  key={playstyle.id}
                  onClick={() => onSelectPlaystyle(playstyle.id)}
                >
                  <strong>{playstyle.name}</strong>
                  <span>{playstyle.description}</span>
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
                  <strong>{modifier.name} · +{modifier.difficulty}</strong>
                  <span>{modifier.description} Reward {modifier.essenceRewardMultiplier.toFixed(2)}x</span>
                </button>
              )
            })}
          </div>
        </fieldset>
        <fieldset className="dashboard-choice-group run-dashboard-choice-group">
          <legend>Maximum floor</legend>
          <div className="dashboard-choice-list">
            {DUNGEON_MAX_FLOOR_CONTRACTS.map((contract) => {
              const unlocked = isMaxFloorContractUnlocked(
                profile,
                contract.id,
                'requiredUnlockId' in contract ? contract.requiredUnlockId : undefined,
              )
              const selected = settings.selectedDungeonMaxFloorContractId === contract.id
              return (
                <button
                  className={`dashboard-choice${selected ? ' selected' : ''}`}
                  type="button"
                  aria-pressed={selected}
                  disabled={!unlocked}
                  key={contract.id}
                  onClick={() => onSelectDungeonMaxFloorContract(contract.id)}
                >
                  <strong>{contract.label}</strong>
                  <span>{unlocked ? (selected ? 'Selected' : 'Select') : 'Locked'}</span>
                </button>
              )
            })}
          </div>
        </fieldset>
        <div className="run-dashboard-footer">
          <div>
            <p className="screen-kicker">How it works</p>
            <ul className="control-list">
          <li><strong>Movement:</strong> your selected behavior profile guides actions.</li>
          <li><strong>Combat:</strong> attacks happen automatically.</li>
          <li><strong>Upgrade:</strong> choose one option whenever you level up.</li>
        </ul>
          </div>
          <button className="primary-action run-dashboard-start" type="button" onClick={onStart}>
            <span>Start Run</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
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
  onSignInWithDiscord: (options?: SignInOptions) => Promise<boolean>
  onSignOut: () => Promise<boolean>
}

function AuthGateway({
  authentication,
  onSignIn,
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
  onReturn: () => void
  onRetryReward: () => void
}

function ResultsScreen({
  result,
  runReward,
  onReturn,
  onRetryReward,
}: ResultsScreenProps) {
  const victory = result.outcome === 'victory'
  const essenceReceipt = createEssenceReceipt(result)
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
          <div><dt>XP</dt><dd>{result.xp}</dd></div>
          <div><dt>Kills</dt><dd>{result.killCount}</dd></div>
        </dl>
        {!victory ? (
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
            <div><dt>Victory bonus</dt><dd>+{essenceReceipt.victoryBonus}</dd></div>
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
              <dt>Total multiplier</dt>
              <dd>×{essenceReceipt.modifierMultiplier.toFixed(2)}</dd>
            </div>
            <div className="essence-receipt-total">
              <dt>Projected Essence</dt>
              <dd>{essenceReceipt.projectedReward}</dd>
            </div>
          </dl>
        </section>
        {runReward.status === 'error' || runReward.status === 'unavailable' ? (
          <p className="persistence-error" role="alert">{runReward.error}</p>
        ) : null}
        {runReward.status === 'error' ? (
          <button className="secondary-action" type="button" onClick={onRetryReward}>
            Retry Essence reward
          </button>
        ) : null}
        <button className="primary-action" type="button" onClick={onReturn}>
          Return to Dashboard
        </button>
      </div>
    </section>
  )
}

export default App
