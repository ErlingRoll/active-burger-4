import { createPortal } from 'react-dom'
import {
  type GameUiSnapshot,
} from '../../game'
import {
  BASIC_ATTACK_SKILL_ID,
  BLOOD_RITE_SKILL_ID,
  RALLYING_BANNER_SKILL_ID,
  MIRRORCAST_SKILL_ID,
  CRITICAL_SPELLSTRIKE_SKILL_ID,
  type SkillId,
} from '../../content/skills/Skills'
import { SkillIcon } from '../SkillIcon'
import { KeywordText } from '../KeywordTooltip'
import {
  closeAllTooltips,
  tooltipClassName,
} from '../TooltipShell'
import { formatCompactDamage } from '../../ui/formatNumbers'
import type { HudTooltips } from './useHudTooltips'
import {
  formatCadence,
  formatEstimatedDps,
  formatHudModifier,
} from './formatting'

export interface SkillHudProps {
  snapshot: GameUiSnapshot
  /** Skill ids pulsing this frame because the skill just cast. */
  castPulseIds: Record<string, number>
  tooltips: HudTooltips
  onSetMirrorcastTarget: (skillId: SkillId | null) => void
  onSetCriticalSpellstrikeTarget: (skillId: SkillId | null) => void
  onSetBloodRiteTarget: (skillId: SkillId | null) => void
}

