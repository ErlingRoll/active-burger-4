import {
  ARTIFACT_BASE_DEFINITIONS,
  ARTIFACT_MODIFIER_DEFINITIONS,
  getArtifactPotential,
  type ArtifactMetadata,
  type ArtifactModifierId,
} from '../content/artifacts/Artifacts'
import { RARITY_VISUALS, nextRarity, type Rarity } from '../content/rarity/Rarity'

/**
 * What the Forge charges and what it promises, mirrored from the server so
 * the bench can say what a strike costs and how likely each outcome is
 * before it is asked for. `work_artifact_at_forge` decides for itself;
 * `Forge.test.ts` reads the migration to keep these figures the same.
 *
 * A strike names a target: one line to raise a tier, or a promotion, which
 * lifts the rarity and adds a modifier. The player stakes Essence on top of
 * a fixed fee. The stake raises the chance the strike lands and the chance
 * it lands where it was aimed, along a curve with diminishing returns, and
 * it never makes either certain. A miss costs a little Potential; one miss
 * in five also slips a line down a tier. At nought Potential the artifact
 * is finished.
 */

/** The most Essence one strike can carry. */
export const FORGE_ESSENCE_CAP = 100_000
/** The stake at which half of each bonus has been earned. */
export const FORGE_ESSENCE_HALF_POINT = 25_000

/** Basis points: ten thousand is certainty. */
export const FORGE_BASE_SUCCESS_BP = 3000
export const FORGE_SUCCESS_BONUS_BP = 4500
export const FORGE_BASE_FOCUS_BP = 6000
export const FORGE_FOCUS_BONUS_BP = 2500
export const FORGE_SETBACK_BP = 2000

/** Potential a strike spends, inclusive, by whether it landed. */
export const FORGE_POTENTIAL_COST = {
  landed: { min: 10, max: 20 },
  missed: { min: 1, max: 10 },
} as const

export interface ForgeFee {
  readonly stone: number
  readonly scrap: number
  readonly riftShards: number
}

/** The fixed fee for one strike, by the artifact's rarity. */
export const FORGE_FEES: Readonly<Record<Rarity, ForgeFee>> = {
  common: { stone: 10, scrap: 10, riftShards: 1 },
  uncommon: { stone: 20, scrap: 20, riftShards: 2 },
  rare: { stone: 40, scrap: 30, riftShards: 3 },
  epic: { stone: 80, scrap: 45, riftShards: 5 },
  legendary: { stone: 160, scrap: 70, riftShards: 8 },
}

/** The fee as the Camp's cost rows read it: definition id to quantity. */
export function forgeFeeAsCost(fee: ForgeFee): Readonly<Record<string, number>> {
  return { stone: fee.stone, scrap: fee.scrap, 'rift-shard': fee.riftShards }
}

export interface ForgeOdds {
  /** Chance the strike lands at all. */
  readonly successBp: number
  /** Given that it lands, the chance it lands on the line aimed at. */
  readonly focusBp: number
  /** Given that it misses, the chance a line slips a tier. */
  readonly setbackBp: number
}

/** Clamps a stake to what the Forge accepts, as a whole number of Essence. */
export function clampForgeStake(essence: number): number {
  if (!Number.isFinite(essence)) {
    return 0
  }
  return Math.min(FORGE_ESSENCE_CAP, Math.max(0, Math.floor(essence)))
}

/**
 * The odds for a stake. Integer arithmetic, the same as the SQL, so the
 * figure the bench shows is the figure the server rolls against.
 */
export function forgeOdds(essence: number): ForgeOdds {
  const stake = clampForgeStake(essence)
  const curve = (bonus: number): number =>
    Math.floor((bonus * stake) / (stake + FORGE_ESSENCE_HALF_POINT))
  return {
    successBp: FORGE_BASE_SUCCESS_BP + curve(FORGE_SUCCESS_BONUS_BP),
    focusBp: FORGE_BASE_FOCUS_BP + curve(FORGE_FOCUS_BONUS_BP),
    setbackBp: FORGE_SETBACK_BP,
  }
}

export type ForgeTarget = 'implicit' | 'promote' | `modifier:${ArtifactModifierId}`

export interface ForgeTargetOption {
  readonly target: ForgeTarget
  readonly label: string
  /** For a line, its tier now and the tier a strike would take it to. */
  readonly tier: number | null
  readonly nextTier: number | null
}

