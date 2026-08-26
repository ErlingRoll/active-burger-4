/** Stable identifiers for encounter bosses and their reusable skills. */
export type BossDefinitionId = 'stone-golem' | 'inferno-warden'
export type BossSkillId =
  | 'ground-slam'
  | 'charge'
  | 'fire-nova'
  | 'flame-line'
  | 'meteor-zone'

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

export interface BossEnrageDefinition {
  movementSpeedPerSecond: number
  damagePerSecond: number
  cooldownReductionPerSecond: number
  maxMovementSpeedMultiplier: number
  maxDamageMultiplier: number
  minCooldownMultiplier: number
}

export interface BossDefinition {
  id: BossDefinitionId
  name: string
  radius: number
  maxHp: number
  speed: number
  contactDamage: number
  xpReward: number
  skills: readonly BossSkillId[]
  enrage?: BossEnrageDefinition
}
export type Boss = BossDefinition

export const GROUND_SLAM_SKILL_ID: BossSkillId = 'ground-slam'
export const CHARGE_SKILL_ID: BossSkillId = 'charge'
export const FIRE_NOVA_SKILL_ID: BossSkillId = 'fire-nova'
export const RADIAL_FIRE_NOVA_SKILL_ID = FIRE_NOVA_SKILL_ID
export const FLAME_LINE_SKILL_ID: BossSkillId = 'flame-line'
export const METEOR_ZONE_SKILL_ID: BossSkillId = 'meteor-zone'
export const TARGETED_METEOR_ZONES_SKILL_ID = METEOR_ZONE_SKILL_ID
export const STONE_GOLEM_BOSS_ID: BossDefinitionId = 'stone-golem'
export const INFERNO_WARDEN_BOSS_ID: BossDefinitionId = 'inferno-warden'
export const INFERNO_WARDEN_ENRAGE_DEFINITION: BossEnrageDefinition = {
  movementSpeedPerSecond: 0.002,
  damagePerSecond: 0.003,
  cooldownReductionPerSecond: 0.002,
  maxMovementSpeedMultiplier: 1.25,
  maxDamageMultiplier: 1.5,
  minCooldownMultiplier: 0.75,
}

export const BOSS_SKILL_DEFINITIONS = {
  [GROUND_SLAM_SKILL_ID]: {
    id: GROUND_SLAM_SKILL_ID,
    name: 'Ground Slam',
    description: 'Telegraphs a shockwave around the player before striking.',
    cooldown: 4,
    telegraphDuration: 0.75,
    damage: 16,
    radius: 100,
  },
  [CHARGE_SKILL_ID]: {
    id: CHARGE_SKILL_ID,
    name: 'Charge',
    description: 'Telegraphs a straight-line charge toward the player.',
    cooldown: 5,
    telegraphDuration: 0.5,
    damage: 20,
    radius: 28,
    range: 360,
  },
  [FIRE_NOVA_SKILL_ID]: {
    id: FIRE_NOVA_SKILL_ID,
    name: 'Fire Nova',
    description: 'Telegraphs a radial burst of fire around the Warden.',
    cooldown: 4.5,
    telegraphDuration: 0.8,
    damage: 20,
    radius: 150,
  },
  [FLAME_LINE_SKILL_ID]: {
    id: FLAME_LINE_SKILL_ID,
    name: 'Flame Line',
    description: 'Telegraphs a searing line of flame toward the player.',
    cooldown: 5.5,
    telegraphDuration: 0.9,
    damage: 25,
    radius: 34,
    range: 480,
  },
  [METEOR_ZONE_SKILL_ID]: {
    id: METEOR_ZONE_SKILL_ID,
    name: 'Meteor Zones',
    description: 'Marks the player location for a delayed meteor impact.',
    cooldown: 6,
    telegraphDuration: 0.75,
    damage: 30,
    radius: 85,
  },
} as const satisfies Record<BossSkillId, BossSkillDefinition>

export const BOSS_DEFINITIONS = {
  [STONE_GOLEM_BOSS_ID]: {
    id: STONE_GOLEM_BOSS_ID,
    name: 'Stone Golem',
    radius: 42,
    maxHp: 900,
    speed: 26,
    contactDamage: 12,
    xpReward: 100,
    skills: [GROUND_SLAM_SKILL_ID, CHARGE_SKILL_ID],
  },
  [INFERNO_WARDEN_BOSS_ID]: {
    id: INFERNO_WARDEN_BOSS_ID,
    name: 'Inferno Warden',
    radius: 48,
    maxHp: 3000,
    speed: 32,
    contactDamage: 12,
    xpReward: 250,
    skills: [FIRE_NOVA_SKILL_ID, FLAME_LINE_SKILL_ID, METEOR_ZONE_SKILL_ID],
    enrage: INFERNO_WARDEN_ENRAGE_DEFINITION,
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
