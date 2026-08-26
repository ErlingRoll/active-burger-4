import {
  xpRequiredForLevel,
  xpRequiredForNextLevel,
} from '../../content/progression/XpBalance'
import {
  EQUIPMENT_SLOTS,
  getItemDefinition,
  type EquipmentSlot,
} from '../../content/gear/Items'
import type { StatKey } from '../../content/stats/Stats'
import type { Rarity } from '../../content/rarity/Rarity'
import {
  getSkillDefinition,
  getSkillDamage,
  isSkillId,
  type SkillId,
} from '../../content/skills/Skills'
import {
  INITIAL_UPGRADES,
  type UpgradeId,
} from '../../content/upgrades/Upgrades'
import type { GameState } from '../state/GameState'
import type { RunPhase } from '../state/RunPhase'
import { getDerivedPlayerStats } from '../stats/DerivedStats'

/** Narrow, immutable run data intended for screen-space UI consumers. */
export interface RunHudSnapshot {
  readonly phase: RunPhase
  readonly hp: number
  readonly maxHp: number
  readonly level: number
  readonly xp: number
  readonly xpRequired: number
  readonly xpProgress: number
  readonly elapsedTime: number
  readonly killCount: number
}

export type SkillUpgradeStatus = 'acquired' | 'available' | 'unavailable'

export interface SkillUpgradeSnapshot {
  readonly upgradeId: UpgradeId
  readonly name: string
  readonly description: string
  readonly valueLabel: string
  readonly relevant: true
  readonly status: SkillUpgradeStatus
}

export interface SkillHudSnapshot {
  readonly skillId: SkillId
  readonly name: string
  readonly icon: string
  readonly level: number
  readonly description: string
  readonly estimatedSingleTargetDps: number | null
  readonly dpsAssumption: string
  /** Gear modifiers that affect this skill in the current combat systems. */
  readonly gearModifiers: readonly GearModifierSnapshot[]
  readonly upgrades: readonly SkillUpgradeSnapshot[]
}

export interface GameUiSnapshot extends RunHudSnapshot {
  readonly skills: readonly SkillHudSnapshot[]
  readonly equipment: Readonly<
    Partial<Record<EquipmentSlot, EquippedItemSnapshot>>
  >
}

export interface EquippedItemSnapshot {
  readonly itemId: string
  readonly name: string
  readonly slot: EquipmentSlot
  readonly rarity: Rarity
  readonly modifiers: readonly GearModifierSnapshot[]
}

export interface GearModifierSnapshot {
  readonly stat: StatKey
  readonly operation: 'add' | 'multiply'
  readonly value: number
  readonly sourceId: string
}

/** Immutable data retained by the results screen after a run ends. */
export interface RunResultSnapshot {
  readonly phase: RunPhase
  readonly elapsedTime: number
  readonly level: number
  readonly xp: number
  readonly killCount: number
}

