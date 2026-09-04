import {
  EQUIPMENT_SLOTS,
  ALL_ITEM_DEFINITIONS,
  EquipmentSlot,
  getItemDefinition,
  getLegacyItemSetId,
  type ItemDefinition,
} from '../../content/gear/Items'
import { getLevelMaxHpBonus } from '../../content/progression/LevelScaling'
import {
  getGearModifierDefinition,
  type GearModifier,
} from '../../content/gear/ModifierPools'
import {
  DEFAULT_DAMAGE_INCREASE_VALUES,
  DEFAULT_DAMAGE_RESISTANCE_VALUES,
  DEFAULT_PLAYER_CRITICAL_STRIKE,
  createDamageIncreaseValues,
  createDamageResistanceValues,
  createDamageValues,
  PRIMARY_RESISTANCE_TYPES,
  type DamageIncreaseValues,
  type DamageResistanceValues,
  type DamageValues,
} from '../../content/stats/Damage'
import {
  evaluateDerivedStats,
  type CharacterStatValues,
  type StatModifier,
  type StatValues,
} from '../../content/stats/Stats'
import {
  ALL_GEAR_SET_DEFINITIONS,
  getActiveGearSetBonuses,
  normalizeGearSetId,
  type GearSetId,
} from '../../game-config/gear-sets'
import {
  CRITICAL_SPELLSTRIKE_SKILL_ID,
  getBasicAttackVariant,
} from '../../content/skills/Skills'
import type { PlayerState } from '../state/GameState'
import {
  DEFAULT_RESONANCE_ATTACKS,
} from '../../game-config/skills'
import {
  CHOICE_RECOVERY_MOVEMENT_SPEED_MULTIPLIER,
} from '../../game-config/movement'

export interface PlayerStats extends StatValues {
  resonance: number
  attunement: number
  basicAttackIsProjectile: boolean
  flatDamage: DamageValues
  increasedDamage: DamageIncreaseValues
  resistances: DamageResistanceValues
  critChance: number
  critMultiplier: number
  cooldownReduction: number
  areaOfEffect: number
  /** Extra projectiles granted globally to every projectile-tagged skill. */
  globalExtraProjectiles: number
  /** Extra projectiles granted by weapon-local Basic Attack modifiers. */
  basicAttackExtraProjectiles: number
  projectileChains: number
  /** Maximum active summons granted to each summon skill. */
  summonMaxCountBonus: number
  meleeLeech: number
  whirlwindLeech: number
  increasedHealing: number
  dotMultiplier: number
  frostStacksOnHit: number
  experienceGainPercent: number
}

function directPlayerStats(player: Readonly<PlayerState>): CharacterStatValues {
  return {
    maxHp: player.maxHp,
    movementSpeed: player.movementSpeed,
    attackDamage: player.attackDamage,
    attackSpeed: player.attackSpeed,
    resonance: player.resonance,
    attunement: player.attunement,
  }
}

function getBasicAttackIsProjectile(
  player: Readonly<PlayerState>,
  itemDefinitions: readonly ItemDefinition[],
): boolean {
  const equippedWeapon = player.equipment?.weapon
  if (!equippedWeapon) {
    return getBasicAttackVariant().tags.includes('projectile')
  }
  const definition = itemDefinitions.find(
    (candidate) => candidate.id === equippedWeapon.itemId,
  ) ?? getItemDefinition(equippedWeapon.itemId)
  return definition.slot === EquipmentSlot.Weapon &&
    getBasicAttackVariant(definition.weaponArchetype).tags.includes('projectile')
}

function getEquippedWeaponAttackRange(
  player: Readonly<PlayerState>,
  itemDefinitions: readonly ItemDefinition[],
): number {
  const equipped = player.equipment?.weapon
  if (!equipped) {
    return getBasicAttackVariant().attackRange
  }
  const definition = itemDefinitions.find(
    (candidate) => candidate.id === equipped.itemId,
  ) ?? getItemDefinition(equipped.itemId)
  return definition.slot === EquipmentSlot.Weapon
    ? getBasicAttackVariant(definition.weaponArchetype).attackRange
    : getBasicAttackVariant().attackRange
}

