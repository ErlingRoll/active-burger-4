# Active Burger 4 Graphics Guidelines

This is the canonical visual-design guide for Active Burger 4. Read it before
adding or changing a skill, evolution, synergy, enemy, projectile, persistent
skill object, or HUD presentation.

The renderer is a projection of the deterministic game state. Visual polish
must not change combat rules, damage, targeting, timing, persistence, or
simulation determinism.

## Visual goals

Every visual should communicate three things at a glance:

1. **What created it** - the skill, weapon, enemy, or system should be
   identifiable without reading a tooltip.
2. **What it is doing** - travel, impact, area control, healing, shielding,
   charging, or expiration should be readable through shape and motion.
3. **What it means mechanically** - damage elements, status effects, stored
   charges, and dangerous telegraphs should use consistent visual language.

The game favors a refined action-roguelike look:

- Strong silhouettes before fine detail.
- Layered glow, crisp outlines, and a small number of intentional accents.
- Angular facets, glyphs, shards, ribbons, and shaped bursts instead of
  untextured primitives.
- High contrast against the dark blue arena.
- Distinct silhouettes for distinct skills. Reusing a color is acceptable;
  reusing the same shape language is not.

## Non-negotiable rules

- Do not use a plain filled circle as the final visual for a new skill.
- Do not use a straight line with evenly spaced circular dots for a new skill.
  That language belongs to Soul Tether's link visual and must remain unique.
- Do not make every explosion a circle. Choose a shape that reflects the skill:
  flames, shards, blades, shields, sigils, crystals, or singularity geometry.
- Do not add screenshake, camera jolts, hit-stop, or time-dilation effects.
  Major events may use restrained glow, expansion, particles, and hit flashes.
- Do not put visual-only state into `GameState` unless it is needed for a
  deterministic gameplay rule or checkpoint restoration.
- Do not use random rendering. Derive variation from stable IDs, effect
  progress, and simulation time so replays remain reproducible.
- Do not hide enemy telegraphs or important status information behind effects.
- Do not introduce third-party image assets without recording their provenance
  in the project documentation.

## Renderer architecture

The primary renderer is
[PixiGame.ts](../src/rendering/PixiGame.ts). It owns Pixi objects and projects
simulation state into layers.

Skill content and rendering metadata are defined in
[skills.ts](../src/game-config/skills.ts) and typed by
[SkillConfigs.ts](../src/content/skills/SkillConfigs.ts).

The standard flow is:

1. The simulation creates a projectile, effect, summon, trap, relay, wire, or
   other state object.
2. `PixiGame` creates or reuses a corresponding Pixi view.
3. The view is positioned from state and animated from lifetime, remaining
   lifetime, and simulation time.
4. The view is removed when the state object is removed.

One-shot effects should use `lifetime` and `remainingLifetime` to communicate
an animation arc:

- **Birth:** scale or opacity starts low.
- **Peak:** the silhouette reaches full size and detail.
- **Decay:** glow, particles, and opacity taper off.

Persistent objects should be redrawn from current state and `state.time`, not
recreated every frame. Existing examples include Storm Relay, Cinder Mine,
Razorwire, Ruin Sigil, Blood Rite, and Prism Halo.

## World layer order

`createWorld` enables sortable world layers. Preserve this conceptual order
when adding new layers or moving objects:

1. Ground
2. Arena decorations
3. Pickups
4. Stairs and exits
5. Persistent skill objects
6. Enemy telegraphs
7. Enemies
8. Bosses
9. Summons
10. Player
11. Projectiles and projectile trails
12. Temporary effects and impact particles
13. World UI such as labels and health bars

Temporary effects may be above projectiles, but must not obscure telegraphs,
health bars, or important labels. If a new visual needs a different depth,
use an explicit layer or `zIndex`; do not rely on insertion order.

## Shape and animation vocabulary

Use the following visual grammar:

| Mechanical idea | Preferred visual language |
| --- | --- |
| Fire | Flame tongues, ember shards, orange/gold layered bursts |
| Cold | Faceted crystals, snowflake axes, pale blue shards |
| Lightning | Angular zig-zag arcs, forks, diamond terminals |
| Chaos | Nested polygons, inward arrows, violet distortion |
| Physical melee | Blade sweeps, spear corridors, impact wedges |
| Poison | Green channels, vapor accents, contaminated glyphs |
| Healing | Leaf/heart forms, life glyphs, soft green expansion |
| Shielding | Shield silhouettes, hexagonal barriers, cyan rims |
| Summoning | Ritual polygons, skull/bone marks, spectral gates |
| Stored charges | Pips, runes, segments, or visibly filled glyph marks |
| Persistent link | A deliberate line or ribbon only when the skill is link-based |
| Area control | Shaped perimeter plus interior structure; never only a circle |

