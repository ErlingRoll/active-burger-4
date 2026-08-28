import {
  xpRequiredForLevel,
  xpRequiredForNextLevel,
} from '../../content/progression/XpBalance'
import {
  EQUIPMENT_SLOTS,
  getItemDisplayName,
  getItemDefinition,
  getLegacyItemSetId,
  type EquipmentSlot,
  type WeaponArchetype,
} from '../../content/gear/Items'
import type { Rarity } from '../../content/rarity/Rarity'
import {
  doesGearModifierAffectSkill,
  sortGearModifiers,
  type GearModifier,
} from '../../content/gear/ModifierPools'
import {
  BASIC_ATTACK_SKILL_ID,
  getBasicAttackVariant,
  getSkillDefinition,
  getSkillDamage,
  getSkillHealing,
  getEffectiveSkillCooldown,
  isSkillId,
  FIERY_TOUCH_SKILL_ID,
  RAISE_SKELETON_SKILL_ID,
  VITALITY_SKILL_ID,
  WHIRLWIND_SKILL_ID,
  type SkillId,
  type SkillTag,
} from '../../content/skills/Skills'
import { DEFAULT_SKILL_SLOT_COUNT } from '../../game-config/skills'
import { getSkillDamageIncreasePercent } from '../../content/upgrades/Upgrades'
import {
  INITIAL_UPGRADES,
  getSkillCooldownReductionPercent,
  type UpgradeId,
} from '../../content/upgrades/Upgrades'
import type {
  BossState,
  EncounterStatus,
  GameState,
  PlayerMovementCandidate,
  TelegraphState,
} from '../state/GameState'
import type { RunPhase } from '../state/RunPhase'
import { resolveWorldModifierEffects } from '../../content/modifiers/WorldModifiers'
import { SPAWN_BALANCE } from '../../content/spawning/SpawnBalance'
import {
  getBossDefinition,
  type BossDefinitionId,
} from '../../content/bosses/Bosses'
import type { EntityId } from '../ids'
import {
  getDerivedPlayerStats,
  getEquippedGearSetPieceCounts,
} from '../stats/DerivedStats'
import {
  ALL_GEAR_SET_DEFINITIONS,
  getActiveGearSetBonuses,
  type GearSetId,
} from '../../game-config/gear-sets'
import { createPlayerDamageProfileFromStats } from '../combat/DamageSources'
import {
  addDamageValues,
  DAMAGE_INCREASE_TYPES,
  DAMAGE_TYPES,
  getAverageCriticalStrikeFactor,
  getResistanceForDamageType,
  sumDamageValues,
  type DamageIncreaseType,
  type DamageResistanceType,
  type DamageType,
  type DamageValues,
} from '../../content/stats/Damage'
import {
  DEFAULT_BEHAVIOR_PROFILE_ID,
  getBehaviorProfileDefinition,
  type BehaviorProfileId,
} from '../../content/behaviors/BehaviorProfiles'
import {
  createDungeonEncounterTimeline,
  getDungeonDefinition,
} from '../../content/dungeons/Dungeons'
import type { EncounterDefinition } from '../../content/encounters/Encounters'
import {
  getInfernoWardenEnrageMultipliers,
  type BossEnrageMultipliers,
} from '../systems/boss/BossSystem'
import {
  FLOOR_TRANSITION_SECONDS,
  isPlayerTouchingStairs,
} from '../systems/stairs/StairsSystem'
import {
  cloneChoiceFlow,
  type PendingChoiceFlow,
} from '../choices/ChoiceFlows'
import { getEquippedWeaponArchetype } from '../equipment/EquipmentState'

/** Narrow, immutable run data intended for screen-space UI consumers. */
export interface RunHudSnapshot {
  readonly phase: RunPhase
  readonly hp: number
  readonly maxHp: number
  readonly level: number
  readonly xp: number
  readonly xpRequired: number
  readonly xpProgress: number
  readonly elapsedTime: number
  readonly killCount: number
  readonly worldModifierIds?: readonly string[]
  readonly worldModifierRewardMultiplier?: number
  readonly floor: number
  readonly floorProgress: number
  readonly floorElapsedTime: number
  readonly floorDurationSeconds: number
}

export type SkillUpgradeStatus = 'acquired' | 'available' | 'unavailable'

export interface SkillUpgradeSnapshot {
  readonly upgradeId: UpgradeId
  readonly name: string
  readonly description: string
  readonly valueLabel: string
  readonly relevant: true
  readonly status: SkillUpgradeStatus
}

export interface SkillHudSnapshot {
  readonly skillId: SkillId
  readonly name: string
  readonly icon: string
  readonly level: number
  readonly castCount: number
  readonly description: string
  readonly tags: readonly SkillTag[]
  /** Damage after flat and increased gear modifiers, before critical strikes and resistance. */
  readonly damage: DamageValues
  readonly damageTypes: readonly DamageType[]
  /** Cooldown for non-Basic-Attack skills after cooldown reduction. */
  readonly cooldownSeconds: number | null
  /** Fraction of the current cooldown that remains, from zero to one. */
  readonly cooldownProgress: number
  /** Basic Attack cadence after attack-speed modifiers. */
  readonly attacksPerSecond: number | null
  readonly estimatedSingleTargetDps: number | null
  readonly dpsAssumption: string
  readonly healingPerCast: number | null
  /** Effective skill-specific stats, including their global gear contributions. */
  readonly skillModifiers: readonly SkillModifierSummarySnapshot[]
  /** Summed gear modifiers that affect this skill in the current combat systems. */
  readonly gearModifiers: readonly GearModifierSummarySnapshot[]
  readonly upgrades: readonly SkillUpgradeSnapshot[]
}

export type CharacterStatGroupId =
  | 'offence'
  | 'defence'

export interface CharacterStatSnapshot {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly description: string
  readonly appliesTo: string
}

export interface CharacterStatGroupSnapshot {
  readonly id: CharacterStatGroupId
  readonly title: string
  readonly stats: readonly CharacterStatSnapshot[]
}

export interface CharacterStatsHudSnapshot {
  readonly groups: readonly CharacterStatGroupSnapshot[]
}

