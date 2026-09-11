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
  /**
   * The summed threat score of enemies touching the character above which it
   * breaks contact even when the local threat is otherwise manageable. Zero
   * means any contact at all; a large value means contact alone never does.
   */
  contactThreatScore: number
  /**
   * Health fraction below which the profile grows more careful. Between this
   * point and zero health the kite threshold slides from `kiteThreatScore`
   * to `lowHealthKiteThreatScore`, and the contact tolerance slides to zero.
   */
  lowHealthRatio: number
  /** The kite threshold the profile reaches at zero health. */
  lowHealthKiteThreatScore: number
  /**
   * How much extra predicted danger the character accepts to step into reach
   * of its target while its attack is ready, compared with staying where it
   * is. This is what turns a melee character's retreat into hit-and-run: a
   * high budget steps in on Brutes and bosses, a low one only on stragglers.
   */
  strikeRiskBudget: number
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
 *
 * Every profile grows more careful as its health falls. The thresholds name
 * where that starts and where it ends, so Aggressive at a quarter health kites
 * the way Balanced does at full health rather than trading hits to the death.
 */
export const BEHAVIOR_PROFILE_DEFINITIONS = {
  aggressive: {
    id: 'aggressive',
    name: 'Aggressive',
    description:
      'Stays on its target and trades hits with lone enemies, breaking off only from packs, heavy hitters, or when badly hurt.',
    intentPriorities: {
      dodge: DODGE_PRIORITY,
      healing: 700,
      gear: 250,
      xp: 450,
      zone: 250,
      kite: 700,
      'combat-range': 800,
      hold: 0,
    },
    thresholds: {
      threatRadius: 180,
      packRadius: 120,
      safeGearDistance: 150,
      safeGearThreatScore: 0,
      kiteThreatScore: 1_000_000,
      /*
       * One ordinary enemy in contact is a trade Aggressive accepts; a Brute,
       * an elite, or a second body on it is not.
       */
      contactThreatScore: 2.5,
      lowHealthRatio: 0.4,
      lowHealthKiteThreatScore: 3,
      strikeRiskBudget: 5,
    },
    commitmentSeconds: 0.2,
    hysteresisPriority: 25,
  },
  balanced: {
    id: 'balanced',
    name: 'Balanced',
    description:
      'Keeps out of reach while it fights, and collects safe gear between engagements.',
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
      contactThreatScore: 0,
      lowHealthRatio: 0.5,
      lowHealthKiteThreatScore: 1.5,
      strikeRiskBudget: 2,
    },
    commitmentSeconds: 0.2,
    hysteresisPriority: 25,
  },
  cautious: {
    id: 'cautious',
    name: 'Cautious',
    description:
      'Kites early and wide around packs and dangerous enemies, closing to attack range only when it is safe to.',
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
      contactThreatScore: 0,
      lowHealthRatio: 0.6,
      lowHealthKiteThreatScore: 0.5,
      strikeRiskBudget: 1,
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
