import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GAME_KEYBINDS,
  formatKeybind,
  normalizeGameKeybinds,
  normalizeKey,
} from './Keybinds'

describe('game keybind settings', () => {
  it('provides the requested default bindings', () => {
    expect(DEFAULT_GAME_KEYBINDS).toEqual({
      behaviorAggressive: 'a',
      behaviorBalanced: 's',
      behaviorCautious: 'd',
      choiceLeft: 'q',
      choiceMiddle: 'w',
      choiceRight: 'e',
    })
  })

  it('normalizes persisted bindings while preserving safe defaults', () => {
    expect(normalizeGameKeybinds({
      behaviorAggressive: ' A ',
      behaviorBalanced: '',
      choiceLeft: 'ArrowLeft',
      choiceRight: 42,
    })).toEqual({
      behaviorAggressive: 'a',
      behaviorBalanced: 's',
      behaviorCautious: 'd',
      choiceLeft: 'arrowleft',
      choiceMiddle: 'w',
      choiceRight: 'e',
    })
  })

  it('formats printable and named keys for dim UI hints', () => {
    expect(formatKeybind('a')).toBe('A')
    expect(formatKeybind('arrowleft')).toBe('Left')
    expect(formatKeybind('space')).toBe('Space')
    expect(normalizeKey(' ')).toBe('space')
  })
})
