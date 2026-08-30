

The most important thing is to **fix multiplicative runaway scaling before adding more content**. Otherwise every new skill or modifier will either be irrelevant or become another abuse case.

# Design rules I would adopt

1. **Every powerful scaling stat should have a cost or a ceiling.**
2. **No damage-over-time effect should stack infinitely.**
3. **Avoid making one stat improve direct damage, damage-over-time, summons, and trigger frequency simultaneously.**
4. **Give every skill at least two viable upgrade paths.**
5. **Use caps for resistance, CDR, projectile count, poison, and summons.**
6. **Prefer mechanics that change positioning or timing over more percentage damage.**
7. **Make enemy composition matter, not just enemy HP.**
8. **Let weak builds have defensive or utility advantages rather than forcing every build to maximize DPS.**
9. **Do not add new universal global-damage modifiers until the current scaling is under control.**
10. **Measure builds by multiple outcomes: boss DPS, pack clear, survivability, mobility, and consistency.**

If I were implementing this in order, I would do:

1. Cap/rework poison, chains, and summons.
2. Rework Vitality, Whirlwind, and Chain Lightning identities.
3. Add one new status family, preferably Bleed or Frost.
4. Add spear/charge gameplay.
5. Replace some raw set bonuses with conditional effects.
6. Add floor mutations and reward-risk choices.
7. Only then add more generic gear content.

## Top 5 changes

### 1. Put explicit limits on runaway stacking

This should be the first priority.

#### Staff poison

Change poison from unlimited stacking to something like:

- Maximum 3 stacks per target.
- Reapplying poison refreshes the oldest stack rather than adding forever.
- Poison damage based on post-mitigation physical/chaos damage, or at least reduced snapshot damage.
- Attack speed should improve poison uptime, not multiply poison indefinitely.

For example:

```text
Maximum poison stacks: 3
Duration: 4 seconds
Damage: 35% of applying hit per second
```

This still makes staff attractive without letting attack speed, flat damage, crit, and DoT multiplier all multiply the same effect uncontrollably.

The relevant code is in `CombatSystem.ts`.

#### Projectile chains

Give each projectile a visited-target set. If chains are intended to revisit targets, apply damage falloff:

```text
Hit 1: 100%
Hit 2: 100%
Hit 3: 75%
Hit 4: 50%
Hit 5: 25%
```

At present, extra projectiles and chains multiply each other, and chains can repeatedly hit the same targets in `CombatSystem.ts`.

#### Skeletons and Fiery Touch

Either:

- Prevent summon attacks from triggering Fiery Touch.
- Give summon-triggered Fiery Touch a separate cooldown.
- Or let each summon trigger it only once every few seconds.

Also add a hard summon cap, perhaps 6 or 8 skeletons, with later upgrades improving skeleton quality rather than count.

---

### 2. Give every skill a distinct scaling identity

Currently, many skills mostly want the same things: flat damage, global damage, critical chance, attack speed, and cooldown reduction.

That creates a few universal best-stat builds instead of interesting choices.

I would define a primary scaling axis for every skill:

| Skill           | Primary identity                              |
| --------------- | --------------------------------------------- |
| Sword           | Area, melee, armor break, leech               |
| Bow             | Precision, pierce, projectile speed, crit     |
| Wand            | Chain count, homing, shock, range             |
| Staff           | Poison, DoT, zone control                     |
| Whirlwind       | Continuous melee area damage                  |
| Chain Lightning | Jumps, shock, overload                        |
| Vitality        | Max-HP-based sustain                          |
| Skeletons       | Minion count, minion quality, command effects |
| Fiery Touch     | Trigger frequency and area explosions         |

Then restrict or reduce generic scaling where appropriate.

For example:

- Projectile damage should not also be the best way to scale Chain Lightning.
- Flat physical damage should not be the best way to scale skeletons and poison simultaneously.
- Attack speed should have reduced effectiveness for DoT application.
- Cooldown reduction should have diminishing returns or separate caps for triggered skills.

This work primarily belongs in `Damage.ts`, `DerivedStats.ts`, and `ModifierPools.ts`.

---

### 3. Rework weak skills instead of simply increasing their damage

