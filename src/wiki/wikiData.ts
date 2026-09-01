import { getFloorStatMultiplier } from '../content/dungeons/Dungeons'
import type { EliteModifierDefinition } from '../content/enemies/EliteModifiers'
import { xpRequiredForLevel } from '../content/progression/XpBalance'

export interface WikiChartPoint {
  label: string
  value: number
}

export const WIKI_SECTION_IDS = [
  'getting-started',
  'classes',
  'combat',
  'skills',
  'synergies',
  'gear',
  'progression',
  'floors',
  'enemies',
  'world-modifiers',
  'glossary',
] as const

const WIKI_CHART_LEVELS = [1, 5, 10, 20, 30, 50, 100] as const
const WIKI_CHART_FLOORS = [1, 5, 10, 20, 30, 50, 100] as const

export function createXpChartPoints(): readonly WikiChartPoint[] {
  return WIKI_CHART_LEVELS.map((level) => ({
    label: `L${level}`,
    value: xpRequiredForLevel(level),
  }))
}

export function createFloorScalingChartPoints(): readonly WikiChartPoint[] {
  return WIKI_CHART_FLOORS.map((floor) => ({
    label: `F${floor}`,
    value: getFloorStatMultiplier(floor),
  }))
}

export function wikiAnchor(prefix: string, id: string): string {
  return `${prefix}-${id}`
}

/** Formats fractional source values as reader-facing percentages without binary rounding noise. */
export function formatWikiPercentage(
  value: number,
  maximumFractionDigits = 2,
): string {
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits,
  }).format(value * 100)}%`
}

/** Turns authored elite mechanics into concise, distinct reference-card copy. */
export function getEliteModifierWikiDescription(
  modifier: EliteModifierDefinition,
): string {
  if (modifier.extraDamageType && modifier.extraPhysicalDamageRatio !== undefined) {
    return `Contact hits also deal ${formatWikiPercentage(modifier.extraPhysicalDamageRatio)} ${modifier.extraDamageType} damage based on the physical hit.`
  }
  if (modifier.poisonApplication) {
    const hastedRatio = modifier.hastedPoisonApplication?.physicalChaosRatio
    const hastedNote = hastedRatio === undefined
      ? ''
      : ` (${formatWikiPercentage(hastedRatio)} with Hasted)`
    return `Contact hits apply ${modifier.poisonApplication.durationSeconds}s of Chaos poison worth ${formatWikiPercentage(modifier.poisonApplication.physicalChaosRatio)} of the physical hit${hastedNote}.`
  }
  if (modifier.behaviorOverride?.kind === 'intercept') {
    return `Attempts to intercept the target ${modifier.behaviorOverride.predictionSeconds}s ahead, with a ${modifier.behaviorOverride.lateralOffset}-unit lateral offset.`
  }
  if (modifier.physicalResistance) {
    return `Gains ${modifier.physicalResistance}% Physical resistance.`
  }
  if (modifier.berserking) {
    return `At ${formatWikiPercentage(modifier.berserking.healthThreshold)} HP or lower, gains ${formatWikiPercentage(modifier.berserking.speedMultiplier - 1)} speed and ${formatWikiPercentage(modifier.berserking.contactDamageMultiplier - 1)} contact damage.`
  }
  if (modifier.volatile) {
    return `On death, telegraphs for ${modifier.volatile.telegraphDurationSeconds}s, then detonates within ${modifier.volatile.radius} units for ${formatWikiPercentage(modifier.volatile.contactDamageMultiplier)} of contact damage as Fire.`
  }
  if (modifier.leeching) {
    return `Contact hits heal for ${formatWikiPercentage(modifier.leeching.healingRatio)} of post-mitigation player damage, capped at ${formatWikiPercentage(modifier.leeching.maximumHealRatio)} of maximum HP per hit.`
  }
  if (modifier.wardMaxHpRatio) {
    return `Starts with a non-regenerating ward equal to ${formatWikiPercentage(modifier.wardMaxHpRatio)} of maximum HP.`
  }
  if (modifier.maddening) {
    return `Within ${modifier.maddening.radius} units, reduces Basic Attack speed to ${formatWikiPercentage(modifier.maddening.attackSpeedMultiplier)}.`
  }
  if (modifier.spiteful) {
    return `A direct player hit within ${modifier.spiteful.radius} units triggers a Physical burst for ${formatWikiPercentage(modifier.spiteful.contactDamageMultiplier)} of contact damage, at most once every ${modifier.spiteful.cooldownSeconds}s.`
  }
  if (modifier.phasebound) {
    return `Every ${modifier.phasebound.intervalSeconds}s, takes only ${formatWikiPercentage(modifier.phasebound.damageTakenMultiplier)} damage for ${modifier.phasebound.durationSeconds}s.`
  }

  const increases = [
    modifier.maxHpMultiplier !== 1 &&
      `maximum HP by ${formatWikiPercentage(modifier.maxHpMultiplier - 1)}`,
    modifier.radiusMultiplier !== 1 &&
      `radius by ${formatWikiPercentage(modifier.radiusMultiplier - 1)}`,
    modifier.speedMultiplier !== 1 &&
      `speed by ${formatWikiPercentage(modifier.speedMultiplier - 1)}`,
  ].filter((effect): effect is string => Boolean(effect))
  return increases.length > 0
    ? `Increases ${increases.join(' and ')}.`
    : 'Changes elite combat behavior.'
}
