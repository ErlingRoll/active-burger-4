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

  it('does not offer already selected modifiers again', () => {
    const choices = getAbyssModifierChoices(['enemy-health'])

    expect(choices.map((choice) => choice.modifierId)).toEqual([
      'enemy-speed',
      'enemy-damage',
    ])
  })
})
