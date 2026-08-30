import { describe, expect, it } from 'vitest'
import { createGame } from '../../Game'
import { collectSkillDamage } from '../skills/SkillSystem'
import {
  collectEnemyContactDamage,
} from '../combat/CombatSystem'
import {
  getSkeletonStats,
  removeDeadSummons,
  updateSummons,
} from './SummonSystem'
import { createEntityIdAllocator } from '../../ids'
import { applyUpgrade } from '../upgrades/UpgradeSystem'
import { getPlayerArenaBounds } from '../../../game-config/arena'
import {
  getFloorDifficultyProfile,
  getFloorStatMultiplier,
} from '../../../content/dungeons/Dungeons'

describe('updateSummons', () => {
  it('has the Necromancer starter skeleton attack the nearest in-range enemy deterministically', () => {
    const game = createGame({ seed: 11, playstyleId: 'necromancer' })
    const targetId = game.spawnSlime({ x: 40, y: 20 })

    const allocator = createEntityIdAllocator()
    collectSkillDamage(game.state, allocator)
    const events = updateSummons(game.state, 1 / 60, allocator)

    expect(game.state.summons).toHaveLength(1)
    expect(getSkeletonStats(game.state)?.maximum).toBe(1)
    expect(game.state.effects).toContainEqual(expect.objectContaining({
      skillId: 'raise-skeleton',
      shape: 'line',
    }))
    expect(events).toEqual([{
      sourceId: game.state.summons[0]!.id,
      targetId,
      damage: {
        physical: 6,
        lightning: 0,
        fire: 0,
        cold: 0,
        chaos: 0,
      },
      criticalStrike: {
        chance: 5,
        multiplier: 200,
      },
      sourceSkillId: 'raise-skeleton',
      sourceTags: ['physical', 'summon'],
    }])
  })

  it('respawns up to the upgraded maximum and scales skeleton stats by skill level', () => {
    const game = createGame({ seed: 12, playstyleId: 'necromancer' })
    const allocator = createEntityIdAllocator()
    applyUpgrade(game.state, 'raise-skeleton-level')
    applyUpgrade(game.state, 'raise-skeleton-max-count')
    const stats = getSkeletonStats(game.state)

    expect(stats).toMatchObject({
      damage: 6.48,
      maxHp: 35,
      maximum: 2,
      attackCooldown: 1,
      attackRange: 70,
    })
    collectSkillDamage(game.state, allocator)
    expect(game.state.summons).toHaveLength(1)
    const raiseSkeleton = game.state.player.skills.find(
      (skill) => skill.skillId === 'raise-skeleton',
    )!
    expect(raiseSkeleton.cooldownRemaining).toBe(5)

    raiseSkeleton.cooldownRemaining = 0
    collectSkillDamage(game.state, allocator)
    expect(game.state.summons).toHaveLength(2)
    game.state.summons[0]!.hp = 0
    removeDeadSummons(game.state)
    expect(game.state.summons).toHaveLength(1)
    raiseSkeleton.cooldownRemaining = 0
    collectSkillDamage(game.state, allocator)
    expect(game.state.summons).toHaveLength(2)
  })

  it('scales persistent skeleton durability with the ordinary enemy HP curve', () => {
    const game = createGame({ seed: 18, playstyleId: 'necromancer' })
    game.state.run.floor = 20

    const expectedMaxHp = 30 *
      getFloorStatMultiplier(20) *
      getFloorDifficultyProfile(20).ordinaryEnemyHpMultiplier

    expect(getSkeletonStats(game.state)?.maxHp).toBeCloseTo(expectedMaxHp)
  })

  it('does not emit a duplicate contact hit for a skeleton', () => {
    const game = createGame({ seed: 19, playstyleId: 'necromancer' })
    const allocator = createEntityIdAllocator()
    collectSkillDamage(game.state, allocator)
    const summon = game.state.summons[0]!
    summon.x = 50
    summon.y = 0
    game.spawnSlime({ x: 50, y: 0 })

    const contactEvents = collectEnemyContactDamage(game.state, 1 / 60)
    const summonEvents = updateSummons(game.state, 1 / 60, allocator)

    expect(contactEvents.filter((event) => event.targetId === summon.id))
      .toHaveLength(1)
    expect(summonEvents.filter((event) => event.targetId === summon.id))
      .toEqual([])
  })

  it('keeps one skeleton by default and only raises the cap through repeatable upgrades', () => {
    const game = createGame({ seed: 15, playstyleId: 'necromancer' })
    const allocator = createEntityIdAllocator()

    collectSkillDamage(game.state, allocator)
    expect(game.state.summons).toHaveLength(1)
    const raiseSkeleton = game.state.player.skills.find(
      (skill) => skill.skillId === 'raise-skeleton',
    )!
    raiseSkeleton.cooldownRemaining = 0
    collectSkillDamage(game.state, allocator)
    expect(game.state.summons).toHaveLength(1)
    game.state.summons[0]!.hp = 0
    raiseSkeleton.cooldownRemaining = 0
    collectSkillDamage(game.state, allocator)
    expect(game.state.summons).toHaveLength(2)
    removeDeadSummons(game.state)
    expect(game.state.summons).toHaveLength(1)

    applyUpgrade(game.state, 'raise-skeleton-max-count')
    applyUpgrade(game.state, 'raise-skeleton-max-count')
    expect(getSkeletonStats(game.state)?.maximum).toBe(3)
    raiseSkeleton.cooldownRemaining = 0
    collectSkillDamage(game.state, allocator)
    expect(game.state.summons).toHaveLength(2)
  })

  it('wanders around the player in distinct deterministic swarm paths without targets', () => {
    const game = createGame({ seed: 13, playstyleId: 'necromancer' })
    const allocator = createEntityIdAllocator()
    collectSkillDamage(game.state, allocator)
    const raiseSkeleton = game.state.player.skills.find(
      (skill) => skill.skillId === 'raise-skeleton',
    )!
    raiseSkeleton.cooldownRemaining = 0
    applyUpgrade(game.state, 'raise-skeleton-max-count')
    collectSkillDamage(game.state, allocator)

    const initialPositions = game.state.summons.map((summon) => ({
      x: summon.x,
      y: summon.y,
    }))
    updateSummons(game.state, 1, allocator)

    expect(game.state.summons).toHaveLength(2)
    expect(game.state.summons.map((summon) => [summon.x, summon.y])).not.toEqual(
      initialPositions.map((position) => [position.x, position.y]),
    )
    expect(
      Math.hypot(
        game.state.summons[0]!.x - game.state.summons[1]!.x,
        game.state.summons[0]!.y - game.state.summons[1]!.y,
      ),
    ).toBeGreaterThan(0)

    let stoodStill = false
    for (let tick = 0; tick < 480; tick += 1) {
      const previousPositions = game.state.summons.map((summon) => ({
        x: summon.x,
        y: summon.y,
      }))
      updateSummons(game.state, 1 / 60, allocator)
      if (game.state.summons.some((summon, index) =>
        summon.x === previousPositions[index]?.x &&
        summon.y === previousPositions[index]?.y
      )) {
        stoodStill = true
        break
      }
    }
    expect(stoodStill).toBe(true)
    expect(game.state.summons.every((summon) => {
      const distance = Math.hypot(summon.x, summon.y)
      return distance >= 30 && distance <= 65
    })).toBe(true)
  })

  it('charges an enemy detected outside attack range before attacking it', () => {
    const game = createGame({ seed: 14, playstyleId: 'necromancer' })
    const targetId = game.spawnSlime({ x: 240, y: 0 })
    const allocator = createEntityIdAllocator()
    collectSkillDamage(game.state, allocator)
    const summon = game.state.summons[0]!
    const initialDistance = Math.hypot(
      game.state.enemies[0]!.x - summon.x,
      game.state.enemies[0]!.y - summon.y,
    )

    const firstStepEvents = updateSummons(game.state, 1 / 60, allocator)
    const distanceAfterCharge = Math.hypot(
      game.state.enemies[0]!.x - summon.x,
      game.state.enemies[0]!.y - summon.y,
    )
    expect(firstStepEvents).toEqual([])
    expect(distanceAfterCharge).toBeLessThan(initialDistance)

    const attackEvents = Array.from({ length: 120 }, () =>
      updateSummons(game.state, 1 / 60, allocator),
    ).flat()
    expect(attackEvents.some((event) => event.targetId === targetId)).toBe(true)
  })

  it('charges an enemy within the expanded 560-unit aggro range', () => {
    const game = createGame({ seed: 16, playstyleId: 'necromancer' })
    const targetId = game.spawnSlime({ x: 500, y: 0 })
    const allocator = createEntityIdAllocator()
    collectSkillDamage(game.state, allocator)
    const summon = game.state.summons[0]!
    summon.x = 0
    summon.y = 0
    const initialDistance = Math.hypot(
      game.state.enemies[0]!.x - summon.x,
      game.state.enemies[0]!.y - summon.y,
    )

    const events = updateSummons(game.state, 1 / 60, allocator)
    const distanceAfterCharge = Math.hypot(
      game.state.enemies[0]!.x - summon.x,
      game.state.enemies[0]!.y - summon.y,
    )

    expect(targetId).toBe(game.state.enemies[0]!.id)
    expect(events).toEqual([])
    expect(distanceAfterCharge).toBeLessThan(initialDistance)
  })

  it('ignores enemies outside the play area and keeps summons inside it', () => {
    const game = createGame({ seed: 17, playstyleId: 'necromancer' })
    const outsideEnemyId = game.spawnSlime({ x: 1_501, y: 0 })
    const allocator = createEntityIdAllocator()
    collectSkillDamage(game.state, allocator)
    const summon = game.state.summons[0]!
    summon.x = 1_600
    summon.y = 0

    const events = updateSummons(game.state, 1 / 60, allocator)
    const bounds = getPlayerArenaBounds(16)

    expect(outsideEnemyId).toBe(game.state.enemies[0]!.id)
    expect(events).toEqual([])
    expect(summon.x).toBeLessThanOrEqual(bounds.maxX)
    expect(summon.x).toBeLessThan(1_600)
  })
})