Vitality, Whirlwind, and single-target Chain Lightning are weak because they provide too little value per skill slot.

#### Vitality

Make it scale with max HP:

```text
Heal for 3% max HP every 5 seconds
+1% max HP healing per Vitality level
```

Or:

```text
Heal 2% max HP plus 2 flat HP
```

This allows a high-resistance Giant's build to become a genuine defensive archetype.

Vitality could also grant a passive effect while equipped:

- Reduced contact damage.
- Increased potion effectiveness.
- Temporary damage reduction after healing.
- A reserve shield that absorbs the next hit.

The current values are defined in `skills.ts` and `skill-upgrades.ts`.

#### Whirlwind

Give it a clear melee identity:

- Every hit applies a short armor-break debuff.
- Damage increases while surrounded.
- Every third hit creates a larger outer ring.
- Leech increases against enemies affected by the debuff.

Example:

```text
Whirlwind hits reduce enemy physical resistance by 8% for 3 seconds.
Maximum 3 stacks.
```

This makes Whirlwind useful against elites and bosses without simply making its raw damage enormous.

#### Chain Lightning

Give it meaningful single-target fallback behavior:

```text
If fewer than 3 targets are available, remaining jumps return to the primary target at 60% damage.
```

Or use a shock/overload mechanic:

```text
Each jump applies Shock.
At 3 Shock stacks, consume them for a large lightning burst.
```

This creates a powerful Chain Lightning build without making it dependent entirely on enemy density.

---

### 4. Add build-defining modifiers with tradeoffs

Avoid adding more generic `+damage`, `+attack speed`, or `+cooldown reduction`. Add modifiers that change how a build plays.

Good examples:

#### Precision

```text
+20% damage against enemies farther than 120 units
-10% damage against nearby enemies
```

Creates a bow/ranged build that rewards positioning.

#### Heavy impact

```text
+35% physical damage
-20% attack speed
Hits stagger small enemies
```

Creates a slow, powerful melee build.

#### Volatile projectiles

```text
Projectiles explode for 40% damage on impact
-1 maximum projectile
```

This trades projectile count for area damage.

#### Piercing

```text
Projectiles pierce one additional target
-15% projectile damage
```

This gives bows a different identity from chain-based wands.

#### Executioner

```text
+30% damage to enemies below 35% health
```

Strong against elites without inflating all damage.

#### Rejuvenating

```text
Healing restores 1% max HP per second for 3 seconds
-15% damage
```

Creates a sustain build without making healing universally optimal.

#### Minion commander

```text
Skeletons gain +20% attack speed
Player loses 10% attack speed
```

This makes the player choose between personal damage and summon power.

#### Blood price

```text
Skills deal +40% damage
Lose 1% max HP whenever a skill activates
```

A high-risk build with a natural counterbalance.

These should be mutually exclusive or limited to specific slots where possible. Otherwise they become another set of universal bonuses.

---

### 5. Make challenge come from decisions, not just enemy HP inflation

The current dungeon scaling reaches very large ordinary-enemy HP multipliers at high floors. At floor 30 the ordinary-enemy HP multiplier is already about **6.7x**, and at floor 200 it is approximately **37.3x**.

That risks turning the endgame into a damage check where only the best scaling build survives.

Instead, add controlled difficulty choices:

#### Floor mutations

At the start of a floor, choose one of three modifiers:

```text
Enemies gain 25% max HP, rewards gain +40%
Enemies move 20% faster, gear rarity improves
Enemies gain elemental resistance, elite chance increases
```

This gives players agency and makes different builds valuable.

#### Build-specific counters

Examples:

- Physical-resistant enemies make Chain Lightning and elemental builds valuable.
- Chaos-resistant enemies reduce poison dominance.
- Swarms reward Whirlwind and chain builds.
- Ranged enemies challenge melee builds.
- Shielded enemies require burst or armor break.

Do not make resistances so extreme that a build becomes unusable. Aim for partial pressure rather than hard invalidation.

#### Better reward risk

Offer choices like:

```text
Take +20% enemy damage for this floor to gain an additional gear choice.
```

This lets strong players accelerate their build while weaker builds can choose safety.

