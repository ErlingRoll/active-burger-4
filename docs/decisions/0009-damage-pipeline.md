# Damage pipeline and damage-over-time scaling

## Decision

All outgoing damage uses the same ordered pipeline:

1. Build the source's native damage.
2. Add flat damage only to Basic Attack damage.
3. Apply the source's increased-damage modifiers.
4. Add typed Attunement damage calculated from the finalized, pre-critical Basic
   Attack profile. Native skill increases are not reapplied to Attunement.
5. For periodic player-owned damage, apply the player's DoT multiplier exactly
   once when the periodic damage event resolves.
6. Resolve critical strikes when the event supports them.
7. Apply target resistance and record actual post-mitigation damage.

DoT scaling is resolved at event time rather than when a Poison or Burning stack
is created. This keeps Soul Tether, Poison, Burning, and derived DoT bursts
consistent and prevents an effect from being multiplied both when applied and
when it ticks. Player-owned summons retain their source entity ID so their
periodic damage is included; enemy damage is never increased by the player's
DoT multiplier.

## Damage types and periodic effects

Periodic effects keep their authored damage type:

- Soul Tether deals Chaos damage only.
- Poison deals Chaos damage based on the applying hit's physical and Chaos
  damage.
- Burning deals Fire damage.

Damage-over-time events do not trigger hit-only effects such as melee leech,
on-hit Chill, direct-hit triggers, or shield reprisal. They can still contribute
actual damage to effects that explicitly consume or track DoT damage, such as
Ruin Sigil and Soul Tether healing.

## Estimation

Skill estimates use the same periodic payloads and DoT multiplier as runtime
resolution. Estimates include the sustained duration of Soul Tether and the
Burning/Poison portions of skills that apply those effects, while excluding
non-applicable damage types and critical strikes from DoT-only damage.
