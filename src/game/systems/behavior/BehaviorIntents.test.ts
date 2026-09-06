import { describe, expect, it } from 'vitest'
import {
  BEHAVIOR_INTENT_PRIORITIES,
  getPackThreatScore,
  getPlayerBehaviorCandidates,
  getThreatScore,
} from './BehaviorIntents'
import { updatePlayerBehavior } from './BehaviorController'
import { createInitialPlayerState } from '../spawning/SpawningSystem'
import { equipItem } from '../../equipment/EquipmentState'
import { getDerivedPlayerStats } from '../../stats/DerivedStats'
import type {
  EnemyState,
  GameState,
  ProjectileState,
} from '../../state/GameState'
import { getPlayerArenaBounds } from '../../../game-config/arena'
import { RALLYING_BANNER_EFFECT_RADIUS } from '../../../game-config/skills'

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

function hostileProjectile(
  id: number,
  targetId: number,
  x: number,
  y: number,
  velocityX: number,
  velocityY: number,
): ProjectileState {
  return {
    id,
    ownerId: 99,
    definitionId: 'enemy-archer-arrow',
    hostile: true,
    targetId,
    x,
    y,
    velocityX,
    velocityY,
    radius: 7,
    damage: {
      physical: 1,
      lightning: 0,
      fire: 0,
      cold: 0,
      chaos: 0,
    },
    remainingLifetime: 3,
  }
}

