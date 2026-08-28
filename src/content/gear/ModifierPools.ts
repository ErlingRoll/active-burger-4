import type { Rarity } from '../rarity/Rarity'
import type {
  DamageIncreaseType,
  DamageResistanceType,
  DamageType,
} from '../stats/Damage'
import type { StatKey } from '../stats/Stats'
import {
  BASIC_ATTACK_SKILL_ID,
  VITALITY_SKILL_ID,
  WHIRLWIND_SKILL_ID,
  type SkillId,
  type SkillTag,
} from '../skills/Skills'
import type { RandomSource } from '../../game/random/Random'
import { EquipmentSlot } from './EquipmentSlots'
import type { WeaponArchetype } from './Items'

export type GearModifierTier = 1 | 2 | 3 | 4 | 5

export const GEAR_MODIFIER_TIERS = [
  1,
  2,
  3,
  4,
  5,
] as const satisfies readonly GearModifierTier[]

export type GearModifierId =
  | 'max-hp'
  | 'movement-speed'
  | 'attack-speed'
  | 'attack-range'
  | 'cooldown-reduction'
  | 'area-of-effect'
  | 'melee-leech'
  | 'basic-attack-extra-projectiles'
  | 'projectile-chains'
  | 'flat-physical-damage'
  | 'flat-lightning-damage'
  | 'flat-fire-damage'
  | 'flat-cold-damage'
  | 'flat-chaos-damage'
  | 'increased-global-damage'
  | 'increased-physical-damage'
  | 'increased-elemental-damage'
  | 'increased-chaos-damage'
  | 'dot-multiplier'
  | 'increased-projectile-damage'
  | 'crit-chance'
  | 'crit-multiplier'
  | 'physical-resistance'
  | 'elemental-resistance'
  | 'chaos-resistance'

export interface GearModifier {
  id: GearModifierId
  tier: GearModifierTier
  value: number
  sourceId: string
}

interface TierRange {
  min: number
  max: number
}

interface GearModifierDefinitionBase {
  id: GearModifierId
  label: string
  valueType: 'flat' | 'percent'
  availableSlots: readonly EquipmentSlot[]
  availableWeaponArchetypes?: readonly WeaponArchetype[]
  weaponArchetypeRollWeights?: Partial<Record<WeaponArchetype, number>>
  sortOrder: number
  tiers: Record<GearModifierTier, TierRange>
}

interface GearStatModifierDefinition extends GearModifierDefinitionBase {
  kind: 'stat'
  stat: Extract<StatKey, 'maxHp' | 'movementSpeed' | 'attackSpeed' | 'attackRange'>
}

interface GearFlatDamageModifierDefinition extends GearModifierDefinitionBase {
  kind: 'flat-damage'
  damageType: DamageType
}

interface GearIncreasedDamageModifierDefinition extends GearModifierDefinitionBase {
  kind: 'increased-damage'
  increaseType: DamageIncreaseType
}

interface GearResistanceModifierDefinition extends GearModifierDefinitionBase {
  kind: 'resistance'
  resistanceType: DamageResistanceType
}

interface GearCriticalStrikeModifierDefinition extends GearModifierDefinitionBase {
  kind: 'critical-strike'
  criticalType: 'chance' | 'multiplier'
}

interface GearCooldownReductionModifierDefinition extends GearModifierDefinitionBase {
  kind: 'cooldown-reduction'
}

interface GearAreaOfEffectModifierDefinition extends GearModifierDefinitionBase {
  kind: 'area-of-effect'
}

interface GearMeleeLeechModifierDefinition extends GearModifierDefinitionBase {
  kind: 'melee-leech'
}

interface GearBasicAttackExtraProjectilesModifierDefinition
  extends GearModifierDefinitionBase {
  kind: 'basic-attack-extra-projectiles'
}

interface GearProjectileChainsModifierDefinition
  extends GearModifierDefinitionBase {
  kind: 'projectile-chains'
}

