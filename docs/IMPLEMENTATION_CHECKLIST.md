# Active Burger 4 Implementation Checklist

This is the delivery checklist derived from [PLAN.md](../PLAN.md). Complete
milestones in order unless an ADR documents an exception.

## Selected Foundation Decisions

- [x] Node.js 22 LTS (`22.14.0`) and npm
- [x] Vite, React, TypeScript, PixiJS, Zustand, Dexie, Supabase, Vitest, and
  Playwright
- [x] Oxlint; do not add ESLint redundantly
- [x] GitHub Actions CI; Vercel previews and production deployment
- [x] MIT source-code license; record third-party asset provenance before use
- [x] No telemetry; opt-in authenticated progression sync only
- [ ] Protect `main` with required PR review and passing CI checks
- [ ] Create separate development and production Supabase projects and configure
  secrets in their hosts, never in the repository
- [ ] Create Vercel preview/production projects and configure their environment
  variables

## Cross-Cutting Completion Rules

- [ ] Keep simulation deterministic and independent from React, PixiJS, DOM,
  persistence, and network APIs.
- [ ] Keep rendering a projection of simulation state; content remains
  data-driven with stable IDs.
- [ ] Put balance values in content data, not engine systems.
- [ ] Add focused tests for deterministic rules and run applicable validation.
- [ ] Record material architecture changes in `docs/decisions/`.

## Milestones

- [x] **0. Repository Foundation:** scaffold, dependencies, scripts, project
  structure, environment template, CI, README, ADRs, and baseline validation.
- [x] **1. Pixi Prototype:** canvas, Pixi application, world/camera, visible
  player placeholder.
- [x] **2. Simulation Loop:** headless `Game`/`GameState`, fixed timestep,
  clock, pause/resume, seeded RNG, and deterministic tests.
- [x] **3. First Enemy:** Slime state/content, spawn, chase behavior, renderer.
- [x] **4. Automatic Combat:** targeting, cooldowns, projectiles, collision,
  damage, and death.
- [x] **5. Endless Spawning:** spawn director/ring, threat curve, cleanup, and
  kill count.
- [x] **6. XP and Leveling:** drops, pickup, thresholds, level pause.
- [x] **7. Upgrade Screen:** seeded three-choice overlay and stat upgrades.
- [x] **7.5 Basic Run UI:** dashboard, start action, gameplay HUD,
  development-only End Run control, results screen, and return to dashboard.
- [x] **8. Skills:** Basic Bolt, Whirlwind, Chain Lightning, skill upgrades.
- [x] **9. Enemy Variety:** Runner, Brute, Archer, and Splitter.
- [x] **10. Performance:** spatial hash, debug counts, spawn commands, and
  measured profiling.
- [x] **11. Gear:** deterministic drops, equipment choices, rarity, and stat
  modifiers. Event-triggered passives and conditional synergies remain deferred.
- [x] **12. Elites:** selection, Hasted/Giant, visuals, rewards.
- [x] **13. Boss:** deterministic 3:00 encounter, Ground Slam/Charge telegraphs,
      autonomous Dodge, health/status UI, deterministic reward, Development Menu spawn,
      and resumed normal spawning.
- [x] **13.5 Player Behavior:** deterministic Balanced, Aggressive, and Cautious
      profiles; telegraph Dodge, safe gear collection, threat-aware kiting, combat-range
      positioning, in-run Behavior screen, and intent HUD.
- [x] **14. Full Run:** 10-minute default dungeon, unlockable longer lengths,
      floor-scaled monsters, 120-second boss floors, stairs/reward transitions,
      Inferno Warden final boss/enrage, and results.
- [x] **15. Local Persistence:** versioned Dexie settings, default-locked
  dungeon-customization profile, pending results, and migrations.
- [x] **16. Authentication:** Supabase sign-in/out, durable account state,
  RLS-protected profiles, and no simulation calls.
- [x] **17. Meta Progression:** Essence wallet, dungeon-length unlocks, result
  queue sync, and idempotent submission.
- [x] **18. World Modifiers:** selection, difficulty score, reward multiplier.
- [x] **19. Characters:** content-driven Knight, Ranger, Necromancer.
- [x] **20. Polish:** onboarding, combat readability, reduced motion, responsive HUD, and results presentation.

## First Playable Gate

- [ ] Validate a 10-minute run with one character, one arena, three enemy
  types, three skills, 10-15 upgrades, one elite type, one boss, and three
  upgrade choices per level.
- [ ] Playtest and improve the decision loop before adding meta progression or
  broad content expansion.

## Per-Feature Gate

- [ ] Type-check, lint, focused tests, and build pass.
- [ ] Browser tests pass when UI/browser behavior changes.
- [ ] Save compatibility, stable IDs, architecture boundaries, and common
  viewport behavior were reviewed.
- [ ] No unnecessary dependency or active-simulation network call was added.
