import type { MetaProgressionSnapshot, MetaUnlockDefinition } from './MetaProgressionService'
import { getXpMultiplierForLevel } from '../content/progression/XpMultiplier'

export interface MetaProgressionScreenProps {
  snapshot: MetaProgressionSnapshot | null
  loadState: 'idle' | 'loading' | 'ready' | 'error' | 'unavailable'
  loadError: string | null
  purchaseState: 'idle' | 'purchasing'
  activePurchaseUnlockId: string | null
  onBack: () => void
  onRefresh: () => void
  onPurchaseUnlock: (unlockId: string) => void
}

function formatCurrency(value: number): string {
  return value.toLocaleString()
}

function getXpUpgradeState(
  definition: MetaUnlockDefinition,
  snapshot: MetaProgressionSnapshot,
): { label: string; disabled: boolean } {
  const level = typeof definition.payload.level === 'number'
    ? definition.payload.level
    : null
  if (level === null || level <= snapshot.xpMultiplierLevel) {
    return { label: 'Owned', disabled: true }
  }
  if (level !== snapshot.xpMultiplierLevel + 1) {
    return { label: `Locked - requires level ${level - 1}`, disabled: true }
  }
  if (snapshot.wallet.essenceBalance < definition.cost) {
    return { label: `Need ${definition.cost - snapshot.wallet.essenceBalance} more Essence`, disabled: true }
  }
  return { label: `Purchase for ${definition.cost} Essence`, disabled: false }
}

function getNextXpUpgrade(
  definitions: readonly MetaUnlockDefinition[],
  currentLevel: number,
): MetaUnlockDefinition | null {
  const nextLevel = currentLevel + 1
  return definitions.find((definition) =>
    definition.category === 'xp-multiplier' &&
    definition.payload.level === nextLevel,
  ) ?? null
}

export function MetaProgressionScreen({
  snapshot,
  loadState,
  loadError,
  purchaseState,
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
          <p>Loading Essence balance and XP multiplier upgrades.</p>
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

  const nextUpgrade = getNextXpUpgrade(snapshot.definitions, snapshot.xpMultiplierLevel)
  const nextUpgradeLevel = typeof nextUpgrade?.payload.level === 'number'
    ? nextUpgrade.payload.level
    : null
  const nextXpMultiplier = nextUpgradeLevel === null
    ? null
    : getXpMultiplierForLevel(nextUpgradeLevel)
  const nextUpgradeState = nextUpgrade === null
    ? null
    : getXpUpgradeState(nextUpgrade, snapshot)

  return (
    <section className="dashboard meta-progression-screen" aria-labelledby="meta-progression-title">
      <div className="dashboard-panel meta-shop-panel">
        <header className="meta-shop-header">
          <div>
            <p className="screen-kicker">Essence store</p>
            <h2 id="meta-progression-title">Spend your Essence.</h2>
            <p>Bank earned Essence between runs and make every XP pickup count for more.</p>
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

        <section className="meta-shop-unlocks" aria-labelledby="meta-upgrades-title">
          <div className="meta-shop-section-heading">
            <h3 id="meta-upgrades-title" style={{marginBottom: "2rem"}}>Permanent upgrades</h3>
          </div>
          <div className="dashboard-choice-list">
            {nextUpgrade && nextUpgradeState && nextUpgradeLevel !== null ? (
              <div className="dashboard-choice meta-unlock-card" key={nextUpgrade.id}>
                <div className="meta-unlock-card-multiplier">
                  <span>XP multiplier</span>
                  <strong>{snapshot.xpMultiplier.toFixed(2)}x</strong>
                </div>
                <div className="meta-unlock-card-heading">
                  <strong>Increased XP</strong>
                  <span>Level {nextUpgradeLevel}</span>
                </div>
                <div className="meta-unlock-card-benefit">
                  <strong>+5% XP multiplier</strong>
                  <span>
                    {snapshot.xpMultiplier.toFixed(2)}x → {nextXpMultiplier?.toFixed(2)}x
                  </span>
                </div>
                <span className="meta-unlock-state">{nextUpgradeState.label}</span>
                <button
                  className="secondary-action meta-purchase-action"
                  type="button"
                  disabled={nextUpgradeState.disabled || purchaseState === 'purchasing'}
                  onClick={() => { onPurchaseUnlock(nextUpgrade.id) }}
                >
                  {purchaseState === 'purchasing' && activePurchaseUnlockId === nextUpgrade.id
                    ? 'Purchasing...'
                    : `Purchase for ${formatCurrency(nextUpgrade.cost)} Essence`}
                </button>
              </div>
            ) : (
              <p className="persistence-status" role="status">
                XP multiplier fully upgraded.
              </p>
            )}
          </div>
          {purchaseState === 'purchasing' ? (
            <p className="persistence-status" role="status">Submitting unlock purchase...</p>
          ) : null}
        </section>

        {loadError ? <p className="persistence-error" role="alert">{loadError}</p> : null}
      </div>
    </section>
  )
}
