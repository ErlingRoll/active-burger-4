import { describe, expect, it } from 'vitest'
import { createInitialPlayerState } from '../spawning/SpawningSystem'
import {
  getPlayerDodgeCandidate,
  updatePlayerDodge,
} from './DodgeSystem'
import { updatePlayerBehavior } from '../behavior/BehaviorController'
import type { GameState } from '../../state/GameState'

describe('autonomous Dodge candidate', () => {
  it('produces a candidate without owning movement or consuming randomness', () => {
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
    expect(candidate).toMatchObject({
      source: 'dodge',
      directionX: 1,
      directionY: 0,
    })
    expect(player.x).toBe(0)

    updatePlayerBehavior(state, 1 / 60)
    expect(player.x).toBeGreaterThan(0)
    expect(player.y).toBe(0)
    expect(player.dodge?.mode).toBe('autonomous')
  })

  it('preserves movement in the legacy update wrapper', () => {
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

    updatePlayerDodge(state, 1 / 60)

    expect(player.x).toBeGreaterThan(0)
  })
})
