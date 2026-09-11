import {
  DEFAULT_CHAMPION_NAME,
  type RunRewardState,
  type RunWriteState,
} from '../appState'
import type { RunResultSnapshot } from '../../game'
import type { ChampionSnapshot } from '../../characters'
import { CHAMPION_SLOT_LIMIT } from '../../content/progression/ChampionSlots'
import { RunReport } from '../../ui/RunReport'
import {
  createEssenceReceipt,
  formatChampionExhaustion,
} from '../runFormatting'

export interface ResultsScreenProps {
  result: RunResultSnapshot
  runReward: RunRewardState
  terminalSaveState: RunWriteState
  terminalSaveError: string | null
  championSaveState:
    | 'idle' | 'saving' | 'saved' | 'error' | 'roster-full' | 'discarded'
  championSaveError: string | null
  championConfigurationError: string | null
  /** Offered to choose from when a win arrives at a full roster. */
  championRoster: readonly ChampionSnapshot[]
  onSaveChampion: (name?: string) => Promise<void>
  onReplaceChampion: (replacedChampionId: string) => Promise<void>
  onDiscardChampion: () => void
  onReturn: () => void
  onRetryTerminalSave: () => void
  onRetryReward: () => void
}

export function ResultsScreen({
  result,
  runReward,
  terminalSaveState,
  terminalSaveError,
  championSaveState,
  championSaveError,
  championConfigurationError,
  championRoster,
  onSaveChampion,
  onReplaceChampion,
  onDiscardChampion,
  onReturn,
  onRetryTerminalSave,
  onRetryReward,
}: ResultsScreenProps) {
  const victory = result.outcome === 'victory'
  /*
   * The Abyss is not paid in Essence, so it is not given a receipt for it.
   *
   * The reward the run actually earns is decided on the server, which pays the
   * Abyss nothing; drawing the dungeon's arithmetic here anyway promised a
   * number that never arrived in the wallet.
   */
  const paysEssence = result.modeId !== 'infinite-abyss'
  const essenceReceipt = createEssenceReceipt(result)
  return (
    <section
      className={`results-screen${victory ? ' victory-screen' : ''}`}
      aria-labelledby="results-title"
    >
      <div className="results-panel">
        <p className="screen-kicker">{victory ? 'Run victorious' : 'Run complete'}</p>
        <h2 id="results-title">{victory ? 'Victory' : 'Defeat'}</h2>
        <p className="results-summary" aria-live="polite">
          {!paysEssence
            ? `The Abyss took you on floor ${result.floor}, ${result.killCount} kills deep.`
            : victory
              ? `The final boss has fallen after ${result.killCount} kills. The depths are conquered.`
              : `Your run ended with ${result.killCount} enemies defeated.`}
        </p>
        {/* How deep the run got, and what each skill did. The chronicle draws
            the same report for this run later, from the same component. */}
        <RunReport result={result} />
        {!paysEssence ? null : (
        <section className="essence-receipt" aria-labelledby="essence-receipt-title">
          <div className="essence-receipt-heading">
            <p className="screen-kicker">Run reward</p>
            <h3 id="essence-receipt-title">Essence receipt</h3>
          </div>
          <dl className="essence-receipt-calculation">
            <div><dt>Level {result.level}</dt><dd>+{essenceReceipt.levelReward}</dd></div>
            <div>
              <dt>Kill bonus ({result.killCount} kills / 10)</dt>
              <dd>+{essenceReceipt.killReward}</dd>
            </div>
            <div className="essence-receipt-subtotal">
              <dt>Base Essence</dt><dd>{essenceReceipt.baseEssence}</dd>
            </div>
            {essenceReceipt.modifiers.length > 0
              ? essenceReceipt.modifiers.map((modifier) => (
                <div key={modifier.id}>
                  <dt>{modifier.name}</dt>
                  <dd>×{modifier.essenceRewardMultiplier.toFixed(2)}</dd>
                </div>
              ))
              : <div><dt>No world modifiers</dt><dd>×1.00</dd></div>}
            <div className="essence-receipt-subtotal">
              <dt>World modifier multiplier</dt>
              <dd>×{essenceReceipt.modifierMultiplier.toFixed(2)}</dd>
            </div>
            <div>
              <dt>Victory bonus</dt>
              <dd>×{essenceReceipt.victoryMultiplier.toFixed(2)}</dd>
            </div>
            <div className="essence-receipt-subtotal">
              <dt>Total multiplier</dt>
              <dd>×{(
                essenceReceipt.modifierMultiplier * essenceReceipt.victoryMultiplier
              ).toFixed(2)}</dd>
            </div>
            <div className="essence-receipt-total">
              <dt>Essence</dt>
              <dd>{essenceReceipt.projectedReward}</dd>
            </div>
            {/* What the loadout was worth, beside what the run was worth. It
                is a second line on the same receipt rather than a panel of its
                own: both are what this run paid out. */}
            {runReward.scrapAwarded === null ? null : (
              <div className="essence-receipt-total">
                <dt>Scrap</dt>
                <dd>{runReward.scrapAwarded}</dd>
              </div>
            )}
          </dl>
        </section>
        )}
        {victory ? (
          <section className="champion-save-panel" aria-labelledby="champion-save-title">
            <div>
              <p className="screen-kicker">Preserve the build</p>
              <h3 id="champion-save-title">Champion saved automatically</h3>
            </div>
            <p>
              This completed build is saved automatically as <strong>{DEFAULT_CHAMPION_NAME}</strong>
              for a future Infinite Abyss attempt.
              Runtime HP, cooldowns, and positions are not copied. Any artifacts the run
              was played with go with the Champion, and return to the bag only when it is
              archived.
            </p>
            {championSaveError || championConfigurationError ? (
              <p className="persistence-error" role="alert">
                {championSaveError ?? championConfigurationError}
              </p>
            ) : null}
            {championSaveState === 'saved' ? (
              <p className="persistence-status" role="status">Champion saved.</p>
            ) : championSaveState === 'discarded' ? (
              <p className="persistence-status" role="status">
                This build was not saved. Your roster is unchanged.
              </p>
            ) : championSaveState === 'saving' ? (
              <p className="persistence-status" role="status">Saving Champion…</p>
            ) : championSaveState === 'roster-full' ? (
              /*
               * Eleven builds and ten places to keep them. The build that just
               * finished is one of the eleven rather than a special case: a
               * player who likes what they already have can let this one go.
               */
              <div className="champion-roster-full">
                <p className="persistence-status" role="status">
                  Your roster is full at {CHAMPION_SLOT_LIMIT} Champions. Something has to
                  give way for this build — or it can be the one you let go.
                  An archived Champion cannot be brought back.
                </p>
                <ul className="champion-roster-choices">
                  {championRoster.map((champion) => (
                    <li key={champion.championId}>
                      <button
                        className="secondary-action champion-roster-choice"
                        type="button"
                        onClick={() => { void onReplaceChampion(champion.championId) }}
                      >
                        <span>
                          <strong>{champion.name}</strong>
                          <small>
                            Level {champion.build.level ?? 1} ·{' '}
                            {formatChampionExhaustion(champion.exhaustionUntil)}
                          </small>
                        </span>
                        <em>Replace</em>
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  className="secondary-action champion-roster-discard"
                  type="button"
                  onClick={onDiscardChampion}
                >
                  Keep the roster · archive this build
                </button>
              </div>
            ) : championSaveState === 'error' ? (
              <button
                className="secondary-action"
                type="button"
                onClick={() => { void onSaveChampion() }}
                disabled={terminalSaveState !== 'saved'}
              >
                Retry Champion save
              </button>
            ) : (
              <p className="persistence-status" role="status">Preparing automatic Champion save…</p>
            )}
          </section>
        ) : null}
        {terminalSaveState === 'saving' ? (
          <p className="persistence-status" role="status">
            {paysEssence ? 'Saving the completed dungeon run…' : 'Saving the completed descent…'}
          </p>
        ) : null}
        {terminalSaveState === 'error' || terminalSaveState === 'unavailable' ? (
          <>
            <p className="persistence-error" role="alert">
              {terminalSaveError ?? (paysEssence
                ? 'Unable to save the completed dungeon run.'
                : 'Unable to save the completed descent.')}
            </p>
            <button className="secondary-action" type="button" onClick={onRetryTerminalSave}>
              Retry run save
            </button>
          </>
        ) : null}
        {runReward.status === 'error' || runReward.status === 'unavailable' ? (
          <p className="persistence-error" role="alert">{runReward.error}</p>
        ) : null}
        {runReward.status === 'error' ? (
          <button className="secondary-action" type="button" onClick={onRetryReward}>
            Retry Essence reward
          </button>
        ) : null}
        <button
          className="primary-action"
          type="button"
          onClick={onReturn}
          disabled={terminalSaveState !== 'saved'}
        >
          {terminalSaveState === 'saving' ? 'Saving run…' : 'Return to Dashboard'}
        </button>
      </div>
    </section>
  )
}
