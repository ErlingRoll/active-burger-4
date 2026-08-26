import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  type PendingCompletedRunResultDto,
  type PersistenceRepository,
  type SettingsDto,
  type SettingsPatch,
} from './persistence'
import { DEFAULT_DUNGEON_LENGTH_CONTRACT_ID } from './persistence'
import {
  AuthPanel,
  createAuthenticationService,
  type AuthenticationState,
  type AuthenticationService,
} from './auth'
import {
  createMetaProgressionService,
  createPendingRunSyncCoordinator,
  getDungeonLengthContractId,
  type PendingRunSyncCoordinator,
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

type AppScreen = 'dashboard' | 'meta-progression' | 'gameplay' | 'results'
type PersistenceLoadState = 'loading' | 'ready' | 'error'
type PendingResultState = 'idle' | 'saving' | 'saved' | 'error'

interface PersistenceState {
  loadState: PersistenceLoadState
  settings: SettingsDto | null
  profile: BasicProfileDto | null
  pendingResults: PendingCompletedRunResultDto[]
  error: string | null
}

interface MetaProgressionState {
  loadState: 'idle' | 'loading' | 'ready' | 'error' | 'unavailable'
  snapshot: MetaProgressionSnapshot | null
  error: string | null
  syncState: 'idle' | 'syncing' | 'saved' | 'error'
  syncError: string | null
  purchaseState: 'idle' | 'purchasing' | 'saved' | 'error'
  purchaseError: string | null
  activePurchaseUnlockId: string | null
}

const DEFAULT_CONTRACT = {
  id: DEFAULT_DUNGEON_LENGTH_CONTRACT_ID,
  lengthSeconds: DEFAULT_DUNGEON_CONFIG.defaultLengthSeconds,
  label: '10 minutes · Default',
} as const

const DUNGEON_CONTRACTS = [
  DEFAULT_CONTRACT,
  ...DEFAULT_DUNGEON_CONFIG.longerLengthContracts.map((contract) => ({
    ...contract,
    label: `${contract.lengthSeconds / 60} minutes`,
  })),
]

function formatElapsedTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(totalSeconds / 60)
  const remainder = totalSeconds % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to access local persistence.'
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
        syncState: 'idle',
        syncError: null,
        purchaseState: 'idle',
        purchaseError: null,
        activePurchaseUnlockId: null,
      }
    : {
        loadState: 'unavailable',
        snapshot: null,
        error: configurationError ?? 'Meta progression is unavailable.',
        syncState: 'idle',
        syncError: null,
        purchaseState: 'idle',
        purchaseError: null,
        activePurchaseUnlockId: null,
      }
}

