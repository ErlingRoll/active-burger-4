import {
  BASIC_ATTACK_SKILL_ID,
  CHAIN_LIGHTNING_SKILL_ID,
  CINDER_MINE_SKILL_ID,
  GLACIAL_ORB_SKILL_ID,
  RALLYING_BANNER_SKILL_ID,
  WHIRLWIND_SKILL_ID,
  RAISE_SKELETON_SKILL_ID,
  RIFT_JAVELIN_SKILL_ID,
  BLOOD_RITE_SKILL_ID,
} from './skills'
import type { ItemId } from '../content/gear/Items'
import type { PlaystyleDefinition } from '../content/playstyles/Playstyles'
import type { CharacterStatValues } from '../content/stats/Stats'

export type PlaystyleId =
  | 'knight'
  | 'ranger'
  | 'necromancer'
  | 'frost-warden'
  | 'ashen-alchemist'
  | 'war-shepherd'
  | 'riftwalker'
  | 'bloodweaver'

export const PLAYSTYLE_IDS = [
  'knight',
  'ranger',
  'necromancer',
  'frost-warden',
  'ashen-alchemist',
  'war-shepherd',
  'riftwalker',
  'bloodweaver',
] as const satisfies readonly PlaystyleId[]
export const KNIGHT_EARLY_FLOOR_COUNT = 2
export const KNIGHT_EARLY_FLOOR_DAMAGE_REDUCTION_PERCENT = 20

export const PLAYSTYLE_DEFINITIONS: Readonly<Record<PlaystyleId, PlaystyleDefinition>> = {
  knight: {
    id: 'knight',
    name: 'Knight',
    description: 'A heavily armored professional who solves every problem by standing closer to it.',
    baseStats: { maxHp: 150, movementSpeed: 160, attackDamage: 14, attackSpeed: 1, resonance: 5, attunement: 55 } as CharacterStatValues,
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
    description: 'A swift-eyed wanderer with a suspiciously large quiver and excellent escape plans.',
    baseStats: { maxHp: 85, movementSpeed: 180, attackDamage: 11, attackSpeed: 1.1, resonance: 6, attunement: 53 } as CharacterStatValues,
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
    description: 'A cheerful graveyard caretaker who believes every problem needs more coworkers.',
    baseStats: { maxHp: 115, movementSpeed: 150, attackDamage: 9, attackSpeed: 1, resonance: 5, attunement: 65 } as CharacterStatValues,
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
    description: 'A patient scholar of winter who considers warmth an avoidable design flaw.',
    baseStats: { maxHp: 100, movementSpeed: 160, attackDamage: 10, attackSpeed: 1.05, resonance: 6, attunement: 68 } as CharacterStatValues,
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
    description: 'An enthusiastic chemist who insists every recipe improves with one more explosion.',
    baseStats: { maxHp: 110, movementSpeed: 170, attackDamage: 11, attackSpeed: 0.95, resonance: 4, attunement: 72 } as CharacterStatValues,
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
    description: 'A battlefield manager with a clipboard, a whistle, and absolutely no retreat policy.',
    baseStats: { maxHp: 140, movementSpeed: 150, attackDamage: 12, attackSpeed: 0.95, resonance: 4, attunement: 62 } as CharacterStatValues,
    startingWeaponItemId: 'war-shepherd-training-sword' as ItemId,
    startingSkillIds: [BASIC_ATTACK_SKILL_ID, RALLYING_BANNER_SKILL_ID],
    skillAffinity: {
      tags: ['defensive', 'duration', 'summon'],
      label: 'Defensive, duration, and summon',
      description: 'Defensive, duration, and summon skill unlocks are more likely to appear.',
    },
    visual: { fillColor: 0xfacc15, outlineColor: 0xfef9c3 },
  },
  riftwalker: {
    id: 'riftwalker',
    name: 'Riftwalker',
    description: 'A dramatic duelist who treats distance as a polite suggestion and exits every room stylishly.',
    baseStats: { maxHp: 90, movementSpeed: 190, attackDamage: 10, attackSpeed: 1.05, resonance: 6, attunement: 58 } as CharacterStatValues,
    startingWeaponItemId: 'ranger-training-bow' as ItemId,
    startingSkillIds: [BASIC_ATTACK_SKILL_ID, RIFT_JAVELIN_SKILL_ID],
    skillAffinity: {
      tags: ['physical', 'projectile', 'trigger', 'duration'],
      label: 'Spatial, physical, and projectile',
      description: 'Spatial, physical, projectile, and trigger skill unlocks are more likely to appear.',
    },
    visual: { fillColor: 0x7c3aed, outlineColor: 0xe9d5ff },
  },
  bloodweaver: {
    id: 'bloodweaver',
    name: 'Bloodweaver',
    description: 'An occult tailor who insists every outfit needs more crimson thread and fewer safety regulations.',
    baseStats: { maxHp: 90, movementSpeed: 155, attackDamage: 10, attackSpeed: 1, resonance: 5, attunement: 74 } as CharacterStatValues,
    startingWeaponItemId: 'ashen-alchemist-training-staff' as ItemId,
    startingSkillIds: [BASIC_ATTACK_SKILL_ID, BLOOD_RITE_SKILL_ID],
    skillAffinity: {
      tags: ['chaos', 'dot', 'trigger', 'defensive'],
      label: 'Chaos, sacrifice, and sustain',
      description: 'Chaos, damage-over-time, trigger, defensive, and area skill unlocks are more likely to appear.',
    },
    visual: { fillColor: 0x991b1b, outlineColor: 0xfecaca },
  },
}

export const DEFAULT_PLAYSTYLE_ID: PlaystyleId = 'knight'
