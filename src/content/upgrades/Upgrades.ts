export type UpgradeId =
  | 'damage-boost'
  | 'attack-speed-boost'
  | 'movement-speed-boost'
export type UpgradeCategory = 'passive'
export type UpgradeRarity = 'common'
export type UpgradeStat = 'attackDamage' | 'attackSpeed' | 'movementSpeed'

export interface UpgradeChoice {
  upgradeId: UpgradeId
}

export interface UpgradeEligibilityState {
  playerLevel: number
  selectedUpgradeIds: readonly UpgradeId[]
}

export interface UpgradeDefinition {
  id: UpgradeId
  name: string
  description: string
  category: UpgradeCategory
  rarity: UpgradeRarity
  stat: UpgradeStat
  amount: number
  valueLabel: string
  isEligible: (state: Readonly<UpgradeEligibilityState>) => boolean
}

/**
 * The first upgrade set is intentionally small and repeatable. Values are
 * additive to the corresponding player stat so each selection is easy to
 * understand and deterministic.
 */
export const INITIAL_UPGRADES: readonly UpgradeDefinition[] = [
  {
    id: 'damage-boost',
    name: 'Heavy Hitter',
    description: 'Increase Basic Bolt damage.',
    category: 'passive',
    rarity: 'common',
    stat: 'attackDamage',
    amount: 2,
    valueLabel: '+2 damage',
    isEligible: () => true,
  },
  {
    id: 'attack-speed-boost',
    name: 'Rapid Fire',
    description: 'Attack more often with Basic Bolt.',
    category: 'passive',
    rarity: 'common',
    stat: 'attackSpeed',
    amount: 0.2,
    valueLabel: '+0.2 attacks/sec',
    isEligible: () => true,
  },
  {
    id: 'movement-speed-boost',
    name: 'Fleet Footed',
    description: 'Move faster through the arena.',
    category: 'passive',
    rarity: 'common',
    stat: 'movementSpeed',
    amount: 20,
    valueLabel: '+20 movement speed',
    isEligible: () => true,
  },
]

export function getUpgradeDefinition(upgradeId: UpgradeId): UpgradeDefinition {
  const definition = INITIAL_UPGRADES.find(
    (candidate) => candidate.id === upgradeId,
  )
  if (!definition) {
    throw new Error(`Unknown upgrade definition: ${upgradeId}`)
  }

  return definition
}