export interface BossHudSnapshot {
  readonly id: EntityId | undefined
  readonly bossDefinitionId: BossDefinitionId
  readonly name: string
  readonly status: EncounterStatus
  readonly hp: number
  readonly maxHp: number
  readonly hpProgress: number
  readonly isFinal: boolean
  readonly enrage: BossEnrageHudSnapshot | null
}

export interface BossEnrageHudSnapshot extends BossEnrageMultipliers {
  readonly elapsedSeconds: number
}

export type EncounterTimelineStatus = 'completed' | 'active' | 'upcoming'

export interface EncounterTimelineHudSnapshot {
  readonly id: string
  readonly floorNumber: number
  readonly name: string
  readonly status: EncounterTimelineStatus
  readonly isFinal: boolean
}

export interface StairsHudSnapshot {
  readonly id: EntityId
  readonly x: number
  readonly y: number
  readonly radius: number
  readonly floorNumber: number
  readonly isFinal: boolean
  readonly rewardsCollected: boolean
  readonly playerTouching: boolean
}

export interface FloorTransitionHudSnapshot {
  readonly remainingSeconds: number
  readonly fromFloor: number
  readonly toFloor: number
  readonly isFinal: boolean
  readonly progress: number
}

export interface PickupHudSnapshot {
  readonly id: EntityId
  readonly kind: 'xp' | 'gear' | 'healing-potion'
  readonly x: number
  readonly y: number
  readonly radius: number
  readonly amount?: number
}

export interface TelegraphHudSnapshot {
  readonly id: EntityId
  readonly sourceId: EntityId
  readonly skillId: TelegraphState['skillId']
  readonly kind: TelegraphState['kind']
  readonly x: number
  readonly y: number
  readonly radius: number
  readonly remainingDuration: number
  readonly duration: number
  readonly progress: number
  readonly points: readonly PointSnapshot[]
}

export interface DodgeHudSnapshot {
  readonly mode: 'autonomous'
  readonly level: number
  readonly reactionTime: number
  readonly active: boolean
  /** Progress through the currently telegraphed Dodge response. */
  readonly progress: number
  readonly activeTelegraphCount: number
  readonly directionX: number
  readonly directionY: number
}

export interface BehaviorIntentHudSnapshot {
  readonly source: PlayerMovementCandidate['source']
  readonly label: string
  readonly directionX: number
  readonly directionY: number
  readonly speed: number
  readonly priority: number
  readonly targetId?: EntityId
  readonly pickupId?: EntityId
  readonly commitmentRemaining?: number
}

export interface BehaviorHudSnapshot {
  readonly profileId: BehaviorProfileId
  readonly profileName: string
  readonly profileDescription: string
  readonly activeIntent: BehaviorIntentHudSnapshot | null
}

interface PointSnapshot {
  readonly x: number
  readonly y: number
}

export interface GameUiSnapshot extends RunHudSnapshot {
  readonly skillSlotCount: number
  readonly skills: readonly SkillHudSnapshot[]
  readonly equipment: Readonly<
    Partial<Record<EquipmentSlot, EquippedItemSnapshot>>
  >
  readonly gearSets: readonly GearSetHudSnapshot[]
  readonly characterStats: CharacterStatsHudSnapshot
  readonly encounterStatus: EncounterStatus
  readonly boss: BossHudSnapshot | null
  readonly telegraphs: readonly TelegraphHudSnapshot[]
  readonly dodge: DodgeHudSnapshot
  readonly behavior: BehaviorHudSnapshot
  readonly timeline: readonly EncounterTimelineHudSnapshot[]
  readonly stairs: StairsHudSnapshot | null
  readonly floorTransition: FloorTransitionHudSnapshot | null
  readonly pickups: readonly PickupHudSnapshot[]
  readonly pendingChoiceFlow: Readonly<PendingChoiceFlow> | null
  readonly pendingChoiceCount: number
}

export interface EquippedItemSnapshot {
  readonly itemId: string
  readonly name: string
  readonly slot: EquipmentSlot
  readonly rarity: Rarity
  readonly setId?: GearSetId
  readonly modifiers: readonly GearModifierSnapshot[]
}

export interface GearSetHudSnapshot {
  readonly setId: GearSetId
  readonly name: string
  readonly equippedPieces: number
  readonly pieceCount: number
  readonly bonuses: readonly {
    requiredPieces: number
    label: string
    active: boolean
  }[]
}

export interface GearModifierSnapshot {
  readonly id: GearModifier['id']
  readonly tier: GearModifier['tier']
  readonly value: number
  readonly sourceId: string
}

export interface GearModifierSummarySnapshot {
  readonly id: GearModifier['id']
  readonly value: number
}

export type SkillModifierSummaryId =
  | 'attack-damage'
  | 'attack-speed'
  | 'attack-range'
  | 'cooldown-reduction'
  | 'area-of-effect'
  | 'melee-leech'
  | 'whirlwind-leech'
  | 'basic-attack-extra-projectiles'
  | 'healing-per-cast'
  | 'increased-healing'
  | 'dot-multiplier'
  | 'summon-damage'
  | 'summon-max-hp'
  | 'summon-attack-speed'
  | 'summon-max-count'
  | 'skill-cooldown-reduction'

export interface SkillModifierSummarySnapshot {
  readonly id: SkillModifierSummaryId
  readonly label: string
  readonly value: string
}

function summarizeGearModifiers(
  modifiers: readonly GearModifier[],
): readonly GearModifierSummarySnapshot[] {
  const summaries = new Map<GearModifier['id'], GearModifierSummarySnapshot>()
  for (const modifier of modifiers) {
    const existing = summaries.get(modifier.id)
    summaries.set(modifier.id, {
      id: modifier.id,
      value: (existing?.value ?? 0) + modifier.value,
    })
  }
  return Object.freeze(
    sortGearModifiers([...summaries.values()]).map(({ id, value }) =>
      Object.freeze({ id, value }),
    ),
  )
}

function createSkillModifierSummary(
  id: SkillModifierSummaryId,
  label: string,
  value: string,
): SkillModifierSummarySnapshot {
  return Object.freeze({ id, label, value })
}

