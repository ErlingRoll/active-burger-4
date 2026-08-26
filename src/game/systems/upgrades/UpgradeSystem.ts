import { getUpgradeDefinition } from '../../../content/upgrades/Upgrades'
import type { UpgradeId } from '../../../content/upgrades/Upgrades'
import type { GameState } from '../../state/GameState'

export function applyUpgrade(state: GameState, upgradeId: UpgradeId): void {
  const definition = getUpgradeDefinition(upgradeId)
  const player = state.player
  switch (definition.stat) {
    case 'attackDamage':
      player.attackDamage += definition.amount
      break
    case 'attackSpeed':
      player.attackSpeed += definition.amount
      break
    case 'movementSpeed':
      player.movementSpeed += definition.amount
      break
  }
}