interface GearDotMultiplierModifierDefinition
  extends GearModifierDefinitionBase {
  kind: 'dot-multiplier'
}

export type GearModifierDefinition =
  | GearStatModifierDefinition
  | GearFlatDamageModifierDefinition
  | GearIncreasedDamageModifierDefinition
  | GearResistanceModifierDefinition
  | GearCriticalStrikeModifierDefinition
  | GearCooldownReductionModifierDefinition
  | GearAreaOfEffectModifierDefinition
  | GearMeleeLeechModifierDefinition
  | GearBasicAttackExtraProjectilesModifierDefinition
  | GearProjectileChainsModifierDefinition
  | GearDotMultiplierModifierDefinition

export interface GearModifierTargetItem {
  id: string
  slot: EquipmentSlot
  weaponArchetype?: WeaponArchetype
}

export interface GearModifierSkillContext {
  tags?: readonly SkillTag[]
  supportsAreaOfEffect?: boolean
}

export const GEAR_RARITY_WEIGHTS = {
  common: 1000,
  uncommon: 800,
  rare: 300,
  epic: 50,
  legendary: 10,
} as const satisfies Record<Rarity, number>

export const GEAR_RARITY_MODIFIER_COUNTS = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
} as const satisfies Record<Rarity, number>

const DAMAGE_SLOTS = [
  EquipmentSlot.Weapon,
  EquipmentSlot.Ring,
  EquipmentSlot.Amulet,
] as const satisfies readonly EquipmentSlot[]
const NON_WEAPON_SLOTS = [
  EquipmentSlot.Helmet,
  EquipmentSlot.Armor,
  EquipmentSlot.Boots,
  EquipmentSlot.Ring,
  EquipmentSlot.Amulet,
] as const satisfies readonly EquipmentSlot[]
const ALL_SLOTS = [
  EquipmentSlot.Weapon,
  EquipmentSlot.Helmet,
  EquipmentSlot.Armor,
  EquipmentSlot.Boots,
  EquipmentSlot.Ring,
  EquipmentSlot.Amulet,
] as const satisfies readonly EquipmentSlot[]
const PROJECTILE_WEAPON_ARCHETYPES = [
  'bow',
  'wand',
] as const satisfies readonly WeaponArchetype[]

function defineTiers(
  tier1: TierRange,
  tier2: TierRange,
  tier3: TierRange,
  tier4: TierRange,
  tier5: TierRange,
): Record<GearModifierTier, TierRange> {
  return {
    1: tier1,
    2: tier2,
    3: tier3,
    4: tier4,
    5: tier5,
  }
}

const RESISTANCE_TIERS = defineTiers(
  { min: 41, max: 50 },
  { min: 31, max: 40 },
  { min: 21, max: 30 },
  { min: 11, max: 20 },
  { min: 1, max: 10 },
)