export function createUiSnapshot(state: GameState): GameUiSnapshot {
  const playerStats = getDerivedPlayerStats(state.player)
  const currentThreshold = xpRequiredForLevel(state.player.level)
  const xpRequired = xpRequiredForNextLevel(state.player.level)
  const thresholdSpan = Math.max(1, xpRequired - currentThreshold)
  const xpProgress = Math.min(
    1,
    Math.max(
      0,
      (state.player.xp - currentThreshold) / thresholdSpan,
    ),
  )

  const eligibilityState = {
    playerLevel: state.player.level,
    selectedUpgradeIds: state.run.selectedUpgradeIds,
    ownedSkillIds: state.player.skills
      .map((skill) => skill.skillId)
      .filter(isSkillId),
    skillLevels: Object.fromEntries(
      state.player.skills.map((skill) => [skill.skillId, skill.level]),
    ),
  }
  const skills = state.player.skills.flatMap((skill) => {
    if (!isSkillId(skill.skillId)) {
      return []
    }
    const definition = getSkillDefinition(skill.skillId)
    const isBasicBolt = skill.skillId === 'basic-bolt'
    const cooldown = isBasicBolt
      ? playerStats.attackSpeed > 0
        ? 1 / playerStats.attackSpeed
        : Number.POSITIVE_INFINITY
      : definition.cooldown
    const damage = isBasicBolt
      ? playerStats.attackDamage +
        getSkillDamage(definition, skill.level) -
        definition.baseDamage
      : getSkillDamage(definition, skill.level)
    const estimatedSingleTargetDps =
      Number.isFinite(cooldown) && cooldown > 0
        ? damage / cooldown
        : null
    const applicableGearStats =
      isBasicBolt
        ? new Set<StatKey>(['attackDamage', 'attackSpeed', 'attackRange'])
        : new Set<StatKey>()
    const gearModifiers = EQUIPMENT_SLOTS.flatMap((slot) => {
      const equipped = state.player.equipment?.[slot]
      if (!equipped) {
        return []
      }
      const definition = getItemDefinition(equipped.itemId)
      return (equipped.modifiers ?? definition.modifiers)
        .filter((modifier) => applicableGearStats.has(modifier.stat))
        .map((modifier) => Object.freeze({ ...modifier }))
    })
    const upgrades = INITIAL_UPGRADES.filter(
      (upgrade) => upgrade.skillId === skill.skillId,
    ).map((upgrade) => {
      const acquired =
        state.run.selectedUpgradeIds.includes(upgrade.id) ||
        (upgrade.skillAction === 'unlock' &&
          state.player.skills.some((candidate) => candidate.skillId === skill.skillId))
      const available = !acquired && upgrade.isEligible(eligibilityState)
      return Object.freeze({
        upgradeId: upgrade.id,
        name: upgrade.name,
        description: upgrade.description,
        valueLabel: upgrade.valueLabel,
        relevant: true as const,
        status: acquired
          ? ('acquired' as const)
          : available
            ? ('available' as const)
            : ('unavailable' as const),
      })
    })

    return [Object.freeze({
      skillId: skill.skillId,
      name: definition.name,
      icon: definition.visual.icon,
      level: skill.level,
      description: definition.description,
      estimatedSingleTargetDps,
      dpsAssumption: isBasicBolt
        ? 'One target sustained at the current Basic Bolt attack cadence.'
        : skill.skillId === 'whirlwind'
          ? 'One target in Whirlwind range, sustained over its cooldown.'
          : 'Primary target sustained over Chain Lightning cooldown.',
      gearModifiers: Object.freeze(gearModifiers),
      upgrades: Object.freeze(upgrades),
    })]
  })

  const equipment = Object.fromEntries(
    EQUIPMENT_SLOTS.flatMap((slot) => {
      const equipped = state.player.equipment?.[slot]
      if (!equipped) {
        return []
      }
      const definition = getItemDefinition(equipped.itemId)
      const modifiers = Object.freeze(
        (equipped.modifiers ?? definition.modifiers).map((modifier) =>
          Object.freeze({ ...modifier }),
        ),
      )
      return [[slot, Object.freeze({
        itemId: equipped.itemId,
        name: definition.name,
        slot: definition.slot,
        rarity: equipped.rarity ?? definition.rarity,
        modifiers,
      })]]
    }),
  )

  return Object.freeze({
    phase: state.run.phase,
    hp: state.player.hp,
    maxHp: playerStats.maxHp,
    level: state.player.level,
    xp: state.player.xp,
    xpRequired,
    xpProgress,
    elapsedTime: state.time,
    killCount: state.run.killCount,
    skills: Object.freeze(skills),
    equipment: Object.freeze(equipment),
  })
}

export function createRunResultSnapshot(
  state: GameState,
): RunResultSnapshot {
  return Object.freeze({
    phase: state.run.phase,
    elapsedTime: state.time,
    level: state.player.level,
    xp: state.player.xp,
    killCount: state.run.killCount,
  })
}
