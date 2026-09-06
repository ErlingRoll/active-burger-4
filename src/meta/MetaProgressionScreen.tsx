import {
  BANISH_UNLOCK_CATEGORY,
  DEFAULT_BANISH_COUNT,
  DUNGEON_MAX_FLOOR_UNLOCK_CATEGORY,
  DUNGEON_MAX_FLOOR_MAX_RANK,
  getRerollPurchaseCost,
  MAX_BANISH_COUNT,
  MAX_REROLL_LEVEL,
  SKILL_SLOT_UNLOCK_CATEGORY,
  type MetaProgressionSnapshot,
  type MetaUnlockDefinition,
} from './MetaProgressionService'
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
  onPurchaseReroll: () => void
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

function getStartingLevelUpgradeState(
  definition: MetaUnlockDefinition,
  snapshot: MetaProgressionSnapshot,
): { label: string; disabled: boolean } {
  const rank = typeof definition.payload.rank === 'number'
    ? definition.payload.rank
    : null
  if (rank === null || rank <= snapshot.startingLevelRank) {
    return { label: 'Owned', disabled: true }
  }
  if (rank !== snapshot.startingLevelRank + 1) {
    return { label: `Locked - requires rank ${rank - 1}`, disabled: true }
  }
  if (snapshot.wallet.essenceBalance < definition.cost) {
    return { label: `Need ${definition.cost - snapshot.wallet.essenceBalance} more Essence`, disabled: true }
  }
  return { label: `Purchase for ${definition.cost} Essence`, disabled: false }
}

function getNextStartingLevelUpgrade(
  definitions: readonly MetaUnlockDefinition[],
  currentRank: number,
): MetaUnlockDefinition | null {
  const nextRank = currentRank + 1
  return definitions.find((definition) =>
    definition.category === 'starting-level' &&
    definition.payload.rank === nextRank,
  ) ?? null
}

function getSkillSlotUpgrade(
  definitions: readonly MetaUnlockDefinition[],
): MetaUnlockDefinition | null {
  return definitions.find((definition) =>
    definition.category === SKILL_SLOT_UNLOCK_CATEGORY &&
    typeof definition.payload.skillSlotCount === 'number' &&
    Number.isInteger(definition.payload.skillSlotCount),
  ) ?? null
}

function getSkillSlotUpgradeState(
  definition: MetaUnlockDefinition,
  snapshot: MetaProgressionSnapshot,
): { label: string; disabled: boolean } {
  if (snapshot.unlockedIds.includes(definition.id)) {
    return { label: 'Owned', disabled: true }
  }
  if (snapshot.wallet.essenceBalance < definition.cost) {
    return {
      label: `Need ${definition.cost - snapshot.wallet.essenceBalance} more Essence`,
      disabled: true,
    }
  }
  return { label: `Purchase for ${definition.cost} Essence`, disabled: false }
}

function getNextBanishUpgrade(
  definitions: readonly MetaUnlockDefinition[],
  currentCount: number,
): MetaUnlockDefinition | null {
  return definitions.find((definition) =>
    definition.category === BANISH_UNLOCK_CATEGORY &&
    definition.payload.banishCount === currentCount + 1,
  ) ?? null
}

function getBanishUpgradeState(
  definition: MetaUnlockDefinition,
  snapshot: MetaProgressionSnapshot,
): { label: string; disabled: boolean } {
  if (snapshot.unlockedIds.includes(definition.id)) {
    return { label: 'Owned', disabled: true }
  }
  if (
    definition.requiresUnlockId !== null &&
    !snapshot.unlockedIds.includes(definition.requiresUnlockId)
  ) {
    return { label: 'Locked - purchase the previous Banish upgrade first', disabled: true }
  }
  if (snapshot.wallet.essenceBalance < definition.cost) {
    return {
      label: `Need ${definition.cost - snapshot.wallet.essenceBalance} more Essence`,
      disabled: true,
    }
  }
  return { label: `Purchase for ${definition.cost} Essence`, disabled: false }
}

function getNextDungeonMaxFloorUpgrade(
  definitions: readonly MetaUnlockDefinition[],
  currentRank: number,
): MetaUnlockDefinition | null {
  const nextRank = currentRank + 1
  return definitions.find((definition) =>
    definition.category === DUNGEON_MAX_FLOOR_UNLOCK_CATEGORY &&
    definition.payload.rank === nextRank,
  ) ?? null
}

