import { RARITIES, RARITY_ORDER, isRarity, type Rarity } from '../rarity/Rarity'
import type { RandomSource } from '../../shared/RandomSource'

/**
 * Artifacts: relics dredged up from the Rift.
 *
 * An artifact is a permanent, tradeable item picked before a dungeon run. It
 * has no downside anywhere on it. Its identity is its base, and every base
 * carries one implicit modifier that changes how a run plays: what the
 * level-up screen offers, what a kill does, what a skill cast does, how
 * moving feels, or what the pre-run meal is worth. On top of the implicit it
 * rolls between one and five modifiers from a shared pool, the count set by a
 * rarity that is itself rolled when the artifact is made.
 *
 * Every roll happens on the server, in `roll_artifact_metadata`, when the
 * instance is inserted. The tables here are the same tables written out for
 * the interface to read and for tests to measure; `Artifacts.test.ts` parses
 * the migration and fails if the two ever disagree. `rollArtifact` below is
 * the client's copy of the roll, for distribution tests and development tools,
 * never for an item a player keeps.
 */

export type ArtifactTier = 1 | 2 | 3 | 4 | 5

/** Tier 1 is the best roll of a modifier's range and tier 5 the worst. */
export const ARTIFACT_TIERS = [1, 2, 3, 4, 5] as const satisfies readonly ArtifactTier[]

export type ArtifactBaseId =
  | 'cartographers-compass'
  | 'ember-reliquary'
  | 'echoing-tuning-fork'
  | 'wayfarers-anklet'
  | 'gluttons-kettle'

export type ArtifactImplicitId =
  | 'charted-choices'
  | 'corpse-detonation'
  | 'skill-echo'
  | 'momentum'
  | 'hearty-meal'

export type ArtifactModifierId =
  | 'max-hp'
  | 'movement-speed'
  | 'attack-speed'
  | 'cooldown-reduction'
  | 'area-of-effect'
  | 'crit-chance'
  | 'crit-multiplier'
  | 'increased-damage'
  | 'dot-multiplier'
  | 'melee-leech'
  | 'kill-area-surge'
  | 'kill-cooldown-reset'
  | 'primed-strike'
  | 'last-stand'
  | 'floor-heal'
  | 'elite-damage'
  | 'experience-gain'
  | 'healing-received'

export interface ArtifactTierRange {
  readonly min: number
  readonly max: number
}

export type ArtifactTierRanges = Readonly<Record<ArtifactTier, ArtifactTierRange>>

/**
 * One effect an artifact can carry, whether as the base's implicit or as a
 * rolled modifier. The `description` has a `#` where the rolled value goes.
 */
export interface ArtifactEffectDefinition<Id extends string = string> {
  readonly id: Id
  readonly label: string
  readonly description: string
  readonly tiers: ArtifactTierRanges
}

export type ArtifactImplicitDefinition = ArtifactEffectDefinition<ArtifactImplicitId>
export type ArtifactModifierDefinition = ArtifactEffectDefinition<ArtifactModifierId>

export interface ArtifactBaseDefinition {
  readonly id: ArtifactBaseId
  /** The inventory definition id every instance of this base is granted as. */
  readonly definitionId: string
  readonly name: string
  readonly flavorText: string
  readonly icon: string
  readonly accent: string
  readonly implicit: ArtifactImplicitDefinition
}

export const ARTIFACT_DEFINITION_ID_PREFIX = 'artifact-'

/**
 * Per hundred. Rolled when the artifact is made, whatever box it came from; a
 * legendary is one artifact in fifty.
 */
export const ARTIFACT_RARITY_WEIGHTS = {
  common: 40,
  uncommon: 30,
  rare: 18,
  epic: 10,
  legendary: 2,
} as const satisfies Record<Rarity, number>

export const ARTIFACT_RARITY_ROLL_RANGE = 100

/** Per hundred, best tier first. The good rolls are the rare ones. */
export const ARTIFACT_TIER_WEIGHTS = {
  1: 5,
  2: 12,
  3: 20,
  4: 28,
  5: 35,
} as const satisfies Record<ArtifactTier, number>

