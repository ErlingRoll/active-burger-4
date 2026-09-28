import { useState, type ReactNode } from 'react'
import {
  BASIC_ATTACK_SKILL_ID,
  getSkillDefinition,
  type SkillId,
} from '../../content/skills/Skills'
import {
  getUpgradeDefinition,
  isSynergyUpgradeDefinition,
  type SynergyUpgradeDefinition,
  type UpgradeDefinition,
  type UpgradeId,
} from '../../content/upgrades/Upgrades'
import {
  BUILD_PLAN_NAME_MAX_LENGTH,
  createBuildPlan,
  getBuildPlanProgress,
  getPlannableSkillIds,
  getPlannableSynergies,
  getPlannableUpgrades,
  getSketchedSynergies,
  getSynergyPartner,
  normalizeBuildPlanName,
  withPlanName,
  withPlanSkill,
  withPlanSynergy,
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
  /**
   * Where the planner sits: a panel of the HUD, a part of the run setup
   * screen, or the whole of the build plans page, which has the room to lay
   * the catalogue and the plan side by side.
   */
  variant?: BuildPlannerVariant
}

export type BuildPlannerVariant = 'hud' | 'setup' | 'page'

const STATUS_LABELS: Readonly<Record<BuildPlanTargetStatus, string>> = {
  done: 'Done',
  reachable: 'Can be offered',
  blocked: 'Blocked',
}

function skillName(skillId: SkillId): string {
  return getSkillDefinition(skillId).name
}

