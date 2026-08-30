import { Rarity } from '../content/rarity/Rarity'
import type {
  SynergyEffect,
  SynergyUpgradeDefinition,
  UpgradeEligibilityState,
  UpgradeId,
} from '../content/upgrades/Upgrades'
import type { SkillId } from '../content/skills/Skills'
import {
  AEGIS_PULSE_SKILL_ID,
  BASIC_ATTACK_SKILL_ID,
  CHAIN_LIGHTNING_SKILL_ID,
  FIERY_TOUCH_SKILL_ID,
  GLACIAL_ORB_SKILL_ID,
  GRAVITY_WELL_SKILL_ID,
  LANCERS_CHARGE_SKILL_ID,
  RAISE_SKELETON_SKILL_ID,
  RALLYING_STANDARD_SKILL_ID,
  VITALITY_SKILL_ID,
  WHIRLWIND_SKILL_ID,
} from './skills'

export const SYNERGY_OFFER_CHANCE = 0.1
export const SYNERGY_DEFAULT_RARITY = Rarity.Legendary

function hasActiveSynergyForSkill(
  skillId: SkillId,
  selectedUpgradeIds: readonly UpgradeId[],
): boolean {
  return SYNERGY_UPGRADES.some((synergy) =>
    selectedUpgradeIds.includes(synergy.id) &&
    synergy.synergySkillIds.includes(skillId)
  )
}

export function isSkillSynergyActive(
  skillId: SkillId,
  selectedUpgradeIds: readonly UpgradeId[],
): boolean {
  return hasActiveSynergyForSkill(skillId, selectedUpgradeIds)
}

export function isSynergyPairEligible(
  state: Pick<UpgradeEligibilityState, 'ownedSkillIds' | 'selectedUpgradeIds'>,
  skillIds: readonly [SkillId, SkillId],
): boolean {
  return skillIds.every((skillId) => state.ownedSkillIds.includes(skillId)) &&
    !skillIds.some((skillId) =>
      hasActiveSynergyForSkill(skillId, state.selectedUpgradeIds)
    )
}

export function getSkillSynergyEffectPercent(
  skillId: SkillId,
  selectedUpgradeIds: readonly UpgradeId[],
  effect: keyof Omit<SynergyEffect, 'skillId'>,
): number {
  return SYNERGY_UPGRADES
    .filter((synergy) => selectedUpgradeIds.includes(synergy.id))
    .flatMap((synergy) => synergy.synergyEffects)
    .filter((synergyEffect) => synergyEffect.skillId === skillId)
    .reduce(
      (total, synergyEffect) => total + (synergyEffect[effect] ?? 0),
      0,
    )
}

function createSynergyUpgrade(
  id: UpgradeId,
  name: string,
  description: string,
  valueLabel: string,
  skillIds: readonly [SkillId, SkillId],
  synergyEffects: readonly SynergyEffect[],
): SynergyUpgradeDefinition {
  return {
    id,
    name,
    description,
    category: 'skill',
    rarity: SYNERGY_DEFAULT_RARITY,
    amount: 1,
    valueLabel,
    synergySkillIds: skillIds,
    synergyEffects,
    isEligible: (state) => isSynergyPairEligible(state, skillIds),
  }
}

function damageEffects(
  skillIds: readonly [SkillId, SkillId],
  damageIncreasePercent: number,
): readonly SynergyEffect[] {
  return skillIds.map((skillId) => ({
    skillId,
    damageIncreasePercent,
  }))
}

