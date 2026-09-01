import { describe, expect, it } from 'vitest'
import { createInitialPlayerState } from '../../game/systems/spawning/SpawningSystem'
import {
  getPlaystyleDefinition,
  isPlaystyleId,
  PLAYSTYLE_IDS,
} from './Playstyles'
import { SKILL_DEFINITIONS } from '../skills/Skills'

describe('Playstyles', () => {
  it('defines eight valid, distinct starter playstyles', () => {
    expect(PLAYSTYLE_IDS).toEqual([
      'knight',
      'ranger',
      'necromancer',
      'frost-warden',
      'ashen-alchemist',
      'war-shepherd',
      'riftwalker',
      'bloodweaver',
    ])
    expect(isPlaystyleId('ranger')).toBe(true)
    expect(isPlaystyleId('frost-warden')).toBe(true)
    expect(isPlaystyleId('unknown')).toBe(false)
  })

  it('initializes the selected playstyle with its authored stats and skills', () => {
    for (const playstyleId of PLAYSTYLE_IDS) {
      const definition = getPlaystyleDefinition(playstyleId)
      const player = createInitialPlayerState(1, undefined, playstyleId)
      expect(player.playstyleId).toBe(playstyleId)
      expect(player.baseStats).toEqual(definition.baseStats)
      expect(player.skills.map((skill) => skill.skillId)).toEqual(definition.startingSkillIds)
    }
  })

  it('keeps class descriptions flavor-focused without naming skills', () => {
    for (const playstyleId of PLAYSTYLE_IDS) {
      const description = getPlaystyleDefinition(playstyleId).description.toLowerCase()
      for (const skill of Object.values(SKILL_DEFINITIONS)) {
        expect(description).not.toContain(skill.name.toLowerCase())
      }
    }
  })
})