export const GEAR_MODIFIER_DEFINITIONS = {
  'max-hp': {
    id: 'max-hp',
    kind: 'stat',
    stat: 'maxHp',
    label: 'Max HP',
    valueType: 'flat',
    availableSlots: NON_WEAPON_SLOTS,
    sortOrder: 10,
    tiers: defineTiers(
      { min: 56, max: 70 },
      { min: 41, max: 55 },
      { min: 31, max: 40 },
      { min: 21, max: 30 },
      { min: 12, max: 20 },
    ),
  },
  'movement-speed': {
    id: 'movement-speed',
    kind: 'stat',
    stat: 'movementSpeed',
    label: 'Movement speed',
    valueType: 'percent',
    availableSlots: [EquipmentSlot.Boots],
    sortOrder: 20,
    tiers: defineTiers(
      { min: 16, max: 20 },
      { min: 13, max: 15 },
      { min: 10, max: 12 },
      { min: 7, max: 9 },
      { min: 4, max: 6 },
    ),
  },
  'attack-speed': {
    id: 'attack-speed',
    kind: 'stat',
    stat: 'attackSpeed',
    label: 'Attack speed',
    valueType: 'percent',
    availableSlots: [
      EquipmentSlot.Weapon,
      EquipmentSlot.Armor,
      EquipmentSlot.Boots,
      EquipmentSlot.Ring,
      EquipmentSlot.Amulet,
    ],
    sortOrder: 30,
    tiers: defineTiers(
      { min: 20, max: 24 },
      { min: 16, max: 19 },
      { min: 12, max: 15 },
      { min: 8, max: 11 },
      { min: 4, max: 7 },
    ),
  },
  'attack-range': {
    id: 'attack-range',
    kind: 'stat',
    stat: 'attackRange',
    label: 'Attack range',
    valueType: 'flat',
    availableSlots: [
      EquipmentSlot.Helmet,
      EquipmentSlot.Boots,
      EquipmentSlot.Ring,
      EquipmentSlot.Amulet,
    ],
    sortOrder: 40,
    tiers: defineTiers(
      { min: 41, max: 50 },
      { min: 33, max: 40 },
      { min: 25, max: 32 },
      { min: 17, max: 24 },
      { min: 10, max: 16 },
    ),
  },
  'cooldown-reduction': {
    id: 'cooldown-reduction',
    kind: 'cooldown-reduction',
    label: 'Cooldown reduction',
    valueType: 'percent',
    availableSlots: [EquipmentSlot.Weapon],
    sortOrder: 50,
    tiers: defineTiers(
      { min: 19, max: 22 },
      { min: 15, max: 18 },
      { min: 11, max: 14 },
      { min: 7, max: 10 },
      { min: 4, max: 6 },
    ),
  },
  'area-of-effect': {
    id: 'area-of-effect',
    kind: 'area-of-effect',
    label: 'Area of effect',
    valueType: 'percent',
    availableSlots: ALL_SLOTS,
    weaponArchetypeRollWeights: { sword: 4 },
    sortOrder: 55,
    tiers: defineTiers(
      { min: 21, max: 25 },
      { min: 17, max: 20 },
      { min: 13, max: 16 },
      { min: 9, max: 12 },
      { min: 5, max: 8 },
    ),
  },
  'melee-leech': {
    id: 'melee-leech',
    kind: 'melee-leech',
    label: 'Melee leech',
    valueType: 'percent',
    availableSlots: [EquipmentSlot.Weapon],
    availableWeaponArchetypes: ['sword'],
    sortOrder: 60,
    tiers: defineTiers(
      { min: 5, max: 5 },
      { min: 4, max: 4 },
      { min: 3, max: 3 },
      { min: 2, max: 2 },
      { min: 1, max: 1 },
    ),
  },
  'basic-attack-extra-projectiles': {
    id: 'basic-attack-extra-projectiles',
    kind: 'basic-attack-extra-projectiles',
    label: 'extra Basic Attack projectiles',
    valueType: 'flat',
    availableSlots: [EquipmentSlot.Weapon],
    availableWeaponArchetypes: PROJECTILE_WEAPON_ARCHETYPES,
    sortOrder: 65,
    tiers: defineTiers(
      { min: 4, max: 4 },
      { min: 3, max: 3 },
      { min: 2, max: 2 },
      { min: 1, max: 1 },
      { min: 1, max: 1 },
    ),
  },
  'projectile-chains': {
    id: 'projectile-chains',
    kind: 'projectile-chains',
    label: 'Projectile chains',
    valueType: 'flat',
    availableSlots: [EquipmentSlot.Weapon],
    availableWeaponArchetypes: PROJECTILE_WEAPON_ARCHETYPES,
    sortOrder: 67,
    tiers: defineTiers(
      { min: 4, max: 4 },
      { min: 3, max: 3 },
      { min: 3, max: 3 },
      { min: 2, max: 2 },
      { min: 2, max: 2 },
    ),
  },
  'flat-physical-damage': {
    id: 'flat-physical-damage',
    kind: 'flat-damage',
    damageType: 'physical',
    label: 'Physical damage',
    valueType: 'flat',
    availableSlots: DAMAGE_SLOTS,
    sortOrder: 70,
    tiers: defineTiers(
      { min: 10, max: 12 },
      { min: 8, max: 9 },
      { min: 6, max: 7 },
      { min: 4, max: 5 },
      { min: 2, max: 3 },
    ),
  },
  'flat-lightning-damage': {
    id: 'flat-lightning-damage',
    kind: 'flat-damage',
    damageType: 'lightning',
    label: 'Lightning damage',
    valueType: 'flat',
    availableSlots: DAMAGE_SLOTS,
    sortOrder: 80,
    tiers: defineTiers(
      { min: 9, max: 10 },
      { min: 7, max: 8 },
      { min: 5, max: 6 },
      { min: 3, max: 4 },
      { min: 1, max: 2 },
    ),
  },
  'flat-fire-damage': {
    id: 'flat-fire-damage',
    kind: 'flat-damage',
    damageType: 'fire',
    label: 'Fire damage',
    valueType: 'flat',
    availableSlots: DAMAGE_SLOTS,
    sortOrder: 90,
    tiers: defineTiers(
      { min: 9, max: 10 },
      { min: 7, max: 8 },
      { min: 5, max: 6 },
      { min: 3, max: 4 },
      { min: 1, max: 2 },
    ),
  },
  'flat-cold-damage': {
    id: 'flat-cold-damage',
    kind: 'flat-damage',
    damageType: 'cold',
    label: 'Cold damage',
    valueType: 'flat',
    availableSlots: DAMAGE_SLOTS,
    sortOrder: 100,
    tiers: defineTiers(
      { min: 9, max: 10 },
      { min: 7, max: 8 },
      { min: 5, max: 6 },
      { min: 3, max: 4 },
      { min: 1, max: 2 },
    ),
  },
  'flat-chaos-damage': {
    id: 'flat-chaos-damage',
    kind: 'flat-damage',
    damageType: 'chaos',
    label: 'Chaos damage',
    valueType: 'flat',
    availableSlots: DAMAGE_SLOTS,
    sortOrder: 110,
    tiers: defineTiers(
      { min: 9, max: 10 },
      { min: 7, max: 8 },
      { min: 5, max: 6 },
      { min: 3, max: 4 },
      { min: 1, max: 2 },
    ),
  },
  'increased-global-damage': {
    id: 'increased-global-damage',
    kind: 'increased-damage',
    increaseType: 'global',
    label: 'Increased global damage',
    valueType: 'percent',
    availableSlots: DAMAGE_SLOTS,
    sortOrder: 120,
    tiers: defineTiers(
      { min: 21, max: 25 },
      { min: 17, max: 20 },
      { min: 13, max: 16 },
      { min: 9, max: 12 },
      { min: 5, max: 8 },
    ),
  },
  'increased-physical-damage': {
    id: 'increased-physical-damage',
    kind: 'increased-damage',
    increaseType: 'physical',
    label: 'Increased physical damage',
    valueType: 'percent',
    availableSlots: DAMAGE_SLOTS,
    sortOrder: 130,
    tiers: defineTiers(
      { min: 31, max: 36 },
      { min: 25, max: 30 },
      { min: 19, max: 24 },
      { min: 13, max: 18 },
      { min: 8, max: 12 },
    ),
  },
  'increased-elemental-damage': {
    id: 'increased-elemental-damage',
    kind: 'increased-damage',
    increaseType: 'elemental',
    label: 'Increased elemental damage',
    valueType: 'percent',
    availableSlots: DAMAGE_SLOTS,
    sortOrder: 140,
    tiers: defineTiers(
      { min: 31, max: 36 },
      { min: 25, max: 30 },
      { min: 19, max: 24 },
      { min: 13, max: 18 },
      { min: 8, max: 12 },
    ),
  },
  'increased-projectile-damage': {
    id: 'increased-projectile-damage',
    kind: 'increased-damage',
    increaseType: 'projectile',
    label: 'Increased projectile damage',
    valueType: 'percent',
    availableSlots: [EquipmentSlot.Weapon],
    availableWeaponArchetypes: PROJECTILE_WEAPON_ARCHETYPES,
    sortOrder: 145,
    tiers: defineTiers(
      { min: 27, max: 32 },
      { min: 22, max: 26 },
      { min: 17, max: 21 },
      { min: 11, max: 16 },
      { min: 6, max: 10 },
    ),
  },
  'increased-chaos-damage': {
    id: 'increased-chaos-damage',
    kind: 'increased-damage',
    increaseType: 'chaos',
    label: 'Increased chaos damage',
    valueType: 'percent',
    availableSlots: DAMAGE_SLOTS,
    sortOrder: 150,
    tiers: defineTiers(
      { min: 31, max: 36 },
      { min: 25, max: 30 },
      { min: 19, max: 24 },
      { min: 13, max: 18 },
      { min: 8, max: 12 },
    ),
  },
  'dot-multiplier': {
    id: 'dot-multiplier',
    kind: 'dot-multiplier',
    label: 'DoT multiplier',
    valueType: 'percent',
    availableSlots: ALL_SLOTS,
    sortOrder: 155,
    tiers: defineTiers(
      { min: 16, max: 20 },
      { min: 13, max: 15 },
      { min: 10, max: 12 },
      { min: 7, max: 9 },
      { min: 4, max: 6 },
    ),
  },
  'crit-chance': {
    id: 'crit-chance',
    kind: 'critical-strike',
    criticalType: 'chance',
    label: 'Critical strike chance',
    valueType: 'percent',
    availableSlots: DAMAGE_SLOTS,
    sortOrder: 160,
    tiers: defineTiers(
      { min: 14, max: 16 },
      { min: 11, max: 13 },
      { min: 8, max: 10 },
      { min: 5, max: 7 },
      { min: 2, max: 4 },
    ),
  },
  'crit-multiplier': {
    id: 'crit-multiplier',
    kind: 'critical-strike',
    criticalType: 'multiplier',
    label: 'Critical strike multiplier',
    valueType: 'percent',
    availableSlots: DAMAGE_SLOTS,
    sortOrder: 170,
    tiers: defineTiers(
      { min: 71, max: 90 },
      { min: 51, max: 70 },
      { min: 36, max: 50 },
      { min: 21, max: 35 },
      { min: 10, max: 20 },
    ),
  },
  'physical-resistance': {
    id: 'physical-resistance',
    kind: 'resistance',
    resistanceType: 'physical',
    label: 'Physical resistance',
    valueType: 'percent',
    availableSlots: NON_WEAPON_SLOTS,
    sortOrder: 180,
    tiers: RESISTANCE_TIERS,
  },
  'elemental-resistance': {
    id: 'elemental-resistance',
    kind: 'resistance',
    resistanceType: 'elemental',
    label: 'Elemental resistance',
    valueType: 'percent',
    availableSlots: NON_WEAPON_SLOTS,
    sortOrder: 190,
    tiers: RESISTANCE_TIERS,
  },
  'chaos-resistance': {
    id: 'chaos-resistance',
    kind: 'resistance',
    resistanceType: 'chaos',
    label: 'Chaos resistance',
    valueType: 'percent',
    availableSlots: NON_WEAPON_SLOTS,
    sortOrder: 200,
    tiers: RESISTANCE_TIERS,
  },
} as const satisfies Record<GearModifierId, GearModifierDefinition>