function getSkillModifierSummaries(
  playerStats: ReturnType<typeof getDerivedPlayerStats>,
  skillId: SkillId,
  skillLevel: number,
  skillTags: readonly SkillTag[],
  supportsAreaOfEffect: boolean,
  skeletonMaxCountBonus = 0,
  selectedUpgradeIds: readonly UpgradeId[] = [],
): readonly SkillModifierSummarySnapshot[] {
  const summaries: SkillModifierSummarySnapshot[] = []
  const addSummary = (
    id: SkillModifierSummaryId,
    label: string,
    value: number,
    formattedValue: string,
  ): void => {
    if (Number.isFinite(value)) {
      summaries.push(createSkillModifierSummary(id, label, formattedValue))
    }
  }

  if (skillTags.includes('dot') && playerStats.dotMultiplier > 0) {
    addSummary(
      'dot-multiplier',
      'DoT multiplier',
      playerStats.dotMultiplier,
      formatUnsignedPercent(playerStats.dotMultiplier),
    )
  }

  if (skillId === BASIC_ATTACK_SKILL_ID) {
    addSummary(
      'attack-damage',
      'Attack damage',
      playerStats.attackDamage,
      formatStatNumber(playerStats.attackDamage),
    )
    addSummary(
      'attack-speed',
      'Attack speed',
      playerStats.attackSpeed,
      `${formatStatNumber(playerStats.attackSpeed)} atk/s`,
    )
    addSummary(
      'attack-range',
      'Attack range',
      playerStats.attackRange,
      formatStatNumber(playerStats.attackRange),
    )
    if (
      skillTags.includes('projectile') &&
      playerStats.basicAttackExtraProjectiles > 0
    ) {
      addSummary(
        'basic-attack-extra-projectiles',
        'Extra projectiles',
        playerStats.basicAttackExtraProjectiles,
        formatStatNumber(playerStats.basicAttackExtraProjectiles),
      )
    }
    if (skillTags.includes('melee') && playerStats.meleeLeech > 0) {
      addSummary(
        'melee-leech',
        'Melee leech',
        playerStats.meleeLeech,
        formatUnsignedPercent(playerStats.meleeLeech * 100),
      )
    }
  } else {
    if (playerStats.cooldownReduction > 0) {
      addSummary(
        'cooldown-reduction',
        'Cooldown reduction',
        playerStats.cooldownReduction,
        formatUnsignedPercent(playerStats.cooldownReduction),
      )
    }
    if (skillId === FIERY_TOUCH_SKILL_ID) {
      const skillCooldownReduction = getSkillCooldownReductionPercent(
        skillId,
        selectedUpgradeIds,
      )
      if (skillCooldownReduction > 0) {
        addSummary(
          'skill-cooldown-reduction',
          'Fiery Touch cooldown reduction',
          skillCooldownReduction,
          formatUnsignedPercent(skillCooldownReduction),
        )
      }
    }
    if (supportsAreaOfEffect && playerStats.areaOfEffect > 0) {
      addSummary(
        'area-of-effect',
        'Area of effect',
        playerStats.areaOfEffect,
        formatUnsignedPercent(playerStats.areaOfEffect),
      )
    }
    if (skillId === WHIRLWIND_SKILL_ID && playerStats.whirlwindLeech > 0) {
      addSummary(
        'whirlwind-leech',
        'Whirlwind leech',
        playerStats.whirlwindLeech,
        formatUnsignedPercent(playerStats.whirlwindLeech * 100),
      )
    }
    if (skillId === VITALITY_SKILL_ID) {
      const healingMultiplier = 1 + playerStats.increasedHealing / 100
      addSummary(
        'healing-per-cast',
        'Healing per cast',
        getSkillHealing(getSkillDefinition(skillId), skillLevel) * healingMultiplier,
        formatStatNumber(
          getSkillHealing(getSkillDefinition(skillId), skillLevel) * healingMultiplier,
        ),
      )
      if (playerStats.increasedHealing > 0) {
        addSummary(
          'increased-healing',
          'Increased healing',
          playerStats.increasedHealing,
          formatUnsignedPercent(playerStats.increasedHealing),
        )
      }
    }
    if (skillId === RAISE_SKELETON_SKILL_ID) {
      const definition = getSkillDefinition(skillId)
      const levelIncrease = getSkillDamageIncreasePercent(skillId, skillLevel)
      const skeletonDamage = createPlayerDamageProfileFromStats(
        playerStats,
        { physical: definition.summonBaseDamage ?? 0 },
        { additionalIncreasedDamage: { global: levelIncrease } },
      ).damage.physical
      addSummary(
        'summon-damage',
        'Skeleton damage',
        skeletonDamage,
        formatStatNumber(skeletonDamage),
      )
      addSummary(
        'summon-max-hp',
        'Skeleton max HP',
        (definition.summonBaseMaxHp ?? 0) +
          (definition.summonMaxHpPerLevel ?? 0) * Math.max(0, skillLevel - 1),
        formatStatNumber(
          (definition.summonBaseMaxHp ?? 0) +
            (definition.summonMaxHpPerLevel ?? 0) * Math.max(0, skillLevel - 1),
        ),
      )
      addSummary(
        'summon-attack-speed',
        'Skeleton attack speed',
        1 / (definition.summonAttackCooldown ?? 1),
        `${formatStatNumber(1 / (definition.summonAttackCooldown ?? 1))} atk/s`,
      )
      addSummary(
        'summon-max-count',
        'Maximum skeletons',
        (definition.summonBaseMaxCount ?? 1) + Math.max(0, skeletonMaxCountBonus),
        formatStatNumber(
          (definition.summonBaseMaxCount ?? 1) + Math.max(0, skeletonMaxCountBonus),
        ),
      )
    }
  }

  return Object.freeze(summaries)
}

const SKILL_SUMMARIZED_GEAR_MODIFIER_IDS = new Set<GearModifier['id']>([
  'attack-speed',
  'attack-range',
  'cooldown-reduction',
  'area-of-effect',
  'melee-leech',
  'basic-attack-extra-projectiles',
  'dot-multiplier',
])

