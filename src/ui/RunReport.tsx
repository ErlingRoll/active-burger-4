import type { RunResultSnapshot } from '../game'
import { SkillIcon } from '../rendering/SkillIcon'
import { formatCompactDamage, formatElapsedTime, formatExperience } from './formatNumbers'

/**
 * What a finished run did, as a read-only report.
 *
 * The end-of-run screen and the chronicle show the same thing: how deep the run
 * got, what each skill contributed, and how the last ten seconds went. Only the
 * frame around it differs — one is paying out a reward and offering to keep the
 * build, the other is a record of a run that ended weeks ago — so the report
 * itself lives here and each screen supplies its own chrome.
 */
export interface RunReportProps {
  result: RunResultSnapshot
}

export function RunReport({ result }: RunReportProps) {
  const victory = result.outcome === 'victory'
  /*
   * The Abyss measures itself in depth and danger; the dungeon has a contract
   * and measures itself against that, so it has no score to show.
   */
  const isAbyss = result.modeId === 'infinite-abyss'
  return (
    <>
      <dl className="results-stats">
        {!isAbyss ? null : (
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
      {/* A victory has no death to explain, and an abandoned run was not
          killed by anything, so neither carries the log. */}
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
    </>
  )
}
