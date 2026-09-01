import type { NicknameChangeRequest } from '../auth'

interface NicknameModerationScreenProps {
  requests: readonly NicknameChangeRequest[]
  loadState: 'loading' | 'ready' | 'error'
  error: string | null
  onBack: () => void
  onRefresh: () => void
  onReview: (requestId: number, approve: boolean) => void
}

function formatRequestedAt(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export function NicknameModerationScreen({
  requests,
  loadState,
  error,
  onBack,
  onRefresh,
  onReview,
}: NicknameModerationScreenProps) {
  return (
    <section className="admin-reports-screen" aria-labelledby="nickname-moderation-title">
      <div className="admin-reports-panel">
        <header className="admin-reports-header">
          <div>
            <p className="screen-kicker">Administration</p>
            <h2 id="nickname-moderation-title">Nickname requests</h2>
            <p>Approve only nicknames appropriate for public display.</p>
          </div>
          <div className="admin-reports-actions">
            <button className="secondary-action" type="button" onClick={onBack}>
              Back to dashboard
            </button>
            <button className="primary-action" type="button" onClick={onRefresh} disabled={loadState === 'loading'}>
              {loadState === 'loading' ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </header>
        {loadState === 'loading' ? (
          <p className="admin-reports-status" role="status">Loading nickname requests...</p>
        ) : null}
        {loadState === 'error' ? (
          <p className="persistence-error" role="alert">{error ?? 'Unable to load nickname requests.'}</p>
        ) : null}
        {loadState === 'ready' && requests.length === 0 ? (
          <p className="admin-reports-status">No nickname requests are pending.</p>
        ) : null}
        {requests.length > 0 ? (
          <div className="nickname-review-list">
            {requests.map((request) => (
              <article className="nickname-review-card" key={request.id}>
                <div>
                  <strong>{request.requestedNickname}</strong>
                  <span>{formatRequestedAt(request.requestedAt)}</span>
                  <code>{request.userId}</code>
                </div>
                <div className="nickname-review-actions">
                  <button type="button" onClick={() => onReview(request.id, false)}>
                    Reject
                  </button>
                  <button type="button" onClick={() => onReview(request.id, true)}>
                    Approve
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
