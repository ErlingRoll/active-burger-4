# Browser Roguelike RPG — Implementation Guide

> **Status:** Initial architecture and implementation plan
> **Primary language:** TypeScript
> **Target:** Modern desktop and mobile browsers
> **Rendering:** PixiJS
> **UI:** React
> **Build tooling:** Vite
> **Persistent backend:** Supabase
> **Local persistence:** IndexedDB via Dexie
> **Testing:** Vitest + Playwright

---

# 1. Purpose of This Document

This document defines how to build a browser-based roguelike autoplay RPG.

It is intended to be read by:

* human developers;
* AI coding agents;
* designers working with developers;
* future maintainers of the project.

The document is both:

1. an architectural specification; and
2. a step-by-step implementation plan.

When implementation choices conflict with this document, prefer the principles in this document unless there is a documented reason to change them.

---

# 2. Game Concept

The game is an autoplaying roguelike RPG inspired by survivor-style games.

During a run:

* the player character moves automatically;
* the player character chooses targets automatically;
* attacks happen automatically;
* enemies spawn continuously;
* enemies move and attack automatically;
* XP is collected automatically or through pickup mechanics;
* the player gains levels;
* leveling pauses the game;
* the player chooses between randomized upgrades;
* builds become increasingly powerful and specialized;
* enemies become progressively more dangerous;
* the run ends when the player dies or defeats the final encounter.

The player's primary interaction is **decision-making rather than mechanical control**.

The player controls:

* skill choices;
* skill upgrades;
* gear choices;
* passive upgrades;
* build direction;
* potentially AI behavior;
* world difficulty modifiers;
* meta progression between runs.

The player does **not** normally control:

* movement;
* basic attacks;
* targeting;
* dodging;
* picking individual combat targets.

The central design goal is:

> **Build the hero rather than directly control the hero.**

---

# 3. Core Game Loop

The fundamental run loop is:

```text
Start Run
    ↓
Automatic Combat
    ↓
Kill Enemies
    ↓
Gain XP
    ↓
Level Up
    ↓
Pause Simulation
    ↓
Choose 1 of N Random Upgrades
    ↓
Resume Simulation
    ↓
Become Stronger
    ↓
Fight Harder Enemies
    ↓
Boss / Final Encounter
    ↓
Run Ends
    ↓
Calculate Rewards
    ↓
Save Meta Progression
    ↓
Start Another Run
```

A target run length for the first complete game mode should be approximately:

```text
15–20 minutes
```

The MVP can use shorter runs during development.

---

# 4. Architectural Principles

These principles are important and should be preserved throughout development.

## 4.1 The Run Must Be Completely Local

Once a run begins, gameplay must not depend on Supabase or any other network service.

During active gameplay:

```text
Required Supabase requests: 0
Required HTTP requests:     0
Required realtime streams:  0
```

Everything required to complete a run must already exist locally.

A network outage during a run must not affect gameplay.

---

## 4.2 Game Simulation Is Independent

Game logic must not depend on:

* React;
* PixiJS;
* Supabase;
* DOM APIs;
* browser storage.

The simulation should be ordinary TypeScript.

Conceptually:

```text
Input/configuration
       ↓
Game simulation
       ↓
Game state
       ↓
Renderer / UI
```

This makes the simulation:

* testable;
* deterministic;
* replayable;
* easier to optimize;
* potentially movable to a Web Worker later.

---

## 4.3 Rendering Does Not Own State

PixiJS renders game state.

It must not become the authoritative source for:

* enemy health;
* damage;
* cooldowns;
* positions;
* buffs;
* XP;
* skill state.

For example:

```text
WRONG

Pixi Sprite
├── hp
├── damage
├── cooldown
└── gameplay logic
```

Prefer:

```text
Enemy State
├── hp
├── damage
├── cooldown
├── x
└── y

        ↓

Enemy Renderer

        ↓

Pixi Sprite
```

---

## 4.4 React Does Not Own Simulation State

React should manage application UI.

It should not receive 60 updates per second for hundreds of entities.

React should handle things such as:

* menus;
* settings;
* character selection;
* upgrade selection;
* inventory UI;
* pause screen;
* run summary;
* meta progression;
* authentication.

React should not directly manage:

* enemy movement;
* projectile movement;
* collisions;
* attack cooldowns;
* enemy health;
* status effects.

---

## 4.5 Content Must Be Data Driven

Skills, enemies, items and upgrades should mostly be definitions rather than large hard-coded conditional trees.

Prefer:

```ts
const fireball: SkillDefinition = {
  id: 'fireball',
  name: 'Fireball',
  cooldown: 1.2,
  damage: 12,
  projectileSpeed: 400,
}
```

Avoid architectures that eventually become:

```ts
if (skill.id === 'fireball') {
  // hundreds of lines
}

if (skill.id === 'lightning') {
  // hundreds more
}
```

Some skills will require custom behavior, but generic systems should handle the majority of content.

---

## 4.6 Runs Should Be Deterministic Where Practical

Every run receives a seed.

Randomness must come from the run's seeded random-number generator.

Avoid using `Math.random()` inside simulation code.

This makes possible:

* reproducible bugs;
* automated simulation testing;
* run replay;
* daily challenges;
* balancing simulations;
* deterministic debugging.

---

# 5. Recommended Technology Stack

Use:

```text
Frontend shell
├── Vite
├── React
└── TypeScript

Game
├── TypeScript simulation
└── PixiJS rendering

UI state
└── Zustand

Local persistence
└── Dexie / IndexedDB

Permanent persistence
└── Supabase

Testing
├── Vitest
└── Playwright
```

Avoid adding major dependencies until they solve a demonstrated problem.

In particular, do not initially add:

* Phaser;
* Redux;
* a physics engine;
* an ECS framework;
* Web Worker abstraction libraries;
* multiplayer networking libraries.

These can be reconsidered later if requirements change.

---

# 6. Initial Repository Setup

Assume the repository is empty.

From the repository root:

```bash
npm create vite@latest . -- --template react-ts
npm install
```

Verify:

```bash
npm run dev
```

The default application should open successfully.

Commit immediately:

```bash
git add .
git commit -m "chore: initialize vite react typescript project"
```

---

# 7. Install Core Dependencies

Install runtime dependencies:

```bash
npm install pixi.js zustand dexie @supabase/supabase-js
```

Install unit testing:

```bash
npm install -D vitest
```

Initialize browser testing:

```bash
npm init playwright@latest
```

Choose TypeScript when prompted.

Also add useful scripts to `package.json`.

Example:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "test": "vitest",
    "test:run": "vitest run",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

---

# 8. Repository Structure

Use feature and responsibility boundaries rather than placing everything in generic `utils` folders.

Recommended structure:

```text
src/
├── app/
│   ├── App.tsx
│   ├── routes/
│   ├── screens/
│   └── components/
│
├── game/
│   ├── engine/
│   │   ├── Game.ts
│   │   ├── GameLoop.ts
│   │   ├── GameClock.ts
│   │   └── GameState.ts
│   │
│   ├── entities/
│   │   ├── player/
│   │   ├── enemies/
│   │   ├── projectiles/
│   │   ├── pickups/
│   │   └── summons/
│   │
│   ├── systems/
│   │   ├── movement/
│   │   ├── targeting/
│   │   ├── combat/
│   │   ├── damage/
│   │   ├── collision/
│   │   ├── spawning/
│   │   ├── experience/
│   │   ├── status-effects/
│   │   └── cleanup/
│   │
│   ├── skills/
│   ├── upgrades/
│   ├── items/
│   ├── modifiers/
│   ├── stats/
│   ├── ai/
│   ├── random/
│   └── spatial/
│
├── rendering/
│   ├── PixiGame.ts
│   ├── camera/
│   ├── layers/
│   ├── entities/
│   ├── effects/
│   ├── assets/
│   └── debug/
│
├── content/
│   ├── characters/
│   ├── enemies/
│   ├── skills/
│   ├── upgrades/
│   ├── items/
│   ├── bosses/
│   ├── modifiers/
│   └── encounters/
│
├── progression/
│   ├── meta/
│   ├── unlocks/
│   └── rewards/
│
├── persistence/
│   ├── local/
│   ├── remote/
│   └── sync/
│
├── stores/
│   ├── appStore.ts
│   ├── settingsStore.ts
│   └── runUiStore.ts
│
├── shared/
│   ├── types/
│   ├── math/
│   ├── assertions/
│   └── constants/
│
└── main.tsx
```

