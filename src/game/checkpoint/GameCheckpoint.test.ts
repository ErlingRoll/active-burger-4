import { describe, expect, it } from 'vitest'
import {
  createGame,
  createGameFromCheckpoint,
  createInitialGameCheckpoint,
  FIXED_STEP_SECONDS,
  getAutomaticTimeScale,
  Game,
} from '../Game'
import { CHECKPOINT_VERSION, isValidCheckpoint } from '../checkpoint/GameCheckpoint'
import type { GameCheckpoint } from '../checkpoint/GameCheckpoint'
import { xpRequiredForLevel } from '../../content/progression/XpBalance'

/** Advance the game by N fixed ticks. */
function advanceTicks(game: Game, ticks: number): void {
  for (let i = 0; i < ticks; i++) {
    game.update(FIXED_STEP_SECONDS)
  }
}

/** Collect the next N RNG values from a game's public random. */
function collectRngValues(game: Game, count: number): number[] {
  const values: number[] = []
  for (let i = 0; i < count; i++) {
    values.push(game.random.next())
  }
  return values
}

describe('GameCheckpoint', () => {
  describe('structural round-trip', () => {
    it('serializes and restores a freshly created game', () => {
      const game = createGame({ seed: 42 })
      const checkpoint = game.createCheckpoint()
      const json = JSON.stringify(checkpoint)
      const parsed = JSON.parse(json) as GameCheckpoint

      expect(isValidCheckpoint(parsed)).toBe(true)
      expect(parsed.version).toBe(CHECKPOINT_VERSION)

      const restored = Game.restoreFromCheckpoint(parsed)
      expect(restored.state.run.seed).toBe(42)
      expect(restored.state.time).toBe(0)
      expect(restored.state.tick).toBe(0)
      expect(restored.phase).toBe('playing')
      expect(restored.state.run.modeId).toBe('dungeon')
      expect(restored.createCheckpoint().runConfig.preparation).toEqual({
        version: 1,
        items: [],
      })
    })

    it('round-trips through JSON.stringify/parse preserving all GameState fields', () => {
      const game = createGame({ seed: 100 })
      advanceTicks(game, 120) // 2 seconds of simulation

      const checkpoint = game.createCheckpoint()
      const restored = Game.restoreFromCheckpoint(
        JSON.parse(JSON.stringify(checkpoint)),
      )

      // Deep structural equality of mutable state
      expect(restored.state).toEqual(game.state)
      expect(restored.phase).toBe(game.phase)
      expect(restored.timeScale).toBe(game.timeScale)
    })

    it('preserves the run mode and resolved preparation snapshot', () => {
      const game = createGame({
        seed: 102,
        preparation: {
          version: 1,
          items: [{
            itemInstanceId: 'fish-1',
            definitionId: 'revival-koi',
            quantity: 1,
            resolvedEffect: { attackDamagePercent: 8 },
          }],
        },
      })

      const restored = Game.restoreFromCheckpoint(
        JSON.parse(JSON.stringify(game.createCheckpoint())),
      )

      expect(restored.state.run.modeId).toBe('dungeon')
      expect(restored.createCheckpoint().runConfig.preparation).toEqual({
        version: 1,
        items: [{
          itemInstanceId: 'fish-1',
          definitionId: 'revival-koi',
          quantity: 1,
          resolvedEffect: { attackDamagePercent: 8 },
        }],
      })
    })

    it('restores legacy character-class fields and writes the current checkpoint shape', () => {
      const checkpoint = createGame({ seed: 101, characterClassId: 'ranger' }).createCheckpoint()
      const legacyRunConfig = checkpoint.runConfig as unknown as Record<string, unknown>
      const legacyPlayer = checkpoint.gameState.player as unknown as Record<string, unknown>
      legacyRunConfig.playstyleId = legacyRunConfig.characterClassId
      legacyPlayer.playstyleId = legacyPlayer.characterClassId
      delete legacyRunConfig.characterClassId
      delete legacyPlayer.characterClassId

      const restored = Game.restoreFromCheckpoint(checkpoint)

      expect(restored.state.player.characterClassId).toBe('ranger')
      expect(restored.createCheckpoint().runConfig).toMatchObject({
        characterClassId: 'ranger',
      })
      expect(restored.createCheckpoint().runConfig).not.toHaveProperty('playstyleId')
      expect(restored.createCheckpoint().gameState.player).not.toHaveProperty('playstyleId')
    })

    it('preserves all three RNG positions after simulation', () => {
      const game = createGame({ seed: 77 })
      advanceTicks(game, 300) // 5 seconds – enough for spawns

      const checkpoint = game.createCheckpoint()
      const restored = Game.restoreFromCheckpoint(
        JSON.parse(JSON.stringify(checkpoint)),
      )

      // Both games should produce the same future RNG sequence
      const originalValues = collectRngValues(game, 20)
      const restoredValues = collectRngValues(restored, 20)
      expect(restoredValues).toEqual(originalValues)
    })

    it('preserves entity allocator next ID', () => {
      const game = createGame({ seed: 55 })
      advanceTicks(game, 300) // Generate some entities

      const checkpoint = game.createCheckpoint()
      expect(checkpoint.nextEntityId).toBeGreaterThan(1)

      const restored = Game.restoreFromCheckpoint(
        JSON.parse(JSON.stringify(checkpoint)),
      )

      // Both should allocate the same next entity ID
      const originalId = game.spawnSlime({ x: 100, y: 100 })
      const restoredId = restored.spawnSlime({ x: 100, y: 100 })
      expect(restoredId).toBe(originalId)
    })

    it('preserves SpawnDirector state', () => {
      const game = createGame({ seed: 33 })
      advanceTicks(game, 600) // 10 seconds

      const checkpoint = game.createCheckpoint()
      expect(checkpoint.spawnDirector.threatBudget).toBeDefined()
      expect(checkpoint.spawnDirector.introducedEntryIndices.length).toBeGreaterThan(0)

      const restored = Game.restoreFromCheckpoint(
        JSON.parse(JSON.stringify(checkpoint)),
      )

      // Advance both and compare
      advanceTicks(game, 60)
      advanceTicks(restored, 60)
      expect(restored.state.enemies.length).toBe(game.state.enemies.length)
    })
  })

  describe('future-state determinism after restore', () => {
    it('produces identical future state after combat simulation', () => {
      const game = createGame({ seed: 200 })
      advanceTicks(game, 600) // Build up some combat state

      const checkpoint = game.createCheckpoint()
      const restored = Game.restoreFromCheckpoint(
        JSON.parse(JSON.stringify(checkpoint)),
      )

      // Advance both by the same amount
      advanceTicks(game, 300)
      advanceTicks(restored, 300)

      expect(restored.state.time).toBeCloseTo(game.state.time, 10)
      expect(restored.state.tick).toBe(game.state.tick)
      expect(restored.state.player.hp).toBe(game.state.player.hp)
      expect(restored.state.player.xp).toBe(game.state.player.xp)
      expect(restored.state.enemies.length).toBe(game.state.enemies.length)
      expect(restored.state.projectiles.length).toBe(game.state.projectiles.length)
      expect(restored.state.run.killCount).toBe(game.state.run.killCount)
    })

    it('produces identical future state with active effects/entities', () => {
      const game = createGame({ seed: 500 })
      advanceTicks(game, 1200) // 20 seconds – effects and summons in play

      const checkpoint = game.createCheckpoint()
      const restored = Game.restoreFromCheckpoint(
        JSON.parse(JSON.stringify(checkpoint)),
      )

      advanceTicks(game, 600)
      advanceTicks(restored, 600)

      expect(restored.state.effects.length).toBe(game.state.effects.length)
      expect(restored.state.summons.length).toBe(game.state.summons.length)
      expect(restored.state.pickups.length).toBe(game.state.pickups.length)
    })

    it('matches future RNG-dependent rolls after restore', () => {
      const game = createGame({ seed: 999 })
      advanceTicks(game, 900) // 15 seconds

      const checkpoint = game.createCheckpoint()
      const restored = Game.restoreFromCheckpoint(
        JSON.parse(JSON.stringify(checkpoint)),
      )

      // Advance a substantial amount – spawns, damage, and RNG-dependent systems
      advanceTicks(game, 1200)
      advanceTicks(restored, 1200)

      // Full state equality after many RNG-dependent ticks
      expect(restored.state).toEqual(game.state)
    })
  })

  describe('pending choice flows', () => {
    it('preserves pending level-up choice flow', () => {
      const game = createGame({ seed: 300, startingLevel: 1 })
      // Grant enough XP to trigger level up
      const xpNeeded = xpRequiredForLevel(2)
      game.spawnXpPickup({ x: 0, y: 0 }, xpNeeded)
      advanceTicks(game, 60) // Collect it

      // If we got a level-up flow, checkpoint it
      if (game.phase === 'level-up') {
        const checkpoint = game.createCheckpoint()
        expect(checkpoint.choiceFlows.length).toBeGreaterThan(0)
        expect(checkpoint.choiceFlows[0].type).toBe('level-up')

        const restored = Game.restoreFromCheckpoint(
          JSON.parse(JSON.stringify(checkpoint)),
        )
        expect(restored.phase).toBe('level-up')
        expect(restored.getPendingChoiceFlows()).toEqual(
          game.getPendingChoiceFlows(),
        )
      }
    })

    it('preserves collected gear pickup bridge', () => {
      const game = createGame({ seed: 350 })
      game.spawnGearPickup({ x: 0, y: 0 })
      advanceTicks(game, 60)

      const checkpoint = game.createCheckpoint()
      const restored = Game.restoreFromCheckpoint(
        JSON.parse(JSON.stringify(checkpoint)),
      )

      expect(restored.getPendingGearPickups()).toEqual(
        game.getPendingGearPickups(),
      )
      expect(restored.getPendingChoiceFlows()).toEqual(
        game.getPendingChoiceFlows(),
      )
    })
  })

  describe('floor boundary and encounter', () => {
    it('preserves floor transition state', () => {
      const game = createGame({ seed: 400 })
      // Force a floor transition by spawning stairs and walking to them
      advanceTicks(game, 60)
      game.spawnStairs({ x: 0, y: 0 })
      advanceTicks(game, 120) // Should trigger stair interaction

      if (game.state.floorTransition || game.phase === 'floor-transition') {
        const checkpoint = game.createCheckpoint()
        const restored = Game.restoreFromCheckpoint(
          JSON.parse(JSON.stringify(checkpoint)),
        )

        expect(restored.state.floorTransition).toEqual(
          game.state.floorTransition,
        )
        expect(restored.phase).toBe(game.phase)
      }
    })

    it('preserves encounter state', () => {
      const game = createGame({ seed: 450 })
      advanceTicks(game, 60)
      game.startBossEncounter()

      const checkpoint = game.createCheckpoint()
      const restored = Game.restoreFromCheckpoint(
        JSON.parse(JSON.stringify(checkpoint)),
      )

      expect(restored.state.encounter).toEqual(game.state.encounter)
      expect(restored.state.bosses).toEqual(game.state.bosses)

      // Advance both and verify determinism through boss combat
      advanceTicks(game, 300)
      advanceTicks(restored, 300)
      expect(restored.state).toEqual(game.state)
    })
  })

  describe('terminal states', () => {
    it('preserves defeat state', () => {
      const game = createGame({ seed: 600 })
      advanceTicks(game, 60)
      game.endRun()

      expect(game.phase).toBe('defeat')
      const checkpoint = game.createCheckpoint()
      const restored = Game.restoreFromCheckpoint(
        JSON.parse(JSON.stringify(checkpoint)),
      )

      expect(restored.phase).toBe('defeat')
      expect(restored.state.player.hp).toBe(0)
    })

    it('preserves paused state with resume phase', () => {
      const game = createGame({ seed: 650 })
      advanceTicks(game, 60)
      game.pause()

      expect(game.phase).toBe('paused')
      const checkpoint = game.createCheckpoint()
      expect(checkpoint.resumePhase).toBe('playing')

      const restored = Game.restoreFromCheckpoint(
        JSON.parse(JSON.stringify(checkpoint)),
      )
      expect(restored.phase).toBe('paused')

      // Resume should go back to playing
      restored.resume()
      expect(restored.phase).toBe('playing')
    })
  })

  describe('version and validation', () => {
    it('rejects a checkpoint with an unknown version', () => {
      const game = createGame({ seed: 1 })
      const checkpoint = game.createCheckpoint()
      const tampered = { ...checkpoint, version: 999 }

      expect(isValidCheckpoint(tampered)).toBe(false)
      expect(() => Game.restoreFromCheckpoint(tampered)).toThrow(
        /Invalid or unsupported checkpoint.*version 999/,
      )
    })

    it('rejects malformed checkpoint data', () => {
      expect(() => Game.restoreFromCheckpoint(null)).toThrow(
        /Invalid or unsupported checkpoint/,
      )
      expect(() => Game.restoreFromCheckpoint(42)).toThrow(
        /Invalid or unsupported checkpoint/,
      )
      expect(() => Game.restoreFromCheckpoint('bad')).toThrow(
        /Invalid or unsupported checkpoint/,
      )
      expect(() => Game.restoreFromCheckpoint({})).toThrow(
        /Invalid or unsupported checkpoint/,
      )
      expect(() =>
        Game.restoreFromCheckpoint({ version: CHECKPOINT_VERSION }),
      ).toThrow(/Invalid or unsupported checkpoint/)
    })

    it('rejects checkpoint with missing required fields', () => {
      const game = createGame({ seed: 1 })
      const checkpoint = game.createCheckpoint()
      const { rngState: _, ...incomplete } = checkpoint

      expect(isValidCheckpoint(incomplete)).toBe(false)
      expect(() => Game.restoreFromCheckpoint(incomplete)).toThrow(
        /Invalid or unsupported checkpoint/,
      )
    })
  })

  describe('time scale preservation', () => {
    it('restores the automatic floor scale for saves between floors 1 and 30', () => {
      for (const floor of [1, 15, 29, 30]) {
        const game = createGame({ seed: 701 + floor })
        game.state.run.floor = floor
        const restored = Game.restoreFromCheckpoint(
          JSON.parse(JSON.stringify(game.createCheckpoint())),
        )

        expect(restored.state.run.floor).toBe(floor)
        expect(restored.timeScale).toBeCloseTo(getAutomaticTimeScale(floor))
      }
    })

    it('preserves non-default time scale', () => {
      const game = createGame({ seed: 700 })
      game.setTimeScale(3)
      advanceTicks(game, 60)

      const checkpoint = game.createCheckpoint()
      expect(checkpoint.currentTimeScale).toBe(3)

      const restored = Game.restoreFromCheckpoint(
        JSON.parse(JSON.stringify(checkpoint)),
      )
      expect(restored.timeScale).toBe(3)
    })
  })

  describe('world modifier round-trip', () => {
    it('preserves world modifier configuration', () => {
      const game = createGame({
        seed: 800,
        worldModifierIds: ['fast-start'],
      })
      advanceTicks(game, 300)

      const checkpoint = game.createCheckpoint()
      const restored = Game.restoreFromCheckpoint(
        JSON.parse(JSON.stringify(checkpoint)),
      )

      expect(restored.state.run.worldModifierIds).toEqual(
        game.state.run.worldModifierIds,
      )

      advanceTicks(game, 300)
      advanceTicks(restored, 300)
      expect(restored.state).toEqual(game.state)
    })
  })

  describe('App-integration convenience APIs', () => {
    it('createInitialGameCheckpoint returns a valid checkpoint at tick 0', () => {
      const checkpoint = createInitialGameCheckpoint({ seed: 900 })

      expect(isValidCheckpoint(checkpoint)).toBe(true)
      expect(checkpoint.gameState.tick).toBe(0)
      expect(checkpoint.gameState.time).toBe(0)
      expect(checkpoint.gameState.run.phase).toBe('playing')
      expect(checkpoint.runConfig.seed).toBe(900)
    })

    it('createGameFromCheckpoint restores identically to Game.restoreFromCheckpoint', () => {
      const game = createGame({ seed: 910 })
      advanceTicks(game, 120)
      const checkpoint = game.createCheckpoint()
      const json = JSON.parse(JSON.stringify(checkpoint))

      const fromStatic = Game.restoreFromCheckpoint(json)
      const fromFree = createGameFromCheckpoint(
        JSON.parse(JSON.stringify(checkpoint)),
      )

      // Both should produce identical future state
      advanceTicks(fromStatic, 60)
      advanceTicks(fromFree, 60)
      expect(fromFree.state).toEqual(fromStatic.state)
    })

    it('createGameFromCheckpoint rejects bad input', () => {
      expect(() => createGameFromCheckpoint(null)).toThrow(
        /Invalid or unsupported checkpoint/,
      )
    })

    it('getCheckpointSnapshot returns the same payload as createCheckpoint', () => {
      const game = createGame({ seed: 920 })
      advanceTicks(game, 60)

      // Both methods capture the same moment in time
      const a = game.createCheckpoint()
      const b = game.getCheckpointSnapshot()
      expect(a).toEqual(b)
    })

    it('getTerminalCheckpointSnapshot returns undefined during active play', () => {
      const game = createGame({ seed: 930 })
      advanceTicks(game, 60)

      expect(game.getTerminalCheckpointSnapshot()).toBeUndefined()
    })

    it('getTerminalCheckpointSnapshot returns a checkpoint at defeat', () => {
      const game = createGame({ seed: 940 })
      advanceTicks(game, 60)
      game.endRun()

      const terminal = game.getTerminalCheckpointSnapshot()
      expect(terminal).toBeDefined()
      expect(isValidCheckpoint(terminal)).toBe(true)
      expect(terminal!.gameState.run.phase).toBe('defeat')
    })

    it('getTerminalCheckpointSnapshot returns undefined while paused', () => {
      const game = createGame({ seed: 950 })
      advanceTicks(game, 60)
      game.pause()

      expect(game.getTerminalCheckpointSnapshot()).toBeUndefined()
    })

    it('createInitialGameCheckpoint round-trips through createGameFromCheckpoint', () => {
      const config = { seed: 960, worldModifierIds: ['fast-start'] as const }
      const initial = createInitialGameCheckpoint(config)
      const game = createGameFromCheckpoint(initial)

      advanceTicks(game, 300)
      expect(game.state.tick).toBe(300)
      expect(game.state.run.worldModifierIds).toEqual(['fast-start'])
    })
  })
})
