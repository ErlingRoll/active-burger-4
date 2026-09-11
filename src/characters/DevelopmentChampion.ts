import {
  CHARACTER_CLASS_DEFINITIONS,
  CHARACTER_CLASS_IDS,
  type CharacterClassId,
} from '../content/classes/CharacterClasses'
import {
  ALL_ITEM_DEFINITIONS,
  EQUIPMENT_SLOTS,
  EquipmentSlot,
  type ItemDefinition,
} from '../content/gear/Items'
import { rollGearModifiersForItem } from '../content/gear/ModifierPools'
import { RARITIES, RARITY_ORDER, Rarity } from '../content/rarity/Rarity'
import { SKILL_DEFINITIONS, type SkillId } from '../content/skills/Skills'
import { INITIAL_UPGRADES } from '../content/upgrades/Upgrades'
import type { UpgradeId } from '../content/upgrades/UpgradeTypes'
import {
  BEHAVIOR_PROFILE_ORDER,
  type BehaviorProfileId,
} from '../content/behaviors/BehaviorProfiles'
import { TARGET_PRIORITY_ORDER } from '../content/behaviors/TargetPriorities'
import { ALL_GEAR_SET_DEFINITIONS, type GearSetId } from '../game-config/gear-sets'
import { createEquippedItem } from '../game/equipment/EquipmentState'
import type { EquipmentLoadout } from '../game/equipment/EquipmentTypes'
import type { RandomSource } from '../shared'
import {
  CHARACTER_SCHEMA_VERSION,
  isCharacterBuildSnapshot,
  type CharacterBuildSkill,
  type CharacterBuildSnapshot,
} from './CharacterTypes'

/**
 * Rolls a Champion build for development, from the same registries and the
 * same gear rolls the game uses, so a generated Champion is one the game
 * would accept from a real run.
 *
 * Every roll goes through the caller's RandomSource, so a seed reproduces a
 * build and the tests can pin one down.
 *
 * The upgrades are the ones a run would have taken to arrive at the rolled
 * skills, and nothing else: an unlock for every skill beyond the class's
 * starting pair, and one level card per rank above the first. A run records
 * its skills and its upgrades together, so a build that carried the skills
 * without the upgrades that grant them was a shape no run produces. Evolutions
 * and synergies stay out; they combine under rules the run's choice flow
 * enforces, and nothing here depends on them.
 */

export interface DevelopmentChampionOptions {
  /** A class, or "random" for one drawn from the roster. */
  classId: CharacterClassId | 'random'
  /** The character level the build claims. Skill levels scale with it. */
  level: number
  /** Every piece of gear rolls at this rarity or better. */
  minimumGearRarity: Rarity
  /** A set to favour, "random" for a scattering of sets, or "none". */
  gearSetId: GearSetId | 'random' | 'none'
  behaviorProfileId: BehaviorProfileId | 'random'
  /** Skills beyond the class's starting ones. */
  extraSkillCount: number
}

export const DEFAULT_DEVELOPMENT_CHAMPION_OPTIONS: DevelopmentChampionOptions = {
  classId: 'random',
  level: 20,
  minimumGearRarity: Rarity.Rare,
  gearSetId: 'random',
  behaviorProfileId: 'random',
  extraSkillCount: 3,
}

export const DEVELOPMENT_CHAMPION_LEVEL_RANGE = { min: 1, max: 100 } as const
export const DEVELOPMENT_CHAMPION_EXTRA_SKILL_RANGE = { min: 0, max: 8 } as const

/** How likely each piece is to carry a set when the set choice is random. */
const RANDOM_SET_CHANCE = 0.4

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function rollRarityAtLeast(minimum: Rarity, rng: RandomSource): Rarity {
  const eligible = RARITIES.filter((rarity) => RARITY_ORDER[rarity] >= RARITY_ORDER[minimum])
  return eligible.length > 0 ? rng.pick(eligible) : minimum
}

function chooseSet(
  slot: EquipmentSlot,
  choice: DevelopmentChampionOptions['gearSetId'],
  rng: RandomSource,
): GearSetId | undefined {
  if (choice === 'none') {
    return undefined
  }
  const setsForSlot = ALL_GEAR_SET_DEFINITIONS.filter((set) => set.slots.includes(slot))
  if (setsForSlot.length === 0) {
    return undefined
  }
  if (choice === 'random') {
    return rng.chance(RANDOM_SET_CHANCE) ? rng.pick(setsForSlot).id : undefined
  }
  return setsForSlot.some((set) => set.id === choice) ? choice : undefined
}

function rollEquipment(
  classId: CharacterClassId,
  options: DevelopmentChampionOptions,
  rng: RandomSource,
): EquipmentLoadout {
  const startingWeapon = ALL_ITEM_DEFINITIONS.find(
    (item) => item.id === CHARACTER_CLASS_DEFINITIONS[classId].startingWeaponItemId,
  )
  const equipment: EquipmentLoadout = {}
  for (const slot of EQUIPMENT_SLOTS) {
    let candidates: readonly ItemDefinition[] = ALL_ITEM_DEFINITIONS.filter(
      (item) => item.slot === slot && !item.starterOnly,
    )
    // A weapon of the class's own kind, so a Ranger is not handed a staff.
    if (slot === EquipmentSlot.Weapon && startingWeapon?.weaponArchetype) {
      const ownKind = candidates.filter(
        (item) => item.weaponArchetype === startingWeapon.weaponArchetype,
      )
      if (ownKind.length > 0) {
        candidates = ownKind
      }
    }
    if (candidates.length === 0) {
      continue
    }
    const definition = rng.pick(candidates)
    const rarity = rollRarityAtLeast(options.minimumGearRarity, rng)
    const modifiers = rollGearModifiersForItem(
      {
        id: definition.id,
        slot: definition.slot,
        ...(definition.weaponArchetype ? { weaponArchetype: definition.weaponArchetype } : {}),
      },
      rarity,
      rng,
    )
    equipment[slot] = createEquippedItem(
      definition,
      rarity,
      modifiers,
      chooseSet(slot, options.gearSetId, rng),
    )
  }
  return equipment
}