Tests can live beside their implementation:

```text
GameClock.ts
GameClock.test.ts
```

or inside dedicated test directories when appropriate.

End-to-end tests should live under:

```text
e2e/
```

---

# 9. Dependency Direction

Dependencies should generally flow downward like this:

```text
React App
     ↓
UI Stores
     ↓
Game API
     ↓
Game Simulation
     ↓
Pure domain logic
```

Rendering:

```text
Game Simulation
     ↓
Renderer Adapter
     ↓
PixiJS
```

Persistence:

```text
App / Progression
     ↓
Persistence Interface
     ├── IndexedDB
     └── Supabase
```

The following dependencies should be prohibited:

```text
game/ → React
game/ → Supabase
game/ → Dexie
game/ → DOM
game/ → Zustand
```

`game/` should ideally run in Node during unit tests without needing a browser.

---

# 10. Define Important IDs

Do not pass human-readable names as identifiers.

Use string IDs.

Example:

```ts
export type SkillId = string
export type EnemyId = string
export type ItemId = string
export type UpgradeId = string
export type CharacterId = string
```

Content:

```ts
export const SkillIds = {
  Fireball: 'fireball',
  ChainLightning: 'chain_lightning',
  Whirlwind: 'whirlwind',
} as const
```

Never make persistent data depend on display names.

Names may change.

IDs should not.

---

# 11. Game State

Start simple.

Example:

```ts
export interface GameState {
  run: RunState
  player: PlayerState

  enemies: EnemyState[]
  projectiles: ProjectileState[]
  pickups: PickupState[]
  summons: SummonState[]

  time: number
  tick: number

  paused: boolean
}
```

Do not prematurely create a complex ECS.

Arrays and ordinary objects are sufficient for the MVP.

---

# 12. Entity Identity

Every runtime entity should receive a numeric ID.

Example:

```ts
export type EntityId = number
```

The game owns an incremental allocator:

```ts
let nextEntityId = 1

export function createEntityId(): EntityId {
  return nextEntityId++
}
```

Eventually the allocator should belong to the game instance rather than global module state.

---

# 13. Fixed-Timestep Simulation

Simulation timing must not depend directly on render FPS.

Use a fixed simulation step.

Recommended:

```text
60 simulation ticks per second
```

Therefore:

```ts
export const FIXED_STEP_SECONDS = 1 / 60
```

Conceptually:

```ts
let accumulator = 0
let previousTime = performance.now()

function frame(now: number) {
  const elapsed = (now - previousTime) / 1000
  previousTime = now

  accumulator += Math.min(elapsed, 0.25)

  while (accumulator >= FIXED_STEP_SECONDS) {
    game.update(FIXED_STEP_SECONDS)
    accumulator -= FIXED_STEP_SECONDS
  }

  renderer.render(game.state)

  requestAnimationFrame(frame)
}
```

The elapsed frame time should be capped to prevent a temporarily inactive browser tab from attempting thousands of simulation ticks at once.

---

# 14. System Update Order

Define a stable update order.

For example:

```text
1. Update timers
2. Update player AI
3. Update enemy AI
4. Resolve targeting
5. Process ability cooldowns
6. Spawn attacks/projectiles
7. Move entities
8. Update spatial index
9. Resolve projectile collisions
10. Resolve contact attacks
11. Process damage
12. Process status effects
13. Process deaths
14. Spawn XP / drops
15. Process pickups
16. Process XP
17. Detect level up
18. Spawn enemies
19. Process encounter timeline
20. Cleanup dead entities
21. Evaluate run-end conditions
```

The exact order may evolve.

What matters is that it remains:

* explicit;
* deterministic;
* documented;
* tested.

---

# 15. Seeded Random Number Generator

Implement this near the beginning of development.

Create:

```text
src/game/random/
├── Random.ts
└── Random.test.ts
```

Interface:

```ts
export interface RandomSource {
  next(): number
  int(min: number, max: number): number
  chance(probability: number): boolean
  pick<T>(items: readonly T[]): T
}
```

Every run receives a seed:

```ts
interface RunConfig {
  seed: number
}
```

Random systems receive the game's RNG.

Never call:

```ts
Math.random()
```

from simulation systems.

---

# 16. Run State Machine

Do not represent the run using dozens of unrelated booleans.

Use an explicit state.

Example:

```ts
export type RunPhase =
  | 'loading'
  | 'playing'
  | 'level-up'
  | 'paused'
  | 'victory'
  | 'defeat'
  | 'results'
```

Transitions should be controlled centrally.

Example:

```text
loading
   ↓
playing
   ↓
level-up
   ↓
playing
   ↓
victory
   ↓
results
```

This prevents invalid states such as:

```text
levelUpOpen = true
gameOver = true
paused = false
```

---

# 17. First Player Entity

The initial player only needs:

```ts
interface PlayerState {
  id: EntityId

  x: number
  y: number

  radius: number

  hp: number
  maxHp: number

  level: number
  xp: number

  movementSpeed: number

  attackDamage: number
  attackSpeed: number
  attackRange: number

  targetId?: EntityId
}
```

Do not create the full RPG stat system before the basic game works.

---

# 18. First Enemy

Create one enemy type:

```text
Slime
```

Required values:

```ts
interface EnemyState {
  id: EntityId
  definitionId: EnemyDefinitionId

  x: number
  y: number

  radius: number

  hp: number
  maxHp: number

  speed: number

  contactDamage: number

  xpReward: number
}
```

Initial behavior:

```text
find player
    ↓
move toward player
    ↓
deal contact damage when close enough
```

Nothing more is necessary for the first milestone.

---

# 19. Player AI

The player's initial AI should be intentionally simple.

Every AI update:

```text
Find nearby enemies
       ↓
Select nearest valid enemy
       ↓
Determine preferred position
       ↓
Move toward / away from target
       ↓
Attack automatically
```

Eventually behavior can become configurable.

Possible future policies:

```ts
type PlayerBehavior =
  | 'balanced'
  | 'aggressive'
  | 'defensive'
  | 'collector'
  | 'elite-hunter'
```

Do not implement these variations until basic movement and combat work.

---

# 20. Target Selection

Create targeting as an independent system.

Example API:

```ts
interface TargetQuery {
  originX: number
  originY: number
  maxRange: number
}

function findNearestEnemy(
  query: TargetQuery,
  state: GameState,
): EnemyState | undefined
```

Later targeting modes can include:

```text
nearest
farthest
lowest health
highest health
nearest elite
random
cluster center
previous target
```

Skills should declare targeting behavior instead of implementing their own enemy scanning whenever possible.

---

# 21. Spatial Partitioning

Naive collision/targeting searches eventually become expensive.

Avoid repeatedly doing:

```ts
for (const projectile of projectiles) {
  for (const enemy of enemies) {
    // collision
  }
}
```

Implement a simple spatial hash before large enemy counts are introduced.

Concept:

```text
World
┌────┬────┬────┬────┐
│    │ XX │    │    │
├────┼────┼────┼────┤
│ XX │ XX │ XX │    │
├────┼────┼────┼────┤
│    │ XX │    │    │
└────┴────┴────┴────┘
```

Suggested API:

```ts
class SpatialHash<T> {
  clear(): void
  insert(id: EntityId, x: number, y: number, radius: number, value: T): void

  queryRadius(
    x: number,
    y: number,
    radius: number,
  ): T[]
}
```

Start with a straightforward implementation.

Optimize only after profiling.

---

# 22. First Attack

Create one basic projectile attack.

Example:

```text
Player targets nearest enemy
         ↓
Cooldown reaches zero
         ↓
Spawn projectile
         ↓
Projectile travels toward direction
         ↓
Projectile overlaps enemy
         ↓
Enemy receives damage
         ↓
Projectile is destroyed
```

Projectile state:

```ts
interface ProjectileState {
  id: EntityId

  ownerId: EntityId

  x: number
  y: number

  velocityX: number
  velocityY: number

  radius: number

  damage: number

  remainingLifetime: number
}
```

---

# 23. Damage System

Damage should be resolved centrally.

Do not directly subtract health throughout the codebase.

Instead generate damage events:

```ts
interface DamageEvent {
  sourceId?: EntityId
  targetId: EntityId

  amount: number

  damageType: DamageType
}
```

Then resolve them:

```ts
damageSystem.apply(event)
```

Future additions become easier:

* armor;
* shields;
* critical strikes;
* resistance;
* lifesteal;
* damage reflection;
* damage statistics;
* on-hit effects;
* on-damage effects.

---

# 24. Death Handling

An enemy death should produce a death event.

Example:

```ts
interface EnemyDeathEvent {
  enemyId: EntityId
  killerId?: EntityId

  x: number
  y: number

  xpReward: number
}
```

Other systems can react to it:

```text
Enemy Death
├── XP drop
├── kill counter
├── on-kill effects
├── loot chance
├── quest progress
└── analytics
```

Avoid coupling all of these directly into `Enemy.takeDamage()`.

---

# 25. Experience System

Start with XP gems or XP orbs.

Enemy dies:

```text
enemy death
    ↓
spawn XP pickup
    ↓
player enters pickup radius
    ↓
pickup moves toward player
    ↓
XP granted
```

Define level thresholds centrally.

Example:

```ts
function xpRequiredForLevel(level: number): number {
  return Math.floor(10 * Math.pow(level, 1.25))
}
```

The exact formula is temporary during development.

Never spread progression formulas through UI components.

---

# 26. Level-Up Flow

When XP reaches the threshold:

```text
XP threshold reached
        ↓
increase player level
        ↓
simulation pauses
        ↓
generate upgrade choices
        ↓
React displays level-up screen
        ↓
player selects upgrade
        ↓
apply upgrade
        ↓
simulation resumes
```

This is the most important player interaction in the game.

It should receive significant UX attention.

---

# 27. Upgrade Choice Generation

Initial configuration:

```text
Choices per level: 3
```

Create:

```ts
interface UpgradeChoice {
  upgradeId: UpgradeId
}
```

The selection algorithm should:

1. obtain all unlocked upgrades;
2. filter upgrades whose requirements are not met;
3. filter mutually exclusive choices;
4. apply rarity weights;
5. use seeded randomness;
6. return unique choices.

Example:

```ts
function generateUpgradeChoices(
  state: GameState,
  count: number,
  rng: RandomSource,
): UpgradeChoice[]
```

Write unit tests for this early.

---

# 28. Upgrade Categories

Use the following conceptual categories:

```ts
type UpgradeCategory =
  | 'skill'
  | 'skill-upgrade'
  | 'passive'
  | 'gear'
  | 'behavior'
```

Not every category needs to exist in the first MVP.

---

# 29. Skill Architecture

A skill definition should describe a reusable gameplay ability.

Example:

```ts
interface SkillDefinition {
  id: SkillId
  name: string
  description: string

  targeting: TargetingDefinition

  cooldown: number

  tags: SkillTag[]
}
```

Runtime skill state:

```ts
interface SkillState {
  skillId: SkillId

  level: number

  cooldownRemaining: number
}
```

Keep definitions immutable.

Runtime state belongs to the current run.

---

# 30. Skill Tags

Tags allow upgrades and gear to target classes of abilities.

Example:

```ts
type SkillTag =
  | 'fire'
  | 'ice'
  | 'lightning'
  | 'physical'
  | 'projectile'
  | 'melee'
  | 'summon'
  | 'area'
```

Then an item can say:

```text
+25% projectile damage
```

rather than explicitly listing every projectile skill.

---

# 31. Stat System

Do not begin with an overly complicated RPG calculation engine.

Start with understandable stats.

Example:

```ts
interface CharacterStats {
  maxHealth: number
  movementSpeed: number

  damageMultiplier: number
  attackSpeedMultiplier: number
  cooldownMultiplier: number

  armor: number

  pickupRadius: number
  xpMultiplier: number

  critChance: number
  critMultiplier: number
}
```

Later introduce more specialized stats only when content requires them.

---

# 32. Stat Modifier Model

Use a standardized modifier system.

Example:

```ts
interface StatModifier {
  stat: StatKey

  operation:
    | 'add'
    | 'multiply'

  value: number

  sourceId: string
}
```

Example:

```ts
{
  stat: 'movementSpeed',
  operation: 'multiply',
  value: 1.15,
  sourceId: 'boots_of_speed'
}
```

Calculate final values predictably.

Document modifier ordering.

For example:

```text
final = (base + additive bonuses) × multiplicative bonuses
```

Never let modifier order depend on upgrade acquisition order unless deliberately designed that way.

---

# 33. First Skills

The initial vertical slice should contain approximately three skills:

## Basic Bolt

```text
Type: projectile
Target: nearest enemy
Effect: direct damage
```

## Whirlwind

```text
Type: area / melee
Target: player-centered
Effect: periodic AoE damage
```

## Chain Lightning

```text
Type: lightning
Target: nearest enemy
Effect: jumps between enemies
```

These three exercise different pieces of architecture.

---

# 34. Skill Upgrade Example

Basic Bolt:

```text
Level 1
1 projectile
10 damage
1.0 second cooldown

Level 2
+30% damage

Level 3
+1 projectile

Level 4
+20% attack speed

Evolution
projectiles pierce enemies
```

The actual values are placeholders.

The important feature is branching and composable behavior.

---

# 35. Upgrade Requirements

Example:

```ts
interface UpgradeDefinition {
  id: UpgradeId

  name: string
  description: string

  rarity: Rarity

  requirements?: UpgradeRequirement[]

  apply(context: UpgradeContext): void
}
```

Requirements may include:

```text
has skill
skill level
has tag
player level
has item
does not have upgrade
world modifier active
```

---

# 36. Rarity

Initial rarity model:

```ts
type Rarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary'
```

Define rarity weights centrally.

Example placeholder values:

```ts
const rarityWeights = {
  common: 60,
  uncommon: 25,
  rare: 10,
  epic: 4,
  legendary: 1,
}
```

Do not treat these values as final balance.

---

# 37. Gear System

Gear should be introduced after the core skill loop works.

Potential slots:

```text
weapon
helmet
armor
boots
ring
amulet
```

Runtime gear:

```ts
interface EquippedItem {
  itemId: ItemId
}
```

Definitions:

```ts
interface ItemDefinition {
  id: ItemId
  name: string
  rarity: Rarity

  slot: EquipmentSlot

  modifiers: StatModifier[]

  effects?: EffectDefinition[]
}
```

Prefer mechanically interesting items over tiny stat variations.

---

# 38. Effect System

Eventually upgrades, skills and items will need effects such as:

