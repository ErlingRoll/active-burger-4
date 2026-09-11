import { describe, expect, it } from 'vitest'
import { Random } from '../game/random/Random'
import { CHARACTER_CLASS_DEFINITIONS } from '../content/classes/CharacterClasses'
import { EQUIPMENT_SLOTS } from '../content/gear/Items'
import { Rarity } from '../content/rarity/Rarity'
import { GEAR_SET_DEFINITIONS } from '../game-config/gear-sets'
import {
  DEFAULT_DEVELOPMENT_CHAMPION_OPTIONS,
  generateDevelopmentChampionBuild,
  generateDevelopmentChampionName,
} from './DevelopmentChampion'
import { isCharacterBuildSnapshot } from './CharacterTypes'

describe('development Champion builds', () => {
  it('produces a build the game accepts, for many seeds and the defaults', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const build = generateDevelopmentChampionBuild(
        DEFAULT_DEVELOPMENT_CHAMPION_OPTIONS,
        new Random(seed),
      )
      expect(isCharacterBuildSnapshot(build)).toBe(true)
      expect(build.level).toBe(20)
      expect(build.selectedUpgradeIds).toEqual([])
      for (const slot of EQUIPMENT_SLOTS) {
        expect(build.equipment[slot], `${slot} at seed ${seed}`).toBeDefined()
      }
    }
  })

  it('is reproducible from its seed', () => {
    const first = generateDevelopmentChampionBuild(DEFAULT_DEVELOPMENT_CHAMPION_OPTIONS, new Random(7))
    const second = generateDevelopmentChampionBuild(DEFAULT_DEVELOPMENT_CHAMPION_OPTIONS, new Random(7))
    expect(second).toEqual(first)
  })

  it('honours the chosen class and keeps its starting skills, without duplicates', () => {
    const build = generateDevelopmentChampionBuild(
      { ...DEFAULT_DEVELOPMENT_CHAMPION_OPTIONS, classId: 'necromancer', extraSkillCount: 4 },
      new Random(3),
    )
    expect(build.classId).toBe('necromancer')
    const skillIds = build.skills.map((skill) => skill.skillId)
    for (const startingSkillId of CHARACTER_CLASS_DEFINITIONS.necromancer.startingSkillIds) {
      expect(skillIds).toContain(startingSkillId)
    }
    expect(new Set(skillIds).size).toBe(skillIds.length)
    expect(skillIds.length).toBe(CHARACTER_CLASS_DEFINITIONS.necromancer.startingSkillIds.length + 4)
  })

  it('rolls every piece at the minimum rarity or better', () => {
    const build = generateDevelopmentChampionBuild(
      { ...DEFAULT_DEVELOPMENT_CHAMPION_OPTIONS, minimumGearRarity: Rarity.Legendary },
      new Random(11),
    )
    for (const slot of EQUIPMENT_SLOTS) {
      expect(build.equipment[slot]?.rarity).toBe(Rarity.Legendary)
    }
  })

  it('leaves sets off when asked, and wears the chosen set where it fits', () => {
    const bare = generateDevelopmentChampionBuild(
      { ...DEFAULT_DEVELOPMENT_CHAMPION_OPTIONS, gearSetId: 'none' },
      new Random(5),
    )
    for (const slot of EQUIPMENT_SLOTS) {
      expect(bare.equipment[slot]?.setId).toBeUndefined()
    }

    const giant = generateDevelopmentChampionBuild(
      { ...DEFAULT_DEVELOPMENT_CHAMPION_OPTIONS, gearSetId: 'giant' },
      new Random(5),
    )
    for (const slot of GEAR_SET_DEFINITIONS.giant.slots) {
      expect(giant.equipment[slot]?.setId).toBe('giant')
    }
  })

  it('names a Champion after its class, within the name limit', () => {
    const name = generateDevelopmentChampionName('ranger', new Random(2))
    expect(name).toContain('Ranger')
    expect(name.length).toBeLessThanOrEqual(32)
  })
})
