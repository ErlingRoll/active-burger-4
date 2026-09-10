import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TARGET_PRIORITY_ID,
  TARGET_FEATURE_KEYS,
  TARGET_PRIORITY_DEFINITIONS,
  TARGET_PRIORITY_ORDER,
  getTargetPriorityDefinition,
  getTargetPriorityPolicy,
  isTargetPriorityId,
} from './TargetPriorities'
import {
  CURRENT_CONTENT,
  validateContent,
  type ContentCatalog,
} from '../validation'
import { definedAt } from '../../testing'

describe('target priority content', () => {
  it('has stable unique IDs and a nearest default', () => {
    const priorities = TARGET_PRIORITY_ORDER.map(
      (priorityId) => TARGET_PRIORITY_DEFINITIONS[priorityId],
    )
    expect(DEFAULT_TARGET_PRIORITY_ID).toBe('nearest')
    expect(priorities.map((priority) => priority.id)).toEqual([
      'nearest',
      'wounded',
      'elites',
      'ranged',
    ])
    expect(new Set(priorities.map((priority) => priority.id)).size).toBe(priorities.length)
    expect(priorities.every((priority) => priority.id === priority.id.toLowerCase())).toBe(true)
    expect(getTargetPriorityDefinition(DEFAULT_TARGET_PRIORITY_ID).name).toBe('Nearest')
    expect(getTargetPriorityPolicy().commitmentSeconds).toBe(0)
  })

  it('recognizes only authored priority IDs', () => {
    expect(isTargetPriorityId('elites')).toBe(true)
    expect(isTargetPriorityId('lowest-health')).toBe(false)
    expect(isTargetPriorityId('nearest-first')).toBe(false)
    expect(isTargetPriorityId(undefined)).toBe(false)
  })

  it('weighs nothing at all under the default', () => {
    /*
     * The evaluator skips a zero weight rather than multiplying by it, so this
     * is what makes the default reproduce plain nearest-first selection
     * instead of approximating it. `Object.is` rules out a negative zero,
     * which would pass a loose comparison and change the arithmetic.
     */
    const weights = TARGET_PRIORITY_DEFINITIONS.nearest.weights
    expect(TARGET_FEATURE_KEYS.every((feature) => Object.is(weights[feature], 0))).toBe(true)
    expect(TARGET_PRIORITY_DEFINITIONS.nearest.scoreMargin).toBe(0)
  })

  it('keeps a boss above the strongest elite an enemy can carry', () => {
    // Three modifiers is the roster's cap, so this is the closest contest.
    const { weights } = TARGET_PRIORITY_DEFINITIONS.elites
    expect(weights.boss).toBeGreaterThan(weights.eliteModifierCount * 3 + weights.proximity)
  })

  it('gives every non-default priority a dwell time and a margin to beat', () => {
    const contested = TARGET_PRIORITY_ORDER
      .filter((priorityId) => priorityId !== DEFAULT_TARGET_PRIORITY_ID)
      .map((priorityId) => TARGET_PRIORITY_DEFINITIONS[priorityId])

    expect(contested.map((priority) => priority.commitmentSeconds)).toEqual([0.5, 1, 0.75])
    expect(contested.map((priority) => priority.scoreMargin)).toEqual([0.15, 0.25, 0.2])
    // Every priority weighs proximity, which is what stops it crossing a room.
    expect(contested.every((priority) => priority.weights.proximity > 0)).toBe(true)
  })

  it('validates priority identity and weights', () => {
    const catalog: ContentCatalog = {
      ...CURRENT_CONTENT,
      targetPriorities: [
        { ...definedAt(CURRENT_CONTENT.targetPriorities, 0, 'targetPriorities'), id: 'Not Stable' as never },
        { ...definedAt(CURRENT_CONTENT.targetPriorities, 1, 'targetPriorities'), name: '' },
      ],
    }
    expect(validateContent(catalog)).toEqual(expect.arrayContaining([
      'targetPriorities[0].id must use lowercase ASCII letters, numbers, and hyphens; received "Not Stable".',
      'targetPriorities[1].name must be a non-empty string.',
    ]))
  })

  it('rejects a catalog with no default priority, and one where nothing is unweighted', () => {
    const withoutDefault: ContentCatalog = {
      ...CURRENT_CONTENT,
      targetPriorities: [
        definedAt(CURRENT_CONTENT.targetPriorities, 2, 'targetPriorities'),
      ],
    }
    expect(validateContent(withoutDefault)).toEqual(expect.arrayContaining([
      'targetPriorities must include the default priority "nearest".',
      'exactly one target priority must weigh nothing, and it must be "nearest".',
    ]))
  })
})
