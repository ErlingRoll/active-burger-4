# Artifacts

## Purpose

Artifacts are permanent account-owned items that change how a run is played.
They are obtained primarily from higher-rarity loot boxes and equipped before
normal dungeon or Abyss runs.

Artifacts are one of the places power comes from outside a run: every line
on one is a bonus with no downside, and the Forge can raise those lines. The
base game must remain playable with no artifacts equipped.

## Item model

Each artifact instance contains:

- Unique item ID.
- Stable artifact definition ID.
- Rarity.
- One fixed effect family.
- One server-generated rolled value.
- Potential: how much the Forge can still work it, rolled between thirty and
  a hundred when it is made and spent by every strike. At nought the artifact
  is finished.
- Ownership and binding state.
- Creation and transfer history.

The artifact definition controls the effect identity and valid value range. The
client never submits the effect or rolled value as authoritative data.

## Slots

Players begin with one artifact slot and can unlock up to three. Slot unlocks
are account progression and are not tied to owning a specific artifact.

Artifacts may use mutually exclusive effect tags or diminishing returns so
three artifacts do not collapse every build into the same optimal setup.

## Equipment and snapshots

Artifacts are selected before a run starts. The run stores the selected artifact
IDs and resolved values in its snapshot. Editing the artifact inventory during
an active run cannot change that run.

An Abyss Champion stores class, skills, behavior, and gear, but not the
account's artifact loadout. A player using a borrowed Champion supplies their
own artifact loadout.

## Trading and binding

Artifacts are tradeable while unbound. Equipping an artifact binds it to the
account and removes it from the market. This preserves market value while
preventing one item from being rotated through many accounts during a run.

Trades require server-authoritative ownership checks, atomic transfer, unique
item IDs, and an auditable transaction record. The marketplace is not part of
the first loot-box vertical slice.

## Selling and duplicate handling

The shop may accept unwanted artifacts for a low-value salvage reward.
Artifact sales must not convert loot boxes into an uncontrolled Essence farm.
Duplicate artifacts should remain useful through salvage, collection progress,
or later crafting sinks. The Camp's Forge is the first such sink: for stone,
scrap, rift shards and a stake of Essence it strikes at an artifact, and the
strike may raise the line the player chose, raise another, promote the
artifact a rarity, miss, or slip a line, until the artifact's Potential is
spent. A poor roll on a good base is worth keeping for the Forge rather than
salvaging. See [camp.md](camp.md).
