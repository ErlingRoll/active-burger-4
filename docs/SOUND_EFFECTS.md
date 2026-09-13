# Sound effects

Every sound effect in the game is synthesized in the browser with the Web
Audio API. There are no effect files to author, download, or keep in sync with
the code, and every cue follows the Effects slider, the Master slider, and the
mute toggle in the audio settings. Music is a separate system
(`src/audio/AudioSystem.ts`) and is not covered here.

## How a sound happens

```
simulation system ──emitGameEvent(state, event)──▶ per-Game event queue
                                                         │
                                        Game.drainEvents() once per frame
                                                         │
          PixiGame.onAfterUpdate / game.subscribe ──▶ GameSoundDirector.handle(events)
                                                         │
                                          aggregation and cooldowns
                                                         │
                                    soundEffects.play(cueId, options)
                                                         │
                                cue renderer ──▶ voice gain ──▶ master gain ──▶ speakers
                                                              (master × effects, 0 when muted)
```

1. **The simulation reports what happened.** `src/game/events/GameEvents.ts`
   defines the `GameEvent` union and the sink. Systems call
   `emitGameEvent(state, { type: 'enemy-died', … })` at the exact place the
   thing happens. Events are plain data and the simulation never reads them
   back, so emitting one cannot change a run; the deterministic scenario and
   the checkpoint round-trip tests are unaffected. The queue is a `WeakMap`
   keyed on the state object rather than a field on it, which is why it never
   appears in a checkpoint. Hand-built states in tests have no sink, and for
   them `emitGameEvent` is a no-op.
2. **The renderer drains once per frame.** `src/rendering/GameCanvas.tsx`
   creates a `GameSoundDirector` and calls `game.drainEvents()` from
   `PixiGame`'s `onAfterUpdate` hook (right after the simulation step) and
   from the `game.subscribe` callback (so a cue for a menu action is not a
   frame late, and a defeat is heard even if the canvas unmounts).
3. **The director aggregates.** `src/audio/GameSoundDirector.ts` maps events
   to cues with rolling cooldowns and per-frame batching: a frame of hits
   becomes one thud sized to the count, several deaths become one crunch,
   damage-over-time is a soft cue at most every 700 ms, and the new-floor heal
   is silent. All of the numbers live in `DIRECTOR_COOLDOWNS_MS`.
4. **The player plays.** `src/audio/SoundEffectPlayer.ts` owns the
   `AudioContext`, a master gain that follows the settings, per-cue cooldowns,
   a voice cap with priority-based eviction, and pitch jitter. It creates no
   nodes while muted or at zero volume, and drops plays (never queues them)
   while the context is not running.
5. **Cues are recipes.** `src/audio/SoundCues.ts` is the registry:
   `{ priority, gain, cooldownMs, pitchJitter?, render }` per cue, built from
   the primitives in `src/audio/SynthPrimitives.ts` (`tone`, `noise`,
   `arpeggio`, `layer`, `withIntensity`). Lookup tables map every skill,
   damage element, rarity, and boss attack to a cue, and `tsc` fails if one is
   missing.

Menus use `src/audio/UiSounds.ts`: one delegated click listener mounted in
`App` gives every button a press sound. A button whose moment already has a
simulation-driven cue opts out with `data-sfx="none"` (the level-up picks,
the pause menu's resume, the mute toggle); `data-sfx="confirm"` and
`data-sfx="cancel"` pick the variant. Hover, focus and tooltips are silent on
purpose. Toasts, loot boxes, fishing, the shop, and Essence purchases call
`playSound` directly at the moment the thing succeeds or fails.

## The voice

Every cue follows the same rules, and `SoundCues.test.ts` enforces the ones
it can:

- **Waves:** sine and triangle. A sawtooth appears only behind a lowpass at
  or below 1.5 kHz, for low weight. No square wave anywhere.
- **Envelopes:** attacks of 8–60 ms (a UI tap may go to 4 ms), exponential
  decays, releases of 80 ms to 1.2 s. Nothing clicks on.
- **Pitch:** at most an octave of movement, spread across the note. No
  chirps.
- **Noise:** only filtered. Short bandpassed or highpassed transients for
  ticks, glass and sparks; lowpass-swept air for whooshes and transitions.
  A noise voice never peaks above 0.4.
- **Harmony:** overlapping chords (`chord`, `pingChord`) rather than
  sequenced arpeggios; octaves, fifths and major thirds, a minor third for a
  cancel or an error.
- **Levels:** no cue above 0.5. Menus sit around 0.22–0.3, routine combat
  0.18–0.32, rewards 0.3–0.4, the player being hurt and boss moments 0.4–0.5.

The builders in `SoundCues.ts` are the vocabulary: `tap` (the UI press),
`ping` (a glassy note), `chord` and `pingChord`, `swell` (a warning or a
welcome), `thump` (every impact), `air` (a whoosh), `tick` (a transient),
`sub` (weight), `crackle` (fire), `pad` (a dark, lowpassed sawtooth) and
`shimmer` (a quiet high breath behind a reward).

## Autoplay

Browsers only let audio start from a user gesture. `src/audio/SoundEffects.ts`
registers `pointerdown` and `keydown` listeners that unlock the context, the
same way the music resumes. A cue requested before that is dropped rather
than held, so unlocking never releases a burst.

## Adding an event

1. Add a member to the `GameEvent` union in `src/game/events/GameEvents.ts`.
   Keep it plain data: ids and numbers, never entity references.
2. Call `emitGameEvent(state, …)` where it happens. Do not emit per
   damage-over-time tick; the brief asks for no sound there and the
   aggregation is easier to reason about when the ticks never reach it.
3. Handle it in `GameSoundDirector.handle`, with a cooldown if it can be
   dense, and cover it in `GameSoundDirector.test.ts`.
4. Add an assertion in `src/game/Game.events.test.ts` that a real run
   produces it.

## Adding or tuning a cue

1. Add an entry to `SOUND_CUES` in `src/audio/SoundCues.ts`. Compose it from
   the builders above; keep routine combat under about 150 ms and fanfares
   under 1.5 s. `SoundCues.test.ts` renders every cue on the fake context and
   checks its length, its levels, and that it stays in the voice.
2. If it belongs to a family, add it to the matching lookup table
   (`SKILL_CAST_CUES`, `HURT_CUES`, `LOOT_REVEAL_CUES`, `BOSS_TELEGRAPH_CUES`).
3. Pick a `priority` from `CUE_PRIORITY` in `SoundCueTypes.ts`. Higher
   priorities crowd out lower ones when the voice cap is reached; the player
   being hurt is highest, routine combat lowest.

A cue could later be backed by an authored file instead of a recipe: a
`render` that plays an `AudioBufferSourceNode` from a decoded file satisfies
the same `CueRenderer` contract, and nothing upstream would change.

## Testing

`src/audio/testing/FakeAudioContext.ts` is a recording stand-in for the Web
Audio API: nodes remember what was scheduled on them and the context counts
what it handed out. Player and primitive tests run against it in the default
Node environment; only `UiSounds.test.tsx` needs jsdom. The director is tested
with a recording sink and a fake clock.

In the browser, the `?demo=` parameters honoured by `GameCanvas` (with
development tools enabled) are the quickest way to hear a family: `level-up`
for XP blips and the choice screen, `gear` for pickups and the gear choice,
`final-boss` for spawn, telegraphs, impacts, death, and the stairs, `stairs`
for the descent and arrival.