function getDungeonMaxFloorUpgradeState(
  definition: MetaUnlockDefinition,
  snapshot: MetaProgressionSnapshot,
): { label: string; disabled: boolean } {
  const rank = typeof definition.payload.rank === 'number'
    ? definition.payload.rank
    : null
  if (rank === null || rank <= snapshot.dungeonMaxFloorRank) {
    return { label: 'Owned', disabled: true }
  }
  if (rank !== snapshot.dungeonMaxFloorRank + 1) {
    return { label: `Locked - requires rank ${rank - 1}`, disabled: true }
  }
  if (snapshot.wallet.essenceBalance < definition.cost) {
    return {
      label: `Need ${definition.cost - snapshot.wallet.essenceBalance} more Essence`,
      disabled: true,
    }
  }
  return { label: `Purchase for ${definition.cost} Essence`, disabled: false }
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
  onPurchaseReroll,
}: MetaProgressionScreenProps) {
  if (loadState === 'loading') {
    return (
      <section className="dashboard" aria-labelledby="meta-progression-loading-title">
        <div className="dashboard-panel" role="status">
          <p className="screen-kicker">Meta progression</p>
          <h2 id="meta-progression-loading-title">Loading account progression...</h2>
          <p>Loading Essence balance and permanent upgrades.</p>
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
  const nextStartingLevelUpgrade = getNextStartingLevelUpgrade(
    snapshot.definitions,
    snapshot.startingLevelRank,
  )
  const nextStartingLevelRank = typeof nextStartingLevelUpgrade?.payload.rank === 'number'
    ? nextStartingLevelUpgrade.payload.rank
    : null
  const nextStartingLevel = typeof nextStartingLevelUpgrade?.payload.startingLevel === 'number'
    ? nextStartingLevelUpgrade.payload.startingLevel
    : null
  const nextStartingLevelUpgradeState = nextStartingLevelUpgrade === null
    ? null
    : getStartingLevelUpgradeState(nextStartingLevelUpgrade, snapshot)
  const skillSlotUpgrade = getSkillSlotUpgrade(snapshot.definitions)
  const skillSlotUpgradeState = skillSlotUpgrade === null
    ? null
    : getSkillSlotUpgradeState(skillSlotUpgrade, snapshot)
  const skillSlotUpgradeTarget = typeof skillSlotUpgrade?.payload.skillSlotCount === 'number'
    ? skillSlotUpgrade.payload.skillSlotCount
    : snapshot.skillSlotCount + 1
  const skillSlotUpgradeOwned = skillSlotUpgrade !== null &&
    snapshot.unlockedIds.includes(skillSlotUpgrade.id)
  const nextDungeonMaxFloorUpgrade = getNextDungeonMaxFloorUpgrade(
    snapshot.definitions,
    snapshot.dungeonMaxFloorRank,
  )
  const nextDungeonMaxFloorUpgradeState = nextDungeonMaxFloorUpgrade === null
    ? null
    : getDungeonMaxFloorUpgradeState(nextDungeonMaxFloorUpgrade, snapshot)
  const nextDungeonMaxFloorRank = typeof nextDungeonMaxFloorUpgrade?.payload.rank === 'number'
    ? nextDungeonMaxFloorUpgrade.payload.rank
    : null
  const nextDungeonMaxFloorBonus =
    typeof nextDungeonMaxFloorUpgrade?.payload.maxFloorBonus === 'number'
      ? nextDungeonMaxFloorUpgrade.payload.maxFloorBonus
      : 0
  const nextDungeonMaxFloor = snapshot.dungeonMaxFloor + nextDungeonMaxFloorBonus
  const rerollCost = getRerollPurchaseCost(snapshot.wallet.rerollLevel)
  const canPurchaseReroll = snapshot.wallet.rerollLevel < MAX_REROLL_LEVEL &&
    snapshot.wallet.essenceBalance >= rerollCost
  const nextBanishUpgrade = getNextBanishUpgrade(snapshot.definitions, snapshot.banishCount)
  const nextBanishCount = typeof nextBanishUpgrade?.payload.banishCount === 'number'
    ? nextBanishUpgrade.payload.banishCount
    : null
  const nextBanishUpgradeState = nextBanishUpgrade === null
    ? null
    : getBanishUpgradeState(nextBanishUpgrade, snapshot)

  return (
    <section className="dashboard meta-progression-screen" aria-labelledby="meta-progression-title">
      <div className="dashboard-panel meta-shop-panel">
        <header className="meta-shop-header">
          <div>
            <p className="screen-kicker">Essence store</p>
            <h2 id="meta-progression-title">Spend your Essence.</h2>
            <p>Bank earned Essence between runs and make each new run stronger.</p>
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
            <div className="dashboard-choice meta-unlock-card">
              <div className="meta-unlock-card-multiplier">
                <span>Rerolls</span>
                <strong>{snapshot.wallet.rerollLevel} / {MAX_REROLL_LEVEL}</strong>
              </div>
              <div className="meta-unlock-card-heading">
                <strong>Reroll</strong>
                <span>Permanent upgrade</span>
              </div>
              <p className="meta-unlock-description">
                Each level grants one reroll at the start of every dungeon run. Spend
                rerolls to refresh ALL the current gear or skill upgrade offers.
              </p>
              <div className="meta-unlock-card-benefit">
                <strong>+1 reroll per run</strong>
                <span>
                  {snapshot.wallet.rerollLevel >= MAX_REROLL_LEVEL
                    ? `All runs start with ${MAX_REROLL_LEVEL} rerolls`
                    : `${snapshot.wallet.rerollLevel} → ${snapshot.wallet.rerollLevel + 1} rerolls`}
                </span>
              </div>
              <span className="meta-unlock-state">
                {snapshot.wallet.rerollLevel >= MAX_REROLL_LEVEL
                  ? 'Maximum reroll level reached'
                  : canPurchaseReroll
                  ? `Next reroll costs ${formatCurrency(rerollCost)} Essence`
                  : `Need ${formatCurrency(rerollCost - snapshot.wallet.essenceBalance)} more Essence`}
              </span>
              <button
                className="secondary-action meta-purchase-action"
                type="button"
                disabled={!canPurchaseReroll || purchaseState === 'purchasing'}
                onClick={onPurchaseReroll}
              >
                {purchaseState === 'purchasing' && activePurchaseUnlockId === 'reroll'
                  ? 'Purchasing...'
                  : snapshot.wallet.rerollLevel >= MAX_REROLL_LEVEL
                    ? 'Fully upgraded'
                    : `Purchase for ${formatCurrency(rerollCost)} Essence`}
              </button>
            </div>
            {nextBanishUpgrade && nextBanishUpgradeState && nextBanishCount !== null ? (
              <div className="dashboard-choice meta-unlock-card" key={nextBanishUpgrade.id}>
                <div className="meta-unlock-card-multiplier">
                  <span>Banishes</span>
                  <strong>{snapshot.banishCount} / {MAX_BANISH_COUNT}</strong>
                </div>
                <div className="meta-unlock-card-heading">
                  <strong>Banish skill unlocks</strong>
                  <span>Rank {nextBanishCount - DEFAULT_BANISH_COUNT} of {MAX_BANISH_COUNT - DEFAULT_BANISH_COUNT}</span>
                </div>
                <p className="meta-unlock-description">
                  Permanently removes a skill unlock from the current run and replaces it with another offer.
                </p>
                <div className="meta-unlock-card-benefit">
                  <strong>+1 Banish per run</strong>
                  <span>{snapshot.banishCount} → {nextBanishCount} Banishes</span>
                </div>
                <span className="meta-unlock-state">{nextBanishUpgradeState.label}</span>
                <button
                  className="secondary-action meta-purchase-action"
                  type="button"
                  disabled={nextBanishUpgradeState.disabled || purchaseState === 'purchasing'}
                  onClick={() => { onPurchaseUnlock(nextBanishUpgrade.id) }}
                >
                  {purchaseState === 'purchasing' &&
                  activePurchaseUnlockId === nextBanishUpgrade.id
                    ? 'Purchasing...'
                    : `Purchase for ${formatCurrency(nextBanishUpgrade.cost)} Essence`}
                </button>
              </div>
            ) : (
              <p className="persistence-status" role="status">
                Banishes fully upgraded.
              </p>
            )}
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
                <p className="meta-unlock-description">
                  Increases all experience earned during future dungeon runs.
                </p>
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
            {nextStartingLevelUpgrade &&
            nextStartingLevelUpgradeState &&
            nextStartingLevelRank !== null &&
            nextStartingLevel !== null ? (
              <div className="dashboard-choice meta-unlock-card" key={nextStartingLevelUpgrade.id}>
                <div className="meta-unlock-card-multiplier">
                  <span>Starting level</span>
                  <strong>Level {snapshot.startingLevel}</strong>
                </div>
                <div className="meta-unlock-card-heading">
                  <strong>Starting Level</strong>
                  <span>Rank {nextStartingLevelRank}</span>
                </div>
                <p className="meta-unlock-description">
                  Future dungeon runs begin at a higher level and immediately grant its upgrades.
                </p>
                <div className="meta-unlock-card-benefit">
                  <strong>Start at level {nextStartingLevel}</strong>
                  <span>Level {snapshot.startingLevel} → {nextStartingLevel}</span>
                </div>
                <span className="meta-unlock-state">{nextStartingLevelUpgradeState.label}</span>
                <button
                  className="secondary-action meta-purchase-action"
                  type="button"
                  disabled={
                    nextStartingLevelUpgradeState.disabled ||
                    purchaseState === 'purchasing'
                  }
                  onClick={() => { onPurchaseUnlock(nextStartingLevelUpgrade.id) }}
                >
                  {purchaseState === 'purchasing' &&
                  activePurchaseUnlockId === nextStartingLevelUpgrade.id
                    ? 'Purchasing...'
                    : `Purchase for ${formatCurrency(nextStartingLevelUpgrade.cost)} Essence`}
                </button>
              </div>
            ) : (
              <p className="persistence-status" role="status">
                Starting level fully upgraded.
              </p>
            )}
            {skillSlotUpgrade && skillSlotUpgradeState ? (
              <div className="dashboard-choice meta-unlock-card" key={skillSlotUpgrade.id}>
                <div className="meta-unlock-card-multiplier">
                  <span>Skill capacity</span>
                  <strong>{snapshot.skillSlotCount} skills</strong>
                </div>
                <div className="meta-unlock-card-heading">
                  <strong>Expanded Skill Slots</strong>
                  <span>One-time upgrade</span>
                </div>
                <p className="meta-unlock-description">
                  Lets you equip one additional skill in every future dungeon run.
                </p>
                <div className="meta-unlock-card-benefit">
                  <strong>{skillSlotUpgradeOwned ? 'Maximum skill capacity' : '+1 maximum skill'}</strong>
                  <span>
                    {skillSlotUpgradeOwned
                      ? `${snapshot.skillSlotCount} skills`
                      : `${snapshot.skillSlotCount} → ${skillSlotUpgradeTarget} skills`}
                  </span>
                </div>
                <span className="meta-unlock-state">{skillSlotUpgradeState.label}</span>
                <button
                  className="secondary-action meta-purchase-action"
                  type="button"
                  disabled={skillSlotUpgradeState.disabled || purchaseState === 'purchasing'}
                  onClick={() => { onPurchaseUnlock(skillSlotUpgrade.id) }}
                >
                  {purchaseState === 'purchasing' &&
                  activePurchaseUnlockId === skillSlotUpgrade.id
                    ? 'Purchasing...'
                    : skillSlotUpgradeOwned
                      ? 'Owned'
                      : `Purchase for ${formatCurrency(skillSlotUpgrade.cost)} Essence`}
                </button>
              </div>
            ) : null}
            {nextDungeonMaxFloorUpgrade &&
            nextDungeonMaxFloorUpgradeState &&
            nextDungeonMaxFloorRank !== null ? (
              <div className="dashboard-choice meta-unlock-card" key={nextDungeonMaxFloorUpgrade.id}>
                <div className="meta-unlock-card-multiplier">
                  <span>Dungeon length</span>
                  <strong>{snapshot.dungeonMaxFloor} floors</strong>
                </div>
                <div className="meta-unlock-card-heading">
                  <strong>Deeper Dungeon</strong>
                  <span>Rank {nextDungeonMaxFloorRank} of {DUNGEON_MAX_FLOOR_MAX_RANK}</span>
                </div>
                <p className="meta-unlock-description">
                  Raises the upper limit for future dungeon runs. You can choose a shorter run when
                  you want to build a new Champion.
                </p>
                <div className="meta-unlock-card-benefit">
                  <strong>+{nextDungeonMaxFloorBonus} selectable floors</strong>
                  <span>{snapshot.dungeonMaxFloor} → {nextDungeonMaxFloor} floors</span>
                </div>
                <span className="meta-unlock-state">{nextDungeonMaxFloorUpgradeState.label}</span>
                <button
                  className="secondary-action meta-purchase-action"
                  type="button"
                  disabled={
                    nextDungeonMaxFloorUpgradeState.disabled ||
                    purchaseState === 'purchasing'
                  }
                  onClick={() => { onPurchaseUnlock(nextDungeonMaxFloorUpgrade.id) }}
                >
                  {purchaseState === 'purchasing' &&
                  activePurchaseUnlockId === nextDungeonMaxFloorUpgrade.id
                    ? 'Purchasing...'
                    : `Purchase for ${formatCurrency(nextDungeonMaxFloorUpgrade.cost)} Essence`}
                </button>
              </div>
            ) : (
              <p className="persistence-status" role="status">
                Dungeon maximum floor fully upgraded.
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
