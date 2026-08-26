import { getUpgradeDefinition } from '../../../content/upgrades/Upgrades'
import type { UpgradeId } from '../../../content/upgrades/Upgrades'
import type { GameState } from '../../state/GameState'

export function applyUpgrade(state: GameState, upgradeId: UpgradeId): void {
  const definition = getUpgradeDefinition(upgradeId)
  const player = state.player
  if (definition.stat) {
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

  if (definition.skillId && definition.skillAction) {
    const skill = player.skills.find(
      (candidate) => candidate.skillId === definition.skillId,
    )
    if (definition.skillAction === 'unlock') {
      if (!skill) {
        player.skills.push({
          skillId: definition.skillId,
          level: 1,
          cooldownRemaining: 0,
        })
      }
    } else if (skill) {
      skill.level += definition.amount
    }
  }
}
