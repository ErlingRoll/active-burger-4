# 0003: Deterministic spatial-hash broad phase

## Context

Projectile collision, target selection, and XP attraction currently inspect
collections of entities for nearby candidates. Milestone 10 adds stress-spawn
commands without changing the exact gameplay rules.

## Decision

Use a small cell-based `SpatialHash` owned by simulation systems. Entries are
indexed by their circular bounds, queries return deduplicated candidates in
stable `EntityId` order, and each consumer retains its existing exact distance
checks. A single enemy index is rebuilt once per simulation tick and shared by
target selection and projectile collision; pickup attraction builds its own
index because pickups are created after combat resolution.

Development stress spawns are explicit, deterministic, and limited to 100, 500,
or 1000 Slimes. They intentionally bypass the normal active-enemy cap only
through the development-only helper; normal spawning remains cap-controlled.

## Consequences

Large candidate sets avoid full collection scans for targeting, projectile
collisions, and pickup attraction while preserving deterministic consumer
ordering. The broad phase may return false positives by design, so it must not
replace exact collision or range checks. Stress commands are unavailable from
the production UI and can temporarily create more active enemies than normal
run balance permits.
