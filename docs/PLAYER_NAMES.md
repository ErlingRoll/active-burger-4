# Player names

`getPlayerDisplayName` in
[src/auth/PlayerName.ts](../src/auth/PlayerName.ts) is the single client-side
resolver for public player names. Use it whenever a UI component displays a
player, angler, account holder, leaderboard entry, or report author.

The precedence is:

1. Approved nickname (`approvedNickname`)
2. Identity-provider display name (`providerDisplayName`)
3. Email local part (`email`, without `@` or the domain)
4. A component-specific fallback (`fallback`)
5. `Anonymous player`

Do not read `AuthAccount.displayName` or `NicknameState.displayName` directly in
rendered output. Pass both values to `getPlayerDisplayName` so an approved
nickname always wins and future name sources remain centralized.

The Supabase functions that return public player names must keep the same
precedence. The active-angler, realtime-name, and Essence leaderboard functions
are updated in
`supabase/migrations/20260906020000_use_email_local_part_player_names.sql`.
Realtime fishing presence and activity payloads are also resolved through
`get_player_display_names` before they reach the screen; do not render the
name supplied by a remote realtime payload directly.
