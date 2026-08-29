import {
  BASIC_ATTACK_SKILL_ID,
  CHAIN_LIGHTNING_SKILL_ID,
  WHIRLWIND_SKILL_ID,
  RAISE_SKELETON_SKILL_ID,
} from './skills'
import type { ItemId } from '../content/gear/Items'
import type { PlaystyleDefinition } from '../content/playstyles/Playstyles'
import type { StatValues } from '../content/stats/Stats'

export type PlaystyleId = 'knight' | 'ranger' | 'necromancer'

export const PLAYSTYLE_IDS = ['knight', 'ranger', 'necromancer'] as const satisfies readonly PlaystyleId[]

export const PLAYSTYLE_DEFINITIONS: Readonly<Record<PlaystyleId, PlaystyleDefinition>> = {
  knight: {
    id: 'knight',
    name: 'Knight',
    description: 'A durable close-range fighter who begins with Whirlwind.',
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
}

export const DEFAULT_PLAYSTYLE_ID: PlaystyleId = 'knight'