export const GEAR_MODIFIER_IDS = Object.keys(
  GEAR_MODIFIER_DEFINITIONS,
) as GearModifierId[]

export function isGearModifierId(value: unknown): value is GearModifierId {
  return typeof value === 'string' &&
    GEAR_MODIFIER_IDS.some((modifierId) => modifierId === value)
}

export function isGearModifierTier(value: unknown): value is GearModifierTier {
  return typeof value === 'number' &&
    GEAR_MODIFIER_TIERS.some((tier) => tier === value)
}

export function getGearModifierDefinition(
  modifierId: GearModifierId,
): GearModifierDefinition {
  const definition = GEAR_MODIFIER_DEFINITIONS[modifierId]
  if (!definition) {
    throw new Error(`Unknown gear modifier definition: ${modifierId}`)
  }
  return definition
}

export function getGearModifierCountForRarity(rarity: Rarity): number {
  return GEAR_RARITY_MODIFIER_COUNTS[rarity]
}

export function getGearModifierSourceId(itemId: string, modifierId: GearModifierId): string {
  return `item:${itemId}:${modifierId}`
}

export function cloneGearModifiers(
  modifiers: readonly GearModifier[],
): GearModifier[] {
  return modifiers.map((modifier) => ({ ...modifier }))
}

export function sortGearModifiers<
  T extends Pick<GearModifier, 'id'> & Partial<Pick<GearModifier, 'tier'>>