const DAMAGE_TYPE_LABELS: Record<DamageType, string> = {
  physical: 'Physical damage',
  lightning: 'Lightning damage',
  fire: 'Fire damage',
  cold: 'Cold damage',
  chaos: 'Chaos damage',
}

const DAMAGE_INCREASE_LABELS: Record<DamageIncreaseType, string> = {
  global: 'Global damage',
  physical: 'Physical damage',
  elemental: 'Elemental damage',
  chaos: 'Chaos damage',
  projectile: 'Projectile damage',
}

const RESISTANCE_LABELS: Record<DamageResistanceType, string> = {
  physical: 'Physical resistance',
  elemental: 'Elemental resistance',
  lightning: 'Lightning resistance',
  fire: 'Fire resistance',
  cold: 'Cold resistance',
  chaos: 'Chaos resistance',
}

function formatStatNumber(value: number, maximumFractionDigits = 2): string {
  const rounded = Number(value.toFixed(maximumFractionDigits))
  if (Number.isInteger(rounded)) {
    return rounded.toString()
  }
  return rounded
    .toFixed(maximumFractionDigits)
    .replace(/\.?0+$/, '')
}

function formatUnsignedPercent(value: number, maximumFractionDigits = 2): string {
  return `${formatStatNumber(value, maximumFractionDigits)}%`
}

