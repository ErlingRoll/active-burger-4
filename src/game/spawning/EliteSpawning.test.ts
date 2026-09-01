import { describe, expect, it } from 'vitest'
import { SPAWN_BALANCE } from '../../content/spawning/SpawnBalance'
import { getGearDropChance } from '../../content/gear/GearDrops'
import { resolveWorldModifierEffects } from '../../content/modifiers/WorldModifiers'
import { createGame, FIXED_STEP_SECONDS } from '../Game'
import { Random } from '../random/Random'
import { SpawnDirector, type SpawnDirectorState } from './SpawnDirector'
import {
  FLANKER_DEFINITION_ID,
  SLIME_DEFINITION_ID,
} from '../../content/enemies/EnemyConfig'
import {
  getEnemyDisplayLabel,
  getEnemyMeleeAttackAnimationProgress,
} from '../../rendering/PixiGame'

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
        poisoner: 0,
        flanking: 0,
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

  it('selects Poisoner through the weighted elite modifier path', () => {
    const balance = {
      ...SPAWN_BALANCE,
      eliteChance: 1,
      eliteStartTimeSeconds: 0,
      eliteModifierWeights: {
        hasted: 0,
        giant: 0,
        fiery: 0,
        electrocuting: 0,
        frigid: 0,
        poisoner: 1,
        flanking: 0,
      },
    }

    const [spawn] = new SpawnDirector(new Random(11), balance).update(
      directorState(),
      1,
    )

    expect(spawn?.eliteModifier).toBe('poisoner')
  })

  it('rolls one through the floor-specific maximum of distinct modifiers', () => {
    const balance = {
      ...SPAWN_BALANCE,
      eliteChance: 1,
      eliteStartTimeSeconds: 0,
      eliteModifierWeights: {
        hasted: 1,
        giant: 1,
        fiery: 1,
        electrocuting: 0,
        frigid: 0,
        poisoner: 0,
        flanking: 0,
      },
    }
    const minimumModifierCountRandom = {
      next: () => 0,
      int: (min: number) => min,
      chance: () => true,
      pick: <T>(items: readonly T[]) => items[0] as T,
    }
    const maximumModifierCountRandom = {
      ...minimumModifierCountRandom,
      int: (_min: number, max: number) => max,
    }

    const [early] = new SpawnDirector(minimumModifierCountRandom, balance).update(
      { ...directorState(), run: { floor: 1 } },
      1,
    )
    const [floorTen] = new SpawnDirector(maximumModifierCountRandom, balance).update(
      { ...directorState(), run: { floor: 10 } },
      1,
    )
    const [floorTwenty] = new SpawnDirector(
      maximumModifierCountRandom,
      balance,
    ).update(
      { ...directorState(), run: { floor: 20 } },
      1,
    )

    expect(early?.eliteModifiers).toEqual(['hasted'])
    expect(floorTen?.eliteModifiers).toEqual(['hasted', 'giant'])
    expect(floorTwenty?.eliteModifiers).toEqual(['hasted', 'giant', 'fiery'])
    expect(new Set(floorTwenty?.eliteModifiers ?? []).size).toBe(3)

    const [minimumAtFloorTwenty] = new SpawnDirector(
      minimumModifierCountRandom,
      balance,
    ).update(
      { ...directorState(), run: { floor: 20 } },
      1,
    )
    expect(minimumAtFloorTwenty?.eliteModifiers).toEqual(['hasted'])
  })

  it('honors the Elite Triad world modifier above the floor modifier cap', () => {
    const balance = {
      ...SPAWN_BALANCE,
      eliteChance: 1,
      eliteStartTimeSeconds: 0,
      eliteModifierWeights: {
        hasted: 1,
        giant: 1,
        fiery: 1,
        electrocuting: 0,
        frigid: 0,
        poisoner: 0,
        flanking: 0,
      },
    }
    const eliteTriadBalance = resolveWorldModifierEffects(
      ['elite-triad'],
      balance,
    ).spawnBalance
    const random = {
      next: () => 0,
      int: (min: number) => min,
      chance: () => true,
      pick: <T>(items: readonly T[]) => items[0] as T,
    }

    const [spawn] = new SpawnDirector(random, eliteTriadBalance).update(
      { ...directorState(), run: { floor: 1 } },
      1,
    )

    expect(spawn?.eliteModifiers).toEqual(['hasted', 'giant', 'fiery'])
  })

  it('assigns Flanking to ordinary enemies but not to Flanker enemies', () => {
    const weights = {
      hasted: 0,
      giant: 0,
      fiery: 0,
      electrocuting: 0,
      frigid: 0,
      poisoner: 0,
      flanking: 1,
    }
    const ordinaryBalance = {
      ...SPAWN_BALANCE,
      spawnEntries: [{
        definitionId: SLIME_DEFINITION_ID,
        threatCost: 1,
        weight: 1,
      }],
      eliteChance: 1,
      eliteStartTimeSeconds: 0,
      eliteModifierWeights: weights,
    }
    const flankerBalance = {
      ...ordinaryBalance,
      spawnEntries: [{
        definitionId: FLANKER_DEFINITION_ID,
        threatCost: 1,
        weight: 1,
      }],
    }

    const [ordinarySpawn] = new SpawnDirector(
      new Random(11),
      ordinaryBalance,
    ).update(directorState(), 1)
    const [flankerSpawn] = new SpawnDirector(
      new Random(11),
      flankerBalance,
    ).update(directorState(), 1)

    expect(ordinarySpawn?.eliteModifier).toBe('flanking')
    expect(flankerSpawn?.eliteModifier).toBeUndefined()
  })

  it('does not combine Hasted and Berserking even when they are the only choices', () => {
    const balance = {
      ...SPAWN_BALANCE,
      eliteChance: 1,
      eliteStartTimeSeconds: 0,
      eliteModifierWeights: {
        hasted: 1,
        berserking: 1,
      },
    }
    const random = {
      next: () => 0,
      int: (_min: number, max: number) => max,
      chance: () => true,
      pick: <T>(items: readonly T[]) => items[0] as T,
    }

    const [spawn] = new SpawnDirector(random, balance).update(
      { ...directorState(), run: { floor: 20 } },
      1,
    )

    expect(spawn?.eliteModifiers).toEqual(['hasted'])
  })

  it('applies exact Hasted and Giant stat and XP multipliers', () => {
    const game = createGame({ seed: 12 })
    game.spawnEnemy('slime', { x: 500, y: 0 })
    game.spawnEnemy('slime', { x: 600, y: 0 }, undefined, 'hasted')
    game.spawnEnemy('slime', { x: 700, y: 0 }, undefined, 'giant')

    const [normal, hasted, giant] = game.state.enemies
    expect(hasted?.speed).toBeCloseTo(149.625)
    expect(hasted?.radius).toBe(18)
    expect(hasted?.maxHp).toBe(50)
    expect(hasted?.xpReward).toBe(6)
    expect(giant?.speed).toBeCloseTo(86.4)
    expect(giant?.radius).toBe(27)
    expect(giant?.maxHp).toBe(100)
    expect(giant?.xpReward).toBe(8)
    expect(normal?.eliteModifier).toBeUndefined()
  })

  it('applies each distinct stacked modifier exactly once', () => {
    const game = createGame({ seed: 12 })
    game.spawnEnemy(
      'slime',
      { x: 500, y: 0 },
      undefined,
      ['hasted', 'giant', 'hasted', 'fiery'],
    )

    const elite = game.state.enemies[0]
    expect(elite?.eliteModifier).toBe('hasted')
    expect(elite?.eliteModifiers).toEqual(['hasted', 'giant', 'fiery'])
    expect(elite?.radius).toBe(27)
    expect(elite?.maxHp).toBe(100)
    expect(elite?.xpReward).toBe(12)
    expect(getGearDropChance('slime', elite?.eliteModifiers)).toBeCloseTo(0.21)
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
    expect(getGearDropChance('slime')).toBe(0.07)
    expect(getGearDropChance('slime', 'hasted')).toBeCloseTo(0.105)
    expect(getGearDropChance('slime', 'giant')).toBeCloseTo(0.14)
  })

  it('projects deterministic readable labels for normal and elite enemies', () => {
    expect(getEnemyDisplayLabel('slime')).toBe('Slime')
    expect(getEnemyDisplayLabel('slime', 'hasted')).toBe('Slime · Hasted')
    expect(getEnemyDisplayLabel('brute', 'giant')).toBe('Brute · Giant')
    expect(getEnemyDisplayLabel('slime', 'flanking')).toBe('Slime · Flanking')
    expect(getEnemyDisplayLabel('slime', ['hasted', 'giant'])).toBe(
      'Slime · Hasted / Giant',
    )
  })

  it('projects a short melee attack animation window from the attack timestamp', () => {
    expect(getEnemyMeleeAttackAnimationProgress(10)).toBe(0)
    expect(getEnemyMeleeAttackAnimationProgress(10.14, 10)).toBeCloseTo(0.5)
    expect(getEnemyMeleeAttackAnimationProgress(10.3, 10)).toBe(0)
    expect(getEnemyMeleeAttackAnimationProgress(9.9, 10)).toBe(0)
  })
})
