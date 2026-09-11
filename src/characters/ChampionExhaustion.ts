import type { ChampionSnapshot } from './CharacterTypes'

/**
 * Exhaustion presentation shared by every screen that shows a Champion.
 *
 * These are pure and take an explicit `now`, so a screen can render
 * deterministically and each rule can be tested without a DOM. They live with
 * the Champion rather than in the application layer because the champions page
 * and the run setup screen both need them, and a feature module must not reach
 * up into `app/`.
 */

export function isChampionExhausted(
  champion: ChampionSnapshot,
  now = Date.now(),
): boolean {
  return champion.exhaustionUntil !== null &&
    Date.parse(champion.exhaustionUntil) > now
}

export function formatChampionExhaustion(
  exhaustionUntil: string | null,
  now = Date.now(),
): string {
  if (!exhaustionUntil) {
    return 'Available'
  }
  const remainingMilliseconds = Date.parse(exhaustionUntil) - now
  if (!Number.isFinite(remainingMilliseconds) || remainingMilliseconds <= 0) {
    return 'Available'
  }
  const remainingHours = Math.floor(remainingMilliseconds / 3_600_000)
  const remainingMinutes = Math.ceil((remainingMilliseconds % 3_600_000) / 60_000)
  return `${remainingHours}h ${remainingMinutes}m remaining`
}

/**
 * The availability pill's text: the word a player scans for first, then the
 * countdown. "Available" stands alone.
 */
export function formatChampionAvailability(
  champion: ChampionSnapshot,
  now = Date.now(),
): string {
  return isChampionExhausted(champion, now)
    ? `Exhausted · ${formatChampionExhaustion(champion.exhaustionUntil, now)}`
    : 'Available'
}

export function formatRevivalReduction(seconds: number): string {
  const hours = Math.floor(seconds / 3_600)
  const minutes = Math.floor((seconds % 3_600) / 60)
  return hours > 0
    ? `${hours}h ${minutes}m`
    : `${minutes}m`
}
