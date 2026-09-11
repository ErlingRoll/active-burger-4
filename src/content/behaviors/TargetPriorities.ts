/**
 * Who the character attacks, as content rather than code.
 *
 * The behavior profile answers where to stand; this answers who to hit. It is
 * the other half of the same question, so it lives beside the profiles and is
 * shaped the same way: stable ids, a display order, and authored numbers that
 * the evaluator reads without knowing which priority it is evaluating.
 *
 * A priority is a set of weights over facts about each candidate rather than a
 * named rule the evaluator switches on. That keeps the decision here, in
 * content, and leaves `game/` computing the facts — the same split
 * `ThreatScoring.ts` makes, and the reason `content/` never has to import
 * `game/`.
 */
export type TargetPriorityId =
  | 'nearest'
  | 'wounded'
  | 'elites'
  | 'ranged'

/**
 * The facts a priority may weigh, each bounded to roughly zero through one so
 * that weights are comparable across features.
 *
 * `proximity` is what keeps the other features honest: without it a priority
 * would cross the arena for a dying slime. Every priority carries some of it.
 */
export type TargetFeatureKey =
  | 'boss'
  | 'eliteModifierCount'
  | 'missingHealthRatio'
  | 'standoff'
  | 'abilityRange'
  | 'proximity'

export const TARGET_FEATURE_KEYS = [
  'boss',
  'eliteModifierCount',
  'missingHealthRatio',
  'standoff',
  'abilityRange',
  'proximity',
] as const satisfies readonly TargetFeatureKey[]

export interface TargetPriorityPolicy {
  weights: Readonly<Record<TargetFeatureKey, number>>
  /** How long a chosen target is held before a challenger may replace it. */
  commitmentSeconds: number
  /** How far a challenger must beat the current target's score to take over. */
  scoreMargin: number
}

export interface TargetPriorityDefinition extends TargetPriorityPolicy {
  id: TargetPriorityId
  name: string
  description: string
  /** Two words at most: the collapsed HUD toggle has one line for it. */
  shortLabel: string
}

/**
 * Normalisation constants, shared by every priority.
 *
 * The range reference is the longest reach in the enemy roster, the archer's
 * shot, so `abilityRange` is a fraction of the worst case rather than an
 * unbounded number of world units.
 */
export const TARGET_PRIORITY_BALANCE = {
  abilityRangeReference: 560,
} as const

export const DEFAULT_TARGET_PRIORITY_ID: TargetPriorityId = 'nearest'

export const TARGET_PRIORITY_ORDER = [
  'nearest',
  'wounded',
  'elites',
  'ranged',
] as const satisfies readonly TargetPriorityId[]

/**
 * The default weighs nothing at all, and that is load-bearing rather than
 * decorative: the evaluator skips a zero weight instead of multiplying by it,
 * so under `nearest` no fact is ever computed, every candidate scores exactly
 * zero, and the choice collapses to the nearest-then-lowest-id ordering the
 * game has always used.
 */
export const TARGET_PRIORITY_DEFINITIONS = {
  nearest: {
    id: 'nearest',
    name: 'Nearest',
    shortLabel: 'Nearest',
    description: 'Attacks whatever is closest, and keeps hitting it while it lives.',
    weights: {
      boss: 0,
      eliteModifierCount: 0,
      missingHealthRatio: 0,
      standoff: 0,
      abilityRange: 0,
      proximity: 0,
    },
    commitmentSeconds: 0,
    scoreMargin: 0,
  },
  wounded: {
    id: 'wounded',
    name: 'Cull the Weak',
    shortLabel: 'Weakest',
    description:
      'Finishes the most wounded enemy in reach, turning damage already dealt into kills.',
    weights: {
      boss: 0,
      eliteModifierCount: 0,
      missingHealthRatio: 1,
      standoff: 0,
      abilityRange: 0,
      proximity: 0.35,
    },
    // The twitchiest of the three: reacting to a health change is the point.
    commitmentSeconds: 0.5,
    scoreMargin: 0.15,
  },
  elites: {
    id: 'elites',
    name: 'Break the Strong',
    shortLabel: 'Elites',
    description:
      'Attacks bosses first, then elites by how many modifiers they carry, before ordinary enemies.',
    weights: {
      /*
       * Five, not three: an enemy carries at most three elite modifiers, and a
       * boss has to outrank even that one at the far edge of reach, where the
       * proximity term is worth a whole point of difference.
       */
      boss: 5,
      eliteModifierCount: 1,
      missingHealthRatio: 0,
      standoff: 0,
      abilityRange: 0,
      proximity: 0.25,
    },
    // Elites have the most health, so a wrong switch wastes the most damage.
    commitmentSeconds: 1,
    scoreMargin: 0.25,
  },
  ranged: {
    id: 'ranged',
    name: 'Silence the Back',
    shortLabel: 'Ranged',
    description:
      'Attacks enemies that fight from a distance first, the further their own reach the better.',
    weights: {
      boss: 0,
      eliteModifierCount: 0,
      missingHealthRatio: 0,
      standoff: 1.5,
      abilityRange: 1,
      proximity: 0.25,
    },
    commitmentSeconds: 0.75,
    scoreMargin: 0.2,
  },
} as const satisfies Record<TargetPriorityId, TargetPriorityDefinition>

export function isTargetPriorityId(value: unknown): value is TargetPriorityId {
  return typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(TARGET_PRIORITY_DEFINITIONS, value)
}

export function getTargetPriorityDefinition(
  priorityId: TargetPriorityId,
): TargetPriorityDefinition {
  const definition = TARGET_PRIORITY_DEFINITIONS[priorityId]
  if (!definition) {
    throw new Error(`Unknown target priority: ${priorityId}`)
  }
  return definition
}

export function getTargetPriorityPolicy(
  priorityId: TargetPriorityId = DEFAULT_TARGET_PRIORITY_ID,
): TargetPriorityPolicy {
  return getTargetPriorityDefinition(priorityId)
}
