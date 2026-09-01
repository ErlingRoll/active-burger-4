import type { StatModifier, StatKey } from '../stats/Stats'
import type { SkillId } from '../skills/Skills'
import type { KeywordId } from '../glossary/Keywords'
import { INITIAL_UPGRADES } from '../../game-config/skill-upgrades'
import { Rarity, type Rarity as RarityValue } from '../rarity/Rarity'
import {
  getSkillSynergyEffectPercent,
  SYNERGY_UPGRADES,
} from '../../game-config/synergies'

export const REMOVE_SKILL_UPGRADE_ID = 'remove-skill' as const
export const REMOVE_SYNERGY_UPGRADE_ID = 'remove-synergy' as const
export type UpgradeId =
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
  | 'raise-skeleton-legion'
  | 'raise-skeleton-rotting-bones'
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
  | 'rallying-banner-unlock'
  | 'rallying-banner-level'
  | 'rallying-banner-commander'
  | 'rallying-banner-bulwark'
  | 'gravity-well-unlock'
  | 'gravity-well-level'
  | 'gravity-well-singularity'
  | 'gravity-well-event-horizon'
  | 'aegis-pulse-unlock'
  | 'aegis-pulse-level'
  | 'aegis-pulse-bulwark'
  | 'aegis-pulse-reprisal'
  | 'rift-javelin-unlock'
  | 'rift-javelin-level'
  | 'rift-javelin-barbed'
  | 'rift-javelin-homeward'
  | 'cinder-mine-unlock'
  | 'cinder-mine-level'
  | 'cinder-mine-inferno'
  | 'cinder-mine-cluster'
  | 'storm-relay-unlock'
  | 'storm-relay-level'
  | 'storm-relay-overcharge'
  | 'storm-relay-conduit'
  | 'soul-tether-unlock'
  | 'soul-tether-level'
  | 'soul-tether-siphon'
  | 'soul-tether-requiem'
  | 'phantom-arsenal-unlock'
  | 'phantom-arsenal-level'
  | 'phantom-arsenal-volley'
  | 'phantom-arsenal-marksman'
  | 'sigil-of-ruin-unlock'
  | 'sigil-of-ruin-level'
  | 'sigil-of-ruin-contagious-script'
  | 'sigil-of-ruin-execution-protocol'
  | 'mirrorcast-unlock'
  | 'mirrorcast-level'
  | 'mirrorcast-double-exposure'
  | 'mirrorcast-deferred-echo'
  | 'razorwire-unlock'
  | 'razorwire-level'
  | 'razorwire-tripwire-network'
  | 'razorwire-guillotine-line'
  | 'blood-rite-unlock'
  | 'blood-rite-level'
  | 'blood-rite-sanguine-pact'
  | 'blood-rite-crimson-debt'
  | 'prism-halo-unlock'
  | 'prism-halo-level'
  | 'prism-halo-chromatic-convergence'
  | 'prism-halo-refraction'
  | 'synergy-basic-attack-whirlwind'
  | 'synergy-basic-attack-chain-lightning'
  | 'synergy-basic-attack-glacial-orb'
  | 'synergy-basic-attack-vitality'
  | 'synergy-basic-attack-raise-skeleton'
  | 'synergy-basic-attack-fiery-touch'
  | 'synergy-basic-attack-lancers-charge'
  | 'synergy-basic-attack-rallying-banner'
  | 'synergy-basic-attack-gravity-well'
  | 'synergy-basic-attack-aegis-pulse'
  | 'synergy-basic-attack-rift-javelin'
  | 'synergy-basic-attack-cinder-mine'
  | 'synergy-basic-attack-storm-relay'
  | 'synergy-basic-attack-soul-tether'
  | 'synergy-basic-attack-phantom-arsenal'
  | 'synergy-basic-attack-sigil-of-ruin'
  | 'synergy-basic-attack-mirrorcast'
  | 'synergy-basic-attack-razorwire'
  | 'synergy-basic-attack-blood-rite'
  | 'synergy-basic-attack-prism-halo'
  | 'synergy-chain-lightning-sigil-of-ruin'
  | 'synergy-whirlwind-mirrorcast'
  | 'synergy-glacial-orb-razorwire'
  | 'synergy-vitality-rift-javelin'
  | 'synergy-raise-skeleton-cinder-mine'
  | 'synergy-fiery-touch-soul-tether'
  | 'synergy-lancers-charge-rallying-banner'
  | 'synergy-gravity-well-phantom-arsenal'
  | 'synergy-aegis-pulse-blood-rite'
  | 'synergy-storm-relay-prism-halo'
  | 'synergy-whirlwind-lancers-charge'
  | 'synergy-whirlwind-aegis-pulse'
  | 'synergy-chain-lightning-glacial-orb'
  | 'synergy-chain-lightning-gravity-well'
  | 'synergy-vitality-rallying-banner'
  | 'synergy-vitality-aegis-pulse'
  | 'synergy-raise-skeleton-rallying-banner'
  | 'synergy-raise-skeleton-gravity-well'
  | 'synergy-fiery-touch-glacial-orb'
  | 'synergy-fiery-touch-gravity-well'
  | 'synergy-lancers-charge-aegis-pulse'
  | 'synergy-rift-javelin-lancers-charge'
  | 'synergy-cinder-mine-fiery-touch'
  | 'synergy-soul-tether-vitality'
  | 'synergy-phantom-arsenal-raise-skeleton'
  | 'synergy-storm-relay-rallying-banner'
  | 'synergy-rift-javelin-cinder-mine'
  | 'synergy-cinder-mine-storm-relay'
  | 'synergy-storm-relay-soul-tether'
  | 'synergy-soul-tether-phantom-arsenal'
  | 'synergy-phantom-arsenal-rift-javelin'
  | 'synergy-sigil-of-ruin-prism-halo'
  | 'synergy-sigil-of-ruin-blood-rite'
  | 'synergy-mirrorcast-razorwire'
  | 'synergy-mirrorcast-prism-halo'
  | 'synergy-razorwire-blood-rite'
  | 'synergy-blood-rite-prism-halo'
  | typeof REMOVE_SKILL_UPGRADE_ID
  | typeof REMOVE_SYNERGY_UPGRADE_ID
