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
  SIGIL_OF_RUIN_SKILL_ID,
  MIRRORCAST_SKILL_ID,
  RAZORWIRE_SKILL_ID,
  BLOOD_RITE_SKILL_ID,
  PRISM_HALO_SKILL_ID,
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
    'synergy-basic-attack-vitality',
    'Vital Spark',
    'Every fifth Basic Attack hit restores 2 health while Vitality is equipped.',
    'Every fifth Basic Attack heals 2',
    [BASIC_ATTACK_SKILL_ID, VITALITY_SKILL_ID],
    [],
  ),
  createSynergyUpgrade(
    'synergy-basic-attack-raise-skeleton',
    'Bone Conductor',
    'Basic Attack hits reduce Raise Skeleton cooldown by 0.2 seconds.',
    'Basic Attack accelerates Raise Skeleton',
    [BASIC_ATTACK_SKILL_ID, RAISE_SKELETON_SKILL_ID],
    [],
  ),
  createSynergyUpgrade(
    'synergy-basic-attack-fiery-touch',
    'Kindling Rhythm',
    'Basic Attack hits reduce Fiery Touch cooldown by 0.15 seconds.',
    'Basic Attack accelerates Fiery Touch',
    [BASIC_ATTACK_SKILL_ID, FIERY_TOUCH_SKILL_ID],
    [],
  ),
  createSynergyUpgrade(
    'synergy-basic-attack-lancers-charge',
    'Driving Edge',
    'Every third Basic Attack hit grants one Lancer Momentum stack.',
    'Every third Basic Attack grants Momentum',
    [BASIC_ATTACK_SKILL_ID, LANCERS_CHARGE_SKILL_ID],
    [],
  ),
  createSynergyUpgrade(
    'synergy-basic-attack-rallying-banner',
    'Rallying Volley',
    'Basic Attack hits while Rallying Banner is active extend it by 0.1 seconds.',
    'Basic Attack sustains Rallying Banner',
    [BASIC_ATTACK_SKILL_ID, RALLYING_BANNER_SKILL_ID],
    [],
  ),
  createSynergyUpgrade(
    'synergy-basic-attack-gravity-well',
    'Gravitic Rounds',
    'Basic Attack hits pull the struck enemy slightly toward the player.',
    'Basic Attack pulls targets',
    [BASIC_ATTACK_SKILL_ID, GRAVITY_WELL_SKILL_ID],
    [],
  ),
  createSynergyUpgrade(
    'synergy-basic-attack-aegis-pulse',
    'Guarded Strikes',
    'Basic Attack hits restore 2% of the active Aegis Pulse shield.',
    'Basic Attack restores Aegis shield',
    [BASIC_ATTACK_SKILL_ID, AEGIS_PULSE_SKILL_ID],
    [],
  ),
  createSynergyUpgrade(
    'synergy-basic-attack-rift-javelin',
    'Returning Rhythm',
    'Every fourth Basic Attack hit primes the next Rift Javelin return for bonus damage.',
    'Basic Attack primes Javelin return',
    [BASIC_ATTACK_SKILL_ID, RIFT_JAVELIN_SKILL_ID],
    [],
  ),
  createSynergyUpgrade(
    'synergy-basic-attack-cinder-mine',
    'Hot Trigger',
    'Basic Attack hits arm the nearest unarmed Cinder Mine within range.',
    'Basic Attack arms Cinder Mines',
    [BASIC_ATTACK_SKILL_ID, CINDER_MINE_SKILL_ID],
    [],
  ),
  createSynergyUpgrade(
    'synergy-basic-attack-storm-relay',
    'Conductive Volley',
    'Basic Attack hits apply one Shock stack while Storm Relay is equipped.',
    'Basic Attack applies Shock',
    [BASIC_ATTACK_SKILL_ID, STORM_RELAY_SKILL_ID],
    [],
  ),
  createSynergyUpgrade(
    'synergy-basic-attack-soul-tether',
    'Lifeline Rounds',
    'Basic Attack hits against Soul Tether targets restore 5% of their actual damage as health.',
    'Basic Attack leeches from tethered targets',
    [BASIC_ATTACK_SKILL_ID, SOUL_TETHER_SKILL_ID],
    [],
  ),
  createSynergyUpgrade(
    'synergy-basic-attack-phantom-arsenal',
    'Phantom Cadence',
    'Basic Attack hits reduce Phantom Arsenal cooldown by 0.2 seconds.',
    'Basic Attack accelerates Phantom Arsenal',
    [BASIC_ATTACK_SKILL_ID, PHANTOM_ARSENAL_SKILL_ID],
    [],
  ),
  createSynergyUpgrade(
    'synergy-basic-attack-sigil-of-ruin',
    'Ruinous Marks',
    'Basic Attack hits against a Ruin Sigil store 25% additional damage.',
    'Basic Attack charges Ruin Sigils',
    [BASIC_ATTACK_SKILL_ID, SIGIL_OF_RUIN_SKILL_ID],
    [],
  ),
  createSynergyUpgrade(
    'synergy-basic-attack-mirrorcast',
    'Mirror Tempo',
    'Basic Attack hits while Mirrorcast is armed refresh a small portion of its capture window.',
    'Basic Attack sustains Mirrorcast',
    [BASIC_ATTACK_SKILL_ID, MIRRORCAST_SKILL_ID],
    [],
  ),
  createSynergyUpgrade(
    'synergy-basic-attack-razorwire',
    'Measured Tension',
    'Basic Attack hits against enemies near Razorwire add one point of wire tension.',
    'Basic Attack builds Wire tension',
    [BASIC_ATTACK_SKILL_ID, RAZORWIRE_SKILL_ID],
    [],
  ),
  createSynergyUpgrade(
    'synergy-basic-attack-blood-rite',
    'Blood Tempo',
    'Basic Attack hits while Blood Debt is active extend its duration by 0.15 seconds.',
    'Basic Attack sustains Blood Debt',
    [BASIC_ATTACK_SKILL_ID, BLOOD_RITE_SKILL_ID],
    [],
  ),
  createSynergyUpgrade(
    'synergy-basic-attack-prism-halo',
    'Prismatic Cadence',
    'Basic Attack hits while Prism Halo is active reduce its next shard cooldown by 0.05 seconds.',
    'Basic Attack accelerates Prism Halo',
    [BASIC_ATTACK_SKILL_ID, PRISM_HALO_SKILL_ID],
    [],
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
    'Storm Relay strikes against Soul Tether targets extend those tethers by 0.5 seconds.',
    'Storm Relay extends Soul Tether',
    [STORM_RELAY_SKILL_ID, SOUL_TETHER_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-soul-tether-phantom-arsenal',
    'Spectral Pact',
    'Phantom Arsenal bolts against Soul Tether targets add a Chaos damage component.',
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
  createSynergyUpgrade(
    'synergy-sigil-of-ruin-prism-halo',
    'Prismatic Ruin',
    'A Ruin Sigil detonation also applies Burning, Chill, and Shock to every enemy it hits.',
    'Ruin detonation applies all elements',
    [SIGIL_OF_RUIN_SKILL_ID, PRISM_HALO_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-sigil-of-ruin-blood-rite',
    'Sanguine Ruin',
    'A Ruin Sigil detonation restores health equal to part of its burst damage.',
    'Ruin detonation heals you',
    [SIGIL_OF_RUIN_SKILL_ID, BLOOD_RITE_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-mirrorcast-razorwire',
    'Mirror Wire',
    'Each Echo copy extends the duration of every active Razorwire.',
    'Echo copies sustain Razorwires',
    [MIRRORCAST_SKILL_ID, RAZORWIRE_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-mirrorcast-prism-halo',
    'Prismatic Echo',
    'Each Echo copy fires an extra Prism shard volley while a Prism Halo is active.',
    'Echo copies fire a Prism volley',
    [MIRRORCAST_SKILL_ID, PRISM_HALO_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-razorwire-blood-rite',
    'Bloodwire',
    'While Blood Debt is active, Razorwire crossings deal bonus chaos damage.',
    'Wire crossings add chaos with Blood Debt',
    [RAZORWIRE_SKILL_ID, BLOOD_RITE_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-blood-rite-prism-halo',
    'Prism Offering',
    'Blood Rite\'s pulse extends an active Prism Halo\'s duration.',
    'Blood Rite sustains Prism Halo',
    [BLOOD_RITE_SKILL_ID, PRISM_HALO_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-chain-lightning-sigil-of-ruin',
    'Fractured Circuit',
    'Chain Lightning striking a Ruin Sigil adds one Conductive charge to it, once per Sigil.',
    'Chain Lightning adds a Sigil charge',
    [CHAIN_LIGHTNING_SKILL_ID, SIGIL_OF_RUIN_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-whirlwind-mirrorcast',
    'Parallax Tempest',
    'A Mirrorcast copy of Whirlwind creates a narrower mirrored Physical arc at reduced effectiveness.',
    'Echo Whirlwind creates a mirrored arc',
    [WHIRLWIND_SKILL_ID, MIRRORCAST_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-glacial-orb-razorwire',
    'Frostline',
    'A Glacial Orb impact near Razorwire crystallizes it; the next crossing releases a Cold shard and extra Chill.',
    'Glacial Orb crystallizes Razorwire',
    [GLACIAL_ORB_SKILL_ID, RAZORWIRE_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-vitality-rift-javelin',
    'Mending Return',
    'Vitality prepares the next Rift Javelin return to restore 1% max health per unique enemy pierced, capped at 5%.',
    'Vitality empowers the Javelin return',
    [VITALITY_SKILL_ID, RIFT_JAVELIN_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-raise-skeleton-cinder-mine',
    'Ashen Legion',
    'Cinder Mine detonations grant living Skeletons Ember Guard charges; their next hits release a reduced Fire splash.',
    'Mines empower Skeleton attacks',
    [RAISE_SKELETON_SKILL_ID, CINDER_MINE_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-fiery-touch-soul-tether',
    'Scorching Lifeline',
    'Fiery Touch damaging a Soul Tether target flares the tether for a reduced Chaos aftershock once per second.',
    'Fiery Touch flares Soul Tether',
    [FIERY_TOUCH_SKILL_ID, SOUL_TETHER_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-lancers-charge-rallying-banner',
    'Vanguard Standard',
    'Lancer’s Charge ending inside Rallying Banner refreshes it briefly and grants one Momentum stack.',
    'Charge refreshes the Banner',
    [LANCERS_CHARGE_SKILL_ID, RALLYING_BANNER_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-gravity-well-phantom-arsenal',
    'Echo Well',
    'Gravity Well primes the next Phantom Arsenal bolt against an affected enemy to fire one reduced Echo Bolt.',
    'Gravity Well primes a Phantom Echo',
    [GRAVITY_WELL_SKILL_ID, PHANTOM_ARSENAL_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-aegis-pulse-blood-rite',
    'Crimson Bulwark',
    'Blood Rite pulse damage while Aegis Pulse is active restores a capped portion of the Aegis shield.',
    'Blood Rite restores Aegis shield',
    [AEGIS_PULSE_SKILL_ID, BLOOD_RITE_SKILL_ID],
  ),
  createSynergyUpgrade(
    'synergy-storm-relay-prism-halo',
    'Aurora Relay',
    'A Prism Halo volley primes Storm Relay to fork its next strike to one extra target at reduced damage.',
    'Prism Halo primes a Relay fork',
    [STORM_RELAY_SKILL_ID, PRISM_HALO_SKILL_ID],
  ),
]
