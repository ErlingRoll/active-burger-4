/** Stable identifiers for the first encounter boss and its reusable skills. */
export type BossDefinitionId = 'stone-golem'
export type BossSkillId = 'ground-slam' | 'charge'

export interface BossSkillDefinition {
  id: BossSkillId
  name: string
  description: string
  cooldown: number
  telegraphDuration: number
  damage: number
  radius: number
  range?: number
}
export type BossSkill = BossSkillDefinition

export interface BossDefinition {
  id: BossDefinitionId
  name: string
  radius: number
  maxHp: number
  speed: number
  contactDamage: number
  xpReward: number
  skills: readonly BossSkillId[]
}
export type Boss = BossDefinition

export const GROUND_SLAM_SKILL_ID: BossSkillId = 'ground-slam'
export const CHARGE_SKILL_ID: BossSkillId = 'charge'
export const STONE_GOLEM_BOSS_ID: BossDefinitionId = 'stone-golem'

export const BOSS_SKILL_DEFINITIONS = {
  [GROUND_SLAM_SKILL_ID]: {
    id: GROUND_SLAM_SKILL_ID,
    name: 'Ground Slam',
    description: 'Telegraphs a shockwave around the player before striking.',
    cooldown: 4,
    telegraphDuration: 0.75,
    damage: 24,
    radius: 100,
  },
  [CHARGE_SKILL_ID]: {
    id: CHARGE_SKILL_ID,
    name: 'Charge',
    description: 'Telegraphs a straight-line charge toward the player.',
    cooldown: 5,
    telegraphDuration: 0.5,
    damage: 30,
    radius: 28,
    range: 360,
  },
} as const satisfies Record<BossSkillId, BossSkillDefinition>

export const BOSS_DEFINITIONS = {
  [STONE_GOLEM_BOSS_ID]: {
    id: STONE_GOLEM_BOSS_ID,
    name: 'Stone Golem',
    radius: 42,
    maxHp: 900,
    speed: 26,
    contactDamage: 18,
    xpReward: 100,
    skills: [GROUND_SLAM_SKILL_ID, CHARGE_SKILL_ID],
  },
} as const satisfies Record<BossDefinitionId, BossDefinition>

export function getBossDefinition(id: BossDefinitionId): BossDefinition {
  const definition = BOSS_DEFINITIONS[id]
  if (!definition) {
    throw new Error(`Unknown boss definition: ${id}`)
  }
  return definition
}

export function getBossSkillDefinition(id: BossSkillId): BossSkillDefinition {
  const definition = BOSS_SKILL_DEFINITIONS[id]
  if (!definition) {
    throw new Error(`Unknown boss skill definition: ${id}`)
  }
  return definition
}