function getContractIdFromMetaDefinition(definition: MetaProgressionSnapshot['definitions'][number]): string | null {
  const contractId = getDungeonLengthContractId(definition)
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

function isContractUnlocked(
  profile: BasicProfileDto,
  contractId: string,
  requiredUnlockId?: string,
): boolean {
  return contractId === DEFAULT_DUNGEON_LENGTH_CONTRACT_ID ||
    profile.unlockedDungeonLengthIds.includes(contractId) ||
    (requiredUnlockId !== undefined &&
      profile.unlockedDungeonLengthIds.includes(requiredUnlockId))
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
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [result, setResult] = useState<RunResultSnapshot | null>(null)
  const [pendingResultState, setPendingResultState] =
    useState<PendingResultState>('idle')
  const [persistence, setPersistence] = useState<PersistenceState>({
    loadState: 'loading',
    settings: null,
    profile: null,
    pendingResults: [],
    error: null,
  })
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [metaLoadAttempt, setMetaLoadAttempt] = useState(0)
  const [metaLoadedAttempt, setMetaLoadedAttempt] = useState(0)
  const [writeError, setWriteError] = useState<string | null>(null)
  const pendingResultsRef = useRef(persistence.pendingResults)
  const syncRuntimeRef = useRef({
    account: authentication.account,
    screen,
    service: metaProgressionService.service,
  })
  const [pendingRunSyncCoordinator] = useState<PendingRunSyncCoordinator>(
    () => createPendingRunSyncCoordinator({
      canSync: () => {
        const { account, screen: currentScreen, service } = syncRuntimeRef.current
        return account !== null && service !== null && currentScreen !== 'gameplay'
      },
      getPendingResults: () => pendingResultsRef.current,
      syncPendingResults: (results) => {
        const service = syncRuntimeRef.current.service
        if (!service) {
          throw new Error('Meta progression is unavailable.')
        }
        return service.syncPendingResults(results)
      },
      removePendingResult: (id) => repository.removePendingRunResult(id),
      onSyncStart: () => {
        setMetaProgression((current) => ({
          ...current,
          syncState: 'syncing',
          syncError: null,
        }))
      },
      onSyncSuccess: (results, syncResult) => {
        const resultIds = new Set(results.map((result) => result.id))
        const remainingResults = pendingResultsRef.current.filter(
          (result) => !resultIds.has(result.id),
        )
        pendingResultsRef.current = remainingResults
        setPersistence((current) => ({
          ...current,
          pendingResults: current.pendingResults.filter(
            (result) => !resultIds.has(result.id),
          ),
        }))
        setMetaProgression((current) => ({
          ...current,
          snapshot: syncResult.snapshot,
          syncState: 'saved',
          syncError: null,
        }))
      },
      onNoPendingResults: () => {
        setMetaProgression((current) => ({
          ...current,
          syncState: 'saved',
          syncError: null,
        }))
      },
      onSyncError: (error: unknown) => {
        setMetaProgression((current) => ({
          ...current,
          syncState: 'error',
          syncError: errorMessage(error),
        }))
      },
    }),
  )

  useEffect(() => {
    syncRuntimeRef.current = {
      account: authentication.account,
      screen,
      service: metaProgressionService.service,
    }
  }, [authentication.account, metaProgressionService.service, screen])

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
    void Promise.all([
      repository.getSettings(),
      repository.getBasicProfile(),
      repository.listPendingRunResults(),
    ])
      .then(async ([loadedSettings, profile, pendingResults]) => {
        const selectedContract = DUNGEON_CONTRACTS.find(
          (contract) => contract.id === loadedSettings.selectedDungeonLengthContractId,
        )
        const validContract = selectedContract !== undefined &&
          isContractUnlocked(profile, selectedContract.id, 'requiredUnlockId' in selectedContract
            ? selectedContract.requiredUnlockId
            : undefined)
        const settings = validContract
          ? loadedSettings
          : await repository.saveSettings({
              ...loadedSettings,
              selectedDungeonLengthContractId: DEFAULT_DUNGEON_LENGTH_CONTRACT_ID,
            })
        if (!cancelled) {
          pendingResultsRef.current = pendingResults
          setPersistence({
            loadState: 'ready',
            settings,
            profile,
            pendingResults,
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
  const pendingResults = persistence.pendingResults
  const pendingCount = pendingResults.length
  const runConfig = useMemo<RunConfig | null>(() => {
    if (!settings || !profile) {
      return null
    }
    const unlockedDungeonLengthIds = DEFAULT_DUNGEON_CONFIG.longerLengthContracts
      .filter((contract) =>
        isContractUnlocked(profile, contract.id, contract.requiredUnlockId),
      )
      .map((contract) => contract.requiredUnlockId)
    const selectedContractIsDefault =
      settings.selectedDungeonLengthContractId === DEFAULT_DUNGEON_LENGTH_CONTRACT_ID
    return {
      seed: 3,
      behaviorProfileId: settings.selectedBehaviorProfileId,
      playstyleId: settings.selectedPlaystyleId,
      worldModifierIds: settings.selectedWorldModifierIds,
      ...(selectedContractIsDefault
        ? {}
        : {
            dungeonLengthContractId: settings.selectedDungeonLengthContractId,
            unlockedDungeonLengthIds,
          }),
    }
  }, [profile, settings])

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

  const closeMetaProgression = useCallback((): void => {
    setScreen('dashboard')
  }, [])

  const signIn = useCallback(
    async (email: string, password: string): Promise<boolean> => {
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
        const account = await service.signInWithPassword(email, password)
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

  const selectDungeonContract = useCallback(
    (contractId: string): void => {
      if (!profile || !DUNGEON_CONTRACTS.some((contract) => contract.id === contractId)) {
        return
      }
      const contract = DUNGEON_CONTRACTS.find((candidate) => candidate.id === contractId)!
      if (!isContractUnlocked(
        profile,
        contract.id,
        'requiredUnlockId' in contract ? contract.requiredUnlockId : undefined,
      )) {
        return
      }
      void persistSettings({ selectedDungeonLengthContractId: contractId }).catch(() => {
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
    const nextRunId = globalThis.crypto?.randomUUID?.() ??
      `run-${Date.now()}-${runId + 1}`
    syncRuntimeRef.current.screen = 'gameplay'
    setResult(null)
    setPendingResultState('idle')
    setWriteError(null)
    setActiveRunId(nextRunId)
    setRunId((currentRunId) => currentRunId + 1)
    setScreen('gameplay')
  }, [runId])

  const handleRunEnd = useCallback(
    (runResult: RunResultSnapshot): void => {
      syncRuntimeRef.current.screen = 'results'
      setResult(runResult)
      setScreen('results')
      setPendingResultState('saving')
      void repository
        .enqueuePendingRunResult({
          runId: activeRunId ?? `run-${runId}`,
          completedAt: Date.now(),
          payload: {
            ...runResult,
            phase: runResult.phase === 'defeat' ? 'defeat' : 'results',
          },
        })
        .then((queuedResult) => {
          const nextPendingResults = [...pendingResultsRef.current, queuedResult]
          pendingResultsRef.current = nextPendingResults
          setPersistence((current) => ({
            ...current,
            pendingResults: nextPendingResults,
          }))
          setPendingResultState('saved')
          void pendingRunSyncCoordinator.request([queuedResult])
        })
        .catch((error: unknown) => {
          setPendingResultState('error')
          setWriteError(errorMessage(error))
        })
    },
    [activeRunId, pendingRunSyncCoordinator, repository, runId],
  )

  const syncPendingResults = useCallback(
    (): Promise<void> => pendingRunSyncCoordinator.request(),
    [pendingRunSyncCoordinator],
  )

  useEffect(() => {
    if (persistence.loadState !== 'ready' || screen === 'gameplay') {
      return
    }
    void pendingRunSyncCoordinator.request()
  }, [
    authentication.account,
    metaProgressionService.service,
    pendingResults,
    pendingRunSyncCoordinator,
    persistence.loadState,
    screen,
  ])

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
    const contractId = getContractIdFromMetaDefinition(definition)
    if (!contractId) {
      setMetaProgression((current) => ({
        ...current,
        purchaseState: 'error',
        purchaseError: `Unlock ${unlockId} does not map to a dungeon contract.`,
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
      const nextProfile = await repository.unlockDungeonLength(contractId)
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
            syncState: 'idle',
            syncError: null,
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
            <p>Opening your local profile and pending results.</p>
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
    <main className="app-shell">
      <AppHeader authentication={authentication} onSignOut={signOut} />
      {screen === 'dashboard' ? (
        authentication.account ? (
          <Dashboard
            settings={settings}
            profile={profile}
            pendingCount={pendingCount}
            writeError={writeError}
            onStart={startRun}
            onSelectBehaviorProfile={selectBehaviorProfile}
            onSelectDungeonContract={selectDungeonContract}
            onSelectPlaystyle={selectPlaystyle}
            onToggleWorldModifier={toggleWorldModifier}
            onOpenMetaProgression={openMetaProgression}
          />
        ) : (
          <AuthGateway
            authentication={authentication}
            onSignIn={signIn}
            onSignOut={signOut}
          />
        )
      ) : null}
      {screen === 'meta-progression' && authentication.account ? (
        <MetaProgressionScreen
          snapshot={metaProgression.snapshot}
          profile={profile}
          pendingCount={pendingCount}
          loadState={metaProgression.loadState}
          loadError={metaProgression.error}
          syncState={metaProgression.syncState}
          syncError={metaProgression.syncError}
          purchaseState={metaProgression.purchaseState}
          purchaseError={metaProgression.purchaseError}
          activePurchaseUnlockId={metaProgression.activePurchaseUnlockId}
          onBack={closeMetaProgression}
          onRefresh={refreshMetaProgression}
          onSyncPendingResults={() => { void syncPendingResults() }}
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
          pendingResultState={pendingResultState}
          writeError={writeError}
          onReturn={returnToDashboard}
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
        <h1>Prototype Arena</h1>
      </div>
      {authentication.account ? (
        <div className="app-account">
          <span className="app-account-label">Signed in</span>
          <strong className="app-account-email">
            {authentication.account.email ?? 'Email unavailable'}
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

interface DashboardProps {
  settings: SettingsDto
  profile: BasicProfileDto
  pendingCount: number
  writeError: string | null
  onStart: () => void
  onSelectBehaviorProfile: (profileId: BehaviorProfileId) => void
  onSelectDungeonContract: (contractId: string) => void
  onSelectPlaystyle: (playstyleId: PlaystyleId) => void
  onToggleWorldModifier: (modifierId: WorldModifierId) => void
  onOpenMetaProgression: () => void
}

function Dashboard({
  settings,
  profile,
  pendingCount,
  writeError,
  onStart,
  onSelectBehaviorProfile,
  onSelectDungeonContract,
  onSelectPlaystyle,
  onToggleWorldModifier,
  onOpenMetaProgression,
}: DashboardProps) {
  const worldModifierEffects = resolveWorldModifierEffects(
    settings.selectedWorldModifierIds,
    SPAWN_BALANCE,
  )
  return (
    <section className="dashboard" aria-labelledby="dashboard-title">
      <div className="dashboard-panel">
        <p className="screen-kicker">Run dashboard</p>
        <h2 id="dashboard-title">Ready for your next run?</h2>
        <p>
          Survive the arena while your hero automatically targets nearby
          enemies. Collect XP to level up and choose an upgrade between waves.
        </p>
        {pendingCount > 0 ? (
          <p className="persistence-status" role="status">
            <strong>Pending local result</strong>
            <span>
              {pendingCount} {pendingCount === 1 ? 'run' : 'runs'} queued for local sync.
            </span>
          </p>
        ) : null}
        <button className="secondary-action" type="button" onClick={onOpenMetaProgression}>
          Open Meta Progression
        </button>
        {writeError ? <p className="persistence-error" role="alert">{writeError}</p> : null}
        <fieldset className="dashboard-choice-group">
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
        <fieldset className="dashboard-choice-group">
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
        <fieldset className="dashboard-choice-group">
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
        <fieldset className="dashboard-choice-group">
          <legend>Dungeon contract</legend>
          <div className="dashboard-choice-list">
            {DUNGEON_CONTRACTS.map((contract) => {
              const unlocked = isContractUnlocked(
                profile,
                contract.id,
                'requiredUnlockId' in contract ? contract.requiredUnlockId : undefined,
              )
              const selected = settings.selectedDungeonLengthContractId === contract.id
              return (
                <button
                  className={`dashboard-choice${selected ? ' selected' : ''}`}
                  type="button"
                  aria-pressed={selected}
                  disabled={!unlocked}
                  key={contract.id}
                  onClick={() => onSelectDungeonContract(contract.id)}
                >
                  <strong>{contract.label}</strong>
                  <span>{unlocked ? (selected ? 'Selected' : 'Select') : 'Locked'}</span>
                </button>
              )
            })}
          </div>
        </fieldset>
        <ul className="control-list">
          <li><strong>Movement:</strong> your selected behavior profile guides actions.</li>
          <li><strong>Combat:</strong> attacks happen automatically.</li>
          <li><strong>Upgrade:</strong> choose one option whenever you level up.</li>
        </ul>
        <button className="primary-action" type="button" onClick={onStart}>
          Start Run
        </button>
      </div>
    </section>
  )
}

interface AuthGatewayProps {
  authentication: AuthenticationState
  onSignIn: (email: string, password: string) => Promise<boolean>
  onSignOut: () => Promise<boolean>
}

function AuthGateway({
  authentication,
  onSignIn,
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
          onSignOut={onSignOut}
        />
      </div>
    </section>
  )
}

interface ResultsScreenProps {
  result: RunResultSnapshot
  pendingResultState: PendingResultState
  writeError: string | null
  onReturn: () => void
}

function ResultsScreen({
  result,
  pendingResultState,
  writeError,
  onReturn,
}: ResultsScreenProps) {
  const victory = result.outcome === 'victory'
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
        <p className="persistence-status" role={pendingResultState === 'error' ? 'alert' : 'status'}>
          {pendingResultState === 'saving'
            ? 'Saving pending local result…'
            : pendingResultState === 'saved'
              ? 'Pending local result saved.'
              : pendingResultState === 'error'
                ? `Pending result could not be saved: ${writeError ?? 'unknown storage error'}`
                : null}
        </p>
        <button className="primary-action" type="button" onClick={onReturn}>
          Return to Dashboard
        </button>
      </div>
    </section>
  )
}

export default App