>(
  modifiers: readonly T[],
): T[] {
  return [...modifiers].sort((left, right) => {
    const leftDefinition = getGearModifierDefinition(left.id)
    const rightDefinition = getGearModifierDefinition(right.id)
    if (leftDefinition.sortOrder !== rightDefinition.sortOrder) {
      return leftDefinition.sortOrder - rightDefinition.sortOrder
    }
    if (
      left.tier !== undefined &&
      right.tier !== undefined &&
      left.tier !== right.tier
    ) {
      return left.tier - right.tier
    }
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
  })
}

export function getGearModifierTierRange(
  modifierId: GearModifierId,
  tier: GearModifierTier,
): TierRange {
  return getGearModifierDefinition(modifierId).tiers[tier]
}

export function isGearModifierValueInTier(
  modifierId: GearModifierId,
  tier: GearModifierTier,
  value: number,
): boolean {
  const range = getGearModifierTierRange(modifierId, tier)
  return Number.isFinite(value) && value >= range.min && value <= range.max
}

export function createGearModifier(
  itemId: string,
  modifierId: GearModifierId,
  tier: GearModifierTier,
  value: number,
): GearModifier {
  if (!isGearModifierValueInTier(modifierId, tier, value)) {
    const range = getGearModifierTierRange(modifierId, tier)
    throw new Error(
      `Gear modifier ${modifierId} Tier ${tier} value ${value} must be between ${range.min} and ${range.max}.`,
    )
  }
  return {
    id: modifierId,
    tier,
    value,
    sourceId: getGearModifierSourceId(itemId, modifierId),
  }
}

