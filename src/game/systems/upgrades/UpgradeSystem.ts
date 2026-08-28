import {
  getUpgradeDefinition,
  getUpgradeModifiers,
  INITIAL_UPGRADES,
  REMOVE_SKILL_UPGRADE_ID,
} from '../../../content/upgrades/Upgrades'
import type { SkillId } from '../../../content/skills/Skills'
import {
  BASIC_ATTACK_SKILL_ID,
  WHIRLWIND_SKILL_ID,
} from '../../../content/skills/Skills'
import { DEFAULT_SKILL_SLOT_COUNT } from '../../../game-config/skills'
import type { UpgradeId } from '../../../content/upgrades/Upgrades'
import type { GameState } from '../../state/GameState'
import { refreshMeleeLeech } from '../../equipment/EquipmentState'
import { refreshPlayerDerivedStats } from '../../stats/DerivedStats'

export function applyUpgrade(
  state: GameState,
  upgradeId: UpgradeId,
  skillId?: SkillId,
): void {
  if (upgradeId === REMOVE_SKILL_UPGRADE_ID) {
    if (!skillId || skillId === BASIC_ATTACK_SKILL_ID) {
      throw new Error('Skill removal requires a non-basic skill.')
    }
    removeSkill(state, skillId)
    return
  }
  const definition = getUpgradeDefinition(upgradeId)
  const player = state.player
  const skill = definition.skillId
    ? player.skills.find((candidate) => candidate.skillId === definition.skillId)
    : undefined
  if (
    definition.skillAction === 'unlock' &&
    definition.skillId &&
    !skill &&
    player.skills.length >= getSkillSlotCount(player)
  ) {
    return
  }
  player.statModifiers ??= []
  player.statModifiers.push(...getUpgradeModifiers(definition))
  refreshPlayerDerivedStats(player)
  if (definition.whirlwindLeechAmount) {
    player.upgradeWhirlwindLeech =
      (player.upgradeWhirlwindLeech ?? 0) + definition.whirlwindLeechAmount
    refreshMeleeLeech(player)
  }
  if (definition.pickupCollectionRangeIncreasePercent) {
    const currentMultiplier = player.pickupCollectionRangeMultiplier
    player.pickupCollectionRangeMultiplier =
      (currentMultiplier !== undefined && Number.isFinite(currentMultiplier)
        ? currentMultiplier
        : 1) +
      definition.pickupCollectionRangeIncreasePercent / 100
  }

  if (definition.skillId && definition.skillAction) {
    if (definition.skillAction === 'unlock') {
      const slotCount = getSkillSlotCount(player)
      if (!skill && player.skills.length < slotCount) {
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

function getSkillSlotCount(state: GameState['player']): number {
  const configuredCount = state.skillSlotCount
  return typeof configuredCount === 'number' && Number.isFinite(configuredCount)
    ? Math.max(1, Math.floor(configuredCount))
    : DEFAULT_SKILL_SLOT_COUNT
}

function removeSkill(state: GameState, skillId: SkillId): void {
  const skillIndex = state.player.skills.findIndex(
    (skill) => skill.skillId === skillId,
  )
  if (skillIndex < 0) {
    throw new Error(`Cannot remove skill that is not equipped: ${skillId}`)
  }

  const removedUpgradeIds = new Set(
    INITIAL_UPGRADES
      .filter((upgrade) => upgrade.skillId === skillId)
      .map((upgrade) => upgrade.id),
  )
  const removedUpgradeSources = new Set(
    [...removedUpgradeIds].map((upgradeId) => `upgrade:${upgradeId}`),
  )
  state.run.selectedUpgradeIds = state.run.selectedUpgradeIds.filter(
    (upgradeId) => !removedUpgradeIds.has(upgradeId),
  )
  state.player.statModifiers = (state.player.statModifiers ?? []).filter(
    (modifier) => !removedUpgradeSources.has(modifier.sourceId),
  )
  state.player.skills.splice(skillIndex, 1)
  if (skillId === WHIRLWIND_SKILL_ID) {
    state.player.upgradeWhirlwindLeech = 0
  }
  refreshPlayerDerivedStats(state.player)
  refreshMeleeLeech(state.player)
}
