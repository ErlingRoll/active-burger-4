import { describe, expect, it } from 'vitest'
import {
  ELITE_MODIFIER_DEFINITIONS,
  getEliteBerserkingEffect,
  getEliteLeechingEffect,
  getElitePhaseboundDamageMultiplier,
  isEliteModifierCombinationAllowed,
  isEliteModifierAllowedForEnemy,
} from './EliteModifiers'
import { SPAWN_BALANCE } from '../spawning/SpawnBalance'
import {
  SpawnDirector,
  type SpawnDirectorState,
} from '../../game/spawning/SpawnDirector'

const spawnState: SpawnDirectorState = {
  time: 0,
  player: { x: 0, y: 0 },
  enemies: [],
  run: { floor: 20 },
}

describe('elite modifier effects', () => {
  it('defines every supported new elite modifier', () => {
    expect(Object.keys(ELITE_MODIFIER_DEFINITIONS)).toEqual(expect.arrayContaining([
      'armored',
      'berserking',
      'volatile',
      'leeching',
      'wardbound',
      'maddening',
      'spiteful',
      'phasebound',
    ]))
  })

  it('activates Berserking only at or below its health threshold', () => {
    expect(getEliteBerserkingEffect({
      hp: 51,
      maxHp: 100,
      eliteModifier: 'berserking',
    })).toBeUndefined()
    expect(getEliteBerserkingEffect({
      hp: 50,
      maxHp: 100,
      eliteModifier: 'berserking',
    })).toMatchObject({
      speedMultiplier: 1.35,
      contactDamageMultiplier: 1.2,
    })
  })

  it('reduces Leeching recovery when combined with Poisoner', () => {
    expect(getEliteLeechingEffect(['leeching'])).toMatchObject({
      healingRatio: 0.25,
      maximumHealRatio: 0.08,
    })
    expect(getEliteLeechingEffect(['leeching', 'poisoner'])).toMatchObject({
      healingRatio: 0.1,
      maximumHealRatio: 0.08,
    })
  })

  it('does not phase while frozen and only phases during its short interval window', () => {
    const phasebound = { eliteModifier: 'phasebound' as const, spawnTime: 0 }
    expect(getElitePhaseboundDamageMultiplier(phasebound, 4.99)).toBe(1)
    expect(getElitePhaseboundDamageMultiplier(phasebound, 5)).toBe(0.25)
    expect(getElitePhaseboundDamageMultiplier({
      ...phasebound,
      frozenRemainingDuration: 0.1,
    }, 5)).toBe(1)
  })

  it('excludes Volatile from Splitters', () => {
    expect(isEliteModifierAllowedForEnemy('splitter', 'volatile')).toBe(false)
    expect(isEliteModifierAllowedForEnemy('slime', 'volatile')).toBe(true)
  })

  it('excludes the Hasted and Berserking pairing during weighted selection', () => {
    const random = {
      next: () => 0,
      int: (_minimum: number, maximum: number) => maximum,
      chance: () => true,
      pick: <T>(items: readonly T[]) => items[0] as T,
    }
    const director = new SpawnDirector(random, {
      ...SPAWN_BALANCE,
      eliteChance: 1,
      eliteStartTimeSeconds: 0,
      eliteModifierWeights: { hasted: 1, berserking: 1 },
    })

    const [spawn] = director.update(spawnState, 1)

    expect(spawn?.eliteModifiers).toEqual(['hasted'])
  })

  it('excludes the Hasted, Flanking, and Maddening triple only', () => {
    expect(isEliteModifierCombinationAllowed(
      ['hasted', 'flanking'],
      'maddening',
    )).toBe(false)
    expect(isEliteModifierCombinationAllowed(
      ['hasted', 'maddening'],
      'flanking',
    )).toBe(false)
    expect(isEliteModifierCombinationAllowed(
      ['flanking', 'maddening'],
      'hasted',
    )).toBe(false)
    expect(isEliteModifierCombinationAllowed(['hasted'], 'maddening')).toBe(true)
  })
})
