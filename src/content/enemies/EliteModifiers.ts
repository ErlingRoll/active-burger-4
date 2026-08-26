export type EliteModifierId = 'hasted' | 'giant'

export interface EliteModifierDefinition {
  id: EliteModifierId
  name: string
  speedMultiplier: number
  radiusMultiplier: number
  maxHpMultiplier: number
  xpRewardMultiplier: number
  gearDropChanceMultiplier: number
  markerColor: string
}

/**
 * Elite tuning is content, rather than a renderer concern. Giant's 2x HP and
 * 1.5x size are intentionally explicit so reward and readability changes can
 * be balanced without changing simulation systems.
 */
export const ELITE_MODIFIER_DEFINITIONS = {
  hasted: {
    id: 'hasted',
    name: 'Hasted',
    speedMultiplier: 1.75,
    radiusMultiplier: 1,
    maxHpMultiplier: 1,
    xpRewardMultiplier: 1.5,
    gearDropChanceMultiplier: 1.5,
    markerColor: '#facc15',
  },
  giant: {
    id: 'giant',
    name: 'Giant',
    speedMultiplier: 1,
    radiusMultiplier: 1.5,
    maxHpMultiplier: 2,
    xpRewardMultiplier: 2,
    gearDropChanceMultiplier: 2,
    markerColor: '#fb7185',
  },
} as const satisfies Record<EliteModifierId, EliteModifierDefinition>

export function getEliteModifierDefinition(
  modifierId: EliteModifierId,
): EliteModifierDefinition {
  return ELITE_MODIFIER_DEFINITIONS[modifierId]
}
