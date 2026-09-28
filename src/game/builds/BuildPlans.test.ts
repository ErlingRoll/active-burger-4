import { describe, expect, it } from 'vitest'
import {
  BASIC_ATTACK_SKILL_ID,
  GLACIAL_ORB_SKILL_ID,
  WHIRLWIND_SKILL_ID,
  CHAIN_LIGHTNING_SKILL_ID,
} from '../../content/skills/Skills'
import { Rarity } from '../../content/rarity/Rarity'
import { getUpgradeDefinition, SYNERGY_UPGRADES } from '../../content/upgrades/Upgrades'
import {
  BUILD_PLAN_LIMIT,
  getBuildPlanProgress,
  getPlannableSkillIds,
  getPlannableSynergies,
  getPlannableUpgrades,
  isChoicePlanned,
  normalizeBuildPlans,
  withPlanName,
  withPlanSkill,
  withPlanUpgrade,
  type BuildPlan,
} from './BuildPlans'

const EMPTY: BuildPlan = { id: 'plan-1', name: 'Frost', skillIds: [], upgradeIds: [] }

describe('build plans', () => {
  it('lists every skill but Basic Attack as plannable', () => {
    const skillIds = getPlannableSkillIds()
    expect(skillIds).not.toContain(BASIC_ATTACK_SKILL_ID)
    expect(skillIds).toContain(WHIRLWIND_SKILL_ID)
  })

  it('offers only the upgrades of planned skills, with Basic Attack always in scope', () => {
    const groups = getPlannableUpgrades([WHIRLWIND_SKILL_ID])
    expect(groups.map((group) => group.skillId)).toEqual([BASIC_ATTACK_SKILL_ID, WHIRLWIND_SKILL_ID])
    for (const group of groups) {
      expect(group.upgrades.every((upgrade) =>
        upgrade.skillId === group.skillId && upgrade.skillAction !== 'unlock',
      )).toBe(true)
      expect(group.upgrades.length).toBeGreaterThan(0)
    }
  })

  it('offers only synergies whose skills are both planned', () => {
    const one = getPlannableSynergies([WHIRLWIND_SKILL_ID])
    expect(one.map((synergy) => synergy.id)).toEqual(['synergy-basic-attack-whirlwind'])

    const two = getPlannableSynergies([WHIRLWIND_SKILL_ID, GLACIAL_ORB_SKILL_ID])
    expect(two.every((synergy) =>
      synergy.synergySkillIds.every((skillId) =>
        skillId === BASIC_ATTACK_SKILL_ID ||
        skillId === WHIRLWIND_SKILL_ID ||
        skillId === GLACIAL_ORB_SKILL_ID,
      ),
    )).toBe(true)
    expect(two.length).toBeGreaterThan(one.length)
  })

  it('keeps one synergy per skill when a second one is planned', () => {
    const plan = [CHAIN_LIGHTNING_SKILL_ID, GLACIAL_ORB_SKILL_ID, WHIRLWIND_SKILL_ID]
      .reduce((draft, skillId) => withPlanSkill(draft, skillId, true), EMPTY)
    const stormfrost = SYNERGY_UPGRADES.find((synergy) =>
      synergy.synergySkillIds.includes(CHAIN_LIGHTNING_SKILL_ID) &&
      synergy.synergySkillIds.includes(GLACIAL_ORB_SKILL_ID),
    )
    expect(stormfrost).toBeDefined()

    const first = withPlanUpgrade(plan, 'synergy-basic-attack-glacial-orb', true)
    expect(first.upgradeIds).toEqual(['synergy-basic-attack-glacial-orb'])

    // Glacial Orb cannot hold both, so planning the second drops the first.
    const second = withPlanUpgrade(first, stormfrost!.id, true)
    expect(second.upgradeIds).toEqual([stormfrost!.id])

    // Basic Attack and Whirlwind are both free, so their pair sits beside it.
    const third = withPlanUpgrade(second, 'synergy-basic-attack-whirlwind', true)
    expect(third.upgradeIds).toEqual([stormfrost!.id, 'synergy-basic-attack-whirlwind'])
  })

  it('lets a name be cleared while editing and caps its length', () => {
    expect(withPlanName(EMPTY, '').name).toBe('')
    expect(withPlanName(EMPTY, 'x'.repeat(80)).name).toHaveLength(32)
  })

  it('refuses an upgrade for a skill that is not planned', () => {
    expect(withPlanUpgrade(EMPTY, 'whirlwind-frost', true).upgradeIds).toEqual([])
  })

  it('drops upgrades and synergies when their skill leaves the plan', () => {
    const plan = withPlanUpgrade(
      withPlanUpgrade(withPlanSkill(EMPTY, WHIRLWIND_SKILL_ID, true), 'whirlwind-frost', true),
      'synergy-basic-attack-whirlwind',
      true,
    )
    expect(plan.upgradeIds).toHaveLength(2)
    expect(withPlanSkill(plan, WHIRLWIND_SKILL_ID, false)).toEqual({ ...EMPTY })
  })

  it('marks a card by its skill for unlocks and by its id for everything else', () => {
    const plan = withPlanUpgrade(withPlanSkill(EMPTY, WHIRLWIND_SKILL_ID, true), 'whirlwind-frost', true)
    expect(isChoicePlanned(plan, { upgradeId: 'whirlwind-unlock', rarity: Rarity.Common })).toBe(true)
    expect(isChoicePlanned(plan, { upgradeId: 'chain-lightning-unlock', rarity: Rarity.Common })).toBe(false)
    expect(isChoicePlanned(plan, { upgradeId: 'whirlwind-frost', rarity: Rarity.Uncommon })).toBe(true)
    expect(isChoicePlanned(plan, { upgradeId: 'whirlwind-guard', rarity: Rarity.Uncommon })).toBe(false)
    expect(isChoicePlanned(plan, { upgradeId: 'remove-skill', skillId: WHIRLWIND_SKILL_ID, rarity: Rarity.Rare })).toBe(false)
    expect(isChoicePlanned(null, { upgradeId: 'whirlwind-unlock', rarity: Rarity.Common })).toBe(false)
  })

  it('normalizes stored plans, dropping what the content no longer knows', () => {
    const plans = normalizeBuildPlans([
      {
        id: 'a',
        name: '  Frost  ',
        skillIds: [WHIRLWIND_SKILL_ID, 'not-a-skill', BASIC_ATTACK_SKILL_ID, WHIRLWIND_SKILL_ID],
        upgradeIds: ['whirlwind-frost', 'glacial-orb-permafrost', 'no-such-upgrade', 'basic-attack-level'],
      },
      { id: 'a', name: 'duplicate id' },
      { name: 'no id' },
      { id: 'b' },
      'garbage',
    ])
    expect(plans).toEqual([
      {
        id: 'a',
        name: 'Frost',
        skillIds: [WHIRLWIND_SKILL_ID],
        upgradeIds: ['whirlwind-frost', 'basic-attack-level'],
      },
      { id: 'b', name: 'Build 4', skillIds: [], upgradeIds: [] },
    ])
    expect(normalizeBuildPlans(undefined)).toEqual([])
    expect(normalizeBuildPlans(
      Array.from({ length: BUILD_PLAN_LIMIT + 3 }, (_, index) => ({ id: `p${index}` })),
    )).toHaveLength(BUILD_PLAN_LIMIT)
  })

  it('reports progress from what the run owns and what the tooltip says is available', () => {
    const plan: BuildPlan = {
      id: 'p',
      name: 'Storm',
      skillIds: [WHIRLWIND_SKILL_ID, CHAIN_LIGHTNING_SKILL_ID],
      upgradeIds: ['whirlwind-frost', 'synergy-basic-attack-whirlwind', 'synergy-basic-attack-chain-lightning'],
    }
    const progress = getBuildPlanProgress(plan, {
      ownedSkillIds: [BASIC_ATTACK_SKILL_ID, WHIRLWIND_SKILL_ID],
      upgradeStatus: (upgradeId) =>
        upgradeId === 'whirlwind-frost'
          ? 'acquired'
          : upgradeId === 'synergy-basic-attack-whirlwind'
            ? 'available'
            : null,
    })

    expect(progress.skills.map((skill) => [skill.skillId, skill.status])).toEqual([
      [WHIRLWIND_SKILL_ID, 'done'],
      [CHAIN_LIGHTNING_SKILL_ID, 'reachable'],
    ])
    expect(progress.skills[0]?.upgrades).toEqual([
      { upgradeId: 'whirlwind-frost', name: getUpgradeDefinition('whirlwind-frost').name, status: 'done', missingSkillId: null },
    ])
    expect(progress.synergies.map((synergy) => [synergy.status, synergy.missingSkillId])).toEqual([
      ['reachable', null],
      ['blocked', CHAIN_LIGHTNING_SKILL_ID],
    ])
    expect(progress.doneCount).toBe(2)
    expect(progress.totalCount).toBe(5)
  })
})
