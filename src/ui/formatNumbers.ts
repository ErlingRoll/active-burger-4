export function formatExperience(value: number): string {
  return Math.floor(value).toString()
}

function trimTrailingZero(value: string): string {
  return value.replace(/\.0$/, '')
}

export function formatCompactDamage(value: number): string {
  const normalized = Number.isFinite(value) ? Math.max(0, value) : 0
  if (normalized < 1_000) {
    return Math.floor(normalized).toString()
  }
  if (normalized >= 1_000_000_000) {
    return `${trimTrailingZero((normalized / 1_000_000_000).toFixed(1))}B`
  }
  if (normalized >= 1_000_000) {
    return `${trimTrailingZero((normalized / 1_000_000).toFixed(1))}M`
  }
  return `${trimTrailingZero((normalized / 1_000).toFixed(1))}K`
}

/**
 * A run's length as minutes and seconds.
 *
 * Lives beside the other number formats rather than with the run screens: the
 * chronicle and the end-of-run report both show it, and they are not in the
 * same part of the tree.
 */
export function formatElapsedTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(totalSeconds / 60)
  const remainder = totalSeconds % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}
