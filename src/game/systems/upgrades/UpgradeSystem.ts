import {
  getUpgradeDefinition,
  getUpgradeModifiers,
  INITIAL_UPGRADES,
  REMOVE_SKILL_UPGRADE_ID,
  isSynergyUpgradeId,
  REMOVE_SYNERGY_UPGRADE_ID,
} from '../../../content/upgrades/Upgrades'
import type { SkillId } from '../../../content/skills/Skills'
import {
  BASIC_ATTACK_SKILL_ID,
  CHAIN_LIGHTNING_SKILL_ID,
  FIERY_TOUCH_SKILL_ID,
  RAISE_SKELETON_SKILL_ID,
  VITALITY_SKILL_ID,
  WHIRLWIND_SKILL_ID,
  LANCERS_CHARGE_SKILL_ID,
  RALLYING_BANNER_SKILL_ID,
  AEGIS_PULSE_SKILL_ID,
  GRAVITY_WELL_SKILL_ID,
  RIFT_JAVELIN_SKILL_ID,
  CINDER_MINE_SKILL_ID,
  SOUL_TETHER_SKILL_ID,
  PHANTOM_ARSENAL_SKILL_ID,
  SIGIL_OF_RUIN_SKILL_ID,
  MIRRORCAST_SKILL_ID,
  CRITICAL_SPELLSTRIKE_SKILL_ID,
  BLOOD_RITE_SKILL_ID,
  PRISM_HALO_SKILL_ID,
} from '../../../content/skills/Skills'
import { DEFAULT_SKILL_SLOT_COUNT } from '../../../game-config/skills'
import { getSkillDefinition } from '../../../content/skills/Skills'
import type { UpgradeId } from '../../../content/upgrades/Upgrades'
import type { GameState } from '../../state/GameState'
import { refreshMeleeLeech } from '../../equipment/EquipmentState'
import { refreshPlayerDerivedStats } from '../../stats/DerivedStats'

