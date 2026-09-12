# Active Burger 4 Implementation Checklist

This is the delivery checklist derived from [PLAN.md](../PLAN.md). Complete
milestones in order unless an ADR documents an exception.

## Selected Foundation Decisions

- [x] Node.js 22 LTS (`22.14.0`) and npm
- [x] Vite, React, TypeScript, PixiJS, Dexie, Supabase, Vitest, and Playwright.
      Zustand was selected here originally but never used; the dependency has
      been removed and React context serves the same purpose.
- [x] Oxlint; do not add ESLint redundantly. Lint runs with `--deny-warnings`,
      so a warning fails CI.
- [x] GitHub Actions CI; Netlify production deployment. Vercel was selected here
      originally; the repository deploys through `netlify.toml` and
      `public/_redirects`, and `vite.config.ts` reads either host's commit SHA.
- [x] Proprietary, all-rights-reserved original materials; record third-party
      asset provenance before use
- [x] No telemetry; opt-in authenticated progression sync only
- [ ] Protect `main` with required PR review and passing CI checks
- [ ] Create separate development and production Supabase projects and configure
  secrets in their hosts, never in the repository
- [ ] Configure the Netlify site's environment variables for preview and
  production contexts
- [ ] Mobile and small-viewport support. Responsive rules were deliberately
  removed; the application still targets desktop browsers everywhere except the
  Adventure Hub, which has a phone layout of its own: the camp holds a band at
  the top of the viewport while an ordered dock scrolls beneath it, and walking
  is a tap as well as W, A, S and D. The run setup, the pond, the inventory, the
  stores, the Codex and the in-run HUD are still to do.
- [x] Repair the authenticated Playwright suite. It was written against the
  pre-redesign dashboard and could not run; `clearExistingRun` now waits for
  the Adventure Hub's own wording, and all 20 specs in
  `e2e/game-canvas.spec.ts` execute and pass in about eighty seconds on one
  worker. It still needs credentials, so CI runs lint, tests, and build only.
- [ ] Run the browser suites with one worker, or give them separate accounts.
  Every viewport and every spec signs in as the same test account, and that
  account's run state lives on the server: in parallel one worker forfeits the
  run another is relying on, so `npm run test:layout` forces a single worker
  and `e2e/game-canvas.spec.ts` needs `--workers=1`. Running either in
  parallel fails on the arena with "the run never started".

## Cross-Cutting Completion Rules

These are standing rules, not one-time tasks. Where a rule is machine-checked,
the check is named; the rest are review responsibilities.

- [x] Keep simulation deterministic and independent from React, PixiJS, DOM,
  persistence, and network APIs.
  *Enforced by [tests/architecture.test.ts](../tests/architecture.test.ts).*
- [x] Keep the `content/` → `game-config/` dependency one-directional and the
  module graph free of cycles.
  *Enforced by [tests/architecture.test.ts](../tests/architecture.test.ts).*
- [x] Keep repeated colours in `src/styles/tokens.css` rather than as literals.
  *Enforced by [tests/styleTokens.test.ts](../tests/styleTokens.test.ts).*
- [x] Keep the content counts in PLAN.md's snapshot true.
  *Enforced by [tests/documentation.test.ts](../tests/documentation.test.ts).*
- [ ] Keep rendering a projection of simulation state; content remains
  data-driven with stable IDs.
- [ ] Follow the [graphics guidelines](GRAPHICS_GUIDELINES.md) for every new
  skill, projectile, effect, persistent object, and HUD icon.
