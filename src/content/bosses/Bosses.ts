/**
 * The boss roster.
 *
 * Two bosses used to carry every floor: a Stone Golem on all of them and an
 * Inferno Warden at the end. Both were hardcoded into the timeline, both cast
 * from a fixed list in a fixed order, and one of them was the entire mid-game.
 *
 * A boss is now described entirely by data. A skill declares the *shape* of the
 * area it threatens rather than naming itself to the simulation, so adding an
 * attack is an entry in this file and nothing else, and every attack that is
 * not contact damage necessarily arrives as a telegraph.
 *
 * Each skill also states its counterplay, and the shape is chosen so that the
 * counterplay is a real movement answer rather than a reflex:
 *
 * - `disc` on the player: the ground is marked where you stand, so leave it.
 * - `disc` on the boss: a crush centred on the caster, so back off.
 * - `ring` on the boss: the band is lethal and the middle is not, so close in.
 * - `line`: a lane, so step off it sideways. Fanned lanes leave gaps to stand
 *   in rather than a single lane to flee.
 * - `cone`: a sector in front, so round its edge and fight from the flank.
 *
 * Counterplay then follows from where you are, which is what makes two bosses
 * with the same damage feel like different fights: the Frostbound Colossus
 * punishes mid-range, the Cinder Hound punishes standing still, the Dread
 * Monolith punishes staying in its reach at all.
 */
import type { DamageType } from '../stats/Damage'

/** How a boss attack is anchored when it is cast. */
export type BossSkillOrigin = 'boss' | 'player'

/** The geometry of a boss attack's threatened area. */
export type BossSkillShape = 'disc' | 'ring' | 'line' | 'cone'

/** Silhouettes the renderer can draw for a boss. */
export type BossRenderShape =
  | 'golem'
  | 'colossus'
  | 'beast'
  | 'herald'
  | 'sentinel'
  | 'brood'
  | 'warlord'
  | 'wraith'
  | 'monolith'
  | 'maw'
  | 'warden'

export interface BossRenderDefinition {
  shape: BossRenderShape
  color: string
  outlineColor: string
}

export interface BossSkillDefinition {
  id: string
  name: string
  description: string
  /**
   * The movement that avoids this attack, in the imperative. Shown on the
   * telegraph, because an attack the player cannot read is not counterplay.
   */
  counterplay: string
  cooldown: number
  telegraphDuration: number
  damage: number
  damageType: DamageType
  shape: BossSkillShape
  origin: BossSkillOrigin
  /** Disc, ring and cone radius, or a line's half-width. */
  radius: number
  /** Safe middle of a `ring`. Required by that shape and ignored by the rest. */
  innerRadius?: number
  /** Full angular width of a `cone`, in degrees. */
  arcDegrees?: number
  /** Length of a `line`, or the reach of a `cone`. */
  range?: number
  /** Areas cast at once. Defaults to one. */
  count?: number
  /** Angle between repeated lines or cones, in degrees. */
  spreadDegrees?: number
  /** How far repeated discs scatter from their anchor. */
  scatter?: number
  /** Moves the caster to the far end of the lane when it resolves. */
  dash?: boolean
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
  id: string
  name: string
  /** One line on how the fight works, for the result screen and the codex. */
  tactics: string
  radius: number
  maxHp: number
  speed: number
  contactDamage: number
  xpReward: number
  skills: readonly BossSkillId[]
  render: BossRenderDefinition
  /**
   * `floor` bosses are drawn for ordinary floors; `final` bosses are reserved
   * for the encounter that ends a dungeon and never appear in the floor draw.
   */
  role: 'floor' | 'final'
  /** Earliest floor this boss may be drawn for. */
  minFloor: number
  /** Relative likelihood within the eligible pool. */
  weight: number
  enrage?: BossEnrageDefinition
}
export type Boss = BossDefinition

export const INFERNO_WARDEN_ENRAGE_DEFINITION: BossEnrageDefinition = {
  movementSpeedPerSecond: 0.002,
  damagePerSecond: 0.003,
  cooldownReductionPerSecond: 0.002,
  maxMovementSpeedMultiplier: 1.25,
  maxDamageMultiplier: 1.5,
  minCooldownMultiplier: 0.75,
}

