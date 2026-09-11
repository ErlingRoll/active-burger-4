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
  // Round the whole remainder up to a minute first, then split it, so that a
  // timer a second short of a full day reads "24h 0m" rather than "23h 60m".
  const remainingMinutes = Math.ceil(remainingMilliseconds / 60_000)
  return `${Math.floor(remainingMinutes / 60)}h ${remainingMinutes % 60}m remaining`
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