export function applyUpgrade(
  state: GameState,
  upgradeId: UpgradeId,
  skillId?: SkillId,
  synergyId?: UpgradeId,
): void {
  if (upgradeId === REMOVE_SKILL_UPGRADE_ID) {
    if (!skillId || skillId === BASIC_ATTACK_SKILL_ID) {
      throw new Error('Skill removal requires a non-basic skill.')
    }
    removeSkill(state, skillId)
    return
  }
  if (upgradeId === REMOVE_SYNERGY_UPGRADE_ID) {
    removeSynergy(state, synergyId)
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
  if (definition.vitalityMaxHpHealingPercent) {
    player.vitalityMaxHpHealingPercent =
      (player.vitalityMaxHpHealingPercent ?? 0) +
      definition.vitalityMaxHpHealingPercent
  }
  if (definition.vitalityLowHpHealingMultiplier) {
    player.vitalityLowHpHealingMultiplier =
      Math.max(
        player.vitalityLowHpHealingMultiplier ?? 1,
        definition.vitalityLowHpHealingMultiplier,
      )
  }
  if (definition.vitalityLowHpDamageReductionPercent) {
    player.vitalityLowHpDamageReductionPercent =
      (player.vitalityLowHpDamageReductionPercent ?? 0) +
      definition.vitalityLowHpDamageReductionPercent
  }
  if (definition.whirlwindGuardDamageReductionPercent) {
    player.whirlwindGuardDamageReductionPercent =
      (player.whirlwindGuardDamageReductionPercent ?? 0) +
      definition.whirlwindGuardDamageReductionPercent
  }
  if (definition.fieryTouchDamageIncreasePercent) {
    player.fieryTouchDamageIncreasePercent =
      (player.fieryTouchDamageIncreasePercent ?? 0) +
      definition.fieryTouchDamageIncreasePercent
  }
  if (definition.increasedHealingPercent) {
    player.increasedHealing =
      (player.increasedHealing ?? 0) + definition.increasedHealingPercent
  }
  if (definition.summonMaxCountIncrease) {
    player.skeletonMaxCountBonus =
      (player.skeletonMaxCountBonus ?? 0) + definition.summonMaxCountIncrease
  }
  if (definition.summonMaxHpIncrease) {
    player.skeletonMaxHpBonus =
      (player.skeletonMaxHpBonus ?? 0) + definition.summonMaxHpIncrease
    for (const summon of state.summons) {
      summon.maxHp += definition.summonMaxHpIncrease
      summon.hp = Math.min(
        summon.maxHp,
        summon.hp + definition.summonMaxHpIncrease,
      )
    }
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
          resonanceAttackCount: 0,
        })
        const unlockedSkill = definition.skillId
        if (
          unlockedSkill === CRITICAL_SPELLSTRIKE_SKILL_ID &&
          player.criticalSpellstrikeTargetSkillId === undefined
        ) {
          player.criticalSpellstrikeTargetSkillId = player.skills.find(
            (candidate) =>
              getSkillDefinition(candidate.skillId).tags.includes('triggerable'),
          )?.skillId
        } else if (
          player.skills.some((candidate) =>
            candidate.skillId === CRITICAL_SPELLSTRIKE_SKILL_ID,
          ) &&
          player.criticalSpellstrikeTargetSkillId === undefined &&
          getSkillDefinition(unlockedSkill).tags.includes('triggerable')
        ) {
          player.criticalSpellstrikeTargetSkillId = unlockedSkill
        }
        refreshPlayerDerivedStats(player)
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
      .filter((upgrade) =>
        upgrade.skillId === skillId ||
        upgrade.synergySkillIds?.includes(skillId) === true,
      )
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
  if (
    state.player.mirrorcastTargetSkillId === skillId ||
    skillId === MIRRORCAST_SKILL_ID
  ) {
    state.player.mirrorcastTargetSkillId = undefined
  }
  if (
    state.player.criticalSpellstrikeTargetSkillId === skillId ||
    skillId === CRITICAL_SPELLSTRIKE_SKILL_ID
  ) {
    state.player.criticalSpellstrikeTargetSkillId = undefined
  }
  if (
    state.player.bloodRiteTargetSkillId === skillId ||
    skillId === BLOOD_RITE_SKILL_ID
  ) {
    state.player.bloodRiteTargetSkillId = undefined
  }
  if (skillId === WHIRLWIND_SKILL_ID) {
    state.player.upgradeWhirlwindLeech = 0
    state.player.whirlwindGuardRemaining = 0
    state.player.whirlwindGuardDamageReductionPercent = 0
    state.player.lancerMomentumStacks = 0
    state.player.lancerMomentumDecayRemaining = 0
  }
  if (skillId === FIERY_TOUCH_SKILL_ID) {
    state.player.fieryTouchDamageIncreasePercent = 0
  }
  if (skillId === VITALITY_SKILL_ID) {
    state.player.increasedHealing = 0
    state.player.vitalityMaxHpHealingPercent = 0
    state.player.vitalityLowHpHealingMultiplier = 1
    state.player.vitalityLowHpDamageReductionPercent = 0
    state.player.soulTetherVitalityCharge = 0
  }
  if (skillId === CHAIN_LIGHTNING_SKILL_ID) {
    state.player.chainLightningBonusTargets = 0
  }
  if (skillId === FIERY_TOUCH_SKILL_ID) {
    state.player.fieryTouchGravityPrimed = false
  }
  if (skillId === RAISE_SKELETON_SKILL_ID) {
    state.player.skeletonMaxCountBonus = 0
    state.player.skeletonMaxHpBonus = 0
    for (const enemy of [...state.enemies, ...(state.bosses ?? [])]) {
      enemy.poisonStacks = enemy.poisonStacks?.filter(
        (stack) => stack.sourceSkillId !== RAISE_SKELETON_SKILL_ID,
      )
    }
  }
  if (skillId === LANCERS_CHARGE_SKILL_ID) {
    state.player.lancerMomentumStacks = 0
    state.player.lancerMomentumDecayRemaining = 0
  }
  if (skillId === RALLYING_BANNER_SKILL_ID) {
    state.player.rallyingBannerRemaining = 0
    state.player.rallyingBannerDamageReductionPercent = 0
    state.player.rallyingBannerCooldownReductionPercent = 0
    state.effects = state.effects.filter(
      (effect) => effect.skillId !== RALLYING_BANNER_SKILL_ID,
    )
  }
  if (skillId === AEGIS_PULSE_SKILL_ID) {
    state.player.aegisPulseShieldAmount = 0
    state.player.aegisPulseShieldMaxAmount = 0
    state.player.aegisPulseShieldRemaining = 0
    state.player.aegisPulseShieldDuration = 0
  }
  if (skillId === SOUL_TETHER_SKILL_ID) {
    state.player.soulTethers = []
    state.player.soulTetherVitalityCharge = 0
  }
  if (skillId === RIFT_JAVELIN_SKILL_ID) {
    state.player.riftJavelinReturnBonusPercent = 0
    for (const enemy of [...state.enemies, ...(state.bosses ?? [])]) {
      enemy.poisonStacks = enemy.poisonStacks?.filter(
        (stack) => stack.sourceSkillId !== RIFT_JAVELIN_SKILL_ID,
      )
    }
  }
  if (skillId === CINDER_MINE_SKILL_ID) {
    for (const enemy of [...state.enemies, ...(state.bosses ?? [])]) {
      enemy.burningStacks = enemy.burningStacks?.filter(
        (stack) => stack.sourceSkillId !== CINDER_MINE_SKILL_ID,
      )
    }
  }
  if (skillId === GRAVITY_WELL_SKILL_ID) {
    state.player.chainLightningBonusTargets = 0
    state.player.fieryTouchGravityPrimed = false
  }
  if (skillId === PHANTOM_ARSENAL_SKILL_ID) {
    state.player.phantomMaxCountBonus = 0
    state.player.phantomMaxHpBonus = 0
    state.player.riftJavelinReturnBonusPercent = 0
  }
  if (skillId === SIGIL_OF_RUIN_SKILL_ID) {
    state.player.ruinSigils = []
  }
  if (skillId === MIRRORCAST_SKILL_ID) {
    state.player.mirrorcast = undefined
  }
  if (skillId === BLOOD_RITE_SKILL_ID) {
    state.player.bloodDebt = undefined
  }
  if (skillId === PRISM_HALO_SKILL_ID) {
    state.player.prismHalo = undefined
    state.player.prismConvergence = []
  }
  state.summons = state.summons.filter(
    (summon) => (summon.skillId ?? RAISE_SKELETON_SKILL_ID) !== skillId,
  )
  state.traps = (state.traps ?? []).filter((trap) => trap.skillId !== skillId)
  state.relays = (state.relays ?? []).filter((relay) => relay.skillId !== skillId)
  state.wires = (state.wires ?? []).filter((wire) => wire.skillId !== skillId)
  refreshPlayerDerivedStats(state.player)
  refreshMeleeLeech(state.player)
}

function removeSynergy(
  state: GameState,
  synergyId: UpgradeId | undefined,
): void {
  if (
    synergyId === undefined ||
    !isSynergyUpgradeId(synergyId) ||
    !state.run.selectedUpgradeIds.includes(synergyId)
  ) {
    throw new Error(`Cannot remove inactive synergy: ${String(synergyId)}`)
  }
  state.run.selectedUpgradeIds = state.run.selectedUpgradeIds.filter(
    (upgradeId) => upgradeId !== synergyId,
  )
}
