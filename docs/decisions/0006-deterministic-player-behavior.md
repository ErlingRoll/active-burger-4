# ADR 0006: Deterministic player behavior controller

## Status

Accepted

## Context

Active Burger 4 uses autonomous player movement as part of its gameplay build. Dodge,
gear collection, kiting, and combat positioning must cooperate without allowing
render-frame timing, React state, or PixiJS to determine a run's outcome.

## Decision

Player movement is owned by a simulation-side Behavior Controller. It evaluates one
data-defined candidate at a time using stable entity-ID tie-breaking:

1. Dodge imminent hostile telegraphs.
2. Pursue safe gear.
3. Kite local threats.
4. Move into combat range.
5. Hold position.

Dodge is a strict emergency preemption. All other candidates use profile-defined
priorities, safety thresholds, commitment durations, and hysteresis values to prevent
oscillation.

The first run profiles are Balanced, Aggressive, and Cautious. New runs start in Free
movement by default, allowing direct WASD control; players may switch among the
autonomous profiles through the in-run Behavior screen. Free movement disables
automatic behavior, including Dodge. Profile selections are explicit simulation
actions; deterministic automatic decisions consume no random state. React and PixiJS
only project the active profile and selected intent.

### How a candidate is judged

Every non-emergency movement is scored against the same picture of the fight, built once
per tick: each enemy's threat score, its *effective* speed (the post-spawn ramp, elite
Berserking and Chill included, so a minute-old Slime is read as the sprinter it has
become), the reach it is kept away from, and the point a charging boss will land on.

- **Dodge** still triggers on the telegraph's own escape vector, but the evaluator tries
  every heading, predicts where each ends when the telegraph lands using the controller's
  acceleration model, and takes the one that clears the most telegraphs and ends in the
  least danger. The escape vector only breaks ties. A slam centred on the character is
  therefore left away from the boss, not into it, and with momentum kept when it cannot
  be cleared any other way.
- **Kite** compares standing still with every heading; when nowhere is safer than here the
  character fights from here. A kite that has started continues until predicted pressure
  drops below a release level, so a character in contact with a slow enemy steps well
  clear rather than pacing at the edge of reach. Near a boss standing still carries a
  cost of its own, because a Ground Slam lands wherever the character is.
- **Hit and run**: with the attack ready and the target just out of reach, the character
  weighs stepping in against staying put and steps in when the extra danger fits the
  profile's strike budget. Once the blow lands and the attack recharges, the kite
  resumes. This is what lets a sword fight a Slime it could otherwise only outrun.
- **Approach** bends around telegraphs, shots and other packs rather than walking through
  them, and picks its target by threat discounted by distance so it does not cross the
  arena past three Slimes to reach a Brute.
- **Health** tightens every profile: below a profile-defined fraction the kite threshold,
  contact tolerance and strike budget slide toward their low-health values, so Aggressive
  at a quarter of its health kites the way Balanced does at full.

Aggressive tolerates contact up to a threat budget (one ordinary enemy, not a Brute or a
pack); Balanced and Cautious break any contact. Ranged enemies and bosses count only a
standoff distance of their reach as pressure, because the shot and the charge are dodged
when telegraphed and treating the whole arena as danger made Cautious flee forever.

## Consequences

The same seed, behavior-profile selection history, and fixed-step progression produce
the same movement decisions. Behavior changes are explainable through UI projections
and can be expanded by content-defined traits without creating separate systems that
compete to move the player. A generic planner/GOAP framework remains out of scope until
the ordered candidate model proves insufficient.
