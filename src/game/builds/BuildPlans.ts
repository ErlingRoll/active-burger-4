import {
  BASIC_ATTACK_SKILL_ID,
  getSkillDefinition,
  isSkillId,
  SKILL_DEFINITIONS,
  type SkillId,
} from '../../content/skills/Skills'
import {
  getUpgradeDefinition,
  INITIAL_UPGRADES,
  isSynergyUpgradeDefinition,
  REMOVE_SKILL_UPGRADE_ID,
  REMOVE_SYNERGY_UPGRADE_ID,
  SYNERGY_UPGRADES,
  type LevelUpUpgradeChoice,
  type SynergyUpgradeDefinition,
  type UpgradeDefinition,
  type UpgradeId,
} from '../../content/upgrades/Upgrades'

/**
 * A build plan: the skills a player means to collect and the upgrades,
 * enhancements, evolutions and synergies they mean to take on them.
 *
 * A plan is a list of targets, not a state. It says nothing about order or
 * levels, because the level-up screen decides both; what it lets the game do
 * is answer "is this card part of my plan?" with one set lookup, on every
 * card, for the whole run. Plans live outside the run, in local settings, so
 * one made on the setup screen is still there for the next descent.
 */
export interface BuildPlan {
  readonly id: string
  readonly name: string
  readonly skillIds: readonly SkillId[]
  readonly upgradeIds: readonly UpgradeId[]
}

export const BUILD_PLAN_NAME_MAX_LENGTH = 32
export const BUILD_PLAN_LIMIT = 12

const UPGRADE_IDS = new Set<UpgradeId>(INITIAL_UPGRADES.map((upgrade) => upgrade.id))

export function isUpgradeId(value: unknown): value is UpgradeId {
  return typeof value === 'string' && UPGRADE_IDS.has(value as UpgradeId)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function uniqueSkillIds(value: unknown): SkillId[] {
  return Array.isArray(value)
    ? [...new Set(value.filter(isSkillId))]
    : []
}

function uniqueUpgradeIds(value: unknown): UpgradeId[] {
  return Array.isArray(value)
    ? [...new Set(value.filter(isUpgradeId))]
    : []
}

export function normalizeBuildPlanName(value: unknown, fallback: string): string {
  const name = typeof value === 'string' ? value.trim().slice(0, BUILD_PLAN_NAME_MAX_LENGTH) : ''
  return name.length > 0 ? name : fallback
}

/**
 * Converts stored or partially written plans into valid ones. Unknown skills
 * and upgrades are dropped rather than failing the whole record, because a
 * plan written before a skill was renamed is still worth keeping; an upgrade
 * whose skill is no longer in the plan is dropped for the same reason a
 * planner would never let it in.
 */
export function normalizeBuildPlan(value: unknown, index: number): BuildPlan | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) {
    return null
  }
  const skillIds = uniqueSkillIds(value.skillIds).filter(
    (skillId) => skillId !== BASIC_ATTACK_SKILL_ID,
  )
  return {
    id: value.id,
    name: normalizeBuildPlanName(value.name, `Build ${index + 1}`),
    skillIds,
    upgradeIds: uniqueUpgradeIds(value.upgradeIds)
      .filter((upgradeId) => isUpgradeInPlanScope(getUpgradeDefinition(upgradeId), skillIds))
      .reduce<UpgradeId[]>((kept, upgradeId) => {
        const definition = getUpgradeDefinition(upgradeId)
        return kept.some((earlier) => upgradesConflict(getUpgradeDefinition(earlier), definition))
          ? kept
          : [...kept, upgradeId]
      }, []),
  }
}

/**
 * Whether a run could never hold both: two synergies sharing a skill, since a
 * skill holds one synergy at a time, or two evolutions of one skill, since a
 * skill takes one branch and the level-up screen stops offering the others.
 */
function upgradesConflict(a: UpgradeDefinition, b: UpgradeDefinition): boolean {
  if (a.id === b.id) {
    return false
  }
  if (a.synergySkillIds && b.synergySkillIds) {
    return b.synergySkillIds.some((skillId) => a.synergySkillIds?.includes(skillId))
  }
  return a.evolution !== undefined &&
    b.evolution !== undefined &&
    a.skillId === b.skillId &&
    a.evolution !== b.evolution
}

export function normalizeBuildPlans(value: unknown): BuildPlan[] {
  if (!Array.isArray(value)) {
    return []
  }
  const seen = new Set<string>()
  return value
    .map((entry, index) => normalizeBuildPlan(entry, index))
    .filter((plan): plan is BuildPlan => plan !== null)
    .filter((plan) => {
      if (seen.has(plan.id)) {
        return false
      }
      seen.add(plan.id)
      return true
    })
    .slice(0, BUILD_PLAN_LIMIT)
}

