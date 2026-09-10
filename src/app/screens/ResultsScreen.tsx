import {
  DEFAULT_CHAMPION_NAME,
  type RunRewardState,
  type RunWriteState,
} from '../appState'
import type { RunResultSnapshot } from '../../game'
import { SkillIcon } from '../../rendering/SkillIcon'
import {
  createEssenceReceipt,
  formatElapsedTime,
} from '../runFormatting'
import { formatCompactDamage, formatExperience } from '../../ui/formatNumbers'

export interface ResultsScreenProps {
  result: RunResultSnapshot
  runReward: RunRewardState
  terminalSaveState: RunWriteState
  terminalSaveError: string | null
  championSaveState: 'idle' | 'saving' | 'saved' | 'error'
  championSaveError: string | null
  championConfigurationError: string | null
  onSaveChampion: (name?: string) => Promise<void>
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
  onSaveChampion,
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
        {/* How deep, and what it was worth. The Abyss keeps a score for floors
            survived and dangers accepted, and until now kept it to itself. */}
        <dl className="results-stats">
          {paysEssence ? null : (
            <>
              <div><dt>Depth</dt><dd>Floor {result.floor}</dd></div>
              <div><dt>Score</dt><dd>{result.abyssScore.toLocaleString()}</dd></div>
              <div><dt>Danger</dt><dd>{result.abyssDangerScore}</dd></div>
            </>
          )}
          <div><dt>Elapsed time</dt><dd>{formatElapsedTime(result.elapsedTime)}</dd></div>
          <div><dt>Level</dt><dd>{result.level}</dd></div>
          <div><dt>XP</dt><dd>{formatExperience(result.xp)}</dd></div>
          <div><dt>Kills</dt><dd>{result.killCount}</dd></div>
        </dl>
        <section className="skill-damage-results" aria-labelledby="skill-damage-results-title">
          <div className="skill-damage-results-heading">
            <p className="screen-kicker">Combat performance</p>
            <h3 id="skill-damage-results-title">Skill damage</h3>
          </div>
          {result.skillDamage.length > 0 ? (
            <ul>
              {result.skillDamage.map((skill) => (
                <li key={skill.skillId}>
                  <span className="results-skill-name">
                    <SkillIcon skillId={skill.skillId} size={18} />
                    {skill.name}
                  </span>
                  <strong>{formatCompactDamage(skill.damage)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="skill-damage-results-empty">No skill damage was recorded.</p>
          )}
        </section>
        <section className="skill-healing-results" aria-labelledby="skill-healing-results-title">
          <div className="skill-damage-results-heading">
            <p className="screen-kicker">Combat performance</p>
            <h3 id="skill-healing-results-title">Skill healing</h3>
          </div>
          {result.skillHealing.length > 0 ? (
            <ul>
              {result.skillHealing.map((skill) => (
                <li key={skill.skillId}>
                  <span className="results-skill-name">
                    <SkillIcon skillId={skill.skillId} size={18} />
                    {skill.name}
                  </span>
                  <strong>{formatCompactDamage(skill.healing)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="skill-damage-results-empty">No skill healing was recorded.</p>
          )}
        </section>
        {!victory && !result.forfeited ? (
          <section className="death-combat-log" aria-labelledby="death-combat-log-title">
            <div className="death-combat-log-heading">
              <p className="screen-kicker">Final 10 seconds</p>
              <h3 id="death-combat-log-title">Damage and healing log</h3>
            </div>
            {result.playerCombatLog.length > 0 ? (
              <ol>
                {result.playerCombatLog.map((entry, index) => (
                  <li className={`death-combat-log-entry ${entry.kind}`} key={`${entry.time}-${index}`}>
                    <span className="death-combat-log-time">
                      {Math.max(0, result.elapsedTime - entry.time).toFixed(1)}s ago
                    </span>
                    <span>
                      {entry.kind === 'damage'
                        ? `${Math.ceil(entry.amount)} ${entry.damageType ?? 'unknown'} damage`
                        : `Healed ${Math.ceil(entry.amount)}`}
                    </span>
                    <span>{entry.source}</span>
                    <strong>{Math.ceil(entry.resultingHp)} HP</strong>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="death-combat-log-empty">No damage or healing was recorded before defeat.</p>
            )}
          </section>
        ) : null}
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
              Runtime HP, cooldowns, and positions are not copied.
            </p>
            {championSaveError || championConfigurationError ? (
              <p className="persistence-error" role="alert">
                {championSaveError ?? championConfigurationError}
              </p>
            ) : null}
            {championSaveState === 'saved' ? (
              <p className="persistence-status" role="status">Champion saved.</p>
            ) : championSaveState === 'saving' ? (
              <p className="persistence-status" role="status">Saving Champion…</p>
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
