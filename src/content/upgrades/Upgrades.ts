import type { StatModifier, StatKey } from '../stats/Stats'
import type { SkillId } from '../skills/Skills'
import { INITIAL_UPGRADES } from '../../game-config/skill-upgrades'
import type { Rarity } from '../rarity/Rarity'

export const REMOVE_SKILL_UPGRADE_ID = 'remove-skill' as const
export type UpgradeId =
  | 'attack-speed-boost'
  | 'whirlwind-unlock'
  | 'chain-lightning-unlock'
  | 'basic-attack-level'
  | 'whirlwind-level'
  | 'chain-lightning-level'
  | 'fiery-touch-unlock'
  | 'fiery-touch-level'
  | 'fiery-touch-cooldown-reduction'
  | 'vitality-unlock'
  | 'vitality-level'
  | 'vitality-increased-healing'
  | 'raise-skeleton-unlock'
  | 'raise-skeleton-level'
  | 'raise-skeleton-max-count'
  | 'raise-skeleton-guardian'
  | 'whirlwind-leech'
  | 'whirlwind-frost'
  | 'whirlwind-guard'
  | 'magnet'
  | 'chain-lightning-frost'
  | 'chain-lightning-overload'
  | 'vitality-renewal'
  | 'vitality-last-stand'
  | 'basic-attack-barrage'
  | 'basic-attack-precision'
  | 'fiery-touch-ember'
  | 'glacial-orb-unlock'
  | 'glacial-orb-level'
  | 'glacial-orb-permafrost'
  | 'glacial-orb-ice-lance'
  | 'lancers-charge-unlock'
  | 'lancers-charge-level'
  | 'lancers-charge-vanguard'
  | 'lancers-charge-impaler'
  | 'rallying-standard-unlock'
  | 'rallying-standard-level'
  | 'rallying-standard-commander'
  | 'rallying-standard-bulwark'
  | 'gravity-well-unlock'
  | 'gravity-well-level'
  | 'gravity-well-singularity'
  | 'gravity-well-event-horizon'
  | 'aegis-pulse-unlock'
  | 'aegis-pulse-level'
  | 'aegis-pulse-bulwark'
  | 'aegis-pulse-reprisal'
  | typeof REMOVE_SKILL_UPGRADE_ID
export type UpgradeCategory = 'passive' | 'skill'
export type UpgradeRarity = Rarity
export type UpgradeStat = Extract<
  StatKey,
  'attackDamage' | 'attackSpeed' | 'attackRange'
>
export type SkillUpgradeAction = 'unlock' | 'level'
export type UpgradeBranch =
  | 'vitality-renewal'
  | 'vitality-last-stand'
  | 'whirlwind-control'
  | 'whirlwind-guard'
  | 'chain-lightning-frost'
  | 'chain-lightning-overload'
  | 'raise-skeleton-horde'
  | 'raise-skeleton-guardian'
  | 'fiery-touch-frequency'
  | 'fiery-touch-ember'
  | 'basic-attack-barrage'
  | 'basic-attack-precision'
  | 'glacial-orb-permafrost'
  | 'glacial-orb-ice-lance'
  | 'lancers-charge-vanguard'
  | 'lancers-charge-impaler'
  | 'rallying-standard-commander'
  | 'rallying-standard-bulwark'
  | 'gravity-well-singularity'
  | 'gravity-well-event-horizon'
  | 'aegis-pulse-bulwark'
  | 'aegis-pulse-reprisal'

export interface UpgradeChoice {
  upgradeId: Exclude<UpgradeId, typeof REMOVE_SKILL_UPGRADE_ID>
  rarity: UpgradeRarity
}

export interface SkillRemovalChoice {
  upgradeId: typeof REMOVE_SKILL_UPGRADE_ID
  skillId: SkillId
  rarity: UpgradeRarity
}

export type LevelUpUpgradeChoice = UpgradeChoice | SkillRemovalChoice

export interface UpgradeEligibilityState {
  playerLevel: number
  selectedUpgradeIds: readonly UpgradeId[]
  ownedSkillIds: readonly SkillId[]
  skillLevels: Readonly<Record<string, number>>
  skillSlotCount: number
}

