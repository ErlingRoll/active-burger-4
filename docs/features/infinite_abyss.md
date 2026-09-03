# Infinite Abyss

## Purpose

The Infinite Abyss is a high-risk, endlessly escalating challenge mode. It
tests a completed build through survival, enemy-modifier choices, and resource
management rather than normal level-up upgrades.

The Abyss is deliberately single-character for the initial implementation:

- The player must own or have access to at least one available Champion.
- The player selects one Champion for the attempt.
- That Champion becomes the active player character for the run.
- The normal character and additional Champions are not present as companions.
- No real-time multiplayer simulation is required.

## Starting and entering an attempt

The Abyss starts at floor 1 and continues indefinitely. Its floor number is
independent of the normal dungeon floor number.

At entry, the player selects:

- One available Champion.
- An artifact loadout from their own account.
- Up to five fish for the run meal.
- Any future run items allowed by the mode.

The selected Champion, artifact loadout, fish effects, content version, and
seed are snapshotted into the attempt. The Champion is exhausted when the
attempt is committed, not when the player later leaves the results screen.

## Base difficulty

Abyss enemies use a separate difficulty profile. At floor 1, enemies begin with
10x their normal base HP and 10x their normal base damage. This multiplier is
data-driven and must be playtested against completed Champions; if it makes the
mode inaccessible, HP and damage may be tuned independently.

The Abyss does not grant normal enemy XP or normal equipment choices. It may
reuse combat, movement, floor, and boss systems from dungeon runs, but all
reward-producing behavior must be explicitly mode-scoped.

## Floor decisions

At the end of each completed floor, the player chooses one persistent enemy
modifier from a deterministic set of choices. The selected modifier remains
active for the rest of the attempt.

Example modifiers include:

- Increased enemy movement speed.
- Increased enemy HP.
- Increased elite spawn chance.
- Increased enemy critical-hit chance.
- Additional enemy attack or spawn behavior.

Each modifier has a content-defined Danger Score. Danger Score improves future
reward quality, so the player chooses between safer progress and better loot.
The UI must show the immediate effect, current accumulated danger, and any
combination restrictions before the choice is confirmed.

Modifiers use explicit guardrails:

- No duplicate modifier unless the content definition explicitly permits it.
- Additive stacking is preferred over unbounded multiplicative stacking.
- Each stat has a sensible cap or diminishing return.
- Impossible or redundant combinations are excluded from the choice pool.
- Enemy critical chance and critical damage are independently capped.

The Abyss has no character upgrades between floors in the initial design. The
player's adaptation comes from modifier choices, the original Champion build,
the five-fish meal, and artifacts.

## Floor rewards

The player receives one loot box for every completed Abyss floor. A box is
granted when the floor is completed, not when it is entered. Rewards for
completed floors are retained if the attempt ends later.

Box rarity has a floor-based probability curve that increases until floor 100
and remains capped after floor 100. Higher Danger Score may improve the curve
within its configured limits, but it must not bypass the floor-100 cap.

Normal dungeon loot boxes may drop only up to Rare rarity. Abyss boxes may use
Epic and Legendary tables once those tables are implemented.

Loot tables are rarity-specific and weighted. They should avoid excessive
nested randomness and should include duplicate handling and useful salvage
outcomes.

## Scoring

Scoring rewards actual progress and discourages stalling:

```text
score =
  completed-floor points
  + kill points
  + elite and boss points
  + bounded Danger Score bonus
```

Survival time may be displayed and used as a tie-breaker, but raw survival time
must not be the primary source of score. A floor cannot generate unlimited
reward by delaying its completion.

Adventure scores may use the player's full loadout. If competitive leaderboards
are added, a separate ranked ruleset should normalize or restrict fish and
artifacts.

## Exhaustion

An Abyss attempt exhausts the selected Champion for 24 hours. Exhaustion:

- continues while the player is offline;
- applies to the selected Champion only;
- remains after victory, defeat, forfeit, disconnect, or abandonment;
- prevents starting another Abyss attempt with that Champion;
- can be reduced by consuming eligible revival fish.

The exact exhaustion-reduction values are defined in `fishing.md` and must be
applied server-side once the inventory service exists.

## Failure, recovery, and persistence

The Abyss uses the durable run lifecycle. Checkpoints must include floor,
selected persistent modifiers, Danger Score, score counters, loot-box grants,
Champion snapshot, exhaustion state, artifact snapshot, fish effects, RNG
positions, and content version.

If the client disconnects, Continue restores the latest completed checkpoint.
The same floor reward must never be granted twice. An incomplete Abyss attempt
continues to reserve the selected Champion and any committed inventory state.

## Future scope

The following are intentionally outside the first Abyss release:

- Multiple Champions in one run.
- Real-time co-op or player-controlled party members.
- Abyss-specific character leveling.
- An open-ended player marketplace.
- Competitive server-authoritative score validation.
