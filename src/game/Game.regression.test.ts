import { describe, expect, it } from 'vitest'
import { SPAWN_BALANCE } from '../content/spawning/SpawnBalance'
import { createGame, FIXED_STEP_SECONDS } from './Game'

function round(value: number): number {
  return Number(value.toFixed(6))
}

function projectScenario(game: ReturnType<typeof createGame>) {
  return {
    phase: game.phase,
    tick: game.state.tick,
    time: round(game.state.time),
    player: {
      id: game.state.player.id,
      x: game.state.player.x,
      y: game.state.player.y,
      hp: game.state.player.hp,
      maxHp: game.state.player.maxHp,
      level: game.state.player.level,
      xp: game.state.player.xp,
      attackDamage: game.state.player.attackDamage,
      attackSpeed: round(game.state.player.attackSpeed),
      movementSpeed: game.state.player.movementSpeed,
      attackRange: game.state.player.attackRange,
    },
    kills: game.state.run.killCount,
    enemies: game.state.enemies.map((enemy) => ({
      id: enemy.id,
      definitionId: enemy.definitionId,
      hp: enemy.hp,
      x: round(enemy.x),
      y: round(enemy.y),
    })),
    projectiles: game.state.projectiles.map((projectile) => ({
      id: projectile.id,
      definitionId: projectile.definitionId,
      x: round(projectile.x),
      y: round(projectile.y),
    })),
    pickups: game.state.pickups.map((pickup) => ({
      id: pickup.id,
      xpAmount: pickup.xpAmount,
      x: round(pickup.x),
      y: round(pickup.y),
    })),
  }
}

describe('headless deterministic scenario regression', () => {
  it('keeps the reviewed projection stable for a seeded run', () => {
    const game = createGame({ seed: 20260826 })
    // Two contact-range enemies exercise targeting, projectile collision,
    // cleanup, XP collection, and the level-up action. Three seconds then
    // crosses several spawn-budget boundaries, exercising seeded spawn
    // selection, ring placement, and fixed-order enemy movement.
    game.spawnSlime({ x: 0, y: 0 })
    game.spawnSlime({ x: 0, y: 0 })
    game.spawnXpPickup({ x: 0, y: 0 }, 10)

    for (let step = 0; step < 180; step += 1) {
      game.update(FIXED_STEP_SECONDS)
      if (game.phase === 'level-up') {
        const choice = game.getPendingUpgradeChoices()[0]
        if (!choice) {
          throw new Error('Expected a choice during the deterministic scenario')
        }
        game.selectUpgrade(choice)
      }
    }

    // This is a reviewed projection, rather than a "run twice and compare"
    // assertion. Update it when an intentional gameplay change alters the
    // seed, setup, action sequence, or any expected outcome below.
    expect(projectScenario(game)).toEqual({
      phase: 'playing',
      tick: 180,
      time: 3,
      player: {
        id: 1,
        x: 110.07134578515733,
        y: -219.4815462054514,
        hp: 144,
        maxHp: 160,
        level: 2,
        xp: 18,
        attackDamage: 14,
        attackSpeed: 1,
        movementSpeed: 135,
        attackRange: 45,
      },
      kills: 2,
      enemies: [
        {
          id: 10,
          definitionId: 'slime',
          hp: 12,
          x: 155.51759,
          y: -287.387423,
        },
        {
          id: 11,
          definitionId: 'slime',
          hp: 20,
          x: -88.346817,
          y: -568.709613,
        },
        {
          id: 13,
          definitionId: 'slime',
          hp: 20,
          x: 404.459541,
          y: -665.926961,
        },
      ],
      projectiles: [],
      pickups: [],
    })
  })

  it('does not introduce composition entries before their scheduled gates', () => {
    const game = createGame({ seed: 20260826 })
    const firstSpawnTimes = new Map<string, number>()

    for (let step = 1; step <= 120 * 60; step += 1) {
      game.update(FIXED_STEP_SECONDS)
      while (game.phase === 'level-up') {
        const choice = game.getPendingChoices()[0]
        if (!choice || !game.selectChoice(choice)) {
          throw new Error('Expected a selectable choice during the run')
        }
      }

      for (const enemy of game.state.enemies) {
        firstSpawnTimes.set(
          enemy.definitionId,
          firstSpawnTimes.get(enemy.definitionId) ?? game.state.time,
        )
      }
    }

    expect(firstSpawnTimes.get('slime')).toBeDefined()
    for (const [definitionId, firstSpawnTime] of firstSpawnTimes) {
      const entry = SPAWN_BALANCE.spawnEntries.find(
        (candidate) => candidate.definitionId === definitionId,
      )
      if (!entry) {
        throw new Error(`Unknown spawned enemy definition: ${definitionId}`)
      }
      const startTimeSeconds =
        'startTimeSeconds' in entry ? entry.startTimeSeconds : 0
      expect(firstSpawnTime).toBeGreaterThanOrEqual(startTimeSeconds)
    }
  })
})
