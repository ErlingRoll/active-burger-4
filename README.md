# Active Burger 4

Active Burger 4 is a deterministic browser roguelike RPG. React owns the UI,
PixiJS renders simulation state, and the TypeScript game simulation remains
independent of browser and network APIs.

## Development

Requires Node.js 22 LTS and npm.

```bash
npm install
npm run dev
```

## Production authentication

The production build uses `https://activeburger.com` as the OAuth callback
origin. In the Supabase dashboard, set **Authentication → URL Configuration**:

- **Site URL:** `https://activeburger.com`
- **Additional Redirect URLs:** `https://activeburger.com/**`

The Discord provider's callback URL must remain the Supabase callback URL
(`https://<project-ref>.supabase.co/auth/v1/callback`), not the application
URL. The application URL is passed as the OAuth `redirect_to` value.

## Nickname moderation

Nickname changes are requests, not immediate public profile edits. Apply the
Supabase migrations and use the administrator **Bug reports** route to approve
or reject each request. This is deliberately an approval workflow: it prevents
offensive or hateful names from being displayed even if a browser client is
modified or bypasses the UI.

An approved nickname takes priority. Until then, the player's Discord display
name is used as the public fallback; only players without either name appear as
Anonymous player.

All player-facing names use the shared resolver documented in
[docs/PLAYER_NAMES.md](docs/PLAYER_NAMES.md). New components must use
`getPlayerDisplayName` instead of reading an account or nickname field directly.

## Validation

```bash
npm run lint
npm run test:run
npm run build
```

## Architecture

See [PLAN.md](PLAN.md), [docs/IMPLEMENTATION_CHECKLIST.md](docs/IMPLEMENTATION_CHECKLIST.md),
the [graphics guidelines](docs/GRAPHICS_GUIDELINES.md), and
[docs/decisions/](docs/decisions/).

For transient success, error, and loot feedback, follow the shared toast
guidance in [docs/UI_FEEDBACK.md](docs/UI_FEEDBACK.md). Agent-specific
conventions are in [AGENTS.md](AGENTS.md).
