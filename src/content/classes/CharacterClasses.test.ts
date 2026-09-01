import { describe, expect, it } from 'vitest'
import { createInitialPlayerState } from '../../game/systems/spawning/SpawningSystem'
import {
  getCharacterClassDefinition,
  isCharacterClassId,
  CHARACTER_CLASS_IDS,
} from './CharacterClasses'
import { SKILL_DEFINITIONS } from '../skills/Skills'

describe('Classes', () => {
  it('defines eight valid, distinct starter classes', () => {
    expect(CHARACTER_CLASS_IDS).toEqual([
      'knight',
      'ranger',
      'necromancer',
      'frost-warden',
      'ashen-alchemist',
      'war-shepherd',
      'riftwalker',
      'bloodweaver',
    ])
    expect(isCharacterClassId('ranger')).toBe(true)
    expect(isCharacterClassId('frost-warden')).toBe(true)
    expect(isCharacterClassId('unknown')).toBe(false)
  })

  it('initializes the selected class with its authored stats and skills', () => {
    for (const characterClassId of CHARACTER_CLASS_IDS) {
      const definition = getCharacterClassDefinition(characterClassId)
      const player = createInitialPlayerState(1, undefined, characterClassId)
      expect(player.characterClassId).toBe(characterClassId)
      expect(player.baseStats).toEqual(definition.baseStats)
      expect(player.skills.map((skill) => skill.skillId)).toEqual(definition.startingSkillIds)
    }
  })

  it('keeps class descriptions flavor-focused without naming skills', () => {
    for (const characterClassId of CHARACTER_CLASS_IDS) {
      const description = getCharacterClassDefinition(characterClassId).description.toLowerCase()
      for (const skill of Object.values(SKILL_DEFINITIONS)) {
        expect(description).not.toContain(skill.name.toLowerCase())
      }
    }
  })
})
