import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { SKILL_DEFINITIONS } from '../src/game-config/skills'
import { SYNERGY_UPGRADES } from '../src/game-config/synergies'
import { CHARACTER_CLASS_DEFINITIONS } from '../src/game-config/classes'
import { INITIAL_UPGRADES } from '../src/game-config/skill-upgrades'
import { ENEMY_DEFINITIONS } from '../src/game-config/enemies'
import { ELITE_MODIFIER_DEFINITIONS } from '../src/content/enemies/EliteModifiers'
import { WORLD_MODIFIER_DEFINITIONS } from '../src/content/modifiers/WorldModifiers'
import { ABYSS_MODIFIER_DEFINITIONS } from '../src/content/modifiers/AbyssModifiers'
import { ALL_ITEM_DEFINITIONS } from '../src/content/gear/Items'
import { ENEMY_ABILITY_DEFINITIONS } from '../src/content/enemies/EnemyAbilities'
import { DUNGEON_DEFINITIONS } from '../src/content/dungeons/Dungeons'
import {
  BOSS_DEFINITIONS,
  BOSS_SKILL_DEFINITIONS,
} from '../src/content/bosses/Bosses'

/**
 * Keeps PLAN.md's implementation snapshot true.
 *
 * That section calls itself "authoritative for the current repository" while
 * quietly drifting: it claimed 21 skills when there were 22, and omitted
 * Critical Spellstrike from the roster it listed. A document that asserts
 * authority and is wrong is worse than one that says nothing, so the counts are
 * now checked rather than maintained by hand.
 */

const planPath = path.resolve(import.meta.dirname, '../PLAN.md')
const plan = readFileSync(planPath, 'utf8')

function snapshotCount(label: string): number | undefined {
  const pattern = new RegExp('^' + label + ':[ \t]+([0-9]+)', 'm')
  const match = pattern.exec(plan)
  return match?.[1] === undefined ? undefined : Number(match[1])
}

const EXPECTED: Record<string, number> = {
  skills: Object.keys(SKILL_DEFINITIONS).length,
  synergies: SYNERGY_UPGRADES.length,
  classes: Object.keys(CHARACTER_CLASS_DEFINITIONS).length,
  upgrades: Object.keys(INITIAL_UPGRADES).length,
  enemies: Object.keys(ENEMY_DEFINITIONS).length,
  'elite modifiers': Object.keys(ELITE_MODIFIER_DEFINITIONS).length,
  'world modifiers': Object.keys(WORLD_MODIFIER_DEFINITIONS).length,
  'Abyss modifiers': ABYSS_MODIFIER_DEFINITIONS.length,
  'gear items': ALL_ITEM_DEFINITIONS.length,
  dungeons: Object.keys(DUNGEON_DEFINITIONS).length,
  'enemy abilities': Object.keys(ENEMY_ABILITY_DEFINITIONS).length,
  bosses: Object.keys(BOSS_DEFINITIONS).length,
  'boss attack types': Object.keys(BOSS_SKILL_DEFINITIONS).length,
}

describe("PLAN.md's implementation snapshot", () => {
  it.each(Object.entries(EXPECTED))(
    'reports the real number of %s',
    (label, expected) => {
      expect(snapshotCount(label), `PLAN.md is missing a "${label}:" count`)
        .toBe(expected)
    },
  )

  it('lists every skill in the roster paragraph', () => {
    const rosterStart = plan.indexOf('The skill roster is ')
    expect(rosterStart).toBeGreaterThan(-1)
    const roster = plan.slice(rosterStart, plan.indexOf('.', rosterStart + 400))

    const missing = Object.values(SKILL_DEFINITIONS)
      .map((skill) => skill.name)
      .filter((name) => !roster.includes(name))

    expect(missing).toEqual([])
  })

  it('counts every evolution branch', () => {
    const evolutions = Object.values(INITIAL_UPGRADES)
      .filter((upgrade) => upgrade.evolution !== undefined)

    expect(snapshotCount('skill evolutions')).toBe(evolutions.length)
  })
})
