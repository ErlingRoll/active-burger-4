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

## Validation

```bash
npm run lint
npm run test:run
npm run build
```

## Architecture

See [PLAN.md](PLAN.md), [docs/IMPLEMENTATION_CHECKLIST.md](docs/IMPLEMENTATION_CHECKLIST.md),
and [docs/decisions/](docs/decisions/).