```text
on hit
on kill
on crit
on taking damage
on enemy death
on skill cast
every N seconds
below health threshold
above health threshold
```

Do not build the complete effect framework immediately.

Introduce it when at least several pieces of content need the same mechanism.

Conceptually:

```ts
interface GameEventMap {
  enemyKilled: EnemyKilledEvent
  damageDealt: DamageDealtEvent
  damageTaken: DamageTakenEvent
  skillActivated: SkillActivatedEvent
}
```

Systems can subscribe or evaluate relevant effects.

Avoid an uncontrolled global event bus.

Prefer typed events with clear ownership.

---

# 39. Enemy Definitions

Enemy configuration should live under `content/enemies`.

Example:

```ts
interface EnemyDefinition {
  id: EnemyDefinitionId

  name: string

  maxHealth: number
  movementSpeed: number

  contactDamage: number

  xpReward: number

  radius: number

  tags: EnemyTag[]
}
```

Runtime enemies reference definitions:

```ts
{
  id: 8123,
  definitionId: 'slime',
  hp: 18,
  x: 420,
  y: 190
}
```

Do not duplicate every static definition value into runtime state unless performance requires it.

---

# 40. First Enemy Set

Build approximately five basic enemies for the vertical slice:

```text
Slime
- baseline melee enemy

Runner
- low HP
- fast movement

Brute
- high HP
- slow movement

Archer
- ranged attack

Splitter
- creates smaller enemies when killed
```

This creates meaningful pressure on different builds.

---

# 41. Elite System

After basic enemies work, introduce elite modifiers.

Start with two.

Example:

## Hasted

```text
+50% movement speed
+25% attack speed
```

## Giant

```text
+200% health
+50% size
+50% damage
```

Architecture:

```ts
interface EliteModifierDefinition {
  id: EliteModifierId

  modifiers: StatModifier[]
}
```

Eventually elites can receive multiple modifiers.

---

# 42. Enemy Spawn Director

Create a dedicated spawn director.

It decides:

* what to spawn;
* when to spawn;
* how many;
* where;
* whether elites spawn.

Example interface:

```ts
interface SpawnDirector {
  update(
    state: GameState,
    delta: number,
  ): SpawnRequest[]
}
```

The director should depend on run time rather than arbitrary `setTimeout()` calls.

---

# 43. Spawn Budget

Prefer a spawn budget model over enormous manually scripted tables.

Concept:

```text
Time → threat budget per second
```

Example:

```text
Slime cost:   1
Runner cost:  2
Brute cost:   5
Archer cost:  4
Elite cost:  12
```

At 10 minutes:

```text
spawn budget = 20 threat / second
```

The spawn director spends that budget.

This makes balancing easier.

---

# 44. Spawn Locations

Enemies should usually spawn outside the visible player area.

Concept:

```text
        enemy spawn ring

      ┌────────────────┐
      │                │
      │   ┌────────┐   │
      │   │ camera │   │
      │   │ player │   │
      │   └────────┘   │
      │                │
      └────────────────┘
```

Avoid enemies visibly appearing directly beside the player unless an ability explicitly telegraphs that behavior.

---

# 45. Encounter Timeline

The spawn director handles normal enemies.

A separate encounter timeline handles milestones.

Example:

```text
00:00 run begins
02:00 elite
05:00 mini boss
08:00 increased pressure
10:00 boss
15:00 final boss
```

Represent these as content.

Example:

```ts
interface EncounterEvent {
  time: number
  type: EncounterEventType
}
```

---

# 46. Bosses

Do not build bosses until basic combat feels good.

The first boss should test existing systems rather than requiring an entirely separate engine.

Example boss:

```text
Stone Golem

Behavior:
- chase player
- periodically charge
- periodically spawn shockwave
- spawn small enemies at health thresholds
```

Bosses should have:

* clear state transitions;
* visible telegraphs;
* deterministic timers;
* reusable abilities.

---

# 47. World Modifiers

World modifiers are selected outside a run.

Example:

```ts
interface WorldModifierDefinition {
  id: WorldModifierId

  name: string
  description: string

  rewardMultiplier: number

  apply(config: RunConfig): void
}
```

Examples:

## Swarming

```text
Enemy spawn rate: +100%
Enemy health: -25%
Reward multiplier: increased
```

## Juggernauts

```text
Enemy count: -40%
Enemy health: +200%
Elite rate: increased
```

## Glass World

```text
Player damage: +100%
Enemy damage: +100%
```

These should modify run configuration before simulation begins.

---

# 48. Difficulty Score

Calculate a normalized difficulty score from modifiers.

Example:

```ts
interface RunDifficulty {
  score: number
  rewardMultiplier: number
}
```

Do not allow arbitrary client-provided reward multipliers to become trusted server values later.

Persist the selected modifier IDs and calculate rewards according to known definitions.

---

# 49. PixiJS Rendering Layer

Create one Pixi application.

Example conceptual initialization:

```ts
import { Application } from 'pixi.js'

export async function createPixiApplication(
  container: HTMLElement,
) {
  const app = new Application()

  await app.init({
    resizeTo: container,
    antialias: true,
  })

  container.appendChild(app.canvas)

  return app
}
```

React owns the container element.

Pixi owns its canvas contents.

---

# 50. Rendering Layers

Use explicit rendering layers.

Example:

```text
world
├── ground
├── decorations
├── pickups
├── enemies
├── player
├── projectiles
├── effects
└── world UI
```

Possible implementation:

```ts
const worldContainer = new Container()
const enemyContainer = new Container()
const projectileContainer = new Container()
```

Keep screen-space React UI outside the Pixi canvas unless rendering it in Pixi has a demonstrated benefit.

---

# 51. Camera

The player should normally stay near the center.

The world moves relative to the camera.

Concept:

```ts
screenX = worldX - cameraX
screenY = worldY - cameraY
```

Avoid unnecessarily changing simulation coordinates based on camera movement.

World coordinates and rendering coordinates must remain distinct concepts.

---

# 52. Renderer Entity Mapping

Maintain a mapping:

```ts
Map<EntityId, EnemyView>
```

When simulation contains a new enemy:

```text
create sprite
```

When simulation updates:

```text
update sprite transform
```

When simulation removes enemy:

```text
remove sprite
return resources if pooled
```

Do not recreate all sprites every frame.

---

# 53. Placeholder Graphics First

Do not block gameplay development on art.

Use:

```text
player      blue circle
enemy       red circle
elite       larger circle
projectile  small circle
XP          diamond/circle
```

The first objective is proving gameplay.

Replace with production art later.

---

# 54. React Integration

Create a component:

```text
<GameCanvas />
```

Responsibilities:

1. create Pixi application;
2. create game instance;
3. start game loop;
4. attach renderer;
5. clean up everything on unmount.

Example structure:

```tsx
function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    // initialize game

    return () => {
      // destroy renderer/game
    }
  }, [])

  return <div ref={containerRef} />
}
```

Strict cleanup is important because React development behavior can expose accidental duplicate initialization.

---

# 55. Zustand UI Store

Zustand should contain low-frequency information React needs.

Example:

```ts
interface RunUiState {
  phase: RunPhase

  playerLevel: number
  playerHealthPercent: number

  upgradeChoices: UpgradeChoice[]

  openLevelUp: (
    choices: UpgradeChoice[],
  ) => void

  closeLevelUp: () => void
}
```

Do not store:

```text
all enemies
all projectiles
all pickups
```

in Zustand.

---

# 56. UI Update Frequency

The game may simulate at:

```text
60 Hz
```

The HUD does not necessarily need 60 React renders per second.

Update UI snapshots at something like:

```text
5–10 Hz
```

or whenever meaningful values change.

Example HUD snapshot:

