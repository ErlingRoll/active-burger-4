export const XP_MULTIPLIER_MAX_LEVEL = 10
export const XP_MULTIPLIER_INCREMENT = 0.05

export function getXpMultiplierForLevel(level: number): number {
  const normalizedLevel = Math.min(
    XP_MULTIPLIER_MAX_LEVEL,
    Math.max(0, Math.floor(Number.isFinite(level) ? level : 0)),
  )
  return 1 + normalizedLevel * XP_MULTIPLIER_INCREMENT
}
