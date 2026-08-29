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
