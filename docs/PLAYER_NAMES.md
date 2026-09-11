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

## Choosing a nickname

An account that has never requested a nickname is asked to choose one right
after it signs in, whichever way it signed in (email, Discord, or a provider
added later). The decision lives in `shouldPromptForNickname` in
[src/auth/NicknamePrompt.ts](../src/auth/NicknamePrompt.ts): the profile has
no approved nickname and the account has no nickname request of any status,
which `NicknameState.hasRequestedNickname` reports. Submitting a request, even
one that is later rejected, settles the question for every device; skipping the
prompt is remembered only on that browser. Both the prompt and the settings
menu's **Change nickname** render the shared `NicknameDialog`, so the
validation and moderation wording stay identical.

The app shell carries `data-nickname-prompt` (`loading`, `open`, or `closed`)
so the screenshot script and the end-to-end sign-in helpers can skip the prompt
deterministically for the test account.

Do not read `AuthAccount.displayName` or `NicknameState.displayName` directly in
rendered output. Pass both values to `getPlayerDisplayName` so an approved
nickname always wins and future name sources remain centralized.

The Supabase functions that return public player names must keep the same
precedence. The active-angler, realtime-name, and Abyss leaderboard functions
are updated in
`supabase/migrations/20260906020000_use_email_local_part_player_names.sql`.
Realtime fishing presence and activity payloads are also resolved through
`get_player_display_names` before they reach the screen; do not render the
name supplied by a remote realtime payload directly.
