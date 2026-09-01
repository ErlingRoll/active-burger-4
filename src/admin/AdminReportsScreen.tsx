import { useState } from 'react'
import type { BugReport, BugReportFloorSnapshot } from '../bug-report'

interface AdminReportsScreenProps {
  reports: readonly BugReport[]
  hiddenReportIds: ReadonlySet<number>
  showHidden: boolean
  loadState: 'loading' | 'ready' | 'error'
  error: string | null
  onBack: () => void
  onRefresh: () => void
  onToggleShowHidden: () => void
  onToggleHide: (reportId: number, hidden: boolean) => void
  onLoadFloorSnapshot: (snapshotId: number) => Promise<BugReportFloorSnapshot>
}

function formatSubmittedAt(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function canPreviewImage(report: BugReport): boolean {
  return report.imageData !== null &&
    report.imageType !== null &&
    /^(image\/png|image\/jpeg|image\/gif|image\/webp|image\/bmp)$/i.test(report.imageType)
}

export function AdminReportsScreen({
  reports,
  hiddenReportIds,
  showHidden,
  loadState,
  error,
  onBack,
  onRefresh,
  onToggleShowHidden,
  onToggleHide,
  onLoadFloorSnapshot,
}: AdminReportsScreenProps) {
  const [floorSnapshot, setFloorSnapshot] = useState<{
    snapshotId: number
    state: 'loading' | 'ready' | 'error'
    snapshot: BugReportFloorSnapshot | null
    error: string | null
  } | null>(null)
  const visibleReports = showHidden
    ? reports
    : reports.filter((report) => !hiddenReportIds.has(report.id))
  const hiddenCount = reports.filter((report) => hiddenReportIds.has(report.id)).length

  const loadFloorSnapshot = (snapshotId: number): void => {
    setFloorSnapshot({ snapshotId, state: 'loading', snapshot: null, error: null })
    void onLoadFloorSnapshot(snapshotId)
      .then((snapshot) => {
        setFloorSnapshot({ snapshotId, state: 'ready', snapshot, error: null })
      })
      .catch((error: unknown) => {
        setFloorSnapshot({
          snapshotId,
          state: 'error',
          snapshot: null,
          error: error instanceof Error ? error.message : 'Unable to load saved floor.',
        })
      })
  }

  return (
    <section className="admin-reports-screen" aria-labelledby="admin-reports-title">
      <div className="admin-reports-panel">
        <header className="admin-reports-header">
          <div>
            <p className="screen-kicker">Administration</p>
            <h2 id="admin-reports-title">Bug reports</h2>
            <p>Review reports submitted by players.</p>
          </div>
          <div className="admin-reports-actions">
            <button className="secondary-action" type="button" onClick={onBack}>
              Back to dashboard
            </button>
            <button className="primary-action" type="button" onClick={onRefresh} disabled={loadState === 'loading'}>
              {loadState === 'loading' ? 'Refreshing…' : 'Refresh'}
            </button>
            <button className="secondary-action" type="button" onClick={onToggleShowHidden}>
              {showHidden ? 'Hide hidden' : `Show hidden${hiddenCount > 0 ? ` (${hiddenCount})` : ''}`}
            </button>
          </div>
        </header>
        {loadState === 'loading' ? (
          <p className="admin-reports-status" role="status">Loading bug reports…</p>
        ) : null}
        {loadState === 'error' ? (
          <p className="persistence-error" role="alert">{error ?? 'Unable to load bug reports.'}</p>
        ) : null}
        {loadState === 'ready' && reports.length === 0 ? (
          <p className="admin-reports-status">No bug reports have been submitted.</p>
        ) : null}
        {loadState === 'ready' && reports.length > 0 && visibleReports.length === 0 ? (
          <p className="admin-reports-status">All bug reports are hidden.</p>
        ) : null}
        {visibleReports.length > 0 ? (
          <div className="admin-reports-list">
            {visibleReports.map((report) => {
              const hidden = hiddenReportIds.has(report.id)
              const savedFloorId = report.savedFloorId
              return (
                <article className="admin-report-card" key={report.id}>
                  <header className="admin-report-card-header">
                    <div>
                      <strong>Report #{report.id}</strong>
                      <span>{formatSubmittedAt(report.submittedAt)}</span>
                    </div>
                    <div className="admin-report-card-controls">
                      <strong className="admin-report-username">
                        {report.username ?? report.userId}
                      </strong>
                      <code>{report.userId}</code>
                      <button
                        className="admin-report-hide"
                        type="button"
                        onClick={() => { onToggleHide(report.id, hidden) }}
                      >
                        {hidden ? 'Show' : 'Hide'}
                      </button>
                    </div>
                  </header>
                    <div className="admin-report-body">
                      <div className="admin-report-details">
                        <p className="admin-report-bug">{report.bug}</p>
                        <dl className="admin-report-context">
                          <div>
                            <dt>Dungeon</dt>
                            <dd>{report.dungeon.dungeonName} ({report.dungeon.dungeonId})</dd>
                          </div>
                          <div>
                            <dt>Floor</dt>
                            <dd>{report.dungeon.currentFloor} / {report.dungeon.maxFloor}</dd>
                          </div>
                          <div>
                            <dt>Saved floor ID</dt>
                            <dd>
                              {savedFloorId !== null ? (
                                <button
                                  className="admin-report-floor-link"
                                  type="button"
                                  onClick={() => { loadFloorSnapshot(savedFloorId) }}
                                  aria-expanded={floorSnapshot?.snapshotId === savedFloorId}
                                >
                                  {savedFloorId}
                                </button>
                              ) : 'Not available'}
                            </dd>
                          </div>
                          <div>
                            <dt>Playstyle</dt>
                            <dd>{report.dungeon.playstyleId}</dd>
                          </div>
                          {report.dungeon.runId ? (
                            <div>
                              <dt>Run</dt>
                              <dd>{report.dungeon.runId}</dd>
                            </div>
                          ) : null}
                        </dl>
                        {floorSnapshot?.snapshotId === savedFloorId ? (
                          <div className="admin-report-floor-json">
                            {floorSnapshot.state === 'loading' ? (
                              <p role="status">Loading saved floor…</p>
                            ) : floorSnapshot.state === 'error' ? (
                              <p className="persistence-error" role="alert">{floorSnapshot.error}</p>
                            ) : (
                              <pre>{JSON.stringify(floorSnapshot.snapshot?.payload, null, 2)}</pre>
                            )}
                          </div>
                        ) : null}
                      </div>
                      <div className="admin-report-media">
                        {canPreviewImage(report) ? (
                          <img
                            className="admin-report-image"
                            src={report.imageData ?? undefined}
                            alt={report.imageName ?? 'Bug report attachment'}
                          />
                        ) : report.imageName ? (
                          <p className="admin-report-attachment">Attachment: {report.imageName}</p>
                        ) : (
                          <span className="admin-report-no-image">No image attached</span>
                        )}
                      </div>
                    </div>
                  </article>
              )
            })}
          </div>
        ) : null}
      </div>
    </section>
  )
}