export const SYNERGY_UPGRADES: readonly SynergyUpgradeDefinition[] = [
  createSynergyUpgrade(
    'synergy-basic-attack-whirlwind',
    'Close Quarters',
    'Basic Attack and Whirlwind deal 15% increased damage while both skills are equipped.',
    '+15% Basic Attack and Whirlwind damage',
    [BASIC_ATTACK_SKILL_ID, WHIRLWIND_SKILL_ID],
    damageEffects([BASIC_ATTACK_SKILL_ID, WHIRLWIND_SKILL_ID], 15),
  ),
  createSynergyUpgrade(
    'synergy-basic-attack-chain-lightning',
    'Static Arsenal',
    'Basic Attack and Chain Lightning deal 15% increased damage while both skills are equipped.',
    '+15% Basic Attack and Chain Lightning damage',
    [BASIC_ATTACK_SKILL_ID, CHAIN_LIGHTNING_SKILL_ID],
    damageEffects([BASIC_ATTACK_SKILL_ID, CHAIN_LIGHTNING_SKILL_ID], 15),
  ),
  createSynergyUpgrade(
    'synergy-basic-attack-glacial-orb',
    'Frosted Ammunition',
    'Basic Attack and Glacial Orb deal 15% increased damage while both skills are equipped.',
    '+15% Basic Attack and Glacial Orb damage',
    [BASIC_ATTACK_SKILL_ID, GLACIAL_ORB_SKILL_ID],
    damageEffects([BASIC_ATTACK_SKILL_ID, GLACIAL_ORB_SKILL_ID], 15),
  ),
  createSynergyUpgrade(
    'synergy-whirlwind-lancers-charge',
    'Cyclone Momentum',
    'Whirlwind and Lancer\'s Charge deal 18% increased damage while both skills are equipped.',
    '+18% Whirlwind and Lancer\'s Charge damage',
    [WHIRLWIND_SKILL_ID, LANCERS_CHARGE_SKILL_ID],
    damageEffects([WHIRLWIND_SKILL_ID, LANCERS_CHARGE_SKILL_ID], 18),
  ),
  createSynergyUpgrade(
    'synergy-whirlwind-aegis-pulse',
    'Tempest Bastion',
    'Whirlwind and Aegis Pulse deal 18% increased damage while both skills are equipped.',
    '+18% Whirlwind and Aegis Pulse damage',
    [WHIRLWIND_SKILL_ID, AEGIS_PULSE_SKILL_ID],
    damageEffects([WHIRLWIND_SKILL_ID, AEGIS_PULSE_SKILL_ID], 18),
  ),
  createSynergyUpgrade(
    'synergy-chain-lightning-glacial-orb',
    'Stormfrost',
    'Chain Lightning and Glacial Orb deal 18% increased damage while both skills are equipped.',
    '+18% Chain Lightning and Glacial Orb damage',
    [CHAIN_LIGHTNING_SKILL_ID, GLACIAL_ORB_SKILL_ID],
    damageEffects([CHAIN_LIGHTNING_SKILL_ID, GLACIAL_ORB_SKILL_ID], 18),
  ),
  createSynergyUpgrade(
    'synergy-chain-lightning-gravity-well',
    'Singularity Circuit',
    'Chain Lightning and Gravity Well deal 18% increased damage while both skills are equipped.',
    '+18% Chain Lightning and Gravity Well damage',
    [CHAIN_LIGHTNING_SKILL_ID, GRAVITY_WELL_SKILL_ID],
    damageEffects([CHAIN_LIGHTNING_SKILL_ID, GRAVITY_WELL_SKILL_ID], 18),
  ),
  createSynergyUpgrade(
    'synergy-vitality-rallying-standard',
    'Renewing Standard',
    'Vitality and Rallying Banner restore 20% more health.',
    '+20% Vitality and Rallying Banner healing',
    [VITALITY_SKILL_ID, RALLYING_STANDARD_SKILL_ID],
    [
      { skillId: VITALITY_SKILL_ID, healingIncreasePercent: 20 },
      { skillId: RALLYING_STANDARD_SKILL_ID, healingIncreasePercent: 20 },
    ],
  ),
  createSynergyUpgrade(
    'synergy-vitality-aegis-pulse',
    'Living Bulwark',
    'Vitality restores 20% more health and Aegis Pulse grants 20% more shield.',
    '+20% Vitality healing and Aegis Pulse shield',
    [VITALITY_SKILL_ID, AEGIS_PULSE_SKILL_ID],
    [
      { skillId: VITALITY_SKILL_ID, healingIncreasePercent: 20 },
      { skillId: AEGIS_PULSE_SKILL_ID, shieldIncreasePercent: 20 },
    ],
  ),
  createSynergyUpgrade(
    'synergy-raise-skeleton-rallying-standard',
    'Grave Rally',
    'Skeletons deal 20% increased damage and Rallying Banner restores 20% more health.',
    '+20% Skeleton damage and Rallying Banner healing',
    [RAISE_SKELETON_SKILL_ID, RALLYING_STANDARD_SKILL_ID],
    [
      { skillId: RAISE_SKELETON_SKILL_ID, damageIncreasePercent: 20 },
      { skillId: RALLYING_STANDARD_SKILL_ID, healingIncreasePercent: 20 },
    ],
  ),
  createSynergyUpgrade(
    'synergy-raise-skeleton-gravity-well',
    'Grave Well',
    'Skeletons and Gravity Well deal 18% increased damage while both skills are equipped.',
    '+18% Skeleton and Gravity Well damage',
    [RAISE_SKELETON_SKILL_ID, GRAVITY_WELL_SKILL_ID],
    damageEffects([RAISE_SKELETON_SKILL_ID, GRAVITY_WELL_SKILL_ID], 18),
  ),
  createSynergyUpgrade(
    'synergy-fiery-touch-glacial-orb',
    'Thermal Shock',
    'Fiery Touch and Glacial Orb deal 18% increased damage while both skills are equipped.',
    '+18% Fiery Touch and Glacial Orb damage',
    [FIERY_TOUCH_SKILL_ID, GLACIAL_ORB_SKILL_ID],
    damageEffects([FIERY_TOUCH_SKILL_ID, GLACIAL_ORB_SKILL_ID], 18),
  ),
  createSynergyUpgrade(
    'synergy-fiery-touch-gravity-well',
    'Ember Singularity',
    'Fiery Touch and Gravity Well deal 18% increased damage while both skills are equipped.',
    '+18% Fiery Touch and Gravity Well damage',
    [FIERY_TOUCH_SKILL_ID, GRAVITY_WELL_SKILL_ID],
    damageEffects([FIERY_TOUCH_SKILL_ID, GRAVITY_WELL_SKILL_ID], 18),
  ),
  createSynergyUpgrade(
    'synergy-lancers-charge-aegis-pulse',
    'Iron Vanguard',
    'Lancer\'s Charge and Aegis Pulse deal 18% increased damage while both skills are equipped.',
    '+18% Lancer\'s Charge and Aegis Pulse damage',
    [LANCERS_CHARGE_SKILL_ID, AEGIS_PULSE_SKILL_ID],
    damageEffects([LANCERS_CHARGE_SKILL_ID, AEGIS_PULSE_SKILL_ID], 18),
  ),
]
