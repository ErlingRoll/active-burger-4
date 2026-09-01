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
- Enemy and boss attacks must never rely on player elemental colors alone.
  Hostile telegraphs use the dedicated deep-crimson danger palette, dark hazard
  rims, pale warning edges, and a visible `DANGER`/`DODGE` label.
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

## Evolution visual coverage matrix

Every evolution branch must visibly transform its parent skill. The shared
evolution accent decorator provides a branch-colored glyph; dedicated skill
renderers should add a stronger shape or motion change when the branch changes
the skill's behavior.

| Skill | Evolution branches | Visual distinction |
| --- | --- | --- |
| Basic Attack | Barrage, Precision | Repeating cadence mark vs. target-focused gold mark |
| Whirlwind | Rime Cyclone, Whirlwind Guard | Cold facets vs. cyan shield edge |
| Chain Lightning | Freezing Conduit, Overload | Frost terminals vs. heavy charged arcs |
| Vitality | Renewal, Last Stand | Life ring vs. defensive hex mark |
| Raise Skeleton | Grave Legion, Rotting Bones | Legion aura vs. poison/rotting glyph |
| Fiery Touch | Rapid Ignition, Emberstorm | Faster ember streak vs. larger ember crown |
| Glacial Orb | Permafrost, Ice Lance | Crystal bloom vs. focused lance geometry |
| Lancer's Charge | Vanguard, Impaler | Momentum bands vs. wider spear corridor |
| Rallying Banner | Commander, Bulwark | Command chevrons vs. shield perimeter |
| Gravity Well | Singularity, Event Horizon | Nested pull rings vs. compressed dark core |
| Aegis Pulse | Bulwark, Reprisal | Large shield frame vs. retaliatory edge |
| Rift Javelin | Barbed Javelin, Homeward Edge | Barbs/poison accents vs. bright return trail |
| Cinder Mine | Inferno Charge, Cluster Charges | Hotter flame crown vs. linked mine geometry |
| Storm Relay | Overcharge, Conduit | Electrical crown vs. permanent circuit ring |
| Soul Tether | Siphon, Requiem Chain | Green healing flow vs. snap-chain accents |
| Phantom Arsenal | Volley, Marksman | Multiple ghost markers vs. focused spectral sight |
| Sigil of Ruin | Contagious Script, Execution Protocol | Spreading glyph marks vs. armed execution ring |
| Mirrorcast | Double Exposure, Deferred Echo | Multiple mirror facets vs. delayed afterimage |
| Razorwire | Tripwire Network, Guillotine Line | Crossed short wires vs. long tension blade |
| Blood Rite | Sanguine Pact, Crimson Debt | Healing inner ring vs. separated charge marks |
| Prism Halo | Chromatic Convergence, Refraction | Full-spectrum frame vs. split crystal facets |

## Synergy visual coverage matrix

Basic Attack is a universal Synergy partner. It is listed here for completeness
but should not be repeated in unlock-card text. The second column lists every
current Synergy partner; the third column identifies the visual cue that should
remain visible when the interaction is selected.