export const ARTIFACT_TIER_ROLL_RANGE = 100

export const ARTIFACT_MODIFIER_COUNTS = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
} as const satisfies Record<Rarity, number>

/** Scrap paid for salvaging an artifact, by rarity. Never Essence. */
export const ARTIFACT_SALVAGE_SCRAP = {
  common: 2,
  uncommon: 4,
  rare: 8,
  epic: 14,
  legendary: 24,
} as const satisfies Record<Rarity, number>

/** Seconds the on-kill area surge lasts. Written into the description too. */
export const ARTIFACT_KILL_AREA_SURGE_SECONDS = 4
/** Below this share of max HP, Last Stand is on. */
export const ARTIFACT_LAST_STAND_HP_PERCENT = 35
/** Every this-many skill casts, the Tuning Fork echoes one. */
export const ARTIFACT_SKILL_ECHO_INTERVAL = 3
/** Seconds of movement to build full Momentum, and the grace before it fades. */
export const ARTIFACT_MOMENTUM_BUILD_SECONDS = 2
export const ARTIFACT_MOMENTUM_GRACE_SECONDS = 1

function defineTiers(
  tier1: ArtifactTierRange,
  tier2: ArtifactTierRange,
  tier3: ArtifactTierRange,
  tier4: ArtifactTierRange,
  tier5: ArtifactTierRange,
): ArtifactTierRanges {
  return { 1: tier1, 2: tier2, 3: tier3, 4: tier4, 5: tier5 }
}

/** The ladder most percentage lines share: five to eight at the bottom, twenty to twenty-five at the top. */
const STANDARD_PERCENT_TIERS = defineTiers(
  { min: 20, max: 25 },
  { min: 16, max: 19 },
  { min: 12, max: 15 },
  { min: 9, max: 11 },
  { min: 5, max: 8 },
)

/** The lower ladder, for lines that touch every hit: four to six up to fifteen to twenty. */
const MODEST_PERCENT_TIERS = defineTiers(
  { min: 15, max: 20 },
  { min: 12, max: 14 },
  { min: 9, max: 11 },
  { min: 7, max: 8 },
  { min: 4, max: 6 },
)

/** The big-number ladder for effects that only fire now and then. */
const BURST_PERCENT_TIERS = defineTiers(
  { min: 40, max: 50 },
  { min: 30, max: 39 },
  { min: 22, max: 29 },
  { min: 16, max: 21 },
  { min: 10, max: 15 },
)

