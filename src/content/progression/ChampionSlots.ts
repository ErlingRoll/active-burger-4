/**
 * How many Champions a player may keep.
 *
 * Archived Champions are gone and do not count. Exhausted ones do: resting a
 * Champion off is the cost of an Abyss attempt, and letting that free a slot
 * would make the limit mean nothing to anyone willing to wait a day.
 *
 * The server enforces it — the roster count lives in `create_champion_from_run`
 * and is the only check that cannot be walked around — so this number is kept
 * in step with the one in
 * `supabase/migrations/20260910160000_limit_the_champion_roster.sql`. It is here
 * as well because the screens have to be able to say what the limit is before
 * a player runs into it.
 */
export const CHAMPION_SLOT_LIMIT = 10

/** Whether a roster of this size has room for one more Champion. */
export function hasChampionSlotFree(heldChampions: number): boolean {
  return heldChampions < CHAMPION_SLOT_LIMIT
}