/*
 * Telegraph durations are sized against movement speed, not for drama. A base
 * character covers roughly 160 units a second and the autonomous Dodge spends
 * the first tenth of a second reacting, so a one-second warning buys about 145
 * units of travel. Every escape distance below is inside that budget:
 * a marked disc is left by clearing its radius, a lane by clearing its
 * half-width sideways, a ring by crossing the thinner of its two edges, and a
 * cone by covering the arc to its nearer side.
 */
export const BOSS_SKILL_DEFINITIONS = {
  'ground-slam': {
    id: 'ground-slam',
    name: 'Ground Slam',
    description: 'Marks the ground under the player, then shatters it.',
    counterplay: 'Step out of the circle',
    cooldown: 4,
    telegraphDuration: 0.85,
    damage: 16,
    damageType: 'physical',
    shape: 'disc',
    origin: 'player',
    radius: 100,
  },
  'stone-sweep': {
    id: 'stone-sweep',
    name: 'Stone Sweep',
    description: 'Sweeps a wide arm through everything in front of the Golem.',
    counterplay: 'Get around to its flank',
    cooldown: 4.5,
    telegraphDuration: 0.75,
    damage: 14,
    damageType: 'physical',
    shape: 'cone',
    origin: 'boss',
    radius: 185,
    arcDegrees: 110,
  },
  charge: {
    id: 'charge',
    name: 'Charge',
    description: 'Lines up a straight charge and ends it where the lane ends.',
    counterplay: 'Step off the lane',
    cooldown: 5,
    telegraphDuration: 0.65,
    damage: 20,
    damageType: 'physical',
    shape: 'line',
    origin: 'boss',
    radius: 28,
    range: 360,
    dash: true,
  },
  'ember-dash': {
    id: 'ember-dash',
    name: 'Ember Dash',
    description: 'A short, fast run that leaves the Hound past the player.',
    counterplay: 'Step off the lane',
    cooldown: 3.2,
    telegraphDuration: 0.62,
    damage: 18,
    damageType: 'fire',
    shape: 'line',
    origin: 'boss',
    radius: 24,
    range: 420,
    dash: true,
  },
  'ash-plume': {
    id: 'ash-plume',
    name: 'Ash Plume',
    description: 'Coughs a broad wedge of burning ash forward.',
    counterplay: 'Get around to its flank',
    cooldown: 4,
    telegraphDuration: 0.8,
    damage: 16,
    damageType: 'fire',
    shape: 'cone',
    origin: 'boss',
    radius: 180,
    arcDegrees: 120,
  },
  'grave-spikes': {
    id: 'grave-spikes',
    name: 'Grave Spikes',
    description: 'Marks three patches of ground around the player.',
    counterplay: 'Keep moving clear of the marks',
    cooldown: 5,
    telegraphDuration: 1.05,
    damage: 18,
    damageType: 'chaos',
    shape: 'disc',
    origin: 'player',
    radius: 62,
    count: 3,
    scatter: 130,
  },
  'sundering-wail': {
    id: 'sundering-wail',
    name: 'Sundering Wail',
    description: 'A scream that tears through a wide wedge in front.',
    counterplay: 'Get around to its flank',
    cooldown: 5,
    telegraphDuration: 1,
    damage: 20,
    damageType: 'chaos',
    shape: 'cone',
    origin: 'boss',
    radius: 200,
    arcDegrees: 150,
  },
  'glacial-ring': {
    id: 'glacial-ring',
    name: 'Glacial Ring',
    description: 'A ring of ice erupts at range. The Colossus itself is clear.',
    counterplay: 'Close in under the ring',
    cooldown: 6.5,
    telegraphDuration: 1.1,
    damage: 26,
    damageType: 'cold',
    shape: 'ring',
    origin: 'boss',
    radius: 330,
    innerRadius: 140,
  },
  'rime-cone': {
    id: 'rime-cone',
    name: 'Rime Cone',
    description: 'Exhales a narrow blast of freezing air.',
    counterplay: 'Get around to its flank',
    cooldown: 5,
    telegraphDuration: 0.95,
    damage: 20,
    damageType: 'cold',
    shape: 'cone',
    origin: 'boss',
    radius: 220,
    arcDegrees: 85,
  },
  'frost-lance': {
    id: 'frost-lance',
    name: 'Frost Lance',
    description: 'A long spear of ice along one lane.',
    counterplay: 'Step off the lane',
    cooldown: 5,
    telegraphDuration: 0.85,
    damage: 24,
    damageType: 'cold',
    shape: 'line',
    origin: 'boss',
    radius: 26,
    range: 520,
  },
  'storm-lattice': {
    id: 'storm-lattice',
    name: 'Storm Lattice',
    description: 'Three lanes of lightning fan out, with gaps between them.',
    counterplay: 'Stand in a gap between the lanes',
    cooldown: 6,
    telegraphDuration: 0.95,
    damage: 20,
    damageType: 'lightning',
    shape: 'line',
    origin: 'boss',
    radius: 20,
    range: 560,
    count: 3,
    spreadDegrees: 38,
  },
  'static-ring': {
    id: 'static-ring',
    name: 'Static Ring',
    description: 'A charged band snaps outward, leaving the Sentinel clear.',
    counterplay: 'Close in under the ring',
    cooldown: 6,
    telegraphDuration: 1,
    damage: 24,
    damageType: 'lightning',
    shape: 'ring',
    origin: 'boss',
    radius: 310,
    innerRadius: 135,
  },
  'arc-strike': {
    id: 'arc-strike',
    name: 'Arc Strike',
    description: 'A quick bolt called down on the player.',
    counterplay: 'Step out of the circle',
    cooldown: 3.5,
    telegraphDuration: 0.75,
    damage: 18,
    damageType: 'lightning',
    shape: 'disc',
    origin: 'player',
    radius: 70,
  },
  'venom-spray': {
    id: 'venom-spray',
    name: 'Venom Spray',
    description: 'Sprays a wide fan of venom forward.',
    counterplay: 'Get around to its flank',
    cooldown: 5,
    telegraphDuration: 1,
    damage: 22,
    damageType: 'chaos',
    shape: 'cone',
    origin: 'boss',
    radius: 210,
    arcDegrees: 130,
  },
  'spore-fall': {
    id: 'spore-fall',
    name: 'Spore Fall',
    description: 'Four spore pods drift down around the player.',
    counterplay: 'Keep moving clear of the marks',
    cooldown: 6.5,
    telegraphDuration: 1.15,
    damage: 16,
    damageType: 'chaos',
    shape: 'disc',
    origin: 'player',
    radius: 58,
    count: 4,
    scatter: 145,
  },
  cleave: {
    id: 'cleave',
    name: 'Cleave',
    description: 'A heavy overhead swing through a wedge in front.',
    counterplay: 'Get around to its flank',
    cooldown: 4,
    telegraphDuration: 0.85,
    damage: 26,
    damageType: 'physical',
    shape: 'cone',
    origin: 'boss',
    radius: 200,
    arcDegrees: 100,
  },
  'sundering-line': {
    id: 'sundering-line',
    name: 'Sundering Line',
    description: 'Splits the floor along one wide lane.',
    counterplay: 'Step off the lane',
    cooldown: 6,
    telegraphDuration: 1,
    damage: 30,
    damageType: 'physical',
    shape: 'line',
    origin: 'boss',
    radius: 40,
    range: 540,
  },
  'phase-lance': {
    id: 'phase-lance',
    name: 'Phase Lance',
    description: 'A thin, very long lance of light.',
    counterplay: 'Step off the lane',
    cooldown: 4,
    telegraphDuration: 0.7,
    damage: 24,
    damageType: 'lightning',
    shape: 'line',
    origin: 'boss',
    radius: 18,
    range: 620,
  },
  'echo-ring': {
    id: 'echo-ring',
    name: 'Echo Ring',
    description: 'A reflected band of force with a hollow centre.',
    counterplay: 'Close in under the ring',
    cooldown: 5,
    telegraphDuration: 0.95,
    damage: 22,
    damageType: 'lightning',
    shape: 'ring',
    origin: 'boss',
    radius: 290,
    innerRadius: 130,
  },
  'crushing-field': {
    id: 'crushing-field',
    name: 'Crushing Field',
    description: 'Gravity folds inward across everything near the Monolith.',
    counterplay: 'Get out of its reach',
    cooldown: 7.5,
    telegraphDuration: 1.4,
    damage: 32,
    damageType: 'physical',
    shape: 'disc',
    origin: 'boss',
    radius: 200,
  },
  'pillar-fall': {
    id: 'pillar-fall',
    name: 'Pillar Fall',
    description: 'Three stone pillars are aimed down around the player.',
    counterplay: 'Keep moving clear of the marks',
    cooldown: 6,
    telegraphDuration: 1.05,
    damage: 22,
    damageType: 'physical',
    shape: 'disc',
    origin: 'player',
    radius: 66,
    count: 3,
    scatter: 140,
  },
  'void-collapse': {
    id: 'void-collapse',
    name: 'Void Collapse',
    description: 'Space tears in a wide band and folds back to the Voidmaw.',
    counterplay: 'Close in under the ring',
    cooldown: 7,
    telegraphDuration: 1.2,
    damage: 30,
    damageType: 'chaos',
    shape: 'ring',
    origin: 'boss',
    radius: 340,
    innerRadius: 150,
  },
  'devouring-maw': {
    id: 'devouring-maw',
    name: 'Devouring Maw',
    description: 'Three narrow jaws open around the Voidmaw at once.',
    counterplay: 'Stand between the jaws',
    cooldown: 6.5,
    telegraphDuration: 0.95,
    damage: 22,
    damageType: 'chaos',
    shape: 'cone',
    origin: 'boss',
    radius: 260,
    arcDegrees: 46,
    count: 3,
    spreadDegrees: 100,
  },
  rift: {
    id: 'rift',
    name: 'Rift',
    description: 'A hole opens exactly where the player stands.',
    counterplay: 'Step out of the circle',
    cooldown: 4.5,
    telegraphDuration: 0.8,
    damage: 26,
    damageType: 'chaos',
    shape: 'disc',
    origin: 'player',
    radius: 92,
  },
  'fire-nova': {
    id: 'fire-nova',
    name: 'Fire Nova',
    description: 'Fire sheets outward in a band. The Warden stands in the eye.',
    counterplay: 'Close in under the nova',
    cooldown: 4.5,
    telegraphDuration: 0.95,
    damage: 22,
    damageType: 'fire',
    shape: 'ring',
    origin: 'boss',
    radius: 300,
    innerRadius: 125,
  },
  'flame-line': {
    id: 'flame-line',
    name: 'Flame Line',
    description: 'A searing lane of flame toward the player.',
    counterplay: 'Step off the lane',
    cooldown: 5.5,
    telegraphDuration: 0.9,
    damage: 25,
    damageType: 'fire',
    shape: 'line',
    origin: 'boss',
    radius: 34,
    range: 480,
  },
  'meteor-zone': {
    id: 'meteor-zone',
    name: 'Meteor Fall',
    description: 'Three impacts are marked around the player.',
    counterplay: 'Keep moving clear of the marks',
    cooldown: 6,
    telegraphDuration: 1.1,
    damage: 26,
    damageType: 'fire',
    shape: 'disc',
    origin: 'player',
    radius: 64,
    count: 3,
    scatter: 135,
  },
} as const satisfies Record<string, BossSkillDefinition>

