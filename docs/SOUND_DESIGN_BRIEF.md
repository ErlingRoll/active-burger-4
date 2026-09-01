# Sound Design Brief

This is the asset inventory for the current playable loop. Every checkbox is
one sound cue to produce or track. Treat repeated cues as a cue family and
provide a small set of variations where repetition will be frequent.

## Direction and mix rules

- Keep the soundscape energetic but readable at high enemy density.
- Use four volume categories: `master`, `music`, `effects`, and `UI`.
- Persist volume settings locally.
- Do not play a sound for every damage-over-time tick or every late-game hit.
  Rate-limit, group, or aggregate repeated events.
- Important information should win the mix in this order: player danger,
  boss telegraph/cast, player defensive response, meaningful reward, routine
  combat.
- Provide short, medium, and intense variants for cues that scale with
  simultaneous targets or critical outcomes.

## Priority 0: loop and feedback

These cues make the core loop readable and should be produced first.

### Run and player state

- [ ] Run start.
- [ ] Normal-floor dungeon ambience loop.
- [ ] Floor start.
- [ ] Floor transition.
- [ ] Arrival on the next floor.
- [ ] Pause.
- [ ] Resume.
- [ ] Final pause-menu close.
- [ ] Optional player movement/footstep cue; do not make this a constant loop.
- [ ] Player takes physical damage.
- [ ] Player takes fire damage.
- [ ] Player takes cold damage.
- [ ] Player takes lightning damage.
- [ ] Player takes chaos damage.
- [ ] Player death/defeat.
- [ ] Run victory.
- [ ] Player dodge response.
- [ ] Successful near-miss accent.
- [ ] Healing received.
- [ ] Critical healing received.
- [ ] Shield gained.
- [ ] Shield absorbs damage.
- [ ] Shield breaks.

### Basic attack

Provide a readable cast/release and hit family for each equipped weapon:

- [ ] Sword melee sweep.
- [ ] Sword enemy hit.
- [ ] Bowstring release.
- [ ] Bow arrow flight.
- [ ] Bow arrow hit.
- [ ] Wand seeking arcane bolt release.
- [ ] Wand bolt hit.
- [ ] Staff area pulse.
- [ ] Staff poison application.
- [ ] Staff poison tick (rate-limited).
- [ ] Basic attack critical hit accent.
- [ ] Resonance-empowered basic attack accent.

### Pickups and progression

- [ ] XP pickup appears.
- [ ] XP pickup moves toward the player.
- [ ] XP pickup collection.
- [ ] Gear pickup appears.
- [ ] Gear pickup attraction.
- [ ] Gear pickup collection.
- [ ] Gear item reveal.
- [ ] Gear equip.
- [ ] Gear upgrade.
- [ ] Healing potion pickup appears.
- [ ] Healing potion collection.
- [ ] Healing potion heal.
- [ ] Level-up trigger.
- [ ] Level-up choice screen opens.
- [ ] Upgrade choice selection.
- [ ] Reroll.
- [ ] Choice skip.
- [ ] Choice confirmation.
- [ ] Skill unlock.
- [ ] Skill level-up.
- [ ] Evolved/resonant upgrade.
- [ ] Synergy offer.
- [ ] Skill removal/banish (when that flow is enabled).

## Priority 1: authored skills

Each skill needs a cast/start cue and a result cue. Persistent skills also need
an expiry cue. Resonance/evolved effects may reuse the base family with a
distinct stinger rather than requiring a completely separate set.

### Whirlwind

- [ ] Spin-up.
- [ ] Sweeping hit.
- [ ] Cyclonic Reset.

### Chain Lightning

- [ ] First strike.
- [ ] Chain jump.
- [ ] Arc Overload.

### Vitality

- [ ] Cast.
- [ ] Restorative pulse.
- [ ] Surging Vitality.

### Raise Skeleton

- [ ] Skeleton summon.
- [ ] Skeleton attack.
- [ ] Skeleton hurt.
- [ ] Skeleton death.
- [ ] Reanimation.

### Fiery Touch

- [ ] Fire impact.
- [ ] Area trigger.
- [ ] Ignition.
- [ ] Inferno Trigger.

### Glacial Orb

- [ ] Orb launch.
- [ ] Orb travel.
- [ ] Orb explosion.
- [ ] Chill application.
- [ ] Deep Freeze.
- [ ] Freeze.

### Lancer's Charge

- [ ] Charge-up.
- [ ] Dash.
- [ ] Corridor impact.
- [ ] Momentum stack.

### Rallying Banner

- [ ] Banner plant.
- [ ] Immediate heal.
- [ ] Periodic rally heal.
- [ ] Defensive aura.
- [ ] Banner expiry.

### Gravity Well

- [ ] Singularity open.
- [ ] Pull/pressure loop.
- [ ] Impact.
- [ ] Crushing Gravity.

### Aegis Pulse

- [ ] Pulse.
- [ ] Shield creation.
- [ ] Shield refresh.
- [ ] Fortified Pulse.

### Rift Javelin

- [ ] Javelin throw.
- [ ] Outbound pierce.
- [ ] Return pass.
- [ ] Rift Echo.

### Cinder Mine

- [ ] Mine placement.
- [ ] Fuse/arming signal.
- [ ] Mine detonation.
- [ ] Burning application.
- [ ] Burning tick (rate-limited).

### Storm Relay

- [ ] Relay placement.
- [ ] Relay activation.
- [ ] Lightning strike.
- [ ] Chain jump.
- [ ] Shock application.
- [ ] Relay expiry.