function getItemModifiers(
  player: Readonly<PlayerState>,
  itemDefinitions: readonly ItemDefinition[],
): GearModifier[] {
  const equipment = player.equipment
  if (!equipment) {
    return []
  }

  const modifiers: GearModifier[] = []
  for (const slot of EQUIPMENT_SLOTS) {
    const equipped = equipment[slot]
    if (!equipped) {
      continue
    }
    const definition = itemDefinitions.find(
      (candidate) => candidate.id === equipped.itemId,
    ) ?? getItemDefinition(equipped.itemId)
    if (definition) {
      modifiers.push(...(equipped.modifiers ?? definition.modifiers))
    }
  }
  return modifiers
}

interface AggregatedGearEffects {
  statModifiers: StatModifier[]
  flatDamage: DamageValues
  increasedDamage: DamageIncreaseValues
  resistances: DamageResistanceValues
  critChance: number
  critMultiplier: number
  cooldownReduction: number
  areaOfEffect: number
  globalExtraProjectiles: number
  basicAttackExtraProjectiles: number
  projectileChains: number
  summonMaxCountBonus: number
  meleeLeech: number
  whirlwindLeech: number
  dotMultiplier: number
  frostStacksOnHit: number
  experienceGainPercent: number
}

export function getEquippedGearSetPieceCounts(
  player: Readonly<PlayerState>,
  itemDefinitions: readonly ItemDefinition[] = ALL_ITEM_DEFINITIONS,
): Readonly<Record<GearSetId, number>> {
  const counts: Record<GearSetId, number> = {
    scholar: 0,
    giant: 0,
    astral: 0,
    splintering: 0,
  }
  for (const slot of EQUIPMENT_SLOTS) {
    const equipped = player.equipment?.[slot]
    if (!equipped) {
      continue
    }
    const definition = itemDefinitions.find(
      (candidate) => candidate.id === equipped.itemId,
    ) ?? getItemDefinition(equipped.itemId)
    const setId = normalizeGearSetId(equipped.setId) ??
      definition.setId ??
      getLegacyItemSetId(equipped.itemId)
    if (setId) {
      counts[setId] += 1
    }
  }
  return counts
}

