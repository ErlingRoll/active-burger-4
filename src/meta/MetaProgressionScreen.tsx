import type { BasicProfileDto } from '../persistence'
import type { MetaProgressionSnapshot, MetaUnlockDefinition } from './MetaProgressionService'
import { getDungeonMaxFloorContractId } from './MetaProgressionService'

export interface MetaProgressionScreenProps {
  snapshot: MetaProgressionSnapshot | null
  profile: BasicProfileDto
  loadState: 'idle' | 'loading' | 'ready' | 'error' | 'unavailable'
  loadError: string | null
  purchaseState: 'idle' | 'purchasing' | 'saved' | 'error'
  purchaseError: string | null
  activePurchaseUnlockId: string | null
  onBack: () => void
  onRefresh: () => void
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
  const contractId = getDungeonMaxFloorContractId(definition)
  const owned = contractId !== null && profile.unlockedDungeonMaxFloorIds.includes(contractId)
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
  loadState,
  loadError,
  purchaseState,
  purchaseError,
  activePurchaseUnlockId,
  onBack,
  onRefresh,
  onPurchaseUnlock,
}: MetaProgressionScreenProps) {
  if (loadState === 'loading') {
    return (
      <section className="dashboard" aria-labelledby="meta-progression-loading-title">
        <div className="dashboard-panel" role="status">
          <p className="screen-kicker">Meta progression</p>
          <h2 id="meta-progression-loading-title">Loading account progression...</h2>
          <p>Loading Essence balance and available maximum-floor unlocks.</p>
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
    <section className="dashboard meta-progression-screen" aria-labelledby="meta-progression-title">
      <div className="dashboard-panel meta-shop-panel">
        <header className="meta-shop-header">
          <div>
            <p className="screen-kicker">Essence store</p>
            <h2 id="meta-progression-title">Spend your Essence.</h2>
            <p>Bank earned Essence between runs and unlock deeper dungeon tiers.</p>
          </div>
          <button className="secondary-action meta-shop-back" type="button" onClick={onBack}>
            <span aria-hidden="true">←</span>
            Dashboard
          </button>
        </header>

        <dl className="results-stats meta-wallet">
          <div><dt>Essence</dt><dd>{formatCurrency(snapshot.wallet.essenceBalance)}</dd></div>
          <div><dt>Earned</dt><dd>{formatCurrency(snapshot.wallet.essenceEarned)}</dd></div>
          <div><dt>Spent</dt><dd>{formatCurrency(snapshot.wallet.essenceSpent)}</dd></div>
        </dl>

        <section className="meta-shop-unlocks" aria-labelledby="meta-unlocks-title">
          <div className="meta-shop-section-heading">
            <p className="screen-kicker">Dungeon depth shop</p>
            <h3 id="meta-unlocks-title">Unlock higher maximum floors</h3>
          </div>
          <div className="dashboard-choice-list">
            {snapshot.definitions.map((definition) => {
              const contractId = getDungeonMaxFloorContractId(definition)
              const owned = contractId !== null && profile.unlockedDungeonMaxFloorIds.includes(contractId)
              const state = getUnlockState(definition, snapshot, profile)
              return (
                <div className="dashboard-choice meta-unlock-card" key={definition.id}>
                  <div className="meta-unlock-card-heading">
                    <strong>{contractId ?? definition.id}</strong>
                    <span>{contractId ? 'Maximum-floor tier' : 'No maximum-floor mapping'}</span>
                  </div>
                  <span className="meta-unlock-state">{state.label}</span>
                  <button
                    className="secondary-action meta-purchase-action"
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
      </div>
    </section>
  )
}
