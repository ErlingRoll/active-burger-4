import { describe, expect, it } from 'vitest'
import {
  ARCHER_DEFINITION_ID,
  BRUTE_DEFINITION_ID,
  FLANKER_DEFINITION_ID,
  RUNNER_DEFINITION_ID,
  SLIME_DEFINITION_ID,
  SPLITTER_DEFINITION_ID,
} from '../../../content/enemies/EnemyConfig'
import { FIXED_STEP_SECONDS, createGame } from '../../Game'
import { collectEnemyContactDamage, updateEnemyChase } from './CombatSystem'
import {
  getEnemyCombatTarget,
  getEnemyInterceptPoint,
} from './EnemyBehaviors'
import { collectSkillDamage } from '../skills/SkillSystem'
import { createEntityIdAllocator } from '../../ids'
import { getDerivedPlayerStats } from '../../stats/DerivedStats'

describe('enemy variety behaviors', () => {
  it('makes Runner faster and less durable than Brute', () => {
    const game = createGame({ seed: 101 })
    game.spawnEnemy(RUNNER_DEFINITION_ID, { x: 200, y: 0 })
    game.spawnEnemy(BRUTE_DEFINITION_ID, { x: 200, y: 0 })

    game.update(FIXED_STEP_SECONDS)

    const runner = game.state.enemies.find(
      (enemy) => enemy.definitionId === RUNNER_DEFINITION_ID,
    )
    const brute = game.state.enemies.find(
      (enemy) => enemy.definitionId === BRUTE_DEFINITION_ID,
    )
    if (!runner || !brute) {
      throw new Error('Expected Runner and Brute to survive the setup tick')
    }
    expect(runner.speed).toBeGreaterThan(brute.speed)
    expect(runner.maxHp).toBeLessThan(brute.maxHp)
    expect(runner.x).toBeLessThan(brute.x)
  })

  it('accelerates ordinary enemies after their grace period', () => {
    const game = createGame({ seed: 105 })
    const enemyId = game.spawnEnemy(SLIME_DEFINITION_ID, { x: 1_000, y: 0 })
    const enemy = game.state.enemies.find((candidate) => candidate.id === enemyId)
    if (!enemy) {
      throw new Error('Expected slime to exist')
    }
    const baseSpeed = enemy.speed

    enemy.spawnTime = -10
    updateEnemyChase(game.state, FIXED_STEP_SECONDS)
    const gracePeriodX = enemy.x

    enemy.spawnTime = -55
    updateEnemyChase(game.state, FIXED_STEP_SECONDS)
    const midpointX = enemy.x

    enemy.spawnTime = -110
    updateEnemyChase(game.state, FIXED_STEP_SECONDS)
    const cappedX = enemy.x

    expect(gracePeriodX).toBeCloseTo(1_000 - baseSpeed * FIXED_STEP_SECONDS)
    expect(gracePeriodX - midpointX).toBeCloseTo(baseSpeed * 3.25 * FIXED_STEP_SECONDS)
    expect(midpointX - cappedX).toBeCloseTo(baseSpeed * 4 * FIXED_STEP_SECONDS)
  })

  it('separates colocated enemies deterministically while they chase', () => {
    const run = () => {
      const game = createGame({ seed: 106 })
      const firstId = game.spawnEnemy(SLIME_DEFINITION_ID, { x: 200, y: 0 })
      const secondId = game.spawnEnemy(SLIME_DEFINITION_ID, { x: 200, y: 0 })

      updateEnemyChase(game.state, FIXED_STEP_SECONDS)

      const first = game.state.enemies.find((enemy) => enemy.id === firstId)
      const second = game.state.enemies.find((enemy) => enemy.id === secondId)
      if (!first || !second) {
        throw new Error('Expected colocated enemies to exist')
      }
      return {
        first: { x: first.x, y: first.y },
        second: { x: second.x, y: second.y },
      }
    }

    const firstRun = run()
    expect(firstRun.first).not.toEqual(firstRun.second)
    expect(firstRun).toEqual(run())
  })

  it('lets a Flanker move toward a predicted lateral escape point', () => {
    const game = createGame({ seed: 107 })
    const flankerId = game.spawnEnemy(
      FLANKER_DEFINITION_ID,
      { x: 300, y: 0 },
    )
    game.state.player.movementVelocityX = 100

    updateEnemyChase(game.state, FIXED_STEP_SECONDS)

    const flanker = game.state.enemies.find((enemy) => enemy.id === flankerId)
    if (!flanker) {
      throw new Error('Expected Flanker to exist')
    }
    expect(flanker.targetId).toBe(game.state.player.id)
    expect(flanker.x).toBeLessThan(300)
    expect(flanker.y).not.toBe(0)
  })

  it('lets a Flanking elite use the Flanker intercept behavior', () => {
    const game = createGame({ seed: 108 })
    const flankingId = game.spawnEnemy(
      SLIME_DEFINITION_ID,
      { x: 300, y: 0 },
      undefined,
      'flanking',
    )
    game.state.player.movementVelocityX = 100

    updateEnemyChase(game.state, FIXED_STEP_SECONDS)

    const flanking = game.state.enemies.find((enemy) => enemy.id === flankingId)
    if (!flanking) {
      throw new Error('Expected Flanking elite to exist')
    }
    expect(flanking.eliteModifier).toBe('flanking')
    expect(flanking.targetId).toBe(game.state.player.id)
    expect(flanking.x).toBeLessThan(300)
    expect(flanking.y).not.toBe(0)
  })

  it('uses regular chase movement during Flanker re-engagement cooldowns', () => {
    const simulate = (
      definitionId: typeof FLANKER_DEFINITION_ID | typeof SLIME_DEFINITION_ID,
      eliteModifier?: 'flanking',
    ) => {
      const game = createGame({ seed: 110 })
      const flankerId = game.spawnEnemy(
        definitionId,
        { x: 300, y: 0 },
        undefined,
        eliteModifier,
      )
      game.state.player.movementVelocityX = 100
      let observedCooldown = false
      let observedRegularMovement = false

      for (let tick = 0; tick < 480; tick += 1) {
        const enemyBefore = game.state.enemies.find((enemy) => enemy.id === flankerId)
        const distanceBefore = enemyBefore
          ? Math.hypot(enemyBefore.x - game.state.player.x, enemyBefore.y - game.state.player.y)
          : Number.POSITIVE_INFINITY
        updateEnemyChase(game.state, FIXED_STEP_SECONDS)
        const flanker = game.state.enemies.find((enemy) => enemy.id === flankerId)
        if (flanker && (flanker.interceptCooldownRemaining ?? 0) > 0) {
          observedCooldown = true
          const distanceAfter = Math.hypot(
            flanker.x - game.state.player.x,
            flanker.y - game.state.player.y,
          )
          if (distanceAfter < distanceBefore) {
            observedRegularMovement = true
          }
        }
      }

      return { observedCooldown, observedRegularMovement }
    }

    expect(simulate(FLANKER_DEFINITION_ID)).toEqual({
      observedCooldown: true,
      observedRegularMovement: true,
    })
    expect(simulate(SLIME_DEFINITION_ID, 'flanking')).toEqual({
      observedCooldown: true,
      observedRegularMovement: true,
    })
  })

  it('only predicts an intercept destination while a Flanker is actively intercepting', () => {
    const game = createGame({ seed: 111 })
    const flankerId = game.spawnEnemy(
      FLANKER_DEFINITION_ID,
      { x: 300, y: 0 },
    )
    const flanker = game.state.enemies.find((enemy) => enemy.id === flankerId)
    if (!flanker) {
      throw new Error('Expected Flanker to exist')
    }

    const target = getEnemyCombatTarget(game.state, flanker)
    const activeIntercept = getEnemyInterceptPoint(flanker, target, 100, 0)
    expect(activeIntercept).toEqual({
      x: 100,
      y: flanker.id % 2 === 0 ? 90 : -90,
    })

    flanker.interceptCooldownRemaining = 1
    expect(getEnemyInterceptPoint(flanker, target, 100, 0)).toBeUndefined()
  })

  it('does not apply Flanking to a Flanker enemy', () => {
    const game = createGame({ seed: 109 })
    game.spawnEnemy(
      FLANKER_DEFINITION_ID,
      { x: 300, y: 0 },
      undefined,
      'flanking',
    )

    expect(game.state.enemies[0]?.eliteModifier).toBeUndefined()
  })

  it('keeps Archer outside contact while remaining in player targeting range', () => {
    const game = createGame({ seed: 102 })
    const archerId = game.spawnEnemy(ARCHER_DEFINITION_ID, { x: 100, y: 0 })
    const archer = game.state.enemies.find((enemy) => enemy.id === archerId)
    if (!archer) {
      throw new Error('Expected archer to exist')
    }
    archer.hp = 1_000
    archer.maxHp = 1_000

    for (let tick = 0; tick < 70; tick += 1) {
      game.update(FIXED_STEP_SECONDS)
    }

    const currentArcher = game.state.enemies.find(
      (enemy) => enemy.definitionId === ARCHER_DEFINITION_ID,
    )
    expect(currentArcher).toBeDefined()
    if (!currentArcher) {
      return
    }
    const archerDistance = Math.hypot(
      currentArcher.x - game.state.player.x,
      currentArcher.y - game.state.player.y,
    )
    expect(archerDistance).toBeGreaterThan(
      game.state.player.radius + currentArcher.radius,
    )
    expect(archerDistance).toBeLessThanOrEqual(
      getDerivedPlayerStats(game.state.player).attackRange,
    )
    expect(game.state.player.targetId).toBe(currentArcher.id)
  })

  it('prioritizes a closer living skeleton over the player', () => {
    const game = createGame({ seed: 104, characterClassId: 'necromancer' })
    const allocator = createEntityIdAllocator()
    collectSkillDamage(game.state, allocator)
    const summon = game.state.summons[0]
    if (!summon) {
      throw new Error('Expected a skeleton to exist')
    }
    const enemyId = game.spawnSlime({ x: 100, y: 0 })
    summon.x = 90
    summon.y = 0

    updateEnemyChase(game.state, FIXED_STEP_SECONDS)

    const enemy = game.state.enemies.find((candidate) => candidate.id === enemyId)
    expect(enemy?.targetId).toBe(summon.id)
    expect(collectEnemyContactDamage(game.state, FIXED_STEP_SECONDS)).toEqual([
      expect.objectContaining({
        sourceId: enemyId,
        targetId: summon.id,
      }),
    ])
  })

  it('splits once into stable, non-XP-awarding children', () => {
    const run = () => {
      const game = createGame({ seed: 103 })
      const parentId = game.spawnEnemy(SPLITTER_DEFINITION_ID, { x: 100, y: 50 })
      const parent = game.state.enemies.find((enemy) => enemy.id === parentId)
      if (!parent) {
        throw new Error('Expected splitter to exist')
      }
      parent.hp = 0
      game.update(FIXED_STEP_SECONDS)
      return {
        enemies: game.state.enemies.map((enemy) => ({
          id: enemy.id,
          definitionId: enemy.definitionId,
          x: enemy.x,
          y: enemy.y,
          xpReward: enemy.xpReward,
          canDropLoot: enemy.canDropLoot,
        })),
        pickups: game.state.pickups.map((pickup) => pickup.xpAmount),
        kills: game.state.run.killCount,
      }
    }

    const first = run()
    expect(first).toEqual(run())
    expect(first.kills).toBe(1)
    expect(first.pickups).toEqual([10])
    expect(first.enemies).toHaveLength(2)
    expect(first.enemies.map((enemy) => enemy.id)).toEqual([4, 5])
    expect(first.enemies.every((enemy) => enemy.definitionId === 'slime')).toBe(true)
    expect(first.enemies.every((enemy) => enemy.xpReward === 0)).toBe(true)
    expect(first.enemies.every((enemy) => enemy.canDropLoot === false)).toBe(true)
  })
})
