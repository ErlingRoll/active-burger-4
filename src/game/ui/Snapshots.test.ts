import { describe, expect, it } from 'vitest'
import {
  BASIC_BOLT_SKILL_ID,
  CHAIN_LIGHTNING_SKILL_ID,
  WHIRLWIND_SKILL_ID,
} from '../../content/skills/Skills'
import { createGame } from '../Game'
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
})