export const ARTIFACT_MODIFIER_DEFINITIONS = {
  'max-hp': {
    id: 'max-hp',
    label: 'Maximum HP',
    description: '+#% maximum HP',
    tiers: defineTiers(
      { min: 14, max: 18 },
      { min: 11, max: 13 },
      { min: 8, max: 10 },
      { min: 6, max: 7 },
      { min: 4, max: 5 },
    ),
  },
  'movement-speed': {
    id: 'movement-speed',
    label: 'Movement speed',
    description: '+#% movement speed',
    tiers: defineTiers(
      { min: 10, max: 12 },
      { min: 8, max: 9 },
      { min: 6, max: 7 },
      { min: 4, max: 5 },
      { min: 3, max: 3 },
    ),
  },
  'attack-speed': {
    id: 'attack-speed',
    label: 'Attack speed',
    description: '+#% attack speed',
    tiers: defineTiers(
      { min: 12, max: 15 },
      { min: 10, max: 11 },
      { min: 8, max: 9 },
      { min: 6, max: 7 },
      { min: 3, max: 5 },
    ),
  },
  'cooldown-reduction': {
    id: 'cooldown-reduction',
    label: 'Cooldown reduction',
    description: '#% cooldown reduction',
    tiers: defineTiers(
      { min: 12, max: 15 },
      { min: 10, max: 11 },
      { min: 8, max: 9 },
      { min: 6, max: 7 },
      { min: 3, max: 5 },
    ),
  },
  'area-of-effect': {
    id: 'area-of-effect',
    label: 'Area of effect',
    description: '+#% area of effect',
    tiers: STANDARD_PERCENT_TIERS,
  },
  'crit-chance': {
    id: 'crit-chance',
    label: 'Critical strike chance',
    description: '+#% critical strike chance',
    tiers: defineTiers(
      { min: 6, max: 8 },
      { min: 5, max: 5 },
      { min: 4, max: 4 },
      { min: 3, max: 3 },
      { min: 1, max: 2 },
    ),
  },
  'crit-multiplier': {
    id: 'crit-multiplier',
    label: 'Critical strike multiplier',
    description: '+#% critical strike multiplier',
    tiers: BURST_PERCENT_TIERS,
  },
  'increased-damage': {
    id: 'increased-damage',
    label: 'Increased damage',
    description: '#% increased damage',
    tiers: MODEST_PERCENT_TIERS,
  },
  'dot-multiplier': {
    id: 'dot-multiplier',
    label: 'Damage over time',
    description: '#% increased damage over time',
    tiers: STANDARD_PERCENT_TIERS,
  },
  'melee-leech': {
    id: 'melee-leech',
    label: 'Melee leech',
    description: '#% of melee damage leeched as life',
    tiers: defineTiers(
      { min: 3, max: 3 },
      { min: 3, max: 3 },
      { min: 2, max: 2 },
      { min: 2, max: 2 },
      { min: 1, max: 1 },
    ),
  },
  'kill-area-surge': {
    id: 'kill-area-surge',
    label: 'Area surge on kill',
    description: `#% increased area of effect for ${ARTIFACT_KILL_AREA_SURGE_SECONDS} seconds on kill`,
    tiers: BURST_PERCENT_TIERS,
  },
  'kill-cooldown-reset': {
    id: 'kill-cooldown-reset',
    label: 'Cooldown reset on kill',
    description: '#% chance on kill to reset a random skill cooldown',
    tiers: defineTiers(
      { min: 10, max: 14 },
      { min: 7, max: 9 },
      { min: 5, max: 6 },
      { min: 4, max: 4 },
      { min: 2, max: 3 },
    ),
  },
  'primed-strike': {
    id: 'primed-strike',
    label: 'Primed strike',
    description: 'Casting a skill primes your next Basic Attack for #% more damage',
    tiers: defineTiers(
      { min: 60, max: 80 },
      { min: 45, max: 59 },
      { min: 35, max: 44 },
      { min: 25, max: 34 },
      { min: 15, max: 24 },
    ),
  },
  'last-stand': {
    id: 'last-stand',
    label: 'Last stand',
    description: `+#% physical and elemental resistance while below ${ARTIFACT_LAST_STAND_HP_PERCENT}% HP`,
    tiers: STANDARD_PERCENT_TIERS,
  },
  'floor-heal': {
    id: 'floor-heal',
    label: 'Second wind',
    description: 'Recover #% of maximum HP on descending a floor',
    tiers: BURST_PERCENT_TIERS,
  },
  'elite-damage': {
    id: 'elite-damage',
    label: 'Elite damage',
    description: '#% increased damage to elites and bosses',
    tiers: defineTiers(
      { min: 18, max: 22 },
      { min: 14, max: 17 },
      { min: 11, max: 13 },
      { min: 8, max: 10 },
      { min: 5, max: 7 },
    ),
  },
  'experience-gain': {
    id: 'experience-gain',
    label: 'Experience',
    description: '+#% experience gained',
    tiers: MODEST_PERCENT_TIERS,
  },
  'healing-received': {
    id: 'healing-received',
    label: 'Healing received',
    description: '+#% healing received',
    tiers: STANDARD_PERCENT_TIERS,
  },
} as const satisfies Record<ArtifactModifierId, ArtifactModifierDefinition>

export const ARTIFACT_MODIFIER_IDS = Object.keys(
  ARTIFACT_MODIFIER_DEFINITIONS,
) as readonly ArtifactModifierId[]

export const ALL_ARTIFACT_MODIFIER_DEFINITIONS: readonly ArtifactModifierDefinition[] =
  Object.values(ARTIFACT_MODIFIER_DEFINITIONS)

