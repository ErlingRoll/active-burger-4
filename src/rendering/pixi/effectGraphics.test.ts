import { describe, expect, it } from 'vitest'
import {
  ALL_TELEGRAPH_PALETTES,
  getTelegraphPalette,
  HOSTILE_TELEGRAPH_RIM,
} from './effectGraphics'
import {
  BASIC_ATTACK_VARIANTS,
  SKILL_DEFINITIONS,
} from '../../content/skills/Skills'
import { DAMAGE_TYPES } from '../../content/stats/Damage'

/**
 * Keeps one colour meaning "this is aimed at you".
 *
 * A telegraph carries two messages at once: which damage school is coming, and
 * that it is coming at all. The school is the interior, and it deliberately
 * overlaps the player's own palette - a cold warning is the same cyan family as
 * a frost skill, because that is what the word cold looks like in this game.
 * The second message is the rim, and it only works while nothing the player
 * owns wears it.
 */

/**
 * Every colour the player's own effects are drawn in.
 *
 * The Basic Attack variants belong here as much as the skills do: they are the
 * thing on screen most of the time, and a wand bolt in the incoming-attack
 * colour would undo the rule on its own.
 */
function playerEffectColors(): readonly string[] {
  const visuals = [
    ...Object.values(SKILL_DEFINITIONS).map((skill) => skill.visual),
    ...Object.values(BASIC_ATTACK_VARIANTS).map((variant) => variant.visual),
  ]
  return visuals.flatMap((visual) => [
    visual.primaryColor,
    visual.secondaryColor,
    visual.outlineColor,
  ])
}

describe('the hostile telegraph rim', () => {
  it('is not a colour any player effect uses', () => {
    const clashes = playerEffectColors()
      .filter((color) => color.toLowerCase() === HOSTILE_TELEGRAPH_RIM.toLowerCase())

    expect(clashes, 'a player effect has taken the incoming-attack colour')
      .toEqual([])
  })

  it('is not one of the damage-school colours it frames', () => {
    // The rim has to read as a separate statement from the interior, or a
    // warning in that school would be one flat shape with nothing to say.
    for (const palette of ALL_TELEGRAPH_PALETTES) {
      expect([palette.color, palette.lightColor, palette.darkColor])
        .not.toContain(HOSTILE_TELEGRAPH_RIM)
    }
  })
})

describe('getTelegraphPalette', () => {
  it('has a palette for every damage school', () => {
    for (const element of DAMAGE_TYPES) {
      const palette = getTelegraphPalette({ element })

      expect(palette.color).toMatch(/^#[0-9a-f]{6}$/i)
      expect(palette.lightColor).not.toBe(palette.color)
      expect(palette.darkColor).not.toBe(palette.color)
    }
  })

  it('gives a warning with no stated school one anyway', () => {
    // An attack that never says what it deals still has to be visible.
    const palette = getTelegraphPalette({ element: undefined })

    expect(palette.color).toMatch(/^#[0-9a-f]{6}$/i)
    expect(ALL_TELEGRAPH_PALETTES).toContain(palette)
  })

  it('tells the schools apart', () => {
    const interiors = DAMAGE_TYPES.map(
      (element) => getTelegraphPalette({ element }).color,
    )

    expect(new Set(interiors).size).toBe(DAMAGE_TYPES.length)
  })
})
