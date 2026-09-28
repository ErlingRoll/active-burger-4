import { describe, expect, it } from 'vitest'
import {
  BASIC_ATTACK_SKILL_ID,
  GLACIAL_ORB_SKILL_ID,
  SKILL_DEFINITIONS,
  VITALITY_SKILL_ID,
  WHIRLWIND_SKILL_ID,
  getSkillDefinition,
} from './Skills'
import {
  describeSkillStatusPartner,
  getSkillStatusPartners,
} from './SkillInteractions'
import {
  getActiveSynergyForSkill,
  getAllSynergyPartnerSkillIds,
  getSynergiesBetween,
} from '../upgrades/Upgrades'

describe('skill status interactions', () => {
  it('pairs Glacial Orb with every physical skill through Shatter', () => {
    const partners = getSkillStatusPartners(GLACIAL_ORB_SKILL_ID)
    const physicalSkillIds = Object.values(SKILL_DEFINITIONS)
      .map((skill) => getSkillDefinition(skill.id))
      .filter((skill) => skill.id !== GLACIAL_ORB_SKILL_ID && skill.tags.includes('physical'))
      .map((skill) => skill.id)

    expect(partners.map((partner) => partner.skillId)).toEqual(physicalSkillIds)
    for (const partner of partners) {
      expect(partner.setsUp).toEqual(['freeze'])
      expect(partner.benefitsFrom).toEqual([])
    }
  })

  it('reads the pairing from the other side too', () => {
    const partners = getSkillStatusPartners(WHIRLWIND_SKILL_ID)
    const orb = partners.find((partner) => partner.skillId === GLACIAL_ORB_SKILL_ID)
    expect(orb).toEqual({ skillId: GLACIAL_ORB_SKILL_ID, setsUp: [], benefitsFrom: ['freeze'] })
    expect(describeSkillStatusPartner(orb!)).toBe('benefits from its Freeze')
  })

  it('has nothing to say for a skill without status interactions', () => {
    expect(getSkillStatusPartners(VITALITY_SKILL_ID)).toEqual([])
  })

  it('lets the caller substitute what a skill applies right now', () => {
    // A staff Basic Attack poisons, so a skill that consumed Poison would pair with it.
    const partners = getSkillStatusPartners(BASIC_ATTACK_SKILL_ID, {
      applies: ['poison'],
      consumes: [],
    })
    expect(partners.every((partner) => partner.setsUp.includes('poison'))).toBe(true)
  })
})

describe('synergy partner helpers', () => {
  it('lists every synergy partner of a skill, owned or not', () => {
    const partners = getAllSynergyPartnerSkillIds(WHIRLWIND_SKILL_ID)
    expect(partners).toContain(BASIC_ATTACK_SKILL_ID)
    expect(partners.length).toBeGreaterThanOrEqual(2)
    expect(new Set(partners).size).toBe(partners.length)
    for (const partnerId of partners) {
      expect(getSynergiesBetween(WHIRLWIND_SKILL_ID, partnerId).length).toBeGreaterThan(0)
      expect(getSkillDefinition(partnerId).name).toBeTruthy()
    }
  })

  it('names the synergy a skill is locked into', () => {
    expect(getActiveSynergyForSkill(WHIRLWIND_SKILL_ID, [])).toBeUndefined()
    expect(getActiveSynergyForSkill(WHIRLWIND_SKILL_ID, ['synergy-basic-attack-whirlwind'])?.name)
      .toBe('Close Quarters')
    expect(getActiveSynergyForSkill(BASIC_ATTACK_SKILL_ID, ['synergy-basic-attack-whirlwind'])?.name)
      .toBe('Close Quarters')
  })
})
