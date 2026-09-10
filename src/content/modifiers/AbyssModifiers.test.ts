import { describe, expect, it } from 'vitest'
import {
  getAbyssEnemyEffects,
  getAbyssModifierChoices,
} from './AbyssModifiers'

describe('AbyssModifiers', () => {
  it('applies the 10x baseline and persistent modifiers', () => {
    const effects = getAbyssEnemyEffects({
      modeId: 'infinite-abyss',
      abyssModifierIds: ['enemy-health', 'enemy-speed', 'enemy-damage'],
    })

    expect(effects.maxHpMultiplier).toBeCloseTo(12.5)
    expect(effects.speedMultiplier).toBeCloseTo(1.15)
    expect(effects.damageMultiplier).toBeCloseTo(12)
  })

  it('keeps every danger on offer so the descent never runs out of them', () => {
    // Struck off as they were taken, the three of them left the fourth floor
    // with nothing to ask for and the Danger Score stuck at six for the rest of
    // an endless run.
    const choices = getAbyssModifierChoices()

    expect(choices.map((choice) => choice.modifierId)).toEqual([
      'enemy-health',
      'enemy-speed',
      'enemy-damage',
    ])
  })

  it('compounds a danger taken more than once', () => {
    const twice = getAbyssEnemyEffects({
      modeId: 'infinite-abyss',
      abyssModifierIds: ['enemy-health', 'enemy-health'],
    })

    expect(twice.maxHpMultiplier).toBeCloseTo(10 * 1.25 * 1.25)
  })
})
