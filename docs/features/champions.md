# Champions

## Purpose

A Champion is an immutable saved build produced from a completed dungeon run.
Champions preserve the build identity that the player wants to test again in
special content without copying the live runtime state of the original
character.

Champions are not additional party members in the initial implementation. A
selected Champion replaces the active character for an Abyss attempt.

## Creation

The only way to create a Champion is by completing a dungeon successfully. After
victory, the player may save the resulting build as a Champion. The Champion
stores a build recipe and a revision snapshot,
including:

- Stable class ID.
- Stable skill IDs and skill levels.
- Skill evolutions, synergies, and enhancements.
- Equipped run gear and rolled modifier values.
- Behavior profile and targeting preferences.
- Character schema version.
- Content/balance version.
- Creation metadata and display name.

It does not store transient runtime state such as current HP, positions,
cooldowns, active effects, RNG cursors, or enemy entities. A fresh runtime
state is created when the Champion enters a run.

## Player actions after creation

Champions are immutable build snapshots. Players may only:

- View a Champion and its preserved build details.
- Rename a Champion.
- Delete or archive a Champion.

Players cannot edit the class, skills, upgrades, equipment, behavior, or
content version of an existing Champion. A different build must be created by
completing another dungeon run.

The source build and the Champion snapshot are independent. Editing or deleting
a saved character must never mutate an active run or an existing Champion.

## Revisions and balance changes

Character edits create a new immutable revision. Existing revisions remain
available for active runs and historical results.

Classes and skills use stable IDs that are never reused for a different meaning.
Renames may use aliases. Removed or incompatible content requires an explicit
migration or repair flow; it must not silently substitute a different skill.

New runs use the current content version by default. An active run uses the
content version captured at run start, provided that the required definitions
remain available.

## Use in the Infinite Abyss

The Abyss requires one available Champion. The selected Champion becomes the
player-controlled simulation actor for that attempt. It receives fresh HP,
cooldowns, positions, effects, and other runtime fields.

The initial scope does not include:

- Multiple Champions in one run.
- AI-controlled Champion companions.
- Player control switching between characters.
- Network synchronization of independent characters.

Artifacts are selected by the account starting the run and are not embedded in
the Champion. This keeps a borrowed Champion separate from the owner's
tradeable artifact inventory.

## Exhaustion

Using a Champion in an Abyss attempt applies a 24-hour exhaustion timer to that
Champion. The timer begins when the attempt is committed and continues offline.
It applies after success, defeat, forfeit, disconnect, or abandonment.

Eligible revival fish can reduce the remaining timer. The fish is consumed and
the reduction is capped at the remaining exhaustion. See `fishing.md` for the
normalization and balance rules.

## Borrowing

Borrowing a Champion from another player is a later extension of the same
snapshot model. A public Champion must expose only validated build data and
must not expose private account inventory or active runtime state.

The borrowing owner retains ownership of the original Champion. The borrower
uses their own fish and artifact loadout, and the borrowed Champion receives
the same exhaustion rules as an owned Champion unless a later lending policy
specifies otherwise.