export interface UpgradeDefinition {
  id: UpgradeId
  name: string
  description: string
  category: UpgradeCategory
  rarity: UpgradeRarity
  stat?: UpgradeStat
  amount: number
  /** Optional explicit modifiers for passive content and future scaling. */
  modifiers?: readonly StatModifier[]
  valueLabel: string
  skillId?: SkillId
  skillAction?: SkillUpgradeAction
  branch?: UpgradeBranch
  isEligible: (state: Readonly<UpgradeEligibilityState>) => boolean
  whirlwindLeechAmount?: number
  /** Additive pickup collection range increase per rank, expressed as a percent. */
  pickupCollectionRangeIncreasePercent?: number
  /** Percentage added to the skill's damage increase pool per rank. */
  skillDamageIncreasePercent?: number
  /** Flat healing added to the skill's cast amount per rank. */
  skillHealingIncreaseAmount?: number
  /** Percentage added to all healing received per rank. */
  increasedHealingPercent?: number
  /** Number of additional persistent summons allowed per rank. */
  summonMaxCountIncrease?: number
  /** Percentage-point cooldown reduction added for one skill per rank. */
  skillCooldownReductionPercent?: number
  /** Percentage of max HP added to each Vitality cast. */
  vitalityMaxHpHealingPercent?: number
  /** Multiplier applied to Vitality healing while critically injured. */
  vitalityLowHpHealingMultiplier?: number
  /** Damage reduction while critically injured after choosing Last Stand. */
  vitalityLowHpDamageReductionPercent?: number
  /** Number of Chill stacks applied by a Whirlwind hit. */
  whirlwindFrostStacks?: number
  /** Damage reduction while Whirlwind Guard is active. */
  whirlwindGuardDamageReductionPercent?: number
  /** Enables Frost application on Chain Lightning hits. */
  chainLightningFrost?: boolean
  /** Enables Shock stacking and overload detonations. */
  chainLightningOverload?: boolean
  /** Percentage bonus applied only to Fiery Touch damage. */
  fieryTouchDamageIncreasePercent?: number
  /** Flat max HP bonus applied to each skeleton. */
  summonMaxHpIncrease?: number
  /** Additional Chill stacks applied by a Glacial Orb explosion. */
  glacialOrbFrostStacks?: number
  /** Enables single-target Ice Lance mode for Glacial Orb. */
  glacialOrbIceLance?: boolean
  /** Damage bonus vs Chilled/Frozen targets after choosing Ice Lance. */
  glacialOrbIceLanceDamageIncreasePercent?: number
  /** Enables the Vanguard Momentum/single-target bonus for Lancer's Charge. */
  lancersChargeVanguard?: boolean
  /** Enables the wider, weaker Impaler corridor for Lancer's Charge. */
  lancersChargeImpaler?: boolean
  /** Enables the Commander cooldown-reduction banner for Rallying Banner. */
  rallyingStandardCommander?: boolean
  /** Enables the stronger, longer Bulwark banner for Rallying Banner. */
  rallyingStandardBulwark?: boolean
  /** Enables the bigger pull and Chill application for Gravity Well. */
  gravityWellSingularity?: boolean
  /** Enables the pull-free, higher-damage mode for Gravity Well. */
  gravityWellEventHorizon?: boolean
  /** Enables the bigger, longer-lasting shield for Aegis Pulse. */
  aegisPulseBulwark?: boolean
  /** Enables the retaliation burst when Aegis Pulse's shield absorbs damage. */
  aegisPulseReprisal?: boolean
}

export { INITIAL_UPGRADES } from '../../game-config/skill-upgrades'

export function getUpgradeDefinition(upgradeId: UpgradeId): UpgradeDefinition {
  if (upgradeId === REMOVE_SKILL_UPGRADE_ID) {
    return {
      id: REMOVE_SKILL_UPGRADE_ID,
      name: 'Release Skill',
      description: 'Remove an acquired skill and lose all upgrades for it.',
      category: 'skill',
      rarity: 'rare',
      amount: 1,
      valueLabel: 'Remove skill',
      isEligible: () => false,
    }
  }
  const definition = INITIAL_UPGRADES.find(
    (candidate) => candidate.id === upgradeId,
  )
  if (!definition) {
    throw new Error(`Unknown upgrade definition: ${upgradeId}`)
  }

  return definition
}

export function getUpgradeModifiers(
  definition: UpgradeDefinition,
): readonly StatModifier[] {
  if (definition.modifiers) {
    return definition.modifiers
  }
  if (!definition.stat) {
    return []
  }
  return [{
    stat: definition.stat,
    operation: 'add',
    value: definition.amount,
    sourceId: `upgrade:${definition.id}`,
  }]
}

export function getSkillDamageIncreasePercent(
  skillId: SkillId,
  level: number,
): number {
  const levelUpgrade = INITIAL_UPGRADES.find(
    (upgrade) =>
      upgrade.skillId === skillId && upgrade.skillAction === 'level',
  )
  return Math.max(0, level - 1) *
    Math.max(0, levelUpgrade?.skillDamageIncreasePercent ?? 0)
}

export function getSkillCooldownReductionPercent(
  skillId: SkillId,
  selectedUpgradeIds: readonly UpgradeId[],
): number {
  const upgrade = INITIAL_UPGRADES.find(
    (candidate) =>
      candidate.skillId === skillId &&
      candidate.skillCooldownReductionPercent !== undefined,
  )
  if (!upgrade?.skillCooldownReductionPercent) {
    return 0
  }
  return selectedUpgradeIds.filter((upgradeId) => upgradeId === upgrade.id).length *
    upgrade.skillCooldownReductionPercent
}
