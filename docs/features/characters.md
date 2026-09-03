# Saved Characters

## Purpose

Saved Characters are editable build recipes. They let a player create, name,
edit, and reuse a character setup without storing calculated stats or mutable
combat state.

They are separate from Champions:

- A Saved Character is an editable recipe.
- A Character Revision is an immutable version of that recipe.
- A Champion is a preserved build snapshot produced from a completed run.
- An active run stores its own immutable snapshot.

## Character recipe

A recipe contains stable IDs and player choices:

- Class ID.
- Skill IDs and levels.
- Evolutions, synergies, and enhancements.
- Behavior profile.
- Targeting preferences.
- Optional starting-loadout choices.
- Display name and cosmetic metadata.

Calculated stats, cooldown timers, HP, positions, active effects, RNG state, and
other runtime fields are never stored in the editable recipe.

## Editing and revisions

Editing a character creates a new revision. Existing revisions are immutable.
An active run or Champion never changes when the player edits the source
character.

Every revision records:

- Character schema version.
- Content/balance version.
- Creation timestamp.
- Parent revision, when applicable.

New runs use the current balance version. Active runs use the version captured
at run start. Stable IDs are never reused for a different class or skill
meaning. Renames use aliases; removed content requires an explicit migration or
repair flow.

## Validation

The client may present the editor, but the server must validate any public,
borrowable, rewarded, or tradeable build. Validation checks unlocks, legal
skill combinations, levels, content versions, and revision ownership.

Private local drafts may be edited offline, but they cannot be used to claim
server-backed rewards until validated.

## Scope

The first implementation supports one active character per run. Saved
Characters and Champions do not create a party, companion, or real-time
multiplayer system.
