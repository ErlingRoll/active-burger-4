import { describe, expect, it } from 'vitest'
import { createInitialPlayerState } from '../spawning/SpawningSystem'
import { updatePlayerDodge } from './DodgeSystem'
import type { GameState } from '../../state/GameState'

describe('autonomous Dodge movement', () => {
  it('moves away from an active telegraph without consuming randomness', () => {
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
    expect(player.y).toBe(0)
    expect(player.dodge?.mode).toBe('autonomous')
  })
})