export const ARTIFACT_BASE_DEFINITIONS = {
  'cartographers-compass': {
    id: 'cartographers-compass',
    definitionId: 'artifact-cartographers-compass',
    name: "Cartographer's Compass",
    flavorText: 'Its needle never points north. It points at whatever you were about to become.',
    icon: '✵',
    accent: 'var(--color-sky-300)',
    implicit: {
      id: 'charted-choices',
      label: 'Charted choices',
      description: 'Level-ups offer one extra choice, and each choice has a #% chance to arrive one rarity higher',
      tiers: defineTiers(
        { min: 9, max: 10 },
        { min: 8, max: 8 },
        { min: 7, max: 7 },
        { min: 6, max: 6 },
        { min: 5, max: 5 },
      ),
    },
  },
  'ember-reliquary': {
    id: 'ember-reliquary',
    definitionId: 'artifact-ember-reliquary',
    name: 'Ember Reliquary',
    flavorText: 'A coal that has not gone out since the Rift opened. Everything it touches remembers how to burn.',
    icon: '❂',
    accent: 'var(--color-orange-400)',
    implicit: {
      id: 'corpse-detonation',
      label: 'Corpse detonation',
      description: 'Enemies you kill detonate for #% of their maximum HP as fire damage in an area',
      tiers: defineTiers(
        { min: 44, max: 50 },
        { min: 38, max: 43 },
        { min: 32, max: 37 },
        { min: 26, max: 31 },
        { min: 20, max: 25 },
      ),
    },
  },
  'echoing-tuning-fork': {
    id: 'echoing-tuning-fork',
    definitionId: 'artifact-echoing-tuning-fork',
    name: 'Echoing Tuning Fork',
    flavorText: 'Strike it once and the Rift answers a beat late, and slightly louder.',
    icon: '♪',
    accent: 'var(--color-violet-300)',
    implicit: {
      id: 'skill-echo',
      label: 'Skill echo',
      description: `Every ${ARTIFACT_SKILL_ECHO_INTERVAL === 3 ? 'third' : String(ARTIFACT_SKILL_ECHO_INTERVAL)} skill you cast is echoed once at #% effectiveness`,
      tiers: defineTiers(
        { min: 49, max: 55 },
        { min: 43, max: 48 },
        { min: 37, max: 42 },
        { min: 31, max: 36 },
        { min: 25, max: 30 },
      ),
    },
  },
  'wayfarers-anklet': {
    id: 'wayfarers-anklet',
    definitionId: 'artifact-wayfarers-anklet',
    name: "Wayfarer's Anklet",
    flavorText: "Worn by a courier who outran the Rift's closing. She never did learn to stand still.",
    icon: '⟳',
    accent: 'var(--color-emerald-300)',
    implicit: {
      id: 'momentum',
      label: 'Momentum',
      description: `Moving builds Momentum over ${ARTIFACT_MOMENTUM_BUILD_SECONDS} seconds, up to +#% attack speed and movement speed, lost ${ARTIFACT_MOMENTUM_GRACE_SECONDS} second after stopping`,
      tiers: defineTiers(
        { min: 18, max: 20 },
        { min: 15, max: 17 },
        { min: 13, max: 14 },
        { min: 10, max: 12 },
        { min: 8, max: 9 },
      ),
    },
  },
  'gluttons-kettle': {
    id: 'gluttons-kettle',
    definitionId: 'artifact-gluttons-kettle',
    name: "Glutton's Kettle",
    flavorText: 'The pond folk swear it is bottomless. It is, in the way that matters: nothing put in is ever wasted.',
    icon: '☖',
    accent: 'var(--color-amber-400)',
    implicit: {
      id: 'hearty-meal',
      label: 'Hearty meal',
      description: 'The pre-run meal takes a sixth fish, and meal effects are #% stronger',
      tiers: defineTiers(
        { min: 26, max: 30 },
        { min: 22, max: 25 },
        { min: 18, max: 21 },
        { min: 14, max: 17 },
        { min: 10, max: 13 },
      ),
    },
  },
} as const satisfies Record<ArtifactBaseId, ArtifactBaseDefinition>

export const ARTIFACT_BASE_IDS = Object.keys(
  ARTIFACT_BASE_DEFINITIONS,
) as readonly ArtifactBaseId[]

