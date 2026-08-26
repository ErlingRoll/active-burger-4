import { describe, expect, it } from 'vitest'
import {
  BEHAVIOR_INTENT_PRIORITIES,
  getPackThreatScore,
  getPlayerBehaviorCandidates,
  getThreatScore,
} from './BehaviorIntents'
import { updatePlayerBehavior } from './BehaviorController'
import { createInitialPlayerState } from '../spawning/SpawningSystem'
import type { EnemyState, GameState } from '../../state/GameState'

function createState(
  enemies: EnemyState[] = [],
  pickups: GameState['pickups'] = [],
): GameState {
  return {
    player: createInitialPlayerState(1),
    enemies,
    bosses: [],
    telegraphs: [],
    projectiles: [],
    pickups,
    summons: [],
    effects: [],
    run: {
      phase: 'playing',
      seed: 1,
      killCount: 0,
      selectedUpgradeIds: [],
    },
    time: 0,
    tick: 0,
    paused: false,
  }
}

function enemy(
  id: number,
  definitionId: EnemyState['definitionId'],
  x: number,
  y = 0,
): EnemyState {
  return {
    id,
    definitionId,
    x,
    y,
    radius: 18,
    hp: 20,
    maxHp: 20,
    speed: 60,
    contactDamage: 5,
    xpReward: 5,
    targetId: 1,
  }
}

describe('data-driven player behavior intents', () => {
  it('chooses safe gear before combat-range and ties pickups by entity ID', () => {
    const state = createState(
      [enemy(9, 'slime', 320)],
      [
        {
          id: 8,
          kind: 'gear',
          x: 120,
          y: 0,
          radius: 12,
          attractionRadius: 180,
          attractionSpeed: 360,
        },
        {
          id: 4,
          kind: 'gear',
          x: -120,
          y: 0,
          radius: 12,
          attractionRadius: 180,
          attractionSpeed: 360,
        },
      ],
    )

    const candidates = getPlayerBehaviorCandidates(state)
    expect(candidates.map((candidate) => candidate.source)).toEqual([
      'gear',
      'combat-range',
      'hold',
    ])
    expect(candidates[0]).toMatchObject({
      pickupId: 4,
      priority: BEHAVIOR_INTENT_PRIORITIES.gear,
    })
  })

  it('uses pack pressure and stable IDs for high-threat target selection', () => {
    const first = enemy(11, 'brute', 50)
    const second = enemy(3, 'brute', -50)
    const threats = [first, second]

    expect(getPackThreatScore(first, threats)).toBeGreaterThan(getThreatScore(first))
    const state = createState([
      enemy(11, 'brute', 320),
      enemy(3, 'brute', -320),
    ])
    const combat = getPlayerBehaviorCandidates(state).find(
      (candidate) => candidate.source === 'combat-range',
    )
    expect(combat?.targetId).toBe(3)
  })

  it('kites a threatening pack, then holds when no intent remains', () => {
    const state = createState([
      enemy(7, 'brute', 35),
      enemy(2, 'brute', -35),
    ])

    expect(getPlayerBehaviorCandidates(state)[0]?.source).toBe('kite')
    state.enemies = []
    expect(getPlayerBehaviorCandidates(state).at(-1)?.source).toBe('hold')
  })

  it('kites a nearby Slime pack before it can sustain contact damage', () => {
    const state = createState([
      enemy(7, 'slime', 34),
      enemy(2, 'slime', -34),
      enemy(5, 'slime', 0, 34),
    ])

    expect(getPlayerBehaviorCandidates(state)[0]).toMatchObject({
      source: 'kite',
      targetId: 2,
    })
  })

  it('does not kite a lone manageable threat', () => {
    const state = createState([enemy(4, 'slime', 36)])
    state.enemies[0].hp = 10
    state.enemies[0].maxHp = 20

    const candidates = getPlayerBehaviorCandidates(state)
    expect(candidates.some((candidate) => candidate.source === 'kite')).toBe(false)
    expect(updatePlayerBehavior(state, 1 / 60)?.source).not.toBe('kite')
  })

  it('selects distinct profile intents from the same deterministic state', () => {
    const state = createState(
      [enemy(5, 'archer', 180)],
      [{
        id: 3,
        kind: 'gear',
        x: -120,
        y: 0,
        radius: 12,
        attractionRadius: 180,
        attractionSpeed: 360,
      }],
    )

    const selectedByProfile = (profileId: 'balanced' | 'aggressive' | 'cautious') => {
      state.player.behaviorController!.profileId = profileId
      state.player.behaviorController!.lastCandidate = undefined
      state.player.behaviorController!.commitmentRemaining = 0
      return updatePlayerBehavior(state, 0)?.source
    }

    expect(selectedByProfile('balanced')).toBe('gear')
    expect(selectedByProfile('aggressive')).toBe('combat-range')
    expect(selectedByProfile('cautious')).toBe('kite')
  })

  it('commits a movement intent briefly while Dodge remains an interrupt', () => {
    const state = createState([enemy(2, 'slime', 320)])
    const first = updatePlayerBehavior(state, 0)
    expect(first?.source).toBe('combat-range')

    state.enemies = [enemy(2, 'slime', 320)]
    const committed = updatePlayerBehavior(state, 0.05)
    expect(committed?.source).toBe('combat-range')
    expect(committed?.targetId).toBe(2)
    expect(state.player.behaviorController?.commitmentRemaining).toBeGreaterThan(0)

    state.telegraphs = [{
      id: 4,
      sourceId: 9,
      skillId: 'ground-slam',
      kind: 'ground-slam',
      x: state.player.x,
      y: state.player.y,
      radius: 100,
      remainingDuration: 0.8,
      duration: 1,
      points: [{ x: state.player.x, y: state.player.y }],
      damage: 1,
    }]
    expect(updatePlayerBehavior(state, 0.05)?.source).toBe('dodge')
  })
})