export function createBuildPlanId(): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
  return `build-${random}`
}

export function createBuildPlan(name: string, existing: readonly BuildPlan[]): BuildPlan {
  return {
    id: createBuildPlanId(),
    name: normalizeBuildPlanName(name, `Build ${existing.length + 1}`),
    skillIds: [],
    upgradeIds: [],
  }
}

/**
 * Whether an upgrade belongs with these skills. Basic Attack is always
 * owned, so its upgrades are always in scope; anything else needs its skill
 * in the plan, and a synergy needs both of its skills.
 */
export function isUpgradeInPlanScope(
  upgrade: UpgradeDefinition,
  skillIds: readonly SkillId[],
): boolean {
  if (upgrade.skillAction === 'unlock') {
    return false
  }
  const planned = (skillId: SkillId): boolean =>
    skillId === BASIC_ATTACK_SKILL_ID || skillIds.includes(skillId)
  if (upgrade.synergySkillIds) {
    return upgrade.synergySkillIds.every(planned)
  }
  return upgrade.skillId !== undefined && planned(upgrade.skillId)
}

export interface BuildPlanSkillOptions {
  readonly skillId: SkillId
  readonly upgrades: readonly UpgradeDefinition[]
}

/** Every plannable skill, Basic Attack excluded: it is always owned. */
export function getPlannableSkillIds(): SkillId[] {
  return Object.values(SKILL_DEFINITIONS)
    .map((skill) => skill.id)
    .filter((skillId) => skillId !== BASIC_ATTACK_SKILL_ID)
}

/**
 * The upgrades a plan can hold for its skills, grouped by skill in the order
 * the skills were planned, with Basic Attack first. Synergies are listed
 * separately by `getPlannableSynergies`, since each one belongs to two skills.
 */
export function getPlannableUpgrades(
  skillIds: readonly SkillId[],
): BuildPlanSkillOptions[] {
  return [BASIC_ATTACK_SKILL_ID, ...skillIds].map((skillId) => ({
    skillId,
    upgrades: INITIAL_UPGRADES.filter((upgrade) =>
      !isSynergyUpgradeDefinition(upgrade) &&
      upgrade.skillId === skillId &&
      upgrade.skillAction !== 'unlock',
    ),
  }))
}

/** The synergy cards both of whose skills are in the plan. */
export function getPlannableSynergies(
  skillIds: readonly SkillId[],
): SynergyUpgradeDefinition[] {
  return SYNERGY_UPGRADES.filter((synergy) => isUpgradeInPlanScope(synergy, skillIds))
}

export function withPlanSkill(plan: BuildPlan, skillId: SkillId, planned: boolean): BuildPlan {
  if (skillId === BASIC_ATTACK_SKILL_ID) {
    return plan
  }
  const skillIds = planned
    ? plan.skillIds.includes(skillId) ? plan.skillIds : [...plan.skillIds, skillId]
    : plan.skillIds.filter((candidate) => candidate !== skillId)
  return {
    ...plan,
    skillIds,
    upgradeIds: plan.upgradeIds.filter((upgradeId) =>
      isUpgradeInPlanScope(getUpgradeDefinition(upgradeId), skillIds),
    ),
  }
}

/**
 * Toggles an upgrade in the plan. A skill holds one synergy at a time and
 * takes one evolution, so planning either drops whatever it conflicts with:
 * the planner never holds a pair the run could not offer.
 */
export function withPlanUpgrade(plan: BuildPlan, upgradeId: UpgradeId, planned: boolean): BuildPlan {
  const definition = getUpgradeDefinition(upgradeId)
  if (!planned) {
    return { ...plan, upgradeIds: plan.upgradeIds.filter((candidate) => candidate !== upgradeId) }
  }
  if (!isUpgradeInPlanScope(definition, plan.skillIds) || plan.upgradeIds.includes(upgradeId)) {
    return plan
  }
  const upgradeIds = plan.upgradeIds.filter((candidate) =>
    !upgradesConflict(getUpgradeDefinition(candidate), definition),
  )
  return { ...plan, upgradeIds: [...upgradeIds, upgradeId] }
}

/**
 * The name as typed, empty included. Falling back to the old name here made
 * the field impossible to clear: deleting the last character brought it
 * back. The fallback belongs at save time, where `normalizeBuildPlanName`
 * gives an unnamed plan a number.
 */
export function withPlanName(plan: BuildPlan, name: string): BuildPlan {
  return { ...plan, name: name.slice(0, BUILD_PLAN_NAME_MAX_LENGTH) }
}