| Skill | Synergy partners | Required visual cue |
| --- | --- | --- |
| Basic Attack | Whirlwind, Chain Lightning, Glacial Orb, Vitality, Raise Skeleton, Fiery Touch, Lancer's Charge, Rallying Banner, Gravity Well, Aegis Pulse, Rift Javelin, Cinder Mine, Storm Relay, Soul Tether, Phantom Arsenal, Sigil of Ruin, Mirrorcast, Razorwire, Blood Rite, Prism Halo | Weapon-specific silhouette plus selected elemental/Whirlwind accent |
| Whirlwind | Basic Attack, Lancer's Charge, Aegis Pulse, Mirrorcast | Momentum chevrons, shield frame, and mirror accents |
| Chain Lightning | Basic Attack, Glacial Orb, Gravity Well, Sigil of Ruin | Frost terminals, circuit accents, and Sigil conductivity |
| Vitality | Basic Attack, Rallying Banner, Aegis Pulse, Soul Tether, Rift Javelin | Life glyph, banner frame, tether flow, and return-heal accent |
| Raise Skeleton | Basic Attack, Rallying Banner, Gravity Well, Phantom Arsenal, Cinder Mine | Bone ritual, banner marks, skeleton aura, and Ember Guard |
| Fiery Touch | Basic Attack, Glacial Orb, Gravity Well, Cinder Mine, Soul Tether | Cold core, chaos ring, Wildfire ring, and tether flare |
| Glacial Orb | Basic Attack, Chain Lightning, Fiery Touch, Razorwire | Faceted frost bloom, electric frost marks, and crystalized wire |
| Lancer's Charge | Basic Attack, Whirlwind, Aegis Pulse, Rift Javelin, Rallying Banner | Momentum bands, shield crest, spear accents, and banner refresh cue |
| Rallying Banner | Basic Attack, Vitality, Raise Skeleton, Storm Relay, Lancer's Charge | Life ring, bone marks, electric perimeter, and charge accent |
| Gravity Well | Basic Attack, Chain Lightning, Raise Skeleton, Fiery Touch, Phantom Arsenal | Circuit ring, bone anchors, flame perimeter, and Echo Well state |
| Aegis Pulse | Basic Attack, Whirlwind, Vitality, Lancer's Charge, Blood Rite | Blade perimeter, life frame, spear crest, and Crimson Bulwark |
| Rift Javelin | Basic Attack, Lancer's Charge, Cinder Mine, Phantom Arsenal, Vitality | Momentum/ghost bands and Mending Return trail |
| Cinder Mine | Basic Attack, Fiery Touch, Rift Javelin, Storm Relay, Raise Skeleton | Ignition ring, dimensional slash, conductivity, and Ember Legion state |
| Storm Relay | Basic Attack, Rallying Banner, Cinder Mine, Soul Tether, Prism Halo | Shield frame, conductivity, tether current, and spectrum-charged totem |
| Soul Tether | Basic Attack, Vitality, Storm Relay, Phantom Arsenal, Fiery Touch | Life flow, electric current, phantom endpoint, and Scorching Lifeline flare |
| Phantom Arsenal | Basic Attack, Raise Skeleton, Soul Tether, Rift Javelin, Gravity Well | Legion aura, phantom tether mark, ghost trail, and Echo Well projectile |
| Sigil of Ruin | Basic Attack, Prism Halo, Blood Rite, Chain Lightning | Prismatic frame, blood frame, and conductive charge glyph |
| Mirrorcast | Basic Attack, Razorwire, Prism Halo, Whirlwind | Mirror shards, parallel wire, prism frame, and Parallax detailing |
| Razorwire | Basic Attack, Mirrorcast, Blood Rite, Glacial Orb | Mirror strands, chaos edge, blood accents, and Frostline crystals |
| Blood Rite | Basic Attack, Sigil of Ruin, Razorwire, Prism Halo, Aegis Pulse | Sigil/blood geometry, chaos wire, prism ritual, and shield ring |
| Prism Halo | Basic Attack, Sigil of Ruin, Mirrorcast, Blood Rite, Storm Relay | Prismatic frame, mirror frame, blood frame, and Aurora Relay state |

When a Synergy changes only a cooldown, duration, or numeric resource, use an
accent on the owning object rather than inventing a separate persistent object.

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

## Enemy and boss attack visual matrix

Enemy attacks use a dedicated deep-crimson danger palette and must be distinct
by silhouette. Hostile projectile bodies should remain readable above ordinary
effects. Player Fire, Physical, and Chaos colors must not be reused as the only
hostile identifier.

| Attack | Source | Damage type | Telegraph/projectile treatment |
| --- | --- | --- | --- |
| Aimed Shot | Archer | Physical | Long directional line with an arrowhead; hostile projectile uses shaft, head, and fletching |
| Shockwave | Brute | Physical | Spiked radial shockwave with an inner polygon and radial spokes |
| Ground Slam | Stone Golem | Physical | Large spiked radial impact with concentric warning geometry |
| Charge | Stone Golem | Physical | Directional corridor with an arrowhead showing travel direction |
| Fire Nova | Inferno Warden | Fire | Flame starburst with a secondary inner burst |
| Flame Line | Inferno Warden | Fire | Jagged directional flame corridor with a pointed leading edge |
| Meteor Zones | Inferno Warden | Fire | Rotated diamond landing zone with crosshair and inner marker |

Enemy attack visuals must communicate the warning before the attack resolves.
Use deep crimson cores (`#b91c1c` for ordinary enemies and `#be123c` for
bosses), a dark hazard rim (`#450a0a`), pale warning edges, the `DANGER` and
`DODGE` label, and the telegraph layer. This language is intentionally
different from player Fire, Cold, Lightning, Physical, and Chaos effects.

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

## Status-effect visual language

Status effects must be visible on the affected enemy or boss, not only in the
status bar:

| Status | World overlay | Stack/threshold behavior |
| --- | --- | --- |
| Burning | Orange flame corona and rising ember shards | More stacks increase the corona intensity and shard count |
| Chill | Rotating pale-blue crystal rim and ice facets | More stacks add facets; Frozen uses a brighter, thicker crystal rim |
| Frozen | Bright crystalline shell/rim | Use reduced motion and a clear threshold state |
| Shock | Yellow branching electrical arcs | More stacks add branches; keep the enemy silhouette readable |
| Poison | Green octagonal rim and drifting motes | More stacks increase rim intensity and mote count |
| Chaos | Use the source skill's violet geometry | Do not add a generic status cloud if no persistent Chaos state exists |

Status overlays are renderer projections of existing status state. They must
not create gameplay entities, alter durations, or obscure health bars and
telegraphs. Status icons remain as a compact secondary explanation, including
the Burning icon added for the world overlay.

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