Circles remain useful for true radial ranges, soft glow envelopes, halos, and
health/status indicators. They should be a supporting layer, not the entire
skill identity.

Short-lived effects should normally include at least two of:

- An outer glow or envelope.
- A distinct silhouette.
- An interior glyph, facet, or directional detail.
- A secondary color pass.
- Renderer-only particles.
- A birth/peak/decay animation.

## Current basic attack identities

Basic attacks are selected by weapon archetype and must remain visually
distinct:

- **Sword:** a broad swept blade arc with an emphasized cutting edge.
- **Bow:** a physical arrow with shaft, arrowhead, fletching, and a tapered
  motion streak.
- **Wand:** a faceted cyan/purple seeking bolt with an inner energy core.
- **Staff:** a purple impact seal with green poison channels and a central
  star.

Basic attack effects and projectiles are routed separately in
[PixiGame.ts](../src/rendering/PixiGame.ts), so a new weapon should not be
implemented by changing the generic orb/arrow fallback alone.

## Current skill visual inventory

This inventory is the baseline to match when adding new content.

### Original skills

- **Whirlwind:** four curved blade-like wind sweeps around the player.
- **Chain Lightning:** angular electric path with sharp terminals.
- **Vitality:** green leaf/heart healing glyph with a life cross.
- **Raise Skeleton:** skull ritual effect and bone-themed attack trail.
- **Fiery Touch:** layered flame starburst with flame tongues.
- **Glacial Orb:** crystal bloom and radial ice axes on impact.
- **Lancer's Charge:** spear-shaped charge corridor with reinforcement marks.
- **Rallying Banner:** flag, pole, radius field, and banner-specific healing
  presentation.
- **Gravity Well:** nested polygonal singularity with inward force markers.
- **Aegis Pulse:** shield-shaped defensive burst with a central emblem.

### First expanded skill set

- **Rift Javelin:** long physical javelin profile with dimensional travel
  trails.
- **Cinder Mine:** octagonal mechanical mine, ember vents, arming rune, fuse
  state, and jagged fire detonation.
- **Storm Relay:** deployed electrical totem plus angular relay strikes.
- **Soul Tether:** intentional tether line/ribbon with endpoint anchors and
  healing flow. This is the canonical linked-line identity.
- **Phantom Arsenal:** spectral archer silhouette and summoning gate.

### Second expanded skill set

- **Sigil of Ruin:** occult triangular seal, rotating spokes, and charge marks.
- **Mirrorcast:** offset afterimage, mirror facets, diamond casting aperture,
  and shard-lined copied-skill links.
- **Razorwire:** anchor posts, taut wire, barbs, tension, and lattice behavior.
- **Blood Rite:** blood ritual ring, charge marks, and jagged chaos pulse.
- **Prism Halo:** orbiting elemental shards and a faceted beam:
  - Fire uses orange.
  - Cold uses cyan.
  - Lightning uses pale gold.
  - Resonant all-element volleys use parallel multi-color facets.

## Current non-skill visual inventory

- **Player:** a simple high-contrast body derived from the selected playstyle,
  with health and shield bars kept separate from the body.
- **Enemies:** content-owned silhouettes such as circles, diamonds, triangles,
  and hexagons. Elite modifiers add a distinct aura style rather than replacing
  the enemy silhouette.
- **Bosses:** larger readable bodies, a strong marker/crown, health bar, and
  status indicators. Boss readability takes priority over decorative effects.
- **Enemy telegraphs:** red/orange warning language with a clear perimeter or
  line, a light inner edge, and a `DODGE` label. Telegraphs must remain visible
  above ordinary world decoration.
- **Summons:** persistent summons use a recognizable body silhouette and a
  health bar. Phantom Arsenal uses a spectral archer silhouette rather than
  the ordinary skeleton body.
- **Pickups:** gear uses a gold diamond with a purple core, healing potions use
  a red bottle, and experience uses a green pickup shape.
- **Stairs:** circular portal/exit geometry with a distinct final-floor color
  and a label that remains readable near the player.
- **Arena:** dark blue ground, restrained grid lines, cyan boundary treatment,
  and sparse decoration. The arena should provide contrast without competing
  with combat effects.
- **World UI:** labels, health bars, shield bars, and status icons are
  intentionally high-contrast and should not be covered by particles.

## Projectiles and trails

Projectile silhouettes must communicate their weapon or skill:

- Arrows and javelins use shafts, heads, and fletching or barbs.
- Magical bolts use facets, cores, and controlled energy trails.
- Cold projectiles use crystal geometry.
- Spectral projectiles use ghostly afterimages or pale-blue edges.

Projectile trails are renderer-only and may use a short position history. Keep
them tapered, brief, and subordinate to the projectile silhouette. Do not leave
long persistent trails that reduce arena readability.

## Impact particles

Impact particles are decorative and must never become gameplay entities.
Use a small number of shaped shards rather than a cloud of identical circles.

Recommended defaults:

- 6-10 particles for a normal impact.
- 10-16 particles for a major detonation or resonance event.
- A mixture of primary and secondary colors.
- A short expansion followed by opacity decay.
- Stable variation from the effect ID and index.

Particle colors should match the effect's damage or mechanical identity.

## Enemy and boss feedback

Damage feedback should be readable without being disturbing:

- Brief white hit flash.
- Small body scale pulse.
- Element-colored status overlays where useful.
- Stronger but still short-lived visual emphasis for critical or resonant
  impacts.

Avoid camera motion, time manipulation, gore escalation, or effects that make
the player lose track of the arena.

## Persistent object standards

Persistent objects need an idle state and a mechanical state:

- **Cinder Mine:** arming casing and fuse/rune state; armed mine has hotter
  vents and a stronger inner seal.
- **Storm Relay:** totem body, rotating electrical perimeter, and visible
  charge/strike language.
- **Rallying Banner:** flag, pole, field radius, and defensive identity.
- **Soul Tether:** endpoint anchors and a readable line between owner and target.
- **Razorwire:** anchors, barbs, tension, and optional lattice/guillotine state.
- **Ruin Sigil:** rotating seal and charge indicators that change as it arms.
- **Blood Rite:** ritual ring and charge marks around the player.
- **Prism Halo:** orbiting shards with distinct element colors and resonance
  amplification.

When adding a persistent object, define how a player can tell it is:

1. Being placed or armed.
2. Active and ready.
3. Charged or empowered.
4. Expiring or disabled.

## HUD and icon standards

Skill cards should use vector-style icons from
[SkillIcon.tsx](../src/rendering/SkillIcon.tsx), not emoji or arbitrary text
glyphs. The same icon language should appear in:

- The in-run skill HUD.
- Skill hover tooltips.
- Level-up and evolution cards.
- Starting-skill selection.

When adding a skill:

1. Add a unique `skillId` case to `SkillIcon`.
2. Use a silhouette that remains recognizable at small size.
3. Prefer `currentColor` strokes so cards can apply rarity and state colors.
4. Keep the icon understandable in monochrome.
5. Keep the content `visual.icon` value for snapshots and data compatibility
   unless a deliberate data migration is required.

## Accessibility and motion

- Preserve strong contrast between outlines, fills, and the dark arena.
- Do not communicate a mechanic using motion alone; shape, color, or a glyph
  must also communicate it.
- Keep important telegraphs visible for the full warning duration.
- Respect reduced-motion preferences for UI animation. If renderer motion is
  made user-configurable, reduce rotation, particle count, and expansion
  amplitude rather than removing mechanical readability.
- Avoid rapid flashing and never add screenshake or time dilation.

## New-skill implementation checklist

Before considering a new skill complete:

- [ ] The skill has a unique silhouette, not just a recolored generic circle.
- [ ] The cast, travel, impact, and persistent states are considered.
- [ ] Damage type/status identity is visible through shape and palette.
- [ ] Projectile visuals have a skill-appropriate body and trail.
- [ ] Area effects have interior detail and a shaped perimeter.
- [ ] Major impacts use restrained renderer-only particles.
- [ ] Persistent objects have visible armed/active/charged states.
- [ ] Enemy hit feedback remains readable when effects overlap.
- [ ] The skill has a vector icon in `SkillIcon.tsx`.
- [ ] Layer placement is intentional and telegraphs remain visible.
- [ ] Visual variation is deterministic.
- [ ] Simulation and checkpoint data were not expanded for cosmetic state.
- [ ] Build, diagnostics, lint, focused tests, and the full existing test suite
      were run.

## Recommended implementation pattern

1. Add or update content metadata in `src/game-config/skills.ts`.
2. Add a dedicated renderer path in `PixiGame.ts` when the generic path cannot
   express the skill identity.
3. Use helper geometry such as polygons, stars, facets, glyphs, and shaped
   ribbons rather than adding another generic circle branch.
4. Use `state.time` for persistent idle animation and effect progress for
   one-shot animation.
5. Add a vector case in `SkillIcon.tsx`.
6. Verify that gameplay tests remain unchanged and that no simulation-only
   behavior depends on rendering.