function aggregateGearEffects(
  player: Readonly<PlayerState>,
  itemDefinitions: readonly ItemDefinition[],
): AggregatedGearEffects {
  const effects: AggregatedGearEffects = {
    statModifiers: [],
    flatDamage: createDamageValues(),
    increasedDamage: createDamageIncreaseValues(DEFAULT_DAMAGE_INCREASE_VALUES),
    resistances: createDamageResistanceValues({
      ...DEFAULT_DAMAGE_RESISTANCE_VALUES,
      ...(player.resistances ?? {}),
    }),
    critChance: player.critChance ?? DEFAULT_PLAYER_CRITICAL_STRIKE.chance,
    critMultiplier: player.critMultiplier ?? DEFAULT_PLAYER_CRITICAL_STRIKE.multiplier,
    cooldownReduction: Math.max(0, player.preparationCooldownReductionPercent ?? 0),
    areaOfEffect: 0,
    globalExtraProjectiles: 0,
    basicAttackExtraProjectiles: 0,
    projectileChains: 0,
    summonMaxCountBonus: 0,
    meleeLeech: 0,
    whirlwindLeech: Math.max(
      0,
      player.upgradeWhirlwindLeech ?? 0,
    ),
    dotMultiplier: Math.max(0, player.dotMultiplier ?? 0),
    frostStacksOnHit: 0,
    experienceGainPercent: 0,
  }

  for (const modifier of getItemModifiers(player, itemDefinitions)) {
    const definition = getGearModifierDefinition(modifier.id)
    if (!Number.isFinite(modifier.value)) {
      continue
    }
    if (definition.kind === 'stat') {
      effects.statModifiers.push({
        stat: definition.stat,
        operation:
          definition.stat === 'movementSpeed' || definition.stat === 'attackSpeed'
            ? 'multiply'
            : 'add',
        value:
          definition.stat === 'movementSpeed' || definition.stat === 'attackSpeed'
            ? 1 + modifier.value / 100
            : modifier.value,
        sourceId: modifier.sourceId,
      })
      continue
    }

    if (definition.kind === 'flat-damage') {
      effects.flatDamage[definition.damageType] += modifier.value
      continue
    }

    if (definition.kind === 'increased-damage') {
      effects.increasedDamage[definition.increaseType] += modifier.value
      continue
    }

    if (definition.kind === 'resistance') {
      effects.resistances[definition.resistanceType] += modifier.value
      continue
    }

    if (definition.kind === 'critical-strike') {
      if (definition.criticalType === 'chance') {
        effects.critChance += modifier.value
      } else {
        effects.critMultiplier += modifier.value
      }
      continue
    }

    if (definition.kind === 'cooldown-reduction') {
      effects.cooldownReduction += modifier.value
      continue
    }

    if (definition.kind === 'area-of-effect') {
      effects.areaOfEffect += modifier.value
      continue
    }

    if (definition.kind === 'melee-leech') {
      effects.meleeLeech += modifier.value / 100
      effects.whirlwindLeech += modifier.value / 100
      continue
    }

    if (definition.kind === 'basic-attack-extra-projectiles') {
      effects.basicAttackExtraProjectiles += modifier.value
      continue
    }

    if (definition.kind === 'projectile-chains') {
      effects.projectileChains += modifier.value
      continue
    }

    if (definition.kind === 'summon-count') {
      effects.summonMaxCountBonus += modifier.value
      continue
    }

    if (definition.kind === 'dot-multiplier') {
      effects.dotMultiplier += modifier.value
    } else if (definition.kind === 'frost-application') {
      effects.frostStacksOnHit += modifier.value
    }
  }
  if (player.skills.some((skill) => skill.skillId === CRITICAL_SPELLSTRIKE_SKILL_ID)) {
    effects.critChance += 50
    effects.critMultiplier -= 70
  }

  const setPieceCounts = getEquippedGearSetPieceCounts(player, itemDefinitions)
  let maxHpSetPercent = 0
  for (const set of ALL_GEAR_SET_DEFINITIONS) {
    const activeBonuses = getActiveGearSetBonuses(
      set,
      setPieceCounts[set.id],
    )
    for (const bonus of activeBonuses) {
      if (bonus.kind === 'max-hp-percent') {
        maxHpSetPercent += bonus.value
      } else if (bonus.kind === 'cooldown-reduction') {
        effects.cooldownReduction += bonus.value
      } else if (bonus.kind === 'extra-projectiles') {
        effects.globalExtraProjectiles += bonus.value
      } else if (bonus.kind === 'experience-gain-percent') {
        effects.experienceGainPercent += bonus.value
      } else if (bonus.kind === 'all-resistances') {
        for (const resistanceType of PRIMARY_RESISTANCE_TYPES) {
          effects.resistances[resistanceType] += bonus.value
        }
      }
    }
  }
  if (maxHpSetPercent > 0) {
    effects.statModifiers.push({
      stat: 'maxHp',
      operation: 'multiply',
      value: 1 + maxHpSetPercent / 100,
      sourceId: 'gear-set:max-hp',
    })
  }

  return effects
}

