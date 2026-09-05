# Agent guidance

## Shared loot toast

Use the shared global toast for transient loot feedback such as catches,
salvage rewards, and item grants. The canonical usage and formatting rules are
documented in [docs/UI_FEEDBACK.md](docs/UI_FEEDBACK.md).

Before adding a local success card, banner, or notice, check whether the
message belongs in the shared top-right toast. Keep persistent inventory or
progression state in the relevant screen; use the toast only for immediate
feedback after a successful operation.

## Player names

Use `getPlayerDisplayName` from `src/auth/PlayerName.ts` for every
player-facing name. See [docs/PLAYER_NAMES.md](docs/PLAYER_NAMES.md) for the
nickname/provider/fallback precedence and the corresponding Supabase contract.
