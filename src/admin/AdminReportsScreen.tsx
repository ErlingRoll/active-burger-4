import type { BugReport } from '../bug-report'

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
}: AdminReportsScreenProps) {
  const visibleReports = showHidden
    ? reports
    : reports.filter((report) => !hiddenReportIds.has(report.id))
  const hiddenCount = reports.filter((report) => hiddenReportIds.has(report.id)).length

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
              return (
                <article className="admin-report-card" key={report.id}>
                  <header className="admin-report-card-header">
                    <div>
                      <strong>Report #{report.id}</strong>
                      <span>{formatSubmittedAt(report.submittedAt)}</span>
                    </div>
                    <div className="admin-report-card-controls">
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
                  {canPreviewImage(report) ? (
                    <img
                      className="admin-report-image"
                      src={report.imageData ?? undefined}
                      alt={report.imageName ?? 'Bug report attachment'}
                    />
                  ) : report.imageName ? (
                    <p className="admin-report-attachment">Attachment: {report.imageName}</p>
                  ) : null}
                </article>
              )
            })}
          </div>
        ) : null}
      </div>
    </section>
  )
}
