/**
 * Early-run XP tuning lives here rather than in the simulation or renderer.
 *
 * Thresholds are cumulative XP required to reach each level (the first entry
 * is level 1). The opening curve gives a player a first level after four
 * Slimes, then leaves room for later enemy types to award more
 * meaningful amounts.
 */
export interface XpBalance {
  levelThresholds: readonly number[]
  pickupRadius: number
  pickupAttractionRadius: number
  pickupAttractionSpeed: number
}

const XP_LEVEL_ONE_THRESHOLD = 0
const XP_LEVEL_TWO_REQUIREMENT = 16
const XP_LEVEL_REQUIREMENT_GROWTH = 1.12
const XP_LEVEL_THRESHOLD_TABLE_SIZE = 100

function buildLevelThresholds(maxLevel: number): readonly number[] {
  const thresholds: number[] = [XP_LEVEL_ONE_THRESHOLD]
  let cumulativeThreshold = XP_LEVEL_ONE_THRESHOLD
  let nextRequirement = XP_LEVEL_TWO_REQUIREMENT

  for (let level = 2; level <= maxLevel; level += 1) {
    cumulativeThreshold += Math.round(nextRequirement)
    thresholds.push(cumulativeThreshold)
    nextRequirement *= XP_LEVEL_REQUIREMENT_GROWTH
  }

  return thresholds
}

export const XP_BALANCE = {
  // Level 1 starts at zero XP; the higher opening requirement improves early
  // pacing while the gentler growth avoids an excessive level-30 wall.
  levelThresholds: buildLevelThresholds(XP_LEVEL_THRESHOLD_TABLE_SIZE),
  pickupRadius: 8,
  pickupAttractionRadius: 140,
  pickupAttractionSpeed: 240,
} as const satisfies XpBalance

export const XP_LEVEL_THRESHOLDS = XP_BALANCE.levelThresholds

/**
 * Returns the cumulative XP needed to reach `level`.
 *
 * The table covers the authored curve. If later content pushes past it, the
 * same growth continues deterministically.
 */
export function xpRequiredForLevel(
  level: number,
  balance: XpBalance = XP_BALANCE,
): number {
  const normalizedLevel = Math.max(1, Math.floor(level))
  const knownThreshold = balance.levelThresholds[normalizedLevel - 1]
  if (knownThreshold !== undefined) {
    return knownThreshold
  }

  const lastIndex = balance.levelThresholds.length - 1
  const lastThreshold = balance.levelThresholds[lastIndex] ?? 0
  const previousThreshold = balance.levelThresholds[lastIndex - 1] ?? 0
  let threshold = lastThreshold
  let nextRequirement = Math.max(1, lastThreshold - previousThreshold)

  for (let nextLevel = lastIndex + 2; nextLevel <= normalizedLevel; nextLevel += 1) {
    nextRequirement = Math.max(
      1,
      Math.round(nextRequirement * XP_LEVEL_REQUIREMENT_GROWTH),
    )
    threshold += nextRequirement
  }

  return threshold
}

export function xpRequiredForNextLevel(
  level: number,
  balance: XpBalance = XP_BALANCE,
): number {
  return xpRequiredForLevel(level + 1, balance)
}

/** Returns the highest level whose cumulative threshold has been reached. */
export function levelForXp(
  xp: number,
  balance: XpBalance = XP_BALANCE,
): number {
  const normalizedXp = Math.max(0, Number.isFinite(xp) ? xp : 0)
  let level = 1
  while (normalizedXp >= xpRequiredForNextLevel(level, balance)) {
    level += 1
  }
  return level
}
