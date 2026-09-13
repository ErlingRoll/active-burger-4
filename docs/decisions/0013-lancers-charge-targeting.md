# 0013: Lancer's Charge aims for the densest line

## Context

Lancer's Charge auto-casts every 2.6 seconds, teleports the player toward an
enemy, and damages a corridor from the player's starting position. It felt bad
to own: the dash is an involuntary repositioning with no invulnerability, yet
the corridor often struck one or two enemies.

Three things compounded:

- The corridor pointed at the **nearest** enemy, which is usually a straggler
  off to the side of the pack rather than the pack itself.
- Momentum granted exactly one stack per cast regardless of how many enemies
  were struck, so nothing rewarded a good line over a bad one. The skill text
  already promised "Momentum with each hit"; the code disagreed.
- The corridor was 72 wide by 170 long, about half of Whirlwind's area per
  cast, and the hard-to-land shape of the two.

## Decision

The corridor shape and the dash stay; they are the skill's identity. The
skill now picks its line well and pays out when it lands.

- **Best-line targeting.** Each living enemy within range, up to the nearest
  `LANCERS_CHARGE_TARGET_CANDIDATE_LIMIT` (12), is a candidate direction. The
  corridor filter is evaluated for every candidate and the charge fires down
  the line that strikes the most enemies. Ties go to the nearest candidate,
  then the lowest entity id, so the choice is deterministic.
- **Hold below the target minimum.** If the best line strikes fewer than
  `LANCERS_CHARGE_MIN_TARGETS` (2) enemies and no boss, the skill stays ready
  but does not fire. After `LANCERS_CHARGE_HOLD_SECONDS` (1.5) of holding it
  fires at the best line anyway, so it never goes quiet. The hold clears when
  no enemy is in range and when a charge resolves. A Mirrorcast echo replays a
  charge that was already judged worth the dash, so it ignores the hold.
- **Momentum per enemy struck.** One stack per enemy hit, still capped at 3.
  The decay window grows from 4 to 6 seconds so a held cast cannot silently
  drop stacks between charges.
- **Land at the front of the pack.** The dash stops short of the first enemy
  along the chosen line, not beside the scoring target. Without this, a line
  scored through a distant enemy would drag the player deeper into crowds.
- **Larger corridor.** Half-width 36 to 50 and length 170 to 200, so the
  strip covers roughly 20,000 square units against Whirlwind's 25,400.
- **Single-target payoff.** A charge that strikes exactly one enemy deals
  `LANCERS_CHARGE_SINGLE_TARGET_MORE_DAMAGE_PERCENT` (50%) more damage. This is
  a multiplicative "more" modifier on the skill's own damage, in the same
  slot Fiery Touch and Ice Lance use, and it stacks with Vanguard's additive
  single-target increase.

Both evolutions and all Lancer synergies keep working unchanged. Impaler's
wider, longer corridor now gets aimed at the crowd it was built for. Vanguard's
bonus remains the consolation for a forced one-enemy charge.

## Alternatives

- **Keep nearest-enemy targeting and only buff damage.** Rejected: the
  complaint was about landing few hits, not about per-hit damage, and a
  damage buff would over-reward the rare good line.
- **Never hold, always fire on cooldown.** Rejected: uptime against sparse
  enemies matters less than avoiding an unpaid dash. The 1.5 second patience
  cap bounds the loss.
- **Grant invulnerability during the dash.** Rejected for now: no other skill
  has invulnerability frames and the cost of the dash is addressed by only
  taking it when it pays.