export function getDerivedPlayerStats(
  player: Readonly<PlayerState>,
  itemDefinitions: readonly ItemDefinition[] = ALL_ITEM_DEFINITIONS,
): PlayerStats {
  const base = player.baseStats ?? directPlayerStats(player)
  const effectiveBase: StatValues = {
    ...base,
    attackRange: getEquippedWeaponAttackRange(player, itemDefinitions),
  }
  const gearEffects = aggregateGearEffects(player, itemDefinitions)
  const modifiers = [
    ...(player.statModifiers ?? []),
    ...gearEffects.statModifiers,
  ]
  const scalarStats = evaluateDerivedStats(
    {
      ...effectiveBase,
      maxHp: effectiveBase.maxHp + getLevelMaxHpBonus(player.level),
    },
    modifiers,
  )
  return {
    ...scalarStats,
    resonance: Math.max(
      1,
      Math.floor(base.resonance ?? player.resonance ?? DEFAULT_RESONANCE_ATTACKS),
    ),
    attunement: Math.max(
      0,
      (base.attunement ?? player.attunement ?? 0) +
        (player.attunementBonusPercent ?? 0),
    ),
    basicAttackIsProjectile: getBasicAttackIsProjectile(player, itemDefinitions),
    flatDamage: gearEffects.flatDamage,
    increasedDamage: gearEffects.increasedDamage,
    resistances: gearEffects.resistances,
    critChance: gearEffects.critChance,
    critMultiplier: gearEffects.critMultiplier,
    cooldownReduction: gearEffects.cooldownReduction,
    areaOfEffect: gearEffects.areaOfEffect,
    globalExtraProjectiles: gearEffects.globalExtraProjectiles,
    basicAttackExtraProjectiles: gearEffects.basicAttackExtraProjectiles,
    projectileChains: gearEffects.projectileChains,
    summonMaxCountBonus: Math.max(0, gearEffects.summonMaxCountBonus),
    meleeLeech: gearEffects.meleeLeech,
    whirlwindLeech: gearEffects.whirlwindLeech,
    increasedHealing: Math.max(0, player.increasedHealing ?? 0),
    dotMultiplier: Math.max(0, player.dotMultiplier ?? 0) +
      gearEffects.dotMultiplier,
    frostStacksOnHit: Math.max(0, gearEffects.frostStacksOnHit),
    experienceGainPercent: Math.max(0, gearEffects.experienceGainPercent),
  }
}

/** Returns movement speed including the temporary post-choice recovery boost. */
export function getEffectivePlayerMovementSpeed(
  player: Readonly<PlayerState>,
  itemDefinitions: readonly ItemDefinition[] = ALL_ITEM_DEFINITIONS,
): number {
  const movementSpeed = getDerivedPlayerStats(player, itemDefinitions).movementSpeed
  return (player.choiceRecoveryMovementSpeedBoostRemaining ?? 0) > 0
    ? movementSpeed * CHOICE_RECOVERY_MOVEMENT_SPEED_MULTIPLIER
    : movementSpeed
}

/**
 * Keeps legacy scalar fields as a compatible projection of the derived stat
 * model. New systems should read `getDerivedPlayerStats` instead.
 */
export function refreshPlayerDerivedStats(
  player: PlayerState,
  itemDefinitions: readonly ItemDefinition[] = ALL_ITEM_DEFINITIONS,
): void {
  if (!player.baseStats) {
    player.baseStats = directPlayerStats(player)
  }
  const derived = getDerivedPlayerStats(player, itemDefinitions)
  player.maxHp = derived.maxHp
  player.movementSpeed = derived.movementSpeed
  player.attackDamage = derived.attackDamage
  player.attackSpeed = derived.attackSpeed
  player.meleeLeech = derived.meleeLeech
  player.whirlwindLeech = derived.whirlwindLeech
}

export function refreshMeleeLeech(
  player: PlayerState,
  itemDefinitions: readonly ItemDefinition[] = ALL_ITEM_DEFINITIONS,
): void {
  const derived = getDerivedPlayerStats(player, itemDefinitions)
  player.meleeLeech = derived.meleeLeech
  player.whirlwindLeech = derived.whirlwindLeech
}