function counted(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`
}

function plannedSynergyCount(plan: BuildPlan): number {
  return plan.upgradeIds.filter((upgradeId) =>
    isSynergyUpgradeDefinition(getUpgradeDefinition(upgradeId)),
  ).length
}

/** "3 upgrades · 1 synergy": what a plan holds beyond its skills. */
function upgradeTally(plan: BuildPlan): string {
  const synergyCount = plannedSynergyCount(plan)
  return [
    counted(plan.upgradeIds.length - synergyCount, 'upgrade'),
    counted(synergyCount, 'synergy', 'synergies'),
  ].join(' · ')
}

type UpgradeKind = 'Level' | 'Enhance' | 'Evolve'

function upgradeKind(upgrade: UpgradeDefinition): UpgradeKind {
  return upgrade.evolution
    ? 'Evolve'
    : upgrade.skillAction === 'level'
      ? 'Level'
      : 'Enhance'
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
      <span className="build-plan-tooltip-kicker" data-kind={kind.toLowerCase()}>
        {kind}{upgrade.skillId ? ` · ${skillName(upgrade.skillId)}` : ''}
      </span>
      <strong>{upgrade.name}</strong>
      <span>{upgrade.description}</span>
      <span className="build-plan-tooltip-value">{upgrade.valueLabel}</span>
    </>
  )
}

function SynergyCard({
  synergy,
  adds,
}: {
  synergy: SynergyUpgradeDefinition
  /** For a sketched synergy, the skill picking it adds to the plan. */
  adds?: SkillId
}) {
  return (
    <>
      <span className="build-plan-tooltip-kicker" data-kind="synergy">
        Synergy · {synergy.synergySkillIds.map(skillName).join(' + ')}
      </span>
      <strong>{synergy.name}</strong>
      <span>{synergy.description}</span>
      <span className="build-plan-tooltip-value">{synergy.valueLabel}</span>
      {adds ? (
        <span className="build-plan-tooltip-note">Adds {skillName(adds)} to the plan</span>
      ) : null}
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

  const Heading = variant === 'setup' ? 'h4' : 'h3'
  return (
    <section
      className="build-planner hud-panel"
      aria-labelledby="build-planner-title"
      data-variant={variant}
    >
      <header className="build-planner-header">
        <Heading id="build-planner-title" className="hud-panel-heading">
          {/* The page's own title already says "Build plans". */}
          {variant === 'page' ? 'Saved plans' : 'Build plans'}
        </Heading>
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
          {/* The page's own lede has already said what a plan is for. */}
          {variant === 'page'
            ? 'No plans yet. Start one with New build.'
            : 'Plan the skills, upgrades and synergies you want. Cards that match the plan you are following are marked on every level-up.'}
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
                  <span className="build-plan-choice-note">
                    {progress
                      ? `${progress.doneCount}/${progress.totalCount} done`
                      : upgradeTally(plan)}
                  </span>
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

/**
 * The editor: a drawing board.
 *
 * The skills to choose from are the catalogue; the plan is the sheet beside
 * it, one plate per skill in the order they were planned, each laying out the
 * skill's route of level, enhancement, evolution and synergy. Everything the
 * plan could take is pencilled in, dashed and quiet; what it does take is
 * inked, in the rose of the bookmark those cards will carry on the level-up
 * screen. A skill takes one evolution and holds one synergy, so those rows
 * are a pick-one and the options not taken are set aside, which says the rule
 * without a sentence explaining it.
 */
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
  variant: BuildPlannerVariant
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const plannableSkillIds = getPlannableSkillIds()
  // Basic Attack always holds one slot.
  const skillCapacity = skillSlotCount === undefined ? null : Math.max(0, skillSlotCount - 1)
  const atCapacity = skillCapacity !== null && draft.skillIds.length >= skillCapacity
  const upgradeGroups = getPlannableUpgrades(draft.skillIds)
  const synergies = getPlannableSynergies(draft.skillIds)
  const plannedSet = new Set<UpgradeId>(draft.upgradeIds)
  const Heading = variant === 'setup' ? 'h4' : 'h3'
  const toggle = (upgradeId: UpgradeId) =>
    onChange(withPlanUpgrade(draft, upgradeId, !plannedSet.has(upgradeId)))
  const partnersBySkill = new Map(plannableSkillIds.map((skillId) => [
    skillId,
    getSkillStatusPartners(skillId)
      .map((partner) => partner.skillId)
      .filter((partnerSkillId) => draft.skillIds.includes(partnerSkillId)),
  ]))
  const anyPartner = plannableSkillIds.some((skillId) =>
    !draft.skillIds.includes(skillId) && (partnersBySkill.get(skillId)?.length ?? 0) > 0,
  )

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
        <div className="build-plan-workbench">
          <div className="build-plan-catalogue">
            <p className="build-plan-editor-heading">
              Skills
              <span className="build-plan-editor-count">
                {skillCapacity !== null
                  ? `${draft.skillIds.length}/${skillCapacity} planned`
                  : `${draft.skillIds.length} planned`}
              </span>
            </p>
            <ul className="build-plan-skill-grid" aria-label="Skills to plan">
              {plannableSkillIds.map((skillId) => {
                const planned = draft.skillIds.includes(skillId)
                const partnerSkillIds = partnersBySkill.get(skillId) ?? []
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
            {anyPartner ? (
              <p className="build-plan-editor-note build-plan-partner-legend">
                <span aria-hidden="true" className="build-plan-partner-swatch" />
                Works with a skill already in the plan
              </p>
            ) : null}
          </div>
          <div className="build-plan-sheet">
            <p className="build-plan-editor-heading">
              The plan
              <span className="build-plan-editor-count">{upgradeTally(draft)}</span>
            </p>
            <ol className="build-plan-plates" aria-label="The plan, skill by skill">
              {upgradeGroups.map((group) => (
                <BuildPlanPlate
                  key={group.skillId}
                  skillId={group.skillId}
                  upgrades={group.upgrades}
                  synergies={synergies.filter((synergy) =>
                    synergy.synergySkillIds.includes(group.skillId),
                  )}
                  sketched={atCapacity ? [] : getSketchedSynergies(group.skillId, draft.skillIds)}
                  plannedSet={plannedSet}
                  onToggle={toggle}
                  onPlanSynergy={(synergyId) => onChange(withPlanSynergy(draft, synergyId))}
                  onRemove={group.skillId === BASIC_ATTACK_SKILL_ID
                    ? undefined
                    : () => onChange(withPlanSkill(draft, group.skillId, false))}
                />
              ))}
              {atCapacity ? null : (
                <li className="build-plan-plate build-plan-plate-ghost">
                  {draft.skillIds.length === 0
                    ? 'Pick skills from the list to add them to the plan. Each one gets a plate here with its upgrades.'
                    : 'Pick another skill to add a plate.'}
                </li>
              )}
            </ol>
            {synergies.length === 0 && draft.skillIds.length > 0 ? (
              <p className="build-plan-editor-note">
                Add a second skill, or one that pairs with {skillName(BASIC_ATTACK_SKILL_ID)},
                to plan a synergy.
              </p>
            ) : null}
            {draft.skillIds.length > 1 ? (
              <StatusPairings skillIds={draft.skillIds} />
            ) : null}
          </div>
        </div>
        {onDelete ? (
          <div className="build-plan-delete-row">
            {confirmingDelete ? (
              <>
                <span className="build-plan-editor-note">Delete {draft.name || 'this build'} for good?</span>
                <button
                  className="build-planner-action build-planner-delete-confirm"
                  type="button"
                  onClick={onDelete}
                >
                  Delete
                </button>
                <button
                  className="build-planner-action"
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                >
                  Keep it
                </button>
              </>
            ) : (
              <button
                className="build-planner-action build-planner-delete"
                type="button"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete this build
              </button>
            )}
          </div>
        ) : null}
      </div>
    </section>
  )
}

/**
 * One skill's plate on the sheet: its name, then a row per kind of upgrade.
 * A synergy belongs to two skills, so it shows on both plates, inked on both
 * when planned; that is the slot each of them spends on it.
 *
 * The synergy row also sketches the pairs the plan does not reach yet, those
 * whose other skill is still in the catalogue. Picking one adds that skill
 * and inks the synergy in one move, so a player looking at a skill can find
 * what it combines with where they are looking rather than by hovering every
 * tile in the catalogue.
 */
function BuildPlanPlate({
  skillId,
  upgrades,
  synergies,
  sketched,
  plannedSet,
  onToggle,
  onPlanSynergy,
  onRemove,
}: {
  skillId: SkillId
  upgrades: readonly UpgradeDefinition[]
  synergies: readonly SynergyUpgradeDefinition[]
  /** Synergies whose other skill is not planned; empty when the plan is full. */
  sketched: readonly SynergyUpgradeDefinition[]
  plannedSet: ReadonlySet<UpgradeId>
  onToggle: (upgradeId: UpgradeId) => void
  onPlanSynergy: (synergyId: UpgradeId) => void
  onRemove: (() => void) | undefined
}) {
  const name = skillName(skillId)
  const ofKind = (kind: UpgradeKind) => upgrades.filter((upgrade) => upgradeKind(upgrade) === kind)
  const rows: readonly {
    label: UpgradeKind
    pickOne: boolean
    options: readonly UpgradeDefinition[]
  }[] = [
    { label: 'Level', pickOne: false, options: ofKind('Level') },
    { label: 'Enhance', pickOne: false, options: ofKind('Enhance') },
    { label: 'Evolve', pickOne: true, options: ofKind('Evolve') },
  ]
  const synergyTaken = synergies.some((synergy) => plannedSet.has(synergy.id))

  return (
    <li className="build-plan-plate">
      <div className="build-plan-plate-header">
        <SkillIcon skillId={skillId} size={20} />
        <span className="build-plan-plate-name">{name}</span>
        {onRemove ? (
          <button
            className="build-plan-plate-remove"
            type="button"
            aria-label={`Take ${name} out of the plan`}
            onClick={onRemove}
          >
            <span aria-hidden="true">×</span>
          </button>
        ) : (
          <span className="build-plan-plate-note">Always in the build</span>
        )}
      </div>
      {rows.map((row) => {
        if (row.options.length === 0) {
          return null
        }
        const taken = row.options.some((upgrade) => plannedSet.has(upgrade.id))
        return (
          <PlateRow
            key={row.label}
            label={row.label}
            kind={row.label.toLowerCase()}
            pickOne={row.pickOne}
            listLabel={`${name} ${row.label.toLowerCase()}`}
          >
            {row.options.map((upgrade) => (
              <PlanChip
                key={upgrade.id}
                planned={plannedSet.has(upgrade.id)}
                setAside={row.pickOne && taken}
                card={<UpgradeCard upgrade={upgrade} kind={row.label} />}
                onToggle={() => onToggle(upgrade.id)}
              >
                {upgrade.name}
              </PlanChip>
            ))}
          </PlateRow>
        )
      })}
      {synergies.length > 0 || sketched.length > 0 || skillId === BASIC_ATTACK_SKILL_ID ? (
        <PlateRow label="Synergy" kind="synergy" pickOne listLabel={`${name} synergy`}>
          {synergies.map((synergy) => {
            const partnerSkillId = getSynergyPartner(synergy, skillId)
            return (
              <PlanChip
                key={synergy.id}
                planned={plannedSet.has(synergy.id)}
                setAside={synergyTaken}
                card={<SynergyCard synergy={synergy} />}
                onToggle={() => onToggle(synergy.id)}
              >
                <SkillIcon skillId={partnerSkillId} size={14} />
                {synergy.name}
              </PlanChip>
            )
          })}
          {sketched.map((synergy) => {
            const partnerSkillId = getSynergyPartner(synergy, skillId)
            return (
              <PlanChip
                key={synergy.id}
                planned={false}
                sketched
                setAside={synergyTaken}
                label={`Add ${skillName(partnerSkillId)} and plan ${synergy.name}`}
                card={<SynergyCard synergy={synergy} adds={partnerSkillId} />}
                onToggle={() => onPlanSynergy(synergy.id)}
              >
                <span className="build-plan-chip-partner">
                  <SkillIcon skillId={partnerSkillId} size={14} />
                  {skillName(partnerSkillId)}
                </span>
                <span aria-hidden="true" className="build-plan-chip-joint">·</span>
                <span className="build-plan-chip-name">{synergy.name}</span>
              </PlanChip>
            )
          })}
          {skillId === BASIC_ATTACK_SKILL_ID ? (
            <li className="build-plan-row-hint">
              {synergies.length > 0 ? 'Every other skill has one too' : 'Every skill has one with Basic Attack'}
            </li>
          ) : null}
        </PlateRow>
      ) : null}
    </li>
  )
}

/**
 * A row of one kind of upgrade. The kind sets the row's colour, the one the
 * level-up card prints its action label in, so a plate reads in the same
 * colours as the cards it is planning for.
 */
function PlateRow({
  label,
  kind,
  pickOne,
  listLabel,
  children,
}: {
  label: string
  kind: string
  pickOne: boolean
  listLabel: string
  children: ReactNode
}) {
  return (
    <div className="build-plan-row" data-kind={kind}>
      <span className="build-plan-row-label">
        {label}
        {pickOne ? <span className="build-plan-row-rule">pick one</span> : null}
      </span>
      <ul className="build-plan-chip-list" aria-label={listLabel}>
        {children}
      </ul>
    </div>
  )
}

/**
 * An option on a plate: sketched while it needs another skill first,
 * pencilled while it is only possible, inked once it is planned, and set
 * aside when it shares a pick-one row with the one that was. A set-aside
 * option still takes a click, which swaps it in.
 */
function PlanChip({
  planned,
  sketched = false,
  setAside,
  label,
  card,
  onToggle,
  children,
}: {
  planned: boolean
  sketched?: boolean
  setAside: boolean
  /** An accessible name, where the visible text alone would not say what a click does. */
  label?: string
  card: ReactNode
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <li>
      <BuildPlanHover card={card}>
        <button
          className={`build-plan-chip${sketched ? ' sketched' : ''}${
            planned ? ' planned' : setAside ? ' set-aside' : ''
          }`}
          type="button"
          aria-pressed={planned}
          aria-label={label}
          onClick={onToggle}
        >
          {children}
        </button>
      </BuildPlanHover>
    </li>
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
