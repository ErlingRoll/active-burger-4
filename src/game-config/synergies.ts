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
  RALLYING_BANNER_SKILL_ID,
  VITALITY_SKILL_ID,
  WHIRLWIND_SKILL_ID,
  RIFT_JAVELIN_SKILL_ID,
  CINDER_MINE_SKILL_ID,
  STORM_RELAY_SKILL_ID,
  SOUL_TETHER_SKILL_ID,
  PHANTOM_ARSENAL_SKILL_ID,
} from './skills'

export const SYNERGY_OFFER_CHANCE = 0.1
export const SYNERGY_DEFAULT_RARITY = Rarity.Legendary

export function isSynergyActive(
  selectedUpgradeIds: readonly UpgradeId[],
  synergyId: UpgradeId,
): boolean {
  return selectedUpgradeIds.includes(synergyId)
}

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

export function getSynergyPartnerSkillIds(
  skillId: SkillId,
  ownedSkillIds: readonly SkillId[],
): SkillId[] {
  const ownedSkillIdSet = new Set(ownedSkillIds)
  return [...new Set(
    SYNERGY_UPGRADES
      .filter((synergy) => synergy.synergySkillIds.includes(skillId))
      .flatMap((synergy) =>
        synergy.synergySkillIds.filter((partnerSkillId) =>
          partnerSkillId !== skillId && ownedSkillIdSet.has(partnerSkillId)
        )
      ),
  )]
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
  synergyEffects: readonly SynergyEffect[] = [],
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

export const SYNERGY_UPGRADES: readonly SynergyUpgradeDefinition[] = [
  createSynergyUpgrade(
    'synergy-basic-attack-whirlwind',
    'Close Quarters',
    'Whirlwind hits prime Basic Attack, reducing its remaining cooldown by 50%.',
    'Whirlwind halves Basic Attack cooldown',
    [BASIC_ATTACK_SKILL_ID, WHIRLWIND_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-basic-attack-chain-lightning',
    'Static Arsenal',
    'Basic Attack hits apply 1 Shock stack while Chain Lightning is equipped.',
    'Basic Attack applies 1 Shock',
    [BASIC_ATTACK_SKILL_ID, CHAIN_LIGHTNING_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-basic-attack-glacial-orb',
    'Frosted Ammunition',
    'Basic Attack hits apply 1 Chill stack while Glacial Orb is equipped.',
    'Basic Attack applies 1 Chill',
    [BASIC_ATTACK_SKILL_ID, GLACIAL_ORB_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-whirlwind-lancers-charge',
    'Cyclone Momentum',
    'Whirlwind hits grant 1 Lancer Momentum stack, respecting the normal Momentum cap.',
    'Whirlwind grants Momentum',
    [WHIRLWIND_SKILL_ID, LANCERS_CHARGE_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-whirlwind-aegis-pulse',
    'Tempest Bastion',
    'Whirlwind hits while Aegis Pulse is active restore 20% of the shield and refresh its duration briefly.',
    'Whirlwind fortifies Aegis shield',
    [WHIRLWIND_SKILL_ID, AEGIS_PULSE_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-chain-lightning-glacial-orb',
    'Stormfrost',
    'Chain Lightning applies Chill, and striking a Chilled enemy adds an extra Shock stack.',
    'Chain Lightning applies Chill and Shock',
    [CHAIN_LIGHTNING_SKILL_ID, GLACIAL_ORB_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-chain-lightning-gravity-well',
    'Singularity Circuit',
    'Gravity Well catching an enemy primes Chain Lightning to hit 1 additional target on its next cast.',
    'Gravity Well primes an extra chain target',
    [CHAIN_LIGHTNING_SKILL_ID, GRAVITY_WELL_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-vitality-rallying-banner',
    'Renewing Banner',
    'Vitality extends an active Rallying Banner by 2 seconds.',
    'Vitality extends Rallying Banner',
    [VITALITY_SKILL_ID, RALLYING_BANNER_SKILL_ID],
    [],
  ),
  createSynergyUpgrade(
    'synergy-vitality-aegis-pulse',
    'Living Bulwark',
    'Vitality adds a shield equal to 50% of its healing while an Aegis Pulse shield is active.',
    'Vitality adds bonus Aegis shield',
    [VITALITY_SKILL_ID, AEGIS_PULSE_SKILL_ID],
    [],
  ),
  createSynergyUpgrade(
    'synergy-raise-skeleton-rallying-banner',
    'Grave Rally',
    'While Rallying Banner is active, Raise Skeleton can maintain one additional Skeleton and its summon cooldown resets when the banner is cast.',
    'Rallying Banner empowers Skeleton summons',
    [RAISE_SKELETON_SKILL_ID, RALLYING_BANNER_SKILL_ID],
    [],
  ),
  createSynergyUpgrade(
    'synergy-raise-skeleton-gravity-well',
    'Grave Well',
    'Gravity Well pulls affected enemies toward the nearest living Skeleton instead of the player.',
    'Gravity Well anchors to a Skeleton',
    [RAISE_SKELETON_SKILL_ID, GRAVITY_WELL_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-fiery-touch-glacial-orb',
    'Thermal Shock',
    'Fiery Touch hitting a Chilled or Frozen enemy consumes its Frost and adds a Cold burst.',
    'Fiery Touch triggers Thermal Shock',
    [FIERY_TOUCH_SKILL_ID, GLACIAL_ORB_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-fiery-touch-gravity-well',
    'Ember Singularity',
    'Gravity Well primes the next Fiery Touch trigger with a 50% larger radius.',
    'Gravity Well primes Fiery Touch',
    [FIERY_TOUCH_SKILL_ID, GRAVITY_WELL_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-lancers-charge-aegis-pulse',
    'Iron Vanguard',
    'Lancer\'s Charge consumes 25% of the active Aegis shield to empower the charge.',
    'Aegis shield empowers Lancer\'s Charge',
    [LANCERS_CHARGE_SKILL_ID, AEGIS_PULSE_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-rift-javelin-lancers-charge',
    'Piercing Vanguard',
    'Rift Javelin return hits grant 1 Lancer Momentum stack.',
    'Rift Javelin returns grant Momentum',
    [RIFT_JAVELIN_SKILL_ID, LANCERS_CHARGE_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-cinder-mine-fiery-touch',
    'Wildfire',
    'Fiery Touch hitting a Burning enemy consumes its Burning stacks for an immediate Wildfire burst.',
    'Fiery Touch consumes Burning',
    [CINDER_MINE_SKILL_ID, FIERY_TOUCH_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-soul-tether-vitality',
    'Lifebound Pact',
    'Soul Tether healing stores a Synergy Charge for Vitality; the next Vitality cast consumes it for bonus healing.',
    'Soul Tether charges Vitality',
    [SOUL_TETHER_SKILL_ID, VITALITY_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-phantom-arsenal-raise-skeleton',
    'Legion of the Fallen',
    'Each living summon grants the other summon type +1 maximum active summon.',
    'Summons expand each other\'s ranks',
    [PHANTOM_ARSENAL_SKILL_ID, RAISE_SKELETON_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-storm-relay-rallying-banner',
    'Warded Conduit',
    'Storm Relay strikes while Rallying Banner is active extend the banner by 0.25 seconds.',
    'Storm Relay sustains Rallying Banner',
    [STORM_RELAY_SKILL_ID, RALLYING_BANNER_SKILL_ID],
    [],
  ),
  createSynergyUpgrade(
    'synergy-rift-javelin-cinder-mine',
    'Scorched Lance',
    'Rift Javelin return hits arm nearby Cinder Mines immediately.',
    'Rift Javelin arms Cinder Mines',
    [RIFT_JAVELIN_SKILL_ID, CINDER_MINE_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-cinder-mine-storm-relay',
    'Ashen Circuit',
    'Storm Relay strikes against Burning enemies apply 1 additional Shock stack.',
    'Burning enemies conduct extra Shock',
    [CINDER_MINE_SKILL_ID, STORM_RELAY_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-storm-relay-soul-tether',
    'Voltaic Bond',
    'Storm Relay strikes against the Soul Tether target extend the tether by 0.5 seconds.',
    'Storm Relay extends Soul Tether',
    [STORM_RELAY_SKILL_ID, SOUL_TETHER_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-soul-tether-phantom-arsenal',
    'Spectral Pact',
    'Phantom Arsenal bolts against the Soul Tether target add a Chaos damage component.',
    'Phantom Arsenal marks the tether',
    [SOUL_TETHER_SKILL_ID, PHANTOM_ARSENAL_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-phantom-arsenal-rift-javelin',
    'Ghost Volley',
    'Phantom Arsenal hits prime the next Rift Javelin return for bonus damage.',
    'Phantom Arsenal primes Rift Javelin',
    [PHANTOM_ARSENAL_SKILL_ID, RIFT_JAVELIN_SKILL_ID],
  ),
]
