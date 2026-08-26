import { describe, expect, it } from 'vitest'
import {
  BASIC_BOLT_SKILL_ID,
  CHAIN_LIGHTNING_SKILL_ID,
  WHIRLWIND_SKILL_ID,
} from '../../content/skills/Skills'
import { createGame, FIXED_STEP_SECONDS } from '../Game'
import { createUiSnapshot } from './Snapshots'

describe('UI snapshots', () => {
  it('projects only acquired skills with actual single-target DPS assumptions', () => {
    const game = createGame({ seed: 71 })
    game.state.player.skills.push(
      { skillId: WHIRLWIND_SKILL_ID, level: 1, cooldownRemaining: 0 },
      { skillId: CHAIN_LIGHTNING_SKILL_ID, level: 2, cooldownRemaining: 0 },
    )
    game.state.run.selectedUpgradeIds.push(
      'damage-boost',
      'whirlwind-unlock',
    )

    const snapshot = createUiSnapshot(game.state)

    expect(snapshot.skills.map((skill) => skill.skillId)).toEqual([
      BASIC_BOLT_SKILL_ID,
      WHIRLWIND_SKILL_ID,
      CHAIN_LIGHTNING_SKILL_ID,
    ])
    expect(snapshot.skills.map((skill) => skill.estimatedSingleTargetDps)).toEqual([
      10,
      3.2,
      9 / 3.5,
    ])
    expect(snapshot.skills[0]?.dpsAssumption).toContain('attack cadence')
    expect(snapshot.skills[1]?.dpsAssumption).toContain('Whirlwind range')
    expect(snapshot.skills[2]?.dpsAssumption).toContain('Primary target')

    const basicUpgrades = snapshot.skills[0]?.upgrades ?? []
    expect(basicUpgrades.find((upgrade) => upgrade.upgradeId === 'damage-boost'))
      .toMatchObject({ relevant: true, status: 'acquired' })
    expect(basicUpgrades.find((upgrade) => upgrade.upgradeId === 'basic-bolt-level'))
      .toMatchObject({ relevant: true, status: 'available' })
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.skills)).toBe(true)
  })

  it('projects the active boss, telegraph, and autonomous Dodge state immutably', () => {
    const game = createGame({ seed: 72 })
    expect(game.startEncounter()).toBe(true)
    game.update(FIXED_STEP_SECONDS)

    const snapshot = createUiSnapshot(game.state)

    expect(snapshot.encounterStatus).toBe('active')
    expect(snapshot.boss).toMatchObject({
      name: 'Stone Golem',
      status: 'active',
      hp: 900,
      maxHp: 900,
      hpProgress: 1,
    })
    expect(snapshot.telegraphs).toHaveLength(1)
    expect(snapshot.dodge).toMatchObject({
      mode: 'autonomous',
      level: 1,
      reactionTime: 0.1,
      active: true,
      activeTelegraphCount: 1,
    })
    expect(Object.isFrozen(snapshot.boss)).toBe(true)
    expect(Object.isFrozen(snapshot.telegraphs)).toBe(true)
    expect(Object.isFrozen(snapshot.telegraphs[0]?.points)).toBe(true)
    expect(Object.isFrozen(snapshot.dodge)).toBe(true)
  })

  it('projects the selected behavior profile and active intent immutably', () => {
    const game = createGame({ seed: 73 })
    game.setBehaviorProfile('cautious')
    game.state.player.behaviorController!.lastCandidate = {
      source: 'dodge',
      directionX: 1,
      directionY: 0,
      speed: 200,
      priority: 10,
    }

    const snapshot = createUiSnapshot(game.state)

    expect(snapshot.behavior).toMatchObject({
      profileId: 'cautious',
      profileName: 'Cautious',
      profileDescription: 'Kites earlier around packs and high-threat enemies, even outside skill range.',
      activeIntent: {
        source: 'dodge',
        label: 'Dodge',
        directionX: 1,
        speed: 200,
      },
    })
    expect(Object.isFrozen(snapshot.behavior)).toBe(true)
    expect(Object.isFrozen(snapshot.behavior.activeIntent)).toBe(true)
  })
})
