/**
 * Early-run XP tuning lives here rather than in the simulation or renderer.
 *
 * Thresholds are cumulative XP required to reach each level (the first entry
 * is level 1). The deliberately gentle opening curve gives a player a first
 * level after two Slimes, then leaves room for later enemy types to award more
 * meaningful amounts.
 */
export interface XpBalance {
  levelThresholds: readonly number[]
  pickupRadius: number
  pickupAttractionRadius: number
  pickupAttractionSpeed: number
}

export const XP_BALANCE = {
  // Level 1 starts at zero XP; level 2 requires 10 total XP.
  levelThresholds: [0, 10, 25, 45, 70, 100, 135, 175, 220, 270],
  pickupRadius: 8,
  pickupAttractionRadius: 140,
  pickupAttractionSpeed: 240,
} as const satisfies XpBalance

export const XP_LEVEL_THRESHOLDS = XP_BALANCE.levelThresholds

/**
 * Returns the cumulative XP needed to reach `level`.
 *
 * The table covers the conservative early-game curve. The linear extension
 * keeps the function total and deterministic until later content adds a more
 * detailed balance table.
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
  const finalStep = Math.max(1, lastThreshold - previousThreshold)
  const levelsBeyondTable = normalizedLevel - (lastIndex + 1)
  return lastThreshold + finalStep * (levelsBeyondTable + 1)
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
