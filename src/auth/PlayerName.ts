export const DEFAULT_PLAYER_DISPLAY_NAME = 'Anonymous player'

export interface PlayerNameSources {
  approvedNickname?: string | null
  providerDisplayName?: string | null
  fallback?: string | null
}

/**
 * Resolve the public name for a player. Keep this precedence in sync with the
 * public Supabase functions that return player names.
 */
export function getPlayerDisplayName({
  approvedNickname,
  providerDisplayName,
  fallback,
}: PlayerNameSources): string {
  for (const candidate of [approvedNickname, providerDisplayName, fallback]) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim()
    }
  }
  return DEFAULT_PLAYER_DISPLAY_NAME
}