describe('data-driven player behavior intents', () => {
  it('prioritizes available stairs regardless of distance, threats, or behavior profile', () => {
    const state = createState([
      enemy(7, 'brute', 35),
      enemy(3, 'archer', -80),
    ])
    state.stairs = {
      id: 99,
      x: 10_000,
      y: -2_000,
      radius: 24,
      spawnedAt: 0,
      floorNumber: 1,
      isFinal: false,
      rewardsCollected: true,
    }

    for (const profileId of ['balanced', 'aggressive', 'cautious'] as const) {
      state.player.behaviorController = { profileId }
      expect(getPlayerBehaviorCandidates(state)).toEqual([
        expect.objectContaining({
          source: 'stairs',
          targetId: state.stairs.id,
          directionX: expect.any(Number),
          directionY: expect.any(Number),
        }),
      ])
      expect(updatePlayerBehavior(state, 1 / 60)?.source).toBe('stairs')
    }
  })

  it('holds position on stairs until the floor transition collects them', () => {
    const state = createState([enemy(7, 'brute', 35)])
    state.stairs = {
      id: 99,
      x: state.player.x,
      y: state.player.y,
      radius: 24,
      spawnedAt: 0,
      floorNumber: 1,
      isFinal: false,
      rewardsCollected: true,
    }

    expect(getPlayerBehaviorCandidates(state)).toEqual([
      expect.objectContaining({
        source: 'stairs',
        targetId: state.stairs.id,
        directionX: 0,
        directionY: 0,
        speed: 0,
      }),
    ])
  })

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
    })
    expect(candidates[0]?.priority).toBeGreaterThan(BEHAVIOR_INTENT_PRIORITIES.gear)
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

  it('escapes contact with a lone manageable threat for Balanced and Cautious', () => {
    for (const profileId of ['balanced', 'cautious'] as const) {
      const state = createState([enemy(4, 'slime', 30)])
      state.player.behaviorController = { profileId }

      expect(getPlayerBehaviorCandidates(state)[0]).toMatchObject({
        source: 'kite',
        targetId: 4,
      })
      expect(updatePlayerBehavior(state, 1 / 60)?.source).toBe('kite')
    }
  })

  it('keeps Aggressive in combat against a lone contact threat', () => {
    const state = createState([enemy(4, 'slime', 30)])
    state.player.behaviorController = { profileId: 'aggressive' }

    expect(getPlayerBehaviorCandidates(state).some(
      (candidate) => candidate.source === 'kite',
    )).toBe(false)
    expect(updatePlayerBehavior(state, 1 / 60)?.source).toBe('hold')
  })

  it('uses the equipped staff range after a knight swaps weapons', () => {
    const state = createState([enemy(4, 'slime', 80)])
    equipItem(state.player, 'ritual-staff')

    const candidates = getPlayerBehaviorCandidates(state)

    expect(candidates.map((candidate) => candidate.source)).toEqual(['hold'])
    expect(getDerivedPlayerStats(state.player).attackRange).toBe(110)
    expect('attackRange' in state.player).toBe(false)
  })

  it('uses the target-radius engagement range shared with basic attacks', () => {
    const state = createState([enemy(4, 'slime', 127)])
    equipItem(state.player, 'ritual-staff')

    expect(getPlayerBehaviorCandidates(state).some(
      (candidate) => candidate.source === 'combat-range',
    )).toBe(false)
  })

  it('replaces an out-of-range stale target with the best current combat target', () => {
    const activeTarget = enemy(4, 'slime', 100)
    const higherThreat = enemy(9, 'brute', 120)
    const state = createState([activeTarget, higherThreat])
    state.player.targetId = activeTarget.id

    const combatRange = getPlayerBehaviorCandidates(state).find(
      (candidate) => candidate.source === 'combat-range',
    )
    expect(combatRange?.targetId).toBe(higherThreat.id)
  })

  it('kites a close Runner before it can sustain contact damage', () => {
    const runner = enemy(4, 'runner', 61)
    const state = createState([runner])
    state.player.behaviorController = {
      profileId: 'cautious',
    }

    const candidates = getPlayerBehaviorCandidates(state)
    expect(candidates.some((candidate) => candidate.source === 'kite')).toBe(true)
    expect(updatePlayerBehavior(state, 1 / 60)?.source).toBe('kite')
  })

  it('dodges an existing hostile projectile along its predicted route', () => {
    const state = createState()
    state.projectiles = [
      hostileProjectile(9, state.player.id, -120, 0, 480, 0),
    ]

    const dodge = getPlayerBehaviorCandidates(state)[0]
    expect(dodge?.source).toBe('dodge')
    expect(Math.abs(dodge?.directionY ?? 0)).toBeGreaterThan(
      Math.abs(dodge?.directionX ?? 0),
    )
  })

  it('ignores hostile projectiles assigned to a summon', () => {
    const state = createState()
    state.summons = [{
      id: 72,
      ownerId: state.player.id,
      x: -40,
      y: 0,
      hp: 10,
      maxHp: 10,
      contactCooldownRemaining: 0,
      attackCooldownRemaining: 0,
    }]
    state.projectiles = [
      hostileProjectile(9, state.summons[0].id, -120, 0, 480, 0),
    ]

    expect(getPlayerBehaviorCandidates(state).map((candidate) => candidate.source))
      .toEqual(['hold'])
  })

  it('steers away from a Flanker lateral intercept destination', () => {
    const state = createState([enemy(2, 'flanker', 60)])
    state.player.behaviorController = { profileId: 'cautious' }

    const kite = getPlayerBehaviorCandidates(state).find(
      (candidate) => candidate.source === 'kite',
    )
    expect(kite).toMatchObject({ source: 'kite' })
    expect(Math.abs(kite?.directionY ?? 0)).toBeGreaterThan(0.2)
  })

  it('keeps kiting while a Flanker re-engages through ordinary pursuit', () => {
    const flanker = enemy(2, 'flanker', 60)
    flanker.interceptCooldownRemaining = 1
    const state = createState([flanker])
    state.player.behaviorController = { profileId: 'cautious' }

    const kite = getPlayerBehaviorCandidates(state).find(
      (candidate) => candidate.source === 'kite',
    )
    expect(kite).toMatchObject({ source: 'kite' })
  })

  it('evaluates a deterministic kite route for more than one hundred enemies', () => {
    const state = createState(
      Array.from({ length: 120 }, (_, index) =>
        enemy(
          index + 2,
          'slime',
          70 + (index % 20) * 12,
          (Math.floor(index / 20) - 3) * 18,
        )
      ),
    )
    state.player.behaviorController = { profileId: 'cautious' }

    const first = getPlayerBehaviorCandidates(state).find(
      (candidate) => candidate.source === 'kite',
    )
    const second = getPlayerBehaviorCandidates(state).find(
      (candidate) => candidate.source === 'kite',
    )
    expect(first).toMatchObject({ source: 'kite' })
    expect(second).toEqual(first)
  })

  it('kites a threatening pack instead of approaching it before attacks are available', () => {
    const state = createState([
      enemy(7, 'brute', 120),
      enemy(2, 'brute', 150),
    ])
    state.player.behaviorController = {
      profileId: 'cautious',
    }

    const candidates = getPlayerBehaviorCandidates(state)
    expect(candidates.some((candidate) => candidate.source === 'kite')).toBe(true)
    expect(updatePlayerBehavior(state, 1 / 60)?.source).toBe('kite')
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

  it('preserves profile combat priorities while valuing high-value safe XP', () => {
    const state = createState(
      [enemy(9, 'slime', 320)],
      [{
        id: 3,
        kind: 'xp',
        x: 120,
        y: 0,
        radius: 8,
        attractionRadius: 180,
        attractionSpeed: 360,
        xpAmount: 20,
      }],
    )

    const selectedByProfile = (profileId: 'balanced' | 'aggressive' | 'cautious') => {
      state.player.behaviorController = {
        profileId,
        lastCandidate: undefined,
        commitmentRemaining: 0,
      }
      return updatePlayerBehavior(state, 0)?.source
    }
    expect(selectedByProfile('aggressive')).toBe('combat-range')
    expect(selectedByProfile('balanced')).toBe('xp')
    expect(selectedByProfile('cautious')).toBe('xp')
  })

  it('prioritizes a reachable healing potion when the player is critically hurt', () => {
    const state = createState([], [{
      id: 3,
      kind: 'healing-potion',
      x: 80,
      y: 0,
      radius: 10,
      attractionRadius: 180,
      attractionSpeed: 360,
    }])
    state.player.hp = 20

    expect(updatePlayerBehavior(state, 0)?.source).toBe('healing')
  })

  it('holds within a nearby Rallying Banner while injured', () => {
    const state = createState()
    state.player.hp = 50
    state.effects = [{
      id: 9,
      skillId: 'rallying-banner',
      x: 0,
      y: 0,
      radius: RALLYING_BANNER_EFFECT_RADIUS,
      remainingLifetime: 4,
      lifetime: 6,
      points: [{ x: 0, y: 0 }],
      periodicHealingAmount: 6,
      periodicHealingRemaining: 1,
    }]

    expect(updatePlayerBehavior(state, 0)?.source).toBe('zone')
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
      damage: {
        physical: 1,
        lightning: 0,
        fire: 0,
        cold: 0,
        chaos: 0,
      },
    }]
    expect(updatePlayerBehavior(state, 0.05)?.source).toBe('dodge')
  })

  it('stops pursuing a pickup that is unreachable beyond the wall', () => {
    const state = createState([], [{
      id: 3,
      kind: 'gear',
      x: 2_000,
      y: 0,
      radius: 12,
      attractionRadius: 180,
      attractionSpeed: 360,
    }])
    const bounds = getPlayerArenaBounds(state.player.radius)
    state.player.x = bounds.maxX

    expect(getPlayerBehaviorCandidates(state).map((candidate) => candidate.source))
      .toEqual(['hold'])
  })

  it('projects reachable movement toward the wall instead of beyond it', () => {
    const state = createState([], [{
      id: 3,
      kind: 'xp',
      x: 2_000,
      y: 200,
      radius: 8,
      attractionRadius: 180,
      attractionSpeed: 360,
      xpAmount: 5,
    }])
    state.player.x = 900

    const candidate = getPlayerBehaviorCandidates(state).find(
      (entry) => entry.source === 'xp',
    )
    expect(candidate).toMatchObject({
      directionX: expect.any(Number),
      directionY: expect.any(Number),
    })
    expect(candidate?.directionX).toBeGreaterThan(0)
  })

  it('turns a wall-facing kite route inward when enemies occupy the escape side', () => {
    const state = createState([
      enemy(2, 'brute', 1_450, -10),
      enemy(3, 'brute', 1_450, 10),
    ])
    const bounds = getPlayerArenaBounds(state.player.radius)
    state.player.x = bounds.maxX - 20

    const kite = getPlayerBehaviorCandidates(state).find(
      (candidate) => candidate.source === 'kite',
    )
    expect(kite).toMatchObject({
      directionX: expect.any(Number),
      directionY: expect.any(Number),
    })
    expect(kite?.directionX).toBeLessThan(0)
  })
})
