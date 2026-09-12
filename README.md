# Active Burger 4

Active Burger 4 is a deterministic browser roguelike RPG. React owns the UI,
PixiJS renders simulation state, and the TypeScript game simulation remains
independent of browser and network APIs. That independence is not a convention:
[tests/architecture.test.ts](tests/architecture.test.ts) fails the build if
`src/game/` reaches React, PixiJS, Dexie, Supabase, or a feature module.

The application targets modern desktop browsers. Small viewports are not
supported today; see the checklist below.

## License

The original code, game content, visual designs, artwork, documentation, and
other original materials in this repository are proprietary and
**all rights reserved**. No copying, modification, redistribution, commercial
use, or derivative work is permitted without prior written permission from
Erling.

Third-party dependencies and other third-party materials remain under their
respective licenses.

## Development

Requires Node.js 22 LTS and npm.

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.development` and fill in the development project's
Supabase values; `.env.production` holds the production project's and is read
only by `npm run build` and `vite preview`. Without them the
application still runs: each service reports its own configuration error and the
screens explain what is unavailable.

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
name is used, followed by the local part of an email address (without the
domain); only players without either name appear as Anonymous player.

A new account is asked to choose a nickname right after its first sign-in, by
email or Discord alike. The prompt can be skipped and the nickname requested
later from the account settings menu.

All player-facing names use the shared resolver documented in
[docs/PLAYER_NAMES.md](docs/PLAYER_NAMES.md). New components must use
`getPlayerDisplayName` instead of reading an account or nickname field directly.

## Validation

```bash
npm run lint      # oxlint --deny-warnings; a warning fails the build
npm run test:run  # unit, component, architecture, and documentation tests
npm run build     # tsc -b across src, e2e, and tooling, then vite build
```

`npm run test:e2e` runs the Playwright suite. It needs a Supabase project and
`VITE_TEST_USER_EMAIL` / `VITE_TEST_USER_PASSWORD` in `.env.development`, so CI runs lint,
tests, and build only.

Some checks read the repository rather than import it, and live in
[tests/](tests/):

- `architecture.test.ts` enforces the dependency rules and forbids import
  cycles.
- `styleTokens.test.ts` keeps repeated colours in `src/styles/tokens.css`.
- `documentation.test.ts` keeps the content counts in PLAN.md true.

## Development tools

Three development controls exist: a menu in the header, for granting
inventory items and creating random Champions outside a run; a menu in the
arena, for driving a run (bosses, gear, skills, stress spawns, simulation
speed); and a row on the Camp screen that skips its clock ahead by an hour or
eight, so a claim can be tested without waiting for real hours to pass. They
show only to an account with the admin
role, on a local dev server or on any build that serves the dev backend, and
never on production; the environment half of that switch is
`DEVELOPMENT_TOOLS_ENABLED` in `src/shared/environment.ts`, which follows the
build's environment stamp rather than Vite's dev mode, so the Netlify dev
deploy has them too.

The in-run menu opens from its button, the backquote key, or `?devmenu=open`
in the URL. The header's inventory grants go through a server function that
requires the admin role as well, so the role gates both what is shown and what
is allowed. Grant it to an account in the Supabase SQL editor, then sign out
and back in:

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'
where email = 'you@example.com';
```

## Architecture

`src/game/` is the simulation and depends on nothing but `content/`,
`game-config/`, and `shared/`. `src/rendering/` projects its state through
PixiJS. `src/App.tsx` orchestrates the screens in `src/app/screens/` from the
state in `src/app/hooks/`, one hook per domain; the screens are
loaded per route by `src/app/lazyScreens.ts`. Services are constructed once in
`src/services/` and read through context.

See [PLAN.md](PLAN.md) section 8 for the full structure and section 9 for the
dependency rules, [docs/IMPLEMENTATION_CHECKLIST.md](docs/IMPLEMENTATION_CHECKLIST.md)
for delivery status, the [graphics guidelines](docs/GRAPHICS_GUIDELINES.md) for
the visual language, and [docs/decisions/](docs/decisions/) for the ADRs.

Colours come from `src/styles/tokens.css`. Prefer a semantic token, then a
palette token; a colour used more than twice must be in that file.

## Database migrations

Every file in [supabase/migrations/](supabase/migrations/) is validated on each
pull request and on each push to `main` or `dev`: CI applies the whole history
to an empty Postgres and then lints the schema it produces. A migration that
fails to apply, or a function the linter rejects, fails the build.

```bash
npm run supabase:validate  # apply every migration to a fresh database, then lint
npm run supabase:check     # compare local migrations with the linked project
```

Validation needs Docker locally; CI has it. Once validation passes, the
**Push migrations** job runs `supabase db push` against the project that
belongs to the branch: `main` deploys to the production project and `dev` to
the development one. Nothing is pushed from a pull request, and nothing is
pushed while lint, tests, build, or migration validation are failing.

The job runs in the GitHub environment named after its branch, `production` for
`main` and `dev` for `dev`, and reads from it:

- `SUPABASE_ACCESS_TOKEN` — a secret; a personal access token from the Supabase
  dashboard. It is per user rather than per project, so it may live at
  repository level instead.
- `SUPABASE_DB_PASSWORD` — a secret; that project's database password.
- `SUPABASE_PROJECT_ID` — a variable; the project ref, the subdomain of
  `VITE_SUPABASE_URL`.

## Deployment

Production deploys to Netlify from `netlify.toml`, with SPA routing via
`public/_redirects`. `vite.config.ts` stamps the build with the commit SHA,
reading it from the host's environment or from `git` locally, the release from
`package.json`, the build time, and the environment. The header shows all four,
with a "Dev" tag on any build that is not Netlify's production context; set
`VITE_APP_ENVIRONMENT` to override that.

## Conventions

For transient success, error, and loot feedback, use the shared toast described
in [docs/UI_FEEDBACK.md](docs/UI_FEEDBACK.md). Agent-specific conventions are in
[AGENTS.md](AGENTS.md).
