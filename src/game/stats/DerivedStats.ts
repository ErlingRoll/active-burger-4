import {
  EQUIPMENT_SLOTS,
  ALL_ITEM_DEFINITIONS,
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
  type DamageIncreaseValues,
  type DamageResistanceValues,
  type DamageValues,
} from '../../content/stats/Damage'
import {
  evaluateDerivedStats,
  type StatModifier,
  type StatValues,
} from '../../content/stats/Stats'
import type { PlayerState } from '../state/GameState'

export interface PlayerStats extends StatValues {
  flatDamage: DamageValues
  increasedDamage: DamageIncreaseValues
  resistances: DamageResistanceValues
  critChance: number
  critMultiplier: number
  cooldownReduction: number
  areaOfEffect: number
  basicAttackExtraProjectiles: number
  projectileChains: number
  meleeLeech: number
}

function directPlayerStats(player: Readonly<PlayerState>): StatValues {
  return {
    maxHp: player.maxHp,
    movementSpeed: player.movementSpeed,
    attackDamage: player.attackDamage,
    attackSpeed: player.attackSpeed,
    attackRange: player.attackRange,
  }
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
    )
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
  basicAttackExtraProjectiles: number
  projectileChains: number
  meleeLeech: number
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
    cooldownReduction: 0,
    areaOfEffect: 0,
    basicAttackExtraProjectiles: 0,
    projectileChains: 0,
    meleeLeech: Math.max(0, player.upgradeMeleeLeech ?? 0),
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
      continue
    }

    if (definition.kind === 'basic-attack-extra-projectiles') {
      effects.basicAttackExtraProjectiles += modifier.value
      continue
    }

    if (definition.kind === 'projectile-chains') {
      effects.projectileChains += modifier.value
    }
  }

  return effects
}

export function getDerivedPlayerStats(
  player: Readonly<PlayerState>,
  itemDefinitions: readonly ItemDefinition[] = ALL_ITEM_DEFINITIONS,
): PlayerStats {
  const base = player.baseStats ?? directPlayerStats(player)
  const gearEffects = aggregateGearEffects(player, itemDefinitions)
  const modifiers = [
    ...(player.statModifiers ?? []),
    ...gearEffects.statModifiers,
  ]
  const scalarStats = evaluateDerivedStats(
    {
      ...base,
      maxHp: base.maxHp + getLevelMaxHpBonus(player.level),
    },
    modifiers,
  )
  return {
    ...scalarStats,
    flatDamage: gearEffects.flatDamage,
    increasedDamage: gearEffects.increasedDamage,
    resistances: gearEffects.resistances,
    critChance: gearEffects.critChance,
    critMultiplier: gearEffects.critMultiplier,
    cooldownReduction: gearEffects.cooldownReduction,
    areaOfEffect: gearEffects.areaOfEffect,
    basicAttackExtraProjectiles: gearEffects.basicAttackExtraProjectiles,
    projectileChains: gearEffects.projectileChains,
    meleeLeech: gearEffects.meleeLeech,
  }
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
  player.attackRange = derived.attackRange
  player.meleeLeech = derived.meleeLeech
}

export function refreshMeleeLeech(
  player: PlayerState,
  itemDefinitions: readonly ItemDefinition[] = ALL_ITEM_DEFINITIONS,
): void {
  player.meleeLeech = getDerivedPlayerStats(player, itemDefinitions).meleeLeech
}
