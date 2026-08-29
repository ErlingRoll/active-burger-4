export const STARTING_LEVEL_MAX_RANK = 3
export const STARTING_LEVEL_BASE = 1

export function getStartingLevelForRank(rank: number): number {
  const normalizedRank = Math.min(
    STARTING_LEVEL_MAX_RANK,
    Math.max(0, Math.floor(Number.isFinite(rank) ? rank : 0)),
  )
  return STARTING_LEVEL_BASE + normalizedRank
}
