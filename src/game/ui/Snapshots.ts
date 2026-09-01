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
  type ItemImplicitModifier,
  type WeaponArchetype,
} from '../../content/gear/Items'
import type { Rarity } from '../../content/rarity/Rarity'
import {
  doesGearModifierAffectSkill,
  getGearModifierDefinition,
  sortGearModifiers,
  type GearModifier,
} from '../../content/gear/ModifierPools'
import {
  BASIC_ATTACK_SKILL_ID,
  getBasicAttackVariant,
  getSkillDefinition,
  getSkillDamage,
  getSkillHealing,
  getSkillShieldAmount,
  getEffectiveSkillCooldown,
  isSkillId,
  FIERY_TOUCH_SKILL_ID,
  RAISE_SKELETON_SKILL_ID,
  VITALITY_SKILL_ID,
  WHIRLWIND_SKILL_ID,
  CHAIN_LIGHTNING_SKILL_ID,
  GLACIAL_ORB_SKILL_ID,
  LANCERS_CHARGE_SKILL_ID,
  RALLYING_BANNER_SKILL_ID,
  GRAVITY_WELL_SKILL_ID,
  AEGIS_PULSE_SKILL_ID,
  RIFT_JAVELIN_SKILL_ID,
  CINDER_MINE_SKILL_ID,
  STORM_RELAY_SKILL_ID,
  SOUL_TETHER_SKILL_ID,
  PHANTOM_ARSENAL_SKILL_ID,
  SIGIL_OF_RUIN_SKILL_ID,
  MIRRORCAST_SKILL_ID,
  CRITICAL_SPELLSTRIKE_SKILL_ID,
  RAZORWIRE_SKILL_ID,
  BLOOD_RITE_SKILL_ID,
  PRISM_HALO_SKILL_ID,
  type SkillId,
  type SkillResonanceEffect,
  type SkillTag,
} from '../../content/skills/Skills'
import {
  DEFAULT_SKILL_SLOT_COUNT,
  CINDER_MINE_BURNING_DURATION_SECONDS,
  CINDER_MINE_BURNING_FIRE_DAMAGE_RATIO,
  CINDER_MINE_CLUSTER_DAMAGE_MULTIPLIER,
  CINDER_MINE_INFERNO_BURNING_RATIO_BONUS,
  RAISE_SKELETON_ROTTING_BONES_POISON_DURATION_SECONDS,
  RAISE_SKELETON_ROTTING_BONES_POISON_PHYSICAL_CHAOS_RATIO,
  RIFT_JAVELIN_BARBED_DURATION_SECONDS,
  RIFT_JAVELIN_BARBED_PHYSICAL_CHAOS_RATIO,
  PRISM_HALO_BURNING_DURATION_SECONDS,
  PRISM_HALO_BURNING_FIRE_DAMAGE_RATIO,
  PRISM_HALO_DURATION_SECONDS,
  PRISM_HALO_FIRE_INTERVAL_SECONDS,
  RALLYING_BANNER_BASE_DAMAGE_REDUCTION_PERCENT,
  RALLYING_BANNER_BASE_DURATION_SECONDS,
  RALLYING_BANNER_BULWARK_DAMAGE_REDUCTION_BONUS_PERCENT,
  RALLYING_BANNER_BULWARK_DURATION_BONUS_SECONDS,
  RALLYING_BANNER_COMMANDER_COOLDOWN_REDUCTION_PERCENT,
  AEGIS_PULSE_BASE_DURATION_SECONDS,
  AEGIS_PULSE_BULWARK_SHIELD_AMOUNT_BONUS,
  AEGIS_PULSE_BULWARK_DURATION_BONUS_SECONDS,
  SOUL_TETHER_DURATION_SECONDS,
  getCriticalSpellstrikeBaseCooldown,
} from '../../game-config/skills'
import { getSkillDamageIncreasePercent } from '../../content/upgrades/Upgrades'
import {
  INITIAL_UPGRADES,
  getSkillCooldownReductionPercent,
  type UpgradeId,
  type UpgradeBranch,
} from '../../content/upgrades/Upgrades'
import type {
  BossState,
  EncounterStatus,
  GameState,
  PlayerMovementCandidate,
  TelegraphState,
} from '../state/GameState'
import type { RunPhase } from '../state/RunPhase'
import type { KeywordId } from '../../content/glossary/Keywords'
import { calculateWorldModifierRewardMultiplier } from '../../content/modifiers/WorldModifiers'
import {
  getBossDefinition,
  type BossDefinitionId,
} from '../../content/bosses/Bosses'
import type { EntityId } from '../ids'
import {
  getDerivedPlayerStats,
  getEquippedGearSetPieceCounts,
} from '../stats/DerivedStats'
import { isSkillResonant } from '../combat/Resonance'
import {
  ALL_GEAR_SET_DEFINITIONS,
  getActiveGearSetBonuses,
  normalizeGearSetId,
  type GearSetId,
} from '../../game-config/gear-sets'
import {
  createPlayerDamageProfileFromStats,
  getAttunementDamageFromStats,
  getAttunementSourceAdditionalIncreasedDamage,
} from '../combat/DamageSources'
import { getSkeletonStats, getPhantomArsenalStats } from '../systems/summons/SummonSystem'
import {
  ATTUNEMENT_DESCRIPTION,
  RESONANCE_DESCRIPTION,
} from '../../content/stats/Stats'
import {
  addDamageValues,
  applyDotMultiplier,
  DAMAGE_INCREASE_TYPES,
  DAMAGE_TYPES,
  ELEMENTAL_DAMAGE_TYPES,
  createDamageValues,
  getAverageCriticalStrikeFactor,
  getResistanceForDamageType,
  RESISTANCE_CAP,
  PRIMARY_RESISTANCE_TYPES,
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
import { calculateEssenceReward } from '../../meta/EssenceRewards'

/** Narrow, immutable run data intended for screen-space UI consumers. */
export interface RunHudSnapshot {
  readonly phase: RunPhase
  readonly hp: number
  readonly maxHp: number
  readonly level: number
  readonly xp: number
  readonly xpRequired: number
  readonly xpProgress: number
  /** Essence earned if the run ended now without a victory bonus. */
  readonly estimatedEssence: number
  readonly elapsedTime: number
  readonly killCount: number
  readonly rerollsRemaining: number
  readonly gearXpBlessingActive: boolean
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
  readonly branch?: UpgradeBranch
  readonly evolutionTags?: readonly KeywordId[]
  readonly synergySkillIds?: readonly SkillId[]
}

export interface SkillHudSnapshot {
  readonly skillId: SkillId
  readonly name: string
  readonly icon: string
  readonly level: number
  readonly castCount: number
  /** Cumulative post-mitigation damage dealt by this skill during the run. */
  readonly totalDamageDealt: number
  /** Cumulative effective player healing provided by this skill during the run. */
  readonly totalHealingDone: number
  readonly description: string
  readonly resonanceEffect: SkillResonanceEffect | null
  /** True when this skill has enough Basic Attack charges for resonance. */
  readonly resonanceReady: boolean
  readonly tags: readonly SkillTag[]
  /** Effective native skill and Attunement damage before critical strikes and resistance. */
  readonly damage: DamageValues
  readonly damageTypes: readonly DamageType[]
  /** Typed Attunement contribution after the Basic Attack profile is finalized. */
  readonly attunementDamage: DamageValues
  readonly attunementDamageTypes: readonly DamageType[]
  /** Cooldown for non-Basic-Attack skills after cooldown reduction. */
  readonly cooldownSeconds: number | null
  /** Fraction of the current cooldown that remains, from zero to one. */
  readonly cooldownProgress: number
  /** Basic Attack cadence after attack-speed modifiers. */
  readonly attacksPerSecond: number | null
  readonly estimatedSingleTargetDps: number | null
  readonly dpsAssumption: string
  readonly healingPerCast: number | null
  readonly shieldPerCast: number | null
  readonly shieldDurationSeconds: number | null
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
  readonly uncappedValue?: string
  readonly sources?: readonly CharacterStatSourceSnapshot[]
  readonly damageBonuses?: readonly CharacterStatDamageBonusSnapshot[]
}

export interface CharacterStatSourceSnapshot {
  readonly label: string
  readonly value: string
}

export interface CharacterStatDamageBonusSnapshot {
  readonly damageType: DamageType
  readonly label: string
  readonly value: string
}

export interface CharacterStatGroupSnapshot {
  readonly id: CharacterStatGroupId
  readonly title: string
  readonly stats: readonly CharacterStatSnapshot[]
}

export interface CharacterStatsHudSnapshot {
  readonly groups: readonly CharacterStatGroupSnapshot[]
}

export interface ShieldHudSnapshot {
  readonly amount: number
  readonly maxAmount: number
  readonly remainingSeconds: number
  readonly durationSeconds: number
  readonly progress: number
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
  readonly savePending: boolean
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
  readonly sourceKind?: TelegraphState['sourceKind']
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
  readonly freeMode: boolean
  readonly activeIntent: BehaviorIntentHudSnapshot | null
}

interface PointSnapshot {
  readonly x: number
  readonly y: number
}

export interface GameUiSnapshot extends RunHudSnapshot {
  readonly skillSlotCount: number
  readonly mirrorcastTargetSkillId: SkillId | null
  readonly criticalSpellstrikeTargetSkillId: SkillId | null
  readonly bloodRiteTargetSkillId: SkillId | null
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
  readonly shield: ShieldHudSnapshot | null
}

export interface EquippedItemSnapshot {
  readonly itemId: string
  readonly name: string
  readonly slot: EquipmentSlot
  readonly rarity: Rarity
  readonly setId?: GearSetId
  readonly implicitModifiers: readonly ItemImplicitModifierSnapshot[]
  readonly modifiers: readonly GearModifierSnapshot[]
}

export interface ItemImplicitModifierSnapshot {
  readonly id: string
  readonly label: string
  readonly description: string
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
  | 'primary-target-damage'
  | 'cooldown-reduction'
  | 'area-of-effect'
  | 'melee-leech'
  | 'whirlwind-leech'
  | 'basic-attack-extra-projectiles'
  | 'healing-per-cast'
  | 'increased-healing'
  | 'dot-multiplier'
  | 'frost-on-hit'
  | 'summon-damage'
  | 'summon-max-hp'
  | 'summon-attack-speed'
  | 'summon-max-count'
  | 'skill-cooldown-reduction'
  | 'duration'
  | 'damage-reduction'

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
  state: Readonly<GameState>,
  playerStats: ReturnType<typeof getDerivedPlayerStats>,
  skillId: SkillId,
  skillLevel: number,
  skillTags: readonly SkillTag[],
  weaponArchetype: WeaponArchetype | undefined,
  supportsAreaOfEffect: boolean,
  skeletonMaxCountBonus = 0,
  selectedUpgradeIds: readonly UpgradeId[] = [],
  playerHp = 0,
  playerMaxHp = 0,
  vitalityMaxHpHealingPercent = 0,
  vitalityLowHpHealingMultiplier = 1,
  skeletonAttackCooldown: number | undefined = undefined,
  skeletonMaxHp: number | undefined = undefined,
): readonly SkillModifierSummarySnapshot[] {
  const definition = getSkillDefinition(skillId)
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
  if (definition.canProduceDirectHit && playerStats.frostStacksOnHit > 0) {
    addSummary(
      'frost-on-hit',
      'Chill on hit',
      playerStats.frostStacksOnHit,
      formatStatNumber(playerStats.frostStacksOnHit),
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
    const primaryTargetDamageIncreasePercent = weaponArchetype
      ? getBasicAttackVariant(weaponArchetype).primaryTargetDamageIncreasePercent ?? 0
      : 0
    if (primaryTargetDamageIncreasePercent > 0) {
      addSummary(
        'primary-target-damage',
        'Precision damage to primary target',
        primaryTargetDamageIncreasePercent,
        formatSignedPercent(primaryTargetDamageIncreasePercent),
      )
    }
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
    if (skillId === RALLYING_BANNER_SKILL_ID) {
      const duration = RALLYING_BANNER_BASE_DURATION_SECONDS +
        (selectedUpgradeIds.includes('rallying-banner-bulwark')
          ? RALLYING_BANNER_BULWARK_DURATION_BONUS_SECONDS
          : 0)
      addSummary(
        'duration',
        'Duration',
        duration,
        `${formatStatNumber(duration)} sec`,
      )
      const damageReduction = RALLYING_BANNER_BASE_DAMAGE_REDUCTION_PERCENT +
        (selectedUpgradeIds.includes('rallying-banner-bulwark')
          ? RALLYING_BANNER_BULWARK_DAMAGE_REDUCTION_BONUS_PERCENT
          : 0)
      addSummary(
        'damage-reduction',
        'Damage reduction',
        damageReduction,
        formatUnsignedPercent(damageReduction),
      )
      if (
        selectedUpgradeIds.includes('rallying-banner-commander')
      ) {
        addSummary(
          'skill-cooldown-reduction',
          'Skill and skeleton cooldown reduction while active',
          RALLYING_BANNER_COMMANDER_COOLDOWN_REDUCTION_PERCENT,
          formatUnsignedPercent(RALLYING_BANNER_COMMANDER_COOLDOWN_REDUCTION_PERCENT),
        )
      }
    }
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
      let healingPerCast = getSkillHealing(definition, skillLevel) +
        playerMaxHp * vitalityMaxHpHealingPercent / 100
      if (
        playerHp / Math.max(1, playerMaxHp) <= 0.4 &&
        vitalityLowHpHealingMultiplier > 1
      ) {
        healingPerCast *= vitalityLowHpHealingMultiplier
      }
      healingPerCast *= healingMultiplier
      addSummary(
        'healing-per-cast',
        'Healing per cast',
        healingPerCast,
        formatStatNumber(healingPerCast),
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
      const levelIncrease = getSkillDamageIncreasePercent(
        skillId,
        skillLevel,
        selectedUpgradeIds,
      )
      const skeletonDamage = createPlayerDamageProfileFromStats(
        playerStats,
        { physical: definition.summonBaseDamage ?? 0 },
        {
          additionalIncreasedDamage: { global: levelIncrease },
          attunementSourceAdditionalIncreasedDamage:
            getAttunementSourceAdditionalIncreasedDamage(state),
        },
      ).damage.physical
      addSummary(
        'summon-damage',
        'Skeleton damage',
        skeletonDamage,
        formatStatNumber(skeletonDamage),
      )
      const effectiveSkeletonMaxHp = skeletonMaxHp ??
        (definition.summonBaseMaxHp ?? 0) +
        (definition.summonMaxHpPerLevel ?? 0) * Math.max(0, skillLevel - 1)
      addSummary(
        'summon-max-hp',
        'Skeleton max HP',
        effectiveSkeletonMaxHp,
        formatStatNumber(effectiveSkeletonMaxHp),
      )
      addSummary(
        'summon-attack-speed',
        'Skeleton attack speed',
        1 / (skeletonAttackCooldown ?? definition.summonAttackCooldown ?? 1),
        `${formatStatNumber(
          1 / (skeletonAttackCooldown ?? definition.summonAttackCooldown ?? 1),
        )} atk/s`,
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
  'frost-application',
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

const RESISTANCE_DISPLAY_TYPES = [
  'physical',
  'elemental',
  'lightning',
  'fire',
  'cold',
  'chaos',
] as const satisfies readonly DamageResistanceType[]

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
  options: {
    uncappedValue?: string
    sources?: readonly CharacterStatSourceSnapshot[]
    damageBonuses?: readonly CharacterStatDamageBonusSnapshot[]
  } = {},
): CharacterStatSnapshot {
  return Object.freeze({
    id,
    label,
    value,
    description,
    appliesTo,
    ...(options.uncappedValue === undefined
      ? {}
      : { uncappedValue: options.uncappedValue }),
    ...(options.sources === undefined
      ? {}
      : { sources: Object.freeze([...options.sources]) }),
    ...(options.damageBonuses === undefined
      ? {}
      : { damageBonuses: Object.freeze([...options.damageBonuses]) }),
  })
}

function getAttunementDamageBonuses(
  attunementDamage: Readonly<DamageValues>,
): readonly CharacterStatDamageBonusSnapshot[] {
  return DAMAGE_TYPES
    .filter((damageType) => attunementDamage[damageType] > 0)
    .map((damageType) =>
      Object.freeze({
        damageType,
        label: titleCase(damageType),
        value: formatSignedFlatValue(attunementDamage[damageType]),
      }),
    )
}

function getResistanceContributingTypes(
  resistanceType: DamageResistanceType,
): readonly DamageResistanceType[] {
  if (resistanceType === 'elemental') {
    return ['elemental']
  }
  if (ELEMENTAL_DAMAGE_TYPES.some((damageType) => damageType === resistanceType)) {
    return ['elemental', resistanceType]
  }
  return [resistanceType]
}

function getUncappedResistance(
  resistances: Readonly<ReturnType<typeof getDerivedPlayerStats>['resistances']>,
  resistanceType: DamageResistanceType,
): number {
  return getResistanceContributingTypes(resistanceType)
    .reduce((total, contributingType) => total + resistances[contributingType], 0)
}

function getResistanceSources(
  player: Readonly<GameState['player']>,
  resistanceType: DamageResistanceType,
): readonly CharacterStatSourceSnapshot[] {
  const contributingTypes = getResistanceContributingTypes(resistanceType)
  const baseValue = contributingTypes.reduce(
    (total, contributingType) => total + (player.resistances?.[contributingType] ?? 0),
    0,
  )
  const sources: CharacterStatSourceSnapshot[] = [{
    label: 'Base',
    value: formatSignedPercent(baseValue),
  }]

  for (const slot of EQUIPMENT_SLOTS) {
    const equipped = player.equipment?.[slot]
    if (!equipped) {
      continue
    }
    const definition = getItemDefinition(equipped.itemId)
    const contribution = (equipped.modifiers ?? definition.modifiers)
      .filter((modifier) => {
        const modifierDefinition = getGearModifierDefinition(modifier.id)
        return modifierDefinition.kind === 'resistance' &&
          contributingTypes.includes(modifierDefinition.resistanceType)
      })
      .reduce((total, modifier) => total + modifier.value, 0)
    if (contribution === 0) {
      continue
    }
    const setId = normalizeGearSetId(equipped.setId) ??
      definition.setId ??
      getLegacyItemSetId(equipped.itemId)
    sources.push({
      label: getItemDisplayName(definition, setId),
      value: formatSignedPercent(contribution),
    })
  }

  const gearSetPieceCounts = getEquippedGearSetPieceCounts(player)
  for (const set of ALL_GEAR_SET_DEFINITIONS) {
    const contribution = getActiveGearSetBonuses(
      set,
      gearSetPieceCounts[set.id],
    )
      .filter((bonus) => bonus.kind === 'all-resistances')
      .reduce((total, bonus) => total + bonus.value, 0)
    if (
      contribution > 0 &&
      PRIMARY_RESISTANCE_TYPES.some((type) => contributingTypes.includes(type))
    ) {
      sources.push({
        label: `${set.name} Set`,
        value: formatSignedPercent(contribution),
      })
    }
  }

  return sources
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

function createShieldSnapshot(
  player: Readonly<GameState['player']>,
): ShieldHudSnapshot | null {
  const amount = Math.max(0, player.aegisPulseShieldAmount ?? 0)
  const maxAmount = Math.max(
    amount,
    player.aegisPulseShieldMaxAmount ?? 0,
  )
  const remainingSeconds = Math.max(0, player.aegisPulseShieldRemaining ?? 0)
  const durationSeconds = Math.max(
    remainingSeconds,
    player.aegisPulseShieldDuration ?? 0,
  )
  if (amount <= 0 || remainingSeconds <= 0 || maxAmount <= 0) {
    return null
  }
  return Object.freeze({
    amount,
    maxAmount,
    remainingSeconds,
    durationSeconds,
    progress: amount / maxAmount,
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
  player: Readonly<GameState['player']>,
  weaponArchetype: WeaponArchetype | undefined,
  attunementDamage: Readonly<DamageValues>,
): CharacterStatsHudSnapshot {
  const basicAttackVariant = getBasicAttackVariant(weaponArchetype)
  const attunementDamageBonuses = getAttunementDamageBonuses(attunementDamage)
  const projectileVariantNote = basicAttackVariant.kind === 'projectile'
    ? `Currently applies to your ${titleCase(basicAttackVariant.id)} Basic Attack variant.`
    : 'Sword Basic Attack is not projectile-tagged, so this is currently inactive unless you swap weapons.'
  const areaApplicability = basicAttackVariant.id === 'sword'
    ? 'Whirlwind, your sword Basic Attack reach and arc, and the range of chained Basic Attack projectiles. It does not currently change Chain Lightning.'
    : 'Whirlwind, sword Basic Attack reach and arc, and the range of chained Basic Attack projectiles. It does not currently change Chain Lightning.'
  const offenceStats = [
    createCharacterStatSnapshot(
      'resonance',
      'Resonance',
      formatStatNumber(playerStats.resonance),
      RESONANCE_DESCRIPTION,
      'All non-Basic-Attack skills.',
    ),
    createCharacterStatSnapshot(
      'attunement',
      'Attunement',
      formatUnsignedPercent(playerStats.attunement),
      ATTUNEMENT_DESCRIPTION,
      'All non-Basic-Attack skills and summons.',
      attunementDamageBonuses.length > 0
        ? { damageBonuses: attunementDamageBonuses }
        : undefined,
    ),
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
      'Determines how often player hits and Vitality healing critically strike.',
      'All player damage sources and Vitality healing.',
    ),
    createCharacterStatSnapshot(
      'crit-multiplier',
      'Crit multiplier',
      formatUnsignedPercent(playerStats.critMultiplier),
      'Determines how much damage a critical strike deals or how much healing it restores.',
      'All player critical strikes and Vitality healing.',
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
          `Adds flat ${damageType} damage to Basic Attack damage before increases and critical strikes. Attunement can convert part of it into skill damage.`,
          'Basic Attack and, through Attunement, skills and summons.',
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
  const resistanceStats = RESISTANCE_DISPLAY_TYPES.map((resistanceType) => {
    const uncappedValue = getUncappedResistance(playerStats.resistances, resistanceType)
    const value = resistanceType === 'elemental'
      ? Math.min(RESISTANCE_CAP, uncappedValue)
      : getResistanceForDamageType(playerStats.resistances, resistanceType)
    const description = resistanceType === 'elemental'
      ? 'Reduces fire, cold, and lightning damage taken. The total is capped at 75%.'
      : resistanceType === 'lightning' ||
        resistanceType === 'fire' ||
        resistanceType === 'cold'
        ? `Reduces ${resistanceType} damage taken. Elemental resistance contributes to this value; the total is capped at 75%.`
        : `Reduces ${resistanceType} damage taken, capped at 75%.`
    return createCharacterStatSnapshot(
      `resistance-${resistanceType}`,
      RESISTANCE_LABELS[resistanceType],
      formatUnsignedPercent(value),
      description,
      'Incoming damage taken by the player.',
      {
        uncappedValue: formatUnsignedPercent(uncappedValue),
        sources: getResistanceSources(player, resistanceType),
      },
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

function getEstimatedSingleTargetDamagePerCast(
  state: Readonly<GameState>,
  skillId: SkillId,
  outgoingDamage: Readonly<{
    damage: DamageValues
    criticalStrike: { chance: number; multiplier: number }
  }>,
  isBasicAttack: boolean,
  basicAttackVariant: ReturnType<typeof getBasicAttackVariant>,
  skeletonStats: ReturnType<typeof getSkeletonStats> | undefined,
): number {
  const criticalStrikeFactor = getAverageCriticalStrikeFactor(
    outgoingDamage.criticalStrike,
  )
  const dotMultiplier = getDerivedPlayerStats(state.player).dotMultiplier
  const directDamage = sumDamageValues(outgoingDamage.damage) *
    criticalStrikeFactor

  if (skillId === SOUL_TETHER_SKILL_ID) {
    return applyDotMultiplier(
      {
        chaos: outgoingDamage.damage.chaos * SOUL_TETHER_DURATION_SECONDS,
      },
      dotMultiplier,
    ).chaos
  }

  if (skillId === CINDER_MINE_SKILL_ID) {
    const cluster = state.run.selectedUpgradeIds.includes('cinder-mine-cluster')
    const inferno = state.run.selectedUpgradeIds.includes('cinder-mine-inferno')
    const mineDamage = createDamageValues(
      Object.fromEntries(
        DAMAGE_TYPES.map((damageType) => [
          damageType,
          outgoingDamage.damage[damageType] *
            (cluster ? CINDER_MINE_CLUSTER_DAMAGE_MULTIPLIER : 1),
        ]),
      ),
    )
    const burningPerSecond = mineDamage.fire *
      (CINDER_MINE_BURNING_FIRE_DAMAGE_RATIO +
        (inferno ? CINDER_MINE_INFERNO_BURNING_RATIO_BONUS : 0))
    const oneMineDamage = sumDamageValues(mineDamage) * criticalStrikeFactor +
      applyDotMultiplier(
        {
          fire: burningPerSecond *
            CINDER_MINE_BURNING_DURATION_SECONDS *
            criticalStrikeFactor,
        },
        dotMultiplier,
      ).fire
    return oneMineDamage * (cluster ? 2 : 1)
  }

  if (skillId === PRISM_HALO_SKILL_ID) {
    const shardVolleyCount = Math.ceil(
      PRISM_HALO_DURATION_SECONDS / PRISM_HALO_FIRE_INTERVAL_SECONDS,
    )
    const fireShardCount = Math.ceil(shardVolleyCount / 3)
    const burningDamage = applyDotMultiplier(
      {
        fire: outgoingDamage.damage.fire *
          PRISM_HALO_BURNING_FIRE_DAMAGE_RATIO *
          PRISM_HALO_BURNING_DURATION_SECONDS *
          criticalStrikeFactor *
          fireShardCount,
      },
      dotMultiplier,
    ).fire
    return directDamage * shardVolleyCount + burningDamage
  }

  const poisonApplication = isBasicAttack
    ? basicAttackVariant.poisonApplication
    : skillId === RAISE_SKELETON_SKILL_ID &&
        skeletonStats !== undefined &&
        state.run.selectedUpgradeIds.includes('raise-skeleton-rotting-bones')
      ? {
          durationSeconds: RAISE_SKELETON_ROTTING_BONES_POISON_DURATION_SECONDS,
          physicalChaosRatio: RAISE_SKELETON_ROTTING_BONES_POISON_PHYSICAL_CHAOS_RATIO,
        }
      : skillId === RIFT_JAVELIN_SKILL_ID &&
          state.run.selectedUpgradeIds.includes('rift-javelin-barbed')
        ? {
            durationSeconds: RIFT_JAVELIN_BARBED_DURATION_SECONDS,
            physicalChaosRatio: RIFT_JAVELIN_BARBED_PHYSICAL_CHAOS_RATIO,
          }
        : undefined
  if (!poisonApplication) {
    return directDamage
  }

  const applyingDamage = outgoingDamage.damage.physical +
    outgoingDamage.damage.chaos
  const poisonPerHit = applyDotMultiplier(
    {
      chaos: applyingDamage *
        poisonApplication.physicalChaosRatio *
        poisonApplication.durationSeconds *
        criticalStrikeFactor,
    },
    dotMultiplier,
  ).chaos
  const hitCount = skillId === RIFT_JAVELIN_SKILL_ID ? 2 : 1
  return directDamage * hitCount + poisonPerHit * hitCount
}

function getEffectiveSkillTags(
  state: Readonly<GameState>,
  skillId: SkillId,
  isBasicAttack: boolean,
  definitionTags: readonly SkillTag[],
  basicAttackTags: readonly SkillTag[],
): readonly SkillTag[] {
  const tags = [...(isBasicAttack ? basicAttackTags : definitionTags)]
  const producesDot = skillId === PRISM_HALO_SKILL_ID ||
    (skillId === RAISE_SKELETON_SKILL_ID &&
      state.run.selectedUpgradeIds.includes('raise-skeleton-rotting-bones')) ||
    (skillId === RIFT_JAVELIN_SKILL_ID &&
      state.run.selectedUpgradeIds.includes('rift-javelin-barbed')) ||
    (skillId === SIGIL_OF_RUIN_SKILL_ID &&
      state.run.selectedUpgradeIds.includes('synergy-sigil-of-ruin-prism-halo'))
  if (producesDot && !tags.includes('dot')) {
    tags.push('dot')
  }
  return tags
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
  /** Present when the player chose to leave the dungeon from the pause menu. */
  readonly forfeited?: true
  /** Damage and healing applied to the player during the final ten seconds. */
  readonly playerCombatLog: readonly PlayerCombatLogSnapshot[]
  /** Cumulative post-mitigation damage totals, including skills removed during the run. */
  readonly skillDamage: readonly SkillDamageSnapshot[]
  /** Cumulative effective player healing totals, including skills removed during the run. */
  readonly skillHealing: readonly SkillHealingSnapshot[]
  /** Present only when the completed run ended in a final-boss victory. */
  readonly outcome?: 'victory'
}

export interface SkillDamageSnapshot {
  readonly skillId: SkillId
  readonly name: string
  readonly damage: number
}

export interface SkillHealingSnapshot {
  readonly skillId: SkillId
  readonly name: string
  readonly healing: number
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
    const skillTags = getEffectiveSkillTags(
      state,
      skill.skillId,
      isBasicAttack,
      definition.tags,
      basicAttackVariant.tags,
    )
    const supportsAreaOfEffect = isBasicAttack
      ? basicAttackVariant.kind === 'area'
      : definition.kind === 'area' && definition.radius !== undefined
    const rallyingBannerCooldownReduction =
      (state.player.rallyingBannerRemaining ?? 0) > 0
        ? state.player.rallyingBannerCooldownReductionPercent ??
          (state.run.selectedUpgradeIds.includes('rallying-banner-commander')
            ? RALLYING_BANNER_COMMANDER_COOLDOWN_REDUCTION_PERCENT
            : 0)
        : 0
    const cooldown = isBasicAttack
      ? playerStats.attackSpeed > 0
        ? 1 / playerStats.attackSpeed
        : Number.POSITIVE_INFINITY
      : Math.max(
          0,
          getEffectiveSkillCooldown(
            skill.skillId === CRITICAL_SPELLSTRIKE_SKILL_ID
              ? getCriticalSpellstrikeBaseCooldown(state.run.selectedUpgradeIds)
              : definition.cooldown,
            playerStats.cooldownReduction +
              getSkillCooldownReductionPercent(
                skill.skillId,
                state.run.selectedUpgradeIds,
              ) +
              rallyingBannerCooldownReduction,
          ),
        )
    const cooldownProgress = Number.isFinite(cooldown) && cooldown > 0
      ? Math.min(1, Math.max(0, skill.cooldownRemaining / cooldown))
      : 0
    const skeletonStats = skill.skillId === RAISE_SKELETON_SKILL_ID
      ? getSkeletonStats(state)
      : skill.skillId === PHANTOM_ARSENAL_SKILL_ID
        ? getPhantomArsenalStats(state)
        : undefined
    const baseDamage = skeletonStats
      ? { physical: skeletonStats.damage }
      : isBasicAttack
        ? addDamageValues(
            getSkillDamage(definition, skill.level),
            { physical: playerStats.attackDamage },
          )
        : getSkillDamage(definition, skill.level)
    const dealsNoDirectDamage = skill.skillId === VITALITY_SKILL_ID ||
      skill.skillId === RALLYING_BANNER_SKILL_ID
    const outgoingDamage = dealsNoDirectDamage
      ? {
          damage: createDamageValues(),
          criticalStrike: {
            chance: playerStats.critChance,
            multiplier: playerStats.critMultiplier,
          },
        }
      : createPlayerDamageProfileFromStats(
          playerStats,
          baseDamage,
          {
            isBasicAttack,
            isProjectile: skillTags.includes('projectile'),
            additionalIncreasedDamage: {
              global: getSkillDamageIncreasePercent(
                skill.skillId,
                skill.level,
                state.run.selectedUpgradeIds,
              ),
            },
            attunementSourceAdditionalIncreasedDamage:
              getAttunementSourceAdditionalIncreasedDamage(state),
          },
        )
    const displayedDamage = skill.skillId === SOUL_TETHER_SKILL_ID
      ? createDamageValues({ chaos: outgoingDamage.damage.chaos })
      : outgoingDamage.damage
    const damageTypes = (Object.keys(displayedDamage) as DamageType[]).filter(
      (damageType) => displayedDamage[damageType] > 0,
    )
    const attunementDamage = skill.skillId === SOUL_TETHER_SKILL_ID
      ? createDamageValues({
          chaos: outgoingDamage.attunementDamage?.chaos ?? 0,
        })
      : outgoingDamage.attunementDamage ?? createDamageValues()
    const attunementDamageTypes = DAMAGE_TYPES.filter(
      (damageType) => attunementDamage[damageType] > 0,
    )
    const damagePerAttackCooldown = skeletonStats?.attackCooldown ?? cooldown
    const estimatedSingleTargetDamage = getEstimatedSingleTargetDamagePerCast(
      state,
      skill.skillId,
      {
        damage: outgoingDamage.damage,
        criticalStrike: outgoingDamage.criticalStrike,
      },
      isBasicAttack,
      basicAttackVariant,
      skeletonStats,
    )
    const estimatedSingleTargetDps =
      damageTypes.length > 0 &&
      Number.isFinite(damagePerAttackCooldown) &&
      damagePerAttackCooldown > 0
        ? estimatedSingleTargetDamage / damagePerAttackCooldown
        : null
    const skillModifiers = getSkillModifierSummaries(
      state,
      playerStats,
      skill.skillId,
      skill.level,
      skillTags,
      isBasicAttack
        ? getEquippedWeaponArchetype(state.player)
        : undefined,
      supportsAreaOfEffect,
      state.player.skeletonMaxCountBonus,
      state.run.selectedUpgradeIds,
      state.player.hp,
      state.player.maxHp,
      state.player.vitalityMaxHpHealingPercent ?? 0,
      state.player.vitalityLowHpHealingMultiplier ?? 1,
      skeletonStats?.attackCooldown,
      skeletonStats?.maxHp,
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
      .filter((upgrade) =>
        upgrade.skillAction !== 'unlock' &&
        (upgrade.skillId === skill.skillId ||
          upgrade.synergySkillIds?.includes(skill.skillId) === true),
      )
      .map((upgrade) => {
        const repeatable = upgrade.repeatable === true ||
          upgrade.skillCooldownReductionPercent !== undefined ||
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
          ...(upgrade.branch ? { branch: upgrade.branch } : {}),
          ...(upgrade.evolutionTags
            ? { evolutionTags: Object.freeze([...upgrade.evolutionTags]) }
            : {}),
          ...(upgrade.synergySkillIds
            ? { synergySkillIds: Object.freeze([...upgrade.synergySkillIds]) }
            : {}),
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
      totalDamageDealt: state.run.skillDamageDealt?.[skill.skillId] ?? 0,
      totalHealingDone: state.run.skillHealingDone?.[skill.skillId] ?? 0,
      description: isBasicAttack ? basicAttackVariant.description : definition.description,
      resonanceEffect: isBasicAttack ? null : definition.resonanceEffect ?? null,
      resonanceReady: !isBasicAttack && isSkillResonant(state, skill.skillId),
      tags: Object.freeze([...skillTags]),
      damage: displayedDamage,
      damageTypes: Object.freeze(damageTypes),
      attunementDamage,
      attunementDamageTypes: Object.freeze(attunementDamageTypes),
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
            ? state.run.selectedUpgradeIds.includes('raise-skeleton-rotting-bones')
              ? 'Physical skeleton attacks plus Chaos Poison damage over time, sustained once per second.'
              : 'One persistent skeleton attacks the nearest target in range once per second.'
          : skill.skillId === FIERY_TOUCH_SKILL_ID
            ? 'Triggers on direct player or summon hits, subject to its cooldown.'
          : skill.skillId === CRITICAL_SPELLSTRIKE_SKILL_ID
            ? 'Replays the focused Triggerable skill after a resolved Basic Attack critical; damage and healing depend on that skill and your critical-hit rate.'
          : skill.skillId === WHIRLWIND_SKILL_ID
          ? 'One target in Whirlwind range, sustained over its cooldown.'
          : skill.skillId === CHAIN_LIGHTNING_SKILL_ID
          ? 'Primary target sustained over Chain Lightning cooldown.'
          : skill.skillId === GLACIAL_ORB_SKILL_ID
          ? 'Nearest target in range, sustained over Glacial Orb cooldown.'
          : skill.skillId === LANCERS_CHARGE_SKILL_ID
          ? 'One target struck by the charge corridor, sustained over its cooldown.'
          : skill.skillId === RALLYING_BANNER_SKILL_ID
          ? 'Heals immediately, then heals the player and living summons in the banner every second while active.'
          : skill.skillId === GRAVITY_WELL_SKILL_ID
          ? 'One target caught in the well, sustained over Gravity Well cooldown.'
          : skill.skillId === AEGIS_PULSE_SKILL_ID
          ? 'One target caught in the pulse, sustained over Aegis Pulse cooldown.'
          : skill.skillId === RIFT_JAVELIN_SKILL_ID
          ? 'Every enemy pierced once outbound and once inbound, sustained over its cooldown.'
          : skill.skillId === CINDER_MINE_SKILL_ID
          ? 'Fire blast plus Fire Burning damage over its duration, sustained over its cooldown.'
          : skill.skillId === STORM_RELAY_SKILL_ID
          ? 'Primary target struck by the relay each strike interval while it is active.'
          : skill.skillId === SOUL_TETHER_SKILL_ID
          ? 'Chaos damage only; each cast sustains an independent tether, with DoT multiplier applied over its duration.'
          : skill.skillId === PHANTOM_ARSENAL_SKILL_ID
          ? 'One persistent phantom archer attacks the nearest target in range on its own cadence.'
          : skill.skillId === SIGIL_OF_RUIN_SKILL_ID
          ? 'Marks the nearest enemy; detonation damage scales with the capped damage dealt while marked.'
          : skill.skillId === MIRRORCAST_SKILL_ID
          ? 'Copies the next non-Basic skill cast after a short delay at reduced effectiveness.'
          : skill.skillId === RAZORWIRE_SKILL_ID
          ? 'One enemy crossing the wire per crossing cooldown, sustained while the wire persists.'
          : skill.skillId === BLOOD_RITE_SKILL_ID
          ? 'Chaos pulse on cast; the stored Blood Debt empowers your next skill.'
          : skill.skillId === PRISM_HALO_SKILL_ID
          ? 'Rotating Fire, Cold, and Lightning shards strike each interval; Fire shards add Fire Burning.'
          : 'One target sustained over the skill cooldown.',
      healingPerCast: skill.skillId === VITALITY_SKILL_ID
        ? (
            (
              getSkillHealing(definition, skill.level) +
              state.player.maxHp *
                (state.player.vitalityMaxHpHealingPercent ?? 0) / 100
            ) *
            (
              state.player.hp / Math.max(1, state.player.maxHp) <= 0.4
                ? state.player.vitalityLowHpHealingMultiplier ?? 1
                : 1
            ) +
            (state.run.selectedUpgradeIds.includes(
              'synergy-soul-tether-vitality',
            )
              ? state.player.soulTetherVitalityCharge ?? 0
              : 0)
          ) *
          (1 + playerStats.increasedHealing / 100)
        : skill.skillId === RALLYING_BANNER_SKILL_ID
          ? getSkillHealing(definition, skill.level) *
            (1 + playerStats.increasedHealing / 100)
          : null,
      shieldPerCast: skill.skillId === AEGIS_PULSE_SKILL_ID
        ? (
            getSkillShieldAmount(definition, skill.level) +
            (state.run.selectedUpgradeIds.includes('aegis-pulse-bulwark')
              ? AEGIS_PULSE_BULWARK_SHIELD_AMOUNT_BONUS
              : 0)
          )
        : null,
      shieldDurationSeconds: skill.skillId === AEGIS_PULSE_SKILL_ID
        ? AEGIS_PULSE_BASE_DURATION_SECONDS +
          (state.run.selectedUpgradeIds.includes('aegis-pulse-bulwark')
            ? AEGIS_PULSE_BULWARK_DURATION_BONUS_SECONDS
            : 0)
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
      const setId = normalizeGearSetId(equipped.setId) ??
        definition.setId ??
        getLegacyItemSetId(equipped.itemId)
      const modifiers = Object.freeze(
        (equipped.modifiers ?? definition.modifiers).map((modifier) =>
          Object.freeze({ ...modifier }),
        ),
      )
      const implicitModifiers = Object.freeze(
        (definition.implicitModifiers ?? []).map(
          (modifier: ItemImplicitModifier) => Object.freeze({ ...modifier }),
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
        implicitModifiers,
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
    state.run.floorDurationSeconds ?? dungeon.floorDurationSeconds,
    Math.max(
      0,
      state.time - (state.run.floorStartedAt ?? 0),
    ),
  )
  const floorDurationSeconds =
    state.run.floorDurationSeconds ?? dungeon.floorDurationSeconds
  const floorProgress = Math.min(
    1,
    Math.max(
      0,
      (state.time - (state.run.floorStartedAt ?? (floor - 1) * floorDurationSeconds)) /
        floorDurationSeconds,
    ),
  )
  const worldModifierRewardMultiplier = calculateWorldModifierRewardMultiplier(
    state.run.worldModifierIds,
  )
  const estimatedEssence = calculateEssenceReward(
    state.player.level,
    state.run.killCount,
    worldModifierRewardMultiplier,
  ).projectedReward
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
      savePending: state.floorTransition.savePending === true,
      progress: Math.min(
        1,
        Math.max(
          0,
          state.floorTransition.savePending === true
            ? 0
            : 1 - state.floorTransition.remainingSeconds / FLOOR_TRANSITION_SECONDS,
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
      ...(telegraph.sourceKind
        ? { sourceKind: telegraph.sourceKind }
        : {}),
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
    free: 'Free movement',
    dodge: 'Dodge',
    healing: 'Collect healing potion',
    gear: 'Collect gear',
    xp: 'Collect XP',
    zone: 'Hold banner zone',
    kite: 'Kite away',
    'combat-range': 'Close to target',
    hold: 'Hold position',
  }
  const behavior = Object.freeze({
    profileId,
    profileName: profile.name,
    profileDescription: profile.description,
    freeMode: state.player.behaviorController?.freeMode ?? false,
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
    estimatedEssence,
    elapsedTime: state.time,
    killCount: state.run.killCount,
    rerollsRemaining: state.run.rerollsRemaining ?? 0,
    gearXpBlessingActive: state.run.gearXpBlessingActive === true,
    ...(state.run.worldModifierIds?.length
      ? {
          worldModifierIds: state.run.worldModifierIds,
          worldModifierRewardMultiplier,
        }
      : {}),
    floor,
    floorProgress,
    floorElapsedTime,
    floorDurationSeconds,
    skillSlotCount: eligibilityState.skillSlotCount,
    mirrorcastTargetSkillId: state.player.mirrorcastTargetSkillId ?? null,
    criticalSpellstrikeTargetSkillId: state.player.criticalSpellstrikeTargetSkillId ?? null,
    bloodRiteTargetSkillId: state.player.bloodRiteTargetSkillId ?? null,
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
    shield: createShieldSnapshot(state.player),
    characterStats: createCharacterStatsSnapshot(
      playerStats,
      state.player,
      equippedWeaponArchetype,
      getAttunementDamageFromStats(
        playerStats,
        getAttunementSourceAdditionalIncreasedDamage(state),
      ),
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
  const skillIds: SkillId[] = []
  const seenSkillIds = new Set<SkillId>()
  for (const skill of state.player.skills) {
    if (isSkillId(skill.skillId) && !seenSkillIds.has(skill.skillId)) {
      seenSkillIds.add(skill.skillId)
      skillIds.push(skill.skillId)
    }
  }
  for (const skillId of Object.keys(state.run.skillDamageDealt ?? {})) {
    if (isSkillId(skillId) && !seenSkillIds.has(skillId)) {
      seenSkillIds.add(skillId)
      skillIds.push(skillId)
    }
  }
  for (const skillId of Object.keys(state.run.skillHealingDone ?? {})) {
    if (isSkillId(skillId) && !seenSkillIds.has(skillId)) {
      seenSkillIds.add(skillId)
      skillIds.push(skillId)
    }
  }
  const skillDamage = skillIds.flatMap((skillId) => {
    const damage = state.run.skillDamageDealt?.[skillId] ?? 0
    if (!Number.isFinite(damage) || damage <= 0) {
      return []
    }
    return [Object.freeze({
      skillId,
      name: getSkillDefinition(skillId).name,
      damage,
    })]
  })
  const skillHealing = skillIds.flatMap((skillId) => {
    const healing = state.run.skillHealingDone?.[skillId] ?? 0
    if (!Number.isFinite(healing) || healing <= 0) {
      return []
    }
    return [Object.freeze({
      skillId,
      name: getSkillDefinition(skillId).name,
      healing,
    })]
  })
  const result = {
    phase: state.run.phase,
    elapsedTime: state.time,
    level: state.player.level,
    xp: state.player.xp,
    killCount: state.run.killCount,
    worldModifierIds: state.run.worldModifierIds ?? [],
    ...(state.run.forfeited ? { forfeited: true as const } : {}),
    playerCombatLog: Object.freeze(
      (state.run.playerCombatLog ?? []).map((entry) => Object.freeze({ ...entry })),
    ),
    skillDamage: Object.freeze(skillDamage),
    skillHealing: Object.freeze(skillHealing),
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
