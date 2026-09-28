import { useState, type ReactNode } from 'react'
import {
  BASIC_ATTACK_SKILL_ID,
  getSkillDefinition,
  type SkillId,
} from '../../content/skills/Skills'
import type {
  SynergyUpgradeDefinition,
  UpgradeDefinition,
  UpgradeId,
} from '../../content/upgrades/Upgrades'
import {
  BUILD_PLAN_NAME_MAX_LENGTH,
  createBuildPlan,
  getBuildPlanProgress,
  getPlannableSkillIds,
  getPlannableSynergies,
  getPlannableUpgrades,
  normalizeBuildPlanName,
  withPlanName,
  withPlanSkill,
  withPlanUpgrade,
  type BuildPlan,
  type BuildPlanRunState,
  type BuildPlanTargetStatus,
} from '../../game/builds/BuildPlans'
import { getSkillStatusPartners } from '../../content/skills/SkillInteractions'
import { KEYWORD_DEFINITIONS } from '../../content/glossary/Keywords'
import { HoverTooltip } from '../HoverTooltip'
import { SkillIcon } from '../SkillIcon'

/**
 * The build planner: the player's saved plans, the one being followed, and
 * an editor for making another.
 *
 * It is one component with two homes. In a run it is the Build tab of the
 * inspector, where it also reports how far the run has come against the plan
 * and which planned synergy is one skill away. On the run setup screen it is
 * the same panel without a run to measure against. Both hand a finished plan
 * to `onSavePlan`; the draft lives here until then, so a half-edited plan
 * never reaches local settings.
 */

export interface BuildPlannerRunContext extends BuildPlanRunState {
  /** Skill slots in this run, Basic Attack included. */
  readonly skillSlotCount: number
}

export interface BuildPlannerPanelProps {
  plans: readonly BuildPlan[]
  selectedPlanId: string | null
  onSelectPlan: (planId: string | null) => void
  onSavePlan: (plan: BuildPlan) => void
  onDeletePlan: (planId: string) => void
  /** Present inside a run; the plan view then shows progress. */
  run?: BuildPlannerRunContext
  /** Whether the heading is a panel heading (HUD) or a legend (setup screen). */
  variant?: 'hud' | 'setup'
}

const STATUS_LABELS: Readonly<Record<BuildPlanTargetStatus, string>> = {
  done: 'Done',
  reachable: 'Can be offered',
  blocked: 'Blocked',
}

function skillName(skillId: SkillId): string {
  return getSkillDefinition(skillId).name
}

/**
 * The cards behind the editor's buttons.
 *
 * A skill tile, an upgrade chip and a synergy chip each carry a card the
 * shared hover tooltip shows, so the planner explains its choices the way
 * the level-up cards and the skill bar do, on a phone as much as a desktop,
 * instead of leaving it to a native `title` that neither styles nor taps.
 * The trigger wraps the whole button in `hover` mode so the tap still goes
 * to the button and toggles the plan.
 */
function BuildPlanHover({
  card,
  className,
  children,
}: {
  card: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <HoverTooltip
      variant="build-plan-tooltip"
      mode="hover"
      className={className ? `build-plan-hover ${className}` : 'build-plan-hover'}
      card={card}
    >
      {children}
    </HoverTooltip>
  )
}

function SkillCard({
  skillId,
  partnerSkillIds = [],
}: {
  skillId: SkillId
  /** Planned skills this one has a status pairing with. */
  partnerSkillIds?: readonly SkillId[]
}) {
  const skill = getSkillDefinition(skillId)
  return (
    <>
      <span className="build-plan-tooltip-heading">
        <SkillIcon skillId={skillId} size={16} />
        <strong>{skill.name}</strong>
      </span>
      <span>{skill.description}</span>
      {partnerSkillIds.length > 0 ? (
        <span className="build-plan-tooltip-note">
          Works with {partnerSkillIds.map(skillName).join(', ')}
        </span>
      ) : null}
    </>
  )
}

function UpgradeCard({
  upgrade,
  kind,
}: {
  upgrade: UpgradeDefinition
  kind: string
}) {
  return (
    <>
      <span className="build-plan-tooltip-kicker">
        {kind}{upgrade.skillId ? ` · ${skillName(upgrade.skillId)}` : ''}
      </span>
      <strong>{upgrade.name}</strong>
      <span>{upgrade.description}</span>
      <span className="build-plan-tooltip-value">{upgrade.valueLabel}</span>
    </>
  )
}

