import { describe, expect, it } from 'vitest'
import { createGame } from '../../Game'
import { createInitialPlayerState } from '../spawning/SpawningSystem'
import type { GameState, PlayerMovementCandidate } from '../../state/GameState'
import {
  applyMovementCandidate,
  getPlayerBehaviorCandidates,
  selectMovementCandidate,
  updatePlayerBehavior,
} from './BehaviorController'
import { getPlayerDodgeCandidate } from '../movement/DodgeSystem'
import { getPlayerArenaBounds } from '../../../game-config/arena'
import { createDamageValues } from '../../../content/stats/Damage'

describe('behavior controller foundation', () => {
  it('switches profiles without consuming seeded randomness', () => {
    const first = createGame({ seed: 9 })
    const second = createGame({ seed: 9 })

    expect(first.behaviorProfileId).toBe('balanced')
    expect(first.setBehaviorProfile('cautious')).toBe(true)
    expect(first.behaviorProfileId).toBe('cautious')
    expect(first.random.next()).toBe(second.random.next())
    expect(first.setBehaviorProfile('unknown-profile')).toBe(false)
    expect(first.behaviorProfileId).toBe('cautious')
  })

  it('toggles Free movement without changing the selected profile', () => {
    const game = createGame({ seed: 10 })

    expect(game.freeMovementEnabled).toBe(true)
    expect(game.setBehaviorProfile('cautious')).toBe(true)
    expect(game.toggleFreeMovement()).toBe(false)
    expect(game.freeMovementEnabled).toBe(false)
    expect(game.behaviorProfileId).toBe('cautious')
    expect(game.toggleFreeMovement()).toBe(true)
    expect(game.freeMovementEnabled).toBe(true)
    expect(game.behaviorProfileId).toBe('cautious')
  })

  it('uses only manual movement in Free mode, including when a telegraph is active', () => {
    const game = createGame({ seed: 11 })
    const state = game.state as GameState
    state.telegraphs = [{
      id: 2,
      sourceId: 3,
      skillId: 'ground-slam',
      kind: 'ground-slam',
      x: 0,
      y: 0,
      radius: 100,
      remainingDuration: 0.8,
      duration: 1,
      points: [{ x: 0, y: 0 }],
      damage: createDamageValues({ physical: 1 }),
    }]

    game.setFreeMovementEnabled(true)
    game.setFreeMovementDirection(1, 0)
    const candidate = updatePlayerBehavior(state, 1 / 60)

    expect(candidate).toMatchObject({
      source: 'free',
      directionX: 1,
      directionY: 0,
    })
    expect(getPlayerBehaviorCandidates(state)).toHaveLength(1)
    expect(state.player.x).toBeGreaterThan(0)
  })

  it('selects higher-priority candidates deterministically', () => {
    const low: PlayerMovementCandidate = {
      source: 'dodge',
      directionX: 1,
      directionY: 0,
      speed: 10,
      priority: 1,
    }
    const high = { ...low, priority: 2 }
    expect(selectMovementCandidate([low, high])).toBe(high)
    expect(selectMovementCandidate([])).toBeUndefined()
  })

  it('lets Dodge produce a candidate while the controller applies movement', () => {
    const player = createInitialPlayerState(1)
    const state = {
      player,
      enemies: [],
      telegraphs: [{
        id: 2,
        sourceId: 3,
        skillId: 'ground-slam',
        kind: 'ground-slam',
        x: 0,
        y: 0,
        radius: 100,
        remainingDuration: 0.8,
        duration: 1,
        points: [{ x: 0, y: 0 }],
        damage: 1,
      }],
    } as unknown as GameState

    const candidate = getPlayerDodgeCandidate(state)
    expect(candidate).toMatchObject({ source: 'dodge', directionX: 1, directionY: 0 })
    expect(player.x).toBe(0)
    updatePlayerBehavior(state, 1 / 60)
    expect(player.x).toBeGreaterThan(0)
    expect(player.behaviorController?.lastCandidate?.source).toBe('dodge')
  })

  it('normalizes candidate direction and clamps negative time', () => {
    const state = { player: createInitialPlayerState(1) } as unknown as GameState
    applyMovementCandidate(state, {
      source: 'dodge',
      directionX: 3,
      directionY: 4,
      speed: 100,
      priority: 1,
    }, -1)
    expect(state.player.x).toBe(0)
    expect(state.player.y).toBe(0)
  })

  it('accelerates quickly from rest instead of snapping to full speed', () => {
    const state = { player: createInitialPlayerState(1) } as unknown as GameState
    const step = 1 / 60
    applyMovementCandidate(state, {
      source: 'combat-range',
      directionX: 1,
      directionY: 0,
      speed: 90,
      priority: 1,
    }, step)

    expect(state.player.movementVelocityX).toBeGreaterThan(0)
    expect(state.player.movementVelocityX).toBeLessThan(90)
    expect(state.player.x).toBe(state.player.movementVelocityX! * step)
  })

  it('accelerates Free movement faster than autonomous movement', () => {
    const step = 1 / 60
    const autonomousState = {
      player: createInitialPlayerState(1),
    } as unknown as GameState
    const freeState = {
      player: createInitialPlayerState(1),
    } as unknown as GameState

    applyMovementCandidate(autonomousState, {
      source: 'combat-range',
      directionX: 1,
      directionY: 0,
      speed: 90,
      priority: 1,
    }, step)
    applyMovementCandidate(freeState, {
      source: 'free',
      directionX: 1,
      directionY: 0,
      speed: 90,
      priority: 1,
    }, step)

    expect(freeState.player.movementVelocityX).toBeGreaterThan(
      autonomousState.player.movementVelocityX!,
    )
    expect(freeState.player.movementVelocityX).toBe(60)
  })

  it('smooths a direction reversal while reaching the new direction quickly', () => {
    const state = { player: createInitialPlayerState(1) } as unknown as GameState
    const step = 1 / 60
    const candidate = {
      source: 'combat-range' as const,
      directionX: 1,
      directionY: 0,
      speed: 90,
      priority: 1,
    }
    for (let index = 0; index < 10; index += 1) {
      applyMovementCandidate(state, candidate, step)
    }
    applyMovementCandidate(state, { ...candidate, directionX: -1 }, step)

    expect(state.player.movementVelocityX).toBeGreaterThan(-90)
    for (let index = 0; index < 10; index += 1) {
      applyMovementCandidate(state, { ...candidate, directionX: -1 }, step)
    }
    expect(state.player.movementVelocityX).toBeLessThan(0)
  })

  it('clamps the player to the arena and clears velocity blocked by a wall', () => {
    const state = { player: createInitialPlayerState(1) } as unknown as GameState
    const bounds = getPlayerArenaBounds(state.player.radius)
    state.player.x = bounds.maxX - 1

    applyMovementCandidate(state, {
      source: 'combat-range',
      directionX: 1,
      directionY: 0,
      speed: 90,
      priority: 1,
    }, 1)

    expect(state.player.x).toBe(bounds.maxX)
    expect(state.player.movementVelocityX).toBe(0)
  })

  it('keeps diagonal movement inside the player-safe corner bounds', () => {
    const state = { player: createInitialPlayerState(1) } as unknown as GameState
    const bounds = getPlayerArenaBounds(state.player.radius)
    state.player.x = bounds.maxX
    state.player.y = bounds.maxY

    applyMovementCandidate(state, {
      source: 'kite',
      directionX: 1,
      directionY: 1,
      speed: 90,
      priority: 1,
    }, 1 / 60)

    expect(state.player.x).toBeLessThanOrEqual(bounds.maxX)
    expect(state.player.y).toBeLessThanOrEqual(bounds.maxY)
    expect(state.player.movementVelocityX).toBeLessThan(0)
    expect(state.player.movementVelocityY).toBeLessThan(0)
  })
})
