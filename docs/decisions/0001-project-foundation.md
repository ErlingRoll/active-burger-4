# 0001: Project foundation choices

## Context

Active Burger 4 needs a reproducible browser-game development environment with
an independent, deterministic simulation and a straightforward deployment
path.

## Decision

- Use Node.js 22 LTS and npm. The exact Node version is declared in `.nvmrc`.
- Use Vite, React, TypeScript, PixiJS, Zustand, Dexie, Supabase, Vitest, and
  Playwright as defined in `PLAN.md`.
- Retain the Vite scaffold's Oxlint instead of introducing ESLint.
- Use GitHub Actions for lint, unit-test, and build validation.
- Deploy the static frontend to Vercel, with preview deployments for pull
  requests and a protected production deployment from `main`.
- Keep the original source code, game content, designs, artwork, and
  documentation proprietary and all rights reserved. Before non-code assets
  are added, document their provenance and license in a third-party notices
  file.
- Collect no product telemetry. Local gameplay is anonymous; authenticated
  Supabase syncing is opt-in and stores only account/progression data needed
  for the feature.

## Alternatives

- Node.js 20 LTS was rejected because Node 22 LTS is already available and has
  a longer support horizon.
- ESLint was rejected because the generated project already provides Oxlint.
- A custom server was rejected because the game is a static browser client.

## Consequences

CI must use the version declared in `.nvmrc`. Branch protection, Vercel, and
Supabase configuration are external setup steps and must be configured before
production deployment.