export function isForgeTarget(value: unknown): value is ForgeTarget {
  return value === 'implicit' || value === 'promote' ||
    (typeof value === 'string' && value.startsWith('modifier:') &&
      Object.hasOwn(ARTIFACT_MODIFIER_DEFINITIONS, value.slice('modifier:'.length)))
}

/** The key the server uses for a line, as `work_artifact_at_forge` reads it. */
export function forgeLineKey(kind: 'implicit' | 'modifier', id: string): string {
  return kind === 'implicit' ? 'implicit' : `modifier:${id}`
}

/** What a strike on this artifact can aim at: every line above tier one, then a promotion. */
export function listForgeTargets(artifact: ArtifactMetadata): ForgeTargetOption[] {
  const base = ARTIFACT_BASE_DEFINITIONS[artifact.baseId]
  const options: ForgeTargetOption[] = []
  if (artifact.implicit.tier > 1) {
    options.push({
      target: 'implicit',
      label: base.implicit.label,
      tier: artifact.implicit.tier,
      nextTier: artifact.implicit.tier - 1,
    })
  }
  for (const modifier of artifact.modifiers) {
    if (modifier.tier > 1) {
      options.push({
        target: `modifier:${modifier.id}`,
        label: ARTIFACT_MODIFIER_DEFINITIONS[modifier.id].label,
        tier: modifier.tier,
        nextTier: modifier.tier - 1,
      })
    }
  }
  const promoted = nextRarity(artifact.rarity)
  if (promoted) {
    options.push({
      target: 'promote',
      label: `Promote to ${RARITY_VISUALS[promoted].label.toLowerCase()}, adding a modifier`,
      tier: null,
      nextTier: null,
    })
  }
  return options
}

/** The name of whatever line a key points at, for telling the player what moved. */
export function describeForgeLine(artifact: ArtifactMetadata, key: string): string {
  if (key === 'implicit') {
    return ARTIFACT_BASE_DEFINITIONS[artifact.baseId].implicit.label
  }
  if (key === 'promote') {
    return `Promoted to ${RARITY_VISUALS[artifact.rarity].label.toLowerCase()}`
  }
  const id = key.startsWith('modifier:') ? key.slice('modifier:'.length) : key
  return Object.hasOwn(ARTIFACT_MODIFIER_DEFINITIONS, id)
    ? ARTIFACT_MODIFIER_DEFINITIONS[id as ArtifactModifierId].label
    : id
}

export interface ForgeOutcomeOdds {
  /** The strike lands on the line aimed at. */
  readonly target: number
  /** The strike lands on another line, or as a promotion. */
  readonly stray: number
  /** Nothing moves but the Potential. */
  readonly miss: number
  /** A miss that also slips a line down a tier. */
  readonly setback: number
}

/**
 * The four outcomes of one strike, in basis points that sum to ten thousand,
 * the way the server resolves them: a stray needs somewhere else to land,
 * and a setback needs a line that can still slip.
 */
export function describeForgeOutcomes(
  artifact: ArtifactMetadata,
  target: ForgeTarget,
  essence: number,
): ForgeOutcomeOdds {
  const odds = forgeOdds(essence)
  const targets = listForgeTargets(artifact)
  const alternatives = targets.filter((option) => option.target !== target).length
  const droppable = [artifact.implicit, ...artifact.modifiers].filter((line) => line.tier < 5).length
  const success = odds.successBp
  const failure = 10_000 - success
  const stray = alternatives > 0 ? Math.round((success * (10_000 - odds.focusBp)) / 10_000) : 0
  const setback = droppable > 0 ? Math.round((failure * odds.setbackBp) / 10_000) : 0
  return {
    target: success - stray,
    stray,
    miss: failure - setback,
    setback,
  }
}

/** Basis points as a percentage with one decimal where it matters: 5250 reads 52.5%. */
export function formatBasisPoints(bp: number): string {
  const percent = bp / 100
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`
}

/** True once an artifact's Potential is spent; the Forge refuses it from then on. */
export function isArtifactFinished(artifact: ArtifactMetadata): boolean {
  return getArtifactPotential(artifact) < 1
}

/** How much more scrap a finished loadout leaves behind at each Forge level. */
export function forgeSalvageMultiplier(forgeLevel: number): number {
  if (forgeLevel >= 3) {
    return 1.5
  }
  return forgeLevel === 2 ? 1.25 : 1
}
