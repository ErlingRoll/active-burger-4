import { describe, expect, it } from 'vitest'
import { SPAWN_BALANCE } from '../../content/spawning/SpawnBalance'
import { getGearDropChance } from '../../content/gear/GearDrops'
import { createGame, FIXED_STEP_SECONDS } from '../Game'
import { Random } from '../random/Random'
import { SpawnDirector, type SpawnDirectorState } from './SpawnDirector'
import { getEnemyDisplayLabel } from '../../rendering/PixiGame'

function directorState(time = 0): SpawnDirectorState {
  return {
    time,
    player: { x: 0, y: 0 },
    enemies: [],
  }
}

describe('elite enemy spawning and rewards', () => {
  it('assigns weighted elites through the seeded normal spawn path', () => {
    const balance = {
      ...SPAWN_BALANCE,
      eliteChance: 1,
      eliteStartTimeSeconds: 0,
      eliteModifierWeights: {
        hasted: 0,
        giant: 1,
        fiery: 0,
        electrocuting: 0,
        frigid: 0,
      },
    }
    const first = new SpawnDirector(new Random(11), balance).update(
      directorState(),
      1,
    )
    const second = new SpawnDirector(new Random(11), balance).update(
      directorState(),
      1,
    )

    expect(first).toEqual(second)
    expect(first[0]?.eliteModifier).toBe('giant')
  })

  it('applies exact Hasted and Giant stat and XP multipliers', () => {
    const game = createGame({ seed: 12 })
    game.spawnEnemy('slime', { x: 500, y: 0 })
    game.spawnEnemy('slime', { x: 600, y: 0 }, undefined, 'hasted')
    game.spawnEnemy('slime', { x: 700, y: 0 }, undefined, 'giant')

    const [normal, hasted, giant] = game.state.enemies
    expect(hasted?.speed).toBe(105)
    expect(hasted?.radius).toBe(18)
    expect(hasted?.maxHp).toBe(20)
    expect(hasted?.xpReward).toBe(6)
    expect(giant?.speed).toBe(60)
    expect(giant?.radius).toBe(27)
    expect(giant?.maxHp).toBe(40)
    expect(giant?.xpReward).toBe(8)
    expect(normal?.eliteModifier).toBeUndefined()
  })

  it('spawns elemental elite modifiers with their authored identities', () => {
    const game = createGame({ seed: 14 })
    game.spawnEnemy('slime', { x: 500, y: 0 }, undefined, 'fiery')
    game.spawnEnemy('slime', { x: 600, y: 0 }, undefined, 'electrocuting')
    game.spawnEnemy('slime', { x: 700, y: 0 }, undefined, 'frigid')

    expect(game.state.enemies.map((enemy) => enemy.eliteModifier)).toEqual([
      'fiery',
      'electrocuting',
      'frigid',
    ])
  })

  it('keeps Splitter children ordinary and preserves the authored child XP rule', () => {
    const game = createGame({ seed: 13 })
    const parentId = game.spawnEnemy('splitter', { x: 100, y: 0 }, undefined, 'giant')
    const parent = game.state.enemies.find((enemy) => enemy.id === parentId)
    if (!parent) {
      throw new Error('Expected giant splitter')
    }
    parent.hp = 0

    game.update(FIXED_STEP_SECONDS)

    expect(game.state.pickups.map((pickup) => pickup.xpAmount)).toContain(20)
    expect(game.state.enemies).toHaveLength(2)
    expect(game.state.enemies.every((enemy) => enemy.eliteModifier === undefined)).toBe(
      true,
    )
    expect(game.state.enemies.every((enemy) => enemy.xpReward === 0)).toBe(true)
  })

  it('multiplies elite gear chances without changing the force-drop guarantee', () => {
    expect(getGearDropChance('slime')).toBe(0.1)
    expect(getGearDropChance('slime', 'hasted')).toBeCloseTo(0.15)
    expect(getGearDropChance('slime', 'giant')).toBe(0.2)
  })

  it('projects deterministic readable labels for normal and elite enemies', () => {
    expect(getEnemyDisplayLabel('slime')).toBe('Slime')
    expect(getEnemyDisplayLabel('slime', 'hasted')).toBe('Slime · Hasted')
    expect(getEnemyDisplayLabel('brute', 'giant')).toBe('Brute · Giant')
  })
})