```ts
interface RunHudSnapshot {
  hp: number
  maxHp: number

  xp: number
  xpRequired: number

  level: number

  elapsedTime: number
  killCount: number
}
```

---

# 57. Level-Up UI

The game emits a level-up state.

React renders:

```text
┌─────────────────────────────────────────────┐
│                  LEVEL 8                    │
│                                             │
│  ┌────────────┐ ┌────────────┐ ┌─────────┐ │
│  │ Fireball   │ │ Swift      │ │ Armor   │ │
│  │ Level III  │ │ Movement   │ │ +20     │ │
│  └────────────┘ └────────────┘ └─────────┘ │
│                                             │
│                 REROLL                      │
└─────────────────────────────────────────────┘
```

During this screen:

```text
simulation = paused
rendering = may continue
animations = may continue
```

The distinction between simulation pause and rendering pause is useful.

---

# 58. Local Persistence with Dexie

Use IndexedDB for resilient local state.

Initial database:

```text
localSettings
pendingRunResults
cachedProfile
optionalRunSnapshot
```

Example:

```ts
interface PendingRunResult {
  runId: string
  completedAt: number

  payload: RunResult
}
```

Flow:

```text
run finishes
    ↓
save result to IndexedDB
    ↓
attempt Supabase upload
    ↓
success?
 ┌──┴──┐
yes    no
 ↓      ↓
delete  keep locally
local   retry later
copy
```

This prevents earned progress from disappearing because the network failed after the run.

---

# 59. Do Not Persist Every Game Tick

Never continuously save:

```text
enemy positions
projectile positions
combat events
individual kills
individual XP pickups
```

to Supabase.

In most cases, do not persist them to IndexedDB either.

The active run primarily lives in memory.

---

# 60. Optional Run Recovery

Run recovery should be treated as a later feature.

If implemented, occasionally save a compact run snapshot locally.

For example:

```text
every 30–60 seconds
```

This is only for:

* browser crash;
* accidental refresh;
* mobile tab eviction.

Do not upload recovery snapshots continuously to Supabase.

---

# 61. Supabase Responsibilities

Supabase should eventually handle:

```text
authentication
player profile
meta currency
unlocks
character progression
achievements
account-level settings
completed-run summaries
leaderboards if introduced
```

Supabase should not handle the active simulation.

---

# 62. Supabase Client

Create one adapter:

```text
src/persistence/remote/
├── supabaseClient.ts
├── profileRepository.ts
├── progressionRepository.ts
└── runRepository.ts
```

Game code must never import this directory.

---

# 63. Environment Variables

Use Vite environment variables.

Example:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Create:

```text
.env.local
```

Never commit secrets.

The browser-safe Supabase key is not equivalent to a server secret, but database security must still rely on authorization and RLS rather than hiding the client key.

Never expose a Supabase service-role or secret key in browser code.

---

# 64. Initial Supabase Schema

A reasonable starting schema:

```text
profiles
--------
id
display_name
created_at
updated_at


player_progress
---------------
user_id
meta_currency
total_runs
total_kills
highest_difficulty
updated_at


player_unlocks
--------------
user_id
unlock_id
unlocked_at


character_progress
------------------
user_id
character_id
mastery_xp
updated_at


completed_runs
--------------
id
user_id
game_version
seed
character_id
duration_ms
level_reached
kills
difficulty_score
reward_amount
completed_at
```

Do not create dozens of tables before actual game requirements exist.

---

# 65. Row Level Security

All user-owned tables exposed to browser clients must use appropriate Row Level Security.

Conceptually:

```text
user may read:
their own progression

user may update:
their own progression through allowed paths

user may read:
their own completed runs
```

Never rely on:

```text
"the frontend won't send an invalid user ID"
```

as security.

---

# 66. Run Result

At run completion build a compact summary.

Example:

```ts
interface RunResult {
  runId: string

  gameVersion: string

  seed: number

  characterId: CharacterId

  startedAt: number
  durationMs: number

  levelReached: number

  kills: number
  elitesKilled: number
  bossesKilled: number

  damageDealt: number
  damageTaken: number

  worldModifierIds: WorldModifierId[]

  metaCurrencyEarned: number
}
```

This object becomes the boundary between the run and persistence.

---

# 67. Idempotent Result Submission

Prevent duplicate result submission.

Every run receives:

```ts
runId
```

The server/database should reject or safely ignore duplicate submissions of the same completed run.

This matters because the local sync process may retry after uncertain network failures.

Conceptually:

```text
client sends run abc123
        ↓
database already has abc123?
        ↓
yes → return existing result
no  → process it
```

---

# 68. Client Trust

Initially, this is primarily a single-player game.

That means client-side calculation is acceptable for many progression systems.

However, assume players can alter:

* JavaScript;
* memory;
* HTTP requests;
* local storage;
* IndexedDB.

Therefore client-submitted scores must not eventually be treated as authoritative for competitive systems.

If leaderboards become important, design server-side validation separately.

Do not overbuild anti-cheat for the initial single-player MVP.

---

# 69. Meta Progression

Meta progression occurs outside runs.

Prioritize unlocking new possibilities rather than enormous permanent numerical bonuses.

Good unlocks:

```text
new character
new skill
new item
new world modifier
new enemy tier
new starting loadout
new difficulty
```

Use permanent raw power sparingly.

---

# 70. Meta Currency

Start with one currency.

Example:

```text
Essence
```

Earned after runs.

Used to unlock:

```text
characters
skills
starting bonuses
world modifiers
new content
```

Do not introduce five currencies before there is a clear design need.

---

# 71. Character Architecture

Characters define initial conditions.

Example:

```ts
interface CharacterDefinition {
  id: CharacterId

  name: string
  description: string

  baseStats: CharacterStats

  startingSkills: SkillId[]

  behavior: PlayerBehavior
}
```

Start with one character.

Add more only after the vertical slice works.

---

# 72. First Complete Character

Example:

```text
Adventurer

Starting skill:
Basic Bolt

Behavior:
Balanced

Properties:
100 HP
normal movement
normal pickup radius
```

The first character should intentionally be boring.

It establishes a baseline for balancing future characters.

---

# 73. Game Version

Every run should record a game version.

Example:

```ts
export const GAME_VERSION = '0.1.0'
```

Persist it in `RunResult`.

Why?

Balance changes can radically alter results.

A score from version:

```text
0.1.0
```

may not be comparable to:

```text
0.8.0
```

---

# 74. Content Versioning

Saved references should use stable IDs.

For example:

```text
fireball
chain_lightning
boots_of_haste
```

If content is removed, old saved data should fail gracefully.

Do not assume every historical content ID still exists.

---

# 75. Debug Mode

Create a developer overlay early.

Toggle using a query parameter or development-only key.

Example information:

```text
FPS
simulation ticks/sec
enemy count
projectile count
pickup count
sprite count
spatial cells
player coordinates
run seed
elapsed simulation time
spawn budget
```

Example:

```text
FPS:          60
Enemies:      483
Projectiles:  128
Pickups:      206
Seed:         483921
Time:         08:42
```

This will become invaluable.

---

# 76. Developer Commands

Add development-only helpers.

Examples:

```text
kill player
heal player
add XP
gain 10 levels
spawn 100 enemies
spawn boss
clear enemies
set time to 10:00
give skill
give upgrade
increase game speed
```

Do not require playing eight minutes every time a boss needs testing.

---

# 77. Simulation Speed Control

Support development-only simulation speed.

Example:

```text
0.5x
1x
2x
5x
10x
```

This makes balance and long-run testing significantly faster.

The game simulation's fixed-step architecture makes this easier.

---

# 78. Unit Testing Strategy

Unit test systems that should behave deterministically.

Priority tests:

```text
seeded RNG
XP thresholds
level-up detection
upgrade eligibility
upgrade random selection
stat aggregation
damage calculation
cooldown calculation
spatial queries
spawn budget
world modifiers
run reward calculation
```

Example:

```ts
describe('seeded random', () => {
  it('generates identical sequences for identical seeds', () => {
    const a = new Random(123)
    const b = new Random(123)

    expect([
      a.next(),
      a.next(),
      a.next(),
    ]).toEqual([
      b.next(),
      b.next(),
      b.next(),
    ])
  })
})
```

---

# 79. Deterministic Simulation Tests

Eventually create tests capable of running the simulation without Pixi.

Example:

```ts
const game = createGame({
  seed: 12345,
  characterId: 'adventurer',
})

for (let i = 0; i < 60 * 60; i++) {
  game.update(1 / 60)
}

expect(game.state.time).toBeCloseTo(60)
```

This enables automated balance testing.

---

# 80. Headless Bot Runs

A future balance tool should be able to simulate thousands of runs.

Conceptually:

```text
Build A
1000 simulations

Average survival:
12m 42s

Average level:
31.2

Win rate:
41%

Damage composition:
Fireball 44%
Lightning 31%
Summon 25%
```

This is a major long-term advantage of separating simulation from rendering.

---

# 81. Playwright Tests

Use Playwright for browser behavior.

Initial E2E tests:

```text
application opens
game canvas appears
new run can start
level-up overlay appears
upgrade can be selected
simulation resumes
settings survive reload
run results screen appears
```

Do not use browser E2E tests to validate every damage formula.

Those belong in unit tests.

---

# 82. Performance Targets

Initial target:

```text
60 FPS on a reasonable modern desktop browser
```

Design for at least:

```text
500 active enemies
500 active projectiles
500 active pickups
```

without severe slowdown.

These numbers are targets, not requirements for milestone one.

Later stress tests should attempt significantly higher counts.

---

# 83. Performance Rules

Avoid allocations inside large hot loops when possible.

Avoid:

```ts
enemies.filter(...)
  .map(...)
  .sort(...)
```

every frame when thousands of entities exist.

Prefer explicit loops in performance-sensitive systems.

Do not optimize ordinary UI code this aggressively.

---

# 84. Object Pooling

Do not begin with elaborate object pools.

First profile.

Object pooling may later help:

```text
projectiles
particles
damage numbers
temporary render objects
```

Simulation entities can initially use normal allocation.

---

# 85. Typed Arrays and ECS

Do not implement an ECS framework in the MVP.

Ordinary TypeScript objects are easier to develop.

If profiling later shows simulation bottlenecks, hot entity data could migrate toward:

```text
Float32Array positions
Float32Array velocities
Float32Array health
Uint32Array entity IDs
```

This should be a measured optimization.

Not an architectural starting point.

---

# 86. Web Workers

Keep the initial game on the main thread.

Architecture:

```text
Main thread
├── React
├── PixiJS
└── simulation
```

Only consider:

```text
Worker
└── simulation
```

if profiling demonstrates that CPU-bound simulation prevents smooth rendering.

Because the simulation is already independent, migration remains possible.

---

# 87. Assets

Recommended asset structure:

```text
public/
└── assets/
    ├── characters/
    ├── enemies/
    ├── skills/
    ├── items/
    ├── effects/
    ├── ui/
    └── audio/
```

For production, eventually consider sprite atlases rather than hundreds of separate image loads.

Do not optimize asset packaging during the gameplay prototype.

---

# 88. Audio

Audio should be introduced after the first gameplay loop works.

Separate categories:

```text
master
music
effects
UI
```

Persist volume settings locally.

Combat audio must remain restrained because hundreds of attacks may occur per second.

Use rate limiting or aggregated effects.

Do not play one sound for every individual late-game damage event.

---

# 89. Screen and Resolution

The game should support arbitrary browser sizes.

Use:

```text
responsive canvas
fixed conceptual world units
camera independent of CSS pixels
```

Gameplay must not become easier because someone has an ultrawide monitor.

Define a gameplay viewport policy.

Possible solution:

* render additional decorative area on wide displays;
* keep target/spawn calculations based on a normalized gameplay viewport.

---

# 90. Mobile Support

Mobile can be supported because the game requires little direct input.

Important considerations:

```text
touch-friendly upgrade cards
large buttons
responsive HUD
browser tab suspension
memory limits
reduced particle counts
battery usage
```

Mobile optimization should happen after desktop vertical slice completion.

---

# 91. Accessibility

Plan early for:

```text
reduced motion
screen shake toggle
damage-number toggle
high-contrast UI
text scaling
volume controls
keyboard upgrade selection
color-independent rarity indicators
```

Because the game plays automatically, it has strong potential to be accessible if menus and information are designed well.

---

# 92. Error Handling

Gameplay errors should not silently corrupt progression.

At minimum:

```text
local persistence errors → log + notify gracefully
Supabase errors → preserve pending result
content definition errors → fail loudly in development
missing asset → use placeholder if possible
invalid upgrade → reject safely
```

Create development assertions.

Example:

```ts
invariant(
  enemyDefinition !== undefined,
  `Unknown enemy definition: ${id}`,
)
```

---

# 93. Logging

Do not leave uncontrolled `console.log()` calls everywhere.

Create a small logger:

```ts
logger.debug()
logger.info()
logger.warn()
logger.error()
```

Development logs can be verbose.

Production logs should be quieter.

---

# 94. Content Validation

Data-driven architecture introduces the possibility of invalid data.

Add validation during startup.

Examples:

```text
all upgrade IDs are unique
all skill IDs are unique
required skill IDs exist
item modifier stat names exist
rarity exists
boss encounter references valid boss
```

Fail fast during development.

---

# 95. Code Style Rules

Prefer:

```text
small modules
pure functions where practical
explicit types at system boundaries
readonly content definitions
descriptive names
composition over inheritance
```

Avoid deep inheritance trees such as:

```text
Entity
→ LivingEntity
→ CombatEntity
→ MobileCombatEntity
→ EnemyEntity
→ EliteEnemyEntity
→ FireEliteEnemyEntity
```

Prefer composition and definitions.

---

# 96. AI Coding Agent Rules

Any AI working in this repository should follow these rules.

## Before Making Changes

Read:

```text
README.md
GAME_IMPLEMENTATION_GUIDE.md
package.json
relevant existing module tests
```

Do not assume architecture from generic game-development conventions.

---

## AI Rule: Preserve Layer Boundaries

Do not import React/Pixi/Supabase/Dexie into:

```text
src/game/
```

unless the architecture is explicitly changed and documented.

---

## AI Rule: Do Not Add Dependencies Casually

Before installing a package, determine whether existing code or platform APIs already solve the problem.

An AI agent should not install a package merely because it is convenient.

Dependencies require justification.

---

## AI Rule: Keep Simulation Deterministic

Do not introduce:

```ts
Math.random()
Date.now()
performance.now()
setTimeout()
setInterval()
```

inside deterministic simulation logic.

Time and randomness should come from game-controlled abstractions.

---

## AI Rule: Add Tests for Pure Systems

When changing:

```text
damage
XP
random selection
stats
upgrades
spawning
progression
```

add or update unit tests.

---

## AI Rule: Avoid Premature Abstraction

Do not create a generic framework before at least two or three real use cases require it.

Prefer:

```text
simple implementation
→ repeated pattern emerges
→ refactor
```

over attempting to predict every future mechanic.

---

## AI Rule: Do Not Mix Content and Engine

Game definitions belong in:

```text
src/content/
```

Reusable mechanics belong in:

```text
src/game/
```

Adding a new enemy should mostly involve adding a definition.

Adding an entirely new enemy behavior may require engine code.

---

## AI Rule: Run Validation Before Finishing

