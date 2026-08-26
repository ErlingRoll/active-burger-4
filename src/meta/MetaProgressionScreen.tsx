import type { BasicProfileDto } from '../persistence'
import type { MetaProgressionSnapshot, MetaUnlockDefinition } from './MetaProgressionService'
import { getDungeonLengthContractId } from './MetaProgressionService'

export interface MetaProgressionScreenProps {
  snapshot: MetaProgressionSnapshot | null
  profile: BasicProfileDto
  pendingCount: number
  loadState: 'idle' | 'loading' | 'ready' | 'error' | 'unavailable'
  loadError: string | null
  syncState: 'idle' | 'syncing' | 'saved' | 'error'
  syncError: string | null
  purchaseState: 'idle' | 'purchasing' | 'saved' | 'error'
  purchaseError: string | null
  activePurchaseUnlockId: string | null
  onBack: () => void
  onRefresh: () => void
  onSyncPendingResults: () => void
  onPurchaseUnlock: (unlockId: string) => void
}

function formatCurrency(value: number): string {
  return value.toLocaleString()
}

function getUnlockState(
  definition: MetaUnlockDefinition,
  snapshot: MetaProgressionSnapshot,
  profile: BasicProfileDto,
): { label: string; disabled: boolean } {
  const contractId = getDungeonLengthContractId(definition)
  const owned = contractId !== null && profile.unlockedDungeonLengthIds.includes(contractId)
  if (definition.isStarter || owned) {
    return { label: definition.isStarter ? 'Starter' : 'Owned', disabled: true }
  }
  if (definition.requiresUnlockId && !snapshot.unlockedIds.includes(definition.requiresUnlockId)) {
    return { label: `Locked - requires ${definition.requiresUnlockId}`, disabled: true }
  }
  if (snapshot.wallet.essenceBalance < definition.cost) {
    return { label: `Need ${definition.cost - snapshot.wallet.essenceBalance} more Essence`, disabled: true }
  }
  return { label: `Purchase for ${definition.cost} Essence`, disabled: false }
}

export function MetaProgressionScreen({
  snapshot,
  profile,
  pendingCount,
  loadState,
  loadError,
  syncState,
  syncError,
  purchaseState,
  purchaseError,
  activePurchaseUnlockId,
  onBack,
  onRefresh,
  onSyncPendingResults,
  onPurchaseUnlock,
}: MetaProgressionScreenProps) {
  if (loadState === 'loading') {
    return (
      <section className="dashboard" aria-labelledby="meta-progression-loading-title">
        <div className="dashboard-panel" role="status">
          <p className="screen-kicker">Meta progression</p>
          <h2 id="meta-progression-loading-title">Loading account progression...</h2>
          <p>Syncing Essence, unlocks, and pending run results.</p>
          <button className="secondary-action" type="button" onClick={onBack}>Back to dashboard</button>
        </div>
      </section>
    )
  }

  if (loadState === 'error' || loadState === 'unavailable' || snapshot === null) {
    return (
      <section className="dashboard" aria-labelledby="meta-progression-error-title">
        <div className="dashboard-panel" role="alert">
          <p className="screen-kicker">Meta progression</p>
          <h2 id="meta-progression-error-title">Meta progression unavailable</h2>
          <p>{loadError ?? 'Unable to load meta progression.'}</p>
          <button className="primary-action" type="button" onClick={onRefresh}>Retry</button>
          <button className="secondary-action" type="button" onClick={onBack}>Back to dashboard</button>
        </div>
      </section>
    )
  }

  return (
    <section className="dashboard" aria-labelledby="meta-progression-title">
      <div className="dashboard-panel">
        <p className="screen-kicker">Meta progression</p>
        <h2 id="meta-progression-title">Essence and unlocks</h2>
        <p>Account-backed progression stays outside the active run.</p>

        <dl className="results-stats">
          <div><dt>Essence</dt><dd>{formatCurrency(snapshot.wallet.essenceBalance)}</dd></div>
          <div><dt>Earned</dt><dd>{formatCurrency(snapshot.wallet.essenceEarned)}</dd></div>
          <div><dt>Spent</dt><dd>{formatCurrency(snapshot.wallet.essenceSpent)}</dd></div>
          <div><dt>Pending results</dt><dd>{pendingCount}</dd></div>
        </dl>

        <section aria-labelledby="meta-sync-title">
          <h3 id="meta-sync-title">Sync pending results</h3>
          <p>Submit queued results now. This only runs outside gameplay.</p>
          {syncError ? <p className="persistence-error" role="alert">{syncError}</p> : null}
          <p className="persistence-status" role="status">
            {syncState === 'syncing'
              ? 'Syncing pending results...'
              : syncState === 'saved'
                ? 'Pending results synced.'
                : pendingCount === 0
                  ? 'No pending results to sync.'
                  : 'Ready to sync pending results.'}
          </p>
          <button className="primary-action" type="button" onClick={onSyncPendingResults} disabled={pendingCount === 0 || syncState === 'syncing'}>
            Sync pending results
          </button>
        </section>

        <section aria-labelledby="meta-unlocks-title">
          <h3 id="meta-unlocks-title">Dungeon-length unlocks</h3>
          <div className="dashboard-choice-list">
            {snapshot.definitions.map((definition) => {
              const contractId = getDungeonLengthContractId(definition)
              const owned = contractId !== null && profile.unlockedDungeonLengthIds.includes(contractId)
              const state = getUnlockState(definition, snapshot, profile)
              return (
                <div className="dashboard-choice" key={definition.id}>
                  <strong>{definition.id}</strong>
                  <span>{contractId ?? 'No contract mapping'}</span>
                  <span>{state.label}</span>
                  <button
                    className="secondary-action"
                    type="button"
                    disabled={state.disabled || purchaseState === 'purchasing'}
                    onClick={() => { if (contractId !== null) { onPurchaseUnlock(definition.id) } }}
                  >
                    {owned ? 'Owned' : purchaseState === 'purchasing' && activePurchaseUnlockId === definition.id ? 'Purchasing...' : 'Purchase'}
                  </button>
                </div>
              )
            })}
          </div>
          {purchaseError ? <p className="persistence-error" role="alert">{purchaseError}</p> : null}
          <p className="persistence-status" role="status">
            {purchaseState === 'purchasing'
              ? 'Submitting unlock purchase...'
              : purchaseState === 'saved'
                ? 'Unlock purchase saved.'
                : 'Purchases update the local dashboard immediately after sync.'}
          </p>
        </section>

        {loadError ? <p className="persistence-error" role="alert">{loadError}</p> : null}
        <button className="primary-action" type="button" onClick={onBack}>Back to dashboard</button>
      </div>
    </section>
  )
}
