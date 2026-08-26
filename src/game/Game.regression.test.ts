import { describe, expect, it } from 'vitest'
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
        x: 0,
        y: 0,
        hp: 100,
        maxHp: 100,
        level: 2,
        xp: 15,
        attackDamage: 12,
        attackSpeed: 1,
        movementSpeed: 200,
        attackRange: 50,
      },
      kills: 1,
      enemies: [
        { id: 3, definitionId: 'slime', hp: 8, x: 0, y: 0 },
        {
          id: 6,
          definitionId: 'slime',
          hp: 20,
          x: 374.774745,
          y: 223.181956,
        },
        {
          id: 9,
          definitionId: 'slime',
          hp: 20,
          x: -126.826889,
          y: 452.305269,
        },
        {
          id: 11,
          definitionId: 'slime',
          hp: 20,
          x: -32.341526,
          y: -559.727279,
        },
      ],
      projectiles: [],
      pickups: [],
    })
  })
})