export type BossSkillId = keyof typeof BOSS_SKILL_DEFINITIONS

export const BOSS_DEFINITIONS = {
  'stone-golem': {
    id: 'stone-golem',
    name: 'Stone Golem',
    tactics: 'Slow and straightforward. Stay off its lane and out of its arc.',
    radius: 42,
    maxHp: 900,
    speed: 39,
    contactDamage: 12,
    xpReward: 80,
    skills: ['ground-slam', 'stone-sweep', 'charge'],
    render: { shape: 'golem', color: '#78716c', outlineColor: '#e7e5e4' },
    role: 'floor',
    minFloor: 1,
    weight: 10,
  },
  'cinder-hound': {
    id: 'cinder-hound',
    name: 'Cinder Hound',
    tactics: 'Fast and brittle. It overshoots every dash, so punish the recovery.',
    radius: 32,
    maxHp: 700,
    speed: 62,
    contactDamage: 14,
    xpReward: 85,
    skills: ['ember-dash', 'ash-plume'],
    render: { shape: 'beast', color: '#c2410c', outlineColor: '#fed7aa' },
    role: 'floor',
    minFloor: 1,
    weight: 10,
  },
  'grave-herald': {
    id: 'grave-herald',
    name: 'Grave Herald',
    tactics: 'Marks the ground you are standing on. Never stop moving.',
    radius: 38,
    maxHp: 950,
    speed: 44,
    contactDamage: 12,
    xpReward: 100,
    skills: ['grave-spikes', 'sundering-wail'],
    render: { shape: 'herald', color: '#4c1d95', outlineColor: '#ddd6fe' },
    role: 'floor',
    minFloor: 3,
    weight: 9,
  },
  'frostbound-colossus': {
    id: 'frostbound-colossus',
    name: 'Frostbound Colossus',
    tactics: 'Punishes mid-range. Fight it from inside its ring or far outside.',
    radius: 50,
    maxHp: 1250,
    speed: 34,
    contactDamage: 14,
    xpReward: 115,
    skills: ['glacial-ring', 'rime-cone', 'frost-lance'],
    render: { shape: 'colossus', color: '#0e7490', outlineColor: '#a5f3fc' },
    role: 'floor',
    minFloor: 4,
    weight: 8,
  },
  'storm-sentinel': {
    id: 'storm-sentinel',
    name: 'Storm Sentinel',
    tactics: 'Leaves gaps on purpose. Read the lattice and stand in a gap.',
    radius: 40,
    maxHp: 1050,
    speed: 48,
    contactDamage: 12,
    xpReward: 120,
    skills: ['storm-lattice', 'static-ring', 'arc-strike'],
    render: { shape: 'sentinel', color: '#a16207', outlineColor: '#fde68a' },
    role: 'floor',
    minFloor: 5,
    weight: 8,
  },
  'venom-broodmother': {
    id: 'venom-broodmother',
    name: 'Venom Broodmother',
    tactics: 'Everything she does is forward or underfoot. Fight from the side.',
    radius: 46,
    maxHp: 1300,
    speed: 40,
    contactDamage: 15,
    xpReward: 135,
    skills: ['venom-spray', 'spore-fall'],
    render: { shape: 'brood', color: '#4d7c0f', outlineColor: '#d9f99d' },
    role: 'floor',
    minFloor: 7,
    weight: 7,
  },
  'obsidian-warlord': {
    id: 'obsidian-warlord',
    name: 'Obsidian Warlord',
    tactics: 'Hits hardest in front and closes the gap himself. Keep circling.',
    radius: 44,
    maxHp: 1350,
    speed: 50,
    contactDamage: 16,
    xpReward: 150,
    skills: ['cleave', 'sundering-line', 'charge'],
    render: { shape: 'warlord', color: '#1f2937', outlineColor: '#f87171' },
    role: 'floor',
    minFloor: 9,
    weight: 7,
  },
  'mirror-wraith': {
    id: 'mirror-wraith',
    name: 'Mirror Wraith',
    tactics: 'Thin lanes and hollow rings. Neither rewards standing still.',
    radius: 36,
    maxHp: 1200,
    speed: 56,
    contactDamage: 13,
    xpReward: 160,
    skills: ['phase-lance', 'echo-ring'],
    render: { shape: 'wraith', color: '#155e75', outlineColor: '#e0f2fe' },
    role: 'floor',
    minFloor: 11,
    weight: 6,
  },
  'dread-monolith': {
    id: 'dread-monolith',
    name: 'Dread Monolith',
    tactics: 'Barely moves and owns everything near it. Fight it at range.',
    radius: 56,
    maxHp: 1500,
    speed: 20,
    contactDamage: 18,
    xpReward: 180,
    skills: ['crushing-field', 'pillar-fall', 'sundering-line'],
    render: { shape: 'monolith', color: '#3730a3', outlineColor: '#c7d2fe' },
    role: 'floor',
    minFloor: 13,
    weight: 6,
  },
  voidmaw: {
    id: 'voidmaw',
    name: 'Voidmaw',
    tactics: 'Three jaws with gaps, and a ring that is safe at its centre.',
    radius: 48,
    maxHp: 1450,
    speed: 44,
    contactDamage: 16,
    xpReward: 190,
    skills: ['void-collapse', 'devouring-maw', 'rift'],
    render: { shape: 'maw', color: '#581c87', outlineColor: '#f0abfc' },
    role: 'floor',
    minFloor: 16,
    weight: 6,
  },
  'inferno-warden': {
    id: 'inferno-warden',
    name: 'Inferno Warden',
    tactics: 'Grows stronger every second it lives. Stay inside the nova and end it.',
    radius: 48,
    maxHp: 3000,
    speed: 48,
    contactDamage: 12,
    xpReward: 200,
    skills: ['fire-nova', 'flame-line', 'meteor-zone'],
    render: { shape: 'warden', color: '#b91c1c', outlineColor: '#fde047' },
    role: 'final',
    minFloor: 1,
    weight: 0,
    enrage: INFERNO_WARDEN_ENRAGE_DEFINITION,
  },
} as const satisfies Record<string, BossDefinition>

