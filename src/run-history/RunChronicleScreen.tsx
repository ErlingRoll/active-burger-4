import { useCallback, useEffect, useState } from 'react'
import type { RunResultSnapshot } from '../game'
import type { DungeonRunPersistenceService, FinishedDungeonRun } from '../persistence'
import { RunReport } from '../ui/RunReport'
import {
  formatCharacterClassName,
  formatRunCompletion,
  formatRunDepth,
  formatRunOutcome,
  formatWorldModifierNames,
  parseRunReport,
} from './RunChronicle'

/** How many finished runs the chronicle keeps in view. */
const CHRONICLE_LIMIT = 25

type ChronicleLoadState = 'loading' | 'ready' | 'error' | 'unavailable'

/**
 * What is known about one run's stored report.
 *
 * `absent` is a run that never saved a final snapshot, and `unreadable` is one
 * whose snapshot belongs to an older schema. Both are worth telling the player
 * apart from an empty report, because only one of them is a lost record.
 */
interface ReportState {
  status: 'loading' | 'ready' | 'absent' | 'unreadable' | 'error'
  report: RunResultSnapshot | null
  error: string | null
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to read the chronicle.'
}

export interface RunChronicleScreenProps {
  service: DungeonRunPersistenceService | null
  configurationError: string | null
  onBack: () => void
}

/**
 * The chronicle: every run that is over, and what it did.
 *
 * A run used to vanish the moment its results screen was dismissed, even
 * though the run, its final snapshot, and its Essence were all still in the
 * database. This screen is a reader over what was already there — the rows
 * come from the run and reward tables, and a run's report is rebuilt from the
 * snapshot it ended on when the player opens it.
 */
