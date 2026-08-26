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
import { DEFAULT_DUNGEON_LENGTH_CONTRACT_ID } from './persistence'
import { GameCanvas } from './rendering/GameCanvas'
import './App.css'

type AppScreen = 'dashboard' | 'gameplay' | 'results'
type PersistenceLoadState = 'loading' | 'ready' | 'error'
type PendingResultState = 'idle' | 'saving' | 'saved' | 'error'

interface PersistenceState {
  loadState: PersistenceLoadState
  settings: SettingsDto | null
  profile: BasicProfileDto | null
  pendingCount: number
  error: string | null
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
  const [runId, setRunId] = useState(0)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [result, setResult] = useState<RunResultSnapshot | null>(null)
  const [pendingResultState, setPendingResultState] =
    useState<PendingResultState>('idle')
  const [persistence, setPersistence] = useState<PersistenceState>({
    loadState: 'loading',
    settings: null,
    profile: null,
    pendingCount: 0,
    error: null,
  })
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [writeError, setWriteError] = useState<string | null>(null)

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
          setPersistence({
            loadState: 'ready',
            settings,
            profile,
            pendingCount: pendingResults.length,
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

  const startRun = useCallback((): void => {
    const nextRunId = globalThis.crypto?.randomUUID?.() ??
      `run-${Date.now()}-${runId + 1}`
    setResult(null)
    setPendingResultState('idle')
    setWriteError(null)
    setActiveRunId(nextRunId)
    setRunId((currentRunId) => currentRunId + 1)
    setScreen('gameplay')
  }, [runId])

  const handleRunEnd = useCallback(
    (runResult: RunResultSnapshot): void => {
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
        .then(() => {
          setPersistence((current) => ({
            ...current,
            pendingCount: current.pendingCount + 1,
          }))
          setPendingResultState('saved')
        })
        .catch((error: unknown) => {
          setPendingResultState('error')
          setWriteError(errorMessage(error))
        })
    },
    [activeRunId, repository, runId],
  )

  const returnToDashboard = useCallback((): void => {
    setResult(null)
    setScreen('dashboard')
  }, [])

  if (persistence.loadState === 'loading') {
    return (
      <main className="app-shell">
        <AppHeader />
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
        <AppHeader />
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
      <AppHeader />
      {screen === 'dashboard' ? (
        <Dashboard
          settings={settings}
          profile={profile}
          pendingCount={persistence.pendingCount}
          writeError={writeError}
          onStart={startRun}
          onSelectBehaviorProfile={selectBehaviorProfile}
          onSelectDungeonContract={selectDungeonContract}
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

function AppHeader() {
  return (
    <header className="app-header">
      <p className="app-kicker">Active Burger 4</p>
      <h1>Prototype Arena</h1>
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
}

function Dashboard({
  settings,
  profile,
  pendingCount,
  writeError,
  onStart,
  onSelectBehaviorProfile,
  onSelectDungeonContract,
}: DashboardProps) {
  return (
    <section className="dashboard" aria-labelledby="dashboard-title">
      <div className="dashboard-panel">
        <p className="screen-kicker">Run dashboard</p>
        <h2 id="dashboard-title">Ready for your next run?</h2>
        <p>
          Survive the arena while your hero automatically targets nearby
          enemies. Collect XP to level up and choose an upgrade between waves.
        </p>
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
        {pendingCount > 0 ? (
          <p className="persistence-status" role="status">
            {pendingCount} pending local {pendingCount === 1 ? 'result' : 'results'}
          </p>
        ) : null}
        {writeError ? <p className="persistence-error" role="alert">{writeError}</p> : null}
        <button className="primary-action" type="button" onClick={onStart}>
          Start Run
        </button>
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
        <p className="results-summary">
          {victory
            ? 'The final boss has fallen. The depths are conquered.'
            : 'Your run has ended. Here are your results.'}
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