export type BossDefinitionId = keyof typeof BOSS_DEFINITIONS

export const STONE_GOLEM_BOSS_ID: BossDefinitionId = 'stone-golem'
export const INFERNO_WARDEN_BOSS_ID: BossDefinitionId = 'inferno-warden'
export const GROUND_SLAM_SKILL_ID: BossSkillId = 'ground-slam'
export const CHARGE_SKILL_ID: BossSkillId = 'charge'
export const FIRE_NOVA_SKILL_ID: BossSkillId = 'fire-nova'
export const RADIAL_FIRE_NOVA_SKILL_ID = FIRE_NOVA_SKILL_ID
export const FLAME_LINE_SKILL_ID: BossSkillId = 'flame-line'
export const METEOR_ZONE_SKILL_ID: BossSkillId = 'meteor-zone'
export const TARGETED_METEOR_ZONES_SKILL_ID = METEOR_ZONE_SKILL_ID

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

export function isBossDefinitionId(value: string): value is BossDefinitionId {
  return value in BOSS_DEFINITIONS
}

export function isBossSkillId(value: string): value is BossSkillId {
  return value in BOSS_SKILL_DEFINITIONS
}

/** Every boss id, in a stable order. */
export const BOSS_DEFINITION_IDS = Object.keys(
  BOSS_DEFINITIONS,
).sort() as readonly BossDefinitionId[]