export function SkillHud({
  snapshot,
  castPulseIds,
  tooltips,
  onSetMirrorcastTarget,
  onSetCriticalSpellstrikeTarget,
  onSetBloodRiteTarget,
}: SkillHudProps) {
  const {
    activeKey: activeSkillId,
    setActiveKey: setActiveSkillId,
    anchorRef: skillTooltipAnchorRef,
    tooltipRef: skillTooltipRef,
    style: skillTooltipStyle,
  } = tooltips.skill
  const { cancelClose: cancelTooltipClose, scheduleClose: scheduleTooltipClose } = tooltips
  const orderedSkills = [...snapshot.skills].sort((left, right) =>
    left.skillId === BASIC_ATTACK_SKILL_ID
      ? -1
      : right.skillId === BASIC_ATTACK_SKILL_ID
        ? 1
        : 0,
  )
  const emptySkillSlotCount = Math.max(
    0,
    snapshot.skillSlotCount - orderedSkills.length,
  )
  const mirrorcastOwned = snapshot.skills.some(
    (skill) => skill.skillId === MIRRORCAST_SKILL_ID,
  )
  const criticalSpellstrikeOwned = snapshot.skills.some(
    (skill) => skill.skillId === CRITICAL_SPELLSTRIKE_SKILL_ID,
  )
  const bloodRiteOwned = snapshot.skills.some(
    (skill) => skill.skillId === BLOOD_RITE_SKILL_ID,
  )

  return (
      <section className="skill-hud" aria-labelledby="acquired-skills-title">
        <h3 id="acquired-skills-title" className="skill-hud-heading">
          <span>Skills</span>
          <span>{orderedSkills.length}/{snapshot.skillSlotCount}</span>
        </h3>
        <ul className="skill-list">
          {orderedSkills.map((skill) => {
            const tooltipId = `skill-tooltip-${skill.skillId}`
            const isActive = activeSkillId === skill.skillId
            const mirrorcastTargeted = snapshot.mirrorcastTargetSkillId === skill.skillId
            const criticalSpellstrikeTargeted =
              snapshot.criticalSpellstrikeTargetSkillId === skill.skillId
            const bloodRiteTargeted = snapshot.bloodRiteTargetSkillId === skill.skillId
            const canFocusMirrorcast =
              mirrorcastOwned &&
              skill.skillId !== MIRRORCAST_SKILL_ID &&
              skill.tags.includes('triggerable')
            const canFocusCriticalSpellstrike =
              criticalSpellstrikeOwned &&
              skill.tags.includes('triggerable')
            const canFocusBloodRite =
              bloodRiteOwned &&
              skill.skillId !== BASIC_ATTACK_SKILL_ID &&
              skill.skillId !== BLOOD_RITE_SKILL_ID
            const evolvedUpgrade = skill.upgrades.find((upgrade) =>
              upgrade.status === 'acquired' && upgrade.choiceType === 'evolve',
            )
            const totalDamageLabel = skill.totalDamageDealt > 0
              ? `, total damage ${formatCompactDamage(skill.totalDamageDealt)}`
              : ''
            const totalHealingLabel = skill.totalHealingDone > 0
              ? `, total healing ${formatCompactDamage(skill.totalHealingDone)}`
              : ''
            return (
              <li className="skill-entry" key={skill.skillId}>
                <button
                  className={`skill-card${skill.cooldownProgress > 0 ? ' skill-card-on-cooldown' : ''}${skill.resonanceReady ? ' skill-card-resonance-ready' : ''}${evolvedUpgrade ? ' skill-card-evolved' : ''}${mirrorcastTargeted ? ' skill-card-mirrorcast-target' : ''}${criticalSpellstrikeTargeted ? ' skill-card-critical-spellstrike-target' : ''}${bloodRiteTargeted ? ' skill-card-blood-rite-target' : ''}`}
                  type="button"
                  ref={isActive ? skillTooltipAnchorRef : undefined}
                  aria-label={`${skill.name}, level ${skill.level}${evolvedUpgrade ? `, evolved through ${evolvedUpgrade.name}` : ''}${totalDamageLabel}${totalHealingLabel}, single-target DPS ${formatEstimatedDps(skill.estimatedSingleTargetDps)}${skill.resonanceReady ? ', resonance ready' : ''}`}
                  aria-describedby={isActive ? tooltipId : undefined}
                  onFocus={() => {
                    cancelTooltipClose()
                    closeAllTooltips()
                    setActiveSkillId(skill.skillId)
                  }}
                  onBlur={() => scheduleTooltipClose(() => setActiveSkillId(null))}
                  onMouseEnter={() => {
                    cancelTooltipClose()
                    closeAllTooltips()
                    setActiveSkillId(skill.skillId)
                  }}
                  onMouseLeave={() => scheduleTooltipClose(() => setActiveSkillId(null))}
                >
                  {(castPulseIds[skill.skillId] ?? 0) > 0 ? (
                    <span
                      className="skill-cast-pulse"
                      key={castPulseIds[skill.skillId]}
                      aria-hidden="true"
                    />
                  ) : null}
                  {skill.cooldownProgress > 0 ? (
                    <span
                      className="skill-cooldown-overlay"
                      style={{
                        clipPath: `inset(0 0 0 ${(1 - skill.cooldownProgress) * 100}%)`,
                      }}
                      aria-hidden="true"
                    />
                  ) : null}
                  <span className="skill-icon">
                    <SkillIcon skillId={skill.skillId} />
                  </span>
                  <span className={`skill-card-name${evolvedUpgrade ? ' skill-card-name-evolved' : ''}`}>
                    {skill.name}
                  </span>
                  <span className="skill-card-level">Lv. {skill.level}</span>
                  <span className="skill-card-dps">
                    <span>DPS</span>
                    <b>{formatEstimatedDps(skill.estimatedSingleTargetDps)}</b>
                  </span>
                </button>
                {isActive ? (
                  createPortal(
                    <div
                    className={tooltipClassName('skill-tooltip')}
                    id={tooltipId}
                    role="tooltip"
                    ref={skillTooltipRef}
                    style={skillTooltipStyle}
                    onMouseEnter={cancelTooltipClose}
                    onMouseLeave={() => scheduleTooltipClose(() => setActiveSkillId(null))}
                    onFocus={cancelTooltipClose}
                    onBlur={() => scheduleTooltipClose(() => setActiveSkillId(null))}
                  >
                    <strong>{skill.name}</strong>
                    {evolvedUpgrade ? (
                      <span className="skill-tooltip-evolved-badge">
                        EVOLVED
                      </span>
                    ) : null}
                    <p><KeywordText text={skill.description} /></p>
                    {skill.skillId === MIRRORCAST_SKILL_ID ? (
                      <section className="skill-mirrorcast-section" aria-label="Mirrorcast focus instructions">
                        <p className="skill-upgrade-heading">Echo focus</p>
                        <p>
                          By default, Mirrorcast copies the next eligible skill.
                          Open another eligible skill's tooltip and choose
                          <strong> Focus Echo</strong> to make it wait for that skill.
                          Choose <strong>Clear Echo Focus</strong> to return to automatic capture.
                        </p>
                        <p className="skill-mirrorcast-status">
                          {snapshot.mirrorcastTargetSkillId
                            ? `Focused on ${snapshot.skills.find((candidate) =>
                              candidate.skillId === snapshot.mirrorcastTargetSkillId,
                            )?.name ?? snapshot.mirrorcastTargetSkillId}.`
                            : 'Currently capturing the next eligible skill.'}
                        </p>
                      </section>
                    ) : null}
                    {canFocusMirrorcast ? (
                      <section className="skill-mirrorcast-section" aria-label="Mirrorcast focus control">
                        <button
                          className={`skill-mirrorcast-focus-button${mirrorcastTargeted ? ' active' : ''}`}
                          type="button"
                          aria-pressed={mirrorcastTargeted}
                          onClick={() => onSetMirrorcastTarget(
                            mirrorcastTargeted ? null : skill.skillId,
                          )}
                        >
                          {mirrorcastTargeted ? 'Clear Echo Focus' : 'Focus Echo'}
                        </button>
                        <p>
                          {mirrorcastTargeted
                            ? 'Mirrorcast will wait for this skill while focused.'
                            : 'Choose this to make Mirrorcast wait for this skill.'}
                        </p>
                      </section>
                    ) : null}
                    {skill.skillId === CRITICAL_SPELLSTRIKE_SKILL_ID ? (
                      <section className="skill-mirrorcast-section" aria-label="Critical Spellstrike focus instructions">
                        <p className="skill-upgrade-heading">Spellstrike focus</p>
                        <p>
                          Resolved Basic Attack critical hits replay your focused
                          Triggerable skill. Open a Triggerable skill&apos;s tooltip
                          and choose <strong>Focus Spellstrike</strong>.
                        </p>
                        <p className="skill-mirrorcast-status">
                          {snapshot.criticalSpellstrikeTargetSkillId
                            ? `Focused on ${snapshot.skills.find((candidate) =>
                              candidate.skillId === snapshot.criticalSpellstrikeTargetSkillId,
                            )?.name ?? snapshot.criticalSpellstrikeTargetSkillId}.`
                            : 'No Triggerable skill is focused; critical hits will not replay a skill.'}
                        </p>
                      </section>
                    ) : null}
                    {canFocusCriticalSpellstrike ? (
                      <section className="skill-mirrorcast-section" aria-label="Critical Spellstrike focus control">
                        <button
                          className={`skill-mirrorcast-focus-button${criticalSpellstrikeTargeted ? ' active' : ''}`}
                          type="button"
                          aria-pressed={criticalSpellstrikeTargeted}
                          onClick={() => onSetCriticalSpellstrikeTarget(
                            criticalSpellstrikeTargeted ? null : skill.skillId,
                          )}
                        >
                          {criticalSpellstrikeTargeted ? 'Clear Spellstrike Focus' : 'Focus Spellstrike'}
                        </button>
                        <p>
                          {criticalSpellstrikeTargeted
                            ? 'Critical Spellstrike will replay this skill on a Basic Attack critical hit.'
                            : 'Choose this skill for Critical Spellstrike to replay.'}
                        </p>
                      </section>
                    ) : null}
                    {skill.skillId === BLOOD_RITE_SKILL_ID ? (
                      <section className="skill-blood-rite-section" aria-label="Blood Rite focus instructions">
                        <p className="skill-upgrade-heading">Blood Debt focus</p>
                        <p>
                          By default, Blood Debt empowers the next eligible skill.
                          Open another skill's tooltip and choose
                          <strong> Focus Debt</strong> to make it wait for that skill.
                          Choose <strong>Clear Debt Focus</strong> to return to automatic capture.
                        </p>
                        <p className="skill-blood-rite-status">
                          {snapshot.bloodRiteTargetSkillId
                            ? `Focused on ${snapshot.skills.find((candidate) =>
                              candidate.skillId === snapshot.bloodRiteTargetSkillId,
                            )?.name ?? snapshot.bloodRiteTargetSkillId}.`
                            : 'Currently empowering the next eligible skill.'}
                        </p>
                      </section>
                    ) : null}
                    {canFocusBloodRite ? (
                      <section className="skill-blood-rite-section" aria-label="Blood Rite focus control">
                        <button
                          className={`skill-blood-rite-focus-button${bloodRiteTargeted ? ' active' : ''}`}
                          type="button"
                          aria-pressed={bloodRiteTargeted}
                          onClick={() => onSetBloodRiteTarget(
                            bloodRiteTargeted ? null : skill.skillId,
                          )}
                        >
                          {bloodRiteTargeted ? 'Clear Debt Focus' : 'Focus Debt'}
                        </button>
                        <p>
                          {bloodRiteTargeted
                            ? 'Blood Debt will wait for this skill while focused.'
                            : 'Choose this to make Blood Debt wait for this skill.'}
                        </p>
                      </section>
                    ) : null}
                    {skill.resonanceEffect ? (
                      <section className="skill-resonance-section" aria-label="Resonance effect">
                        <p className="skill-upgrade-heading">
                          <KeywordText text="Resonance" />: {skill.resonanceEffect.name}
                        </p>
                        <p><KeywordText text={skill.resonanceEffect.description} /></p>
                      </section>
                    ) : null}
                    <section className="skill-tags-section" aria-label="Skill tags">
                      <p className="skill-upgrade-heading">Skill tags</p>
                      <ul className="skill-tag-list">
                        {skill.tags.map((tag) => (
                          <li className="skill-tag" key={tag}>
                            <KeywordText text={tag} />
                          </li>
                        ))}
                      </ul>
                    </section>
                    {skill.damageTypes.length > 0 ? (
                      <section className="skill-damage-breakdown" aria-label="Calculated damage">
                        <p className="skill-upgrade-heading">Calculated damage</p>
                        <ul className="skill-upgrade-list">
                          {skill.damageTypes.map((damageType) => (
                            <li key={damageType}>
                              <span>{damageType}</span>
                              <span>{Math.round(skill.damage[damageType])}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ) : null}
                    {skill.skillId !== BASIC_ATTACK_SKILL_ID ? (
                      <section className="skill-attunement-breakdown" aria-label="Attunement added damage">
                        <p className="skill-upgrade-heading">
                          <KeywordText text="Attunement added damage" />
                        </p>
                        {skill.attunementDamageTypes.length > 0 ? (
                          <ul className="skill-upgrade-list">
                            {skill.attunementDamageTypes.map((damageType) => (
                              <li key={damageType}>
                                <span>{damageType}</span>
                                <span>{Math.round(skill.attunementDamage[damageType])}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="skill-cadence">None</p>
                        )}
                      </section>
                    ) : null}
                    {skill.totalDamageDealt > 0 ? (
                      <p className="skill-damage-total">
                        <span>Total damage</span>
                        <b>{formatCompactDamage(skill.totalDamageDealt)}</b>
                      </p>
                    ) : null}
                    {skill.totalHealingDone > 0 ? (
                      <p className="skill-healing-total">
                        <span>Total healing</span>
                        <b>{formatCompactDamage(skill.totalHealingDone)}</b>
                      </p>
                    ) : null}
                    {skill.healingPerCast !== null ? (
                      <p className="skill-cadence">
                        <span>
                          {skill.skillId === RALLYING_BANNER_SKILL_ID
                            ? 'Healing per target per cast/pulse'
                            : 'Healing per target'}
                        </span>
                        <b>{formatCadence(skill.healingPerCast)} HP</b>
                      </p>
                    ) : null}
                    {skill.shieldPerCast !== null ? (
                      <p className="skill-cadence">
                        <span>Shield per cast</span>
                        <b>{formatCadence(skill.shieldPerCast)} HP</b>
                      </p>
                    ) : null}
                    {skill.shieldDurationSeconds !== null ? (
                      <p className="skill-cadence">
                        <span>Shield duration</span>
                        <b>{formatCadence(skill.shieldDurationSeconds)}s</b>
                      </p>
                    ) : null}
                    <p className="skill-cadence">
                      <span>
                        {skill.attacksPerSecond === null ? 'Cooldown' : 'Attacks per second'}
                      </span>
                      <b>
                        {skill.attacksPerSecond === null
                          ? `${formatCadence(skill.cooldownSeconds ?? 0)}s`
                          : formatCadence(skill.attacksPerSecond)}
                      </b>
                    </p>
                    <p className="skill-dps">
                      <span>Estimated combined single-target sustained DPS</span>
                      <b>
                        {formatEstimatedDps(skill.estimatedSingleTargetDps)}
                      </b>
                    </p>
                    <p className="skill-assumption">{skill.dpsAssumption}</p>
                    {skill.skillModifiers.length > 0 || skill.gearModifiers.length > 0 ? (
                      <section className="skill-gear-modifiers" aria-label="Modifiers">
                        <p className="skill-upgrade-heading">Modifiers</p>
                        <ul className="skill-upgrade-list">
                          {skill.skillModifiers.map((modifier) => (
                            <li key={`skill-${modifier.id}`}>
                              <span><KeywordText text={modifier.label} /></span>
                              <b>{modifier.value}</b>
                            </li>
                          ))}
                          {skill.gearModifiers.map((modifier) => (
                            <li key={`gear-${modifier.id}`}>
                              <KeywordText text={formatHudModifier(modifier)} />
                            </li>
                          ))}
                        </ul>
                      </section>
                    ) : null}
                    {skill.upgrades.some((upgrade) =>
                      upgrade.status === 'acquired' && upgrade.choiceType === 'evolve',
                    ) ? (
                      <section className="skill-evolution-section" aria-label="Skill evolution">
                        <p className="skill-upgrade-heading skill-evolution-heading">Evolution</p>
                        <ul className="skill-evolution-list">
                          {skill.upgrades
                            .filter((upgrade) =>
                              upgrade.status === 'acquired' && upgrade.choiceType === 'evolve',
                            )
                            .map((upgrade) => (
                              <li key={upgrade.upgradeId}>
                                <strong>{upgrade.name}</strong>
                                <span>{upgrade.valueLabel}</span>
                                {upgrade.evolutionTags && upgrade.evolutionTags.length > 0 ? (
                                  <span className="skill-tag-list" aria-label="Evolution tags">
                                    {upgrade.evolutionTags.map((tag) => (
                                      <span className="skill-tag" key={tag}>
                                        <KeywordText text={tag} />
                                      </span>
                                    ))}
                                  </span>
                                ) : null}
                                <p><KeywordText text={upgrade.description} /></p>
                              </li>
                            ))}
                        </ul>
                      </section>
                    ) : null}
                    {skill.upgrades.some((upgrade) =>
                      upgrade.status === 'acquired' && upgrade.synergySkillIds !== undefined,
                    ) ? (
                      <section className="skill-synergy-section" aria-label="Skill synergies">
                        <p className="skill-upgrade-heading skill-synergy-heading">Synergies</p>
                        <ul className="skill-upgrade-list">
                          {skill.upgrades
                            .filter((upgrade) =>
                              upgrade.status === 'acquired' &&
                              upgrade.synergySkillIds !== undefined,
                            )
                            .map((upgrade) => (
                              <li key={upgrade.upgradeId}>
                                <strong>{upgrade.name}</strong>
                                <span>{upgrade.valueLabel}</span>
                                <p><KeywordText text={upgrade.description} /></p>
                              </li>
                            ))}
                        </ul>
                      </section>
                    ) : null}
                    {skill.upgrades.some((upgrade) =>
                      upgrade.status === 'acquired' &&
                      upgrade.choiceType === 'upgrade' &&
                      upgrade.upgradeType === 'level',
                    ) ? (
                      <>
                        <p className="skill-upgrade-heading">Level upgrade</p>
                        <ul className="skill-upgrade-list">
                          {skill.upgrades
                            .filter((upgrade) =>
                              upgrade.status === 'acquired' &&
                              upgrade.choiceType === 'upgrade' &&
                              upgrade.upgradeType === 'level',
                            )
                            .map((upgrade) => (
                              <li key={upgrade.upgradeId}>
                                <strong>{upgrade.name}</strong>
                                <span>Level +1 · {upgrade.valueLabel}</span>
                              </li>
                            ))}
                        </ul>
                      </>
                    ) : null}
                    {skill.upgrades.some((upgrade) =>
                      upgrade.status === 'acquired' &&
                      upgrade.choiceType === 'upgrade' &&
                      upgrade.upgradeType === 'enhancement',
                    ) ? (
                      <>
                        <p className="skill-upgrade-heading">Enhancements</p>
                        <ul className="skill-upgrade-list">
                          {skill.upgrades
                            .filter((upgrade) =>
                              upgrade.status === 'acquired' &&
                              upgrade.choiceType === 'upgrade' &&
                              upgrade.upgradeType === 'enhancement',
                            )
                            .map((upgrade) => (
                              <li key={upgrade.upgradeId}>
                                {upgrade.name} ({upgrade.valueLabel})
                              </li>
                            ))}
                        </ul>
                      </>
                    ) : null}
                    <span className="skill-tooltip-icon">
                      <SkillIcon skillId={skill.skillId} size={28} />
                    </span>
                    </div>,
                    document.body,
                  )
                ) : null}
              </li>
            )
          })}
          {Array.from({ length: emptySkillSlotCount }, (_, index) => (
            <li className="skill-entry" key={`empty-skill-slot-${index}`}>
              <div
                className="skill-card skill-card-empty"
                aria-label="Empty skill slot"
              >
                <span className="skill-icon" aria-hidden="true">＋</span>
                <span className="skill-card-name">Empty slot</span>
                <span className="skill-card-level">Available</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
  )
}
