# Active Burger 4 Implementation Checklist

This is the delivery checklist derived from [PLAN.md](../PLAN.md). Complete
milestones in order unless an ADR documents an exception.

## Selected Foundation Decisions

- [x] Node.js 22 LTS (`22.14.0`) and npm
- [x] Vite, React, TypeScript, PixiJS, Zustand, Dexie, Supabase, Vitest, and
  Playwright
- [x] Oxlint; do not add ESLint redundantly
- [x] GitHub Actions CI; Vercel previews and production deployment
- [x] Proprietary, all-rights-reserved original materials; record third-party
      asset provenance before use
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
- [ ] Follow the [graphics guidelines](GRAPHICS_GUIDELINES.md) for every new
  skill, projectile, effect, persistent object, and HUD icon.
- [ ] Put balance values in content data, not engine systems.
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
- [ ] **21. Durable Dungeon Runs:** Supabase-owned active-run locking,
      exact deterministic floor checkpoints, Continue/Save & quit/Forfeit
      lifecycle, terminal snapshots, and active-run store restrictions.

## Per-Feature Gate

- [ ] Type-check, lint, focused tests, and build pass.
- [ ] Browser tests pass when UI/browser behavior changes.
- [ ] Save compatibility, stable IDs, architecture boundaries, and common
  viewport behavior were reviewed.
- [ ] No unnecessary dependency or active-simulation network call was added.
- [ ] Durable checkpoints restore the complete simulation boundary exactly and
  never write every simulation tick.
