import { RARITY_ORDER, isRarity } from '../rarity/Rarity'
import { SKILL_DEFINITIONS, type SkillTag } from '../skills/SkillConfigs'
import { normalizeGearSetId } from '../../game-config/gear-sets'
import type { CampJobDefinition } from './CampTypes'

/**
 * The labour sheet: what a Champion is worth at the Camp, read off the same
 * build it fights with.
 *
 * The Camp must not reduce a Champion to its class. The level, the gear and
 * the skills are what the player earned in the run that won the Champion, and
 * they have to matter again every time the player decides who works and who
 * descends. So the sheet is derived from the build snapshot, and skill tags
 * only decide where it shines.
 *
 * This is one of two twins. `camp_labour_sheet` in the migrations computes
 * the identical sheet in SQL so that the assign RPC can snapshot it onto the
 * assignment row, and the two are held together by a fixture set of builds
 * whose sheets both must reproduce: `tests/campRegistry.test.ts` pins the
 * TypeScript side to `tests/fixtures/campLabourSheets.json`, and the migration asserts
 * the same fixtures when it is applied. Change one, change all three.
 *
 * The full stat resolver in the simulation is not ported. The sheet reads
 * the same inputs through a simpler, mirrored formula, and every figure is
 * rounded to four decimals so that a double and a Postgres numeric agree.
 */

/** The parts of a build the sheet reads. A `CharacterBuildSnapshot` satisfies it. */
export interface CampLabourBuild {
  level?: number | undefined
  skills: readonly { skillId: string, level: number }[]
  equipment: { readonly [slot: string]: CampLabourPiece | undefined }
  behaviorProfileId: string
}

export interface CampLabourPiece {
  rarity?: string | undefined
  modifiers?: readonly { id: string, value: number }[] | undefined
  setId?: string | undefined
}

export interface CampLabourSheet {
  /** A veteran is better at all of it: level and source floor, ×1.0 to ×1.3. */
  strength: number
  /** The production rate. A fast fighter is a fast worker. */
  tempo: number
  /** Hours this Champion works before it downs tools, six to twelve. */
  staminaHours: number
  /** Extra units per claim. Hauls more per trip. */
  load: number
  /** Chance a claim pays a bonus stack, zero to a quarter. */
  bonusChance: number
  /** Set and tag fit for the job the sheet was derived for, ×1.0 to ×1.25. */
  fit: number
  /** Construction speed, for when timed construction lands. */
  haste: number
  /** Tempo, load and fit multiplied, and capped: the figure accrual uses. */
  output: number
  /** The sums the figures came from, so a panel can show its working. */
  inputs: CampLabourInputs
}

export interface CampLabourInputs {
  level: number
  /** The source run's floor count, or the level standing in for it. */
  floor: number
  attackSpeedPercent: number
  maxHpFlat: number
  increasedDamagePercent: number
  critChancePercent: number
  movementSpeedPercent: number
  /** Pieces wearing the job's set, weighted by rarity. */
  setRarityWeight: number
  /** Levels of the skills that carry one of the job's tags. */
  tagLevelWeight: number
}

/** The hours a balanced Champion with no Max HP on its gear works. */
export const CAMP_STAMINA_BASE_HOURS = 8
export const CAMP_STAMINA_MIN_HOURS = 6
export const CAMP_STAMINA_MAX_HOURS = 12

export const CAMP_STRENGTH_CAP = 1.3
export const CAMP_TEMPO_RANGE = { min: 1, max: 2 } as const
export const CAMP_LOAD_RANGE = { min: 1, max: 2 } as const
export const CAMP_FIT_CAP = 1.25
export const CAMP_SET_FIT_CAP = 0.15
export const CAMP_TAG_FIT_CAP = 0.1
export const CAMP_BONUS_CHANCE_CAP = 0.25
export const CAMP_OUTPUT_CAP = 2

/**
 * The profile trades one knob against the other: aggressive burns fast,
 * cautious lasts, balanced does neither.
 */
export const CAMP_PROFILE_FACTORS: Readonly<Record<string, { tempo: number, stamina: number }>> = {
  aggressive: { tempo: 1.2, stamina: 0.75 },
  balanced: { tempo: 1, stamina: 1 },
  cautious: { tempo: 0.8, stamina: 1.25 },
}

/** The modifiers the sheet sums, by the id gear stores them under. */
const ATTACK_SPEED_MODIFIER = 'attack-speed'
const MAX_HP_MODIFIER = 'max-hp'
const CRIT_CHANCE_MODIFIER = 'crit-chance'
const MOVEMENT_SPEED_MODIFIER = 'movement-speed'
const INCREASED_DAMAGE_MODIFIERS: ReadonlySet<string> = new Set([
  'increased-global-damage',
  'increased-physical-damage',
  'increased-elemental-damage',
  'increased-chaos-damage',
])

