import { describe, expect, it } from 'vitest'
import { createGame } from '../../Game'
import { createInitialPlayerState } from '../spawning/SpawningSystem'
import type { GameState, PlayerMovementCandidate } from '../../state/GameState'
import {
  applyMovementCandidate,
  selectMovementCandidate,
  updatePlayerBehavior,
} from './BehaviorController'
import { getPlayerDodgeCandidate } from '../movement/DodgeSystem'

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
})