Before considering a programming task complete, run applicable commands:

```bash
npm run lint
npm run test:run
npm run build
```

If the task changes browser behavior:

```bash
npm run test:e2e
```

Fix failures rather than ignoring them.

---

# 97. Git Strategy

Keep commits small and focused.

Examples:

```text
feat: add fixed timestep game loop
feat: add enemy movement system
feat: add projectile collision
feat: add xp pickups
feat: add level up choices
test: add deterministic rng tests
perf: add enemy spatial hash
```

Avoid giant commits containing unrelated architecture, content and UI changes.

---

# 98. Milestone Strategy

Build the game through playable milestones.

Never attempt to implement the entire design at once.

Each milestone should produce something visible and testable.

---

# 99. Milestone 0 — Repository Foundation

## Goal

Create a reliable development environment.

## Tasks

* initialize Vite React TypeScript;
* install PixiJS;
* install Zustand;
* install Dexie;
* install Supabase client;
* install Vitest;
* install Playwright;
* create directory structure;
* configure scripts;
* create this architecture document;
* create minimal README;
* configure environment variables;
* ensure build succeeds.

## Definition of Done

These succeed:

```bash
npm run dev
npm run lint
npm run test:run
npm run build
```

---

# 100. Milestone 1 — Pixi Prototype

## Goal

Render a game canvas.

## Tasks

Create:

```text
<GameCanvas />
Pixi application
world container
camera
placeholder player circle
```

Player can initially remain stationary.

## Definition of Done

Opening the game displays:

```text
browser page
└── game canvas
    └── player placeholder
```

No combat yet.

---

# 101. Milestone 2 — Simulation Loop

## Goal

Establish the independent game engine.

## Tasks

Implement:

```text
Game
GameState
fixed timestep
run clock
pause/resume
seeded RNG
```

The player should move according to simulation state.

Pixi merely follows.

## Definition of Done

A unit test can run the simulation without PixiJS.

---

# 102. Milestone 3 — First Enemy

## Goal

Have an enemy automatically chase the player.

## Tasks

Implement:

```text
EnemyState
Slime definition
enemy spawn
enemy movement
player position
enemy renderer
```

## Definition of Done

A slime appears and automatically approaches the player.

---

# 103. Milestone 4 — Automatic Player Combat

## Goal

The character fights without player input.

## Tasks

Implement:

```text
target selection
attack cooldown
projectile creation
projectile movement
collision
damage
enemy death
```

## Definition of Done

The player automatically finds and kills slimes.

At this point the fundamental concept exists.

---

# 104. Milestone 5 — Endless Enemy Spawning

## Goal

Create continuous combat pressure.

Implement:

```text
spawn director
spawn ring
threat scaling
enemy cleanup
kill counter
```

## Definition of Done

Enemies continuously spawn and difficulty gradually increases.

---

# 105. Milestone 6 — XP and Leveling

## Goal

Create the progression loop.

Implement:

```text
XP drops
pickup attraction
XP collection
level thresholds
level-up detection
simulation pause
```

## Definition of Done

Killing enemies eventually causes the player to level up and pauses combat.

---

# 106. Milestone 7 — First Upgrade Screen

## Goal

Create actual player interaction.

Implement:

```text
React level-up overlay
3 randomized choices
seeded upgrade generation
select upgrade
resume simulation
```

Initial upgrades:

```text
+damage
+attack speed
+movement speed
```

## Definition of Done

The player can repeatedly level up and make choices that affect the run.

This is the first true playable prototype.

---

# 106.5 Milestone 7.5 — Basic Run UI

## Goal

Make the existing combat/progression prototype playable as a complete,
understandable run flow before expanding its skill content.

## Implement

```text
pre-run dashboard
start run action
gameplay HUD
level, XP, kill count, elapsed time, and health display
explicit temporary End Run control
defeat transition with player HP set to zero
end-game results screen
return-to-dashboard action
```

The temporary End Run control is development/prototype UI only. It must use the
same `defeat` run-state transition and result data path that future player death
will use; it must not bypass simulation cleanup or invent a separate result
flow.

React owns these screen-space UI surfaces. The game simulation remains the
source of truth for run phase, player health, time, level, XP, and kills.

## Definition of Done

```text
dashboard
  ↓ start run
gameplay HUD with active combat
  ↓ End Run
defeat/results screen
  ↓ return
dashboard
```

The level-up overlay must continue to pause and resume the run correctly within
this flow.

---

# 107. Milestone 8 — Skills

## Goal

Transform simple stat choices into builds.

Add:

```text
Basic Bolt
Whirlwind
Chain Lightning
```

Add skill-level upgrades.

## Definition of Done

Two runs can produce meaningfully different combat behavior based on upgrade selections.

---

# 108. Milestone 9 — Enemy Variety

Add:

```text
Runner
Brute
Archer
Splitter
```

Introduce reusable enemy behavior components.

## Definition of Done

Different enemy compositions pressure different builds.

---

# 109. Milestone 10 — Spatial Hash and Stress Testing

Add:

```text
spatial hash
entity count debug panel
spawn 100 command
spawn 500 command
spawn 1000 command
```

Profile:

```text
target selection
collisions
rendering
effects
```

## Definition of Done

Performance characteristics are measurable rather than guessed.

---

# 110. Milestone 11 — Gear and Rich Upgrades

Introduce:

```text
gear
rarity
passive upgrades
tag-specific modifiers
interesting conditional effects
```

Example:

```text
Storm Ring

+15% lightning damage

Every fifth lightning hit
chains one additional time.
```

## Definition of Done

Build decisions involve synergies rather than only numerical scaling.

---

# 111. Milestone 12 — Elite Enemies

Implement:

```text
elite selection
Hasted modifier
Giant modifier
elite visual marker
better rewards
```

## Definition of Done

Random elite encounters create temporary difficulty spikes.

---

# 112. Milestone 13 — Boss

Implement:

```text
encounter timeline
first boss
boss health bar
boss abilities
boss victory
```

## Definition of Done

A run has a clear intermediate objective.

---

# 113. Milestone 14 — Full Run Structure

Create:

```text
15-minute run
time-based difficulty
elite events
boss events
final boss
victory
defeat
results screen
```

## Definition of Done

The game has a complete beginning, middle and end.

---

# 114. Milestone 15 — Local Persistence

Introduce Dexie.

Persist:

```text
settings
pending run result
basic local profile
```

## Definition of Done

Refreshing the browser does not erase settings or an unsynchronized completed run result.

---

# 115. Milestone 16 — Supabase Authentication

Add:

```text
sign in
sign out
account state
profile creation
```

Do not integrate active gameplay with network calls.

## Definition of Done

A player can authenticate and retain account identity across sessions.

---

# 116. Milestone 17 — Meta Progression

Implement:

```text
meta currency
unlock definitions
unlock screen
progression persistence
```

Run completion:

```text
RunResult
    ↓
local queue
    ↓
Supabase
    ↓
meta progression
```

## Definition of Done

Completing runs permanently advances the account.

---

# 117. Milestone 18 — World Modifiers

Create modifier-selection screen.

Initial modifiers:

```text
Swarming
Juggernauts
Glass World
Elite Invasion
Fast Start
```

Calculate:

```text
difficulty score
reward multiplier
```

## Definition of Done

Players can deliberately make runs harder for increased rewards.

---

# 118. Milestone 19 — Multiple Characters

Introduce at least three playstyles.

Example:

## Knight

```text
melee tendency
high durability
```

## Ranger

```text
range tendency
high movement
```

## Necromancer

```text
summon focus
survival-oriented AI
```

Do not create characters by duplicating engine code.

---

# 119. Milestone 20 — Polish

Only after the core game works:

