/**
 * Stable identifiers for the player behavior profiles. Profile data is kept
 * separate from the controller so switching profiles never depends on a
 * display label or a renderer.
 */
export type BehaviorProfileId =
  | 'balanced'
  | 'aggressive'
  | 'cautious'

export type BehaviorIntentSource =
  | 'dodge'
  | 'healing'
  | 'gear'
  | 'xp'
  | 'zone'
  | 'kite'
  | 'combat-range'
  | 'hold'

export interface BehaviorProfileThresholds {
  /** Distance at which an enemy contributes to local safety pressure. */
  threatRadius: number
  /** Distance used to calculate an enemy's pack bonus. */
  packRadius: number
  /** Minimum distance from threats for a gear pickup to be considered safe. */
  safeGearDistance: number
  /** Maximum local threat score for a gear pickup to be considered safe. */
  safeGearThreatScore: number
  /** Minimum local threat score required to create a kiting intent. */
  kiteThreatScore: number
}

export interface BehaviorProfilePolicy {
  intentPriorities: Readonly<Record<BehaviorIntentSource, number>>
  thresholds: BehaviorProfileThresholds
  commitmentSeconds: number
  hysteresisPriority: number
}

export interface BehaviorProfileDefinition extends BehaviorProfilePolicy {
  id: BehaviorProfileId
  name: string
  description: string
}

const DODGE_PRIORITY = 1000

export const DEFAULT_BEHAVIOR_PROFILE_ID: BehaviorProfileId = 'balanced'

export const BEHAVIOR_PROFILE_ORDER = [
  'aggressive',
  'balanced',
  'cautious',
] as const satisfies readonly BehaviorProfileId[]

/**
 * The three initially unlocked profiles intentionally share the same
 * emergency Dodge priority. Their non-emergency priorities and thresholds
 * are content data, so the evaluator does not need profile-specific branches.
 */
export const BEHAVIOR_PROFILE_DEFINITIONS = {
  aggressive: {
    id: 'aggressive',
    name: 'Aggressive',
    description: 'Closes to combat range and maintains pressure unless Dodge is imminent.',
    intentPriorities: {
      dodge: DODGE_PRIORITY,
      healing: 700,
      gear: 250,
      xp: 450,
      zone: 250,
      kite: 100,
      'combat-range': 800,
      hold: 0,
    },
    thresholds: {
      threatRadius: 180,
      packRadius: 120,
      safeGearDistance: 150,
      safeGearThreatScore: 0,
      kiteThreatScore: 1_000_000,
    },
    commitmentSeconds: 0.2,
    hysteresisPriority: 25,
  },
    balanced: {
    id: 'balanced',
    name: 'Balanced',
    description: 'Collects safe reachable gear before normal combat pressure.',
    intentPriorities: {
      dodge: DODGE_PRIORITY,
      healing: 750,
      gear: 600,
      xp: 600,
      zone: 500,
      kite: 700,
      'combat-range': 650,
      hold: 0,
    },
    thresholds: {
      threatRadius: 180,
      packRadius: 120,
      safeGearDistance: 150,
      safeGearThreatScore: 3,
      kiteThreatScore: 4,
    },
    commitmentSeconds: 0.2,
    hysteresisPriority: 25,
  },
  cautious: {
    id: 'cautious',
    name: 'Cautious',
    description: 'Kites earlier around packs and high-threat enemies, closing to attack range when needed.',
    intentPriorities: {
      dodge: DODGE_PRIORITY,
      healing: 850,
      gear: 400,
      xp: 500,
      zone: 600,
      kite: 800,
      'combat-range': 600,
      hold: 0,
    },
    thresholds: {
      threatRadius: 220,
      packRadius: 150,
      safeGearDistance: 220,
      safeGearThreatScore: 2,
      kiteThreatScore: 1.5,
    },
    commitmentSeconds: 0.25,
    hysteresisPriority: 35,
  },
} as const satisfies Record<BehaviorProfileId, BehaviorProfileDefinition>

export function isBehaviorProfileId(value: unknown): value is BehaviorProfileId {
  return typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(BEHAVIOR_PROFILE_DEFINITIONS, value)
}

export function getBehaviorProfileDefinition(
  profileId: BehaviorProfileId,
): BehaviorProfileDefinition {
  const definition = BEHAVIOR_PROFILE_DEFINITIONS[profileId]
  if (!definition) {
    throw new Error(`Unknown behavior profile: ${profileId}`)
  }
  return definition
}

export function getBehaviorProfilePolicy(
  profileId: BehaviorProfileId = DEFAULT_BEHAVIOR_PROFILE_ID,
): BehaviorProfilePolicy {
  return getBehaviorProfileDefinition(profileId)
}
