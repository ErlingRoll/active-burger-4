# Durable dungeon run checkpoints

## Context

Dungeon runs previously lived only in the browser simulation. A refresh or
browser crash discarded the character and all floor progress, while allowing
the player to leave without an account-level active-run lock.

## Decision

Store each authenticated run in Supabase with an owner-scoped metadata row and
an append-only sequence of JSONB snapshots. Write the initial checkpoint,
write the canonical next-floor checkpoint only after a floor is completed, and
write a terminal snapshot on victory, death, or forfeit. Save & quit changes
the run to `paused` without creating a new checkpoint.

The checkpoint payload is a versioned serialization of the complete
deterministic simulation boundary. It includes mutable game state, pending
choice flows, rolled equipment, random-generator positions, spawn scheduling,
entity allocation, clock state, and private cursors. Continue restores the
latest completed checkpoint exactly.

Floor transitions preserve run progression: collected XP remains on the player,
gear choices are applied or remain queued, and uncollected ground pickups remain
in the serialized pickup list. The floor reset clears combat entities and
temporary effects, but does not clear pickups. The next-floor checkpoint is
normalized to a playable state and therefore reloads on the new floor with
those pickups still available.

Save & quit is intentionally checkpoint-based rather than a live snapshot. If
the player quits while skill or gear choices are queued, the queue is preserved
only when it was part of the latest completed checkpoint (for example, an
initial starting-level queue). Choices, XP, equipment, and ground pickups
acquired after that checkpoint are not persisted and are absent when the run is
continued.

Supabase RPCs enforce one incomplete run per profile, owner access, stale and
duplicate write behavior, terminal idempotency, and purchase blocking while a
run is incomplete. The client never relies on an unload-time network write.

## Consequences

- A browser crash or refresh can recover the latest completed floor.
- Quitting cannot overwrite a bad mid-floor state or create a save-scumming
  reset.
- The floor transition waits for the checkpoint request rather than a fake
  fixed delay.
- Snapshot metadata supports later run, class, dungeon, and floor analysis
  without treating display names as stable identifiers.
- Recovery is checkpoint-based rather than tick-based, so in-progress enemy
  positions are intentionally not uploaded continuously.
