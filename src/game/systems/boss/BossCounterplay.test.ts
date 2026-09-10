import { describe, expect, it } from 'vitest'
import { createEntityIdAllocator } from '../../ids'
import { createInitialPlayerState, spawnBoss } from '../spawning/SpawningSystem'
import { updateBosses } from './BossSystem'
import { updatePlayerDodge } from '../movement/DodgeSystem'
import { isPointInTelegraph } from '../../geometry/TelegraphGeometry'
import {
  BOSS_DEFINITION_IDS,
  getBossDefinition,
  getBossSkillDefinition,
  type BossDefinitionId,
  type BossSkillId,
} from '../../../content/bosses/Bosses'
import { getEffectivePlayerMovementSpeed } from '../../stats/DerivedStats'
import type { GameState } from '../../state/GameState'

/**
 * Every boss attack has to be survivable by moving.
 *
 * "Telegraphed" is not the same as "avoidable": a warning is only counterplay
 * if the way out is inside the distance the character can cover before it
 * lands. This runs the real cast and the real autonomous Dodge, at a level-one
 * character's speed with no upgrades, and checks that the attack misses. An
 * attack whose radius grows, or whose warning shortens, fails here rather than
 * silently becoming unavoidable damage.
 */

const STEP = 1 / 60

/**
 * The slowest character in the roster, so an attack that only the quick ones
 * escape fails here.
 */
const SLOWEST_CLASS_SPEED = 150

function createState(bossId: BossDefinitionId, playerX: number, playerY: number): GameState {
  const state: GameState = {
    run: {
      phase: 'playing',
      seed: 42,
      floor: 1,
      killCount: 0,
      selectedUpgradeIds: [],
    },
    player: createInitialPlayerState(1),
    enemies: [],
    bosses: [],
    projectiles: [],
    pickups: [],
    summons: [],
    effects: [],
    telegraphs: [],
    time: 0,
    tick: 0,
    paused: false,
  }
  state.player.x = playerX
  state.player.y = playerY
  state.player.movementSpeed = SLOWEST_CLASS_SPEED
  state.player.baseStats = {
    ...(state.player.baseStats ?? {
      maxHp: state.player.maxHp,
      attackDamage: state.player.attackDamage,
      attackSpeed: state.player.attackSpeed,
      resonance: state.player.resonance ?? 0,
      attunement: state.player.attunement ?? 0,
      movementSpeed: SLOWEST_CLASS_SPEED,
    }),
    movementSpeed: SLOWEST_CLASS_SPEED,
  }
  spawnBoss(state, createEntityIdAllocator(), bossId, { x: 0, y: 0 })
  return state
}

/**
 * Casts one named skill and lets the Dodge answer it, without letting the boss
 * move: this measures the attack, not the chase.
 *
 * Returns whether the player is still inside any of the areas when the warning
 * runs out.
 */
function isCaughtBy(
  bossId: BossDefinitionId,
  skillId: BossSkillId,
  playerX: number,
  playerY: number,
): boolean {
  const state = createState(bossId, playerX, playerY)
  const boss = state.bosses![0]!
  const allocator = createEntityIdAllocator()
  boss.skills = [{ skillId, cooldownRemaining: 0 }]
  boss.nextSkillIndex = 0
  boss.speed = 0
  updateBosses(state, allocator, 0)
  expect(state.telegraphs?.length ?? 0).toBeGreaterThan(0)

  const definition = getBossSkillDefinition(skillId)
  const steps = Math.ceil(definition.telegraphDuration / STEP)
  for (let step = 0; step < steps; step += 1) {
    updatePlayerDodge(state, STEP)
    for (const telegraph of state.telegraphs ?? []) {
      telegraph.remainingDuration -= STEP
    }
    boss.speed = 0
    state.time += STEP
  }
  return (state.telegraphs ?? []).some((telegraph) =>
    isPointInTelegraph(telegraph, state.player.x, state.player.y, state.player.radius),
  )
}

/**
 * Where a character actually stands when a boss casts: pressed against it,
 * trading at arm's length, and out at range. Each is a different answer for a
 * ring or a cone, so each has to work.
 */
function stances(bossId: BossDefinitionId): readonly { name: string; x: number; y: number }[] {
  const radius = getBossDefinition(bossId).radius
  const places: { name: string; x: number; y: number }[] = []
  // Around the boss as well as in front of it: a cast is aimed at the player, so
  // a bearing that only works along one axis is an accident of the test.
  for (const bearing of [0, 40, 115, 190, 265, 320]) {
    const angle = (bearing * Math.PI) / 180
    for (const [name, distance] of [
      ['in melee', radius + 16],
      ['at arm’s length', radius + 110],
      ['mid range', radius + 170],
      ['at range', radius + 230],
    ] as const) {
      places.push({
        name: `${name}, ${bearing} degrees`,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
      })
    }
  }
  return places
}

describe('boss counterplay', () => {
  it('runs against the slowest character in the roster', () => {
    // The distances below are only meaningful against the speed the character
    // actually has, so prove the override reaches the derived stat rather than
    // assuming it: a test that quietly measures a faster character proves
    // nothing about the slow ones.
    const state = createState('stone-golem', 200, 0)

    expect(getEffectivePlayerMovementSpeed(state.player))
      .toBe(SLOWEST_CLASS_SPEED)
  })

  for (const bossId of BOSS_DEFINITION_IDS) {
    const boss = getBossDefinition(bossId)
    for (const skillId of boss.skills) {
      const skill = getBossSkillDefinition(skillId)
      it(`lets a character dodge ${boss.name}'s ${skill.name}`, () => {
        const caught = stances(bossId)
          .filter((stance) => isCaughtBy(bossId, skillId, stance.x, stance.y))
          .map((stance) => stance.name)

        expect(caught, `${skill.name} lands anyway: ${skill.counterplay}`)
          .toEqual([])
      })
    }
  }
})