/** The catalog's unlock card for a skill, if it has one. */
function findSkillUpgradeId(skillId: SkillId, action: 'unlock' | 'level'): UpgradeId | undefined {
  return INITIAL_UPGRADES.find(
    (upgrade) => upgrade.skillId === skillId && upgrade.skillAction === action,
  )?.id
}

/**
 * Skills a run could have unlocked: those with an unlock card. A skill with
 * no card cannot be acquired mid-run, so a build carrying it as an extra
 * would be one no run produces.
 */
function getUnlockableSkillIds(): SkillId[] {
  return (Object.keys(SKILL_DEFINITIONS) as SkillId[]).filter(
    (skillId) => findSkillUpgradeId(skillId, 'unlock') !== undefined,
  )
}

interface RolledSkills {
  skills: CharacterBuildSkill[]
  /** The unlock and level cards that produce `skills` from the class's starting ones. */
  selectedUpgradeIds: UpgradeId[]
}

function rollSkills(
  classId: CharacterClassId,
  level: number,
  extraSkillCount: number,
  rng: RandomSource,
): RolledSkills {
  // Skill levels grow with the character, one rank per six levels, to five.
  const skillLevelCap = clamp(Math.ceil(level / 6), 1, 5)
  const startingSkillIds = CHARACTER_CLASS_DEFINITIONS[classId].startingSkillIds
  const skills: CharacterBuildSkill[] = startingSkillIds.map(
    (skillId) => ({ skillId, level: rng.int(1, skillLevelCap) }),
  )
  const taken = new Set<string>(skills.map((skill) => skill.skillId))
  const pool = getUnlockableSkillIds().filter((skillId) => !taken.has(skillId))
  const extra = clamp(Math.floor(extraSkillCount), 0, pool.length)
  for (let index = 0; index < extra; index += 1) {
    const [skillId] = pool.splice(rng.int(0, pool.length - 1), 1)
    if (skillId !== undefined) {
      skills.push({ skillId, level: rng.int(1, skillLevelCap) })
    }
  }

  /*
   * A skill's level is one plus its level cards, so a skill with no level
   * card stays at rank one however far the character has come.
   */
  const selectedUpgradeIds: UpgradeId[] = []
  for (const skill of skills) {
    if (!startingSkillIds.includes(skill.skillId)) {
      const unlockId = findSkillUpgradeId(skill.skillId, 'unlock')
      if (unlockId === undefined) {
        throw new Error(`Rolled a skill with no unlock card: ${skill.skillId}`)
      }
      selectedUpgradeIds.push(unlockId)
    }
    const levelId = findSkillUpgradeId(skill.skillId, 'level')
    if (levelId === undefined) {
      skill.level = 1
      continue
    }
    for (let rank = 1; rank < skill.level; rank += 1) {
      selectedUpgradeIds.push(levelId)
    }
  }
  return { skills, selectedUpgradeIds }
}

export function generateDevelopmentChampionBuild(
  options: DevelopmentChampionOptions,
  rng: RandomSource,
): CharacterBuildSnapshot {
  const classId = options.classId === 'random' ? rng.pick(CHARACTER_CLASS_IDS) : options.classId
  const level = clamp(
    Math.floor(options.level),
    DEVELOPMENT_CHAMPION_LEVEL_RANGE.min,
    DEVELOPMENT_CHAMPION_LEVEL_RANGE.max,
  )
  const { skills, selectedUpgradeIds } = rollSkills(classId, level, options.extraSkillCount, rng)
  const build: CharacterBuildSnapshot = {
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    level,
    classId,
    skills,
    selectedUpgradeIds,
    equipment: rollEquipment(classId, options, rng),
    behaviorProfileId: options.behaviorProfileId === 'random'
      ? rng.pick(BEHAVIOR_PROFILE_ORDER)
      : options.behaviorProfileId,
    targetPriorityId: rng.pick(TARGET_PRIORITY_ORDER),
  }
  if (!isCharacterBuildSnapshot(build)) {
    throw new Error('Generated a Champion build the game would not accept.')
  }
  return build
}

const CHAMPION_EPITHETS = [
  'Iron', 'Quiet', 'Bold', 'Ashen', 'Swift', 'Grim', 'Lucky', 'Old',
  'Restless', 'Patient', 'Hollow', 'Bright',
] as const

/** A name that says what it is: an epithet, the class, and a number. */
export function generateDevelopmentChampionName(
  classId: CharacterClassId,
  rng: RandomSource,
): string {
  return `${rng.pick(CHAMPION_EPITHETS)} ${CHARACTER_CLASS_DEFINITIONS[classId].name} ${rng.int(10, 99)}`
}