/** Boss ids eligible for an ordinary floor, in a stable order. */
export function getFloorBossIds(
  floorNumber: number,
): readonly BossDefinitionId[] {
  const floor = Math.max(1, Math.floor(floorNumber))
  const eligible = BOSS_DEFINITION_IDS.filter((id) => {
    const definition = getBossDefinition(id)
    return definition.role === 'floor' &&
      definition.weight > 0 &&
      definition.minFloor <= floor
  })
  // Floor one must always have something to send, even if the roster is retuned
  // so that nothing is eligible that early.
  return eligible.length > 0 ? eligible : [STONE_GOLEM_BOSS_ID]
}

/**
 * A 32-bit mix of a run seed and a floor number.
 *
 * The boss for a floor has to be the same every time that floor is entered,
 * including after a reload and in the HUD snapshot that is built from the same
 * timeline. Drawing from the run's `RandomSource` would make the answer depend
 * on how many other rolls happened first, so the draw is a pure function of the
 * seed and the floor instead and consumes no sequence at all.
 */
function mixFloorSeed(seed: number, floorNumber: number): number {
  let value = (Math.trunc(seed) ^ (Math.floor(floorNumber) * 0x9e3779b1)) >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad) >>> 0
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97) >>> 0
  return (value ^ (value >>> 15)) >>> 0
}

/** The boss a floor sends, drawn from the run seed and weighted by rarity. */
export function selectFloorBossId(
  seed: number,
  floorNumber: number,
): BossDefinitionId {
  const pool = getFloorBossIds(floorNumber)
  const totalWeight = pool.reduce(
    (total, id) => total + getBossDefinition(id).weight,
    0,
  )
  const roll = (mixFloorSeed(seed, floorNumber) / 0x1_0000_0000) * totalWeight
  let accumulated = 0
  for (const id of pool) {
    accumulated += getBossDefinition(id).weight
    if (roll < accumulated) {
      return id
    }
  }
  return pool[pool.length - 1]!
}
