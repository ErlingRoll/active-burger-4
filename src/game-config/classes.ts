import {
  BASIC_ATTACK_SKILL_ID,
  CHAIN_LIGHTNING_SKILL_ID,
  CINDER_MINE_SKILL_ID,
  GLACIAL_ORB_SKILL_ID,
  RALLYING_STANDARD_SKILL_ID,
  WHIRLWIND_SKILL_ID,
  RAISE_SKELETON_SKILL_ID,
} from './skills'
import type { ItemId } from '../content/gear/Items'
import type { PlaystyleDefinition } from '../content/playstyles/Playstyles'
import type { StatValues } from '../content/stats/Stats'

export type PlaystyleId =
  | 'knight'
  | 'ranger'
  | 'necromancer'
  | 'frost-warden'
  | 'ashen-alchemist'
  | 'war-shepherd'

export const PLAYSTYLE_IDS = [
  'knight',
  'ranger',
  'necromancer',
  'frost-warden',
  'ashen-alchemist',
  'war-shepherd',
] as const satisfies readonly PlaystyleId[]
export const KNIGHT_EARLY_FLOOR_COUNT = 2
export const KNIGHT_EARLY_FLOOR_DAMAGE_REDUCTION_PERCENT = 20

export const PLAYSTYLE_DEFINITIONS: Readonly<Record<PlaystyleId, PlaystyleDefinition>> = {
  knight: {
    id: 'knight',
    name: 'Knight',
    description: 'A durable close-range fighter who begins with Whirlwind and has Vanguard Guard through floor 2.',
    baseStats: { maxHp: 150, movementSpeed: 135, attackDamage: 14, attackSpeed: 1, attackRange: 45 } as StatValues,
    startingWeaponItemId: 'knight-training-sword' as ItemId,
    startingSkillIds: [BASIC_ATTACK_SKILL_ID, WHIRLWIND_SKILL_ID],
    skillAffinity: {
      tags: ['melee', 'defensive'],
      label: 'Melee and defensive',
      description: 'Melee and defensive skill unlocks are more likely to appear.',
    },
    visual: { fillColor: 0x60a5fa, outlineColor: 0xdbeafe },
  },
  ranger: {
    id: 'ranger',
    name: 'Ranger',
    description: 'A swift long-range attacker who begins with Chain Lightning.',
    baseStats: { maxHp: 85, movementSpeed: 187.5, attackDamage: 11, attackSpeed: 1.1, attackRange: 160 } as StatValues,
    startingWeaponItemId: 'ranger-training-bow' as ItemId,
    startingSkillIds: [BASIC_ATTACK_SKILL_ID, CHAIN_LIGHTNING_SKILL_ID],
    skillAffinity: {
      tags: ['projectile', 'lightning'],
      label: 'Projectile and lightning',
      description: 'Projectile and lightning skill unlocks are more likely to appear.',
    },
    visual: { fillColor: 0x4ade80, outlineColor: 0xdcfce7 },
  },
  necromancer: {
    id: 'necromancer',
    name: 'Necromancer',
    description: 'A resilient summoner who commands skeletons from a cursed staff.',
    baseStats: { maxHp: 115, movementSpeed: 142.5, attackDamage: 9, attackSpeed: 1, attackRange: 110 } as StatValues,
    startingWeaponItemId: 'necromancer-bone-staff' as ItemId,
    startingSkillIds: [BASIC_ATTACK_SKILL_ID, RAISE_SKELETON_SKILL_ID],
    skillAffinity: {
      tags: ['summon', 'chaos', 'dot'],
      label: 'Summon, chaos, and damage over time',
      description: 'Summon, chaos, and damage-over-time skill unlocks are more likely to appear.',
    },
    visual: { fillColor: 0xc084fc, outlineColor: 0xf3e8ff },
  },
  'frost-warden': {
    id: 'frost-warden',
    name: 'Frost Warden',
    description: 'A disciplined cryomancer who opens with Glacial Orb and controls packs from range.',
    baseStats: { maxHp: 100, movementSpeed: 170, attackDamage: 10, attackSpeed: 1.05, attackRange: 110 } as StatValues,
    startingWeaponItemId: 'frost-warden-training-wand' as ItemId,
    startingSkillIds: [BASIC_ATTACK_SKILL_ID, GLACIAL_ORB_SKILL_ID],
    skillAffinity: {
      tags: ['cold', 'projectile', 'area'],
      label: 'Cold, projectile, and area',
      description: 'Cold, projectile, and area skill unlocks are more likely to appear.',
    },
    visual: { fillColor: 0x38bdf8, outlineColor: 0xe0f2fe },
  },
  'ashen-alchemist': {
    id: 'ashen-alchemist',
    name: 'Ashen Alchemist',
    description: 'A patient firestarter who seeds the battlefield with burning zones.',
    baseStats: { maxHp: 110, movementSpeed: 135, attackDamage: 11, attackSpeed: 0.95, attackRange: 110 } as StatValues,
    startingWeaponItemId: 'ashen-alchemist-training-staff' as ItemId,
    startingSkillIds: [BASIC_ATTACK_SKILL_ID, CINDER_MINE_SKILL_ID],
    skillAffinity: {
      tags: ['fire', 'dot', 'area'],
      label: 'Fire, damage over time, and area',
      description: 'Fire, damage-over-time, and area skill unlocks are more likely to appear.',
    },
    visual: { fillColor: 0xf97316, outlineColor: 0xffedd5 },
  },
  'war-shepherd': {
    id: 'war-shepherd',
    name: 'War Shepherd',
    description: 'A battlefield commander who protects allies and sustains the fight with a rallying banner.',
    baseStats: { maxHp: 140, movementSpeed: 125, attackDamage: 12, attackSpeed: 0.95, attackRange: 45 } as StatValues,
    startingWeaponItemId: 'war-shepherd-training-sword' as ItemId,
    startingSkillIds: [BASIC_ATTACK_SKILL_ID, RALLYING_STANDARD_SKILL_ID],
    skillAffinity: {
      tags: ['defensive', 'duration', 'summon'],
      label: 'Defensive, duration, and summon',
      description: 'Defensive, duration, and summon skill unlocks are more likely to appear.',
    },
    visual: { fillColor: 0xfacc15, outlineColor: 0xfef9c3 },
  },
}

export const DEFAULT_PLAYSTYLE_ID: PlaystyleId = 'knight'
