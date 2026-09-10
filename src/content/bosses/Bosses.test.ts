import { describe, expect, it } from 'vitest'
import {
  BOSS_DEFINITION_IDS,
  getBossDefinition,
  getBossSkillDefinition,
  getFloorBossIds,
  selectFloorBossId,
} from './Bosses'

describe('the boss roster', () => {
  it('offers many bosses, not one per act', () => {
    expect(
      BOSS_DEFINITION_IDS.filter((id) => getBossDefinition(id).role === 'floor')
        .length,
    ).toBeGreaterThanOrEqual(8)
  })

  it('gives every attack a shape and a stated counterplay', () => {
    for (const id of BOSS_DEFINITION_IDS) {
      const boss = getBossDefinition(id)
      expect(boss.skills.length).toBeGreaterThan(0)
      for (const skillId of boss.skills) {
        const skill = getBossSkillDefinition(skillId)
        expect(skill.counterplay.trim()).not.toBe('')
        expect(['disc', 'ring', 'line', 'cone']).toContain(skill.shape)
      }
    }
  })

  it('gives each boss a distinct silhouette', () => {
    const shapes = BOSS_DEFINITION_IDS.map(
      (id) => getBossDefinition(id).render.shape,
    )

    expect(new Set(shapes).size).toBe(shapes.length)
  })

  it('gives each boss an attack no other boss has', () => {
    // Two bosses that only share a movement speed are the same fight. Each one
    // needs at least one attack that is its own.
    for (const id of BOSS_DEFINITION_IDS) {
      const others = new Set(
        BOSS_DEFINITION_IDS.filter((other) => other !== id)
          .flatMap((other) => [...getBossDefinition(other).skills]),
      )
      expect(
        getBossDefinition(id).skills.some((skillId) => !others.has(skillId)),
      ).toBe(true)
    }
  })

  it('warns before every attack that is not contact damage', () => {
    for (const id of BOSS_DEFINITION_IDS) {
      for (const skillId of getBossDefinition(id).skills) {
        // A telegraph shorter than a reaction plus a step is not a warning.
        expect(getBossSkillDefinition(skillId).telegraphDuration)
          .toBeGreaterThanOrEqual(0.4)
      }
    }
  })
})

describe('getFloorBossIds', () => {
  it('sends only bosses a floor has reached', () => {
    for (const floor of [1, 4, 12, 40]) {
      for (const id of getFloorBossIds(floor)) {
        expect(getBossDefinition(id).minFloor).toBeLessThanOrEqual(floor)
      }
    }
  })

  it('never sends the boss that ends a dungeon to an ordinary floor', () => {
    expect(getFloorBossIds(500)).not.toContain('inferno-warden')
  })

  it('widens as the run descends', () => {
    expect(getFloorBossIds(20).length).toBeGreaterThan(getFloorBossIds(1).length)
  })

  it('always has something to send, even on floor one', () => {
    expect(getFloorBossIds(1).length).toBeGreaterThan(0)
  })
})

describe('selectFloorBossId', () => {
  it('is the same answer every time for a seed and a floor', () => {
    expect(selectFloorBossId(4321, 7)).toBe(selectFloorBossId(4321, 7))
  })

  it('gives two runs a different descent', () => {
    const floors = Array.from({ length: 30 }, (_, index) => index + 1)
    const one = floors.map((floor) => selectFloorBossId(11, floor))
    const another = floors.map((floor) => selectFloorBossId(12, floor))

    expect(another).not.toEqual(one)
  })

  it('varies between floors of the same run rather than repeating one boss', () => {
    const drawn = new Set(
      Array.from({ length: 30 }, (_, index) => selectFloorBossId(99, index + 1)),
    )

    expect(drawn.size).toBeGreaterThan(3)
  })

  it('respects eligibility for every seed it is asked about', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      for (const floor of [1, 2, 5, 9, 18]) {
        expect(getBossDefinition(selectFloorBossId(seed, floor)).minFloor)
          .toBeLessThanOrEqual(floor)
      }
    }
  })
})
