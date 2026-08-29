import { describe, expect, it } from 'vitest'
import {
  INITIAL_UPGRADES,
  type UpgradeDefinition,
} from '../../content/upgrades/Upgrades'
import { SKILL_DEFINITIONS } from '../../content/skills/Skills'
import { Random } from '../random/Random'
import { createGame } from '../Game'
import {
  generateUpgradeChoices,
  getSkillUnlockWeight,
} from './UpgradeChoices'
import { applyUpgrade } from '../systems/upgrades/UpgradeSystem'

function getUpgrade(id: string): UpgradeDefinition {
  const upgrade = INITIAL_UPGRADES.find((candidate) => candidate.id === id)
  if (!upgrade) {
    throw new Error(`Missing test upgrade: ${id}`)
  }
  return upgrade
}

describe('upgrade choice generation', () => {
  it('generates the same three-choice order for the same seed', () => {
    const gameA = createGame({ seed: 123 })
    const gameB = createGame({ seed: 123 })

    const choicesA = generateUpgradeChoices(gameA.state, 3, gameA.random)
    const choicesB = generateUpgradeChoices(gameB.state, 3, gameB.random)

    expect(choicesA).toEqual(choicesB)
  })

  it('returns exactly three unique eligible upgrades', () => {
    const game = createGame({ seed: 456 })
    const choices = generateUpgradeChoices(game.state, 3, new Random(456))

    expect(choices).toHaveLength(3)
    expect(new Set(choices.map((choice) => choice.upgradeId)).size).toBe(3)
    expect(
      choices.every((choice) =>
        INITIAL_UPGRADES.some((upgrade) => upgrade.id === choice.upgradeId),
      ),
    ).toBe(true)
  })

  it('enables a skill rank choice after its unlock and never offers the unlock twice', () => {
    const game = createGame({ seed: 457 })
    applyUpgrade(game.state, 'whirlwind-unlock')
    game.state.player.skillSlotCount = 2
    const choices = generateUpgradeChoices(game.state, 5, new Random(1))
    const ids = choices.map((choice) => choice.upgradeId)

    expect(ids).toContain('whirlwind-level')
    expect(ids).not.toContain('whirlwind-unlock')
  })

  it('does not offer new skills when every skill slot is filled', () => {
    const game = createGame({ seed: 458 })
    game.state.player.skillSlotCount = game.state.player.skills.length

    const choices = generateUpgradeChoices(game.state, 3, new Random(2))

    expect(choices.map((choice) => choice.upgradeId)).not.toContain('chain-lightning-unlock')
    expect(choices.map((choice) => choice.upgradeId)).not.toContain('whirlwind-unlock')
  })

  it('includes a deterministic skill removal card when its chance succeeds', () => {
    const game = createGame({ seed: 459 })
    const rng = {
      next: () => 0.99,
      int: (min: number) => min,
      chance: () => true,
      pick: <T>(items: readonly T[]) => items[0] as T,
    }

    const choices = generateUpgradeChoices(game.state, 3, rng)
    const removal = choices.find((choice) => choice.upgradeId === 'remove-skill')

    expect(removal).toMatchObject({
      upgradeId: 'remove-skill',
      skillId: 'whirlwind',
      rarity: 'rare',
    })
  })

  it('weights skill unlocks toward each playstyle affinity without biasing rank upgrades', () => {
    const knight = createGame({ seed: 460, playstyleId: 'knight' })
    const ranger = createGame({ seed: 461, playstyleId: 'ranger' })
    const necromancer = createGame({ seed: 462, playstyleId: 'necromancer' })

    expect(getSkillUnlockWeight(getUpgrade('lancers-charge-unlock'), knight.state)).toBe(3)
    expect(getSkillUnlockWeight(getUpgrade('glacial-orb-unlock'), knight.state)).toBe(1)
    expect(getSkillUnlockWeight(getUpgrade('glacial-orb-unlock'), ranger.state)).toBe(3)
    expect(getSkillUnlockWeight(getUpgrade('chain-lightning-unlock'), ranger.state)).toBe(3)
    expect(getSkillUnlockWeight(getUpgrade('raise-skeleton-unlock'), necromancer.state)).toBe(3)
    expect(getSkillUnlockWeight(getUpgrade('gravity-well-unlock'), necromancer.state)).toBe(3)
    expect(getSkillUnlockWeight(getUpgrade('whirlwind-level'), knight.state)).toBe(1)
  })

  it('keeps all current skills tagged and classifies Glacial Orb as a projectile area skill', () => {
    expect(Object.values(SKILL_DEFINITIONS).every((skill) => skill.tags.length > 0)).toBe(true)
    expect(SKILL_DEFINITIONS['glacial-orb'].tags).toEqual(['cold', 'projectile', 'area'])
  })

  it('selects unique weighted choices when every eligible upgrade shares one rarity', () => {
    const game = createGame({ seed: 463, playstyleId: 'knight' })
    game.state.run.selectedUpgradeIds = INITIAL_UPGRADES
      .filter((upgrade) => upgrade.rarity !== 'common')
      .map((upgrade) => upgrade.id)
    game.state.player.skillSlotCount = game.state.player.skills.length
    const rng = {
      next: () => 0.25,
      int: (min: number) => min,
      chance: () => false,
      pick: <T>(items: readonly T[]) => items[0] as T,
    }

    const choices = generateUpgradeChoices(game.state, 3, rng)

    expect(choices).toHaveLength(3)
    expect(choices.every((choice) => choice.rarity === 'common')).toBe(true)
    expect(new Set(choices.map((choice) => choice.upgradeId)).size).toBe(3)
  })
})
