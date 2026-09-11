import { describe, expect, it } from 'vitest'
import { CAMP_JOB_DEFINITIONS } from './CampJobs'
import {
  CAMP_FIT_CAP,
  CAMP_OUTPUT_CAP,
  CAMP_STAMINA_MAX_HOURS,
  CAMP_STAMINA_MIN_HOURS,
  CAMP_STRENGTH_CAP,
  CAMP_TEMPO_RANGE,
  deriveCampLabourSheet,
  formatCampLabourSheet,
  type CampLabourBuild,
  type CampLabourPiece,
} from './CampLabour'

/**
 * The sheet reads the build the Champion fights with. These specs pin the
 * shape of that reading: what raises each figure, what the bounds are, and
 * that nothing outside the build can move it. The exact figures for a set
 * of whole builds are pinned by tests/campRegistry.test.ts, which holds this
 * twin and the SQL one to the same fixtures.
 */

const woodline = CAMP_JOB_DEFINITIONS['woodline-timber']
const quarry = CAMP_JOB_DEFINITIONS['quarry-stone']

function build(overrides: Partial<CampLabourBuild> = {}): CampLabourBuild {
  return {
    level: 1,
    skills: [],
    equipment: {},
    behaviorProfileId: 'balanced',
    ...overrides,
  }
}

function piece(overrides: Partial<CampLabourPiece> & { modifiers?: { id: string, value: number }[] } = {}): CampLabourPiece {
  return { rarity: 'common', modifiers: [], ...overrides }
}

