import {
  BASIC_ATTACK_SKILL_ID,
  CHAIN_LIGHTNING_SKILL_ID,
  WHIRLWIND_SKILL_ID,
  type SkillId,
} from '../skills/Skills'
import type { StatValues } from '../stats/Stats'

export const PLAYSTYLE_IDS = ['knight', 'ranger', 'necromancer'] as const
export type PlaystyleId = (typeof PLAYSTYLE_IDS)[number]

export interface PlaystyleDefinition {
  readonly id: PlaystyleId
  readonly name: string
  readonly description: string
  readonly baseStats: StatValues
  readonly startingSkillIds: readonly SkillId[]
  readonly visual: {
    readonly fillColor: number
    readonly outlineColor: number
  }
}

export const PLAYSTYLE_DEFINITIONS: Readonly<Record<PlaystyleId, PlaystyleDefinition>> = {
  knight: {
    id: 'knight',
    name: 'Knight',
    description: 'A durable close-range fighter who begins with Whirlwind.',
    baseStats: { maxHp: 150, movementSpeed: 90, attackDamage: 14, attackSpeed: 1, attackRange: 45 },
    startingSkillIds: [BASIC_ATTACK_SKILL_ID, WHIRLWIND_SKILL_ID],
    visual: { fillColor: 0x60a5fa, outlineColor: 0xdbeafe },
  },
  ranger: {
    id: 'ranger',
    name: 'Ranger',
    description: 'A swift long-range attacker who begins with Chain Lightning.',
    baseStats: { maxHp: 85, movementSpeed: 125, attackDamage: 11, attackSpeed: 1.1, attackRange: 160 },
    startingSkillIds: [BASIC_ATTACK_SKILL_ID, CHAIN_LIGHTNING_SKILL_ID],
    visual: { fillColor: 0x4ade80, outlineColor: 0xdcfce7 },
  },
  necromancer: {
    id: 'necromancer',
    name: 'Necromancer',
    description: 'A resilient ranged controller prepared for future summon upgrades.',
    baseStats: { maxHp: 115, movementSpeed: 95, attackDamage: 9, attackSpeed: 1, attackRange: 110 },
    startingSkillIds: [BASIC_ATTACK_SKILL_ID, CHAIN_LIGHTNING_SKILL_ID],
    visual: { fillColor: 0xc084fc, outlineColor: 0xf3e8ff },
  },
}

export const DEFAULT_PLAYSTYLE_ID: PlaystyleId = 'knight'

export function isPlaystyleId(value: unknown): value is PlaystyleId {
  return typeof value === 'string' && (PLAYSTYLE_IDS as readonly string[]).includes(value)
}

export function getPlaystyleDefinition(id: PlaystyleId): PlaystyleDefinition {
  return PLAYSTYLE_DEFINITIONS[id]
}