function formatSignedPercent(value: number, maximumFractionDigits = 2): string {
  const prefix = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${prefix}${formatStatNumber(Math.abs(value), maximumFractionDigits)}%`
}

function formatSignedFlatValue(value: number, maximumFractionDigits = 2): string {
  const prefix = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${prefix}${formatStatNumber(Math.abs(value), maximumFractionDigits)}`
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function createCharacterStatSnapshot(
  id: string,
  label: string,
  value: string,
  description: string,
  appliesTo: string,
): CharacterStatSnapshot {
  return Object.freeze({
    id,
    label,
    value,
    description,
    appliesTo,
  })
}

function createCharacterStatGroupSnapshot(
  id: CharacterStatGroupId,
  title: string,
  stats: readonly CharacterStatSnapshot[],
): CharacterStatGroupSnapshot {
  return Object.freeze({
    id,
    title,
    stats: Object.freeze([...stats]),
  })
}

function getAcquiredSkillUpgradeValueLabel(
  upgrade: (typeof INITIAL_UPGRADES)[number],
  skillLevel: number,
  selectedUpgradeIds: readonly UpgradeId[],
): string {
  if (
    upgrade.skillAction !== 'level' ||
    (upgrade.skillDamageIncreasePercent === undefined &&
      upgrade.skillHealingIncreaseAmount === undefined &&
      upgrade.skillCooldownReductionPercent === undefined)
  ) {
    const acquiredRanks = selectedUpgradeIds.filter(
      (upgradeId) => upgradeId === upgrade.id,
    ).length
    return upgrade.stat !== undefined ||
      upgrade.whirlwindLeechAmount !== undefined ||
    upgrade.increasedHealingPercent !== undefined ||
    upgrade.skillCooldownReductionPercent !== undefined
      ? scaleUpgradeValueLabel(upgrade.valueLabel, acquiredRanks)
      : upgrade.valueLabel
  }

  const acquiredRanks = Math.max(
    Math.max(0, skillLevel - 1),
    selectedUpgradeIds.filter((upgradeId) => upgradeId === upgrade.id).length,
  )
  if (upgrade.skillDamageIncreasePercent !== undefined) {
    const label = upgrade.valueLabel.replace(/^\+\d+%\s+/, '')
    return `+${acquiredRanks * upgrade.skillDamageIncreasePercent}% ${label}`
  }
  const label = upgrade.valueLabel.replace(/^\+\d+\s+/, '')
  return `+${acquiredRanks * (upgrade.skillHealingIncreaseAmount ?? 0)} ${label}`
}

function scaleUpgradeValueLabel(valueLabel: string, rank: number): string {
  if (rank <= 1) {
    return valueLabel
  }

  const match = valueLabel.match(/^([+-])(\d*\.?\d+)(.*)$/)
  if (!match) {
    return valueLabel
  }

  const value = Number(match[2]) * rank
  return `${match[1]}${formatStatNumber(value)}${match[3]}`
}

function createCharacterStatsSnapshot(
  playerStats: ReturnType<typeof getDerivedPlayerStats>,
  weaponArchetype: WeaponArchetype | undefined,
): CharacterStatsHudSnapshot {
  const basicAttackVariant = getBasicAttackVariant(weaponArchetype)
  const projectileVariantNote = basicAttackVariant.kind === 'projectile'
    ? `Currently applies to your ${titleCase(basicAttackVariant.id)} Basic Attack variant.`
    : 'Sword Basic Attack is not projectile-tagged, so this is currently inactive unless you swap weapons.'
  const areaApplicability = basicAttackVariant.id === 'sword'
    ? 'Whirlwind, your sword Basic Attack reach and arc, and the range of chained Basic Attack projectiles. It does not currently change Chain Lightning.'
    : 'Whirlwind, sword Basic Attack reach and arc, and the range of chained Basic Attack projectiles. It does not currently change Chain Lightning.'
  const offenceStats = [
    createCharacterStatSnapshot(
      'cooldown-reduction',
      'Cooldown reduction',
      formatUnsignedPercent(playerStats.cooldownReduction),
      'Shortens non-Basic-Attack cooldowns multiplicatively, down to a 0.1 second minimum.',
      'Whirlwind, Chain Lightning, and Vitality; never Basic Attack.',
    ),
    createCharacterStatSnapshot(
      'area-of-effect',
      'Area of effect',
      formatUnsignedPercent(playerStats.areaOfEffect),
      'Scales the size-based combat systems that currently read area scaling.',
      areaApplicability,
    ),
    createCharacterStatSnapshot(
      'crit-chance',
      'Crit chance',
      formatUnsignedPercent(playerStats.critChance),
      'Determines how often player hits critically strike.',
      'All player damage sources.',
    ),
    createCharacterStatSnapshot(
      'crit-multiplier',
      'Crit multiplier',
      formatUnsignedPercent(playerStats.critMultiplier),
      'Determines how much damage a critical strike deals.',
      'All player critical strikes.',
    ),
    createCharacterStatSnapshot(
      'dot-multiplier',
      'DoT multiplier',
      formatUnsignedPercent(playerStats.dotMultiplier),
      'Increases the damage of damage-over-time effects when they are applied.',
      'All player damage-over-time effects, including poison.',
    ),
    createCharacterStatSnapshot(
      'projectile-chains',
      'Projectile chains',
      formatStatNumber(playerStats.projectileChains),
      'Lets a projectile Basic Attack relaunch to a new target after a hit. Each point adds one additional chain.',
      `Projectile-tagged Basic Attack variants only. ${projectileVariantNote}`,
    ),
  ]
  const flatDamageStats = DAMAGE_TYPES.flatMap((damageType) =>
    playerStats.flatDamage[damageType] === 0
      ? []
      : [createCharacterStatSnapshot(
          `flat-damage-${damageType}`,
          DAMAGE_TYPE_LABELS[damageType],
          formatSignedFlatValue(playerStats.flatDamage[damageType]),
          `Adds flat ${damageType} damage to every player hit before increased damage and critical strikes.`,
          'All player damage sources.',
        )]
  )
  const increasedDamageStats = DAMAGE_INCREASE_TYPES.flatMap((increaseType) => {
    const value = playerStats.increasedDamage[increaseType]
    if (value === 0) {
      return []
    }
    const appliesTo = increaseType === 'global'
      ? 'All player damage sources.'
      : increaseType === 'physical'
        ? 'Physical damage from any skill or Basic Attack hit.'
        : increaseType === 'elemental'
          ? 'Fire, cold, and lightning damage from any skill or Basic Attack hit.'
          : increaseType === 'chaos'
            ? 'Chaos damage from any skill or Basic Attack hit.'
            : `Projectile-tagged hits only. ${projectileVariantNote}`
    return [createCharacterStatSnapshot(
      `increased-damage-${increaseType}`,
      DAMAGE_INCREASE_LABELS[increaseType],
      formatSignedPercent(value),
      `Multiplies matching damage after flat damage is added. ${increaseType === 'global' ? 'Global damage affects every outgoing damage type.' : ''}`.trim(),
      appliesTo,
    )]
  })
  const resistanceStats = DAMAGE_TYPES.map((damageType) => {
    const value = getResistanceForDamageType(playerStats.resistances, damageType)
    const description = damageType === 'lightning' ||
      damageType === 'fire' ||
      damageType === 'cold'
      ? `Reduces ${damageType} damage taken. Elemental resistance contributes to this value; the total is capped at 75%.`
      : `Reduces ${damageType} damage taken, capped at 75%.`
    return createCharacterStatSnapshot(
      `resistance-${damageType}`,
      RESISTANCE_LABELS[damageType],
      formatUnsignedPercent(value),
      description,
      'Incoming damage taken by the player.',
    )
  })
  const defenceStats = [
    createCharacterStatSnapshot(
      'increased-healing',
      'Increased healing',
      formatSignedPercent(playerStats.increasedHealing),
      'Increases the amount restored by every healing source.',
      'Vitality, healing potions, melee leech, and Whirlwind leech.',
    ),
    createCharacterStatSnapshot(
      'movement-speed',
      'Movement speed',
      formatStatNumber(playerStats.movementSpeed),
      'Controls player movement for pathing, kiting, pickup collection, and autonomous dodge repositioning.',
      'Player movement, not outgoing damage.',
    ),
    ...resistanceStats,
  ]
  const groups = [
    createCharacterStatGroupSnapshot(
      'offence',
      'Offence',
      [...offenceStats, ...flatDamageStats, ...increasedDamageStats],
    ),
    createCharacterStatGroupSnapshot('defence', 'Defence', defenceStats),
  ]
  return Object.freeze({
    groups: Object.freeze(groups),
  })
}

/** Immutable data retained by the results screen after a run ends. */
export interface PlayerCombatLogSnapshot {
  readonly time: number
  readonly kind: 'damage' | 'healing'
  readonly amount: number
  readonly source: string
  readonly resultingHp: number
  readonly damageType?: DamageType
}

export interface RunResultSnapshot {
  readonly phase: RunPhase
  readonly elapsedTime: number
  readonly level: number
  readonly xp: number
  readonly killCount: number
  readonly worldModifierIds: readonly string[]
  /** Damage and healing applied to the player during the final ten seconds. */
  readonly playerCombatLog: readonly PlayerCombatLogSnapshot[]
  /** Present only when the completed run ended in a final-boss victory. */
  readonly outcome?: 'victory'
}

export function createUiSnapshot(
  state: GameState,
  pendingChoiceFlows: readonly PendingChoiceFlow[] = [],
): GameUiSnapshot {
  const playerStats = getDerivedPlayerStats(state.player)
  const equippedWeaponArchetype = getEquippedWeaponArchetype(state.player)
  const basicAttackVariant = getBasicAttackVariant(equippedWeaponArchetype)
  const currentThreshold = xpRequiredForLevel(state.player.level)
  const xpRequired = xpRequiredForNextLevel(state.player.level)
  const thresholdSpan = Math.max(1, xpRequired - currentThreshold)
  const xpProgress = Math.min(
    1,
    Math.max(
      0,
      (state.player.xp - currentThreshold) / thresholdSpan,
    ),
  )

  const eligibilityState = {
    playerLevel: state.player.level,
    selectedUpgradeIds: state.run.selectedUpgradeIds,
    ownedSkillIds: state.player.skills
      .map((skill) => skill.skillId)
      .filter(isSkillId),
    skillLevels: Object.fromEntries(
      state.player.skills.map((skill) => [skill.skillId, skill.level]),
    ),
    skillSlotCount: typeof state.player.skillSlotCount === 'number' &&
      Number.isFinite(state.player.skillSlotCount)
      ? Math.max(1, Math.floor(state.player.skillSlotCount))
      : DEFAULT_SKILL_SLOT_COUNT,
  }
  const skills = state.player.skills.flatMap((skill) => {
    if (!isSkillId(skill.skillId)) {
      return []
    }
    const definition = getSkillDefinition(skill.skillId)
    const isBasicAttack = skill.skillId === BASIC_ATTACK_SKILL_ID
    const skillTags = isBasicAttack ? basicAttackVariant.tags : definition.tags
    const supportsAreaOfEffect = isBasicAttack
      ? basicAttackVariant.kind === 'area'
      : definition.kind === 'area' && definition.radius !== undefined
    const cooldown = isBasicAttack
      ? playerStats.attackSpeed > 0
        ? 1 / playerStats.attackSpeed
        : Number.POSITIVE_INFINITY
      : Math.max(
          0,
          getEffectiveSkillCooldown(
            definition.cooldown,
            playerStats.cooldownReduction +
              getSkillCooldownReductionPercent(
                skill.skillId,
                state.run.selectedUpgradeIds,
              ),
          ),
        )
    const cooldownProgress = Number.isFinite(cooldown) && cooldown > 0
      ? Math.min(1, Math.max(0, skill.cooldownRemaining / cooldown))
      : 0
    const baseDamage = isBasicAttack
      ? addDamageValues(
          getSkillDamage(definition, skill.level),
          { physical: playerStats.attackDamage },
        )
      : getSkillDamage(definition, skill.level)
    const outgoingDamage = createPlayerDamageProfileFromStats(
      playerStats,
      baseDamage,
      {
        isProjectile: skillTags.includes('projectile'),
        additionalIncreasedDamage: {
          global: getSkillDamageIncreasePercent(skill.skillId, skill.level),
        },
      },
    )
    const damage = sumDamageValues(outgoingDamage.damage) *
      getAverageCriticalStrikeFactor(outgoingDamage.criticalStrike)
    const damageTypes = (Object.keys(outgoingDamage.damage) as DamageType[]).filter(
      (damageType) => outgoingDamage.damage[damageType] > 0,
    )
    const estimatedSingleTargetDps =
      damageTypes.length > 0 && Number.isFinite(cooldown) && cooldown > 0
        ? damage / cooldown
        : null
    const skillModifiers = getSkillModifierSummaries(
      playerStats,
      skill.skillId,
      skill.level,
      skillTags,
      supportsAreaOfEffect,
      state.player.skeletonMaxCountBonus,
      state.run.selectedUpgradeIds,
    )
    const gearModifiers = summarizeGearModifiers(EQUIPMENT_SLOTS.flatMap((slot) => {
      const equipped = state.player.equipment?.[slot]
      if (!equipped) {
        return []
      }
      const definition = getItemDefinition(equipped.itemId)
      return (equipped.modifiers ?? definition.modifiers)
        .filter((modifier) => doesGearModifierAffectSkill(
          modifier,
          skill.skillId,
          {
            tags: skillTags,
            supportsAreaOfEffect,
          },
        ))
        .filter((modifier) => !SKILL_SUMMARIZED_GEAR_MODIFIER_IDS.has(modifier.id))
        .map((modifier) => Object.freeze({ ...modifier }))
    }))
    const upgrades = INITIAL_UPGRADES
      .filter(
        (upgrade) =>
          upgrade.skillId === skill.skillId && upgrade.skillAction !== 'unlock',
      )
      .map((upgrade) => {
        const repeatable = upgrade.skillCooldownReductionPercent !== undefined ||
          upgrade.summonMaxCountIncrease !== undefined
        const acquired = !repeatable &&
          state.run.selectedUpgradeIds.includes(upgrade.id)
        const available = !acquired && upgrade.isEligible(eligibilityState)
        return Object.freeze({
          upgradeId: upgrade.id,
          name: upgrade.name,
          description: upgrade.description,
          valueLabel: getAcquiredSkillUpgradeValueLabel(
            upgrade,
            skill.level,
            state.run.selectedUpgradeIds,
          ),
          relevant: true as const,
          status: acquired
            ? ('acquired' as const)
            : available
              ? ('available' as const)
              : ('unavailable' as const),
        })
      })

    return [Object.freeze({
      skillId: skill.skillId,
      name: definition.name,
      icon: isBasicAttack ? basicAttackVariant.visual.icon : definition.visual.icon,
      level: skill.level,
      castCount: Number.isFinite(skill.castCount)
        ? Math.max(0, Math.floor(skill.castCount ?? 0))
        : 0,
      description: isBasicAttack ? basicAttackVariant.description : definition.description,
      tags: Object.freeze([...skillTags]),
      damage: outgoingDamage.damage,
      damageTypes: Object.freeze(damageTypes),
      cooldownSeconds: isBasicAttack ? null : cooldown,
      cooldownProgress,
      attacksPerSecond: isBasicAttack ? 1 / cooldown : null,
      estimatedSingleTargetDps,
      dpsAssumption: isBasicAttack
        ? basicAttackVariant.kind === 'area'
          ? basicAttackVariant.areaShape === 'circle'
            ? 'One target in the staff area, sustained over Basic Attack cadence.'
            : 'One target in the current front-facing Basic Attack arc, sustained over attack cadence.'
          : 'One target sustained at the current Basic Attack cadence.'
        : skill.skillId === VITALITY_SKILL_ID
          ? 'Restores health automatically every cooldown.'
          : skill.skillId === RAISE_SKELETON_SKILL_ID
            ? 'One persistent skeleton attacks the nearest target in range once per second.'
          : skill.skillId === FIERY_TOUCH_SKILL_ID
            ? 'Triggers on direct player or summon hits, subject to its cooldown.'
          : skill.skillId === 'whirlwind'
          ? 'One target in Whirlwind range, sustained over its cooldown.'
          : 'Primary target sustained over Chain Lightning cooldown.',
      healingPerCast: skill.skillId === VITALITY_SKILL_ID
        ? getSkillHealing(definition, skill.level) *
          (1 + playerStats.increasedHealing / 100)
        : null,
      skillModifiers,
      gearModifiers: Object.freeze(gearModifiers),
      upgrades: Object.freeze(upgrades),
    })]
  })

  const equipment = Object.fromEntries(
    EQUIPMENT_SLOTS.flatMap((slot) => {
      const equipped = state.player.equipment?.[slot]
      if (!equipped) {
        return []
      }
      const definition = getItemDefinition(equipped.itemId)
      const setId = equipped.setId ?? definition.setId ?? getLegacyItemSetId(equipped.itemId)
      const modifiers = Object.freeze(
        (equipped.modifiers ?? definition.modifiers).map((modifier) =>
          Object.freeze({ ...modifier }),
        ),
      )
      return [[slot, Object.freeze({
        itemId: equipped.itemId,
        name: getItemDisplayName(definition, setId),
        slot: definition.slot,
        rarity: equipped.rarity ?? definition.rarity,
        ...(setId
          ? {
              setId,
            }
          : {}),
        modifiers,
      })]]
    }),
  )
  const gearSetPieceCounts = getEquippedGearSetPieceCounts(state.player)
  const gearSets = Object.freeze(
    ALL_GEAR_SET_DEFINITIONS.map((set) => Object.freeze({
      setId: set.id,
      name: set.name,
      equippedPieces: gearSetPieceCounts[set.id],
      pieceCount: set.slots.length,
      bonuses: Object.freeze(
        set.bonuses.map((bonus) => Object.freeze({
          requiredPieces: bonus.requiredPieces,
          label: bonus.label,
          active: getActiveGearSetBonuses(
            set,
            gearSetPieceCounts[set.id],
          ).includes(bonus),
        })),
      ),
    })),
  )

  const encounterStatus = state.encounter?.status ?? 'inactive'
  const bossState = state.encounter?.bossEntityId
    ? state.bosses?.find((boss) => boss.id === state.encounter?.bossEntityId)
    : (state.bosses ?? [])
      .filter((boss) => boss.hp > 0)
      .sort((left, right) => left.id - right.id)[0]
  const bossDefinitionId = bossState?.bossDefinitionId ?? state.encounter?.bossDefinitionId
  const boss = bossDefinitionId && encounterStatus !== 'complete'
    ? createBossHudSnapshot(
      bossState,
      bossDefinitionId,
      encounterStatus,
      state,
    )
    : null
  const dungeon = getDungeonDefinition(state.run.dungeonId)
  const floor = state.run.floor ?? 1
  const floorElapsedTime = Math.min(
    dungeon.floorDurationSeconds,
    Math.max(
      0,
      state.time - (state.run.floorStartedAt ?? 0),
    ),
  )
  const floorProgress = Math.min(
    1,
    Math.max(
      0,
      (state.time - (state.run.floorStartedAt ?? (floor - 1) * dungeon.floorDurationSeconds)) /
        dungeon.floorDurationSeconds,
    ),
  )
  const completedEncounterIds = new Set(state.run.completedEncounterIds ?? [])
  const encounterTimeline = state.run.dungeonMaxFloor === undefined ||
    state.run.dungeonMaxFloor === dungeon.defaultMaxFloor
    ? dungeon.encounterTimeline
    : createDungeonEncounterTimeline(
      state.run.dungeonMaxFloor,
    )
  const timeline = encounterTimeline.map((event) =>
    createEncounterTimelineSnapshot(
      event,
      state.encounter?.encounterId,
      completedEncounterIds,
    ),
  )
  const stairs = state.stairs
    ? Object.freeze({
      id: state.stairs.id,
      x: state.stairs.x,
      y: state.stairs.y,
      radius: state.stairs.radius,
      floorNumber: state.stairs.floorNumber,
      isFinal: state.stairs.isFinal,
      rewardsCollected: state.stairs.rewardsCollected,
      playerTouching: isPlayerTouchingStairs(state, state.stairs),
    })
    : null
  const floorTransition = state.floorTransition
    ? Object.freeze({
      remainingSeconds: Math.max(0, state.floorTransition.remainingSeconds),
      fromFloor: state.floorTransition.fromFloor,
      toFloor: state.floorTransition.toFloor,
      isFinal: state.floorTransition.isFinal,
      progress: Math.min(
        1,
        Math.max(
          0,
          1 - state.floorTransition.remainingSeconds / FLOOR_TRANSITION_SECONDS,
        ),
      ),
    })
    : null
  const pickups = Object.freeze(
    state.pickups
      .slice()
      .sort((left, right) => left.id - right.id)
      .map((pickup) =>
        Object.freeze({
          id: pickup.id,
          kind: pickup.kind,
          x: pickup.x,
          y: pickup.y,
          radius: pickup.radius,
          ...(pickup.kind === 'xp' ? { amount: pickup.xpAmount } : {}),
        }),
      ),
  )
  const pendingChoiceFlow = pendingChoiceFlows[0]
    ? freezeChoiceFlow(pendingChoiceFlows[0])
    : null

  const telegraphs = (state.telegraphs ?? [])
    .slice()
    .sort((left, right) => left.id - right.id)
    .map((telegraph) => Object.freeze({
      id: telegraph.id,
      sourceId: telegraph.sourceId,
      skillId: telegraph.skillId,
      kind: telegraph.kind,
      x: telegraph.x,
      y: telegraph.y,
      radius: telegraph.radius,
      remainingDuration: telegraph.remainingDuration,
      duration: telegraph.duration,
      progress: telegraph.duration > 0
        ? Math.min(1, Math.max(0, 1 - telegraph.remainingDuration / telegraph.duration))
        : 1,
      points: Object.freeze(
        telegraph.points.map((point) => Object.freeze({ x: point.x, y: point.y })),
      ),
    }))
  const dodgeTelegraphs = telegraphs.filter(
    (telegraph) => telegraph.remainingDuration > 0,
  )
  const dodge = Object.freeze({
    mode: state.player.dodge?.mode ?? 'autonomous' as const,
    level: state.player.dodge?.level ?? 1,
    reactionTime: state.player.dodge?.reactionTime ?? 0.1,
    active: dodgeTelegraphs.length > 0,
    progress: dodgeTelegraphs.length > 0
      ? Math.max(...dodgeTelegraphs.map((telegraph) => telegraph.progress))
      : 0,
    activeTelegraphCount: dodgeTelegraphs.length,
    directionX: state.player.dodge?.lastDirectionX ?? 0,
    directionY: state.player.dodge?.lastDirectionY ?? 0,
  })
  const profileId = state.player.behaviorController?.profileId ??
    DEFAULT_BEHAVIOR_PROFILE_ID
  const profile = getBehaviorProfileDefinition(profileId)
  const activeIntent = state.player.behaviorController?.lastCandidate
  const intentLabels: Record<PlayerMovementCandidate['source'], string> = {
    stairs: 'Take stairs',
    dodge: 'Dodge',
    gear: 'Collect gear',
    xp: 'Collect XP',
    kite: 'Kite away',
    'combat-range': 'Close to target',
    hold: 'Hold position',
  }
  const behavior = Object.freeze({
    profileId,
    profileName: profile.name,
    profileDescription: profile.description,
    activeIntent: activeIntent
      ? Object.freeze({
        source: activeIntent.source,
        label: intentLabels[activeIntent.source],
        directionX: activeIntent.directionX,
        directionY: activeIntent.directionY,
        speed: activeIntent.speed,
        priority: activeIntent.priority,
        ...(activeIntent.targetId === undefined
          ? {}
          : { targetId: activeIntent.targetId }),
        ...(activeIntent.pickupId === undefined
          ? {}
          : { pickupId: activeIntent.pickupId }),
        ...(state.player.behaviorController?.commitmentRemaining === undefined
          ? {}
          : {
            commitmentRemaining:
              state.player.behaviorController.commitmentRemaining,
          }),
      })
      : null,
  })

  return Object.freeze({
    phase: state.run.phase,
    hp: state.player.hp,
    maxHp: playerStats.maxHp,
    level: state.player.level,
    xp: state.player.xp,
    xpRequired,
    xpProgress,
    elapsedTime: state.time,
    killCount: state.run.killCount,
    ...(state.run.worldModifierIds?.length
      ? {
          worldModifierIds: state.run.worldModifierIds,
          worldModifierRewardMultiplier: resolveWorldModifierEffects(
            state.run.worldModifierIds,
            SPAWN_BALANCE,
          ).essenceRewardMultiplier,
        }
      : {}),
    floor,
    floorProgress,
    floorElapsedTime,
    floorDurationSeconds: dungeon.floorDurationSeconds,
    skillSlotCount: eligibilityState.skillSlotCount,
    skills: Object.freeze(skills),
    equipment: Object.freeze(equipment),
    gearSets,
    encounterStatus,
    boss,
    telegraphs: Object.freeze(telegraphs),
    dodge,
    behavior,
    timeline: Object.freeze(timeline),
    stairs,
    floorTransition,
    pickups,
    pendingChoiceFlow,
    pendingChoiceCount: pendingChoiceFlows.length,
    characterStats: createCharacterStatsSnapshot(
      playerStats,
      equippedWeaponArchetype,
    ),
  })
}

function createBossHudSnapshot(
  boss: BossState | undefined,
  bossDefinitionId: BossDefinitionId,
  status: EncounterStatus,
  state: Readonly<GameState>,
): BossHudSnapshot {
  const definition = getBossDefinition(bossDefinitionId)
  const maxHp = boss?.maxHp ?? definition.maxHp
  const hp = Math.max(0, Math.min(maxHp, boss?.hp ?? (status === 'complete' ? 0 : maxHp)))
  const isFinal = state.encounter?.isFinal === true ||
    bossDefinitionId === 'inferno-warden'
  const enrage = bossDefinitionId === 'inferno-warden'
    ? Object.freeze({
      elapsedSeconds: Math.max(
        0,
        state.time - (boss?.spawnTime ?? state.encounter?.startedAt ?? state.time),
      ),
      ...getInfernoWardenEnrageMultipliers(
        Math.max(
          0,
          state.time - (boss?.spawnTime ?? state.encounter?.startedAt ?? state.time),
        ),
        definition.enrage,
      ),
    })
    : null
  return Object.freeze({
    id: boss?.id,
    bossDefinitionId,
    name: definition.name,
    status,
    hp,
    maxHp,
    hpProgress: maxHp > 0 ? hp / maxHp : 0,
    isFinal,
    enrage,
  })
}

export function createRunResultSnapshot(
  state: GameState,
): RunResultSnapshot {
  const result = {
    phase: state.run.phase,
    elapsedTime: state.time,
    level: state.player.level,
    xp: state.player.xp,
    killCount: state.run.killCount,
    worldModifierIds: state.run.worldModifierIds ?? [],
    playerCombatLog: Object.freeze(
      (state.run.playerCombatLog ?? []).map((entry) => Object.freeze({ ...entry })),
    ),
    ...(state.run.phase === 'results' &&
    state.player.hp > 0
      ? { outcome: 'victory' as const }
      : {}),
  }
  return Object.freeze(result)
}

function createEncounterTimelineSnapshot(
  event: EncounterDefinition,
  activeEncounterId: string | undefined,
  completedEncounterIds: ReadonlySet<string>,
): EncounterTimelineHudSnapshot {
  const status: EncounterTimelineStatus = completedEncounterIds.has(event.id)
    ? 'completed'
    : activeEncounterId === event.id
      ? 'active'
      : 'upcoming'
  return Object.freeze({
    id: event.id,
    floorNumber: event.floorNumber,
    name: getBossDefinition(event.bossDefinitionId).name,
    status,
    isFinal: event.isFinal === true,
  })
}

function freezeChoiceFlow(
  flow: Readonly<PendingChoiceFlow>,
): Readonly<PendingChoiceFlow> {
  const cloned = cloneChoiceFlow(flow)
  const choices = cloned.type === 'gear-pickup'
    ? cloned.choices.map((choice) =>
      Object.freeze(
        choice.type === 'upgrade-equipped-item'
          ? {
            ...choice,
            upgradedModifiers: Object.freeze(
              choice.upgradedModifiers.map((modifier) => Object.freeze({ ...modifier })),
            ),
          }
          : { ...choice },
      ),
    )
    : cloned.choices.map((choice) => Object.freeze({ ...choice }))
  return Object.freeze({
    ...cloned,
    choices: Object.freeze(choices),
  }) as Readonly<PendingChoiceFlow>
}