function SynergyCard({ synergy }: { synergy: SynergyUpgradeDefinition }) {
  return (
    <>
      <span className="build-plan-tooltip-kicker">
        Synergy · {synergy.synergySkillIds.map(skillName).join(' + ')}
      </span>
      <strong>{synergy.name}</strong>
      <span>{synergy.description}</span>
      <span className="build-plan-tooltip-value">{synergy.valueLabel}</span>
    </>
  )
}

export function BuildPlannerPanel({
  plans,
  selectedPlanId,
  onSelectPlan,
  onSavePlan,
  onDeletePlan,
  run,
  variant = 'hud',
}: BuildPlannerPanelProps) {
  const [draft, setDraft] = useState<BuildPlan | null>(null)
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? null

  if (draft) {
    return (
      <BuildPlanEditor
        draft={draft}
        isNew={!plans.some((plan) => plan.id === draft.id)}
        skillSlotCount={run?.skillSlotCount}
        onChange={setDraft}
        onSave={() => {
          onSavePlan({
            ...draft,
            name: normalizeBuildPlanName(draft.name, `Build ${plans.length + 1}`),
          })
          setDraft(null)
        }}
        onCancel={() => setDraft(null)}
        onDelete={plans.some((plan) => plan.id === draft.id)
          ? () => {
              onDeletePlan(draft.id)
              setDraft(null)
            }
          : undefined}
        variant={variant}
      />
    )
  }

  const Heading = variant === 'hud' ? 'h3' : 'h4'
  return (
    <section
      className="build-planner hud-panel"
      aria-labelledby="build-planner-title"
      data-variant={variant}
    >
      <header className="build-planner-header">
        <Heading id="build-planner-title" className="hud-panel-heading">Build plans</Heading>
        <button
          className="build-planner-action"
          type="button"
          onClick={() => setDraft(createBuildPlan('', plans))}
        >
          New build
        </button>
      </header>
      {plans.length === 0 ? (
        <p className="build-planner-empty">
          Plan the skills, upgrades and synergies you want. Cards that match the
          plan you are following are marked on every level-up.
        </p>
      ) : (
        <ul className="build-plan-list" aria-label="Saved build plans">
          <li>
            <button
              className={`build-plan-choice${selectedPlan === null ? ' selected' : ''}`}
              type="button"
              aria-pressed={selectedPlan === null}
              onClick={() => onSelectPlan(null)}
            >
              <span className="build-plan-choice-name">No plan</span>
              <span className="build-plan-choice-note">Cards are not marked</span>
            </button>
          </li>
          {plans.map((plan) => {
            const selected = plan.id === selectedPlanId
            const progress = run ? getBuildPlanProgress(plan, run) : null
            return (
              <li key={plan.id}>
                <button
                  className={`build-plan-choice${selected ? ' selected' : ''}`}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelectPlan(plan.id)}
                >
                  <span className="build-plan-choice-name">{plan.name}</span>
                  <span className="build-plan-choice-skills" aria-label="Planned skills">
                    {plan.skillIds.map((skillId) => (
                      <BuildPlanHover
                        className="build-plan-choice-skill"
                        card={<SkillCard skillId={skillId} />}
                        key={skillId}
                      >
                        <SkillIcon skillId={skillId} size={16} />
                      </BuildPlanHover>
                    ))}
                    {plan.skillIds.length === 0 ? (
                      <span className="build-plan-choice-note">No skills planned</span>
                    ) : null}
                  </span>
                  {progress ? (
                    <span className="build-plan-choice-note">
                      {progress.doneCount}/{progress.totalCount} done
                    </span>
                  ) : null}
                </button>
                <button
                  className="build-planner-action build-plan-edit"
                  type="button"
                  aria-label={`Edit ${plan.name}`}
                  onClick={() => setDraft(plan)}
                >
                  Edit
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {selectedPlan && run ? (
        <BuildPlanProgressView plan={selectedPlan} run={run} />
      ) : null}
    </section>
  )
}

function BuildPlanProgressView({
  plan,
  run,
}: {
  plan: BuildPlan
  run: BuildPlannerRunContext
}) {
  const progress = getBuildPlanProgress(plan, run)
  const plannedSkillCount = plan.skillIds.length + 1
  return (
    <div className="build-plan-progress" aria-label={`${plan.name} progress`}>
      {plannedSkillCount > run.skillSlotCount ? (
        <p className="build-plan-warning" role="status">
          This plan needs {plannedSkillCount} skill slots and this run has {run.skillSlotCount}.
        </p>
      ) : null}
      <ul className="build-plan-target-list">
        {progress.skills.map((skill) => (
          <li className="build-plan-target" data-status={skill.status} key={skill.skillId}>
            <span className="build-plan-target-name">
              <SkillIcon skillId={skill.skillId} size={16} />
              <span>{skill.name}</span>
            </span>
            <span className="build-plan-target-status">
              {skill.status === 'done' ? 'Owned' : 'Not yet unlocked'}
            </span>
            {skill.upgrades.length > 0 ? (
              <ul className="build-plan-upgrade-list">
                {skill.upgrades.map((upgrade) => (
                  <li data-status={upgrade.status} key={upgrade.upgradeId}>
                    <span>{upgrade.name}</span>
                    <span className="build-plan-target-status">
                      {STATUS_LABELS[upgrade.status]}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
        {progress.synergies.map((synergy) => (
          <li className="build-plan-target build-plan-synergy" data-status={synergy.status} key={synergy.upgradeId}>
            <span className="build-plan-target-name">
              <span className="build-plan-synergy-kicker">Synergy</span>
              <span>{synergy.name}</span>
            </span>
            <span className="build-plan-target-note">
              {skillName(synergy.skillIds[0])} + {skillName(synergy.skillIds[1])}
            </span>
            <span className="build-plan-target-status">
              {synergy.status === 'blocked' && synergy.missingSkillId
                ? `Needs ${skillName(synergy.missingSkillId)}`
                : synergy.status === 'blocked'
                  ? 'Blocked by an active synergy'
                  : STATUS_LABELS[synergy.status]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function BuildPlanEditor({
  draft,
  isNew,
  skillSlotCount,
  onChange,
  onSave,
  onCancel,
  onDelete,
  variant,
}: {
  draft: BuildPlan
  isNew: boolean
  skillSlotCount: number | undefined
  onChange: (plan: BuildPlan) => void
  onSave: () => void
  onCancel: () => void
  onDelete: (() => void) | undefined
  variant: 'hud' | 'setup'
}) {
  const plannableSkillIds = getPlannableSkillIds()
  // Basic Attack always holds one slot.
  const skillCapacity = skillSlotCount === undefined ? null : Math.max(0, skillSlotCount - 1)
  const atCapacity = skillCapacity !== null && draft.skillIds.length >= skillCapacity
  const upgradeGroups = getPlannableUpgrades(draft.skillIds)
  const synergies = getPlannableSynergies(draft.skillIds)
  const plannedSet = new Set<UpgradeId>(draft.upgradeIds)
  const Heading = variant === 'hud' ? 'h3' : 'h4'

  return (
    <section
      className="build-planner build-planner-editing hud-panel"
      aria-labelledby="build-planner-editor-title"
      data-variant={variant}
    >
      <header className="build-planner-header">
        <Heading id="build-planner-editor-title" className="hud-panel-heading">
          {isNew ? 'New build' : `Edit ${draft.name}`}
        </Heading>
        <div className="build-planner-header-actions">
          <button className="build-planner-action" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="build-planner-action build-planner-save" type="button" onClick={onSave}>
            Save
          </button>
        </div>
      </header>
      <div className="build-plan-editor">
        <label className="build-plan-name-field">
          <span>Name</span>
          <input
            type="text"
            value={draft.name}
            maxLength={BUILD_PLAN_NAME_MAX_LENGTH}
            onChange={(event) => onChange(withPlanName(draft, event.target.value))}
          />
        </label>
        <p className="build-plan-editor-heading">
          Skills
          {skillCapacity !== null ? (
            <span className="build-plan-editor-count">
              {draft.skillIds.length}/{skillCapacity}
            </span>
          ) : null}
        </p>
        <ul className="build-plan-skill-grid" aria-label="Skills to plan">
          {plannableSkillIds.map((skillId) => {
            const planned = draft.skillIds.includes(skillId)
            const partnerSkillIds = getSkillStatusPartners(skillId)
              .map((partner) => partner.skillId)
              .filter((partnerSkillId) => draft.skillIds.includes(partnerSkillId))
            return (
              <li key={skillId}>
                <BuildPlanHover card={<SkillCard skillId={skillId} partnerSkillIds={partnerSkillIds} />}>
                  <button
                    className={`build-plan-skill${planned ? ' planned' : ''}${
                      !planned && partnerSkillIds.length > 0 ? ' build-plan-skill-partner' : ''
                    }`}
                    type="button"
                    aria-pressed={planned}
                    aria-label={skillName(skillId)}
                    disabled={!planned && atCapacity}
                    onClick={() => onChange(withPlanSkill(draft, skillId, !planned))}
                  >
                    <SkillIcon skillId={skillId} size={22} />
                    <span className="build-plan-skill-name">{skillName(skillId)}</span>
                  </button>
                </BuildPlanHover>
              </li>
            )
          })}
        </ul>
        {upgradeGroups.map((group) => (
          <div className="build-plan-upgrade-group" key={group.skillId}>
            <p className="build-plan-editor-heading">
              <SkillIcon skillId={group.skillId} size={16} />
              {skillName(group.skillId)} upgrades
            </p>
            <ul className="build-plan-chip-list" aria-label={`${skillName(group.skillId)} upgrades`}>
              {group.upgrades.map((upgrade) => {
                const planned = plannedSet.has(upgrade.id)
                const kind = upgrade.evolution
                  ? 'Evolve'
                  : upgrade.skillAction === 'level'
                    ? 'Level'
                    : 'Enhance'
                return (
                  <li key={upgrade.id}>
                    <BuildPlanHover card={<UpgradeCard upgrade={upgrade} kind={kind} />}>
                      <button
                        className={`build-plan-chip${planned ? ' planned' : ''}`}
                        type="button"
                        aria-pressed={planned}
                        onClick={() => onChange(withPlanUpgrade(draft, upgrade.id, !planned))}
                      >
                        <span className="build-plan-chip-kind">{kind}</span>
                        {upgrade.name}
                      </button>
                    </BuildPlanHover>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
        {synergies.length > 0 ? (
          <div className="build-plan-upgrade-group">
            <p className="build-plan-editor-heading">Synergies</p>
            <p className="build-plan-editor-note">
              Each skill holds one synergy at a time. Planning one replaces any
              other planned synergy that shares a skill with it.
            </p>
            <ul className="build-plan-chip-list" aria-label="Synergies">
              {synergies.map((synergy) => {
                const planned = plannedSet.has(synergy.id)
                return (
                  <li key={synergy.id}>
                    <BuildPlanHover card={<SynergyCard synergy={synergy} />}>
                      <button
                        className={`build-plan-chip build-plan-chip-synergy${planned ? ' planned' : ''}`}
                        type="button"
                        aria-pressed={planned}
                        onClick={() => onChange(withPlanUpgrade(draft, synergy.id, !planned))}
                      >
                        <span className="build-plan-chip-kind">
                          {synergy.synergySkillIds.map((skillId) => (
                            <SkillIcon skillId={skillId} size={14} key={skillId} />
                          ))}
                        </span>
                        {synergy.name}
                      </button>
                    </BuildPlanHover>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : draft.skillIds.length > 0 ? (
          <p className="build-plan-editor-note">
            Add a second skill, or one that pairs with {skillName(BASIC_ATTACK_SKILL_ID)},
            to plan a synergy.
          </p>
        ) : null}
        {draft.skillIds.length > 1 ? (
          <StatusPairings skillIds={draft.skillIds} />
        ) : null}
        {onDelete ? (
          <button className="build-planner-action build-planner-delete" type="button" onClick={onDelete}>
            Delete this build
          </button>
        ) : null}
      </div>
    </section>
  )
}

/**
 * The status pairs inside the plan: which planned skill sets up which. Told
 * here because it is the one place a player sees all their skills together
 * before the run hands them out one at a time.
 */
function StatusPairings({ skillIds }: { skillIds: readonly SkillId[] }) {
  const pairs = [BASIC_ATTACK_SKILL_ID, ...skillIds].flatMap((skillId) =>
    getSkillStatusPartners(skillId)
      .filter((partner) => partner.setsUp.length > 0 && skillIds.includes(partner.skillId))
      .map((partner) => ({
        from: skillId,
        to: partner.skillId,
        keywords: partner.setsUp,
      })),
  )
  if (pairs.length === 0) {
    return null
  }
  return (
    <div className="build-plan-upgrade-group">
      <p className="build-plan-editor-heading">Status pairings in this plan</p>
      <ul className="build-plan-pairing-list">
        {pairs.map((pair) => (
          <li key={`${pair.from}-${pair.to}`}>
            <strong>{skillName(pair.from)}</strong>
            {' sets up '}
            {pair.keywords.map((keyword) => KEYWORD_DEFINITIONS[keyword].label).join(', ')}
            {' for '}
            <strong>{skillName(pair.to)}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}