---

# New build archetypes worth adding

## 1. Bleed / Wound Knight

This would give sword builds an alternative to pure area/leech stacking.

Mechanics:

- Physical hits apply Wound.
- Wound deals damage based on the original physical hit.
- Maximum 3 stacks.
- Whirlwind refreshes Wound duration.
- Wounded enemies take increased melee damage.

Important: do not copy poison's unlimited snapshot behavior. Use a cap and refresh mechanic.

Possible modifiers:

- `Wound duration`
- `Maximum wounds`
- `Wound damage`
- `Damage against wounded enemies`
- `Wounds spread on kill`

---

## 2. Frost control build

This creates a defensive ranged archetype.

Mechanics:

- Cold damage applies Chill.
- Chilled enemies move and attack more slowly.
- Repeated Chill applies Freeze briefly.
- Frozen enemies shatter for area damage when hit by physical damage.

This gives Chain Lightning, wand, and possibly a future cold weapon a reason to exist without competing directly with poison DPS.

Possible gear modifiers:

- `Chill effectiveness`
- `Freeze duration`
- `Shatter radius`
- `Damage against chilled enemies`
- `Cold projectiles pierce`

---

## 3. Shock / Overload Chain Lightning

Rather than making Chain Lightning simply hit harder:

- Each jump applies Shock.
- Shock increases lightning damage taken slightly.
- Three Shock stacks trigger Overload.
- Overload deals area damage and resets Shock.

This naturally rewards enemies being close together but still provides a single-target rotation.

---

## 4. Minion commander Necromancer

Separate “many weak skeletons” from “few powerful skeletons.”

Possible upgrades:

### Horde path

- More skeletons.
- Lower individual damage.
- Skeletons gain attack speed near other skeletons.
- Skeleton deaths create temporary bone explosions.

### Elite minion path

- Maximum skeleton count reduced.
- Skeletons gain large damage and health bonuses.
- Skeletons taunt enemies.
- One skeleton becomes a champion with a special attack.

This is much more interesting than allowing unlimited `+1 maximum skeleton` upgrades.

---

## 5. Spear / charge melee build

This aligns well with the existing idea in `TODO.md`.

A spear should not just be another sword. Give it:

- Long narrow attack range.
- Charge through enemies.
- Bonus damage based on distance traveled.
- Momentum stacks.
- Reduced effectiveness when surrounded.

Example:

```text
Charge through an enemy:
- Deals 150% physical damage
- Gains one Momentum stack
- At 3 stacks, the next attack pierces all targets
```

This creates a mobile melee build rather than another stationary AoE build.

---

# Gear-set recommendations

The current sets should have different strategic profiles.

## Scholar's

Current identity: experience acceleration.

Keep the bonuses simple and useful for players who want to reach level-up
choices faster:

```text
2 pieces: +5% XP gained
4 pieces: +10% XP gained
6 pieces: +15% XP gained
```

The thresholds are cumulative, so a complete set grants +30% XP.

## Giant's

Current identity: broad damage mitigation.

Give the set a clear defensive profile without adding another max-HP-only
build:

```text
2 pieces: +15% physical, elemental, and chaos resistance
4 pieces: +15% physical, elemental, and chaos resistance
6 pieces: +15% physical, elemental, and chaos resistance
```

The resistance cap still applies, and a complete set grants +45% to each
primary resistance pool.

## Astral

Current identity: cooldown reduction.

Cooldown reduction is too universally useful. Consider:

```text
2 pieces: +10% cooldown reduction
4 pieces: skills gain a small effect after casting
6 pieces: every third skill cast is empowered
```

For example, every third Whirlwind is larger, every third Chain Lightning gains an extra jump, or every third Vitality heal grants a shield.

This is more interesting than reaching extremely low cooldowns.

## Splintering

Current identity: projectiles.

Fix the wasted six-piece threshold by making the final bonus something other than another projectile:

```text
2 pieces: +1 projectile
4 pieces: +2 projectiles
6 pieces: projectiles pierce once and deal 15% more damage to previously unhit targets
```

That avoids exceeding the bow/wand projectile cap while still rewarding completion.
