import { describe, expect, it } from 'vitest'
import {
  INITIAL_UPGRADES,
  type UpgradeDefinition,
} from '../../content/upgrades/Upgrades'
import { SKILL_DEFINITIONS } from '../../content/skills/Skills'
import { Random } from '../random/Random'
import { createGame } from '../Game'
import { BASIC_ATTACK_SKILL_ID } from '../../content/skills/Skills'
import { SKILL_REMOVAL_CHANCE } from '../../game-config/skills'
import {
  generateUpgradeChoices,
  getSkillUnlockWeight,
} from './UpgradeChoices'
import { applyUpgrade } from '../systems/upgrades/UpgradeSystem'
import { Rarity } from '../../content/rarity/Rarity'
import {
  REMOVE_SYNERGY_UPGRADE_ID,
  SYNERGY_OFFER_CHANCE,
  SYNERGY_UPGRADES,
  getSynergyPartnerSkillIds,
  isSkillSynergyActive,
} from '../../content/upgrades/Upgrades'

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
        choice.upgradeId === 'remove-skill' ||
        choice.upgradeId === REMOVE_SYNERGY_UPGRADE_ID ||
        INITIAL_UPGRADES.some((upgrade) => upgrade.id === choice.upgradeId),
      ),
    ).toBe(true)
  })

  it('defines at least two unique legendary synergies for every skill', () => {
    const counts = new Map<string, number>()
    const pairs = new Set<string>()

    for (const synergy of SYNERGY_UPGRADES) {
      expect(synergy.rarity).toBe(Rarity.Legendary)
      const pair = [...synergy.synergySkillIds].sort().join('|')
      expect(pairs.has(pair)).toBe(false)
      pairs.add(pair)
      for (const skillId of synergy.synergySkillIds) {
        counts.set(skillId, (counts.get(skillId) ?? 0) + 1)
      }
    }

    for (const skill of Object.keys(SKILL_DEFINITIONS)) {
      expect(counts.get(skill)).toBeGreaterThanOrEqual(2)
    }
  })

  it('offers an eligible synergy only when its 10% roll succeeds', () => {
    const game = createGame({ seed: 456 })
    const rng = {
      next: () => 0.5,
      int: (min: number) => min,
      chance: (probability: number) => probability === SYNERGY_OFFER_CHANCE,
      pick: <T>(items: readonly T[]) => items[0] as T,
    }

    const choices = generateUpgradeChoices(game.state, 1, rng)

    expect(choices[0]?.upgradeId).toBe('synergy-basic-attack-whirlwind')
  })

  it('does not offer another synergy for a skill with an active synergy', () => {
    const game = createGame({ seed: 457 })
    game.state.run.selectedUpgradeIds.push('synergy-basic-attack-whirlwind')

    expect(isSkillSynergyActive(
      BASIC_ATTACK_SKILL_ID,
      game.state.run.selectedUpgradeIds,
    )).toBe(true)
    expect(generateUpgradeChoices(game.state, 3, {
      next: () => 0.5,
      int: (min: number) => min,
      chance: (probability: number) => probability === SYNERGY_OFFER_CHANCE,
      pick: <T>(items: readonly T[]) => items[0] as T,
    }).some((choice) => choice.upgradeId.startsWith('synergy-'))).toBe(false)
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

  it('keeps repeatable Basic Attack upgrades available after they are selected', () => {
    expect(INITIAL_UPGRADES.some((upgrade) => upgrade.name === 'Rapid Fire')).toBe(false)

    const barrage = getUpgrade('basic-attack-barrage')
    const deadeye = getUpgrade('basic-attack-precision')
    expect(barrage.rarity).toBe(Rarity.Rare)
    expect(deadeye.rarity).toBe(Rarity.Rare)
    expect(barrage.repeatable).toBe(true)
    expect(deadeye.repeatable).toBe(true)
    expect(barrage.branch).toBe('basic-attack-barrage')
    expect(deadeye.branch).toBe('basic-attack-precision')
    expect(barrage.isEligible({
      playerLevel: 2,
      selectedUpgradeIds: ['basic-attack-barrage'],
      ownedSkillIds: [BASIC_ATTACK_SKILL_ID],
      skillLevels: { [BASIC_ATTACK_SKILL_ID]: 1 },
      skillSlotCount: 6,
    })).toBe(true)
    expect(deadeye.isEligible({
     playerLevel: 2,
     selectedUpgradeIds: ['basic-attack-precision'],
     ownedSkillIds: [BASIC_ATTACK_SKILL_ID],
     skillLevels: { [BASIC_ATTACK_SKILL_ID]: 1 },
     skillSlotCount: 6,
    })).toBe(true)
  })

  it('treats skeleton count and durability cards as upgrades instead of evolutions', () => {
    const crypt = getUpgrade('raise-skeleton-max-count')
    const guardian = getUpgrade('raise-skeleton-guardian')

    expect(crypt.branch).toBeUndefined()
    expect(crypt.summonMaxCountIncrease).toBe(1)
    expect(guardian.branch).toBeUndefined()
    expect(guardian.summonMaxHpIncrease).toBe(12)
    expect(crypt.isEligible({
      playerLevel: 2,
      selectedUpgradeIds: [
        'raise-skeleton-max-count',
        'raise-skeleton-guardian',
      ],
      ownedSkillIds: ['raise-skeleton'],
      skillLevels: { 'raise-skeleton': 1 },
      skillSlotCount: 6,
    })).toBe(true)
  })

  it('defines mutually exclusive Raise Skeleton evolutions', () => {
    const legion = getUpgrade('raise-skeleton-legion')
    const rot = getUpgrade('raise-skeleton-rotting-bones')

    expect(legion.branch).toBe('raise-skeleton-legion')
    expect(legion.skeletonLegion).toBe(true)
    expect(rot.branch).toBe('raise-skeleton-rotting-bones')
    expect(rot.skeletonRottingBones).toBe(true)
    expect(rot.evolutionTags).toEqual(['poison', 'damage-over-time'])

    const game = createGame({ seed: 468, playstyleId: 'necromancer' })
    game.state.run.selectedUpgradeIds.push('raise-skeleton-legion')
    const choices = generateUpgradeChoices(game.state, 5, new Random(1))

    expect(choices.map((choice) => choice.upgradeId)).not.toContain(
      'raise-skeleton-rotting-bones',
    )
  })

  it('makes Empowered Attack an Uncommon upgrade', () => {
    expect(getUpgrade('basic-attack-level').rarity).toBe(Rarity.Uncommon)
  })

  it('assigns glossary tags to evolutions with status or timing mechanics', () => {
    const expectedTags = {
      'whirlwind-frost': ['chill', 'freeze'],
      'whirlwind-guard': ['duration'],
      'fiery-touch-cooldown-reduction': ['cooldown-reduction'],
      'chain-lightning-frost': ['chill'],
      'chain-lightning-overload': ['shock', 'overload'],
      'glacial-orb-permafrost': ['chill'],
      'glacial-orb-ice-lance': ['chill', 'freeze'],
      'rallying-banner-commander': ['cooldown-reduction'],
      'rallying-banner-bulwark': ['duration'],
      'gravity-well-singularity': ['chill'],
      'aegis-pulse-bulwark': ['duration'],
      'raise-skeleton-rotting-bones': ['poison', 'damage-over-time'],
    } as const

    for (const [upgradeId, tags] of Object.entries(expectedTags)) {
      expect(getUpgrade(upgradeId).evolutionTags).toEqual(tags)
    }
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
      rarity: Rarity.Rare,
    })
  })

  it('offers Release Synergy in the existing special release slot', () => {
    const game = createGame({ seed: 460 })
    game.state.run.selectedUpgradeIds.push('synergy-basic-attack-whirlwind')
    const rng = {
      next: () => 0.99,
      int: (min: number) => min,
      chance: (probability: number) => probability === SKILL_REMOVAL_CHANCE,
      pick: <T>(items: readonly T[]) => items[0] as T,
    }

    const choices = generateUpgradeChoices(game.state, 3, rng)

    expect(choices.at(-1)).toEqual({
      upgradeId: REMOVE_SYNERGY_UPGRADE_ID,
      synergyId: 'synergy-basic-attack-whirlwind',
      rarity: Rarity.Rare,
    })
  })

  it('weights skill unlocks toward each playstyle affinity without biasing rank upgrades', () => {
    const knight = createGame({ seed: 460, playstyleId: 'knight' })
    const ranger = createGame({ seed: 461, playstyleId: 'ranger' })
    const necromancer = createGame({ seed: 462, playstyleId: 'necromancer' })

    expect(getSkillUnlockWeight(getUpgrade('lancers-charge-unlock'), knight.state)).toBe(6)
    expect(getSkillUnlockWeight(getUpgrade('glacial-orb-unlock'), knight.state)).toBe(1)
    expect(getSkillUnlockWeight(getUpgrade('glacial-orb-unlock'), ranger.state)).toBe(6)
    expect(getSkillUnlockWeight(getUpgrade('chain-lightning-unlock'), ranger.state)).toBe(3)
    expect(getSkillUnlockWeight(getUpgrade('raise-skeleton-unlock'), necromancer.state)).toBe(3)
    expect(getSkillUnlockWeight(getUpgrade('gravity-well-unlock'), necromancer.state)).toBe(6)
    const frostWarden = createGame({ seed: 464, playstyleId: 'frost-warden' })
    const ashenAlchemist = createGame({ seed: 465, playstyleId: 'ashen-alchemist' })
    const warShepherd = createGame({ seed: 466, playstyleId: 'war-shepherd' })
    expect(getSkillUnlockWeight(getUpgrade('glacial-orb-unlock'), frostWarden.state)).toBe(3)
    expect(getSkillUnlockWeight(getUpgrade('chain-lightning-unlock'), frostWarden.state)).toBe(6)
    expect(getSkillUnlockWeight(getUpgrade('cinder-mine-unlock'), ashenAlchemist.state)).toBe(3)
    expect(getSkillUnlockWeight(getUpgrade('fiery-touch-unlock'), ashenAlchemist.state)).toBe(6)
    expect(getSkillUnlockWeight(getUpgrade('rallying-banner-unlock'), warShepherd.state)).toBe(3)
    expect(getSkillUnlockWeight(getUpgrade('raise-skeleton-unlock'), warShepherd.state)).toBe(6)
    expect(getSkillUnlockWeight(getUpgrade('whirlwind-level'), knight.state)).toBe(1)
  })

  it('finds owned skills that pair with a skill unlock', () => {
    expect(getSynergyPartnerSkillIds(
      'glacial-orb',
      ['basic-attack', 'whirlwind'],
    )).toEqual(['basic-attack'])
    expect(getSynergyPartnerSkillIds(
      'gravity-well',
      ['basic-attack'],
    )).toEqual(['basic-attack'])
  })

  it('ignores universal Basic Attack Synergy when weighting skill unlocks', () => {
    const game = createGame({ seed: 467 })
    expect(getSkillUnlockWeight(getUpgrade('gravity-well-unlock'), game.state)).toBe(1)

    applyUpgrade(game.state, 'raise-skeleton-unlock')

    expect(getSkillUnlockWeight(getUpgrade('gravity-well-unlock'), game.state)).toBe(2)
  })

  it('ignores owned partners that already have an active Synergy', () => {
    const game = createGame({ seed: 468, playstyleId: 'necromancer' })
    game.state.run.selectedUpgradeIds.push('synergy-basic-attack-raise-skeleton')

    expect(getSkillUnlockWeight(getUpgrade('gravity-well-unlock'), game.state)).toBe(3)
  })

  it('keeps all current skills tagged and classifies Glacial Orb as a projectile area skill', () => {
    expect(Object.values(SKILL_DEFINITIONS).every((skill) => skill.tags.length > 0)).toBe(true)
    expect(SKILL_DEFINITIONS['glacial-orb'].tags).toEqual(['cold', 'projectile', 'area'])
  })

  it('marks every duration-extendable skill with the duration tag', () => {
    const durationExtendableSkillIds = [
      'rallying-banner',
      'aegis-pulse',
      'storm-relay',
      'soul-tether',
      'phantom-arsenal',
      'razorwire',
      'blood-rite',
      'prism-halo',
    ] as const

    for (const skillId of durationExtendableSkillIds) {
      expect(SKILL_DEFINITIONS[skillId].tags).toContain('duration')
    }
  })

  it('selects unique weighted choices when every eligible upgrade shares one rarity', () => {
    const game = createGame({ seed: 463, playstyleId: 'knight' })
    game.state.player.skills = []
    game.state.run.selectedUpgradeIds = INITIAL_UPGRADES
      .filter((upgrade) => upgrade.rarity !== Rarity.Common)
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
    expect(choices.every((choice) => choice.rarity === Rarity.Common)).toBe(true)
    expect(new Set(choices.map((choice) => choice.upgradeId)).size).toBe(3)
  })
})