export type UpgradeCategory = 'passive' | 'skill'
export type UpgradeRarity = RarityValue
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
  | 'basic-attack-barrage'
  | 'basic-attack-precision'
  | 'chain-lightning-frost'
  | 'chain-lightning-overload'
  | 'raise-skeleton-legion'
  | 'raise-skeleton-rotting-bones'
  | 'fiery-touch-frequency'
  | 'fiery-touch-ember'
  | 'glacial-orb-permafrost'
  | 'glacial-orb-ice-lance'
  | 'lancers-charge-vanguard'
  | 'lancers-charge-impaler'
  | 'rallying-banner-commander'
  | 'rallying-banner-bulwark'
  | 'gravity-well-singularity'
  | 'gravity-well-event-horizon'
  | 'aegis-pulse-bulwark'
  | 'aegis-pulse-reprisal'
  | 'rift-javelin-barbed'
  | 'rift-javelin-homeward'
  | 'cinder-mine-inferno'
  | 'cinder-mine-cluster'
  | 'storm-relay-overcharge'
  | 'storm-relay-conduit'
  | 'soul-tether-siphon'
  | 'soul-tether-requiem'
  | 'phantom-arsenal-volley'
  | 'phantom-arsenal-marksman'
  | 'sigil-of-ruin-contagious-script'
  | 'sigil-of-ruin-execution-protocol'
  | 'mirrorcast-double-exposure'
  | 'mirrorcast-deferred-echo'
  | 'razorwire-tripwire-network'
  | 'razorwire-guillotine-line'
  | 'blood-rite-sanguine-pact'
  | 'blood-rite-crimson-debt'
  | 'prism-halo-chromatic-convergence'
  | 'prism-halo-refraction'

export interface UpgradeChoice {
  upgradeId: Exclude<
    UpgradeId,
    typeof REMOVE_SKILL_UPGRADE_ID | typeof REMOVE_SYNERGY_UPGRADE_ID
  >
  rarity: UpgradeRarity
}

export interface SynergyEffect {
  skillId: SkillId
  damageIncreasePercent?: number
  healingIncreasePercent?: number
  shieldIncreasePercent?: number
}

export interface SkillRemovalChoice {
  upgradeId: typeof REMOVE_SKILL_UPGRADE_ID
  skillId: SkillId
  rarity: UpgradeRarity
}

export interface SynergyRemovalChoice {
  upgradeId: typeof REMOVE_SYNERGY_UPGRADE_ID
  synergyId: UpgradeId
  rarity: UpgradeRarity
}