function round4(value: number): number {
  return Math.round(value * 10000) / 10000
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function sumModifiers(
  build: CampLabourBuild,
  matches: (modifierId: string) => boolean,
): number {
  let total = 0
  for (const piece of Object.values(build.equipment)) {
    for (const modifier of piece?.modifiers ?? []) {
      if (matches(modifier.id) && Number.isFinite(modifier.value)) {
        total += modifier.value
      }
    }
  }
  return total
}

/** Common counts one and legendary five, so a legendary set piece counts for more. */
function rarityWeight(rarity: string | undefined): number {
  return isRarity(rarity) ? RARITY_ORDER[rarity] + 1 : 1
}

function setRarityWeight(build: CampLabourBuild, job: CampJobDefinition): number {
  let total = 0
  for (const piece of Object.values(build.equipment)) {
    if (piece && normalizeGearSetId(piece.setId) === job.fitSetId) {
      total += rarityWeight(piece.rarity)
    }
  }
  return total
}

/** A level is a positive integer; anything else counts as the first. */
function wholeLevel(level: number | undefined): number {
  return level !== undefined && Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1
}

function skillTags(skillId: string): readonly SkillTag[] {
  return (SKILL_DEFINITIONS as Record<string, { tags: readonly SkillTag[] } | undefined>)[skillId]?.tags ?? []
}

function tagLevelWeight(build: CampLabourBuild, job: CampJobDefinition): number {
  let total = 0
  for (const skill of build.skills) {
    const tags = skillTags(skill.skillId)
    if (job.fitTags.some((tag) => tags.includes(tag))) {
      total += wholeLevel(skill.level)
    }
  }
  return total
}

export interface CampLabourSource {
  build: CampLabourBuild
  /**
   * The floor count of the run that won the Champion, or null when there is
   * no run: a Champion made by the development tools has none, and its level
   * stands in so it works the Camp exactly like an earned one.
   */
  sourceFloor: number | null
}

/** Derives the sheet a Champion would work `job` with. */
export function deriveCampLabourSheet(
  source: CampLabourSource,
  job: CampJobDefinition,
): CampLabourSheet {
  const { build } = source
  const level = wholeLevel(build.level)
  const floor = source.sourceFloor === null ? level : Math.max(1, Math.floor(source.sourceFloor))
  const profile = CAMP_PROFILE_FACTORS[build.behaviorProfileId] ?? CAMP_PROFILE_FACTORS.balanced ?? { tempo: 1, stamina: 1 }

  const inputs: CampLabourInputs = {
    level,
    floor,
    attackSpeedPercent: sumModifiers(build, (id) => id === ATTACK_SPEED_MODIFIER),
    maxHpFlat: sumModifiers(build, (id) => id === MAX_HP_MODIFIER),
    increasedDamagePercent: sumModifiers(build, (id) => INCREASED_DAMAGE_MODIFIERS.has(id)),
    critChancePercent: sumModifiers(build, (id) => id === CRIT_CHANCE_MODIFIER),
    movementSpeedPercent: sumModifiers(build, (id) => id === MOVEMENT_SPEED_MODIFIER),
    setRarityWeight: setRarityWeight(build, job),
    tagLevelWeight: tagLevelWeight(build, job),
  }

  const strength = round4(Math.min(
    CAMP_STRENGTH_CAP,
    1 + 0.01 * Math.max(0, level - 10) + 0.02 * Math.max(0, floor - 10),
  ))
  const tempo = round4(clamp(
    strength * (1 + inputs.attackSpeedPercent / 200) * profile.tempo,
    CAMP_TEMPO_RANGE.min,
    CAMP_TEMPO_RANGE.max,
  ))
  const staminaHours = round4(clamp(
    CAMP_STAMINA_BASE_HOURS * (1 + inputs.maxHpFlat / 400) * profile.stamina,
    CAMP_STAMINA_MIN_HOURS,
    CAMP_STAMINA_MAX_HOURS,
  ))
  const load = round4(clamp(
    strength * (1 + inputs.increasedDamagePercent / 300),
    CAMP_LOAD_RANGE.min,
    CAMP_LOAD_RANGE.max,
  ))
  const bonusChance = round4(Math.min(inputs.critChancePercent, 25) / 100)
  const fit = round4(Math.min(
    CAMP_FIT_CAP,
    1 +
      Math.min(CAMP_SET_FIT_CAP, inputs.setRarityWeight * 0.005) +
      Math.min(CAMP_TAG_FIT_CAP, inputs.tagLevelWeight * 0.01),
  ))
  const haste = round4(1 + inputs.movementSpeedPercent / 100)
  const output = round4(Math.min(CAMP_OUTPUT_CAP, tempo * load * fit))

  return { strength, tempo, staminaHours, load, bonusChance, fit, haste, output, inputs }
}

/** "Tempo ×1.3 · Stamina 10h · Load ×1.1 · Fit ×1.05", the way the picker shows it. */
export function formatCampLabourSheet(sheet: CampLabourSheet): string {
  const times = (value: number): string => `×${trimNumber(value, 2)}`
  return [
    `Tempo ${times(sheet.tempo)}`,
    `Stamina ${trimNumber(sheet.staminaHours, 1)}h`,
    `Load ${times(sheet.load)}`,
    `Fit ${times(sheet.fit)}`,
  ].join(' · ')
}

function trimNumber(value: number, decimals: number): string {
  return String(Number(value.toFixed(decimals)))
}