export function RunChronicleScreen({
  service,
  configurationError,
  onBack,
}: RunChronicleScreenProps) {
  const [loadState, setLoadState] = useState<ChronicleLoadState>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [runs, setRuns] = useState<readonly FinishedDungeonRun[]>([])
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)
  const [reports, setReports] = useState<Readonly<Record<string, ReportState>>>({})

  useEffect(() => {
    if (!service) {
      return
    }
    // No reset here: the list starts out loading and this runs once per
    // service, so setting it again would only cost a render.
    let cancelled = false
    void service.listFinishedRuns(CHRONICLE_LIMIT)
      .then((finished) => {
        if (cancelled) {
          return
        }
        setRuns(finished)
        setLoadState('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }
        setLoadError(errorMessage(error))
        setLoadState('error')
      })
    return () => {
      cancelled = true
    }
  }, [service])

  const openRun = useCallback((run: FinishedDungeonRun): void => {
    setExpandedRunId((current) => (current === run.runId ? null : run.runId))
    if (!service || reports[run.runId]) {
      return
    }
    setReports((current) => ({
      ...current,
      [run.runId]: { status: 'loading', report: null, error: null },
    }))
    void service.loadTerminalSnapshot(run.runId)
      .then((snapshot) => {
        if (snapshot === null) {
          setReports((current) => ({
            ...current,
            [run.runId]: { status: 'absent', report: null, error: null },
          }))
          return
        }
        const report = parseRunReport(snapshot.payload, run.outcome)
        setReports((current) => ({
          ...current,
          [run.runId]: report === null
            ? { status: 'unreadable', report: null, error: null }
            : { status: 'ready', report, error: null },
        }))
      })
      .catch((error: unknown) => {
        setReports((current) => ({
          ...current,
          [run.runId]: { status: 'error', report: null, error: errorMessage(error) },
        }))
      })
  }, [reports, service])

  /*
   * A missing service is not a state to be set: it is known while rendering,
   * and reporting it through the same two values keeps one set of branches
   * below rather than two.
   */
  const state: ChronicleLoadState = service === null ? 'unavailable' : loadState
  const error = service === null
    ? configurationError ?? 'The chronicle is unavailable.'
    : loadError
  const victories = runs.filter((run) => run.outcome === 'victory').length
  const deepestFloor = runs.reduce((deepest, run) => Math.max(deepest, run.reachedFloor), 0)

  return (
    <section className="app-screen run-chronicle-screen" aria-labelledby="run-chronicle-title">
      <div className="app-screen-frame run-chronicle-panel">
        <div className="app-screen-topbar">
          <button className="app-screen-back" type="button" onClick={onBack}>
            <span aria-hidden="true">←</span> Back to the refuge
          </button>
          {runs.length > 0 ? (
            <dl className="app-screen-stats">
              <div>
                <dt>Runs</dt>
                <dd>{runs.length}</dd>
              </div>
              <div>
                <dt>Victories</dt>
                <dd>{victories}</dd>
              </div>
              <div>
                <dt>Deepest</dt>
                <dd>Floor {deepestFloor}</dd>
              </div>
            </dl>
          ) : null}
        </div>
        <header className="app-screen-title">
          <p className="screen-kicker">Records of the descent</p>
          <h2 id="run-chronicle-title">Chronicle</h2>
          <p className="app-screen-lede">
            The last {CHRONICLE_LIMIT} runs you finished, newest first. Open one to read the
            report it ended on: how deep it went, what each skill contributed, and how the
            final seconds went.
          </p>
        </header>
        {error ? <p className="persistence-error" role="alert">{error}</p> : null}
        {state === 'loading' ? (
          <p role="status">Reading the chronicle…</p>
        ) : runs.length === 0 && state === 'ready' ? (
          <section className="app-empty-state run-chronicle-empty-state">
            <span className="app-empty-state-emblem" aria-hidden="true">✦</span>
            <h3>Nothing written yet</h3>
            <p>Finish a dungeon run or a descent into the Abyss and it will be recorded here.</p>
          </section>
        ) : (
          <ul className="run-chronicle-list" aria-label="Finished runs">
            {runs.map((run) => {
              const expanded = run.runId === expandedRunId
              const modifierNames = formatWorldModifierNames(run.worldModifierIds)
              const reportState = reports[run.runId]
              return (
                <li className={`run-chronicle-entry ${run.outcome}`} key={run.runId}>
                  <button
                    className="run-chronicle-summary"
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => openRun(run)}
                  >
                    <span className="run-chronicle-outcome">{formatRunOutcome(run.outcome)}</span>
                    <span className="run-chronicle-headline">
                      <strong>
                        {run.modeId === 'infinite-abyss' ? 'Infinite Abyss' : 'Dungeon run'}
                      </strong>
                      <small>
                        {formatCharacterClassName(run.characterClassId)}
                        {' · '}
                        {formatRunCompletion(run.completedAt)}
                      </small>
                    </span>
                    <span className="run-chronicle-figures">
                      <span>
                        <small>Depth</small>
                        <strong>{formatRunDepth(run)}</strong>
                      </span>
                      <span>
                        <small>Level</small>
                        <strong>{run.level ?? '—'}</strong>
                      </span>
                      <span>
                        <small>Kills</small>
                        <strong>{run.killCount ?? '—'}</strong>
                      </span>
                      {/* The Abyss pays no Essence, so it is not given a column
                          that would only ever hold a zero. */}
                      {run.modeId === 'infinite-abyss' ? null : (
                        <span>
                          <small>Essence</small>
                          <strong>{run.essenceEarned ?? '—'}</strong>
                        </span>
                      )}
                    </span>
                    <span className="run-chronicle-disclosure" aria-hidden="true">
                      {expanded ? '▲' : '▼'}
                    </span>
                  </button>
                  {expanded ? (
                    <div className="run-chronicle-detail">
                      {modifierNames.length > 0 ? (
                        <p className="run-chronicle-modifiers">
                          <span className="screen-kicker">World modifiers</span>
                          {modifierNames.join(' · ')}
                        </p>
                      ) : null}
                      {reportState?.status === 'loading' ? (
                        <p role="status">Reading the record…</p>
                      ) : reportState?.status === 'error' ? (
                        <p className="persistence-error" role="alert">{reportState.error}</p>
                      ) : reportState?.status === 'absent' ? (
                        <p className="run-chronicle-missing">
                          This run saved no final record, so only the figures above survive.
                        </p>
                      ) : reportState?.status === 'unreadable' ? (
                        <p className="run-chronicle-missing">
                          This run was saved by an earlier version of the game and its record can
                          no longer be read. The figures above are what remains of it.
                        </p>
                      ) : reportState?.report ? (
                        <RunReport result={reportState.report} />
                      ) : null}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