```text
production art
animations
particles
screen shake
audio
music
damage numbers
better HUD
tooltips
transitions
tutorial
accessibility
mobile layout
```

Polish should amplify good gameplay rather than hide incomplete mechanics.

---

# 120. First Development Sprint

The recommended immediate implementation sequence is:

```text
1. Initialize Vite project
2. Install core dependencies
3. Create directory structure
4. Add Vitest
5. Add Pixi canvas
6. Create Game class
7. Create fixed timestep
8. Create seeded RNG
9. Create player state
10. Render player
11. Create slime
12. Render slime
13. Make slime chase player
14. Add player auto-targeting
15. Add projectile
16. Add collisions
17. Add damage
18. Add enemy death
19. Add enemy spawning
20. Add XP pickup
21. Add leveling
22. Add level-up UI
23. Add three upgrades
```

Do not work on Supabase before these are functional unless authentication is needed for unrelated infrastructure work.

---

# 121. First Playable Target

The first genuinely playable version should be extremely small.

Content:

```text
1 character
1 arena
3 enemy types
3 skills
10–15 upgrades
1 elite type
1 boss
10-minute run
3 upgrade choices per level
```

Meta progression can initially be absent.

If this version is not fun, adding 200 items will not fix the underlying problem.

---

# 122. MVP Content Target

After the first playable version proves the concept:

```text
Characters:        3
Skills:            8–12
Skill upgrades:    40–60
Passive upgrades:  20–30
Gear items:        30–50
Enemy types:       10–15
Elite modifiers:   6–10
Bosses:            3
World modifiers:   10–15
```

These are directional targets, not hard requirements.

---

# 123. Balancing Data

Centralize tunable values.

Example:

```text
src/content/balance/
├── player.ts
├── experience.ts
├── spawning.ts
├── rarity.ts
└── difficulty.ts
```

Do not hide balance constants inside systems.

Bad:

```ts
if (elapsed > 482) {
  spawnRate *= 1.37
}
```

Better:

```ts
const difficultyCurve = ...
```

---

# 124. Balance Metrics

Record useful run statistics locally.

Examples:

```text
damage by skill
kills by skill
damage taken
healing received
XP collected
XP missed
upgrade history
boss kill duration
level progression
enemy damage contribution
```

These statistics can initially be displayed only on the results screen or developer overlay.

They are valuable for balancing.

---

# 125. Upgrade History

Record choices during a run.

Example:

```ts
interface UpgradeHistoryEntry {
  time: number
  level: number

  offered: UpgradeId[]
  selected: UpgradeId
}
```

This is useful for:

* debugging;
* run summaries;
* replay;
* analytics;
* balance analysis.

---

# 126. Run Replay Architecture

Full replay does not need to be implemented initially.

However, deterministic design should make future replay possible using approximately:

```text
game version
seed
character
world modifiers
upgrade choices + times/levels
```

Because player movement is automatic, replay is considerably easier than in a manually controlled action game.

This could become an important feature.

---

# 127. Daily Challenges

Deterministic seeds also make daily challenges possible.

Example:

```text
Daily Challenge

Seed:
generated from date

Character:
fixed

World modifiers:
fixed

Upgrade RNG:
same for everyone
```

Players compete under comparable conditions.

Do not implement this before normal runs work.

---

# 128. Performance Profiling Checklist

When performance decreases, measure separately:

```text
simulation update time
enemy AI
target acquisition
collision detection
projectile updates
spawning
Pixi rendering
particles
React updates
garbage collection
```

Do not assume Pixi is responsible merely because FPS dropped.

Measure first.

---

# 129. Expected Optimization Order

If performance becomes a problem, optimize approximately in this order:

```text
1. eliminate accidental React rerenders
2. eliminate O(n²) targeting/collision
3. spatial partitioning
4. reduce unnecessary allocations
5. reduce graphical effects
6. sprite batching / asset improvements
7. object pooling where beneficial
8. lower update frequencies for some AI
9. data-oriented structures
10. Web Worker simulation
```

Do not jump directly to Web Workers.

---

# 130. AI Update Frequencies

Not every system requires 60 Hz updates.

Possible future optimization:

```text
projectiles:      60 Hz
movement:         60 Hz
boss behavior:    30 Hz
target selection: 10–20 Hz
spawn director:   5–10 Hz
some passive AI:  5–10 Hz
HUD:              5–10 Hz
```

Use this only when profiling indicates a benefit.

---

# 131. Save Compatibility

Persistent progression should be evolvable.

Do not serialize arbitrary runtime classes directly.

Use explicit DTOs.

Example:

```ts
interface LocalSaveV1 {
  version: 1
  settings: SettingsData
  pendingRuns: PendingRunResult[]
}
```

When structure changes, migrate intentionally.

---

# 132. Repository README

The root README should remain short.

Recommended structure:

```markdown
# Game Name

Short description.

## Development

npm install
npm run dev

## Validation

npm run lint
npm run test:run
npm run build

## Architecture

See GAME_IMPLEMENTATION_GUIDE.md.
```

Do not duplicate the entire architecture document into the README.

---

# 133. Definition of Done for Features

A feature is complete when appropriate portions of the following are satisfied:

* implementation works;
* TypeScript has no errors;
* lint passes;
* unit tests pass;
* relevant new logic has tests;
* production build succeeds;
* architecture boundaries remain intact;
* no unnecessary dependency was introduced;
* debug tooling works where relevant;
* UI works at common viewport sizes;
* old save data does not catastrophically fail;
* content IDs are stable;
* no network request was introduced into active simulation;
* documentation is updated if architecture changed.

---

# 134. Architectural Decision Records

For major future changes, create:

```text
docs/decisions/
```

Example:

```text
0001-use-pixijs.md
0002-use-fixed-timestep.md
0003-introduce-worker-simulation.md
```

An ADR should briefly state:

```text
Context
Decision
Alternatives
Consequences
```

This helps both humans and AI understand why unusual choices exist.

---

# 135. Things We Explicitly Do Not Need Yet

Do not build these during the initial prototype:

```text
multiplayer
server-authoritative simulation
anti-cheat
guilds
chat
trading
complex crafting
marketplace
procedural item generation
10 currencies
1000 achievements
ECS migration
Web Worker simulation
native mobile apps
Steam integration
season passes
```

These can be considered later.

---

# 136. Primary Technical Goal

The technical architecture is successful when this is possible:

```ts
const game = createGame(config)

for (let i = 0; i < 3600; i++) {
  game.update(1 / 60)
}

console.log(game.state)
```

without requiring:

```text
React
PixiJS
Supabase
IndexedDB
DOM
network
```

Everything else should integrate around that core.

---

# 137. Primary Game Design Goal

The game is successful when the player enjoys making decisions while watching their build execute automatically.

The experience should repeatedly create questions such as:

```text
Do I take immediate damage or invest in XP gain?

Do I upgrade Fireball or unlock Lightning?

Do I specialize further or diversify?

Can my build handle the boss?

Should I increase monster density next run?

What happens if summons apply poison?

Can I make this ridiculous combination work?
```

Those decisions are the game.

---

# 138. The Most Important Rule

When choosing between:

```text
more features
```

and:

```text
making the existing 10-minute run more interesting
```

choose the second option until the core loop is demonstrably fun.

---

# 139. Immediate Next Task

Milestones 0–12 are complete. The next planned feature is **Milestone 13 — Boss**:

```text
encounter timeline
first boss
boss health bar
boss abilities
boss victory
```

Keep the current deterministic gameplay loop and responsive build-information UI intact
while introducing the encounter.

The completed foundation already provides an autonomous player and enemies driven by
simulation state that is independent from the renderer. Build the boss encounter on
that boundary rather than coupling encounter behavior to the UI or Pixi renderer.