export type LevelUpUpgradeChoice =
  | UpgradeChoice
  | SkillRemovalChoice
  | SynergyRemovalChoice

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
  repeatable?: boolean
  /** Optional explicit modifiers for passive content and future scaling. */
  modifiers?: readonly StatModifier[]
  valueLabel: string
  skillId?: SkillId
  skillAction?: SkillUpgradeAction
  branch?: UpgradeBranch
  /** Status or mechanic tags added or modified by a skill evolution. */
  evolutionTags?: readonly KeywordId[]
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
  /** Enables bounded attack-speed scaling from additional living skeletons. */
  skeletonLegion?: boolean
  /** Makes skeleton hits apply the Raise Skeleton Poison evolution. */
  skeletonRottingBones?: boolean
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
  rallyingBannerCommander?: boolean
  /** Enables the stronger, longer Bulwark banner for Rallying Banner. */
  rallyingBannerBulwark?: boolean
  /** Enables the bigger pull and Chill application for Gravity Well. */
  gravityWellSingularity?: boolean
  /** Enables the pull-free, higher-damage mode for Gravity Well. */
  gravityWellEventHorizon?: boolean
  /** Enables the bigger, longer-lasting shield for Aegis Pulse. */
  aegisPulseBulwark?: boolean
  /** Enables the retaliation burst when Aegis Pulse's shield absorbs damage. */
  aegisPulseReprisal?: boolean
  /** Applies a Bleed (Poison) stack from every Rift Javelin hit. */
  riftJavelinBarbed?: boolean
  /** Increases Rift Javelin damage while it travels back on its return leg. */
  riftJavelinHomeward?: boolean
  /** Enlarges Cinder Mine's blast and Burning intensity. */
  cinderMineInferno?: boolean
  /** Deploys a second, weaker Cinder Mine alongside the first. */
  cinderMineCluster?: boolean
  /** Strikes more often and applies extra Shock stacks for Storm Relay. */
  stormRelayOvercharge?: boolean
  /** Makes Storm Relay permanent and adds a periodic burst around it. */
  stormRelayConduit?: boolean
  /** Increases the fraction of Soul Tether damage restored as healing. */
  soulTetherSiphon?: boolean
  /** Lets Soul Tether's death snap burst chain to multiple nearby enemies. */
  soulTetherRequiem?: boolean
  /** Grants an additional active Phantom Arsenal summon at reduced damage. */
  phantomArsenalVolley?: boolean
  /** Grants Phantom Arsenal more range and damage at a single active summon. */
  phantomArsenalMarksman?: boolean
  /** Sigil of Ruin detonation spreads weaker sigils to nearby enemies. */
  sigilOfRuinContagiousScript?: boolean
  /** Sigil of Ruin waits for the target below 35% HP for a stronger finish. */
  sigilOfRuinExecutionProtocol?: boolean
  /** Mirrorcast arms two weaker Echoes instead of one. */
  mirrorcastDoubleExposure?: boolean
  /** Mirrorcast copies later but more accurately and retargets on kill. */
  mirrorcastDeferredEcho?: boolean
  /** Razorwire deploys several shorter wires with reduced per-wire damage. */
  razorwireTripwireNetwork?: boolean
  /** Razorwire strings one longer, narrower wire that builds and snaps Tension. */
  razorwireGuillotineLine?: boolean
  /** Part of Blood Rite empowered damage heals the player. */
  bloodRiteSanguinePact?: boolean
  /** Blood Rite stores two smaller Blood Debt charges. */
  bloodRiteCrimsonDebt?: boolean
  /** Prism Halo hitting a target with all three elements triggers Prism Burst. */
  prismHaloChromaticConvergence?: boolean
  /** Prism Halo impacts split into capped, reduced projectiles. */
  prismHaloRefraction?: boolean
  /** The two equipped skills required for this synergy card. */
  synergySkillIds?: readonly [SkillId, SkillId]
  /** Per-skill bonuses granted while this synergy is selected. */
  synergyEffects?: readonly SynergyEffect[]
}

export interface SynergyUpgradeDefinition extends UpgradeDefinition {
  synergySkillIds: readonly [SkillId, SkillId]
  synergyEffects: readonly SynergyEffect[]
}

export { INITIAL_UPGRADES } from '../../game-config/skill-upgrades'
export {
  SYNERGY_OFFER_CHANCE,
  SYNERGY_UPGRADES,
  getSynergyPartnerSkillIds,
  getSkillSynergyEffectPercent,
  isSynergyActive,
  isSkillSynergyActive,
  isSynergyPairEligible,
} from '../../game-config/synergies'

export function isSynergyUpgradeDefinition(
  upgrade: UpgradeDefinition,
): upgrade is SynergyUpgradeDefinition {
  return upgrade.synergySkillIds !== undefined &&
    upgrade.synergyEffects !== undefined
}

export function isSynergyUpgradeId(upgradeId: UpgradeId): boolean {
  return SYNERGY_UPGRADES.some((synergy) => synergy.id === upgradeId)
}

export function getUpgradeDefinition(upgradeId: UpgradeId): UpgradeDefinition {
  if (upgradeId === REMOVE_SKILL_UPGRADE_ID) {
    return {
      id: REMOVE_SKILL_UPGRADE_ID,
      name: 'Release Skill',
      description: 'Remove an acquired skill and lose all upgrades for it.',
      category: 'skill',
      rarity: Rarity.Rare,
      amount: 1,
      valueLabel: 'Remove skill',
      isEligible: () => false,
    }
  }
  if (upgradeId === REMOVE_SYNERGY_UPGRADE_ID) {
    return {
      id: REMOVE_SYNERGY_UPGRADE_ID,
      name: 'Release Synergy',
      description: 'Remove an active synergy and free both of its skill links.',
      category: 'skill',
      rarity: Rarity.Rare,
      amount: 1,
      valueLabel: 'Release synergy',
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
  selectedUpgradeIds: readonly UpgradeId[] = [],
): number {
  const levelUpgrade = INITIAL_UPGRADES.find(
    (upgrade) =>
      upgrade.skillId === skillId && upgrade.skillAction === 'level',
  )
  return Math.max(0, level - 1) *
    Math.max(0, levelUpgrade?.skillDamageIncreasePercent ?? 0) +
    getSkillSynergyEffectPercent(
      skillId,
      selectedUpgradeIds,
      'damageIncreasePercent',
    )
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
