import {
  getUpgradeDefinition,
  getUpgradeModifiers,
} from '../../../content/upgrades/Upgrades'
import type { UpgradeId } from '../../../content/upgrades/Upgrades'
import type { GameState } from '../../state/GameState'
import { refreshPlayerDerivedStats } from '../../stats/DerivedStats'

export function applyUpgrade(state: GameState, upgradeId: UpgradeId): void {
  const definition = getUpgradeDefinition(upgradeId)
  const player = state.player
  player.statModifiers ??= []
  player.statModifiers.push(...getUpgradeModifiers(definition))
  refreshPlayerDerivedStats(player)
  if (definition.meleeLeechAmount) {
    player.meleeLeech = (player.meleeLeech ?? 0) + definition.meleeLeechAmount
  }

  if (definition.dodgeReactionTimeReduction) {
    const dodge = player.dodge ??= {
      mode: 'autonomous',
      level: 1,
      reactionTime: 0.1,
      lastDirectionX: 0,
      lastDirectionY: 0,
    }
    dodge.level += 1
    dodge.reactionTime = Math.max(
      0,
      dodge.reactionTime - definition.dodgeReactionTimeReduction,
    )
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