- [ ] Put balance values in `game-config/`, not in engine systems.
- [ ] Apply the [high-frequency trigger safeguards](../PLAN.md#1241-high-frequency-trigger-safeguards)
  to every on-hit, per-projectile, and per-target mechanic.
- [ ] Add focused tests for deterministic rules and run applicable validation.
- [ ] Record material architecture changes in `docs/decisions/`.

## Skill upgrade description contract

- A generic level-up card keeps its `valueLabel` as the stat delta and uses the
  exact choice description format `+1 Level to [skill]`. Do not repeat the
  numeric stat change in that description.
- An evolution's `description` describes the one-time mechanic that the
  evolution adds.
- The generated evolution description must use the wording
  `Each additional rank:` for the effect gained from a later rank.
- For a normal evolution, that later-rank effect is the skill's regular level
  upgrade. The shared formatter derives it from the skill's `skillAction:
  'level'` definition.
- A normal evolution may set `evolutionRankValueLabel` when its later-rank
  effect needs wording different from the skill's regular level upgrade.
- For a repeatable evolution, the later-rank effect belongs to the evolution
  itself. Mark the definition with `repeatable: true` and make its
  `valueLabel` describe one rank of that repeatable effect.
- Do not append a level-up effect to a repeatable evolution; this was the
  source of incorrect text such as Rapid Ignition claiming to add Fiery Touch
  damage instead of cooldown reduction.

## Duration Renewal Rules

- Duration renewals must use a fixed maximum: Rallying Banner is capped at 12
  seconds; Storm Relay, Soul Tether, Razorwire, and Prism Halo are capped at
  twice their base duration.
- A renewal affects only the newest eligible persistent entity. For example,
  Rallying Banner renewals target the newest banner, Voltaic Bond targets the
  newest tether on its struck target, and Mirror Wire targets the newest Wire.
- Blood Debt utility renewals target only the newest live Tether, Relay, Wire,
  and Prism Halo, respectively.

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
- [x] **8. Skills:** Basic Attack, Whirlwind, Chain Lightning, skill upgrades.
- [x] **9. Enemy Variety:** Runner, Brute, Archer, and Splitter.
- [x] **10. Performance:** spatial hash, debug counts, spawn commands, and
  measured profiling.
- [x] **11. Gear:** deterministic drops, equipment choices, rarity, and stat
  modifiers, with event-triggered and conditional Synergy hooks implemented
  separately in the combat and skill systems.
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
  dungeon-customization profile, and migrations.
- [x] **16. Authentication:** Supabase sign-in/out, durable account state,
  RLS-protected profiles, and no simulation calls.
- [x] **17. Meta Progression:** Essence wallet, ten-level XP multiplier upgrades,
      and three-rank starting-level upgrades with pre-run level-up choices.
- [x] **18. World Modifiers:** selection, difficulty score, reward multiplier.
- [x] **19. Characters:** content-driven Knight, Ranger, Necromancer, Frost
      Warden, Ashen Alchemist, War Shepherd, Riftwalker, and Bloodweaver.
- [x] **20. Polish:** onboarding, combat readability, reduced motion, responsive HUD, and results presentation.
- [x] **21. Durable Dungeon Runs:** Supabase-owned active-run locking,
      exact deterministic floor checkpoints, Continue/Save & quit/Forfeit
      lifecycle, terminal snapshots, and active-run store restrictions.
      See [decision 0008](decisions/0008-durable-dungeon-run-checkpoints.md).
- [x] **22. Infinite Abyss:** endless run mode with its own modifiers, danger
      score, champion roster, champion exhaustion and revival, per-floor loot
      boxes, and a distinct violet visual identity.
- [x] **23. Champions and Characters:** immutable build snapshots captured from
      a finished run, champion renaming, archiving, and revival with fish.
- [x] **24. Fishing:** the pond loop with baits, rods, enchantments, salvage,
      fish meals consumed at run start, and live angler presence.
- [x] **25. Inventory and Loot Boxes:** server-authoritative item grants,
      idempotent inventory operations, sorting, and loot box opening.
- [x] **26. Adventure Hub:** the dashboard scene with live visitor presence,
      visitor movement, campfire signals, and the Abyss depth leaderboard.
- [x] **27. Player Reporting and Moderation:** in-game bug reports with floor
      snapshots and images, the administrator report route with soft delete,
      and the nickname approval workflow.
- [x] **28. Wiki and Audio:** the in-game reference screen, and the music and
      effects settings with per-screen playlists.
- [x] **29. Chronicle:** the record of finished runs, listing each run's
      outcome, depth, level, kills and Essence, and rebuilding the end-of-run
      report from the snapshot the run ended on rather than storing it twice.
- [x] **30. Engineering Baseline:** strict TypeScript, lint that fails on
      warnings, a component test harness, error boundaries, route-level code
      splitting, and the executable architecture and style rules.
      See [decision 0010](decisions/0010-enforced-architecture-boundaries.md).
- [x] **31. The Camp, first slices:** timber and stone, the building and job
      registries mirrored between the migrations and the client, the labour
      sheet and offline accrual as SQL and TypeScript twins pinned to one
      fixture set, Champion labour with idempotent claims and settlement on
      unassign or archive, the Abyss lockout for working Champions, and the
      Camp screen with a plot per building, construction bought with timber and stone, the
      tackle bench with multi-input recipes, the Rift anchor where an exhausted
      Champion rests faster, the Smokehouse that guts fish for roe and cures
      meal fish with it, and the Forge that rerolls artifacts and raises a
      run's scrap. See [camp_delivery_plan.md](features/camp_delivery_plan.md).
- [x] **32. Contracts and collections:** a contract pool mirrored between the
      migrations and the client, a board of three daily and one weekly
      contract dealt per account from the account and the period, progress
      computed from the runs, catches, boxes and ledger rows the server already
      records, an idempotent claim paying materials and loot boxes and never
      Essence, the fish, artifact and Champion collections derived from the
      same records, and the Trophy hall at the Camp showing the displays their
      milestones earn. See
      [contracts_delivery_plan.md](features/contracts_delivery_plan.md).

## Per-Feature Gate

Run before opening a pull request:

```bash
npm run lint      # oxlint --deny-warnings
npm run test:run  # unit, component, architecture, and documentation tests
npm run build     # tsc -b across src, e2e, and tooling, then vite build
```

- [ ] Type-check, lint, focused tests, and build pass.
- [ ] Browser tests pass when UI/browser behavior changes.
- [ ] Save compatibility, stable IDs, and architecture boundaries were reviewed.
- [ ] A new screen is registered in `app/routing.ts` **and**
  `app/lazyScreens.ts`, and is not re-exported from its feature barrel.
- [ ] No unnecessary dependency or active-simulation network call was added.
- [ ] Durable checkpoints restore the complete simulation boundary exactly and
  never write every simulation tick.
