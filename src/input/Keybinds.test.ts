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
      choiceLeft: '1',
      choiceMiddle: '2',
      choiceRight: '3',
      skipChoice: '5',
    })
  })

  it('normalizes persisted bindings while preserving safe defaults', () => {
    expect(normalizeGameKeybinds({
      behaviorAggressive: ' A ',
      behaviorBalanced: '',
      choiceLeft: 'ArrowLeft',
      choiceRight: 42,
      skipChoice: 'x',
    })).toEqual({
      behaviorAggressive: 'a',
      behaviorBalanced: 's',
      behaviorCautious: 'd',
      choiceLeft: 'arrowleft',
      choiceMiddle: '2',
      choiceRight: '3',
      skipChoice: 'x',
    })
  })

  it('rejects persisted use of the fixed Free movement toggle', () => {
    expect(normalizeGameKeybinds({
      behaviorAggressive: 'f',
    }).behaviorAggressive).toBe('a')
  })

  it('migrates the former Q/W/E choice defaults to 1/2/3', () => {
    expect(normalizeGameKeybinds({
      choiceLeft: 'q',
      choiceMiddle: 'w',
      choiceRight: 'e',
    })).toMatchObject({
      choiceLeft: '1',
      choiceMiddle: '2',
      choiceRight: '3',
    })
  })

  it('does not allow upgrade choices to use Free movement keys', () => {
    expect(normalizeGameKeybinds({
      choiceLeft: 'a',
      choiceMiddle: 'w',
      choiceRight: 'd',
    })).toMatchObject({
      choiceLeft: '1',
      choiceMiddle: '2',
      choiceRight: '3',
    })
  })

  it('formats printable and named keys for dim UI hints', () => {
    expect(formatKeybind('a')).toBe('A')
    expect(formatKeybind('arrowleft')).toBe('Left')
    expect(formatKeybind('space')).toBe('Space')
    expect(normalizeKey(' ')).toBe('space')
  })
})
