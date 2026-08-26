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

## Validation

```bash
npm run lint
npm run test:run
npm run build
```

## Architecture

See [PLAN.md](PLAN.md), [docs/IMPLEMENTATION_CHECKLIST.md](docs/IMPLEMENTATION_CHECKLIST.md),
and [docs/decisions/](docs/decisions/).