### Soul Tether

- [ ] Tether latch.
- [ ] Tether loop.
- [ ] Tether damage tick (rate-limited).
- [ ] Life-drain/heal.
- [ ] Tether snap on target death.
- [ ] Soul Surge.

### Phantom Arsenal

- [ ] Spectral archer summon.
- [ ] Spectral arrow fire.
- [ ] Spectral arrow hit.
- [ ] Summon fade.

### Sigil of Ruin

- [ ] Ruin brand.
- [ ] Sigil charge gain.
- [ ] Sigil detonation.
- [ ] Sigil spread.
- [ ] Cursed Brand.

### Mirrorcast

- [ ] Capture window.
- [ ] Echo creation.
- [ ] Delayed copied cast.
- [ ] True Image.

### Razorwire

- [ ] Anchor throw.
- [ ] Wire tension/string.
- [ ] Enemy crossing cut.
- [ ] Wire chill.
- [ ] Razor lattice.
- [ ] Wire snap.
- [ ] Wire expiry.

### Blood Rite

- [ ] Safe HP sacrifice.
- [ ] Chaos pulse.
- [ ] Blood Debt armed.
- [ ] Blood Debt consumed.
- [ ] Healing return.
- [ ] Free Offering.

### Prism Halo

- [ ] Prism summon.
- [ ] Orbit loop.
- [ ] Fire shard.
- [ ] Cold shard.
- [ ] Lightning shard.
- [ ] Burning application.
- [ ] Chill application.
- [ ] Shock application.
- [ ] Full Spectrum convergence.

## Priority 1: enemies and bosses

### Ordinary enemies

Create a compact family for spawn, movement presence, hit, and death. Give the
following types enough identity to be distinguishable without making six
separate loud layers play constantly:

- [ ] Slime movement.
- [ ] Slime contact.
- [ ] Slime death.
- [ ] Runner movement.
- [ ] Runner impact.
- [ ] Brute heavy movement.
- [ ] Brute contact.
- [ ] Archer ranged release.
- [ ] Archer projectile impact.
- [ ] Splitter body hit.
- [ ] Splitter split burst.
- [ ] Splitter child spawn.
- [ ] Flanker movement/ambush.
- [ ] Flanker hit.
- [ ] Elite modifier spawn/empower accent; do not make this a continuous loop.

### Enemy abilities

- [ ] Aimed Shot telegraph.
- [ ] Aimed Shot release.
- [ ] Aimed Shot arrow travel.
- [ ] Aimed Shot impact.
- [ ] Shockwave telegraph rumble.
- [ ] Shockwave release.
- [ ] Shockwave expanding wave.
- [ ] Shockwave impact.
- [ ] Generic enemy telegraph warning.
- [ ] Player-danger escalation.

### Boss encounters

- [ ] Boss arrival/spawn.
- [ ] Boss encounter lock-in.
- [ ] Stone Golem hurt.
- [ ] Stone Golem defeat/death.
- [ ] Inferno Warden hurt.
- [ ] Inferno Warden defeat/death.
- [ ] Stone Golem Ground Slam telegraph.
- [ ] Stone Golem Ground Slam impact.
- [ ] Stone Golem Charge telegraph.
- [ ] Stone Golem Charge impact.
- [ ] Inferno Warden Fire Nova telegraph.
- [ ] Inferno Warden Fire Nova impact.
- [ ] Inferno Warden Flame Line telegraph.
- [ ] Inferno Warden Flame Line impact.
- [ ] Inferno Warden Meteor Zones mark.
- [ ] Inferno Warden Meteor Zones impact.
- [ ] Inferno Warden enrage escalation.
- [ ] Boss encounter victory.
- [ ] Boss reward reveal.

## Priority 2: world, rewards, and menus

- [ ] Stairs appear.
- [ ] Stairs interaction.
- [ ] Final stairs complete the run.
- [ ] Normal enemy wave/spawn escalation ambience (used sparingly).
- [ ] Common gear rarity/reward accent.
- [ ] Uncommon gear rarity/reward accent.
- [ ] Rare gear rarity/reward accent.
- [ ] Epic gear rarity/reward accent.
- [ ] Legendary gear rarity/reward accent.
- [ ] Meta-progression screen opens.
- [ ] Essence gained.
- [ ] Essence spent.
- [ ] Permanent unlock.
- [ ] Purchase failure/error.
- [ ] Main menu/screen transition.
- [ ] Button hover.
- [ ] Button focus.
- [ ] Button press.
- [ ] Button confirm.
- [ ] Button cancel.
- [ ] Tooltip opens.
- [ ] Tooltip closes.
- [ ] Keyword reveal.
- [ ] Save and quit success.
- [ ] Save and quit failure.
- [ ] Forfeit confirmation.
- [ ] Error/toast alert.
- [ ] Settings opens.
- [ ] Volume slider movement.
- [ ] Mute.
- [ ] Unmute.
- [ ] Keybind capture.

## Delivery notes

Use descriptive source names grouped by family, for example
`player_basic_bow_release`, `skill_cinder_mine_detonate`, and
`boss_inferno_warden_meteor_impact`. Supply a loopable version for persistent
effects and a one-shot version for state changes where both are needed.

The implementation currently has no audio event bus. During integration, map
these cue families to simulation transitions rather than rendering frames, and
keep a cooldown/aggregation policy for basic attacks, damage ticks, chain
jumps, pickup attraction, and dense enemy deaths.
