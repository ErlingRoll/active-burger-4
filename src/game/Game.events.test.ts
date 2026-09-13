import { describe, expect, it } from 'vitest'
import { createGame, createGameFromCheckpoint, FIXED_STEP_SECONDS } from './Game'
import type { GameEvent, GameEventType } from './events/GameEvents'
import { xpRequiredForLevel } from '../content/progression/XpBalance'
import { getUpgradeDefinition } from '../content/upgrades/Upgrades'

function types(events: readonly GameEvent[]): GameEventType[] {
  return events.map((event) => event.type)
}

function runTicks(game: ReturnType<typeof createGame>, ticks: number): GameEvent[] {
  const events: GameEvent[] = []
  for (let tick = 0; tick < ticks; tick += 1) {
    game.update(FIXED_STEP_SECONDS)
    events.push(...game.drainEvents())
  }
  return events
}

describe('game events', () => {
  it('reports the run start as its first event and drains only once', () => {
    const game = createGame({ seed: 20260901 })

    expect(game.drainEvents()).toEqual([
      { type: 'phase-changed', from: 'loading', to: 'playing' },
    ])
    expect(game.drainEvents()).toEqual([])
  })

  it('reports attacks, hits, deaths, pickups and the level-up choice', () => {
    const game = createGame({ seed: 20260826, freeMovementEnabled: false })
    game.drainEvents()
    game.spawnSlime({ x: 0, y: 0 })
    game.spawnSlime({ x: 0, y: 0 })
    game.spawnXpPickup({ x: 0, y: 0 }, 10)

    const events: GameEvent[] = []
    for (let step = 0; step < 180; step += 1) {
      game.update(FIXED_STEP_SECONDS)
      events.push(...game.drainEvents())
      if (game.phase === 'level-up') {
        const choice = game.getPendingUpgradeChoices()[0]
        if (!choice) {
          throw new Error('Expected a choice during the scenario')
        }
        game.selectUpgrade(choice)
        events.push(...game.drainEvents())
      }
    }

    const seen = new Set(types(events))
    expect(seen).toContain('basic-attack-fired')
    expect(seen).toContain('enemy-hit')
    expect(seen).toContain('enemy-died')
    expect(seen).toContain('pickup-collected')
    expect(seen).toContain('level-up')
    expect(seen).toContain('choice-flow-opened')
    expect(seen).toContain('choice-selected')
    expect(events).toContainEqual({ type: 'phase-changed', from: 'playing', to: 'level-up' })
    expect(events).toContainEqual({ type: 'phase-changed', from: 'level-up', to: 'playing' })
    const basicHits = events.filter((event) =>
      event.type === 'enemy-hit' && event.sourceSkillId === 'basic-attack',
    )
    expect(basicHits.length).toBeGreaterThan(0)
    expect(basicHits.every((hit) => hit.type === 'enemy-hit' && hit.weapon !== undefined))
      .toBe(true)
  })

  it('never reports a damage-over-time tick as an enemy hit', () => {
    const game = createGame({ seed: 20260902 })
    game.drainEvents()
    game.spawnSlime({ x: 0, y: 0 })
    const slime = game.state.enemies[0]
    if (!slime) {
      throw new Error('Expected a slime')
    }
    slime.burningStacks = [{ remainingDuration: 5, damagePerSecond: 1 }]
    game.state.player.attackCooldownRemaining = 100
    for (const skill of game.state.player.skills) {
      skill.cooldownRemaining = 100
    }

    const events = runTicks(game, 10)

    expect(types(events)).not.toContain('enemy-hit')
  })

  it('reports pause and resume as phase changes', () => {
    const game = createGame({ seed: 20260903 })
    game.drainEvents()

    game.pause()
    game.resume()

    expect(game.drainEvents()).toEqual([
      { type: 'phase-changed', from: 'playing', to: 'paused' },
      { type: 'phase-changed', from: 'paused', to: 'playing' },
    ])
  })

  it('reports reroll, banish, and skip on the level-up choice', () => {
    const game = createGame({ seed: 459, startingLevel: 2, banishCount: 2, rerollCount: 2 })
    game.drainEvents()
    const flow = game.getPendingChoiceFlow()
    if (flow?.type !== 'level-up') {
      throw new Error('Expected a level-up choice')
    }
    const unlock = flow.choices.find((choice) =>
      getUpgradeDefinition(choice.upgradeId).skillAction === 'unlock',
    )
    if (!unlock) {
      throw new Error('Expected a skill unlock offer')
    }

    expect(game.rerollActiveChoice()).toBe(true)
    expect(game.banishActiveChoice(
      game.getPendingUpgradeChoices().find((choice) =>
        getUpgradeDefinition(choice.upgradeId).skillAction === 'unlock',
      ) ?? unlock,
    )).toBe(true)
    expect(game.skipChoice()).toBe(true)

    expect(types(game.drainEvents())).toEqual([
      'choice-rerolled',
      'choice-banished',
      'choice-skipped',
      'phase-changed',
    ])
  })

  it('reports the stairs, the descent, and the arrival on the next floor', () => {
    const game = createGame({ seed: 20260832 })
    game.drainEvents()
    game.state.player.hp = game.state.player.maxHp / 2

    game.spawnStairs({ x: 0, y: 0 })
    expect(game.drainEvents()).toEqual([{ type: 'stairs-spawned', final: false }])

    game.update(FIXED_STEP_SECONDS)
    const descent = game.drainEvents()
    expect(types(descent)).toContain('stairs-reached')
    expect(descent).toContainEqual({
      type: 'phase-changed', from: 'playing', to: 'floor-transition',
    })
    // The new-floor heal is reported so the listener can decide to ignore it.
    expect(types(descent)).toContain('player-healed')

    expect(game.completeFloorSave()).toBe(true)
    game.update(FIXED_STEP_SECONDS)
    expect(game.drainEvents()).toContainEqual({
      type: 'phase-changed', from: 'floor-transition', to: 'playing',
    })
  })

  it('reports a boss spawning, telegraphing, striking, and dying', () => {
    const game = createGame({ seed: 20260830 })
    game.drainEvents()
    const bossId = game.spawnBoss('stone-golem', { x: 60, y: 0 })
    expect(game.drainEvents()).toEqual([{ type: 'boss-spawned', bossId: 'stone-golem' }])
    game.state.player.attackCooldownRemaining = 1_000

    const events = runTicks(game, 240)
    expect(events).toContainEqual({
      type: 'boss-telegraph', bossId: 'stone-golem', skillId: expect.any(String),
    })
    expect(types(events)).toContain('boss-impact')

    const boss = game.state.bosses?.find((candidate) => candidate.id === bossId)
    if (!boss) {
      throw new Error('Expected the boss to be alive')
    }
    boss.hp = 0
    boss.xpReward = 0
    game.update(FIXED_STEP_SECONDS)
    expect(game.drainEvents()).toContainEqual({
      type: 'boss-died', bossId: 'stone-golem', final: false,
    })
  })

  it('reports the player being hurt with the damage element', () => {
    const game = createGame({ seed: 20260904 })
    game.drainEvents()
    game.state.player.x = 0
    game.state.player.y = 0
    game.spawnSlime({ x: 0, y: 0 })
    game.state.player.attackCooldownRemaining = 1_000

    const events = runTicks(game, 120)

    const hurt = events.find((event) => event.type === 'player-damaged')
    expect(hurt).toBeDefined()
    expect(hurt).toMatchObject({ damageOverTime: false })
    expect(hurt && hurt.type === 'player-damaged' ? hurt.hpFraction : 0).toBeLessThan(1)
  })

  it('reports XP collection and the level gained before the choice opens', () => {
    const game = createGame({ seed: 20260905 })
    game.drainEvents()
    game.spawnXpPickup({ x: 0, y: 0 }, xpRequiredForLevel(2))

    game.update(FIXED_STEP_SECONDS)

    const events = game.drainEvents()
    expect(types(events)).toEqual(
      expect.arrayContaining(['pickup-collected', 'level-up', 'phase-changed', 'choice-flow-opened']),
    )
    expect(types(events).indexOf('pickup-collected')).toBeLessThan(types(events).indexOf('level-up'))
    expect(events).toContainEqual({ type: 'level-up', level: 2 })
  })

  it('is deterministic for a seed', () => {
    const play = (): GameEvent[] => {
      const game = createGame({ seed: 20260906, freeMovementEnabled: false })
      game.spawnSlime({ x: 0, y: 0 })
      game.spawnSlime({ x: 20, y: 0 })
      return [...game.drainEvents(), ...runTicks(game, 120)]
    }

    expect(play()).toEqual(play())
  })

  it('does not replay the run start when continuing from a checkpoint', () => {
    const game = createGame({ seed: 20260907 })
    game.update(FIXED_STEP_SECONDS)
    const checkpoint = game.createCheckpoint()

    const restored = createGameFromCheckpoint(checkpoint)

    expect(restored.drainEvents()).toEqual([])
    expect(restored.state).toEqual(game.state)
    restored.pause()
    expect(restored.drainEvents()).toEqual([
      { type: 'phase-changed', from: 'playing', to: 'paused' },
    ])
  })

  it('keeps events out of checkpoints', () => {
    const game = createGame({ seed: 20260908 })
    game.spawnSlime({ x: 0, y: 0 })
    game.update(FIXED_STEP_SECONDS)

    const checkpoint = game.createCheckpoint()

    expect(JSON.stringify(checkpoint)).not.toContain('phase-changed')
  })
})