describe('deriveCampLabourSheet', () => {
  it('gives a bare recruit a sheet of ones and eight hours', () => {
    const sheet = deriveCampLabourSheet({ build: build(), sourceFloor: null }, woodline)
    expect(sheet).toMatchObject({
      strength: 1, tempo: 1, staminaHours: 8, load: 1, bonusChance: 0, fit: 1, haste: 1, output: 1,
    })
  })

  it('treats a missing level as the first', () => {
    const sheet = deriveCampLabourSheet({ build: build({ level: undefined }), sourceFloor: null }, woodline)
    expect(sheet.inputs).toMatchObject({ level: 1, floor: 1 })
  })

  it('lets the level stand in for the floor when there was no run', () => {
    const earned = deriveCampLabourSheet({ build: build({ level: 20 }), sourceFloor: 20 }, woodline)
    const generated = deriveCampLabourSheet({ build: build({ level: 20 }), sourceFloor: null }, woodline)
    expect(generated.strength).toBe(earned.strength)
    expect(generated.inputs.floor).toBe(20)
  })

  it('makes a veteran better at everything, up to the strength cap', () => {
    const shallow = deriveCampLabourSheet({ build: build({ level: 15 }), sourceFloor: 12 }, woodline)
    const deep = deriveCampLabourSheet({ build: build({ level: 60 }), sourceFloor: 40 }, woodline)
    expect(shallow.strength).toBeGreaterThan(1)
    expect(deep.strength).toBe(CAMP_STRENGTH_CAP)
    expect(deep.tempo).toBeGreaterThan(shallow.tempo)
    expect(deep.load).toBeGreaterThan(shallow.load)
  })

  it('reads attack speed as tempo and max HP as stamina', () => {
    const gear = build({
      equipment: {
        weapon: piece({ modifiers: [{ id: 'attack-speed', value: 20 }] }),
        armor: piece({ modifiers: [{ id: 'max-hp', value: 40 }] }),
      },
    })
    const sheet = deriveCampLabourSheet({ build: gear, sourceFloor: null }, woodline)
    expect(sheet.tempo).toBe(1.1)
    expect(sheet.staminaHours).toBe(8.8)
    expect(sheet.inputs).toMatchObject({ attackSpeedPercent: 20, maxHpFlat: 40 })
  })

  it('reads the increased-damage family as load and critical chance as the bonus', () => {
    const gear = build({
      equipment: {
        weapon: piece({ modifiers: [
          { id: 'increased-global-damage', value: 15 },
          { id: 'increased-physical-damage', value: 15 },
          { id: 'crit-chance', value: 12 },
          { id: 'crit-multiplier', value: 90 },
        ] }),
      },
    })
    const sheet = deriveCampLabourSheet({ build: gear, sourceFloor: null }, woodline)
    expect(sheet.load).toBe(1.1)
    expect(sheet.bonusChance).toBe(0.12)
  })

  it('caps the bonus chance at a quarter', () => {
    const gear = build({
      equipment: {
        weapon: piece({ modifiers: [{ id: 'crit-chance', value: 16 }] }),
        ring: piece({ modifiers: [{ id: 'crit-chance', value: 16 }] }),
      },
    })
    expect(deriveCampLabourSheet({ build: gear, sourceFloor: null }, woodline).bonusChance).toBe(0.25)
  })

  it('trades tempo against stamina by behaviour profile', () => {
    const aggressive = deriveCampLabourSheet({ build: build({ behaviorProfileId: 'aggressive', level: 30 }), sourceFloor: 30 }, woodline)
    const cautious = deriveCampLabourSheet({ build: build({ behaviorProfileId: 'cautious', level: 30 }), sourceFloor: 30 }, woodline)
    const balanced = deriveCampLabourSheet({ build: build({ behaviorProfileId: 'balanced', level: 30 }), sourceFloor: 30 }, woodline)
    expect(aggressive.tempo).toBeGreaterThan(balanced.tempo)
    expect(aggressive.staminaHours).toBeLessThan(balanced.staminaHours)
    expect(cautious.tempo).toBeLessThan(balanced.tempo)
    expect(cautious.staminaHours).toBeGreaterThan(balanced.staminaHours)
  })

  it('keeps stamina between six and twelve hours', () => {
    const drained = build({ behaviorProfileId: 'aggressive' })
    const hardy = build({
      behaviorProfileId: 'cautious',
      equipment: { armor: piece({ modifiers: [{ id: 'max-hp', value: 70 }] }), helmet: piece({ modifiers: [{ id: 'max-hp', value: 70 }] }) },
    })
    expect(deriveCampLabourSheet({ build: drained, sourceFloor: null }, woodline).staminaHours).toBe(CAMP_STAMINA_MIN_HOURS)
    expect(deriveCampLabourSheet({ build: hardy, sourceFloor: null }, woodline).staminaHours).toBe(CAMP_STAMINA_MAX_HOURS)
  })

  it('never lets a slow profile push tempo under one', () => {
    const sheet = deriveCampLabourSheet({ build: build({ behaviorProfileId: 'cautious' }), sourceFloor: null }, woodline)
    expect(sheet.tempo).toBe(CAMP_TEMPO_RANGE.min)
  })

  it('counts set pieces for the job they fit, weighted by rarity, and nowhere else', () => {
    const gear = build({
      equipment: {
        weapon: piece({ setId: 'giant', rarity: 'legendary' }),
        armor: piece({ setId: 'giants', rarity: 'common' }),
        boots: piece({ setId: 'splintering', rarity: 'legendary' }),
      },
    })
    const atQuarry = deriveCampLabourSheet({ build: gear, sourceFloor: null }, quarry)
    const atWoodline = deriveCampLabourSheet({ build: gear, sourceFloor: null }, woodline)
    expect(atQuarry.inputs.setRarityWeight).toBe(6)
    expect(atQuarry.fit).toBe(1.03)
    expect(atWoodline.inputs.setRarityWeight).toBe(5)
    expect(atWoodline.fit).toBe(1.025)
  })

  it('counts the levels of skills tagged for the job, once per skill', () => {
    const skilled = build({
      skills: [
        { skillId: 'whirlwind', level: 3 },
        { skillId: 'chain-lightning', level: 5 },
        { skillId: 'raise-skeleton', level: 2 },
      ],
    })
    const sheet = deriveCampLabourSheet({ build: skilled, sourceFloor: null }, woodline)
    expect(sheet.inputs.tagLevelWeight).toBe(5)
    expect(sheet.fit).toBe(1.05)
  })

  it('caps fit at a quarter above one', () => {
    const outfitted = build({
      skills: [
        { skillId: 'whirlwind', level: 5 },
        { skillId: 'lancers-charge', level: 5 },
        { skillId: 'raise-skeleton', level: 5 },
      ],
      equipment: Object.fromEntries(
        ['weapon', 'helmet', 'armor', 'boots', 'ring', 'amulet']
          .map((slot) => [slot, piece({ setId: 'splintering', rarity: 'legendary' })]),
      ),
    })
    expect(deriveCampLabourSheet({ build: outfitted, sourceFloor: null }, woodline).fit).toBe(CAMP_FIT_CAP)
  })

  it('caps the combined output at two', () => {
    const monster = build({
      level: 100,
      behaviorProfileId: 'aggressive',
      skills: [{ skillId: 'whirlwind', level: 5 }, { skillId: 'lancers-charge', level: 5 }],
      equipment: Object.fromEntries(
        ['weapon', 'helmet', 'armor', 'boots', 'ring', 'amulet'].map((slot) => [
          slot,
          piece({
            setId: 'splintering',
            rarity: 'legendary',
            modifiers: [{ id: 'attack-speed', value: 24 }, { id: 'increased-global-damage', value: 25 }],
          }),
        ]),
      ),
    })
    const sheet = deriveCampLabourSheet({ build: monster, sourceFloor: 60 }, woodline)
    expect(sheet.tempo).toBe(CAMP_TEMPO_RANGE.max)
    expect(sheet.output).toBe(CAMP_OUTPUT_CAP)
  })

  it('ignores modifiers it does not read and pieces without them', () => {
    const odd = build({
      equipment: {
        weapon: piece({ modifiers: [{ id: 'cooldown-reduction', value: 30 }, { id: 'attack-speed', value: Number.NaN }] }),
        ring: { setId: 'scholar' },
        amulet: undefined,
      },
    })
    const sheet = deriveCampLabourSheet({ build: odd, sourceFloor: null }, woodline)
    expect(sheet.inputs.attackSpeedPercent).toBe(0)
    expect(sheet.output).toBe(1)
  })
})

describe('formatCampLabourSheet', () => {
  it('reads as one line the picker can show', () => {
    const sheet = deriveCampLabourSheet({
      build: build({
        level: 30,
        behaviorProfileId: 'aggressive',
        equipment: { armor: piece({ modifiers: [{ id: 'max-hp', value: 40 }] }) },
      }),
      sourceFloor: 20,
    }, woodline)
    expect(formatCampLabourSheet(sheet)).toBe('Tempo ×1.56 · Stamina 6.6h · Load ×1.3 · Fit ×1')
  })
})
