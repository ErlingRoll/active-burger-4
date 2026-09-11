# Agent guidance

## Subagent model policy

When using subagents:

- NEVER specify a `model` when calling `runSubagent`.
- Always allow the subagent to inherit the model of the current parent chat.
- Never switch a subagent to a different or more expensive model.
- Never invoke a custom agent that forces a different model.
- Do not increase reasoning/thinking effort for subagents.

## Test account

The following test account may be used by any agent or human tester: test@mctest.face

Credentials are stored in `.env.development`, which points at the development
Supabase project. `.env.production` is read only by production builds.

- VITE_TEST_USER_EMAIL
- VITE_TEST_USER_PASSWORD

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

## Validation before finishing

Run all three; each is enforced in CI:

```bash
npm run lint      # oxlint --deny-warnings
npm run test:run
npm run build     # tsc -b covers src/, e2e/, tests/, and vite.config.ts
```

A change under `supabase/migrations/` is also validated in CI: the whole
history is applied to an empty database and the resulting schema is linted, and
a failure there fails the build. Run `npm run supabase:validate` locally if
Docker is available. Pushing the migrations is CI's job: a push to `dev` applies
them to the development project and a push to `main` to production. Do not run
`supabase db push` yourself.

## Verifying a change in the app

Look at the running application. Do not reach for the end-to-end suites.

```bash
npm run screenshot -- --path wiki            # both viewports
npm run screenshot -- --run --size desktop   # the in-run HUD
npm run screenshot -- --run --devmenu        # the in-run development menu
```

[scripts/screenshot.mjs](scripts/screenshot.mjs) reuses a dev server if one is
already listening, signs in with the `.env.development` test account, and writes a PNG for
each viewport. It reports console and page errors alongside the images, so a
screenshot is a check on the code as well as on the layout. Pass the route
without a leading slash: a POSIX shell on Windows rewrites `/wiki` into a
filesystem path before Node sees it.

Two viewports matter: a phone at the default iPhone size, 390x844, and a
desktop at Full HD. Sizes between the two are the end-to-end matrix's business.

**The Playwright suites under `e2e/` are opt-in.** Do not run `npx playwright test`, `npm run test:e2e` or `npm run test:layout` unless the person you are
working for asks for them in that request. A complete end-to-end pass costs
about two and a half minutes against about ten seconds for the whole unit
suite, and re-running it after each edit is where a long turn goes. Driving the
real screen catches more than the assertions do anyway.

## Architecture boundaries

[tests/architecture.test.ts](tests/architecture.test.ts) enforces these; do not
weaken the test to make a change fit.

- `src/game/` must not import React, PixiJS, Dexie, Supabase, or any feature
  module. It may reach `content/`, `game-config/`, and `shared/` only.
- `src/content/` holds schema and derived queries; `src/game-config/` holds the
  tuning values. The dependency runs `game-config/ -> content/`, never back.
  Schema types belong in the leaf `*Types.ts` modules so that stays true.
- No import cycles. When a package barrel would create one, import the owning
  module directly.
- Put a shared leaf that both `game/` and `content/` need in `src/shared/`.

## Adding a screen

1. Add it to the `AppScreen` union and `APP_ROUTE_PATHS` in
   [src/app/routing.ts](src/app/routing.ts). The path lookup is derived from
   that table, so nothing else needs a branch.
2. Register it in [src/app/lazyScreens.ts](src/app/lazyScreens.ts) and render it
   inside `LazyScreen`.
3. Do **not** re-export it from its feature barrel. A static re-export pulls it
   back into the entry chunk and defeats the code split; Vite reports this as
   `INEFFECTIVE_DYNAMIC_IMPORT`.

## Services

Services are constructed once in
[src/services/AppServices.ts](src/services/AppServices.ts) and read with
`useServices()`. Add a new one there rather than calling its factory from a
component, and let it fail into a `configurationError` rather than throwing: a
missing Supabase configuration must still render a page that explains itself.

## Colours

Use a token from [src/styles/tokens.css](src/styles/tokens.css): a semantic one
where a role fits, otherwise a palette one. A colour used more than twice must
be in that file, and
[tests/styleTokens.test.ts](tests/styleTokens.test.ts) fails the build
otherwise. Do not add a semantic token until the role is used and settled.

## Tests

- Simulation specs run without a DOM. Do not introduce one; that is what keeps
  the simulation honest.
- Component specs opt in per file with `// @vitest-environment jsdom` and render
  through `renderComponent` from
  [src/testing/render.tsx](src/testing/render.tsx), which supplies the same
  providers as `main.tsx`.
- Use `definedAt`/`assertDefined` from [src/testing](src/testing) instead of a
  non-null assertion when `noUncheckedIndexedAccess` widens a lookup.

## Content counts in documentation

PLAN.md's implementation snapshot is checked against the registries by
[tests/documentation.test.ts](tests/documentation.test.ts). When you add a
skill, class, or modifier, update that block in the same change.