export const ALL_ARTIFACT_BASE_DEFINITIONS: readonly ArtifactBaseDefinition[] =
  Object.values(ARTIFACT_BASE_DEFINITIONS)

export function isArtifactBaseId(value: unknown): value is ArtifactBaseId {
  return typeof value === 'string' && Object.hasOwn(ARTIFACT_BASE_DEFINITIONS, value)
}

export function isArtifactModifierId(value: unknown): value is ArtifactModifierId {
  return typeof value === 'string' && Object.hasOwn(ARTIFACT_MODIFIER_DEFINITIONS, value)
}

export function isArtifactTier(value: unknown): value is ArtifactTier {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5
}

export function getArtifactBaseDefinition(baseId: string): ArtifactBaseDefinition | undefined {
  return isArtifactBaseId(baseId) ? ARTIFACT_BASE_DEFINITIONS[baseId] : undefined
}

/** The base behind an inventory definition id, or nothing if it is not an artifact. */
export function getArtifactBaseByDefinitionId(
  definitionId: string,
): ArtifactBaseDefinition | undefined {
  if (!definitionId.startsWith(ARTIFACT_DEFINITION_ID_PREFIX)) {
    return undefined
  }
  return getArtifactBaseDefinition(definitionId.slice(ARTIFACT_DEFINITION_ID_PREFIX.length))
}

export function isArtifactDefinitionId(definitionId: string): boolean {
  return getArtifactBaseByDefinitionId(definitionId) !== undefined
}

export function getArtifactModifierDefinition(
  modifierId: string,
): ArtifactModifierDefinition | undefined {
  return isArtifactModifierId(modifierId) ? ARTIFACT_MODIFIER_DEFINITIONS[modifierId] : undefined
}

export interface ArtifactRolledEffect<Id extends string = string> {
  readonly id: Id
  readonly tier: ArtifactTier
  readonly value: number
}

/**
 * What the server writes into an artifact instance's metadata, and what the
 * run snapshot later copies. Nothing else on an artifact is authoritative.
 */