function rollTier(rng: RandomSource): GearModifierTier {
  return GEAR_MODIFIER_TIERS[rng.int(0, GEAR_MODIFIER_TIERS.length - 1)] as GearModifierTier
}

export function rollGearModifier(
  itemId: string,
  modifierId: GearModifierId,
  rng: RandomSource,
  tier = rollTier(rng),
): GearModifier {
  const range = getGearModifierTierRange(modifierId, tier)
  return createGearModifier(
    itemId,
    modifierId,
    tier,
    rng.int(range.min, range.max),
  )
}

export function rerollGearModifierAtTier(
  modifier: Readonly<GearModifier>,
  tier: GearModifierTier,
  rng: RandomSource,
): GearModifier {
  return rollGearModifier(
    modifier.sourceId.split(':')[1] ?? 'item',
    modifier.id,
    rng,
    tier,
  )
}

export function getAvailableGearModifiersForSlot(
  slot: EquipmentSlot,
): GearModifierDefinition[] {
  return GEAR_MODIFIER_IDS
    .map((modifierId) => getGearModifierDefinition(modifierId))
    .filter((modifier) => modifier.availableSlots.includes(slot))
    .sort((left, right) =>
      left.sortOrder - right.sortOrder ||
      (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
    )
}

export function isGearModifierAvailableForItem(
  modifier: Pick<GearModifier, 'id'> | Pick<GearModifierDefinition, 'id'>,
  item: Readonly<GearModifierTargetItem>,
): boolean {
  const definition = getGearModifierDefinition(modifier.id)
  if (!definition.availableSlots.includes(item.slot)) {
    return false
  }
  if (!definition.availableWeaponArchetypes) {
    return true
  }
  return item.slot === EquipmentSlot.Weapon &&
    item.weaponArchetype !== undefined &&
    definition.availableWeaponArchetypes.includes(item.weaponArchetype)
}

export function getAvailableGearModifiersForItem(
  item: Readonly<GearModifierTargetItem>,
): GearModifierDefinition[] {
  return getAvailableGearModifiersForSlot(item.slot)
    .filter((modifier) => isGearModifierAvailableForItem(modifier, item))
}

function getGearModifierRollWeight(
  modifier: GearModifierDefinition,
  item: Readonly<GearModifierTargetItem>,
): number {
  if (item.slot !== EquipmentSlot.Weapon || item.weaponArchetype === undefined) {
    return 1
  }
  return modifier.weaponArchetypeRollWeights?.[item.weaponArchetype] ?? 1
}

function takeWeightedGearModifier(
  available: GearModifierDefinition[],
  item: Readonly<GearModifierTargetItem>,
  rng: RandomSource,
): GearModifierDefinition {
  const totalWeight = available.reduce(
    (total, modifier) => total + getGearModifierRollWeight(modifier, item),
    0,
  )
  let roll = rng.int(0, totalWeight - 1)
  for (let index = 0; index < available.length; index += 1) {
    const modifier = available[index]
    if (!modifier) {
      continue
    }
    roll -= getGearModifierRollWeight(modifier, item)
    if (roll < 0) {
      return available.splice(index, 1)[0] as GearModifierDefinition
    }
  }
  throw new Error(`Unable to choose a gear modifier for item ${item.id}.`)
}

export function rollGearModifiersForItem(
  item: Readonly<GearModifierTargetItem>,
  rarity: Rarity,
  rng: RandomSource,
): GearModifier[] {
  const count = getGearModifierCountForRarity(rarity)
  const available = [...getAvailableGearModifiersForItem(item)]
  if (available.length < count) {
    throw new Error(
      `Cannot roll ${count} unique gear modifiers for item ${item.id}; only ${available.length} are available.`,
    )
  }
  const rolled: GearModifier[] = []
  while (rolled.length < count) {
    const definition = takeWeightedGearModifier(available, item, rng)
    rolled.push(rollGearModifier(item.id, definition.id, rng))
  }
  return sortGearModifiers(rolled)
}

function formatGearModifierMagnitude(
  definition: GearModifierDefinition,
  magnitude: number,
): string {
  if (definition.kind === 'basic-attack-extra-projectiles') {
    return `${magnitude} extra Basic Attack projectile${magnitude === 1 ? '' : 's'}`
  }
  if (definition.kind === 'projectile-chains') {
    return `${magnitude} projectile chain${magnitude === 1 ? '' : 's'}`
  }
  return definition.valueType === 'percent'
    ? `${magnitude}% ${definition.label}`
    : `${magnitude} ${definition.label}`
}

export function formatGearModifier(
  modifier: Pick<GearModifier, 'id' | 'value'> &
    Partial<Pick<GearModifier, 'tier'>>,
  options: {
    includeTier?: boolean
    includePlusSign?: boolean
  } = {},
): string {
  const definition = getGearModifierDefinition(modifier.id)
  const prefix = options.includePlusSign === false
    ? ''
    : modifier.value >= 0
      ? '+'
      : '-'
  const magnitude = Math.abs(modifier.value)
  const tierLabel = options.includeTier === false || modifier.tier === undefined
    ? ''
    : `T${modifier.tier} `
  return `${tierLabel}${prefix}${formatGearModifierMagnitude(definition, magnitude)}`
}

export function serializeGearModifiers(
  modifiers: readonly Pick<GearModifier, 'id' | 'tier' | 'value'>[],
): string {
  return sortGearModifiers(modifiers).map((modifier) =>
    `${modifier.id}:${modifier.tier}:${modifier.value}`
  ).join('|')
}

export function doesGearModifierAffectSkill(
  modifier: Pick<GearModifier, 'id'>,
  skillId: SkillId,
  context: GearModifierSkillContext = {},
): boolean {
  const definition = getGearModifierDefinition(modifier.id)
  const tags = new Set(context.tags ?? [])
  if (definition.kind === 'flat-damage') {
    return skillId !== VITALITY_SKILL_ID
  }
  if (definition.kind === 'critical-strike') {
    return true
  }
  if (definition.kind === 'increased-damage') {
    return skillId !== VITALITY_SKILL_ID &&
      (definition.increaseType !== 'projectile' || tags.has('projectile'))
  }
  if (definition.kind === 'cooldown-reduction') {
    return skillId !== BASIC_ATTACK_SKILL_ID
  }
  if (definition.kind === 'area-of-effect') {
    return context.supportsAreaOfEffect ?? skillId === WHIRLWIND_SKILL_ID
  }
  if (definition.kind === 'melee-leech') {
    return tags.has('melee') || skillId === WHIRLWIND_SKILL_ID
  }
  if (definition.kind === 'basic-attack-extra-projectiles') {
    return skillId === BASIC_ATTACK_SKILL_ID && tags.has('projectile')
  }
  if (definition.kind === 'projectile-chains') {
    return tags.has('projectile')
  }
  if (definition.kind === 'dot-multiplier') {
    return tags.has('dot')
  }
  if (definition.kind === 'stat') {
    if (definition.stat === 'attackSpeed') {
      return skillId === BASIC_ATTACK_SKILL_ID
    }
    if (definition.stat === 'attackRange') {
      return skillId === BASIC_ATTACK_SKILL_ID
    }
  }
  return false
}

export function validateGearModifierDefinitions(): string[] {
  const errors: string[] = []
  for (const modifierId of GEAR_MODIFIER_IDS) {
    const definition = getGearModifierDefinition(modifierId)
    for (const tier of GEAR_MODIFIER_TIERS) {
      const range = definition.tiers[tier]
      if (
        !range ||
        !Number.isFinite(range.min) ||
        !Number.isFinite(range.max) ||
        range.min > range.max
      ) {
        errors.push(`gearModifierDefinitions.${modifierId}.tiers.${tier} must define a valid range.`)
      }
    }
    for (const [archetype, weight] of Object.entries(
      definition.weaponArchetypeRollWeights ?? {},
    )) {
      if (!Number.isFinite(weight) || weight <= 0) {
        errors.push(
          `gearModifierDefinitions.${modifierId}.weaponArchetypeRollWeights.${archetype} must be a positive finite number.`,
        )
      }
    }
  }
  const representativeItems: readonly GearModifierTargetItem[] = [
    { id: 'validation-sword', slot: EquipmentSlot.Weapon, weaponArchetype: 'sword' },
    { id: 'validation-bow', slot: EquipmentSlot.Weapon, weaponArchetype: 'bow' },
    { id: 'validation-wand', slot: EquipmentSlot.Weapon, weaponArchetype: 'wand' },
    { id: 'validation-staff', slot: EquipmentSlot.Weapon, weaponArchetype: 'staff' },
    { id: 'validation-helmet', slot: EquipmentSlot.Helmet },
    { id: 'validation-armor', slot: EquipmentSlot.Armor },
    { id: 'validation-boots', slot: EquipmentSlot.Boots },
    { id: 'validation-ring', slot: EquipmentSlot.Ring },
    { id: 'validation-amulet', slot: EquipmentSlot.Amulet },
  ]
  for (const item of representativeItems) {
    if (getAvailableGearModifiersForItem(item).length < GEAR_RARITY_MODIFIER_COUNTS.legendary) {
      const qualifier = item.weaponArchetype ? ` (${item.weaponArchetype})` : ''
      errors.push(
        `gearModifierDefinitions must provide at least five unique modifiers for slot ${item.slot}${qualifier}.`,
      )
    }
  }
  return errors
}