/** Whether a level-up card is one of the plan's targets. */
export function isChoicePlanned(
  plan: BuildPlan | null | undefined,
  choice: LevelUpUpgradeChoice,
): boolean {
  if (!plan) {
    return false
  }
  if (
    choice.upgradeId === REMOVE_SKILL_UPGRADE_ID ||
    choice.upgradeId === REMOVE_SYNERGY_UPGRADE_ID
  ) {
    return false
  }
  const definition = getUpgradeDefinition(choice.upgradeId)
  if (definition.skillAction === 'unlock') {
    return definition.skillId !== undefined && plan.skillIds.includes(definition.skillId)
  }
  return plan.upgradeIds.includes(choice.upgradeId)
}

export function isSkillPlanned(plan: BuildPlan | null | undefined, skillId: SkillId): boolean {
  return plan !== null && plan !== undefined && plan.skillIds.includes(skillId)
}

export function isUpgradePlanned(plan: BuildPlan | null | undefined, upgradeId: UpgradeId): boolean {
  return plan !== null && plan !== undefined && plan.upgradeIds.includes(upgradeId)
}

export type BuildPlanTargetStatus =
  /** Owned or acquired. */
  | 'done'
  /** Could be offered on the next level-up. */
  | 'reachable'
  /** Needs another skill in the run first, or a synergy slot freed. */
  | 'blocked'

export interface BuildPlanSkillProgress {
  readonly skillId: SkillId
  readonly name: string
  readonly status: 'done' | 'reachable'
  readonly upgrades: readonly BuildPlanUpgradeProgress[]
}

export interface BuildPlanUpgradeProgress {
  readonly upgradeId: UpgradeId
  readonly name: string
  readonly status: BuildPlanTargetStatus
  /** For a blocked synergy, the planned skill the run still lacks. */
  readonly missingSkillId: SkillId | null
}

export interface BuildPlanSynergyProgress extends BuildPlanUpgradeProgress {
  readonly skillIds: readonly [SkillId, SkillId]
}

export interface BuildPlanProgress {
  readonly skills: readonly BuildPlanSkillProgress[]
  readonly synergies: readonly BuildPlanSynergyProgress[]
  readonly doneCount: number
  readonly totalCount: number
}

export interface BuildPlanRunState {
  readonly ownedSkillIds: readonly SkillId[]
  /** Upgrade status per skill as the HUD snapshot reports it. */
  readonly upgradeStatus: (upgradeId: UpgradeId) => 'acquired' | 'available' | 'unavailable' | null
}

/**
 * Where a run stands against its plan. Reads the same status the skill
 * tooltip shows, so the planner and the tooltip can never disagree about
 * whether a synergy is one level-up away.
 */
export function getBuildPlanProgress(
  plan: BuildPlan,
  run: BuildPlanRunState,
): BuildPlanProgress {
  const owned = (skillId: SkillId): boolean =>
    skillId === BASIC_ATTACK_SKILL_ID || run.ownedSkillIds.includes(skillId)
  const upgradeProgress = (upgradeId: UpgradeId): BuildPlanUpgradeProgress => {
    const definition = getUpgradeDefinition(upgradeId)
    const skillIds = definition.synergySkillIds ??
      (definition.skillId ? [definition.skillId] : [])
    const missingSkillId = skillIds.find((skillId) => !owned(skillId)) ?? null
    const status = run.upgradeStatus(upgradeId)
    return {
      upgradeId,
      name: definition.name,
      status: status === 'acquired'
        ? 'done'
        : status === 'available'
          ? 'reachable'
          : 'blocked',
      missingSkillId,
    }
  }
  const skills = [BASIC_ATTACK_SKILL_ID, ...plan.skillIds]
    .map((skillId): BuildPlanSkillProgress => ({
      skillId,
      name: getSkillDefinition(skillId).name,
      status: owned(skillId) ? 'done' : 'reachable',
      upgrades: plan.upgradeIds
        .filter((upgradeId) => {
          const definition = getUpgradeDefinition(upgradeId)
          return !definition.synergySkillIds && definition.skillId === skillId
        })
        .map(upgradeProgress),
    }))
    .filter((skill) => skill.skillId !== BASIC_ATTACK_SKILL_ID || skill.upgrades.length > 0)
  const synergies = plan.upgradeIds
    .map((upgradeId) => getUpgradeDefinition(upgradeId))
    .filter(isSynergyUpgradeDefinition)
    .map((synergy): BuildPlanSynergyProgress => ({
      ...upgradeProgress(synergy.id),
      skillIds: synergy.synergySkillIds,
    }))
  const targets = [
    ...plan.skillIds.map((skillId) => (owned(skillId) ? 'done' : 'reachable')),
    ...skills.flatMap((skill) => skill.upgrades.map((upgrade) => upgrade.status)),
    ...synergies.map((synergy) => synergy.status),
  ]
  return {
    skills,
    synergies,
    doneCount: targets.filter((status) => status === 'done').length,
    totalCount: targets.length,
  }
}