export interface ArtifactMetadata {
  readonly baseId: ArtifactBaseId
  readonly rarity: Rarity
  readonly implicit: ArtifactRolledEffect<ArtifactImplicitId>
  readonly modifiers: readonly ArtifactRolledEffect<ArtifactModifierId>[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRolledEffect(value: unknown): value is ArtifactRolledEffect {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    isArtifactTier(value.tier) &&
    typeof value.value === 'number' &&
    Number.isFinite(value.value)
}

/**
 * True when the metadata is a complete artifact the client knows how to read.
 * An artifact whose base or modifiers this build does not recognise is not
 * one it should describe or apply, so the check is strict rather than lenient.
 */
export function isArtifactMetadata(value: unknown): value is ArtifactMetadata {
  if (!isRecord(value) || !isArtifactBaseId(value.baseId) || !isRarity(value.rarity)) {
    return false
  }
  const base = ARTIFACT_BASE_DEFINITIONS[value.baseId]
  if (!isRolledEffect(value.implicit) || value.implicit.id !== base.implicit.id) {
    return false
  }
  if (!Array.isArray(value.modifiers)) {
    return false
  }
  const seen = new Set<string>()
  for (const modifier of value.modifiers) {
    if (!isRolledEffect(modifier) || !isArtifactModifierId(modifier.id) || seen.has(modifier.id)) {
      return false
    }
    seen.add(modifier.id)
  }
  return true
}

/** The artifact on an inventory item, if the item is one. */
export function readArtifactMetadata(
  definitionId: string,
  metadata: Record<string, unknown>,
): ArtifactMetadata | null {
  const base = getArtifactBaseByDefinitionId(definitionId)
  if (!base || !isArtifactMetadata(metadata) || metadata.baseId !== base.id) {
    return null
  }
  return metadata
}

function pickWeighted<Key extends string | number>(
  weights: Readonly<Record<Key, number>>,
  keys: readonly Key[],
  roll: number,
): Key {
  let cutoff = 0
  for (const key of keys) {
    cutoff += weights[key]
    if (roll < cutoff) {
      return key
    }
  }
  return keys[keys.length - 1] as Key
}

export function rollArtifactRarity(random: RandomSource): Rarity {
  return pickWeighted(
    ARTIFACT_RARITY_WEIGHTS,
    RARITIES,
    random.int(0, ARTIFACT_RARITY_ROLL_RANGE - 1),
  )
}

export function rollArtifactTier(random: RandomSource): ArtifactTier {
  return pickWeighted(
    ARTIFACT_TIER_WEIGHTS,
    ARTIFACT_TIERS,
    random.int(0, ARTIFACT_TIER_ROLL_RANGE - 1),
  )
}

function rollEffect<Id extends string>(
  definition: ArtifactEffectDefinition<Id>,
  random: RandomSource,
): ArtifactRolledEffect<Id> {
  const tier = rollArtifactTier(random)
  const range = definition.tiers[tier]
  return { id: definition.id, tier, value: random.int(range.min, range.max) }
}

/**
 * The client's copy of the server roll. Same tables, same shape, so that a
 * seeded distribution test measures what a player will actually be handed.
 */
export function rollArtifact(baseId: ArtifactBaseId, random: RandomSource): ArtifactMetadata {
  const base = ARTIFACT_BASE_DEFINITIONS[baseId]
  const rarity = rollArtifactRarity(random)
  const implicit = rollEffect(base.implicit, random)
  const remaining = [...ARTIFACT_MODIFIER_IDS]
  const modifiers: ArtifactRolledEffect<ArtifactModifierId>[] = []
  while (modifiers.length < ARTIFACT_MODIFIER_COUNTS[rarity] && remaining.length > 0) {
    const chosen = random.pick(remaining)
    remaining.splice(remaining.indexOf(chosen), 1)
    modifiers.push(rollEffect(ARTIFACT_MODIFIER_DEFINITIONS[chosen], random))
  }
  return { baseId, rarity, implicit, modifiers }
}

/** The description with its rolled value in place of the `#`. */
export function formatArtifactEffect(
  definition: ArtifactEffectDefinition,
  rolled: ArtifactRolledEffect,
): string {
  return definition.description.replace('#', String(rolled.value))
}

export interface ArtifactEffectLine {
  readonly id: string
  readonly kind: 'implicit' | 'modifier'
  readonly label: string
  readonly tier: ArtifactTier
  readonly text: string
}

/** Every line an artifact's card shows, implicit first, then modifiers in pool order. */
export function describeArtifact(metadata: ArtifactMetadata): ArtifactEffectLine[] {
  const base = ARTIFACT_BASE_DEFINITIONS[metadata.baseId]
  const lines: ArtifactEffectLine[] = [{
    id: base.implicit.id,
    kind: 'implicit',
    label: base.implicit.label,
    tier: metadata.implicit.tier,
    text: formatArtifactEffect(base.implicit, metadata.implicit),
  }]
  const ordered = [...metadata.modifiers].sort(
    (left, right) => ARTIFACT_MODIFIER_IDS.indexOf(left.id) - ARTIFACT_MODIFIER_IDS.indexOf(right.id),
  )
  for (const modifier of ordered) {
    const definition = ARTIFACT_MODIFIER_DEFINITIONS[modifier.id]
    lines.push({
      id: modifier.id,
      kind: 'modifier',
      label: definition.label,
      tier: modifier.tier,
      text: formatArtifactEffect(definition, modifier),
    })
  }
  return lines
}

function formatModifierCount(metadata: ArtifactMetadata): string {
  const count = metadata.modifiers.length
  return `${count} ${count === 1 ? 'modifier' : 'modifiers'}`
}

/** One line for a compact slot detail: the implicit's text, then the count. */
export function formatArtifactSummary(metadata: ArtifactMetadata): string {
  const base = ARTIFACT_BASE_DEFINITIONS[metadata.baseId]
  return `${formatArtifactEffect(base.implicit, metadata.implicit)} · ${formatModifierCount(metadata)}`
}

/**
 * The shortest true line: the implicit's name and its tier, then the count.
 * For a slot whose card is drawn right underneath, where repeating the
 * implicit's whole sentence would only cost the height.
 */
export function formatArtifactHeadline(metadata: ArtifactMetadata): string {
  const base = ARTIFACT_BASE_DEFINITIONS[metadata.baseId]
  return `${base.implicit.label}, tier ${metadata.implicit.tier} · ${formatModifierCount(metadata)}`
}

export function getArtifactSalvageScrap(rarity: Rarity): number {
  return ARTIFACT_SALVAGE_SCRAP[rarity]
}

/** Higher is rarer; used to sort a shelf of artifacts best first. */
export function getArtifactRarityOrder(metadata: ArtifactMetadata): number {
  return RARITY_ORDER[metadata.rarity]
}

function validateTiers(errors: string[], owner: string, tiers: ArtifactTierRanges): void {
  let previousMin = Number.POSITIVE_INFINITY
  for (const tier of ARTIFACT_TIERS) {
    const range = tiers[tier]
    if (!Number.isInteger(range.min) || !Number.isInteger(range.max)) {
      errors.push(`${owner} tier ${tier} must use integer bounds.`)
    }
    if (range.min < 1) {
      errors.push(`${owner} tier ${tier} must be a positive roll: artifacts have no downsides.`)
    }
    if (range.max < range.min) {
      errors.push(`${owner} tier ${tier} has max below min.`)
    }
    if (range.max > previousMin) {
      errors.push(`${owner} tier ${tier} overlaps the tier above it.`)
    }
    previousMin = range.min
  }
}

/** Errors in the tables themselves; an empty list means they are sound. */
export function validateArtifactDefinitions(): string[] {
  const errors: string[] = []
  const rarityTotal = RARITIES.reduce((total, rarity) => total + ARTIFACT_RARITY_WEIGHTS[rarity], 0)
  if (rarityTotal !== ARTIFACT_RARITY_ROLL_RANGE) {
    errors.push(`Artifact rarity weights sum to ${rarityTotal}, not ${ARTIFACT_RARITY_ROLL_RANGE}.`)
  }
  const tierTotal = ARTIFACT_TIERS.reduce((total, tier) => total + ARTIFACT_TIER_WEIGHTS[tier], 0)
  if (tierTotal !== ARTIFACT_TIER_ROLL_RANGE) {
    errors.push(`Artifact tier weights sum to ${tierTotal}, not ${ARTIFACT_TIER_ROLL_RANGE}.`)
  }
  for (const rarity of RARITIES) {
    if (ARTIFACT_MODIFIER_COUNTS[rarity] !== RARITY_ORDER[rarity] + 1) {
      errors.push(`Artifact modifier count for ${rarity} must be its rarity rank plus one.`)
    }
  }
  const implicitIds = new Set<string>()
  for (const base of ALL_ARTIFACT_BASE_DEFINITIONS) {
    if (base.definitionId !== `${ARTIFACT_DEFINITION_ID_PREFIX}${base.id}`) {
      errors.push(`Artifact ${base.id} must be granted as ${ARTIFACT_DEFINITION_ID_PREFIX}${base.id}.`)
    }
    if (!base.implicit.description.includes('#')) {
      errors.push(`Artifact ${base.id} implicit has nowhere to print its value.`)
    }
    if (implicitIds.has(base.implicit.id)) {
      errors.push(`Artifact implicit ${base.implicit.id} is shared by two bases.`)
    }
    implicitIds.add(base.implicit.id)
    validateTiers(errors, `Artifact ${base.id} implicit`, base.implicit.tiers)
  }
  for (const modifier of ALL_ARTIFACT_MODIFIER_DEFINITIONS) {
    if (!modifier.description.includes('#')) {
      errors.push(`Artifact modifier ${modifier.id} has nowhere to print its value.`)
    }
    validateTiers(errors, `Artifact modifier ${modifier.id}`, modifier.tiers)
  }
  if (ALL_ARTIFACT_MODIFIER_DEFINITIONS.length < ARTIFACT_MODIFIER_COUNTS.legendary) {
    errors.push('The artifact modifier pool is smaller than a legendary needs.')
  }
  return errors
}
