import {
  EQUIPMENT_SLOTS,
  INITIAL_ITEMS,
  type ItemDefinition,
} from '../../content/gear/Items'
import {
  evaluateDerivedStats,
  type StatModifier,
  type StatValues,
} from '../../content/stats/Stats'
import type { PlayerState } from '../state/GameState'

export type PlayerStats = StatValues

function directPlayerStats(player: Readonly<PlayerState>): PlayerStats {
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
): StatModifier[] {
  const equipment = player.equipment
  if (!equipment) {
    return []
  }

  const modifiers: StatModifier[] = []
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

export function getDerivedPlayerStats(
  player: Readonly<PlayerState>,
  itemDefinitions: readonly ItemDefinition[] = INITIAL_ITEMS,
): PlayerStats {
  const base = player.baseStats ?? directPlayerStats(player)
  const modifiers = [
    ...(player.statModifiers ?? []),
    ...getItemModifiers(player, itemDefinitions),
  ]
  return evaluateDerivedStats(base, modifiers)
}

/**
 * Keeps legacy scalar fields as a compatible projection of the derived stat
 * model. New systems should read `getDerivedPlayerStats` instead.
 */
export function refreshPlayerDerivedStats(
  player: PlayerState,
  itemDefinitions: readonly ItemDefinition[] = INITIAL_ITEMS,
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
}
